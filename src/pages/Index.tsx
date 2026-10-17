import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPublishedUsernames } from '@/lib/usernameStore';
import { useDiscordLink } from '@/hooks/useDiscordLink';
import type { Username } from '@/types/username';
import { Navbar } from '@/components/Navbar';
import { CatalogFilters, type SortType } from '@/components/CatalogFilters';
import { UsernameItem } from '@/components/UsernameItem';
import { HandleDetailModal } from '@/components/HandleDetailModal';
import { LegalModal } from '@/components/LegalModal';
import { SkeletonLoader } from '@/components/SkeletonLoader';

const sortUsernames = (usernames: Username[], sortOption: SortType): Username[] => {
  return [...usernames].sort((a, b) => {
    // If both sold, maintain alphabetical
    if (a.isSold && b.isSold) {
      return a.username.localeCompare(b.username);
    }
    // Prioritize non-sold over sold
    if (a.isSold !== b.isSold) {
      return a.isSold ? 1 : -1;
    }

    switch (sortOption) {
      case 'alpha-asc':
        return a.username.localeCompare(b.username);
      case 'alpha-desc':
        return b.username.localeCompare(a.username);
      case 'length-asc':
        return a.username.length - b.username.length || a.username.localeCompare(b.username);
      case 'price-asc': {
        const pA = parseFloat(a.price.replace(/[^0-9.]/g, '')) || 0;
        const pB = parseFloat(b.price.replace(/[^0-9.]/g, '')) || 0;
        return pA - pB;
      }
      case 'price-desc': {
        const pADesc = parseFloat(a.price.replace(/[^0-9.]/g, '')) || 0;
        const pBDesc = parseFloat(b.price.replace(/[^0-9.]/g, '')) || 0;
        return pBDesc - pADesc;
      }
      default:
        return 0;
    }
  });
};

