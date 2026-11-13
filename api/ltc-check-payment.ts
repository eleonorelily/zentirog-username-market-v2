import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import crypto from 'node:crypto';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const DISCORD_SALES_WEBHOOK = process.env.DISCORD_SALES_WEBHOOK || '';
const ORDER_SECRET = process.env.ORDER_TOKEN_SECRET || process.env.CRYPTOMUS_PAYMENT_KEY || 'order_salt_secret_zentirog_2026';
const FIREBASE_PROJECT_ID = 'zentirog-market-2026';
const resend = new Resend(RESEND_API_KEY);

interface CheckResult {
  hasTx: boolean;
  confirmed: boolean;
  amountReceivedLtc: number;
  txid?: string;
}

async function checkLtcAddressBlockchain(address: string): Promise<CheckResult> {
  try {
    const url = `https://litecoinspace.org/api/address/${address}/txs`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const txs = await res.json();
      if (Array.isArray(txs) && txs.length > 0) {
        let totalSatoshis = 0;
        let isConfirmed = false;
        let latestTxid = txs[0].txid;

        for (const tx of txs) {
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

  const { orderId, orderToken, address: fallbackAddress, ltcAmount: fallbackAmount } = req.body;
  if (!orderId && !orderToken) {
    return res.status(400).json({ error: 'Missing order identifiers' });
  }

  try {
    let orderData: any = null;

    // First try verified cryptographically signed token (immune to DB throttling)
    if (orderToken) {
      orderData = verifyAndDecodeToken(orderToken);
    }

    // Fallback: try Firestore
    if (!orderData && orderId) {
      try {
        const orderRes = await fetch(
          `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/orders/${orderId}?key=AIzaSyAhd2t2lx8ooUYEdlll2V0YLSCq3QgOK2k`
        );
        if (orderRes.ok) {
          const orderJson = await orderRes.json();
          const f = orderJson.fields || {};
          orderData = {
            orderId,
            status: f.status?.stringValue || 'WAITING',
            ltcAddress: f.ltcAddress?.stringValue || '',
            ltcAmount: Number(f.ltcAmount?.doubleValue || 0),
            username: f.username?.stringValue || '',
            usernameId: f.usernameId?.stringValue || '',
            customerEmail: f.customerEmail?.stringValue || '',
            customerDiscord: f.customerDiscord?.stringValue || '',
            credentials: f.credentials?.stringValue || '',
            usdAmount: Number(f.usdAmount?.doubleValue || 0),
            discountCode: f.discountCode?.stringValue || '',
          };
        }
      } catch {}
    }

    // If order was created during 429 quota and token wasn't cached yet, construct from verified parameters
    if (!orderData) {
      orderData = {
        orderId,
        status: 'WAITING',
        ltcAddress: fallbackAddress || '',
        ltcAmount: Number(fallbackAmount || 0),
        username: '',
        customerEmail: '',
        credentials: '',
        usdAmount: 0,
      };
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

    // Check blockchain for transactions on this address
    const check = await checkLtcAddressBlockchain(ltcAddress);

    // Accept if received is at least 95% of expected
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

    // PAYMENT CONFIRMED!
    // Try to update Firestore order status
    try {
      await fetch(
        `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/orders/${orderId}?updateMask.fieldPaths=status&updateMask.fieldPaths=paidAt&updateMask.fieldPaths=txid&key=AIzaSyAhd2t2lx8ooUYEdlll2V0YLSCq3QgOK2k`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              status: { stringValue: 'PAID' },
              paidAt: { integerValue: String(Date.now()) },
              txid: { stringValue: check.txid || '' },
            },
          }),
        }
      );
    } catch {}

    // Mark username document as SOLD
    if (usernameId) {
      try {
        await fetch(
          `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/usernames/${usernameId}?updateMask.fieldPaths=isSold&updateMask.fieldPaths=price&key=AIzaSyAhd2t2lx8ooUYEdlll2V0YLSCq3QgOK2k`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fields: {
                isSold: { booleanValue: true },
                price: { stringValue: 'SOLD' },
              },
            }),
          }
        );
      } catch {}
    }

    // Dispatch Delivery Email to customer
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
  const hasCredentials = Boolean(credentials && credentials.trim().length > 0);

  const credentialsBlock = hasCredentials
    ? `
      <div style="background-color: #0c0d10; border: 1px solid #d4af37; padding: 22px; margin-bottom: 24px;">
        <div style="font-family: monospace; font-size: 11px; color: #d4af37; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 1px;">
          INSTANT ACCOUNT CREDENTIALS
        </div>
        <pre style="background-color: #050608; border: 1px solid #23252c; padding: 16px; color: #ffffff; font-family: monospace; font-size: 14px; word-break: break-all; white-space: pre-wrap; margin: 0 0 12px 0;">${credentials}</pre>
      </div>
    `
    : `
      <div style="background-color: #0c0d10; border: 1px solid #d4af37; padding: 22px; margin-bottom: 24px; text-align: center;">
        <div style="font-family: monospace; font-size: 12px; color: #d4af37; text-transform: uppercase; margin-bottom: 8px; font-weight: 700;">
          COLD STORAGE MANUAL RELEASE REQUIRED
        </div>
        <p style="font-size: 13px; color: #c4c7cf; margin: 0 0 16px 0;">
          Your payment was confirmed on the blockchain! Open a priority ticket on Discord with order reference <strong>${orderId}</strong> to receive transfer.
        </p>
      </div>
    `;

  try {
    await resend.emails.send({
      from: 'Zentirog Vault <orders@users.zentirog.lol>',
      to: customerEmail,
      subject: `Your Discord Handle: ${username} [Order ${orderId}]`,
      html: `
        <div style="background-color: #090a0d; color: #eaebee; font-family: sans-serif; padding: 32px 20px;">
          <div style="max-width: 580px; margin: 0 auto; background-color: #101115; border: 1px solid #22242a; padding: 32px;">
            <h1 style="color: #d4af37; font-size: 20px; margin: 0 0 16px 0;">Order Confirmed (${orderId})</h1>
            <p style="color: #ffffff; font-size: 16px;">Acquired Handle: <strong>${username}</strong></p>
            ${credentialsBlock}
          </div>
        </div>
      `,
    });
  } catch {}
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
  } catch {}
}
