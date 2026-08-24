import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { AlertTriangle, Crown, Download, Globe, KeyRound, Link as LinkIcon, Lock, LogOut, MessageCircle, Plus, RefreshCw, Save, ShieldCheck, Star, Trash2, Upload } from 'lucide-react';
import ParticleEffect from '@/components/ParticleEffect';
import { Button } from '@/components/ui/button';
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
    return 'Firestore rules are blocking this admin account. Publish the latest firestore.rules for zormogo@gmail.com, then try again.';
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
      setStatus('Vault data & settings loaded.');
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
      setAuthError('Login blocked. Check the admin email/password and Firebase Auth setup.');
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
      setStatus('Username saved securely to Firestore.');
    } catch (error) {
      setStatus(getAdminErrorMessage(error, 'Could not save username.'));
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
      setSettingsStatus('Discord Server Link updated successfully! All Deal buttons will now open this link.');
    } catch (error) {
      setSettingsStatus(getAdminErrorMessage(error, 'Could not save settings.'));
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
      setStatus(`Updated Top 4 status for ${username.username}`);
    } catch (error) {
      setStatus(getAdminErrorMessage(error, 'Could not update Top 4 status.'));
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
    const confirmed = window.confirm(`Delete ${username.username} from Firebase?`);
    if (!confirmed) return;

    setStatus('');
    await removeUsername(username.id);
    await loadData();
    setStatus(`${username.username} removed.`);
  };

  const handleLegacyPreview = async () => {
    setIsLoading(true);
    setStatus('');
    try {
      const items = await fetchLegacyUsernames();
      setImportPreview({
        source: 'legacy',
        title: 'Legacy GitHub List',
        items,
      });
      setStatus(`Review ${items.length} usernames from the legacy list before replacing Firestore.`);
    } catch (error) {
      setStatus(getAdminErrorMessage(error, 'Could not preview legacy usernames.'));
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
        setStatus('No valid usernames found in that raw file.');
        return;
      }

      setImportPreview({
        source: 'raw',
        title: file.name,
        items,
      });
      setStatus(`Review ${items.length} usernames from ${file.name} before replacing Firestore.`);
    } catch (error) {
      setStatus(getAdminErrorMessage(error, 'Could not read that raw list.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleReplaceFromPreview = async () => {
    if (!importPreview) return;

    const confirmed = window.confirm(
      `Warning: this will replace your current ${usernames.length} Firestore usernames with ${importPreview.items.length} usernames from ${importPreview.title}. This cannot be undone from the admin panel. Continue?`
    );
    if (!confirmed) return;

    setIsLoading(true);
    setStatus('');
    try {
      const count = await replaceUsernameList(importPreview.items);
      setImportPreview(null);
      await loadData();
      setStatus(`Replaced the current vault with ${count} usernames from ${importPreview.title}.`);
    } catch (error) {
      setStatus(getAdminErrorMessage(error, 'Could not replace the username list.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    if (usernames.length === 0) {
      setStatus('Load or import usernames before exporting.');
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
    setStatus(`Exported ${usernames.length} usernames to a raw text file.`);
  };

  if (!authReady) {
    return (
      <main className="dragon-page grid min-h-screen place-items-center px-5 text-white">
        <ParticleEffect />
        <div className="admin-panel max-w-md p-8 text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-red-300" aria-hidden="true" />
          <p className="mt-4 font-bold">Preparing encrypted admin session...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="dragon-page relative grid min-h-screen place-items-center overflow-hidden px-5 py-12 text-white">
        <ParticleEffect />
        <form onSubmit={handleLogin} className="admin-panel relative z-10 w-full max-w-md p-8">
          <div className="mb-7 flex items-center gap-4">
            <div className="brand-sigil">
              <Lock className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.26em] text-red-200/70">Encrypted Admin</p>
              <h1 className="text-3xl font-black">Zentirog Vault Login</h1>
            </div>
          </div>

          <label className="admin-label" htmlFor="admin-email">Admin email</label>
          <input
            id="admin-email"
            className="admin-input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label className="admin-label" htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            className="admin-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {authError && <p className="mt-4 rounded-xl border border-red-400/30 bg-red-950/40 p-3 text-sm text-red-100">{authError}</p>}

          <Button disabled={isSigningIn} className="mt-6 h-12 w-full rounded-full bg-red-600 font-black hover:bg-red-500">
            <KeyRound className="mr-2 h-4 w-4" aria-hidden="true" />
            {isSigningIn ? 'Checking...' : 'Unlock Admin Panel'}
          </Button>

          <p className="mt-5 text-sm leading-6 text-red-50/58">
            Passwords are handled by Firebase Auth. Keep Firestore rules locked to your admin UID before publishing.
          </p>
        </form>
      </main>
    );
  }

  return (
    <main className="dragon-page min-h-screen overflow-hidden px-5 py-8 text-white md:px-10">
      <ParticleEffect />
      <div className="relative z-10 mx-auto max-w-7xl space-y-8">

        {/* Admin Header */}
        <div className="flex flex-col gap-4 rounded-[2rem] border border-red-400/20 bg-black/35 p-6 backdrop-blur md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-red-200/70">Admin Vault</p>
            <h1 className="mt-2 text-4xl font-black">Username Control Room</h1>
            <p className="mt-2 text-red-50/65">Signed in as {user.email}</p>
            <p className="mt-1 text-xs text-red-50/45">UID: {user.uid}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleLegacyPreview} disabled={isLoading} className="rounded-full bg-white px-5 font-black text-red-950 hover:bg-red-100">
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Import Legacy List
            </Button>
            <Button onClick={() => fileInputRef.current?.click()} disabled={isLoading} variant="outline" className="rounded-full border-red-300/30 bg-black/30 px-5 text-red-50 hover:bg-red-950/50">
              <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
              Import Raw List
            </Button>
            <Button onClick={handleExport} disabled={isLoading || usernames.length === 0} variant="outline" className="rounded-full border-red-300/30 bg-black/30 px-5 text-red-50 hover:bg-red-950/50">
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              Export Raw List
            </Button>
            <Button onClick={() => signOut(auth)} variant="outline" className="rounded-full border-red-300/30 bg-black/30 px-5 text-red-50 hover:bg-red-950/50">
              <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
              Lock Panel
            </Button>
            <input ref={fileInputRef} type="file" accept=".txt,text/plain" className="hidden" onChange={handleRawFileSelect} />
          </div>
        </div>

        {/* Discord Server Link Settings Card */}
        <section className="admin-panel p-6 border-amber-500/30 bg-gradient-to-r from-amber-950/20 via-black/40 to-red-950/20">
          <form onSubmit={handleSaveSettings} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-3.5 py-1 text-xs font-black uppercase text-amber-300">
                <Globe className="h-3.5 w-3.5" />
                Live Discord Server Settings
              </div>
              <h2 className="mt-2 text-2xl font-black text-white flex items-center gap-2">
                Deal Button Discord Server Link
              </h2>
              <p className="mt-1 text-sm text-red-50/65">
                Change the Discord invite URL anytime. All "Deal" buttons on the website will update instantly!
              </p>
              <div className="mt-3 flex items-center gap-2 max-w-2xl">
                <div className="relative flex-1">
                  <LinkIcon className="absolute left-3.5 top-3.5 h-4 w-4 text-amber-400" />
                  <input
                    type="url"
                    value={discordLinkInput}
                    onChange={(e) => setDiscordLinkInput(e.target.value)}
                    placeholder="https://discord.gg/your-invite-code"
                    required
                    className="admin-input pl-10 border-amber-400/30 focus:border-amber-400"
                  />
                </div>
                <Button disabled={isSavingSettings} className="h-12 rounded-full bg-gradient-to-r from-amber-500 to-red-600 font-black text-white px-6 hover:brightness-110">
                  <Save className="mr-2 h-4 w-4" />
                  {isSavingSettings ? 'Saving...' : 'Save Server Link'}
                </Button>
              </div>
              {settingsStatus && (
                <p className="mt-2 text-sm font-bold text-amber-300">{settingsStatus}</p>
              )}
            </div>
          </form>
        </section>

        {/* Top 4 Best Usernames Showcase Manager */}
        <section className="admin-panel p-6 border-amber-500/30 bg-black/40">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <Crown className="h-6 w-6 text-amber-400" />
                Top 4 Best Usernames Showcase ({featuredTop4.length} Selected)
              </h2>
              <p className="mt-1 text-sm text-red-50/65">
                These usernames are featured prominently in the "4 Best Usernames of All Time" Hall of Fame section on the main page.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {featuredTop4.map((item, idx) => (
              <div key={item.id || item.username} className="rounded-xl border border-amber-400/40 bg-amber-950/20 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-amber-400 uppercase tracking-wider">#{idx + 1} Best Handle</span>
                    <Button onClick={() => toggleTop4(item)} size="sm" variant="outline" className="h-7 text-xs border-red-400/30 text-red-300 hover:bg-red-950/50">
                      Remove
                    </Button>
                  </div>
                  <p className="text-xl font-black text-white break-all">{item.username}</p>
                  <p className="text-sm font-bold text-amber-200 mt-1">{item.price}</p>
                  <p className="text-xs text-red-50/60 mt-1 line-clamp-2">{item.description}</p>
                </div>
              </div>
            ))}

            {featuredTop4.length < 4 && (
              <div className="rounded-xl border border-dashed border-amber-400/30 bg-black/20 p-4 flex flex-col items-center justify-center text-center">
                <Star className="h-6 w-6 text-amber-400/60 mb-2" />
                <p className="text-sm font-bold text-amber-200/80">Need {4 - featuredTop4.length} more handle(s)</p>
                <p className="text-xs text-red-50/50 mt-1">Check "🔥 Top 4 Best of All Time" when adding or editing handles below.</p>
              </div>
            )}
          </div>
        </section>

        {importPreview && (
          <section className="admin-panel p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-300/30 bg-red-950/40 px-4 py-2 text-sm font-black text-red-100">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  Replace warning
                </div>
                <h2 className="text-2xl font-black">Review import: {importPreview.title}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-red-50/65">
                  This preview is not saved yet. If you continue, it will delete the current Firestore list and replace it with this imported list.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="stat-plate">
                    <span>{importPreview.items.length}</span>
                    <p>Import rows</p>
                  </div>
                  <div className="stat-plate">
                    <span>{usernames.length}</span>
                    <p>Current rows</p>
                  </div>
                  <div className="stat-plate">
                    <span>{importPreview.items.filter((item) => item.isSold).length}</span>
                    <p>Sold rows</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Button onClick={handleReplaceFromPreview} disabled={isLoading} className="rounded-full bg-red-600 px-6 font-black hover:bg-red-500">
                  Replace Current List
                </Button>
                <Button onClick={() => setImportPreview(null)} disabled={isLoading} variant="outline" className="rounded-full border-red-300/30 bg-black/30 px-6 text-red-50 hover:bg-red-950/50">
                  Cancel Import
                </Button>
              </div>
            </div>
            <div className="mt-6 grid max-h-80 gap-3 overflow-auto pr-2">
              {importPreview.items.slice(0, 25).map((item, index) => (
                <div key={`${item.username}-${index}`} className="admin-row">
                  <div>
                    <p className="break-words text-lg font-black text-white">{item.username}</p>
                    <p className="mt-1 text-sm text-red-50/55">{item.category} · {item.public === false ? 'Hidden' : 'Public'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-red-100">{item.price}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-red-200/50">{item.priority}</p>
                  </div>
                </div>
              ))}
              {importPreview.items.length > 25 && (
                <div className="rounded-2xl border border-red-400/20 bg-black/30 p-4 text-center text-sm text-red-50/62">
                  Showing first 25 of {importPreview.items.length} usernames.
                </div>
              )}
            </div>
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
          <form onSubmit={handleSave} className="admin-panel p-6">
            <div className="mb-6 flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-red-300" aria-hidden="true" />
              <h2 className="text-2xl font-black">{form.id ? 'Edit username' : 'Add username'}</h2>
            </div>

            <label className="admin-label" htmlFor="username">Username</label>
            <input
              id="username"
              className="admin-input"
              value={form.username}
              onChange={(event) => setForm((current) => ({ ...current, username: stripHandlePrefix(event.target.value) }))}
              placeholder="rarehandle"
              required
            />

            <label className="admin-label" htmlFor="price">Price or SOLD</label>
            <input
              id="price"
              className="admin-input"
              value={form.price}
              onChange={(event) => setForm((current) => ({ ...current, price: stripPricePrefix(event.target.value) }))}
              placeholder="800 or SOLD"
              required
            />

            <label className="admin-label" htmlFor="description">Description</label>
            <textarea
              id="description"
              className="admin-input min-h-24 resize-y"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Full sales description for the card"
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="admin-label" htmlFor="category">Category</label>
                <select
                  id="category"
                  className="admin-input"
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                >
                  {categories.map((category) => <option key={category}>{category}</option>)}
                </select>
              </div>
              <div>
                <label className="admin-label" htmlFor="priority">Priority</label>
                <select
                  id="priority"
                  className="admin-input"
                  value={form.priority}
                  onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as UsernamePriority }))}
                >
                  {priorities.map((priority) => <option key={priority}>{priority}</option>)}
                </select>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ['isBest4', '👑 Top 4 Best of All Time'],
                ['isNew', 'New badge'],
                ['isHot', 'Hot badge'],
                ['isSold', 'Sold'],
                ['public', 'Show publicly'],
              ].map(([key, label]) => (
                <label key={key} className={`admin-check ${key === 'isBest4' ? 'border-amber-400/40 text-amber-200 bg-amber-950/20' : ''}`}>
                  <input
                    type="checkbox"
                    checked={Boolean(form[key as keyof Username])}
                    onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </div>

            {status && <p className="mt-5 rounded-xl border border-red-400/20 bg-red-950/30 p-3 text-sm text-red-50/75">{status}</p>}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button disabled={isSaving} className="h-12 flex-1 rounded-full bg-red-600 font-black hover:bg-red-500">
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                {isSaving ? 'Saving...' : form.id ? 'Update Username' : 'Add Username'}
              </Button>
              {form.id && (
                <Button
                  type="button"
                  onClick={() => setForm(blankUsername)}
                  variant="outline"
                  className="h-12 rounded-full border-red-300/30 bg-black/30 text-red-50 hover:bg-red-950/50"
                >
                  Cancel Edit
                </Button>
              )}
            </div>
          </form>

          <section className="admin-panel p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-black">Loaded usernames</h2>
                <p className="mt-1 text-sm text-red-50/58">{filteredUsernames.length} showing / {usernames.length} total</p>
              </div>
              <input
                className="admin-input sm:max-w-xs"
                placeholder="Search vault..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div className="admin-table">
              {filteredUsernames.map((item) => (
                <div key={item.id || item.username} className={`admin-row ${item.isBest4 ? 'border-amber-400/40 bg-amber-950/15' : ''}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="break-words text-lg font-black text-white">{item.username}</p>
                      {item.isBest4 && <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded-full font-black">TOP 4</span>}
                    </div>
                    <p className="mt-1 text-sm text-red-50/55">{item.category} · {item.public === false ? 'Hidden' : 'Public'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-red-100">{item.price}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-red-200/50">{item.priority}</p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      onClick={() => toggleTop4(item)}
                      variant="outline"
                      className={`rounded-full px-3 text-xs font-bold ${item.isBest4 ? 'border-amber-400 bg-amber-500/20 text-amber-200' : 'border-amber-400/20 bg-black/20 text-amber-400/70 hover:bg-amber-950/40'}`}
                      title={item.isBest4 ? 'Remove from Top 4' : 'Add to Top 4'}
                    >
                      <Crown className="h-3.5 w-3.5 mr-1" />
                      {item.isBest4 ? 'Top 4' : 'Make Top 4'}
                    </Button>
                    <Button type="button" onClick={() => editUsername(item)} className="rounded-full bg-red-600 px-4 font-bold hover:bg-red-500">
                      Edit
                    </Button>
                    <Button
                      type="button"
                      onClick={() => deleteUsername(item)}
                      variant="outline"
                      className="rounded-full border-red-300/30 bg-black/30 px-4 text-red-50 hover:bg-red-950/50"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}

              {!isLoading && filteredUsernames.length === 0 && (
                <div className="rounded-2xl border border-red-400/20 bg-black/30 p-8 text-center text-red-50/62">
                  No usernames loaded yet. Add one or import the legacy list.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
};

export default Admin;
