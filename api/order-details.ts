import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';
import { MongoClient } from 'mongodb';

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

const CRYPTOMUS_PAYMENT_KEY = process.env.CRYPTOMUS_PAYMENT_KEY || process.env.ORDER_TOKEN_SECRET || '';

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

    const db = await getMongoDatabase();
    const doc = await db.collection('usernames').findOne({ username: cleanHandle });

    if (!doc) {
      return res.status(404).json({ error: 'Identifier not found' });
    }

    const credentials = doc.credentials || '';

    return res.status(200).json({
      success: true,
      handle: cleanHandle,
      orderId: String(order_id),
      credentials,
    });
  } catch (err: any) {
    console.error('Order details error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
