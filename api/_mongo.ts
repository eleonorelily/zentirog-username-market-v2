import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb+srv://harryuchiha:l17Fgoa6Fstkga7s@cluster0.bnfc8xm.mongodb.net/zentirog?retryWrites=true&w=majority';

let client: MongoClient | null = null;

export async function getMongoDb() {
  if (!client) {
    client = new MongoClient(uri, {
      connectTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000,
    });
    await client.connect();
  }
  return client.db('zentirog');
}
