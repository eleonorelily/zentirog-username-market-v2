import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getMongoDb } from './_mongo';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');

  try {
    const db = await getMongoDb();
    const collection = db.collection('usernames');

    if (req.method === 'GET') {
      const docs = await collection.find({ public: { $ne: false } }).toArray();

      const sanitized = docs.map((doc: any) => ({
        id: doc._id.toString(),
        username: doc.username || '',
        price: doc.price || '',
        description: doc.description || '',
        category: doc.category || 'Semi usernames',
        isNew: Boolean(doc.isNew),
        isHot: Boolean(doc.isHot),
        isSold: Boolean(doc.isSold),
        isBest4: Boolean(doc.isBest4),
        priority: doc.priority || 'none',
        public: true,
        credentials: '',
        createdAt: doc.createdAt || Date.now(),
        updatedAt: doc.updatedAt || Date.now(),
      }));

      return res.status(200).json(sanitized);
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('MongoDB usernames API error:', error);
    return res.status(500).json({ error: error.message || 'Database error' });
  }
}
