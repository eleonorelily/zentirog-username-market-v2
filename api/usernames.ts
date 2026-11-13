import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { MongoClient } = await import('mongodb');
    const uri = process.env.MONGODB_URI || 'mongodb+srv://harryuchiha:l17Fgoa6Fstkga7s@cluster0.bnfc8xm.mongodb.net/zentirog?retryWrites=true&w=majority';
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('zentirog');
    const docs = await db.collection('usernames').find({ public: { $ne: false } }).toArray();
    await client.close();

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
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error connecting to database', stack: error.stack });
  }
}
