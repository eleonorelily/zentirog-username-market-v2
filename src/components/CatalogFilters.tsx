import React from 'react';

export type SortType = 'price-asc' | 'price-desc' | 'alpha-asc' | 'alpha-desc' | 'length-asc';

interface CatalogFiltersProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: string;
  onCategorySelect: (cat: string) => void;
  categories: string[];
  sortOption: SortType;
  onSortChange: (sort: SortType) => void;
  viewMode: 'grid' | 'list';
  onViewModeToggle: () => void;
  hideSold: boolean;
  onToggleHideSold: () => void;
  categoryCounts: Record<string, number>;
}

export const CatalogFilters: React.FC<CatalogFiltersProps> = ({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategorySelect,
  categories,
  sortOption,
  onSortChange,
  viewMode,
  onViewModeToggle,
  hideSold,
  onToggleHideSold,
  categoryCounts,
}) => {
  return (
    <div className="space-y-4">
      {/* Top Search & Controls Row */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2.5 sm:gap-3">
        {/* Instant Search input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search handle, prefix, or length (e.g. 3L, rare, vip)..."
            className="w-full bg-[#101115] border border-[#23252c] focus:border-[#d4af37] text-white pl-10 pr-9 py-2.5 sm:py-3 text-sm font-mono placeholder:text-neutral-400 focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-white font-mono text-xs"
            >
              CLEAR
            </button>
          )}
        </div>

        {/* Sort Select */}
        <div className="flex items-center">
          <select
            value={sortOption}
            onChange={(e) => onSortChange(e.target.value as SortType)}
            className="w-full md:w-auto bg-[#101115] border border-[#23252c] text-neutral-200 px-3.5 py-2.5 sm:py-3 text-xs font-mono uppercase tracking-wider focus:border-[#d4af37] focus:outline-none cursor-pointer"
          >
            <option value="price-desc">Price: Highest First</option>
            <option value="price-asc">Price: Lowest First</option>
            <option value="length-asc">Length: Shortest First</option>
            <option value="alpha-asc">Alphabetical: A to Z</option>
            <option value="alpha-desc">Alphabetical: Z to A</option>
          </select>
        </div>

        {/* Action Toggles */}
        <div className="flex items-center gap-2">
          {/* Hide Sold Toggle */}
          <button
            onClick={onToggleHideSold}
            className={`flex-1 md:flex-initial px-3.5 py-2.5 sm:py-3 border text-xs font-mono uppercase tracking-wider transition-colors ${
              hideSold
                ? 'bg-[#181a22] border-[#d4af37] text-white'
                : 'bg-[#101115] border-[#23252c] text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {hideSold ? 'Available Only' : 'Show All Stock'}
          </button>

          {/* Grid/List View Toggle */}
          <button
            onClick={onViewModeToggle}
            title={viewMode === 'grid' ? 'Switch to dense list' : 'Switch to card grid'}
            className="p-2.5 sm:p-3 bg-[#101115] border border-[#23252c] hover:border-[#333742] text-neutral-400 hover:text-white transition-colors"
          >
            {viewMode === 'grid' ? (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Category Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((cat) => {
          const count = categoryCounts[cat] ?? 0;
          const isSelected = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => onCategorySelect(cat)}
              className={`px-3 py-1.5 border text-xs font-mono uppercase tracking-wider whitespace-nowrap transition-colors flex items-center gap-2 ${
                isSelected
                  ? 'border-[#d4af37] bg-[#161820] text-white font-bold'
                  : 'border-[#1f2127] bg-[#0d0e12] text-neutral-400 hover:border-[#2d303a] hover:text-neutral-200'
              }`}
            >
              <span>{cat}</span>
              {count > 0 && (
                <span className={`text-[10px] ${isSelected ? 'text-[#d4af37]' : 'text-neutral-400'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
