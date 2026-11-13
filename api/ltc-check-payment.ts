import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import crypto from 'node:crypto';
import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || '';
let cachedMongoClient: MongoClient | null = null;

async function getMongoDatabase() {
  if (!cachedMongoClient) {
    cachedMongoClient = new MongoClient(MONGODB_URI, {
      connectTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000,
    });
    await cachedMongoClient.connect();
  }
  return cachedMongoClient.db('zentirog');
}

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const DISCORD_SALES_WEBHOOK = process.env.DISCORD_SALES_WEBHOOK || '';
const ORDER_SECRET = process.env.ORDER_TOKEN_SECRET || process.env.CRYPTOMUS_PAYMENT_KEY || 'order_salt_secret_zentirog_2026';
const resend = new Resend(RESEND_API_KEY);

interface CheckResult {
  hasTx: boolean;
  confirmed: boolean;
  amountReceivedLtc: number;
  txid?: string;
}

async function checkLtcAddressBlockchain(address: string, orderCreatedAt?: number): Promise<CheckResult> {
  try {
    const url = `https://litecoinspace.org/api/address/${address}/txs`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const txs = await res.json();
      if (Array.isArray(txs) && txs.length > 0) {
        let totalSatoshis = 0;
        let isConfirmed = false;
        let latestTxid = txs[0].txid;

        const minTimestamp = orderCreatedAt ? Math.floor(orderCreatedAt / 1000) - 300 : 0;

        for (const tx of txs) {
          const txTime = tx.status?.block_time || Math.floor(Date.now() / 1000);
          if (tx.status?.confirmed && txTime < minTimestamp) {
            continue;
          }

          if (tx.status?.confirmed) {
            isConfirmed = true;
          }
          for (const vout of (tx.vout || [])) {
            if (vout.scriptpubkey_address === address) {
              totalSatoshis += vout.value || 0;
            }
          }
        }

        const totalLtc = totalSatoshis / 1e8;
        return {
          hasTx: totalSatoshis > 0,
          confirmed: isConfirmed,
          amountReceivedLtc: totalLtc,
          txid: latestTxid,
        };
      }
    }
  } catch (err) {
    console.warn('LitecoinSpace query failed:', err);
  }

  return { hasTx: false, confirmed: false, amountReceivedLtc: 0 };
}

