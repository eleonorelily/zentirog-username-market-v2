import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import {
  DEFAULT_DISCORD_LINK,
  fetchAdminUsernames,
  fetchAppSettings,
  removeUsername,
  replaceUsernameList,
  saveAppSettings,
  saveUsername,
} from '@/lib/usernameStore';
import {
  fetchLegacyUsernames,
  getLengthCategory,
  normalizeHandle,
  normalizePrice,
  parseUsernameText,
  stripHandlePrefix,
  stripPricePrefix,
} from '@/lib/usernameParser';
import type { Username, UsernamePriority } from '@/types/username';

const blankUsername: Username = {
  username: '',
  price: '',
  description: '',
  category: 'Semi usernames',
  isNew: false,
  isHot: false,
  isSold: false,
  isBest4: false,
  priority: 'none',
  public: true,
};

const categories = ['3 letter', '4 letter', '3 char', 'Semi usernames', 'Sold'];
const priorities: UsernamePriority[] = ['none', 'high', 'mid', 'low'];

type ImportPreview = {
  source: 'legacy' | 'raw';
  title: string;
  items: Username[];
};

const buildRawUsernameList = (items: Username[]) => (
  items
    .map((item) => {
      const marker = item.isNew ? 'new ' : item.isHot ? 'hot ' : item.priority !== 'none' ? `${item.priority} ` : '';
      const description = item.description.trim();
      const line = `${marker}${item.username} - ${item.isSold ? 'SOLD' : item.price}`;
      return description ? `${line} - ${description}` : `${line} -`;
    })
    .join('\n')
);

const getAdminErrorMessage = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : '';
  if (message.toLowerCase().includes('permission')) {
    return 'Firestore rules are blocking this admin account. Check permissions for your admin UID.';
  }
  return message || fallback;
};

