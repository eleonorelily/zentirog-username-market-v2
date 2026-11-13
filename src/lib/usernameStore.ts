import { fetchLegacyUsernames, normalizeHandle, normalizePrice } from './usernameParser';
import type { Username } from '@/types/username';
import type { AppSettings } from '@/types/settings';
import type { DiscountCode } from '@/types/discount';

export const DEFAULT_DISCORD_LINK = 'https://discord.gg/5WC6sH2rrj';

const TOKEN_KEY = 'zentirog_mongo_admin_token';
const EMAIL_KEY = 'zentirog_mongo_admin_email';

export function getStoredAdminToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredAdminEmail(): string | null {
  return localStorage.getItem(EMAIL_KEY);
}

export function setStoredAdminSession(token: string, email: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EMAIL_KEY, email);
}

export function clearStoredAdminSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
}

export async function loginAdminMongo(email: string, password: string): Promise<{ success: boolean; token: string; email: string }> {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'login',
      email,
      password,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Authentication rejected by MongoDB.');
  }

  setStoredAdminSession(data.token, data.email);
  return data;
}

function getAuthHeader(): HeadersInit {
  const token = getStoredAdminToken();
  if (!token) return { 'Content-Type': 'application/json' };
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

// 1. Fetch public usernames for storefront (MongoDB)
export const fetchPublishedUsernames = async (): Promise<Username[]> => {
  try {
    const res = await fetch('/api/usernames');
    if (res.ok) {
      const items = await res.json();
      if (Array.isArray(items)) {
        return items;
      }
    }
  } catch (err) {
    console.error('Error fetching public usernames:', err);
  }
  return [];
};

// 2. Fetch all usernames for Admin (MongoDB)
export const fetchAdminUsernames = async (): Promise<Username[]> => {
  const headers = getAuthHeader();
  const res = await fetch('/api/admin?action=usernames', { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 401) {
      clearStoredAdminSession();
    }
    throw new Error(err.error || 'Failed to fetch admin usernames from MongoDB');
  }
  return res.json();
};

// 3. Save / Update single username in MongoDB
export const saveUsername = async (username: Username): Promise<void> => {
  const headers = getAuthHeader();
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'save_username',
      username,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to save username in MongoDB');
  }
};

// 4. Remove username in MongoDB
export const removeUsername = async (id: string): Promise<void> => {
  const headers = getAuthHeader();
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'delete_username',
      id,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete username from MongoDB');
  }
};

// 5. Replace entire database with imported list
export const replaceUsernameList = async (items: Username[]): Promise<number> => {
  const headers = getAuthHeader();
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'replace_all',
      items,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to replace username database in MongoDB');
  }
  const data = await res.json();
  return data.count || items.length;
};

// 6. Fetch App Settings (Discord Link)
export const fetchAppSettings = async (): Promise<AppSettings> => {
  try {
    const headers = getAuthHeader();
    const res = await fetch('/api/admin?action=settings', { headers });
    if (res.ok) {
      const data = await res.json();
      return {
        discordServerLink: data.discordServerLink || DEFAULT_DISCORD_LINK,
      };
    }
  } catch (err) {
    console.warn('Error reading settings from MongoDB:', err);
  }
  return { discordServerLink: DEFAULT_DISCORD_LINK };
};

// 7. Save App Settings (Discord Link)
export const saveAppSettings = async (settings: AppSettings): Promise<void> => {
  const headers = getAuthHeader();
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'save_settings',
      discordServerLink: settings.discordServerLink,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to save settings in MongoDB');
  }
};

// 8. Fetch Discount Codes
export const fetchDiscountCodes = async (): Promise<DiscountCode[]> => {
  try {
    const headers = getAuthHeader();
    const res = await fetch('/api/admin?action=settings', { headers });
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data.discountCodes) ? data.discountCodes : [];
    }
  } catch (err) {
    console.warn('Error reading discount codes from MongoDB:', err);
  }
  return [];
};

// 9. Save Discount Codes
export const saveDiscountCodes = async (codes: DiscountCode[]): Promise<void> => {
  const headers = getAuthHeader();
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'save_discounts',
      codes,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to save discount codes in MongoDB');
  }
};

export const importLegacyUsernames = async (): Promise<number> => {
  const legacy = await fetchLegacyUsernames();
  const current = await fetchAdminUsernames();
  const existing = new Set(current.map((item) => item.username.toLowerCase()));
  const fresh = legacy.filter((item) => !existing.has(item.username.toLowerCase()));

  for (const item of fresh) {
    await saveUsername(item);
  }
  return fresh.length;
};
