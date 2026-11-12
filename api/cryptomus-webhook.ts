import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';
import { Resend } from 'resend';

const CRYPTOMUS_PAYMENT_KEY = process.env.CRYPTOMUS_PAYMENT_KEY || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const DISCORD_SALES_WEBHOOK = process.env.DISCORD_SALES_WEBHOOK || '';
const resend = new Resend(RESEND_API_KEY);

const FIREBASE_PROJECT_ID = 'zentirog-market-2026';

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

    if (receivedSign && receivedSign !== expectedSign) {
      console.warn('Cryptomus signature mismatch:', { received: receivedSign, expected: expectedSign });
      return res.status(401).json({ error: 'Signature mismatch' });
    }

    // Check payment status
    const paymentStatus = rawBody.status;
    const isPaid = paymentStatus === 'paid' || paymentStatus === 'paid_over';

    if (!isPaid) {
      return res.status(200).json({ message: `Status ${paymentStatus} acknowledged.` });
    }

    // Parse order metadata
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

    // Increment discount usage in database if a code was used
    if (discountCode) {
      try {
        await incrementDiscountUsage(discountCode);
      } catch (err) {
        console.warn('Error incrementing discount count:', err);
      }
    }

    // Retrieve credentials from Firestore if document exists
    let accountCredentials = '';
    let targetDocId = usernameId;

    if (targetDocId) {
      try {
        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/usernames/${targetDocId}?key=AIzaSyAhd2t2lx8ooUYEdlll2V0YLSCq3QgOK2k`;
        const docRes = await fetch(firestoreUrl);
        if (docRes.ok) {
          const docData = await docRes.json();
          if (docData.fields?.credentials?.stringValue) {
            accountCredentials = docData.fields.credentials.stringValue;
          }

          // Mark username as SOLD in Firestore
          await fetch(`${firestoreUrl}&updateMask.fieldPaths=isSold&updateMask.fieldPaths=price`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fields: {
                isSold: { booleanValue: true },
                price: { stringValue: 'SOLD' },
              },
            }),
          });
        }
      } catch (dbErr) {
        console.error('Error fetching/updating Firestore document:', dbErr);
      }
    }

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
    console.error('Cryptomus webhook exception:', error);
    return res.status(500).json({ error: error.message || 'Webhook processing error' });
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
  const cleanCreds = (credentials || '').trim();
  const hasCreds = cleanCreds.length > 0;

  // Dynamically load active Discord link from Firestore
  let activeDiscordLink = 'https://discord.gg/5WC6sH2rrj';
  try {
    const configRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/settings/config?key=AIzaSyAhd2t2lx8ooUYEdlll2V0YLSCq3QgOK2k`
    );
    if (configRes.ok) {
      const configJson = await configRes.json();
      const link = configJson.fields?.discordServerLink?.stringValue;
      if (link) activeDiscordLink = link;
    }
  } catch (cErr) {
    console.warn('Could not fetch active discord link for email:', cErr);
  }

  const credentialsBlock = hasCreds
    ? `
      <div style="background-color: #14161d; border: 1px solid #333745; padding: 20px; margin-bottom: 24px;">
        <div style="font-family: monospace; font-size: 11px; color: #d4af37; font-weight: 700; text-transform: uppercase; margin-bottom: 8px;">ACCOUNT CREDENTIALS</div>
        <pre style="background-color: #08090b; border: 1px solid #22242a; padding: 14px; color: #ffffff; font-family: monospace; font-size: 14px; margin: 0; word-break: break-all; white-space: pre-wrap; font-weight: 600;">${cleanCreds}</pre>
      </div>
    `
    : `
      <div style="background-color: #1f1811; border: 1px solid #5a3c18; padding: 20px; margin-bottom: 24px;">
        <div style="font-family: monospace; font-size: 11px; color: #d4af37; font-weight: 700; text-transform: uppercase; margin-bottom: 8px;">MANUAL DESK FULFILLMENT REQUIRED</div>
        <p style="font-size: 13px; color: #e6dfd5; margin: 0 0 14px 0; line-height: 1.6;">
          Your on-chain payment has been verified! The credentials for <strong>${username}</strong> are held in offline cold storage.
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
    console.error('Failed to send Resend email in webhook:', err);
  }
}

async function sendDiscordSaleNotification({
  orderId,
  username,
  customerEmail,
  customerDiscord,
  amount,
  currency,
  discountCode,
  isDelivered,
  paymentMethod,
}: {
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
    console.warn('DISCORD_SALES_WEBHOOK is not configured in environment variables.');
    return;
  }

  try {
    const embed = {
      title: '⚡ NEW VAULT PURCHASE SUCCESSFUL',
      description: `Target Identifier **${username}** has been secured!`,
      color: 0xd4af37, // Luxury Gold
      fields: [
        {
          name: '🎯 Username / Identifier',
          value: `\`${username}\``,
          inline: true,
        },
        {
          name: '💰 Amount Paid',
          value: `**$${amount} ${currency}**${discountCode ? ` *(Code: \`${discountCode}\`)*` : ''}`,
          inline: true,
        },
        {
          name: '💳 Method',
          value: paymentMethod,
          inline: true,
        },
        {
          name: '📧 Customer Email',
          value: customerEmail ? `\`${customerEmail}\`` : '*Not provided*',
          inline: true,
        },
        {
          name: '💬 Customer Discord',
          value: customerDiscord ? `**${customerDiscord}**` : '*Not provided*',
          inline: true,
        },
        {
          name: '📦 Fulfillment Status',
          value: isDelivered
            ? '✅ **Delivered Instantly** (Email & Screen)'
            : '⏳ **Manual Cold Storage Ticket Required**',
          inline: true,
        },
        {
          name: '🧾 Order ID',
          value: `\`${orderId}\``,
          inline: false,
        },
      ],
      footer: {
        text: 'Zentirog Automated Sales System • users.zentirog.lol',
      },
      timestamp: new Date().toISOString(),
    };

    const webhookResponse = await fetch(DISCORD_SALES_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: '@everyone 🚨 **New Username Purchase Confirmed!**',
        embeds: [embed],
      }),
    });

    if (!webhookResponse.ok) {
      console.error('Discord webhook dispatch failed:', await webhookResponse.text());
    }
  } catch (err) {
    console.error('Error dispatching Discord webhook:', err);
  }
}