const Admin = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [usernames, setUsernames] = useState<Username[]>([]);
  const [form, setForm] = useState<Username>(blankUsername);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // App Settings state
  const [discordLinkInput, setDiscordLinkInput] = useState(DEFAULT_DISCORD_LINK);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsStatus, setSettingsStatus] = useState('');

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setStatus('');
    try {
      const [list, settings] = await Promise.all([
        fetchAdminUsernames(),
        fetchAppSettings(),
      ]);
      setUsernames(list);
      setDiscordLinkInput(settings.discordServerLink || DEFAULT_DISCORD_LINK);
      setStatus('Vault data & settings synchronized.');
    } catch (error) {
      setStatus(getAdminErrorMessage(error, 'Could not load vault data.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      void loadData();
    }
  }, [user]);

  const filteredUsernames = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return usernames;
    return usernames.filter((item) =>
      [item.username, item.price, item.category, item.description]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }, [search, usernames]);

  const featuredTop4 = useMemo(() => {
    return usernames.filter(u => u.isBest4);
  }, [usernames]);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setAuthError('');
    setIsSigningIn(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setPassword('');
    } catch {
      setAuthError('Authentication rejected. Verify admin credentials.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setStatus('');
    try {
      const username = normalizeHandle(form.username);
      const normalizedPrice = normalizePrice(form.price);
      const isSold = form.isSold || normalizedPrice === 'SOLD';
      await saveUsername({
        ...form,
        username,
        price: normalizedPrice,
        isSold,
        category: isSold ? 'Sold' : form.category || getLengthCategory(username),
      });
      setForm(blankUsername);
      await loadData();
      setStatus(`Identifier ${username} saved successfully.`);
    } catch (error) {
      setStatus(getAdminErrorMessage(error, 'Failed to save username.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSettings = async (event: FormEvent) => {
    event.preventDefault();
    setIsSavingSettings(true);
    setSettingsStatus('');
    try {
      await saveAppSettings({ discordServerLink: discordLinkInput });
      setSettingsStatus('Discord Server Link updated. Live site now points to this invite.');
    } catch (error) {
      setSettingsStatus(getAdminErrorMessage(error, 'Could not update server link.'));
    } finally {
      setIsSavingSettings(false);
    }
  };

  const toggleTop4 = async (username: Username) => {
    try {
      await saveUsername({
        ...username,
        isBest4: !username.isBest4,
      });
      await loadData();
      setStatus(`Updated featured showcase status for ${username.username}`);
    } catch (error) {
      setStatus(getAdminErrorMessage(error, 'Could not update featured status.'));
    }
  };

  const editUsername = (username: Username) => {
    setForm({
      ...blankUsername,
      ...username,
      username: stripHandlePrefix(username.username),
      price: stripPricePrefix(username.price),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteUsername = async (username: Username) => {
    if (!username.id) return;
    const confirmed = window.confirm(`Delete ${username.username} permanently from database?`);
    if (!confirmed) return;

    setStatus('');
    await removeUsername(username.id);
    await loadData();
    setStatus(`${username.username} deleted.`);
  };

  const handleLegacyPreview = async () => {
    setIsLoading(true);
    setStatus('');
    try {
      const items = await fetchLegacyUsernames();
      setImportPreview({
        source: 'legacy',
        title: 'Legacy List',
        items,
      });
      setStatus(`Ready to inspect ${items.length} items from legacy archive.`);
    } catch (error) {
      setStatus(getAdminErrorMessage(error, 'Could not preview legacy list.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRawFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsLoading(true);
    setStatus('');
    try {
      const items = parseUsernameText(await file.text());
      if (items.length === 0) {
        setStatus('No valid handles detected in that file.');
        return;
      }

      setImportPreview({
        source: 'raw',
        title: file.name,
        items,
      });
      setStatus(`Loaded ${items.length} usernames from ${file.name} for inspection.`);
    } catch (error) {
      setStatus(getAdminErrorMessage(error, 'Could not parse text file.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleReplaceFromPreview = async () => {
    if (!importPreview) return;

    const confirmed = window.confirm(
      `Replace current database (${usernames.length} items) with ${importPreview.items.length} imported items?`
    );
    if (!confirmed) return;

    setIsLoading(true);
    setStatus('');
    try {
      const count = await replaceUsernameList(importPreview.items);
      setImportPreview(null);
      await loadData();
      setStatus(`Import complete: ${count} usernames imported.`);
    } catch (error) {
      setStatus(getAdminErrorMessage(error, 'Failed to replace username database.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    if (usernames.length === 0) {
      setStatus('No items available to export.');
      return;
    }

    const rawList = buildRawUsernameList(usernames);
    const blob = new Blob([rawList], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `zentirog-usernames-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus(`Exported ${usernames.length} records.`);
  };

  // Auth Loading
  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#090a0d] flex items-center justify-center p-4 text-[#eaebee] font-mono">
        <div className="border border-[#23252c] bg-[#101115] p-8 text-center max-w-sm w-full">
          <div className="text-xs uppercase tracking-widest text-[#d4af37] mb-2">INITIALIZING</div>
          <p className="text-sm text-neutral-400">Verifying security token...</p>
        </div>
      </div>
    );
  }

  // Login Screen
  if (!user) {
    return (
      <div className="min-h-screen bg-[#090a0d] flex items-center justify-center p-4 text-[#eaebee] font-sans">
        <div className="border border-[#262830] bg-[#101115] max-w-md w-full p-6 sm:p-8 space-y-6">
          <div className="border-b border-[#202228] pb-4">
            <span className="text-[10px] font-mono tracking-widest uppercase text-[#d4af37]">
              RESTRICTED CONSOLE
            </span>
            <h1 className="text-xl sm:text-2xl font-display font-extrabold uppercase tracking-wider text-white mt-1">
              Zentirog Admin
            </h1>
            <p className="text-xs text-neutral-400 font-mono mt-1">
              Authorized access only. Session events are logged.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1.5" htmlFor="admin-email">
                Operator Email
              </label>
              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[#0d0e12] border border-[#23252c] focus:border-[#d4af37] text-white px-3.5 py-2.5 text-sm font-mono focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1.5" htmlFor="admin-password">
                Passphrase
              </label>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-[#0d0e12] border border-[#23252c] focus:border-[#d4af37] text-white px-3.5 py-2.5 text-sm font-mono focus:outline-none"
              />
            </div>

            {authError && (
              <div className="border border-red-900/40 bg-[#160d0e] p-3 text-xs font-mono text-red-300">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSigningIn}
              className="w-full py-3 bg-[#d4af37] hover:bg-[#e2bd45] text-[#090a0d] font-mono font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              {isSigningIn ? 'AUTHENTICATING...' : 'AUTHENTICATE ACCESS'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Authenticated Admin Console
  return (
    <div className="min-h-screen bg-[#090a0d] text-[#eaebee] font-sans pb-16">
      {/* Top Navbar */}
      <header className="border-b border-[#202228] bg-[#0c0d10] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-display font-extrabold text-base tracking-widest text-white uppercase">
              ZENTIROG
            </span>
            <span className="text-[10px] font-mono uppercase bg-[#181a20] border border-[#282a34] text-[#d4af37] px-1.5 py-0.5">
              ADMIN CONTROL
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 text-xs font-mono">
            <span className="text-neutral-400 hidden md:inline truncate max-w-xs">
              {user.email}
            </span>
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 border border-[#262830] hover:border-[#383b46] text-neutral-300 hover:text-white uppercase transition-colors"
            >
              Live Vault ↗
            </a>
            <button
              onClick={() => signOut(auth)}
              className="px-3 py-1.5 border border-red-900/40 bg-[#160d0f] hover:bg-[#201013] text-red-300 uppercase tracking-wider transition-colors"
            >
              Exit
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Status Notification */}
        {status && (
          <div className="border border-[#2d303a] bg-[#121318] p-3 text-xs font-mono text-[#d4af37] flex items-center justify-between">
            <span>{status}</span>
            <button onClick={() => setStatus('')} className="text-neutral-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Global Toolbar & Actions */}
        <div className="border border-[#202228] bg-[#101115] p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-xs font-mono">
            <div>
              <span className="text-neutral-400 block text-[10px]">TOTAL ITEMS</span>
              <span className="text-lg font-bold text-white">{usernames.length}</span>
            </div>
            <div className="border-l border-[#202228] pl-4">
              <span className="text-neutral-400 block text-[10px]">AVAILABLE</span>
              <span className="text-lg font-bold text-emerald-400">
                {usernames.filter(u => !u.isSold).length}
              </span>
            </div>
            <div className="border-l border-[#202228] pl-4">
              <span className="text-neutral-400 block text-[10px]">SOLD</span>
              <span className="text-lg font-bold text-neutral-400">
                {usernames.filter(u => u.isSold).length}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleLegacyPreview}
              disabled={isLoading}
              className="px-3.5 py-2 border border-[#2c2f38] bg-[#161820] hover:bg-[#20232c] text-xs font-mono uppercase text-neutral-200 transition-colors"
            >
              Fetch Legacy
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="px-3.5 py-2 border border-[#2c2f38] bg-[#161820] hover:bg-[#20232c] text-xs font-mono uppercase text-neutral-200 transition-colors"
            >
              Import TXT
            </button>
            <button
              onClick={handleExport}
              disabled={isLoading || usernames.length === 0}
              className="px-3.5 py-2 border border-[#2c2f38] bg-[#161820] hover:bg-[#20232c] text-xs font-mono uppercase text-neutral-200 transition-colors"
            >
              Export TXT
            </button>
            <button
              onClick={loadData}
              disabled={isLoading}
              className="px-3.5 py-2 bg-[#d4af37] hover:bg-[#e2bd45] text-[#090a0d] font-mono font-bold text-xs uppercase tracking-wider transition-colors"
            >
              Refresh Data
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={handleRawFileSelect}
            />
          </div>
        </div>

        {/* Discord Server Link Form */}
        <div className="border border-[#202228] bg-[#101115] p-4 sm:p-5">
          <form onSubmit={handleSaveSettings} className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#d4af37]">
                Global Marketplace Config
              </span>
              {settingsStatus && (
                <span className="text-xs font-mono text-emerald-400">{settingsStatus}</span>
              )}
            </div>
            <label className="block text-xs font-mono text-neutral-300" htmlFor="discord-link-input">
              Discord Invite URL (Directs all buyer inquiries across the marketplace)
            </label>
            <div className="flex flex-col sm:flex-row items-stretch gap-2">
              <input
                id="discord-link-input"
                type="url"
                value={discordLinkInput}
                onChange={(e) => setDiscordLinkInput(e.target.value)}
                required
                placeholder="https://discord.gg/your-invite"
                className="flex-1 bg-[#0d0e12] border border-[#23252c] focus:border-[#d4af37] text-white px-3.5 py-2 text-sm font-mono focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSavingSettings}
                className="px-5 py-2 bg-[#1c1e26] hover:bg-[#282b36] border border-[#303340] text-xs font-mono uppercase tracking-wider text-white transition-colors"
              >
                {isSavingSettings ? 'Saving...' : 'Update Discord Link'}
              </button>
            </div>
          </form>
        </div>

        {/* Featured Showcase Quick Bar */}
        <div className="border border-[#202228] bg-[#101115] p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#d4af37]">
              Featured Showcase ({featuredTop4.length} Selected)
            </span>
            <span className="text-xs font-mono text-neutral-400">
              Highlighted with prime badge
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {featuredTop4.map((item, idx) => (
              <div key={item.id || item.username} className="border border-[#2d303a] bg-[#0d0e12] p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-mono text-[#d4af37]">#{idx + 1} PRIME</div>
                  <div className="font-mono text-sm font-bold text-white truncate">{item.username}</div>
                  <div className="text-xs font-mono text-neutral-400">{item.price}</div>
                </div>
                <button
                  onClick={() => toggleTop4(item)}
                  className="px-2 py-1 border border-[#2c2f38] bg-[#14161c] hover:bg-[#202228] text-[10px] font-mono uppercase text-neutral-400 hover:text-white"
                >
                  Unfeature
                </button>
              </div>
            ))}
            {featuredTop4.length === 0 && (
              <div className="col-span-full border border-dashed border-[#23252c] p-3 text-center text-xs font-mono text-neutral-400">
                No handles marked as Prime Showcase. Toggle "Showcase" below on any handle.
              </div>
            )}
          </div>
        </div>

        {/* Import Preview Drawer (if active) */}
        {importPreview && (
          <div className="border border-amber-900/50 bg-[#16120d] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400">
                  REPLACE ARCHIVE PREVIEW
                </span>
                <h3 className="text-base font-bold text-white font-mono mt-0.5">
                  {importPreview.title} ({importPreview.items.length} items parsed)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReplaceFromPreview}
                  disabled={isLoading}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-mono font-bold text-xs uppercase"
                >
                  Confirm & Replace Firestore List
                </button>
                <button
                  onClick={() => setImportPreview(null)}
                  className="px-3 py-2 border border-[#3a3020] text-xs font-mono uppercase text-neutral-300"
                >
                  Dismiss
                </button>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto border border-[#2e261a] divide-y divide-[#241e15]">
              {importPreview.items.slice(0, 30).map((item, i) => (
                <div key={i} className="p-2.5 flex items-center justify-between text-xs font-mono">
                  <span className="text-white">{item.username}</span>
                  <span className="text-amber-200">{item.price}</span>
                  <span className="text-neutral-400">{item.category}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Split: Form on Left, Catalog Table on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          {/* Add / Edit Form */}
          <div className="border border-[#202228] bg-[#101115] p-5 h-fit space-y-4">
            <div className="border-b border-[#202228] pb-3 flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#d4af37]">
                {form.id ? 'EDIT RECORD' : 'CREATE RECORD'}
              </span>
              {form.id && (
                <button
                  onClick={() => setForm(blankUsername)}
                  className="text-[10px] font-mono text-neutral-400 hover:text-white uppercase"
                >
                  Cancel
                </button>
              )}
            </div>

            <form onSubmit={handleSave} className="space-y-3.5">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1" htmlFor="input-handle">
                  Handle (Without @)
                </label>
                <input
                  id="input-handle"
                  value={form.username}
                  onChange={(e) => setForm((c) => ({ ...c, username: stripHandlePrefix(e.target.value) }))}
                  placeholder="e.g. rare"
                  required
                  className="w-full bg-[#0d0e12] border border-[#23252c] focus:border-[#d4af37] text-white px-3 py-2 text-sm font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1" htmlFor="input-price">
                  Price ($ or 'SOLD')
                </label>
                <input
                  id="input-price"
                  value={form.price}
                  onChange={(e) => setForm((c) => ({ ...c, price: stripPricePrefix(e.target.value) }))}
                  placeholder="e.g. 500 or SOLD"
                  required
                  className="w-full bg-[#0d0e12] border border-[#23252c] focus:border-[#d4af37] text-white px-3 py-2 text-sm font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1" htmlFor="input-desc">
                  Vault Note / Description
                </label>
                <textarea
                  id="input-desc"
                  value={form.description}
                  onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
                  rows={3}
                  placeholder="Notes on rarity, character set, or account status..."
                  className="w-full bg-[#0d0e12] border border-[#23252c] focus:border-[#d4af37] text-white px-3 py-2 text-xs font-sans focus:outline-none resize-y"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 mb-1" htmlFor="select-cat">
                    Category
                  </label>
                  <select
                    id="select-cat"
                    value={form.category}
                    onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))}
                    className="w-full bg-[#0d0e12] border border-[#23252c] text-white px-2 py-2 text-xs font-mono focus:outline-none"
                  >
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 mb-1" htmlFor="select-priority">
                    Priority
                  </label>
                  <select
                    id="select-priority"
                    value={form.priority}
                    onChange={(e) => setForm((c) => ({ ...c, priority: e.target.value as UsernamePriority }))}
                    className="w-full bg-[#0d0e12] border border-[#23252c] text-white px-2 py-2 text-xs font-mono focus:outline-none"
                  >
                    {priorities.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              {/* Toggles */}
              <div className="border border-[#1e2026] bg-[#0c0d10] p-3 space-y-2 text-xs font-mono">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(form.isBest4)}
                    onChange={(e) => setForm((c) => ({ ...c, isBest4: e.target.checked }))}
                    className="rounded-none border-[#333742]"
                  />
                  <span className="text-[#d4af37]">Prime Showcase (Top 4)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(form.isNew)}
                    onChange={(e) => setForm((c) => ({ ...c, isNew: e.target.checked }))}
                    className="rounded-none border-[#333742]"
                  />
                  <span>New Drop Badge</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(form.isHot)}
                    onChange={(e) => setForm((c) => ({ ...c, isHot: e.target.checked }))}
                    className="rounded-none border-[#333742]"
                  />
                  <span>High Demand Badge</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(form.isSold)}
                    onChange={(e) => setForm((c) => ({ ...c, isSold: e.target.checked }))}
                    className="rounded-none border-[#333742]"
                  />
                  <span>Mark as Claimed / Sold</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.public !== false}
                    onChange={(e) => setForm((c) => ({ ...c, public: e.target.checked }))}
                    className="rounded-none border-[#333742]"
                  />
                  <span>Publish to Public Market</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-2.5 bg-[#d4af37] hover:bg-[#e2bd45] text-[#090a0d] font-mono font-bold text-xs uppercase tracking-wider transition-colors"
              >
                {isSaving ? 'PERSISTING...' : form.id ? 'UPDATE HANDLE' : 'COMMIT TO VAULT'}
              </button>
            </form>
          </div>

          {/* Database Table on Right */}
          <div className="border border-[#202228] bg-[#101115] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#d4af37]">
                  VAULT INVENTORY
                </span>
                <h2 className="text-base font-bold text-white font-mono">
                  {filteredUsernames.length} of {usernames.length} Record(s)
                </h2>
              </div>

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter table..."
                className="bg-[#0d0e12] border border-[#23252c] focus:border-[#d4af37] text-white px-3 py-1.5 text-xs font-mono focus:outline-none sm:w-60"
              />
            </div>

            <div className="border border-[#202228] divide-y divide-[#181a20] max-h-[750px] overflow-y-auto">
              {filteredUsernames.map((item) => (
                <div
                  key={item.id || item.username}
                  className="p-3 bg-[#0d0e12] hover:bg-[#12141a] flex items-center justify-between gap-3 transition-colors text-xs font-mono"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-sm truncate ${item.isSold ? 'line-through text-neutral-500' : 'text-white'}`}>
                        {item.username.startsWith('@') ? item.username : `@${item.username}`}
                      </span>
                      {item.isBest4 && (
                        <span className="text-[9px] border border-[#d4af37]/60 text-[#d4af37] px-1 py-0.2">
                          PRIME
                        </span>
                      )}
                      {item.isNew && !item.isSold && (
                        <span className="text-[9px] border border-emerald-500/50 text-emerald-400 px-1 py-0.2">
                          NEW
                        </span>
                      )}
                      {item.isSold && (
                        <span className="text-[9px] border border-neutral-600 text-neutral-400 px-1 py-0.2">
                          SOLD
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-neutral-400 flex items-center gap-2">
                      <span>{item.category}</span>
                      <span>·</span>
                      <span className="text-neutral-300 font-bold">{item.price}</span>
                      {item.public === false && (
                        <>
                          <span>·</span>
                          <span className="text-amber-400">HIDDEN</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => toggleTop4(item)}
                      title="Toggle Prime"
                      className={`px-2 py-1 border text-[10px] uppercase transition-colors ${
                        item.isBest4
                          ? 'border-[#d4af37] text-[#d4af37] bg-[#1a1710]'
                          : 'border-[#262830] text-neutral-400 hover:text-white'
                      }`}
                    >
                      {item.isBest4 ? '★ Prime' : '☆'}
                    </button>
                    <button
                      onClick={() => editUsername(item)}
                      className="px-2.5 py-1 border border-[#2c2f38] bg-[#161820] hover:bg-[#20232c] text-neutral-200 text-[10px] uppercase transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteUsername(item)}
                      className="px-2 py-1 border border-red-900/40 bg-[#160d0f] hover:bg-[#220e11] text-red-300 text-[10px] uppercase transition-colors"
                    >
                      Del
                    </button>
                  </div>
                </div>
              ))}

              {filteredUsernames.length === 0 && !isLoading && (
                <div className="p-8 text-center text-xs font-mono text-neutral-400">
                  No records match filter query.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Admin;
