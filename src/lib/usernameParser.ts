import type { Username, UsernamePriority } from '@/types/username';

export const LEGACY_USERNAME_SOURCE =
  'https://raw.githubusercontent.com/zentir0g/ignore/refs/heads/main/users.txt';

export const getLengthCategory = (username: string): string => {
  const handle = username.startsWith('@') ? username.slice(1) : username;
  if (/^[A-Za-z]{3}$/.test(handle)) return '3 letter';
  if (/^[A-Za-z]{4}$/.test(handle)) return '4 letter';
  if (handle.length === 3) return '3 char';
  return 'Semi usernames';
};

export const normalizeHandle = (value: string): string => {
  const clean = value.trim().replace(/^@+/, '');
  return clean ? `@${clean}` : '';
};

export const stripHandlePrefix = (value: string): string => value.trim().replace(/^@+/, '');

export const normalizePrice = (value: string): string => {
  const clean = value.trim();
  if (clean.toLowerCase() === 'sold') return 'SOLD';

  const numeric = clean.replace(/^\$+/, '').replace(/,/g, '').trim();
  return numeric ? `$${numeric}` : '';
};

export const stripPricePrefix = (value: string): string => {
  const clean = value.trim();
  return clean.toLowerCase() === 'sold' ? 'SOLD' : clean.replace(/^\$+/, '');
};

export const parseUsernameText = (text: string): Username[] => {
  const lines = text.split('\n').filter((line) => line.trim());
  const usernames: Username[] = [];
  const seenUsernames = new Set<string>();

  let globalDiscount = 0;
  const firstLine = lines[0]?.toLowerCase().trim();
  if (firstLine?.startsWith('discount -')) {
    const discountMatch = firstLine.match(/discount\s*-\s*(\d+)%?/);
    if (discountMatch) {
      globalDiscount = parseInt(discountMatch[1], 10);
    }
    lines.shift();
  }

  lines.forEach((line) => {
    let cleanLine = line.trim();
    let isNew = false;
    let isHot = false;
    let priority: UsernamePriority = 'none';

    const markers = ['new', 'hot', 'high', 'mid', 'low'] as const;
    markers.forEach((marker) => {
      if (cleanLine.toLowerCase().startsWith(`${marker} `)) {
        if (marker === 'new') isNew = true;
        if (marker === 'hot') isHot = true;
        if (marker === 'high' || marker === 'mid' || marker === 'low') priority = marker;
        cleanLine = cleanLine.replace(new RegExp(`^${marker}\\s+`, 'i'), '');
      }
    });

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

    if (!username || seenUsernames.has(username)) return;
    seenUsernames.add(username);

    const isSold = priceOrStatus.trim().toLowerCase() === 'sold';
    let price = priceOrStatus.trim();
    let category = getLengthCategory(username);

    if (isSold) {
      price = 'SOLD';
      category = 'Sold';
    } else {
      const numericPrice = parseFloat(priceOrStatus.replace(/\$/, ''));
      if (!Number.isNaN(numericPrice)) {
        const discountToApply = individualDiscount > 0 ? individualDiscount : globalDiscount;
        if (discountToApply > 0) {
          const finalPrice = Math.floor(numericPrice * (1 - discountToApply / 100));
          price = `$${finalPrice} (${discountToApply}% off $${numericPrice})`;
        } else {
          price = `$${numericPrice}`;
        }
        category = getLengthCategory(username);
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
    });
  });

  return usernames;
};

export const fetchLegacyUsernames = async (): Promise<Username[]> => {
  const response = await fetch(LEGACY_USERNAME_SOURCE);
  if (!response.ok) {
    throw new Error('Could not load legacy username list');
  }
  return parseUsernameText(await response.text());
};
