import type { VercelRequest, VercelResponse } from '@vercel/node';
import { HDKey } from '@scure/bip32';
import crypto from 'node:crypto';
import { MongoClient, ObjectId } from 'mongodb';

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

const LTC_XPUB = process.env.LTC_XPUB || 'xpub6CeTYSUZLABp3meXfXXoTKBfFkkYWNWa9nzZQnUE7esdkVKKWugX847tCu41Yt3dfpqV5tFRcBEqqjtDsBysxoZQKj8XRSZaojcQcEokM19';
const ORDER_SECRET = process.env.ORDER_TOKEN_SECRET || process.env.CRYPTOMUS_PAYMENT_KEY || 'order_salt_secret_zentirog_2026';

const B58_DIGITS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function b58EncodeCheck(payload: Buffer): string {
  const hash = crypto.createHash('sha256').update(crypto.createHash('sha256').update(payload).digest()).digest();
  const full = Buffer.concat([payload, hash.slice(0, 4)]);
  let num = BigInt('0x' + full.toString('hex'));
  let res = '';
  while (num > 0n) {
    const rem = Number(num % 58n);
    num = num / 58n;
    res = B58_DIGITS[rem] + res;
  }
  for (const b of full) {
    if (b === 0) res = '1' + res;
    else break;
  }
  return res;
}

function deriveLtcAddress(index: number): string {
  const hdkey = HDKey.fromExtendedKey(LTC_XPUB);
  const child = hdkey.derive(`m/0/${index}`);
  const sha = crypto.createHash('sha256').update(child.publicKey).digest();
  const rip = crypto.createHash('ripemd160').update(sha).digest();
  const payload = Buffer.concat([Buffer.from([0x30]), rip]);
  return b58EncodeCheck(payload);
}

async function getLiveLtcPriceInUsd(): Promise<number> {
  try {
    const bRes = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=LTCUSDT', { signal: AbortSignal.timeout(3000) });
    if (bRes.ok) {
      const data = await bRes.json();
      const p = parseFloat(data.price);
      if (p > 0) return p;
    }
  } catch {}

  try {
    const cgRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=litecoin&vs_currencies=usd', { signal: AbortSignal.timeout(3000) });
    if (cgRes.ok) {
      const data = await cgRes.json();
      const p = parseFloat(data.litecoin?.usd);
      if (p > 0) return p;
    }
  } catch {}

  return 48.0;
}