function verifyAndDecodeToken(token: string): any {
  if (!token || !token.includes('.')) return null;
  const [b64, signature] = token.split('.');
  const payloadStr = Buffer.from(b64, 'base64url').toString('utf8');
  const expectedSignature = crypto.createHmac('sha256', ORDER_SECRET).update(payloadStr).digest('hex');
  if (signature !== expectedSignature) return null;
  try {
    return JSON.parse(payloadStr);
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { orderId, orderToken } = req.body;
  if (!orderId && !orderToken) {
    return res.status(400).json({ error: 'Missing order identifiers' });
  }

  try {
    let orderData: any = null;

    if (orderToken) {
      orderData = verifyAndDecodeToken(orderToken);
    }

    if (!orderData && orderId) {
      try {
        const db = await getMongoDatabase();
        const mongoOrder = await db.collection('ltc_orders').findOne({ orderId });
        if (mongoOrder) {
          orderData = {
            orderId,
            status: mongoOrder.status || 'WAITING',
            ltcAddress: mongoOrder.ltcAddress || '',
            ltcAmount: Number(mongoOrder.ltcAmount || 0),
            username: mongoOrder.username || '',
            usernameId: mongoOrder.usernameId || '',
            customerEmail: mongoOrder.customerEmail || '',
            customerDiscord: mongoOrder.customerDiscord || '',
            credentials: mongoOrder.credentials || '',
            usdAmount: Number(mongoOrder.usdAmount || 0),
            discountCode: mongoOrder.discountCode || '',
            createdAt: mongoOrder.createdAt || 0,
          };
        }
      } catch {}
    }

    if (!orderData) {
      return res.status(401).json({ error: 'Invalid or missing order token' });
    }

    const {
      status,
      ltcAddress,
      ltcAmount: ltcAmountExpected,
      username,
      usernameId,
      customerEmail,
      customerDiscord,
      credentials,
      usdAmount,
      discountCode,
    } = orderData;

    if (!ltcAddress) {
      return res.status(404).json({ error: 'Deposit address not found for order' });
    }

    if (status === 'PAID') {
      return res.status(200).json({
        paid: true,
        confirmed: true,
        status: 'PAID',
        credentials,
        username,
        orderId,
      });
    }

    const check = await checkLtcAddressBlockchain(ltcAddress, orderData.createdAt);
    const threshold = (ltcAmountExpected || 0) * 0.95;
    const isSufficient = check.amountReceivedLtc >= threshold;

    if (!check.hasTx || !isSufficient) {
      return res.status(200).json({
        paid: false,
        hasUnconfirmedTx: check.hasTx,
        amountReceived: check.amountReceivedLtc,
        amountExpected: ltcAmountExpected,
        status: 'WAITING',
      });
    }

    // Update LTC order status to PAID in MongoDB
    try {
      const db = await getMongoDatabase();
      await db.collection('ltc_orders').updateOne(
        { orderId },
        { $set: { status: 'PAID', paidAt: Date.now(), txid: check.txid || '' } }
      );
    } catch {}

    // Mark username document as SOLD in MongoDB
    if (usernameId) {
      try {
        const db = await getMongoDatabase();
        const query = ObjectId.isValid(usernameId)
          ? { _id: new ObjectId(usernameId) }
          : { username: usernameId };
        await db.collection('usernames').updateOne(query, { $set: { isSold: true, price: 'SOLD' } });
      } catch {}
    }

    // Dispatch Full Delivery Email with Instructions
    if (customerEmail) {
      await dispatchDeliveryEmail({
        customerEmail,
        username: username || 'Discord Identifier',
        orderId,
        amount: usdAmount ? usdAmount.toFixed(2) : '1.00',
        currency: 'USD (LTC)',
        credentials,
      });
    }

    // Send Discord Sales Webhook
    await sendDiscordSaleNotification({
      orderId,
      username: username || 'Discord Identifier',
      customerEmail,
      customerDiscord,
      amount: `${usdAmount ? usdAmount.toFixed(2) : '1.00'} (${check.amountReceivedLtc} LTC)`,
      currency: 'USD',
      discountCode,
      isDelivered: Boolean(credentials && credentials.trim()),
      paymentMethod: 'EXODUS LTC GATEWAY (DIRECT)',
    });

    return res.status(200).json({
      paid: true,
      confirmed: check.confirmed,
      status: 'PAID',
      credentials,
      username,
      orderId,
    });
  } catch (error: any) {
    console.error('Error checking LTC payment:', error);
    return res.status(500).json({ error: error.message || 'Payment check error' });
  }
}

async function dispatchDeliveryEmail(params: {
  customerEmail: string;
  username: string;
  orderId: string;
  amount: string;
  currency: string;
  credentials?: string;
}) {
  const { customerEmail, username, orderId, amount, currency, credentials } = params;

  let activeDiscordLink = 'https://discord.gg/5WC6sH2rrj';
  try {
    const db = await getMongoDatabase();
    const configDoc = await db.collection('settings').findOne({ _id: 'config' as any });
    activeDiscordLink = configDoc?.discordServerLink || activeDiscordLink;
  } catch {}

  const hasCredentials = Boolean(credentials && credentials.trim().length > 0);

  const credentialsBlock = hasCredentials
    ? `
      <div style="background-color: #0c0d10; border: 1px solid #d4af37; padding: 22px; margin-bottom: 24px;">
        <div style="font-family: monospace; font-size: 11px; color: #d4af37; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 1px;">
          INSTANT ACCOUNT CREDENTIALS
        </div>
        <pre style="background-color: #050608; border: 1px solid #23252c; padding: 16px; color: #ffffff; font-family: monospace; font-size: 14px; word-break: break-all; white-space: pre-wrap; margin: 0 0 12px 0;">${credentials}</pre>
        <p style="font-size: 12px; color: #a1a1aa; margin: 0; line-height: 1.5;">
          Follow the official instructions below immediately to secure your new account.
        </p>
      </div>
    `
    : `
      <div style="background-color: #1f1811; border: 1px solid #5a3c18; padding: 20px; margin-bottom: 24px;">
        <div style="font-family: monospace; font-size: 11px; color: #d4af37; font-weight: 700; text-transform: uppercase; margin-bottom: 8px;">
          MANUAL DESK FULFILLMENT REQUIRED
        </div>
        <p style="font-size: 13px; color: #e6dfd5; margin: 0 0 14px 0; line-height: 1.6;">
          Your order has been recorded! The credentials for <strong>${username}</strong> are held in offline cold storage.
        </p>
        <p style="font-size: 13px; color: #e6dfd5; margin: 0 0 16px 0; line-height: 1.6;">
          Please open a ticket on Discord or DM owner <strong style="color: #ffffff; font-family: monospace;">@nonconfident</strong> with your invoice reference:
        </p>
        <div style="background-color: #0c0d10; border: 1px solid #333745; padding: 12px; font-family: monospace; font-size: 12px; color: #a1a1aa; margin-bottom: 16px;">
          Order Reference: <strong style="color: #ffffff;">${orderId}</strong><br/>
          Identifier: <strong style="color: #ffffff;">${username}</strong><br/>
          Email: <strong style="color: #ffffff;">${customerEmail}</strong><br/>
          Direct Contact: <strong style="color: #d4af37;">@nonconfident</strong> on Discord
        </div>
        <a href="${activeDiscordLink}" style="display: inline-block; background-color: #d4af37; color: #090a0d; font-family: monospace; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; padding: 12px 24px; text-decoration: none;">Join Discord & Contact @nonconfident</a>
      </div>
    `;

  const instructionsBlock = `
    <div style="background-color: #101115; border: 1px solid #23252c; padding: 22px; margin-bottom: 24px;">
      <div style="font-family: monospace; font-size: 11px; color: #d4af37; font-weight: 700; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 1px;">
        OFFICIAL ACCOUNT ACCESS INSTRUCTIONS
      </div>
      
      <div style="font-size: 13px; color: #c4c7cf; line-height: 1.6; margin-bottom: 14px;">
        <strong style="color: #ffffff; display: block; margin-bottom: 4px;">1. Understanding Your Credential Format:</strong>
        <span style="font-family: monospace; background: #08090b; padding: 3px 6px; border: 1px solid #22242a; color: #d4af37; font-size: 12px;">email : password : token</span> 
        <span style="color: #71717a; margin: 0 4px;">OR</span> 
        <span style="font-family: monospace; background: #08090b; padding: 3px 6px; border: 1px solid #22242a; color: #d4af37; font-size: 12px;">email : password : discord_password : token</span>
      </div>

      <div style="font-size: 13px; color: #c4c7cf; line-height: 1.6; margin-bottom: 14px;">
        <strong style="color: #ffffff; display: block; margin-bottom: 4px;">2. Accessing Temporary Webmail (Yopmail):</strong>
        If your credential only contains <code style="color: #d4af37; background: #08090b; padding: 2px 4px;">mail:pass</code> and the email domain is 
        <strong style="color: #ffffff;">@zormail.onl</strong>, <strong style="color: #ffffff;">@ztmail.vip</strong>, or <strong style="color: #ffffff;">@1xp.fr</strong>:
        <ul style="margin: 8px 0 0 18px; padding: 0; color: #a1a1aa;">
          <li>Visit <a href="https://yopmail.com" style="color: #d4af37; text-decoration: underline;">https://yopmail.com</a></li>
          <li>Type the username portion of the email into the lookup box to open its webmail inbox without a password and read login verification codes directly.</li>
        </ul>
      </div>

      <div style="font-size: 13px; color: #c4c7cf; line-height: 1.6;">
        <strong style="color: #ffffff; display: block; margin-bottom: 4px;">3. Account Security & Verification Notice:</strong>
        If Discord displays an account restriction or temporary lock banner for 2 days, <strong>this is completely normal</strong>. It is Discord's standard automated security measure when logging into an account from a new IP/browser fingerprint. The restriction automatically expires after 48 hours.
      </div>
    </div>
  `;

  try {
    await resend.emails.send({
      from: 'Zentirog Vault <orders@users.zentirog.lol>',
      to: customerEmail,
      subject: `Your Discord Handle: ${username} [Order ${orderId}]`,
      html: `
        <div style="background-color: #090a0d; color: #eaebee; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 32px 20px; line-height: 1.6;">
          <div style="max-width: 580px; margin: 0 auto; background-color: #101115; border: 1px solid #22242a; padding: 32px;">
            <div style="border-bottom: 1px solid #22242a; padding-bottom: 20px; margin-bottom: 24px;">
              <span style="font-family: monospace; font-size: 11px; letter-spacing: 2px; color: #d4af37; text-transform: uppercase;">ZENTIROG VAULT / DISPATCH</span>
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 8px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">Order Confirmation</h1>
            </div>

            <div style="background-color: #0c0d10; border: 1px solid #22242a; padding: 18px; margin-bottom: 24px;">
              <div style="font-family: monospace; font-size: 11px; color: #71717a; text-transform: uppercase; margin-bottom: 4px;">ACQUIRED IDENTIFIER</div>
              <div style="font-family: monospace; font-size: 22px; font-weight: 700; color: #ffffff;">${username}</div>
              <div style="font-family: monospace; font-size: 12px; color: #a1a1aa; margin-top: 6px;">Order ID: ${orderId} · Total: $${amount} ${currency}</div>
            </div>

            ${credentialsBlock}

            ${instructionsBlock}

            <div style="border-top: 1px solid #22242a; padding-top: 20px; text-align: center;">
              <p style="font-size: 12px; color: #71717a; margin: 0 0 12px 0;">Need assistance with transfer? Contact @nonconfident directly:</p>
              <a href="${activeDiscordLink}" style="display: inline-block; background-color: #1c1e24; color: #ffffff; border: 1px solid #333742; font-family: monospace; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 10px 20px; text-decoration: none;">Join Discord Community</a>
            </div>
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error('Failed to send Resend email in ltc-check-payment:', err);
  }
}

async function sendDiscordSaleNotification(params: {
  orderId: string;
  username: string;
  customerEmail: string;
  customerDiscord?: string;
  amount: string;
  currency: string;
  discountCode?: string;
  isDelivered: boolean;
  paymentMethod: string;
}) {
  if (!DISCORD_SALES_WEBHOOK) return;
  try {
    const embed = {
      title: '⚡ NEW VAULT PURCHASE SUCCESSFUL',
      description: `Target Identifier **${params.username}** has been secured!`,
      color: 0xd4af37,
      fields: [
        { name: '🎯 Username / Identifier', value: `\`${params.username}\``, inline: true },
        { name: '💰 Amount Paid', value: `**${params.amount}**`, inline: true },
        { name: '💳 Method', value: params.paymentMethod, inline: true },
        { name: '📧 Customer Email', value: params.customerEmail ? `\`${params.customerEmail}\`` : '*Not provided*', inline: true },
        { name: '💬 Customer Discord', value: params.customerDiscord ? `**${params.customerDiscord}**` : '*Not provided*', inline: true },
        { name: '📦 Fulfillment Status', value: params.isDelivered ? '✅ **Delivered Instantly**' : '⏳ **Cold Storage Ticket Required**', inline: true },
        { name: '🧾 Order ID', value: `\`${params.orderId}\``, inline: false },
      ],
      footer: { text: 'Zentirog Autonomous Gateway • users.zentirog.lol' },
      timestamp: new Date().toISOString(),
    };

    await fetch(DISCORD_SALES_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: '@everyone 🚨 **New Username Purchase Confirmed! (LTC)**',
        embeds: [embed],
      }),
    });
  } catch (err) {
    console.error('Failed to dispatch Discord webhook:', err);
  }
}
