import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const DISCORD_SALES_WEBHOOK = process.env.DISCORD_SALES_WEBHOOK || '';
const FIREBASE_PROJECT_ID = 'zentirog-market-2026';
const resend = new Resend(RESEND_API_KEY);

interface CheckResult {
  hasTx: boolean;
  confirmed: boolean;
  amountReceivedLtc: number;
  txid?: string;
}

async function checkLtcAddressBlockchain(address: string): Promise<CheckResult> {
  // Query litecoinspace.org (mempool instance for LTC)
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { orderId } = req.body;
  if (!orderId) {
    return res.status(400).json({ error: 'Missing orderId' });
  }

  try {
    // 1. Fetch order from Firestore
    const orderRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/orders/${orderId}?key=AIzaSyAhd2t2lx8ooUYEdlll2V0YLSCq3QgOK2k`
    );

    if (!orderRes.ok) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderJson = await orderRes.json();
    const fields = orderJson.fields || {};

    const status = fields.status?.stringValue || 'WAITING';
    const ltcAddress = fields.ltcAddress?.stringValue || '';
    const ltcAmountExpected = Number(fields.ltcAmount?.doubleValue || 0);
    const username = fields.username?.stringValue || '';
    const usernameId = fields.usernameId?.stringValue || '';
    const customerEmail = fields.customerEmail?.stringValue || '';
    const customerDiscord = fields.customerDiscord?.stringValue || '';
    const credentials = fields.credentials?.stringValue || '';
    const usdAmount = Number(fields.usdAmount?.doubleValue || 0);
    const discountCode = fields.discountCode?.stringValue || '';

    // If order already finalized, return credentials immediately
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

    // 2. Check blockchain for transactions on this address
    const check = await checkLtcAddressBlockchain(ltcAddress);

    // Accept if received is at least 98% of expected (in case of slight exchange dust differences)
    const threshold = ltcAmountExpected * 0.98;
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

    // 3. PAYMENT DETECTED / SUFFICIENT!
    // Update order status in Firestore to PAID
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
      } catch (err) {
        console.error('Failed to mark username as sold:', err);
      }
    }

    // Increment discount usage if applicable
    if (discountCode) {
      try {
        await incrementDiscountUsage(discountCode);
      } catch {}
    }

    // Dispatch Delivery Email to customer
    if (customerEmail) {
      await dispatchDeliveryEmail({
        customerEmail,
        username,
        orderId,
        amount: usdAmount.toFixed(2),
        currency: 'USD (LTC)',
        credentials,
      });
    }

    // Send Discord Sales Webhook
    await sendDiscordSaleNotification({
      orderId,
      username,
      customerEmail,
      customerDiscord,
      amount: `${usdAmount.toFixed(2)} (${check.amountReceivedLtc} LTC)`,
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

async function incrementDiscountUsage(codeToIncrement: string) {
  const discountsRes = await fetch(
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/settings/discounts?key=AIzaSyAhd2t2lx8ooUYEdlll2V0YLSCq3QgOK2k`
  );
  if (!discountsRes.ok) return;
  const discountsJson = await discountsRes.json();
  const codesList = discountsJson.fields?.codes?.arrayValue?.values || [];

  const updatedCodes = codesList.map((item: any) => {
    const map = item.mapValue?.fields || {};
    const codeStr = (map.code?.stringValue || '').toUpperCase();
    if (codeStr === codeToIncrement.toUpperCase()) {
      const currentCount = Number(map.usedCount?.integerValue ?? 0);
      return {
        mapValue: {
          fields: {
            ...map,
            usedCount: { integerValue: String(currentCount + 1) },
          },
        },
      };
    }
    return item;
  });

  await fetch(
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/settings/discounts?updateMask.fieldPaths=codes&key=AIzaSyAhd2t2lx8ooUYEdlll2V0YLSCq3QgOK2k`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          codes: {
            arrayValue: { values: updatedCodes },
          },
        },
      }),
    }
  );
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
    const configRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/settings/config?key=AIzaSyAhd2t2lx8ooUYEdlll2V0YLSCq3QgOK2k`
    );
    if (configRes.ok) {
      const configJson = await configRes.json();
      activeDiscordLink = configJson.fields?.discordServerLink?.stringValue || activeDiscordLink;
    }
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
      <div style="background-color: #0c0d10; border: 1px solid #d4af37; padding: 22px; margin-bottom: 24px; text-align: center;">
        <div style="font-family: monospace; font-size: 12px; color: #d4af37; text-transform: uppercase; margin-bottom: 8px; font-weight: 700; letter-spacing: 1px;">
          COLD STORAGE FULFILLMENT REQUIRED
        </div>
        <p style="font-size: 13px; color: #c4c7cf; margin: 0 0 16px 0; line-height: 1.6;">
          Your payment has been verified on the Litecoin blockchain. This identifier is secured in cold storage. Open a priority ticket or direct message @nonconfident on Discord with your Order ID to receive immediate account transfer.
        </p>
        <div style="font-family: monospace; font-size: 12px; color: #ffffff; background: #16181f; padding: 10px; border: 1px solid #2e323e; display: inline-block; margin-bottom: 16px;">
          Order Reference: <strong style="color: #d4af37;">${orderId}</strong>
        </div>
        <br />
        <a href="${activeDiscordLink}" style="display: inline-block; background-color: #d4af37; color: #090a0d; font-family: monospace; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; padding: 12px 24px; text-decoration: none;">Open Priority Ticket</a>
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
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 8px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">Order Confirmed</h1>
            </div>

            <div style="background-color: #0c0d10; border: 1px solid #22242a; padding: 18px; margin-bottom: 24px;">
              <div style="font-family: monospace; font-size: 11px; color: #71717a; text-transform: uppercase; margin-bottom: 4px;">ACQUIRED IDENTIFIER</div>
              <div style="font-family: monospace; font-size: 22px; font-weight: 700; color: #ffffff;">${username}</div>
              <div style="font-family: monospace; font-size: 12px; color: #a1a1aa; margin-top: 6px;">Order ID: ${orderId} · Total: $${amount} ${currency}</div>
            </div>

            ${credentialsBlock}

            <div style="border-top: 1px solid #22242a; padding-top: 20px; text-align: center;">
              <p style="font-size: 12px; color: #71717a; margin: 0 0 12px 0;">Need assistance? Contact @nonconfident directly:</p>
              <a href="${activeDiscordLink}" style="display: inline-block; background-color: #1c1e24; color: #ffffff; border: 1px solid #333742; font-family: monospace; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 10px 20px; text-decoration: none;">Join Discord Community</a>
            </div>
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error('Failed to send Resend email:', err);
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
