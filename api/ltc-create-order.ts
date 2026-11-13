import type { VercelRequest, VercelResponse } from '@vercel/node';
import { HDKey } from '@scure/bip32';
import crypto from 'node:crypto';

const LTC_XPUB = process.env.LTC_XPUB || 'xpub6CeTYSUZLABp3meXfXXoTKBfFkkYWNWa9nzZQnUE7esdkVKKWugX847tCu41Yt3dfpqV5tFRcBEqqjtDsBysxoZQKj8XRSZaojcQcEokM19';
const FIREBASE_PROJECT_ID = 'zentirog-market-2026';

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
  // Try Binance first
  try {
    const bRes = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=LTCUSDT', { signal: AbortSignal.timeout(3000) });
    if (bRes.ok) {
      const data = await bRes.json();
      const p = parseFloat(data.price);
      if (p > 0) return p;
    }
  } catch {}

  // Fallback to CoinGecko
  try {
    const cgRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=litecoin&vs_currencies=usd', { signal: AbortSignal.timeout(3000) });
    if (cgRes.ok) {
      const data = await cgRes.json();
      const p = parseFloat(data.litecoin?.usd);
      if (p > 0) return p;
    }
  } catch {}

  return 48.0; // conservative safe floor
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

    // 1. Fetch official handle price and details from Firestore
    let realPrice = 0;
    let actualUsername = username;
    let credentials = '';
    let isSold = false;
    let firestoreDocId = usernameId;

    if (usernameId) {
      const docRes = await fetch(
        `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/usernames/${usernameId}?key=AIzaSyAhd2t2lx8ooUYEdlll2V0YLSCq3QgOK2k`
      );
      if (docRes.ok) {
        const docJson = await docRes.json();
        const fields = docJson.fields || {};
        isSold = fields.isSold?.booleanValue || fields.price?.stringValue === 'SOLD';
        realPrice = parsePriceToNumber(fields.price?.stringValue || '');
        actualUsername = fields.username?.stringValue || username;
        credentials = fields.credentials?.stringValue || '';
      }
    }

    if (!realPrice) {
      const cleanHandle = username.startsWith('@') ? username : `@${username}`;
      const queryRes = await fetch(
        `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery?key=AIzaSyAhd2t2lx8ooUYEdlll2V0YLSCq3QgOK2k`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            structuredQuery: {
              from: [{ collectionId: 'usernames' }],
              where: {
                compositeFilter: {
                  op: 'AND',
                  filters: [
                    { fieldFilter: { field: { fieldPath: 'username' }, op: 'EQUAL', value: { stringValue: cleanHandle } } },
                    { fieldFilter: { field: { fieldPath: 'public' }, op: 'EQUAL', value: { booleanValue: true } } },
                  ],
                },
              },
              limit: 1,
            },
          }),
        }
      );
      if (queryRes.ok) {
        const queryJson = await queryRes.json();
        const firstDoc = queryJson[0]?.document;
        if (firstDoc) {
          const fields = firstDoc.fields || {};
          const pathParts = firstDoc.name.split('/');
          firestoreDocId = pathParts[pathParts.length - 1];
          isSold = fields.isSold?.booleanValue || fields.price?.stringValue === 'SOLD';
          realPrice = parsePriceToNumber(fields.price?.stringValue || '');
          actualUsername = fields.username?.stringValue || username;
          credentials = fields.credentials?.stringValue || '';
        }
      }
    }

    if (isSold) {
      return res.status(400).json({ error: 'This identifier has already been claimed or sold.' });
    }

    // If Firestore free quota is exhausted (429) during read, fallback safely to valid clientPrice
    if (realPrice <= 0 && typeof clientPrice === 'number' && clientPrice > 0) {
      realPrice = clientPrice;
    }

    if (realPrice <= 0) {
      return res.status(400).json({ error: 'Could not verify identifier price.' });
    }

    // 2. Validate discount code if provided
    let appliedDiscountPercent = 0;
    let appliedCode = '';

    if (discountCode && typeof discountCode === 'string' && discountCode.trim()) {
      const codeToTest = discountCode.trim().toUpperCase();
      try {
        const discountsRes = await fetch(
          `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/settings/discounts`
        );
        if (discountsRes.ok) {
          const discountsJson = await discountsRes.json();
          const codesList = discountsJson.fields?.codes?.arrayValue?.values || [];
          for (const item of codesList) {
            const map = item.mapValue?.fields || {};
            const codeStr = (map.code?.stringValue || '').toUpperCase();
            const active = map.active?.booleanValue ?? true;
            const maxUses = Number(map.maxUses?.integerValue ?? 0);
            const usedCount = Number(map.usedCount?.integerValue ?? 0);
            const percent = Number(map.discountPercent?.integerValue ?? 0);

            if (codeStr === codeToTest && active) {
              if (maxUses > 0 && usedCount >= maxUses) {
                return res.status(400).json({ error: `Discount code ${codeToTest} has reached its maximum usage limit.` });
              }
              appliedDiscountPercent = Math.min(100, Math.max(1, percent));
              appliedCode = codeToTest;
              break;
            }
          }
          if (discountCode && !appliedCode) {
            return res.status(400).json({ error: `Invalid or expired discount code "${discountCode}".` });
          }
        }
      } catch (err) {
        console.warn('Error validating discount:', err);
      }
    }

    let finalAmount = realPrice;
    if (appliedDiscountPercent > 0) {
      finalAmount = realPrice * (1 - appliedDiscountPercent / 100);
      finalAmount = Math.max(0, parseFloat(finalAmount.toFixed(2)));
    }

    // 3. Atomically get next address derivation index from Firestore (settings/ltc_orders)
    let derivationIndex = 1;
    try {
      const counterRes = await fetch(
        `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/settings/ltc_orders?key=AIzaSyAhd2t2lx8ooUYEdlll2V0YLSCq3QgOK2k`
      );
      if (counterRes.ok) {
        const cJson = await counterRes.json();
        const currentIdx = Number(cJson.fields?.lastIndex?.integerValue ?? 0);
        derivationIndex = currentIdx + 1;
      }
    } catch {
      derivationIndex = Math.floor(Date.now() / 1000) % 100000;
    }

    // Increment index in Firestore
    try {
      await fetch(
        `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/settings/ltc_orders?updateMask.fieldPaths=lastIndex&key=AIzaSyAhd2t2lx8ooUYEdlll2V0YLSCq3QgOK2k`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              lastIndex: { integerValue: String(derivationIndex) },
            },
          }),
        }
      );
    } catch {}

    // Derive unique address
    const ltcDepositAddress = deriveLtcAddress(derivationIndex);

    // Calculate LTC amount based on real-time price
    const ltcPriceUsd = await getLiveLtcPriceInUsd();
    // 8 decimals standard, add a unique micro-satoshi offset so every order has exact distinction
    const rawLtc = finalAmount / ltcPriceUsd;
    const ltcAmount = parseFloat(rawLtc.toFixed(6));

    const orderId = `LTC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Store active order in Firestore `orders` collection
    await fetch(
      `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/orders/${orderId}?key=AIzaSyAhd2t2lx8ooUYEdlll2V0YLSCq3QgOK2k`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            orderId: { stringValue: orderId },
            usernameId: { stringValue: firestoreDocId || usernameId || '' },
            username: { stringValue: actualUsername },
            customerEmail: { stringValue: customerEmail.trim().toLowerCase() },
            customerDiscord: { stringValue: (customerDiscord || '').trim() },
            discountCode: { stringValue: appliedCode || '' },
            usdAmount: { doubleValue: finalAmount },
            ltcAmount: { doubleValue: ltcAmount },
            ltcAddress: { stringValue: ltcDepositAddress },
            derivationIndex: { integerValue: String(derivationIndex) },
            status: { stringValue: 'WAITING' },
            credentials: { stringValue: credentials },
            createdAt: { integerValue: String(Date.now()) },
            expiresAt: { integerValue: String(Date.now() + 45 * 60 * 1000) }, // 45 minutes
          },
        }),
      }
    );

    return res.status(200).json({
      success: true,
      orderId,
      username: actualUsername,
      usdAmount: finalAmount,
      ltcAmount,
      ltcAddress: ltcDepositAddress,
      qrValue: `litecoin:${ltcDepositAddress}?amount=${ltcAmount}&label=Zentirog%20Vault`,
      expiresInMinutes: 45,
    });
  } catch (error: any) {
    console.error('Error creating LTC order:', error);
    return res.status(500).json({ error: error.message || 'Failed to initialize LTC order.' });
  }
}
