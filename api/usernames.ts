import type { VercelRequest, VercelResponse } from '@vercel/node';
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Set caching headers for high speed & low load
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  try {
    const db = await getMongoDatabase();
    const docs = await db
      .collection('usernames')
      .find({ public: { $ne: false } })
      .project({ credentials: 0 }) // Strip confidential account credentials from public feed
      .toArray();

    const formatted = docs.map((doc) => ({
      id: doc._id.toString(),
      username: doc.username,
      price: doc.price || '',
      description: doc.description || '',
      category: doc.category || 'Semi usernames',
      isNew: Boolean(doc.isNew),
      isHot: Boolean(doc.isHot),
      isSold: Boolean(doc.isSold || doc.price === 'SOLD'),
      isBest4: Boolean(doc.isBest4),
      priority: doc.priority || 'none',
      public: true,
      createdAt: doc.createdAt || 0,
      updatedAt: doc.updatedAt || 0,
    }));

    return res.status(200).json(formatted);
  } catch (error: any) {
    console.error('Error fetching usernames from MongoDB:', error);
    return res.status(500).json({ error: 'Failed to fetch usernames from database.' });
  }
}
