import { MongoClient, Db } from 'mongodb';

const uri = 'mongodb+srv://harryuchiha:l17Fgoa6Fstkga7s@cluster0.bnfc8xm.mongodb.net/zentirog?retryWrites=true&w=majority';

let cachedDb: Db | null = null;
let client: MongoClient | null = null;

export async function connectToDatabase(): Promise<Db> {
  if (cachedDb) {
    return cachedDb;
  }

  client = new MongoClient(uri, {
    connectTimeoutMS: 5000,
    serverSelectionTimeoutMS: 5000,
  });

  await client.connect();
  cachedDb = client.db('zentirog');
  return cachedDb;
}