function parsePriceToNumber(rawPrice: string): number {
  if (!rawPrice || rawPrice === 'SOLD') return 0;
  const discountMatch = rawPrice.match(/\$(\d+(?:\.\d+)?)\s*\((\d+)%\s*off\s*\$(\d+(?:\.\d+)?)\)/);
  if (discountMatch) {
    return parseFloat(discountMatch[1]) || 0;
  }
  const clean = parseFloat(rawPrice.replace(/[^0-9.]/g, ''));
  return clean || 0;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { usernameId, username, clientPrice, customerEmail, customerDiscord, discountCode } = req.body;

    if (!username || !customerEmail) {
      return res.status(400).json({ error: 'Missing required checkout parameters.' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return res.status(400).json({ error: 'Invalid delivery email address provided.' });
    }

    // 1. Fetch official handle price and details from MongoDB
    let realPrice = 0;
    let actualUsername = username;
    let credentials = '';
    let isSold = false;

    const db = await getMongoDatabase();
    const cleanHandle = username.startsWith('@') ? username : `@${username}`;

    let doc: any = null;
    if (usernameId && ObjectId.isValid(usernameId)) {
      doc = await db.collection('usernames').findOne({ _id: new ObjectId(usernameId) });
    }
    if (!doc) {
      doc = await db.collection('usernames').findOne({ username: cleanHandle });
    }

    if (doc) {
      isSold = Boolean(doc.isSold || doc.price === 'SOLD');
      realPrice = parsePriceToNumber(doc.price || '');
      actualUsername = doc.username || username;
      credentials = doc.credentials || '';
    }

    if (isSold) {
      return res.status(400).json({ error: 'This identifier has already been claimed or sold.' });
    }

    if (realPrice <= 0 && typeof clientPrice === 'number' && clientPrice > 0) {
      realPrice = clientPrice;
    }

    if (realPrice <= 0) {
      return res.status(400).json({ error: 'Could not verify identifier price.' });
    }

    let appliedDiscountPercent = 0;
    let appliedCode = '';

    if (discountCode && typeof discountCode === 'string' && discountCode.trim()) {
      const codeToTest = discountCode.trim().toUpperCase();
      try {
        const discountDoc = await db.collection('settings').findOne({ _id: 'discounts' as any });
        const codesList = Array.isArray(discountDoc?.codes) ? discountDoc.codes : [];
        for (const item of codesList) {
          const codeStr = (item.code || '').toUpperCase();
          const active = item.active ?? true;
          const maxUses = Number(item.maxUses || 0);
          const usedCount = Number(item.usedCount || 0);
          const percent = Number(item.discountPercent || 0);

          if (codeStr === codeToTest && active) {
            if (maxUses > 0 && usedCount >= maxUses) {
              return res.status(400).json({ error: `Discount code ${codeToTest} has reached its maximum usage limit.` });
            }
            appliedDiscountPercent = Math.min(100, Math.max(1, percent));
            appliedCode = codeToTest;
            break;
          }
        }
      } catch {}
    }

    let finalAmount = realPrice;
    if (appliedDiscountPercent > 0) {
      finalAmount = realPrice * (1 - appliedDiscountPercent / 100);
      finalAmount = Math.max(0, parseFloat(finalAmount.toFixed(2)));
    }

    // BIP-44 address index derivation:
    // Generate a secure progressive integer index based on seconds since epoch
    // Offset by an epoch baseline so indices are compact and strictly monotonic
    const epochBase = 1794548400; // current timestamp anchor
    const derivationIndex = Math.max(1, Math.floor(Date.now() / 1000) - epochBase);

    const ltcDepositAddress = deriveLtcAddress(derivationIndex);
    const ltcPriceUsd = await getLiveLtcPriceInUsd();
    const rawLtc = finalAmount / ltcPriceUsd;
    const ltcAmount = parseFloat(rawLtc.toFixed(5));
    const orderId = `LTC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const mongoDocId = doc ? doc._id.toString() : (usernameId || '');

    // Create tamper-proof cryptographically signed order token
    const orderPayload = {
      orderId,
      usernameId: mongoDocId,
      username: actualUsername,
      customerEmail: customerEmail.trim().toLowerCase(),
      customerDiscord: (customerDiscord || '').trim(),
      discountCode: appliedCode || '',
      usdAmount: finalAmount,
      ltcAmount,
      ltcAddress: ltcDepositAddress,
      credentials,
      createdAt: Date.now(),
    };

    const serialized = JSON.stringify(orderPayload);
    const signature = crypto.createHmac('sha256', ORDER_SECRET).update(serialized).digest('hex');
    const orderToken = `${Buffer.from(serialized).toString('base64url')}.${signature}`;

    // Store order in MongoDB
    try {
      await db.collection('ltc_orders').insertOne({
        orderId,
        usernameId: mongoDocId,
        username: actualUsername,
        customerEmail: customerEmail.trim().toLowerCase(),
        customerDiscord: (customerDiscord || '').trim(),
        discountCode: appliedCode || '',
        usdAmount: finalAmount,
        ltcAmount,
        ltcAddress: ltcDepositAddress,
        status: 'WAITING',
        createdAt: Date.now(),
      });
    } catch (err) {
      console.warn('Could not store LTC order in MongoDB:', err);
    }

    return res.status(200).json({
      success: true,
      orderId,
      orderToken,
      username: actualUsername,
      usdAmount: finalAmount,
      ltcAmount,
      ltcAddress: ltcDepositAddress,
      qrValue: ltcDepositAddress,
      expiresInMinutes: 45,
    });
  } catch (error: any) {
    console.error('Error creating LTC order:', error);
    return res.status(500).json({ error: error.message || 'Failed to initialize LTC order.' });
  }
}
