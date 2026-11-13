import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';
import { Resend } from 'resend';
import { getMongoDb } from './_mongo';
import { ObjectId } from 'mongodb';

const CRYPTOMUS_MERCHANT_ID = process.env.CRYPTOMUS_MERCHANT_ID || '';
const CRYPTOMUS_PAYMENT_KEY = process.env.CRYPTOMUS_PAYMENT_KEY || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const DISCORD_SALES_WEBHOOK = process.env.DISCORD_SALES_WEBHOOK || '';
const resend = new Resend(RESEND_API_KEY);

const FIREBASE_PROJECT_ID = 'zentirog-market-2026';

// Helper to extract clean USD price from handle price string
function parsePriceToNumber(rawPrice: string): number {
  if (!rawPrice || rawPrice === 'SOLD') return 0;
  const discountMatch = rawPrice.match(/\$(\d+(?:\.\d+)?)\s*\((\d+)%\s*off\s*\$(\d+(?:\.\d+)?)\)/);
  if (discountMatch) {
    return parseFloat(discountMatch[1]) || 0;
  }
  const clean = parseFloat(rawPrice.replace(/[^0-9.]/g, ''));
  return clean || 0;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { usernameId, username, customerEmail, customerDiscord, discountCode } = req.body;

    if (!username || !customerEmail) {
      return res.status(400).json({ error: 'Missing required checkout parameters.' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return res.status(400).json({ error: 'Invalid email address provided.' });
    }

    // 1. Fetch source of truth directly from MongoDB (and fallback to Firestore if needed)
    let realPrice = 0;
    let actualUsername = username;
    let credentials = '';
    let isSold = false;
    let firestoreDocId = usernameId;

    try {
      const db = await getMongoDb();
      const cleanHandle = username.startsWith('@') ? username : `@${username}`;

      let doc = null;
      if (usernameId && ObjectId.isValid(usernameId)) {
        doc = await db.collection('usernames').findOne({ _id: new ObjectId(usernameId) });
      }
      if (!doc) {
        doc = await db.collection('usernames').findOne({ username: cleanHandle });
      }

      if (doc) {
        isSold = Boolean(doc.isSold || doc.price === 'SOLD');
        realPrice = parsePriceToNumber(doc.price || '');
        actualUsername = doc.username || username;
        credentials = doc.credentials || '';
        firestoreDocId = doc._id.toString();
      }
    } catch (mongoErr) {
      console.warn('MongoDB lookup error in create-payment:', mongoErr);
    }

    // Secondary fallback to Firestore if not found in MongoDB
    if (!realPrice) {
      if (usernameId) {
        try {
          const docRes = await fetch(
            `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/usernames/${usernameId}?key=AIzaSyAhd2t2lx8ooUYEdlll2V0YLSCq3QgOK2k`
          );
          if (docRes.ok) {
            const docJson = await docRes.json();
            const fields = docJson.fields || {};
            isSold = fields.isSold?.booleanValue || fields.price?.stringValue === 'SOLD';
            realPrice = parsePriceToNumber(fields.price?.stringValue || '');
            actualUsername = fields.username?.stringValue || username;
            credentials = fields.credentials?.stringValue || '';
          }
        } catch {}
      }

      if (!realPrice) {
        const cleanHandle = username.startsWith('@') ? username : `@${username}`;
        try {
          const queryRes = await fetch(
            `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery?key=AIzaSyAhd2t2lx8ooUYEdlll2V0YLSCq3QgOK2k`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                structuredQuery: {
                  from: [{ collectionId: 'usernames' }],
                  where: {
                    compositeFilter: {
                      op: 'AND',
                      filters: [
                        {
                          fieldFilter: {
                            field: { fieldPath: 'username' },
                            op: 'EQUAL',
                            value: { stringValue: cleanHandle },
                          },
                        },
                        {
                          fieldFilter: {
                            field: { fieldPath: 'public' },
                            op: 'EQUAL',
                            value: { booleanValue: true },
                          },
                        },
                      ],
                    },
                  },
                  limit: 1,
                },
              }),
            }
          );
          if (queryRes.ok) {
            const queryJson = await queryRes.json();
            const firstDoc = queryJson[0]?.document;
            if (firstDoc) {
              const fields = firstDoc.fields || {};
              const pathParts = firstDoc.name.split('/');
              firestoreDocId = pathParts[pathParts.length - 1];
              isSold = fields.isSold?.booleanValue || fields.price?.stringValue === 'SOLD';
              realPrice = parsePriceToNumber(fields.price?.stringValue || '');
              actualUsername = fields.username?.stringValue || username;
              credentials = fields.credentials?.stringValue || '';
            }
          }
        } catch {}
      }
    }

    // NEVER trust amount from client request body. Only accept server-verified database price.
    if (isSold) {
      return res.status(400).json({ error: 'This identifier has already been claimed/sold.' });
    }

    if (realPrice <= 0) {
      return res.status(400).json({ error: 'Could not verify identifier price in official database.' });
    }

    // 2. Validate discount code against Firestore (settings/discounts)
    let appliedDiscountPercent = 0;
    let appliedCode = '';

    if (discountCode && typeof discountCode === 'string' && discountCode.trim()) {
      const codeToTest = discountCode.trim().toUpperCase();
      try {
        const discountsRes = await fetch(
          `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/settings/discounts`
        );
        if (discountsRes.ok) {
          const discountsJson = await discountsRes.json();
          const codesList = discountsJson.fields?.codes?.arrayValue?.values || [];
          
          for (const item of codesList) {
            const map = item.mapValue?.fields || {};
            const codeStr = (map.code?.stringValue || '').toUpperCase();
            const active = map.active?.booleanValue ?? true;
            const maxUses = Number(map.maxUses?.integerValue ?? 0);
            const usedCount = Number(map.usedCount?.integerValue ?? 0);
            const percent = Number(map.discountPercent?.integerValue ?? 0);

            if (codeStr === codeToTest && active) {
              if (maxUses > 0 && usedCount >= maxUses) {
                return res.status(400).json({ error: `Discount code ${codeToTest} has reached its maximum usage limit.` });
              }
              appliedDiscountPercent = Math.min(100, Math.max(1, percent));
              appliedCode = codeToTest;
              break;
            }
          }

          if (discountCode && !appliedCode) {
            return res.status(400).json({ error: `Invalid or expired discount code "${discountCode}".` });
          }
        }
      } catch (err) {
        console.warn('Error reading discounts:', err);
      }
    }

    // Calculate final price with discount
    let finalAmount = realPrice;
    if (appliedDiscountPercent > 0) {
      finalAmount = realPrice * (1 - appliedDiscountPercent / 100);
      finalAmount = Math.max(0, parseFloat(finalAmount.toFixed(2)));
    }

    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'users.zentirog.lol';
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const baseUrl = `${protocol}://${host}`;

    // Generate secure HMAC token for viewing order details
    const orderToken = crypto
      .createHmac('sha256', CRYPTOMUS_PAYMENT_KEY || process.env.ORDER_TOKEN_SECRET || '')
      .update(`${orderId}:${actualUsername}`)
      .digest('hex');

    // 3. CASE: 100% DISCOUNT (FREE) -> Instant fulfillment without payment gateway
    if (finalAmount <= 0) {
      // Mark as sold in Firestore
      if (firestoreDocId) {
        try {
          const resPatch = await fetch(
            `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/usernames/${firestoreDocId}?updateMask.fieldPaths=isSold&updateMask.fieldPaths=price&key=AIzaSyAhd2t2lx8ooUYEdlll2V0YLSCq3QgOK2k`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fields: {
                  isSold: { booleanValue: true },
                  price: { stringValue: 'CLAIMED' },
                },
              }),
            }
          );
          if (!resPatch.ok) {
            console.error('Failed to patch username as sold:', await resPatch.text());
          }
        } catch (dbErr) {
          console.error('Failed to update Firestore on 100% discount:', dbErr);
        }
      }

      // Increment discount usage
      if (appliedCode) {
        try {
          await incrementDiscountUsage(appliedCode);
        } catch (uErr) {
          console.warn('Could not increment discount usage:', uErr);
        }
      }

      // Dispatch Email
      await dispatchDeliveryEmail({
        customerEmail,
        username: actualUsername,
        orderId,
        amount: '0.00',
        currency: 'USD',
        credentials,
      });

      // Dispatch Discord Webhook Notification
      await sendDiscordSaleNotification({
        orderId,
        username: actualUsername,
        customerEmail,
        customerDiscord: customerDiscord?.trim() || '',
        amount: '0.00',
        currency: 'USD',
        discountCode: appliedCode || '100% Promo',
        isDelivered: Boolean(credentials && credentials.trim()),
        paymentMethod: 'PROMO / FREE CLAIM',
      });

      return res.status(200).json({
        success: true,
        orderId,
        isFreeOrder: true,
        redirectUrl: `${baseUrl}/order-success?order_id=${orderId}&handle=${encodeURIComponent(actualUsername)}&token=${orderToken}`,
      });
    }

    // 4. Paid invoice via Cryptomus
    const payload = {
      amount: finalAmount.toFixed(2),
      currency: 'USD',
      order_id: orderId,
      url_return: `${baseUrl}/order-success?order_id=${orderId}&handle=${encodeURIComponent(actualUsername)}&token=${orderToken}`,
      url_callback: `${baseUrl}/api/cryptomus-webhook`,
      is_payment_multiple: false,
      lifetime: 3600,
      additional_data: JSON.stringify({
        usernameId: firestoreDocId || usernameId || '',
        username: actualUsername,
        customerEmail: customerEmail.trim().toLowerCase(),
        customerDiscord: customerDiscord ? customerDiscord.trim() : '',
        discountCode: appliedCode || '',
        originalPrice: realPrice.toFixed(2),
        discountPercent: appliedDiscountPercent,
      }),
    };

    const jsonPayload = JSON.stringify(payload);
    const sign = crypto
      .createHash('md5')
      .update(Buffer.from(jsonPayload).toString('base64') + CRYPTOMUS_PAYMENT_KEY)
      .digest('hex');

    const cryptomusResponse = await fetch('https://api.cryptomus.com/v1/payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        merchant: CRYPTOMUS_MERCHANT_ID,
        sign,
      },
      body: jsonPayload,
    });

    const data = await cryptomusResponse.json();

    if (!cryptomusResponse.ok || data.state !== 0 || !data.result?.url) {
      console.error('Cryptomus API invoice error:', data);
      return res.status(502).json({
        error: data.message || 'Failed to initiate Cryptomus invoice.',
        details: data,
      });
    }

    return res.status(200).json({
      success: true,
      orderId,
      finalAmount: finalAmount.toFixed(2),
      originalPrice: realPrice.toFixed(2),
      discountApplied: appliedDiscountPercent,
      paymentUrl: data.result.url,
    });
  } catch (error: any) {
    console.error('Create payment handler error:', error);
    return res.status(500).json({ error: error.message || 'Internal payment error.' });
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
    if (codeStr === codeToIncrement) {
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
    console.error('Failed to send Resend email in create-payment:', err);
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