const Index = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortOption, setSortOption] = useState<SortType>('price-desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [hideSold, setHideSold] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Username | null>(null);
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<'tos' | 'privacy'>('tos');

  const discordLink = useDiscordLink();

  const { data: usernames = [], isLoading, error } = useQuery({
    queryKey: ['usernames'],
    queryFn: fetchPublishedUsernames,
    refetchInterval: 30000,
  });

  const availableUsernames = useMemo(() => usernames.filter(u => !u.isSold), [usernames]);
  const soldUsernames = useMemo(() => usernames.filter(u => u.isSold), [usernames]);

  // Dynamic Category extraction
  const categories = useMemo(() => {
    const list = ['All'];
    if (availableUsernames.some(u => u.isNew)) list.push('New Drops');
    if (availableUsernames.some(u => u.isHot)) list.push('High Demand');
    if (availableUsernames.some(u => u.category === '3 letter' || u.username.length === 3)) list.push('3 Letter');
    if (availableUsernames.some(u => u.category === '4 letter' || u.username.length === 4)) list.push('4 Letter');
    if (availableUsernames.some(u => u.category === '3 char')) list.push('3 Char');
    if (availableUsernames.some(u => u.category === 'Semi usernames')) list.push('Semi Handles');
    if (soldUsernames.length > 0) list.push('Sold Archives');
    return list;
  }, [availableUsernames, soldUsernames]);

  // Counts for filters
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      All: usernames.length,
      'New Drops': availableUsernames.filter(u => u.isNew).length,
      'High Demand': availableUsernames.filter(u => u.isHot).length,
      '3 Letter': availableUsernames.filter(u => u.category === '3 letter' || u.username.length === 3).length,
      '4 Letter': availableUsernames.filter(u => u.category === '4 letter' || u.username.length === 4).length,
      '3 Char': availableUsernames.filter(u => u.category === '3 char').length,
      'Semi Handles': availableUsernames.filter(u => u.category === 'Semi usernames').length,
      'Sold Archives': soldUsernames.length,
    };
    return counts;
  }, [usernames, availableUsernames, soldUsernames]);

  // Filtering pipeline
  const filteredUsernames = useMemo(() => {
    let list = usernames;

    // Hide sold if toggled
    if (hideSold) {
      list = list.filter(u => !u.isSold);
    }

    // Category filter
    if (selectedCategory === 'New Drops') {
      list = list.filter(u => u.isNew && !u.isSold);
    } else if (selectedCategory === 'High Demand') {
      list = list.filter(u => u.isHot && !u.isSold);
    } else if (selectedCategory === '3 Letter') {
      list = list.filter(u => (u.category === '3 letter' || u.username.length === 3) && !u.isSold);
    } else if (selectedCategory === '4 Letter') {
      list = list.filter(u => (u.category === '4 letter' || u.username.length === 4) && !u.isSold);
    } else if (selectedCategory === '3 Char') {
      list = list.filter(u => u.category === '3 char' && !u.isSold);
    } else if (selectedCategory === 'Semi Handles') {
      list = list.filter(u => u.category === 'Semi usernames' && !u.isSold);
    } else if (selectedCategory === 'Sold Archives') {
      list = list.filter(u => u.isSold);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      // Special length query: e.g. "3l" or "4c"
      const lengthMatch = q.match(/^(\d+)(?:l|c|char|letter)?$/);
      if (lengthMatch) {
        const targetLen = parseInt(lengthMatch[1], 10);
        list = list.filter(u => u.username.length === targetLen);
      } else {
        list = list.filter(
          u =>
            u.username.toLowerCase().includes(q) ||
            u.description.toLowerCase().includes(q) ||
            u.category.toLowerCase().includes(q)
        );
      }
    }

    return list;
  }, [usernames, hideSold, selectedCategory, searchQuery]);

  const sortedList = useMemo(() => {
    return sortUsernames(filteredUsernames, sortOption);
  }, [filteredUsernames, sortOption]);

  const handleOpenLegal = (tab: 'tos' | 'privacy') => {
    setLegalTab(tab);
    setLegalModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#090a0d] text-[#eaebee] flex flex-col font-sans">
      {/* Navigation */}
      <Navbar
        totalCount={usernames.length}
        availableCount={availableUsernames.length}
        discordLink={discordLink}
        onOpenLegal={handleOpenLegal}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        {/* Marketplace Banner / Value Overview */}
        <div className="border border-[#1f2127] bg-[#0d0e12] p-5 sm:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 items-end">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-none bg-[#d4af37]" />
                <span className="text-[11px] font-mono tracking-widest uppercase text-neutral-400">
                  Verified Identifier Repository
                </span>
              </div>
              <h1 className="font-display text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white uppercase leading-[1.05]">
                Rare Username Market
              </h1>
              <p className="mt-3 text-xs sm:text-sm text-neutral-400 max-w-2xl leading-relaxed">
                Curated portfolio of original, 3-letter, 4-letter, and high-reputation Discord identifiers. All handoffs are conducted through direct, verified escrow protocols.
              </p>
            </div>

            {/* Live Metrics Shelf */}
            <div className="grid grid-cols-3 gap-2 border-t lg:border-t-0 lg:border-l border-[#1f2127] pt-4 lg:pt-0 lg:pl-6 text-center">
              <div className="p-2 sm:p-3 bg-[#111216] border border-[#1a1c22]">
                <div className="text-[10px] font-mono uppercase text-neutral-400">Available</div>
                <div className="text-xl sm:text-2xl font-mono font-bold text-white mt-1">
                  {availableUsernames.length}
                </div>
              </div>
              <div className="p-2 sm:p-3 bg-[#111216] border border-[#1a1c22]">
                <div className="text-[10px] font-mono uppercase text-neutral-400">Claimed</div>
                <div className="text-xl sm:text-2xl font-mono font-bold text-neutral-300 mt-1">
                  {soldUsernames.length}
                </div>
              </div>
              <div className="p-2 sm:p-3 bg-[#111216] border border-[#1a1c22]">
                <div className="text-[10px] font-mono uppercase text-neutral-400">Transfer</div>
                <div className="text-xs sm:text-sm font-mono font-bold text-[#d4af37] mt-2">
                  ESCROW
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <CatalogFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCategory={selectedCategory}
          onCategorySelect={setSelectedCategory}
          categories={categories}
          sortOption={sortOption}
          onSortChange={setSortOption}
          viewMode={viewMode}
          onViewModeToggle={() => setViewMode(prev => prev === 'grid' ? 'list' : 'grid')}
          hideSold={hideSold}
          onToggleHideSold={() => setHideSold(prev => !prev)}
          categoryCounts={categoryCounts}
        />

        {/* Loading State */}
        {isLoading && <SkeletonLoader viewMode={viewMode} count={8} />}

        {/* Error Fallback */}
        {error && (
          <div className="border border-red-900/40 bg-[#140e10] p-6 text-center text-sm font-mono text-red-200">
            Database connection timeout. Please verify internet access or re-open the market.
          </div>
        )}

        {/* Catalog Results */}
        {!isLoading && !error && (
          <>
            {sortedList.length > 0 ? (
              viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {sortedList.map(item => (
                    <UsernameItem
                      key={`${item.username}-${item.id || item.price}`}
                      item={item}
                      viewMode="grid"
                      onSelect={setSelectedItem}
                      discordLink={discordLink}
                    />
                  ))}
                </div>
              ) : (
                <div className="border border-[#20222a] divide-y divide-[#181a20]">
                  {sortedList.map(item => (
                    <UsernameItem
                      key={`${item.username}-${item.id || item.price}`}
                      item={item}
                      viewMode="list"
                      onSelect={setSelectedItem}
                      discordLink={discordLink}
                    />
                  ))}
                </div>
              )
            ) : (
              <div className="border border-[#20222a] bg-[#0e0f13] p-12 text-center space-y-3">
                <div className="text-xs font-mono tracking-widest uppercase text-neutral-400">
                  No Matching Identifiers Found
                </div>
                <p className="text-sm text-neutral-400 max-w-md mx-auto">
                  Try adjusting search parameters, clearing length filters, or check the Discord server for private unlisted inventory.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('All');
                    setHideSold(false);
                  }}
                  className="px-4 py-2 border border-[#2c2f38] bg-[#16171d] hover:bg-[#202229] text-xs font-mono uppercase text-white transition-colors"
                >
                  Reset Catalog Filters
                </button>
              </div>
            )}
          </>
        )}

        {/* Buyer Protection & Escrow Protocol Walkthrough */}
        <div className="border border-[#1f2127] bg-[#0c0d10] p-6 sm:p-8">
          <div className="max-w-3xl">
            <div className="text-[10px] font-mono tracking-widest uppercase text-[#d4af37] mb-2">
              Buyer Policy & Security Terms
            </div>
            <h2 className="text-lg sm:text-xl font-display font-bold uppercase tracking-wider text-white">
              Account Transfer & Security Policy
            </h2>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans text-neutral-400">
              <div className="border-t border-[#1f2127] pt-3">
                <span className="font-mono text-neutral-300 font-bold block mb-1">01 / Pre-Claimed Account</span>
                You are purchasing full access to a Discord account with the target username already claimed on it.
              </div>
              <div className="border-t border-[#1f2127] pt-3">
                <span className="font-mono text-[#d4af37] font-bold block mb-1">02 / Secure Immediately</span>
                Upon delivery, you must immediately change the email, password, and enable 2-Factor Authentication (2FA).
              </div>
              <div className="border-t border-[#1f2127] pt-3">
                <span className="font-mono text-neutral-300 font-bold block mb-1">03 / Buyer Responsibility</span>
                Once credentials are provided and sale is completed, all security and liability rests on the buyer.
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Luxury Minimal Footer */}
      <footer className="border-t border-[#1a1c22] bg-[#08090b] mt-12 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-neutral-400">
          <div className="flex items-center gap-3">
            <span className="text-white font-bold tracking-widest uppercase">ZENTIROG</span>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={() => handleOpenLegal('tos')}
              className="hover:text-neutral-200 transition-colors uppercase"
            >
              Terms of Transfer
            </button>
            <button
              onClick={() => handleOpenLegal('privacy')}
              className="hover:text-neutral-200 transition-colors uppercase"
            >
              Privacy Policy
            </button>
            <a
              href={discordLink}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-neutral-200 transition-colors uppercase"
            >
              Discord Inquiries
            </a>
          </div>
        </div>
      </footer>

      {/* Modal Sheet for Handle Details */}
      <HandleDetailModal
        username={selectedItem}
        onClose={() => setSelectedItem(null)}
        discordLink={discordLink}
      />

      {/* Modal for Terms & Privacy */}
      <LegalModal
        isOpen={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        defaultTab={legalTab}
      />
    </div>
  );
};

export default Index;
