import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  addDoc,
  collection,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { existsSync, readFileSync } from 'node:fs';

const firebaseConfig = {
  apiKey: 'AIzaSyAhd2t2lx8ooUYEdlll2V0YLSCq3QgOK2k',
  authDomain: 'zentirog-market-2026.firebaseapp.com',
  projectId: 'zentirog-market-2026',
  storageBucket: 'zentirog-market-2026.firebasestorage.app',
  messagingSenderId: '1043916852490',
  appId: '1:1043916852490:web:5ba556bc3cee3a28a73ef3',
};

const loadLocalEnv = () => {
  if (!existsSync('.env.local')) return;

  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) return;

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      if (key && !process.env[key]) {
        process.env[key] = value.replace(/^["']|["']$/g, '');
      }
    });
};

loadLocalEnv();

const sourceUrl = 'https://raw.githubusercontent.com/zentir0g/ignore/refs/heads/main/users.txt';
const adminEmail = process.env.FIREBASE_ADMIN_EMAIL || 'zormogo@gmail.com';
const adminPassword = process.env.FIREBASE_ADMIN_PASSWORD;

const normalizeHandle = (value) => {
  const clean = value.trim().replace(/^@+/, '');
  return clean ? `@${clean}` : '';
};

const getLengthCategory = (username) => {
  const handle = username.startsWith('@') ? username.slice(1) : username;
  if (/^[A-Za-z]{3}$/.test(handle)) return '3 letter';
  if (/^[A-Za-z]{4}$/.test(handle)) return '4 letter';
  if (handle.length === 3) return '3 char';
  return 'Semi usernames';
};

const parseUsernameText = (text) => {
  const lines = text.split('\n').filter((line) => line.trim());
  const usernames = [];
  const seen = new Set();
  let globalDiscount = 0;

  const firstLine = lines[0]?.toLowerCase().trim();
  if (firstLine?.startsWith('discount -')) {
    const discountMatch = firstLine.match(/discount\s*-\s*(\d+)%?/);
    if (discountMatch) globalDiscount = parseInt(discountMatch[1], 10);
    lines.shift();
  }

  for (const line of lines) {
    let cleanLine = line.trim();
    let isNew = false;
    let isHot = false;
    let priority = 'none';

    for (const marker of ['new', 'hot', 'high', 'mid', 'low']) {
      if (cleanLine.toLowerCase().startsWith(`${marker} `)) {
        if (marker === 'new') isNew = true;
        if (marker === 'hot') isHot = true;
        if (['high', 'mid', 'low'].includes(marker)) priority = marker;
        cleanLine = cleanLine.replace(new RegExp(`^${marker}\\s+`, 'i'), '');
      }
    }

    const matchWithDiscount = cleanLine.match(/@([\w.]+)\s*-\s*\$(\d+(?:\.\d+)?)\s*%(\d+)\s*-\s*(.*)?/);
    const matchRegular = cleanLine.match(/@([\w.]+)\s*-\s*([^-]+)\s*-\s*(.*)?/);

    let username = '';
    let priceOrStatus = '';
    let description = '';
    let individualDiscount = 0;

    if (matchWithDiscount) {
      username = normalizeHandle(matchWithDiscount[1]);
      priceOrStatus = `$${matchWithDiscount[2]}`;
      individualDiscount = parseInt(matchWithDiscount[3], 10);
      description = matchWithDiscount[4] || '';
    } else if (matchRegular) {
      username = normalizeHandle(matchRegular[1]);
      priceOrStatus = matchRegular[2];
      description = matchRegular[3] || '';
    }

    if (!username || seen.has(username.toLowerCase())) continue;
    seen.add(username.toLowerCase());

    const isSold = priceOrStatus.trim().toLowerCase() === 'sold';
    let price = priceOrStatus.trim();
    let category = getLengthCategory(username);

    if (isSold) {
      price = 'SOLD';
      category = 'Sold';
    } else {
      const numericPrice = parseFloat(priceOrStatus.replace(/\$/, ''));
      if (!Number.isNaN(numericPrice)) {
        const discount = individualDiscount > 0 ? individualDiscount : globalDiscount;
        price = discount > 0
          ? `$${Math.floor(numericPrice * (1 - discount / 100))} (${discount}% off $${numericPrice})`
          : `$${numericPrice}`;
      }
    }

    usernames.push({
      username,
      price,
      description: description.trim(),
      category,
      isNew,
      isHot,
      isSold,
      priority,
      public: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdAtServer: serverTimestamp(),
      updatedAtServer: serverTimestamp(),
    });
  }

  return usernames;
};

if (!adminPassword) {
  console.error('Missing FIREBASE_ADMIN_PASSWORD. Set it before seeding Firestore.');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

console.log(`Signing in ${adminEmail}...`);
await signInWithEmailAndPassword(auth, adminEmail, adminPassword);

console.log(`Fetching ${sourceUrl}...`);
const response = await fetch(sourceUrl);
if (!response.ok) throw new Error(`GitHub source failed: ${response.status}`);

const parsed = parseUsernameText(await response.text());
const usernamesCollection = collection(db, 'usernames');
let imported = 0;

for (const item of parsed) {
  const exists = await getDocs(query(usernamesCollection, where('username', '==', item.username)));
  if (!exists.empty) continue;
  await addDoc(usernamesCollection, item);
  imported += 1;
}

console.log(`Imported ${imported} new usernames. ${parsed.length - imported} already existed.`);
