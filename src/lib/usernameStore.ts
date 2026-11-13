import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { fetchLegacyUsernames, normalizeHandle, normalizePrice } from './usernameParser';
import type { Username } from '@/types/username';
import type { AppSettings } from '@/types/settings';

const usernamesCollection = collection(db, 'usernames');
export const DEFAULT_DISCORD_LINK = 'https://discord.gg/5WC6sH2rrj';

const cleanUsername = (username: Username): Username => ({
  username: normalizeHandle(username.username),
  price: username.isSold ? 'SOLD' : normalizePrice(username.price),
  description: username.description.trim(),
  category: username.category,
  credentials: (username.credentials || '').trim(),
  isNew: Boolean(username.isNew),
  isHot: Boolean(username.isHot),
  isSold: Boolean(username.isSold),
  isBest4: Boolean(username.isBest4),
  priority: username.priority || 'none',
  public: username.public !== false,
  createdAt: username.createdAt || Date.now(),
  updatedAt: Date.now(),
});

const fromFirestore = (id: string, data: Record<string, unknown>): Username => ({
  id,
  username: String(data.username || ''),
  price: String(data.price || ''),
  description: String(data.description || ''),
  category: String(data.category || 'Semi usernames'),
  credentials: typeof data.credentials === 'string' ? data.credentials : '',
  isNew: Boolean(data.isNew),
  isHot: Boolean(data.isHot),
  isSold: Boolean(data.isSold),
  isBest4: Boolean(data.isBest4),
  priority: data.priority === 'high' || data.priority === 'mid' || data.priority === 'low' ? data.priority : 'none',
  public: data.public !== false,
  createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
  updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0,
});

export const fetchPublishedUsernames = async (): Promise<Username[]> => {
  // First try high-performance MongoDB endpoint (zero daily quota traps)
  try {
    const res = await fetch('/api/usernames');
    if (res.ok) {
      const items = await res.json();
      if (Array.isArray(items) && items.length > 0) {
        return items;
      }
    }
  } catch (err) {
    console.warn('API usernames fallback to Firestore:', err);
  }

  // Fallback to Firestore if needed
  try {
    const snapshot = await getDocs(query(usernamesCollection, where('public', '==', true)));
    return snapshot.docs
      .map((item) => {
        const u = fromFirestore(item.id, item.data());
        return {
          ...u,
          credentials: '',
        };
      })
      .filter((item) => item.username && item.price);
  } catch (dbErr) {
    console.error('Database read error:', dbErr);
    return [];
  }
};

export const fetchAdminUsernames = async (): Promise<Username[]> => {
  const snapshot = await getDocs(usernamesCollection);
  return snapshot.docs
    .map((item) => fromFirestore(item.id, item.data()))
    .sort((a, b) => a.username.localeCompare(b.username));
};

export const saveUsername = async (username: Username): Promise<void> => {
  const payload = {
    ...cleanUsername(username),
    updatedAtServer: serverTimestamp(),
  };

  if (username.id) {
    await setDoc(doc(db, 'usernames', username.id), payload, { merge: true });
    return;
  }

  await addDoc(usernamesCollection, {
    ...payload,
    createdAtServer: serverTimestamp(),
  });
};

export const removeUsername = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'usernames', id));
};

export const importLegacyUsernames = async (): Promise<number> => {
  const legacyUsernames = await fetchLegacyUsernames();
  const current = await fetchAdminUsernames();
  const existing = new Set(current.map((item) => item.username.toLowerCase()));
  const fresh = legacyUsernames.filter((item) => !existing.has(item.username.toLowerCase()));

  await Promise.all(fresh.map((item) => addDoc(usernamesCollection, {
    ...cleanUsername(item),
    createdAtServer: serverTimestamp(),
    updatedAtServer: serverTimestamp(),
  })));

  return fresh.length;
};

export const replaceUsernameList = async (items: Username[]): Promise<number> => {
  const currentSnapshot = await getDocs(usernamesCollection);
  const operations: Array<{ type: 'delete'; id: string } | { type: 'create'; username: Username }> = [
    ...currentSnapshot.docs.map((item) => ({ type: 'delete' as const, id: item.id })),
    ...items.map((username) => ({ type: 'create' as const, username })),
  ];

  for (let index = 0; index < operations.length; index += 450) {
    const batch = writeBatch(db);
    operations.slice(index, index + 450).forEach((operation) => {
      if (operation.type === 'delete') {
        batch.delete(doc(db, 'usernames', operation.id));
        return;
      }

      batch.set(doc(usernamesCollection), {
        ...cleanUsername(operation.username),
        createdAtServer: serverTimestamp(),
        updatedAtServer: serverTimestamp(),
      });
    });
    await batch.commit();
  }

  return items.length;
};

export const fetchAppSettings = async (): Promise<AppSettings> => {
  try {
    const settingsDoc = await getDoc(doc(db, 'settings', 'config'));
    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      return {
        discordServerLink: String(data.discordServerLink || DEFAULT_DISCORD_LINK),
        updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0,
      };
    }
  } catch (error) {
    console.warn('Could not fetch app settings from Firestore, using default:', error);
  }
  return { discordServerLink: DEFAULT_DISCORD_LINK };
};

export const saveAppSettings = async (settings: AppSettings): Promise<void> => {
  const payload = {
    discordServerLink: settings.discordServerLink.trim(),
    updatedAt: Date.now(),
    updatedAtServer: serverTimestamp(),
  };
  await setDoc(doc(db, 'settings', 'config'), payload, { merge: true });
};

export const fetchDiscountCodes = async (): Promise<import('@/types/discount').DiscountCode[]> => {
  try {
    const discountsDoc = await getDoc(doc(db, 'settings', 'discounts'));
    if (discountsDoc.exists()) {
      const data = discountsDoc.data();
      const list = Array.isArray(data.codes) ? data.codes : [];
      return list as import('@/types/discount').DiscountCode[];
    }
  } catch (error) {
    console.warn('Could not fetch discounts:', error);
  }
  return [];
};

export const saveDiscountCodes = async (codes: import('@/types/discount').DiscountCode[]): Promise<void> => {
  const payload = {
    codes: codes.map(c => ({
      code: c.code.trim().toUpperCase(),
      discountPercent: Math.max(1, Math.min(100, Number(c.discountPercent) || 0)),
      maxUses: Math.max(0, Number(c.maxUses) || 0),
      usedCount: Math.max(0, Number(c.usedCount) || 0),
      active: Boolean(c.active),
      createdAt: c.createdAt || Date.now(),
    })),
    updatedAt: Date.now(),
    updatedAtServer: serverTimestamp(),
  };
  await setDoc(doc(db, 'settings', 'discounts'), payload, { merge: true });
};


