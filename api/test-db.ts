import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { MongoClient } = await import('mongodb');
    const uri = 'mongodb+srv://harryuchiha:l17Fgoa6Fstkga7s@cluster0.bnfc8xm.mongodb.net/zentirog?retryWrites=true&w=majority';
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 4000 });
    await client.connect();
    const count = await client.db('zentirog').collection('usernames').countDocuments();
    await client.close();
    return res.status(200).json({ ok: true, count });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message, stack: err.stack });
  }
}
