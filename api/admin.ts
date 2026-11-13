import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || '';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyAhd2t2lx8ooUYEdlll2V0YLSCq3QgOK2k';

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

// Verify Firebase Auth ID token so only the authenticated admin can call these APIs
async function verifyAdminAuth(req: VercelRequest): Promise<{ uid: string; email: string } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const idToken = authHeader.split('Bearer ')[1]?.trim();
  if (!idToken) return null;

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    const user = data.users?.[0];
    if (!user || !user.localId) return null;

    return {
      uid: user.localId,
      email: user.email || '',
    };
  } catch (err) {
    console.error('Token verification error:', err);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS & method preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const admin = await verifyAdminAuth(req);
  if (!admin) {
    return res.status(401).json({ error: 'Unauthorized: Valid admin authentication required.' });
  }

  const db = await getMongoDatabase();
  const colUsernames = db.collection('usernames');
  const colSettings = db.collection('settings');

  const action = req.query.action || req.body?.action;

  try {
    // 1. GET ALL USERNAMES (Including credentials for admin)
    if (req.method === 'GET' && (!action || action === 'usernames')) {
      const docs = await colUsernames.find({}).sort({ username: 1 }).toArray();
      const formatted = docs.map((doc) => ({
        id: doc._id.toString(),
        username: doc.username,
        price: doc.price || '',
        description: doc.description || '',
        category: doc.category || 'Semi usernames',
        credentials: doc.credentials || '',
        isNew: Boolean(doc.isNew),
        isHot: Boolean(doc.isHot),
        isSold: Boolean(doc.isSold || doc.price === 'SOLD'),
        isBest4: Boolean(doc.isBest4),
        priority: doc.priority || 'none',
        public: doc.public !== false,
        createdAt: doc.createdAt || 0,
        updatedAt: doc.updatedAt || 0,
      }));
      return res.status(200).json(formatted);
    }

    // 2. GET SETTINGS & DISCOUNT CODES
    if (req.method === 'GET' && action === 'settings') {
      const configDoc = await colSettings.findOne({ _id: 'config' as any });
      const discountsDoc = await colSettings.findOne({ _id: 'discounts' as any });

      return res.status(200).json({
        discordServerLink: configDoc?.discordServerLink || 'https://discord.gg/5WC6sH2rrj',
        discountCodes: discountsDoc?.codes || [],
      });
    }

    // 3. SAVE / UPDATE SINGLE USERNAME
    if (req.method === 'POST' && action === 'save_username') {
      const { username: item } = req.body;
      if (!item || !item.username) {
        return res.status(400).json({ error: 'Missing username payload.' });
      }

      const docId = item.id;
      const payload = {
        username: item.username,
        price: item.price,
        description: item.description || '',
        category: item.category || 'Semi usernames',
        credentials: item.credentials || '',
        isNew: Boolean(item.isNew),
        isHot: Boolean(item.isHot),
        isSold: Boolean(item.isSold),
        isBest4: Boolean(item.isBest4),
        priority: item.priority || 'none',
        public: item.public !== false,
        updatedAt: Date.now(),
      };

      if (docId && ObjectId.isValid(docId)) {
        await colUsernames.updateOne({ _id: new ObjectId(docId) }, { $set: payload });
      } else {
        await colUsernames.updateOne(
          { username: item.username },
          {
            $set: payload,
            $setOnInsert: { createdAt: Date.now() },
          },
          { upsert: true }
        );
      }

      return res.status(200).json({ success: true, message: `Saved ${item.username}` });
    }

    // 4. DELETE USERNAME
    if (req.method === 'POST' && action === 'delete_username') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'Missing id to delete.' });

      if (ObjectId.isValid(id)) {
        await colUsernames.deleteOne({ _id: new ObjectId(id) });
      } else {
        await colUsernames.deleteOne({ username: id });
      }
      return res.status(200).json({ success: true, message: 'Deleted successfully.' });
    }

    // 5. REPLACE ENTIRE USERNAME DATABASE (IMPORT BULK)
    if (req.method === 'POST' && action === 'replace_all') {
      const { items } = req.body;
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: 'Items must be an array.' });
      }

      // Preserve existing credentials where usernames match
      const existing = await colUsernames.find({}).toArray();
      const existingMap = new Map();
      existing.forEach((d) => existingMap.set(d.username.toLowerCase(), d));

      await colUsernames.deleteMany({});

      const ops = items.map((u: any) => {
        const old = existingMap.get(u.username.toLowerCase());
        return {
          username: u.username,
          price: u.price,
          description: u.description || '',
          category: u.category || 'Semi usernames',
          credentials: u.credentials || old?.credentials || '',
          isNew: Boolean(u.isNew),
          isHot: Boolean(u.isHot),
          isSold: Boolean(u.isSold || u.price === 'SOLD'),
          isBest4: Boolean(u.isBest4 || old?.isBest4),
          priority: u.priority || 'none',
          public: u.public !== false,
          createdAt: u.createdAt || Date.now(),
          updatedAt: Date.now(),
        };
      });

      if (ops.length > 0) {
        await colUsernames.insertMany(ops);
      }

      return res.status(200).json({ success: true, count: ops.length });
    }

    // 6. SAVE SETTINGS (DISCORD LINK)
    if (req.method === 'POST' && action === 'save_settings') {
      const { discordServerLink } = req.body;
      await colSettings.updateOne(
        { _id: 'config' as any },
        {
          $set: {
            discordServerLink: (discordServerLink || '').trim(),
            updatedAt: Date.now(),
          },
        },
        { upsert: true }
      );
      return res.status(200).json({ success: true, message: 'Settings saved in MongoDB.' });
    }

    // 7. SAVE DISCOUNT CODES
    if (req.method === 'POST' && action === 'save_discounts') {
      const { codes } = req.body;
      if (!Array.isArray(codes)) {
        return res.status(400).json({ error: 'Codes must be an array.' });
      }

      const cleanCodes = codes.map((c) => ({
        code: String(c.code).trim().toUpperCase(),
        discountPercent: Math.max(1, Math.min(100, Number(c.discountPercent) || 0)),
        maxUses: Math.max(0, Number(c.maxUses) || 0),
        usedCount: Math.max(0, Number(c.usedCount) || 0),
        active: Boolean(c.active),
        createdAt: c.createdAt || Date.now(),
      }));

      await colSettings.updateOne(
        { _id: 'discounts' as any },
        {
          $set: {
            codes: cleanCodes,
            updatedAt: Date.now(),
          },
        },
        { upsert: true }
      );

      return res.status(200).json({ success: true, codes: cleanCodes });
    }

    return res.status(400).json({ error: 'Invalid or unrecognized action.' });
  } catch (error: any) {
    console.error('Admin API error:', error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
}
