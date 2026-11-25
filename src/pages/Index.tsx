import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { fetchPublishedUsernames } from '@/lib/usernameStore';
import { isFaceUsername, isPunctuatedUsername } from '@/lib/usernameParser';
import { useDiscordLink } from '@/hooks/useDiscordLink';
import type { Username } from '@/types/username';
import { Navbar } from '@/components/Navbar';
import { CatalogFilters, type SortType } from '@/components/CatalogFilters';
import { UsernameItem } from '@/components/UsernameItem';
import { HandleDetailModal } from '@/components/HandleDetailModal';
import { CheckoutModal } from '@/components/CheckoutModal';
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
  const { platform = 'discord', handle } = useParams<{ platform?: string; handle?: string }>();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortOption, setSortOption] = useState<SortType>('price-desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [hideSold, setHideSold] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Username | null>(null);
  const [checkoutItem, setCheckoutItem] = useState<Username | null>(null);
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<'tos' | 'privacy'>('tos');

  const discordLink = useDiscordLink();

  const { data: usernames = [], isLoading, error } = useQuery({
    queryKey: ['usernames'],
    queryFn: fetchPublishedUsernames,
    staleTime: 60000,
  });

  // Normalize handle from URL param (supports @user or user)
  const cleanUrlHandle = useMemo(() => {
    if (!handle) return '';
    return decodeURIComponent(handle).replace(/^@+/, '').trim().toLowerCase();
  }, [handle]);

  // Synchronize URL handle with selectedItem modal
  useEffect(() => {
    if (!cleanUrlHandle) return;
    if (usernames.length === 0) return;

    const matched = usernames.find(
      u => u.username.replace(/^@+/, '').toLowerCase() === cleanUrlHandle
    );

    if (matched) {
      setSelectedItem(matched);
      document.title = `@${matched.username.replace(/^@+/, '')} — Discord Username | Zentirog`;
    } else if (!isLoading) {
      toast.error(`Identifier @${cleanUrlHandle} not found in current vault.`);
      navigate('/', { replace: true });
    }
  }, [cleanUrlHandle, usernames, isLoading, navigate]);

  const handleSelectItem = (item: Username) => {
    setSelectedItem(item);
    const raw = item.username.replace(/^@+/, '');
    const targetPlatform = platform || 'discord';
    navigate(`/${targetPlatform}/@${raw}`);
  };

  const handleCloseDetailModal = () => {
    setSelectedItem(null);
    document.title = 'Discord Usernames Market — Buy Rare & 3L Handles | Zentirog';
    if (handle) {
      navigate('/', { replace: true });
    }
  };

  const availableUsernames = useMemo(() => usernames.filter(u => !u.isSold), [usernames]);
  const soldUsernames = useMemo(() => usernames.filter(u => u.isSold), [usernames]);

  // Featured specimen for hero product moment
  const featuredItem = useMemo(() => {
    if (availableUsernames.length === 0) return null;
    return availableUsernames.find(u => u.isBest4) || availableUsernames[0];
  }, [availableUsernames]);

  // Dynamic Category extraction
  const categories = useMemo(() => {
    const list = ['All'];
    if (availableUsernames.some(u => u.isNew)) list.push('New Drops');
    if (availableUsernames.some(u => u.isHot)) list.push('High Demand');
    if (availableUsernames.some(u => u.category === '3 letter' || u.username.length === 3)) list.push('3 Letter');
    if (availableUsernames.some(u => (u.category === '4 letter' || u.username.length === 4) && !isFaceUsername(u.username, u.category))) list.push('4 Letter');
    if (availableUsernames.some(u => u.category === '3 char')) list.push('3 Char');
    list.push('Face User');
    list.push('Punctuated User');
    if (availableUsernames.some(u => u.category === 'Semi usernames' && !isFaceUsername(u.username, u.category) && !isPunctuatedUsername(u.username, u.category))) list.push('Semi Handles');
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
      '4 Letter': availableUsernames.filter(u => (u.category === '4 letter' || u.username.length === 4) && !isFaceUsername(u.username, u.category)).length,
      '3 Char': availableUsernames.filter(u => u.category === '3 char').length,
      'Face User': availableUsernames.filter(u => isFaceUsername(u.username, u.category)).length,
      'Punctuated User': availableUsernames.filter(u => isPunctuatedUsername(u.username, u.category)).length,
      'Semi Handles': availableUsernames.filter(u => u.category === 'Semi usernames' && !isFaceUsername(u.username, u.category) && !isPunctuatedUsername(u.username, u.category)).length,
      'Sold Archives': soldUsernames.length,
    };
    return counts;
  }, [usernames, availableUsernames, soldUsernames]);

  // Filtering pipeline
  const filteredUsernames = useMemo(() => {
    let list = usernames;

    if (hideSold) {
      list = list.filter(u => !u.isSold);
    }

    if (selectedCategory === 'New Drops') {
      list = list.filter(u => u.isNew && !u.isSold);
    } else if (selectedCategory === 'High Demand') {
      list = list.filter(u => u.isHot && !u.isSold);
    } else if (selectedCategory === '3 Letter') {
      list = list.filter(u => (u.category === '3 letter' || u.username.length === 3) && !u.isSold);
    } else if (selectedCategory === '4 Letter') {
      list = list.filter(u => (u.category === '4 letter' || u.username.length === 4) && !isFaceUsername(u.username, u.category) && !u.isSold);
    } else if (selectedCategory === '3 Char') {
      list = list.filter(u => u.category === '3 char' && !u.isSold);
    } else if (selectedCategory === 'Face User') {
      list = list.filter(u => isFaceUsername(u.username, u.category) && !u.isSold);
    } else if (selectedCategory === 'Punctuated User') {
      list = list.filter(u => isPunctuatedUsername(u.username, u.category) && !u.isSold);
    } else if (selectedCategory === 'Semi Handles') {
      list = list.filter(u => u.category === 'Semi usernames' && !isFaceUsername(u.username, u.category) && !isPunctuatedUsername(u.username, u.category) && !u.isSold);
    } else if (selectedCategory === 'Sold Archives') {
      list = list.filter(u => u.isSold);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const lengthMatch = q.match(/^(\d+)(?:l|c|char|letter)?$/);
      if (lengthMatch) {
        const targetLen = parseInt(lengthMatch[1], 10);
        list = list.filter(u => u.username.length === targetLen);
      } else {
        list = list.filter(
          u =>
            u.username.toLowerCase().includes(q) ||
            u.description.toLowerCase().includes(q) ||
            u.category.toLowerCase().includes(q) ||
            (q === 'face' && isFaceUsername(u.username, u.category)) ||
            (q === 'punctuated' && isPunctuatedUsername(u.username, u.category))
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
    <div className="min-h-screen bg-[#07080a] text-[#f4f4f6] flex flex-col font-sans">
      {/* Navigation */}
      <Navbar
        totalCount={usernames.length}
        availableCount={availableUsernames.length}
        discordLink={discordLink}
        onOpenLegal={handleOpenLegal}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        {/* Asymmetric Split Hero: Editorial Summary & Live Specimen Moment */}
        <section className="border border-[#1c1f26] bg-[#0d0f14] p-6 sm:p-8 rounded-[2px]">
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8 items-center">
            {/* Left Column: Swiss Editorial Context */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-mono text-[#8b909e]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>[registry / 001] Curated Discord handle vault</span>
              </div>

              <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-[#f4f4f6] leading-tight">
                Rare Discord handles & pre-claimed account vault
              </h1>

              <p className="text-xs sm:text-sm text-[#8b909e] max-w-xl leading-relaxed">
                Direct exchange for verified 3-letter, 4-letter, dictionary words, and punctuation handles. Each identifier is transferred as a secured pre-claimed account with automated escrow handover.
              </p>

              {/* Quiet tabular metrics row */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#1c1f26] text-xs font-mono text-[#8b909e]">
                <div>
                  <div className="text-[11px] text-[#6e7382]">Available</div>
                  <div className="text-base sm:text-lg font-medium text-[#f4f4f6] tabular-nums mt-0.5">
                    {availableUsernames.length}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[#6e7382]">Claimed</div>
                  <div className="text-base sm:text-lg font-medium text-[#8b909e] tabular-nums mt-0.5">
                    {soldUsernames.length}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[#6e7382]">Handoff</div>
                  <div className="text-base sm:text-lg font-medium text-[#f4f4f6] mt-0.5">
                    Escrow
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Hero Product Moment (Verified Specimen Card) */}
            {featuredItem && (
              <div 
                onClick={() => handleSelectItem(featuredItem)}
                className="group border border-[#242834] bg-[#11131a] hover:border-[#3e4456] p-5 cursor-pointer transition-colors duration-150 rounded-[2px]"
              >
                <div className="flex items-center justify-between text-[11px] font-mono text-[#8b909e] pb-3 border-b border-[#1c1f26]">
                  <span>[specimen sheet]</span>
                  <span className="text-emerald-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                    Verified asset
                  </span>
                </div>

                <div className="my-4">
                  <div className="text-xl sm:text-2xl font-mono font-semibold tracking-tight text-[#f4f4f6] group-hover:text-white transition-colors">
                    {featuredItem.username.startsWith('@') ? featuredItem.username : `@${featuredItem.username}`}
                  </div>
                  <p className="text-xs text-[#8b909e] mt-1.5 line-clamp-2">
                    {featuredItem.description || 'Pre-claimed Discord identifier ready for immediate transfer.'}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 py-2.5 border-y border-[#1c1f26] text-[11px] font-mono text-[#8b909e]">
                  <div>
                    <span className="text-[#6e7382] block text-[10px]">Length</span>
                    <span className="text-[#f4f4f6] tabular-nums">{featuredItem.username.length}L</span>
                  </div>
                  <div>
                    <span className="text-[#6e7382] block text-[10px]">Category</span>
                    <span className="text-[#f4f4f6] truncate block">{featuredItem.category || 'General'}</span>
                  </div>
                  <div>
                    <span className="text-[#6e7382] block text-[10px]">Price</span>
                    <span className="text-[#f4f4f6] tabular-nums">{featuredItem.price}</span>
                  </div>
                </div>

                <div className="mt-3.5 flex items-center justify-between text-xs font-mono">
                  <span className="text-[#6e7382]">Inspect specimen</span>
                  <span className="text-[#f4f4f6] group-hover:translate-x-0.5 transition-transform duration-150">
                    View spec sheet →
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Filter and Search Bar */}
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
          <div className="border border-red-900/30 bg-[#140e10] p-6 text-center text-xs font-mono text-red-200 rounded-[2px]">
            Database connection timeout. Please verify internet access or re-open the market.
          </div>
        )}

        {/* Catalog Results */}
        {!isLoading && !error && (
          <>
            {sortedList.length > 0 ? (
              viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
                  {sortedList.map(item => (
                    <UsernameItem
                      key={`${item.username}-${item.id || item.price}`}
                      item={item}
                      viewMode="grid"
                      onSelect={handleSelectItem}
                      onBuy={setCheckoutItem}
                      discordLink={discordLink}
                    />
                  ))}
                </div>
              ) : (
                <div className="border border-[#1c1f26] divide-y divide-[#171920] rounded-[2px] overflow-hidden">
                  {sortedList.map(item => (
                    <UsernameItem
                      key={`${item.username}-${item.id || item.price}`}
                      item={item}
                      viewMode="list"
                      onSelect={handleSelectItem}
                      onBuy={setCheckoutItem}
                      discordLink={discordLink}
                    />
                  ))}
                </div>
              )
            ) : (
              <div className="border border-[#1c1f26] bg-[#0d0f14] p-12 text-center space-y-3 rounded-[2px]">
                <div className="text-xs font-mono text-[#8b909e]">
                  No matching identifiers found
                </div>
                <p className="text-xs text-[#6e7382] max-w-md mx-auto">
                  Try adjusting search parameters, clearing length filters, or contact our Discord desk for unlisted inventory.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('All');
                    setHideSold(false);
                  }}
                  className="h-8 px-4 border border-[#262933] bg-[#12141a] hover:bg-[#181b24] text-xs font-mono text-[#f4f4f6] transition-colors rounded-[2px]"
                >
                  Reset filters
                </button>
              </div>
            )}
          </>
        )}

        {/* Buyer Protection & Escrow Protocol Walkthrough */}
        <section className="border border-[#1c1f26] bg-[#0d0f14] p-6 sm:p-8 rounded-[2px]">
          <div className="max-w-3xl space-y-3">
            <div className="text-xs font-mono text-[#8b909e]">
              [security protocol]
            </div>
            <h2 className="text-lg sm:text-xl font-medium tracking-tight text-[#f4f4f6]">
              Account transfer & security terms
            </h2>
            <div className="pt-3 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans text-[#8b909e]">
              <div className="border-t border-[#1c1f26] pt-3">
                <span className="font-mono text-[#f4f4f6] font-medium block mb-1">[01] Pre-claimed account</span>
                You are purchasing full custody of a Discord account with the target username already claimed on it.
              </div>
              <div className="border-t border-[#1c1f26] pt-3">
                <span className="font-mono text-[#f4f4f6] font-medium block mb-1">[02] Immediate security</span>
                Upon delivery, you must immediately update the email, change the password, and enable two-factor authentication (2FA).
              </div>
              <div className="border-t border-[#1c1f26] pt-3">
                <span className="font-mono text-[#f4f4f6] font-medium block mb-1">[03] Buyer custody</span>
                Once credentials are provided and the transaction completes, full security custody rests on the buyer.
              </div>
            </div>
          </div>
        </section>

        {/* Knowledge Base & FAQs */}
        <section className="border border-[#1c1f26] bg-[#0d0f14] p-6 sm:p-8 space-y-6 rounded-[2px]">
          <div className="max-w-3xl space-y-1">
            <span className="text-xs font-mono text-[#8b909e]">
              [knowledge base]
            </span>
            <h2 className="text-lg sm:text-xl font-medium tracking-tight text-[#f4f4f6]">
              Frequently asked questions
            </h2>
            <p className="text-xs text-[#6e7382]">
              Guidance on acquiring verified Discord handles and account custody.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#8b909e]">
            <div className="border border-[#1c1f26] bg-[#101218] p-4 space-y-2 rounded-[2px]">
              <h3 className="font-mono font-medium text-[#f4f4f6]">
                What is a Discord username exchange?
              </h3>
              <p className="leading-relaxed">
                A curated marketplace where collectors can acquire rare, short (3-letter or 4-letter), clean dictionary words, and vanity Discord handles that are otherwise claimed or unavailable.
              </p>
            </div>

            <div className="border border-[#1c1f26] bg-[#101218] p-4 space-y-2 rounded-[2px]">
              <h3 className="font-mono font-medium text-[#f4f4f6]">
                How does the purchase and transfer work?
              </h3>
              <p className="leading-relaxed">
                Select an available handle to initiate direct crypto checkout or contact our Discord desk. Accounts are transferred directly with pre-claimed credentials, followed by immediate email and 2FA updating.
              </p>
            </div>

            <div className="border border-[#1c1f26] bg-[#101218] p-4 space-y-2 rounded-[2px]">
              <h3 className="font-mono font-medium text-[#f4f4f6]">
                Why collect 3-Letter (3L) or 4-Letter (4L) handles?
              </h3>
              <p className="leading-relaxed">
                Short Discord usernames carry memorability and vanity value across gaming and creator communities. Mathematical combination limits create strict natural scarcity.
              </p>
            </div>

            <div className="border border-[#1c1f26] bg-[#101218] p-4 space-y-2 rounded-[2px]">
              <h3 className="font-mono font-medium text-[#f4f4f6]">
                Is escrow transfer guaranteed?
              </h3>
              <p className="leading-relaxed">
                Yes. Every exchange follows an escrow verification checklist where handle ownership and credentials are validated prior to handoff.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Swiss Minimalist Footer */}
      <footer className="border-t border-[#1c1f26] bg-[#07080a] mt-12 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-[#8b909e]">
          <div className="flex items-center gap-2">
            <span className="text-[#f4f4f6] font-medium">zentirog</span>
            <span className="text-[#3e424e]">/</span>
            <span>registry</span>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={() => handleOpenLegal('tos')}
              className="hover:text-[#f4f4f6] transition-colors"
            >
              Terms of transfer
            </button>
            <button
              onClick={() => handleOpenLegal('privacy')}
              className="hover:text-[#f4f4f6] transition-colors"
            >
              Privacy policy
            </button>
            <a
              href={discordLink}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#f4f4f6] transition-colors"
            >
              Discord desk
            </a>
          </div>
        </div>
      </footer>

      {/* Modal Sheet for Handle Details */}
      <HandleDetailModal
        username={selectedItem}
        onClose={handleCloseDetailModal}
        onOpenCheckout={(item) => setCheckoutItem(item)}
        discordLink={discordLink}
        platform={platform}
      />

      {/* Instant Crypto Checkout Modal */}
      <CheckoutModal
        isOpen={Boolean(checkoutItem)}
        onClose={() => setCheckoutItem(null)}
        username={checkoutItem}
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
