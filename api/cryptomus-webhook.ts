import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';
import { Resend } from 'resend';

const CRYPTOMUS_PAYMENT_KEY = process.env.CRYPTOMUS_PAYMENT_KEY || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
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
      // Received pending, cancel, or expire status
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

    const { usernameId, username, customerEmail } = additionalData;
    const orderId = rawBody.order_id || 'UNKNOWN';
    const amountPaid = rawBody.amount || '0.00';
    const currency = rawBody.currency || 'USD';

    // Retrieve credentials from Firestore if document exists
    let accountCredentials = 'Provided via Discord support desk.';
    if (usernameId) {
      try {
        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/usernames/${usernameId}`;
        const docRes = await fetch(firestoreUrl);
        if (docRes.ok) {
          const docData = await docRes.json();
          if (docData.fields?.credentials?.stringValue) {
            accountCredentials = docData.fields.credentials.stringValue;
          }

          // Mark username as SOLD in Firestore
          await fetch(`${firestoreUrl}?updateMask.fieldPaths=isSold&updateMask.fieldPaths=price`, {
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
      try {
        await resend.emails.send({
          from: 'Zentirog Vault <orders@users.zentirog.lol>',
          to: customerEmail,
          subject: `Your Discord Handle Account: ${username} [Order ${orderId}]`,
          html: `
            <div style="background-color: #090a0d; color: #eaebee; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 32px 20px; line-height: 1.6;">
              <div style="max-width: 560px; margin: 0 auto; background-color: #101115; border: 1px solid #22242a; padding: 32px;">
                <div style="border-bottom: 1px solid #22242a; padding-bottom: 20px; margin-bottom: 24px;">
                  <span style="font-family: monospace; font-size: 11px; letter-spacing: 2px; color: #d4af37; text-transform: uppercase;">ZENTIROG VAULT / INSTANT DISPATCH</span>
                  <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 8px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">Order Delivered</h1>
                </div>

                <p style="font-size: 14px; color: #a1a1aa; margin: 0 0 20px 0;">
                  Thank you for your acquisition. Your crypto transaction has been verified on-chain, and your Discord account credentials have been released below.
                </p>

                <div style="background-color: #0c0d10; border: 1px solid #22242a; padding: 18px; margin-bottom: 24px;">
                  <div style="font-family: monospace; font-size: 11px; color: #71717a; text-transform: uppercase; margin-bottom: 4px;">CLAIMED IDENTIFIER</div>
                  <div style="font-family: monospace; font-size: 20px; font-weight: 700; color: #ffffff;">${username}</div>
                  <div style="font-family: monospace; font-size: 12px; color: #a1a1aa; margin-top: 6px;">Order ID: ${orderId} · Amount: $${amountPaid} ${currency}</div>
                </div>

                <div style="background-color: #14161d; border: 1px solid #333745; padding: 20px; margin-bottom: 24px;">
                  <div style="font-family: monospace; font-size: 11px; color: #d4af37; font-weight: 700; text-transform: uppercase; margin-bottom: 8px;">ACCOUNT CREDENTIALS</div>
                  <pre style="background-color: #08090b; border: 1px solid #22242a; padding: 12px; color: #ffffff; font-family: monospace; font-size: 14px; margin: 0; word-break: break-all; white-space: pre-wrap;">${accountCredentials}</pre>
                </div>

                <div style="background-color: #1c150c; border: 1px solid #4a3618; padding: 16px; margin-bottom: 24px;">
                  <div style="font-family: monospace; font-size: 11px; color: #d4af37; font-weight: 700; text-transform: uppercase; margin-bottom: 6px;">MANDATORY BUYER SECURITY NOTICE</div>
                  <p style="font-size: 12px; color: #e4d7c5; margin: 0; line-height: 1.5;">
                    You must immediately log in and secure the account: (1) Update the email address, (2) Change the account password, and (3) Enable Two-Factor Authentication (2FA). As per our Terms of Transfer, once credentials are delivered, full responsibility for the account rests entirely with the buyer.
                  </p>
                </div>

                <div style="border-top: 1px solid #22242a; padding-top: 20px; text-align: center;">
                  <p style="font-size: 12px; color: #71717a; margin: 0 0 12px 0;">Need support or have questions?</p>
                  <a href="https://discord.gg/z36zMpAGPm" style="display: inline-block; background-color: #d4af37; color: #090a0d; font-family: monospace; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 10px 20px; text-decoration: none;">Join Discord Desk</a>
                </div>
              </div>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error('Failed to send Resend email:', emailErr);
      }
    }

    return res.status(200).json({ success: true, message: 'Payment processed and email dispatched.' });
  } catch (error: any) {
    console.error('Cryptomus webhook exception:', error);
    return res.status(500).json({ error: error.message || 'Webhook processing error' });
  }
}
