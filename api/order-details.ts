import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';

const CRYPTOMUS_PAYMENT_KEY = process.env.CRYPTOMUS_PAYMENT_KEY || process.env.ORDER_TOKEN_SECRET || '';
const FIREBASE_PROJECT_ID = 'zentirog-market-2026';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { order_id, handle, token } = req.query;

  if (!order_id || !handle) {
    return res.status(400).json({ error: 'Missing order_id or handle' });
  }

  // Verify HMAC signature token
  const expectedToken = crypto
    .createHmac('sha256', CRYPTOMUS_PAYMENT_KEY)
    .update(`${order_id}:${handle}`)
    .digest('hex');

  if (!token || !CRYPTOMUS_PAYMENT_KEY || token !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized or expired token.' });
  }

  try {
    const cleanHandle = String(handle).startsWith('@') ? String(handle) : `@${handle}`;

    // Read credentials from Firestore for this handle (including public == true filter and API key to satisfy security rules)
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

    if (!queryRes.ok) {
      return res.status(500).json({ error: 'Database query failed' });
    }

    const queryJson = await queryRes.json();
    const firstDoc = queryJson[0]?.document;

    if (!firstDoc) {
      return res.status(404).json({ error: 'Identifier not found' });
    }

    const credentials = firstDoc.fields?.credentials?.stringValue || '';

    return res.status(200).json({
      success: true,
      handle: cleanHandle,
      orderId: String(order_id),
      credentials,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
