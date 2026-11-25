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
    <div className="space-y-3">
      {/* Search and control bar */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
        {/* Search Input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6e7382]">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by handle, length (e.g. 3L), or category"
            className="w-full h-10 bg-[#0d0f14] border border-[#1c1f26] focus:border-[#3e4352] text-[#f4f4f6] pl-10 pr-12 text-xs font-mono placeholder:text-[#6e7382] focus:outline-none transition-colors rounded-[2px]"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#6e7382] hover:text-[#f4f4f6] font-mono text-[11px] transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Sort Select */}
        <div className="flex items-center">
          <select
            value={sortOption}
            onChange={(e) => onSortChange(e.target.value as SortType)}
            className="w-full md:w-auto h-10 bg-[#0d0f14] border border-[#1c1f26] text-[#b3b7c2] px-3.5 text-xs font-mono focus:border-[#3e4352] focus:outline-none cursor-pointer transition-colors rounded-[2px]"
          >
            <option value="price-desc">Price: high to low</option>
            <option value="price-asc">Price: low to high</option>
            <option value="length-asc">Length: shortest first</option>
            <option value="alpha-asc">Alphabetical: A to Z</option>
            <option value="alpha-desc">Alphabetical: Z to A</option>
          </select>
        </div>

        {/* Stock Toggle & View Mode */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleHideSold}
            className={`flex-1 md:flex-initial h-10 px-3.5 border text-xs font-mono transition-colors rounded-[2px] ${
              hideSold
                ? 'bg-[#171922] border-[#3e4352] text-[#f4f4f6]'
                : 'bg-[#0d0f14] border-[#1c1f26] text-[#8b909e] hover:text-[#f4f4f6] hover:border-[#2b2f3a]'
            }`}
          >
            {hideSold ? 'Available only' : 'All stock'}
          </button>

          <button
            onClick={onViewModeToggle}
            title={viewMode === 'grid' ? 'Switch to dense list view' : 'Switch to card grid'}
            className="w-10 h-10 flex items-center justify-center bg-[#0d0f14] border border-[#1c1f26] hover:border-[#2b2f3a] text-[#8b909e] hover:text-[#f4f4f6] transition-colors rounded-[2px]"
          >
            {viewMode === 'grid' ? (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Category filter strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((cat) => {
          const count = categoryCounts[cat] ?? 0;
          const isSelected = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => onCategorySelect(cat)}
              className={`h-7 px-2.5 border text-xs font-mono whitespace-nowrap transition-colors flex items-center gap-1.5 rounded-[2px] ${
                isSelected
                  ? 'border-[#3e4352] bg-[#161822] text-[#f4f4f6]'
                  : 'border-[#1c1f26] bg-[#0d0f14] text-[#8b909e] hover:border-[#2b2f3a] hover:text-[#f4f4f6]'
              }`}
            >
              <span>{cat}</span>
              {count > 0 && (
                <span className={`text-[10px] tabular-nums ${isSelected ? 'text-[#f4f4f6]' : 'text-[#6e7382]'}`}>
                  [{count}]
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
