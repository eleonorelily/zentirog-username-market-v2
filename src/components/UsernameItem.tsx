import React, { useState } from 'react';
import type { Username } from '@/types/username';

interface UsernameItemProps {
  item: Username;
  viewMode: 'grid' | 'list';
  onSelect: (item: Username) => void;
  discordLink: string;
}

export const UsernameItem: React.FC<UsernameItemProps> = ({
  item,
  viewMode,
  onSelect,
  discordLink,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.username);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isSold = item.isSold || item.price === 'SOLD';
  const discountMatch = item.price.match(/\$(\d+(?:\.\d+)?)\s*\((\d+)%\s*off\s*\$(\d+(?:\.\d+)?)\)/);
  const displayPrice = isSold
    ? 'SOLD'
    : discountMatch
    ? `$${discountMatch[1]}`
    : item.price;
  const originalPrice = discountMatch ? `$${discountMatch[3]}` : null;
  const discountPercent = discountMatch ? `${discountMatch[2]}%` : null;

  if (viewMode === 'list') {
    return (
      <div
        onClick={() => onSelect(item)}
        className="group relative flex items-center justify-between p-3.5 sm:p-4 bg-[#101115] hover:bg-[#14161c] border-b border-[#1c1e24] cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          <span className="font-mono text-xs text-neutral-400 w-6 shrink-0">
            {item.username.length}L
          </span>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`font-mono text-base sm:text-lg font-bold tracking-tight truncate ${isSold ? 'line-through text-neutral-500' : 'text-white group-hover:text-[#d4af37]'}`}>
                {item.username.startsWith('@') ? item.username : `@${item.username}`}
              </span>
              {item.isBest4 && (
                <span className="text-[9px] font-mono border border-[#d4af37]/60 text-[#d4af37] px-1 py-0.2 uppercase shrink-0">
                  TOP
                </span>
              )}
              {item.isNew && !isSold && (
                <span className="text-[9px] font-mono border border-emerald-500/50 text-emerald-400 px-1 py-0.2 uppercase shrink-0">
                  NEW
                </span>
              )}
              {item.isHot && !isSold && (
                <span className="text-[9px] font-mono border border-rose-500/50 text-rose-400 px-1 py-0.2 uppercase shrink-0">
                  HOT
                </span>
              )}
            </div>
            {item.description && (
              <p className="text-xs text-neutral-400 truncate max-w-xs sm:max-w-md mt-0.5">
                {item.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <div className="text-right">
            <div className={`font-mono text-sm sm:text-base font-bold ${isSold ? 'text-neutral-500' : 'text-white'}`}>
              {displayPrice}
            </div>
            {originalPrice && (
              <div className="text-[10px] font-mono text-neutral-400 line-through">
                {originalPrice}
              </div>
            )}
          </div>

          <button
            onClick={handleCopy}
            title="Copy handle"
            className="p-1.5 border border-[#262830] bg-[#16181f] hover:bg-[#20222a] text-neutral-400 hover:text-white transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {copied ? (
                <polyline points="20 6 9 17 4 12" />
              ) : (
                <>
                  <rect x="9" y="9" width="13" height="13" rx="1" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Grid Card View
  return (
    <div
      onClick={() => onSelect(item)}
      className={`group relative flex flex-col justify-between border bg-[#101115] hover:bg-[#13151b] p-4 sm:p-5 cursor-pointer transition-colors ${
        isSold
          ? 'border-[#1e2026] opacity-60'
          : item.isBest4
          ? 'border-[#d4af37]/40 hover:border-[#d4af37]'
          : 'border-[#22242c] hover:border-[#383c48]'
      }`}
    >
      {/* Top row */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-[10px] font-mono tracking-widest uppercase text-neutral-400">
          {item.category || `${item.username.length} CHAR`}
        </span>

        <div className="flex items-center gap-1.5">
          {item.isBest4 && (
            <span className="text-[9px] font-mono border border-[#d4af37]/60 text-[#d4af37] px-1.5 py-0.5 uppercase tracking-wider">
              PRIME
            </span>
          )}
          {item.isNew && !isSold && (
            <span className="text-[9px] font-mono border border-emerald-500/50 text-emerald-400 px-1 py-0.5 uppercase">
              NEW
            </span>
          )}
          {item.isHot && !isSold && (
            <span className="text-[9px] font-mono border border-rose-500/50 text-rose-400 px-1 py-0.5 uppercase">
              HOT
            </span>
          )}
          {isSold && (
            <span className="text-[9px] font-mono border border-neutral-600 text-neutral-400 px-1 py-0.5 uppercase">
              SOLD
            </span>
          )}
        </div>
      </div>

      {/* Main Handle */}
      <div className="my-3 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className={`font-mono text-xl sm:text-2xl font-bold tracking-tight truncate ${isSold ? 'line-through text-neutral-500' : 'text-white group-hover:text-[#d4af37]'}`}>
            {item.username.startsWith('@') ? item.username : `@${item.username}`}
          </h3>
          <button
            onClick={handleCopy}
            title="Copy handle"
            className="p-1.5 border border-[#262830] bg-[#16181f] hover:bg-[#20222a] text-neutral-400 hover:text-white transition-colors shrink-0"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {copied ? (
                <polyline points="20 6 9 17 4 12" />
              ) : (
                <>
                  <rect x="9" y="9" width="13" height="13" rx="1" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </>
              )}
            </svg>
          </button>
        </div>

        {item.description ? (
          <p className="text-xs text-neutral-400 mt-2 line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        ) : (
          <p className="text-xs text-neutral-400 mt-2">
            Verified Discord identifier.
          </p>
        )}
      </div>

      {/* Price & Action Footer */}
      <div className="pt-3 mt-3 border-t border-[#1c1e24] flex items-center justify-between">
        <div>
          <div className="text-[9px] font-mono uppercase tracking-widest text-neutral-400">
            {isSold ? 'STATUS' : 'PRICE'}
          </div>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className={`font-mono text-lg font-bold ${isSold ? 'text-neutral-500' : 'text-white'}`}>
              {displayPrice}
            </span>
            {originalPrice && (
              <span className="text-[10px] font-mono line-through text-neutral-400">
                {originalPrice}
              </span>
            )}
            {discountPercent && (
              <span className="text-[9px] font-mono text-[#d4af37] border border-[#d4af37]/40 px-0.5">
                -{discountPercent}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect(item);
          }}
          className={`px-3 py-1.5 border text-xs font-mono uppercase tracking-wider transition-colors ${
            isSold
              ? 'border-[#262830] text-neutral-500 bg-transparent'
              : 'border-[#333742] bg-[#161820] hover:bg-[#20232c] text-neutral-200 hover:text-white'
          }`}
        >
          Inspect
        </button>
      </div>
    </div>
  );
};
