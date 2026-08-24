
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import UsernameCard from '../components/UsernameCard';
import ParticleEffect from '../components/ParticleEffect';
import LoadingSpinner from '../components/LoadingSpinner';
import SortControls from '../components/SortControls';
import LandingPage from '../components/LandingPage';
import ScrollReveal from '../components/ScrollReveal';
import { TopBestUsernames } from '../components/TopBestUsernames';
import { Button } from '../components/ui/button';
import { Flame, Gem, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { fetchPublishedUsernames } from '@/lib/usernameStore';
import { useDiscordLink } from '@/hooks/useDiscordLink';
import type { Username } from '@/types/username';

type SortOption = 'alphabetical-asc' | 'alphabetical-desc' | 'price-asc' | 'price-desc';
const PAGE_SIZE = 40;

const sortUsernames = (usernames: Username[], sortOption: SortOption): Username[] => {
  return [...usernames].sort((a, b) => {
    // For sold items, sort alphabetically or by username since they don't have numeric prices
    if (a.isSold && b.isSold) {
      switch (sortOption) {
        case 'alphabetical-asc':
        case 'price-asc':
          return a.username.localeCompare(b.username);
        case 'alphabetical-desc':
        case 'price-desc':
          return b.username.localeCompare(a.username);
        default:
          return 0;
      }
    }
    
    // Regular sorting for non-sold items
    switch (sortOption) {
      case 'alphabetical-asc':
        return a.username.localeCompare(b.username);
      case 'alphabetical-desc':
        return b.username.localeCompare(a.username);
      case 'price-asc': {
        if (a.isSold || b.isSold) return a.username.localeCompare(b.username);
        const priceA = parseFloat(a.price.replace('$', ''));
        const priceB = parseFloat(b.price.replace('$', ''));
        return priceA - priceB;
      }
      case 'price-desc': {
        if (a.isSold || b.isSold) return b.username.localeCompare(a.username);
        const priceADesc = parseFloat(a.price.replace('$', ''));
        const priceBDesc = parseFloat(b.price.replace('$', ''));
        return priceBDesc - priceADesc;
      }
      default:
        return 0;
    }
  });
};

const Index = () => {
  const [showLanding, setShowLanding] = useState(true);
  const [progressiveMode, setProgressiveMode] = useState(false);
  const [loadedCount, setLoadedCount] = useState(PAGE_SIZE);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortOption, setSortOption] = useState<SortOption>('price-desc');
  
  const discordLink = useDiscordLink();

  const { data: usernames = [], isLoading, error } = useQuery({
    queryKey: ['usernames'],
    queryFn: fetchPublishedUsernames,
    refetchInterval: 30000,
  });

  const availableUsernames = useMemo(() => usernames.filter(u => !u.isSold), [usernames]);
  const soldUsernames = useMemo(() => usernames.filter(u => u.isSold), [usernames]);

  // Create categories: keep All, New, Hot, length-based (only if present), and Sold
  const hasNewUsernames = availableUsernames.some(u => u.isNew);
  const hasHotUsernames = availableUsernames.some(u => u.isHot);
  const hasSoldUsernames = soldUsernames.length > 0;

  const has3Letter = availableUsernames.some(u => u.category === '3 letter');
  const has4Letter = availableUsernames.some(u => u.category === '4 letter');
  const has3Char = availableUsernames.some(u => u.category === '3 char');
  const hasSemi = availableUsernames.some(u => u.category === 'Semi usernames');
  
  const categories = ['All'] as string[];
  if (hasNewUsernames) categories.push('New');
  if (hasHotUsernames) categories.push('Hot');
  if (has3Letter) categories.push('3 letter');
  if (has4Letter) categories.push('4 letter');
  if (has3Char) categories.push('3 char');
  if (hasSemi) categories.push('Semi usernames');
  if (hasSoldUsernames) categories.push('Sold');
  
  // Filter usernames based on selected category
  let filteredUsernames;
  if (selectedCategory === 'All') {
    filteredUsernames = availableUsernames;
  } else if (selectedCategory === 'New') {
    filteredUsernames = availableUsernames.filter(u => u.isNew);
  } else if (selectedCategory === 'Hot') {
    filteredUsernames = availableUsernames.filter(u => u.isHot);
  } else if (selectedCategory === 'Sold') {
    filteredUsernames = soldUsernames;
  } else if (['3 letter', '4 letter', '3 char', 'Semi usernames'].includes(selectedCategory)) {
    filteredUsernames = availableUsernames.filter(u => u.category === selectedCategory);
  } else {
    filteredUsernames = availableUsernames;
  }

  // Apply sorting
  const sortedUsernames = useMemo(
    () => sortUsernames(filteredUsernames, sortOption),
    [filteredUsernames, sortOption]
  );

  // Progressive loading logic
  const getPriorityOrder = (usernames: Username[]) => {
    const high = usernames.filter(u => u.priority === 'high');
    const mid = usernames.filter(u => u.priority === 'mid');
    const low = usernames.filter(u => u.priority === 'low');
    const none = usernames.filter(u => u.priority === 'none');
    return [...high, ...mid, ...low, ...none];
  };

  const orderedUsernames = useMemo(
    () => (progressiveMode ? getPriorityOrder(sortedUsernames) : sortedUsernames),
    [progressiveMode, sortedUsernames]
  );

  const displayUsernames = progressiveMode
    ? orderedUsernames.slice(0, loadedCount)
    : orderedUsernames;

  const hasMoreToLoad = progressiveMode && loadedCount < orderedUsernames.length;

  useEffect(() => {
    setLoadedCount(progressiveMode ? 7 : PAGE_SIZE);
  }, [selectedCategory, sortOption, progressiveMode]);

  const handleLoadMore = () => {
    setLoadedCount(prev => Math.min(prev + PAGE_SIZE, orderedUsernames.length));
  };

  const handleViewAll = () => {
    setShowLanding(false);
    setProgressiveMode(false);
    setLoadedCount(Number.MAX_SAFE_INTEGER);
  };

  const handleLoadProgressive = () => {
    setShowLanding(false);
    setProgressiveMode(true);
    setLoadedCount(7);
  };

  if (showLanding) {
    return <LandingPage usernames={usernames} onViewAll={handleViewAll} onLoadProgressive={handleLoadProgressive} />;
  }

  if (error) {
    return (
      <div className="dragon-page min-h-screen flex items-center justify-center relative overflow-hidden px-5">
        <ParticleEffect />
        <div className="relative z-10 max-w-xl rounded-2xl border border-red-400/30 bg-black/60 p-8 text-center text-white shadow-[0_0_60px_rgba(220,38,38,0.22)] backdrop-blur">
          <h1 className="text-4xl font-black mb-4">Vault feed is cooling down</h1>
          <p className="text-lg text-red-50/75">
            Firestore is blocking the live stock feed. Publish the latest Firebase rules, then import or add usernames in the admin panel.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="dragon-page min-h-screen relative overflow-hidden text-white">
      <div className="dragon-grid fixed inset-0" />
      <ParticleEffect />
      
      <div className="relative z-10 mx-auto max-w-7xl px-5 py-8 md:px-10 lg:px-14">
        <ScrollReveal className="mb-10 rounded-[2rem] border border-red-500/20 bg-black/35 p-6 shadow-[0_0_80px_rgba(127,29,29,0.24)] backdrop-blur md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-red-400/30 bg-red-950/40 px-4 py-2 text-sm font-bold text-red-100">
                <Gem className="h-4 w-4 text-red-300" aria-hidden="true" />
                Live premium stock
              </div>
              <h1 className="text-4xl font-black leading-tight text-white md:text-6xl">
                Zentirog Username Market
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-red-50/72 md:text-lg">
                Filter the vault by rarity, sort by price, and lock in a clean Discord handle before the next buyer claims it.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="stat-plate">
                <span>{availableUsernames.length}</span>
                <p>Available</p>
              </div>
              <div className="stat-plate">
                <span>{hasHotUsernames ? availableUsernames.filter(u => u.isHot).length : 0}</span>
                <p>Hot</p>
              </div>
              <div className="stat-plate">
                <span>{soldUsernames.length}</span>
                <p>Sold</p>
              </div>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal className="mb-8">
          <div className="flex flex-wrap justify-center gap-3">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`min-h-12 rounded-full border px-5 py-3 text-sm font-bold uppercase tracking-[0.12em] backdrop-blur transition-all duration-300 hover:-translate-y-1 ${
                selectedCategory === category
                  ? 'bg-red-600 border-red-300 text-white shadow-[0_0_32px_rgba(239,68,68,0.42)]'
                  : 'bg-black/35 border-red-400/20 text-red-50/75 hover:border-red-300/60 hover:bg-red-950/45'
              } ${category === 'New' ? 'border-emerald-300/70 text-emerald-100' : ''} ${category === 'Hot' ? 'border-red-300/70 text-red-100' : ''} ${category === 'Sold' ? 'border-zinc-400/50 text-zinc-300' : ''}`}
            >
              {category}
              {category === 'New' && hasNewUsernames && (
                <span className="ml-2 rounded-full bg-emerald-500 px-2 py-1 text-xs text-white">
                  {availableUsernames.filter(u => u.isNew).length}
                </span>
              )}
              {category === 'Hot' && hasHotUsernames && (
                <span className="ml-2 rounded-full bg-red-500 px-2 py-1 text-xs text-white">
                  {availableUsernames.filter(u => u.isHot).length}
                </span>
              )}
              {category === 'Sold' && hasSoldUsernames && (
                <span className="ml-2 rounded-full bg-zinc-600 px-2 py-1 text-xs text-white">
                  {soldUsernames.length}
                </span>
              )}
            </button>
          ))}
          </div>
        </ScrollReveal>

        <SortControls sortOption={sortOption} onSortChange={setSortOption} />

        {isLoading && <LoadingSpinner />}

        {!isLoading && (
          <>
            <div className="grid auto-rows-fr grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {displayUsernames.map((username, index) => (
                <ScrollReveal key={`${username.username}-${index}`} delay={Math.min(index * 35, 280)} className="h-full">
                  <UsernameCard 
                    username={username.username}
                    price={username.price}
                    description={username.description}
                    isNew={username.isNew}
                    isSold={username.isSold}
                    isBest4={username.isBest4}
                    index={index}
                    discordLink={discordLink}
                  />
                </ScrollReveal>
              ))}
            </div>
            
            {hasMoreToLoad && (
              <div className="text-center mt-10">
                <Button 
                  onClick={handleLoadMore}
                  size="lg"
                  className="rounded-full bg-red-600 px-8 py-6 text-white shadow-[0_0_36px_rgba(239,68,68,0.42)] transition hover:-translate-y-1 hover:bg-red-500"
                >
                  Load More Usernames
                </Button>
              </div>
            )}
          </>
        )}

        {!isLoading && displayUsernames.length === 0 && (
          <div className="mx-auto mt-16 max-w-lg rounded-2xl border border-red-400/20 bg-black/40 p-8 text-center text-red-50/75 backdrop-blur">
            <p className="text-xl font-bold text-white">No usernames found in this category</p>
            <p className="mt-2">Try another rarity tier or check the Discord for fresh drops.</p>
          </div>
        )}

        <ScrollReveal className="mt-16">
          <div className="grid gap-4 rounded-[2rem] border border-red-500/20 bg-black/40 p-6 backdrop-blur md:grid-cols-3 md:p-8">
            <div className="flex gap-4">
              <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-red-300" aria-hidden="true" />
              <div>
                <h2 className="font-black text-white">Verified transfer</h2>
                <p className="mt-1 text-sm leading-6 text-red-50/65">Every listed username is checked before it appears in the vault.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <MessageCircle className="mt-1 h-6 w-6 shrink-0 text-red-300" aria-hidden="true" />
              <div>
                <h2 className="font-black text-white">Fast Discord contact</h2>
                <p className="mt-1 text-sm leading-6 text-red-50/65">Customers can ask questions, negotiate bundles, and close quickly.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <Sparkles className="mt-1 h-6 w-6 shrink-0 text-red-300" aria-hidden="true" />
              <div>
                <h2 className="font-black text-white">Rare buyer appeal</h2>
                <p className="mt-1 text-sm leading-6 text-red-50/65">Short handles, hot labels, and discount visibility help premium names stand out.</p>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
};

export default Index;
