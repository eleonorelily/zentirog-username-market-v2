import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MongoClient, ObjectId } from 'mongodb';
import crypto from 'node:crypto';

const MONGODB_URI = process.env.MONGODB_URI || '';
const ADMIN_JWT_SECRET = process.env.CRYPTOMUS_PAYMENT_KEY || process.env.ORDER_TOKEN_SECRET || 'zentirog-secret-jwt-key-2026';

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

function verifyPassword(password: string, salt: string, hash: string): boolean {
  const testHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(testHash, 'hex'), Buffer.from(hash, 'hex'));
}

function createSessionToken(email: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days session
    })
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', ADMIN_JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function verifySessionToken(token: string): { email: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;

    const expectedSignature = crypto
      .createHmac('sha256', ADMIN_JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return { email: decoded.email };
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const db = await getMongoDatabase();
  const colAdmins = db.collection('admins');
  const colUsernames = db.collection('usernames');
  const colSettings = db.collection('settings');

  const action = req.query.action || req.body?.action;

  // 1. NATIVE MONGO LOGIN ENDPOINT
  if (req.method === 'POST' && action === 'login') {
    const { email, password } = req.body;
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return res.status(400).json({ error: 'Invalid email or password format.' });
    }

    const adminUser = await colAdmins.findOne({ email: email.trim().toLowerCase() });
    if (!adminUser || !adminUser.salt || !adminUser.hash) {
      return res.status(401).json({ error: 'Invalid operator credentials.' });
    }

    const isValid = verifyPassword(password, adminUser.salt, adminUser.hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid operator credentials.' });
    }

    const token = createSessionToken(adminUser.email);
    return res.status(200).json({
      success: true,
      token,
      email: adminUser.email,
    });
  }

  // ALL OTHER ACTIONS REQUIRE NATIVE SESSION TOKEN
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing admin session token.' });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  const session = verifySessionToken(token);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired admin session.' });
  }

  try {
    // 2. GET ALL USERNAMES (Including credentials for authenticated admin)
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

    // 3. GET SETTINGS & DISCOUNT CODES
    if (req.method === 'GET' && action === 'settings') {
      const configDoc = await colSettings.findOne({ _id: 'config' as any });
      const discountsDoc = await colSettings.findOne({ _id: 'discounts' as any });

      return res.status(200).json({
        discordServerLink: configDoc?.discordServerLink || 'https://discord.gg/5WC6sH2rrj',
        discountCodes: discountsDoc?.codes || [],
      });
    }

    // 4. SAVE / UPDATE SINGLE USERNAME
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

    // 5. DELETE USERNAME
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

    // 6. REPLACE ENTIRE DATABASE (IMPORT BULK)
    if (req.method === 'POST' && action === 'replace_all') {
      const { items } = req.body;
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: 'Items must be an array.' });
      }

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

    // 7. SAVE SETTINGS (DISCORD LINK)
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

    // 8. SAVE DISCOUNT CODES
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
