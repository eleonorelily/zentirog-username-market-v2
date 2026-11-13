import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';
import { Resend } from 'resend';
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

const CRYPTOMUS_PAYMENT_KEY = process.env.CRYPTOMUS_PAYMENT_KEY || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const DISCORD_SALES_WEBHOOK = process.env.DISCORD_SALES_WEBHOOK || '';
const resend = new Resend(RESEND_API_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const rawBody = req.body;
    const receivedSign = req.headers['sign'] || rawBody?.sign;

    if (!rawBody) {
      return res.status(400).json({ error: 'Empty payload' });
    }

    // Verify cryptographic signature from Cryptomus
    const { sign: _, ...dataWithoutSign } = rawBody;
    const jsonString = JSON.stringify(dataWithoutSign);
    const expectedSign = crypto
      .createHash('md5')
      .update(Buffer.from(jsonString).toString('base64') + CRYPTOMUS_PAYMENT_KEY)
      .digest('hex');

    if (!receivedSign) {
      console.warn('Cryptomus webhook missing signature header');
      return res.status(401).json({ error: 'Missing signature' });
    }

    if (!CRYPTOMUS_PAYMENT_KEY) {
      console.error('CRYPTOMUS_PAYMENT_KEY is not configured on server');
      return res.status(500).json({ error: 'Gateway configuration error' });
    }

    if (receivedSign !== expectedSign) {
      console.warn('Cryptomus signature mismatch:', { received: receivedSign, expected: expectedSign });
      return res.status(401).json({ error: 'Signature mismatch' });
    }

    // Check payment status
    const paymentStatus = rawBody.status;
    const isPaid = paymentStatus === 'paid' || paymentStatus === 'paid_over';

    if (!isPaid) {
      console.log(`Cryptomus status update: ${rawBody.order_id} status is ${paymentStatus}. No delivery needed.`);
      return res.status(200).json({ success: true, message: `Status noted: ${paymentStatus}` });
    }

    // Parse custom metadata attached during order initiation
    let additionalData: any = {};
    try {
      if (typeof rawBody.additional_data === 'string') {
        additionalData = JSON.parse(rawBody.additional_data);
      } else if (rawBody.additional_data) {
        additionalData = rawBody.additional_data;
      }
    } catch (e) {
      console.error('Failed to parse additional_data:', e);
    }

    const { usernameId, username, customerEmail, customerDiscord, discountCode } = additionalData;
    const orderId = rawBody.order_id || 'UNKNOWN';
    const amountPaid = rawBody.amount || '0.00';
    const currency = rawBody.currency || 'USD';

    // Increment discount usage in MongoDB if a code was used
    if (discountCode) {
      try {
        const dbForDiscount = await getMongoDatabase();
        await dbForDiscount.collection('settings').updateOne(
          { _id: 'discounts' as any, 'codes.code': discountCode.toUpperCase() },
          { $inc: { 'codes.$.usedCount': 1 } }
        );
      } catch (err) {
        console.warn('Error incrementing discount count:', err);
      }
    }

    let accountCredentials = '';
    const cleanHandle = username?.startsWith('@') ? username : `@${username}`;

    // 1. Update status to SOLD and fetch credentials directly in MongoDB
    try {
      const db = await getMongoDatabase();
      let query: any = {};
      if (usernameId && ObjectId.isValid(usernameId)) {
        query = { _id: new ObjectId(usernameId) };
      } else if (username) {
        query = { username: cleanHandle };
      }

      const mongoDoc = await db.collection('usernames').findOneAndUpdate(
        query,
        {
          $set: {
            isSold: true,
            price: 'SOLD',
            soldAt: Date.now(),
          },
        },
        { returnDocument: 'after' }
      );

      if (mongoDoc && mongoDoc.credentials) {
        accountCredentials = mongoDoc.credentials;
      }
    } catch (mongoErr) {
      console.error('MongoDB update error in cryptomus webhook:', mongoErr);
    }

    // MongoDB status and credentials updated above.

    // Dispatch automated delivery email to customer
    if (customerEmail) {
      await dispatchDeliveryEmail({
        customerEmail,
        username,
        orderId,
        amount: amountPaid,
        currency,
        credentials: accountCredentials,
      });
    }

    // Dispatch Discord Webhook Notification
    await sendDiscordSaleNotification({
      orderId,
      username: username || 'Unknown Identifier',
      customerEmail: customerEmail || '',
      customerDiscord: customerDiscord ? String(customerDiscord).trim() : '',
      amount: amountPaid,
      currency,
      discountCode: discountCode || '',
      isDelivered: Boolean(accountCredentials && accountCredentials.trim()),
      paymentMethod: 'CRYPTOMUS GATEWAY',
    });

    return res.status(200).json({ success: true, message: 'Payment processed and email dispatched.' });
  } catch (error: any) {
    console.error('Cryptomus webhook error:', error);
    return res.status(500).json({ error: error.message || 'Webhook processing failed.' });
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
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set. Skipping email dispatch.');
    return;
  }

  const { customerEmail, username, orderId, amount, currency, credentials } = params;
  const isAutoDelivered = Boolean(credentials && credentials.trim());

  const credentialsHtml = isAutoDelivered
    ? `
      <div style="background-color: #12141a; border: 1px solid #d4af37; padding: 18px; margin: 20px 0; font-family: monospace; font-size: 14px; color: #f5f5f5;">
        <p style="margin: 0 0 10px 0; color: #d4af37; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">Access Credentials (mail:pass:token)</p>
        <div style="word-break: break-all; background-color: #090a0d; padding: 12px; border: 1px solid #232630; color: #ffffff;">${escapeHtml(
          credentials!
        )}</div>
      </div>
    `
    : `
      <div style="background-color: #1a150e; border: 1px solid #7c5e20; padding: 18px; margin: 20px 0; font-size: 13px; color: #e2bd45;">
        <p style="margin: 0 0 8px 0; font-weight: bold; text-transform: uppercase;">Identifier Stored In Cold Storage Vault</p>
        <p style="margin: 0;">This handle is held securely offline. Open a priority claim ticket in our Discord (<a href="https://discord.gg/5WC6sH2rrj" style="color: #ffffff; text-decoration: underline;">discord.gg/5WC6sH2rrj</a>) with Order ID <strong>${orderId}</strong> for manual transfer.</p>
      </div>
    `;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Zentirog Vault Acquisition Confirmation</title>
      </head>
      <body style="background-color: #090a0d; color: #e5e5e5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 30px; margin: 0;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #0f1015; border: 1px solid #1f2127; padding: 32px;">
          <div style="border-bottom: 1px solid #1f2127; padding-bottom: 20px; margin-bottom: 24px;">
            <h1 style="color: #ffffff; margin: 0; font-size: 20px; letter-spacing: 3px; text-transform: uppercase; font-weight: 800;">
              ZENTIROG <span style="color: #d4af37;">VAULT</span>
            </h1>
            <p style="color: #888888; margin: 6px 0 0 0; font-size: 12px; font-family: monospace;">ACQUISITION RECEIPT & DELIVERY</p>
          </div>

          <p style="font-size: 15px; color: #cccccc; margin: 0 0 16px 0;">
            Thank you for your acquisition. Your order has been confirmed on the blockchain and verified by the Zentirog Vault.
          </p>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-family: monospace; font-size: 13px;">
            <tr style="border-bottom: 1px solid #1f2127;">
              <td style="padding: 8px 0; color: #888888;">ORDER ID</td>
              <td style="padding: 8px 0; color: #ffffff; text-align: right; font-weight: bold;">${orderId}</td>
            </tr>
            <tr style="border-bottom: 1px solid #1f2127;">
              <td style="padding: 8px 0; color: #888888;">ACQUIRED IDENTIFIER</td>
              <td style="padding: 8px 0; color: #d4af37; text-align: right; font-weight: bold;">${username}</td>
            </tr>
            <tr style="border-bottom: 1px solid #1f2127;">
              <td style="padding: 8px 0; color: #888888;">TOTAL PAID</td>
              <td style="padding: 8px 0; color: #ffffff; text-align: right;">${amount} ${currency}</td>
            </tr>
            <tr style="border-bottom: 1px solid #1f2127;">
              <td style="padding: 8px 0; color: #888888;">STATUS</td>
              <td style="padding: 8px 0; color: #10b981; text-align: right; font-weight: bold;">COMPLETED / FULFILLED</td>
            </tr>
          </table>

          ${credentialsHtml}

          <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #1f2127; font-size: 12px; color: #666666; font-family: monospace;">
            <p style="margin: 0 0 6px 0;">Need support or verification assistance?</p>
            <p style="margin: 0;">Join the official Discord: <a href="https://discord.gg/5WC6sH2rrj" style="color: #d4af37; text-decoration: none;">discord.gg/5WC6sH2rrj</a></p>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    await resend.emails.send({
      from: 'Zentirog Vault <orders@users.zentirog.lol>',
      to: customerEmail,
      subject: `Acquisition Confirmed: ${username} [${orderId}]`,
      html,
    });
    console.log(`Confirmation email sent successfully to ${customerEmail}`);
  } catch (emailErr) {
    console.error('Error sending confirmation email via Resend:', emailErr);
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
  if (!DISCORD_SALES_WEBHOOK) {
    console.warn('DISCORD_SALES_WEBHOOK is not set. Skipping webhook dispatch.');
    return;
  }

  const {
    orderId,
    username,
    customerEmail,
    customerDiscord,
    amount,
    currency,
    discountCode,
    isDelivered,
    paymentMethod,
  } = params;

  const discordPayload = {
    embeds: [
      {
        title: '💎 NEW VAULT ACQUISITION COMPLETED',
        color: 0xd4af37, // Gold accent
        fields: [
          { name: 'Target Identifier', value: `\`${username}\``, inline: true },
          { name: 'Amount Paid', value: `**$${amount} ${currency}**`, inline: true },
          { name: 'Order ID', value: `\`${orderId}\``, inline: false },
          { name: 'Customer Email', value: `\`${customerEmail}\``, inline: true },
          { name: 'Customer Discord', value: customerDiscord ? `\`${customerDiscord}\`` : '_Not provided_', inline: true },
          { name: 'Payment Gateway', value: paymentMethod, inline: true },
          { name: 'Promo / Code Used', value: discountCode ? `\`${discountCode}\`` : 'None', inline: true },
          {
            name: 'Auto-Delivery Status',
            value: isDelivered ? '✅ Credentials Dispatched via Email' : '⏳ Cold Storage (Manual Dispatch Required)',
            inline: false,
          },
        ],
        footer: { text: 'Zentirog Market • Automated Settlement Ledger' },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    await fetch(DISCORD_SALES_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(discordPayload),
    });
  } catch (hookErr) {
    console.error('Error dispatching Discord sale notification:', hookErr);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
