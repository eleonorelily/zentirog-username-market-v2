import React, { useState } from 'react';
import type { Username } from '@/types/username';
import { isFaceUsername, isPunctuatedUsername } from '@/lib/usernameParser';

interface UsernameItemProps {
  item: Username;
  viewMode: 'grid' | 'list';
  onSelect: (item: Username) => void;
  onBuy?: (item: Username) => void;
  discordLink: string;
}

export const UsernameItem: React.FC<UsernameItemProps> = ({
  item,
  viewMode,
  onSelect,
  onBuy,
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
    ? 'Sold'
    : discountMatch
    ? `$${discountMatch[1]}`
    : item.price;
  const originalPrice = discountMatch ? `$${discountMatch[3]}` : null;
  const discountPercent = discountMatch ? `${discountMatch[2]}% off` : null;

  const displayCategory = isFaceUsername(item.username, item.category)
    ? 'Face user'
    : isPunctuatedUsername(item.username, item.category)
    ? 'Punctuated user'
    : item.category || `${item.username.length} char`;

  if (viewMode === 'list') {
    return (
      <div
        onClick={() => onSelect(item)}
        className="group relative flex items-center justify-between p-3.5 sm:p-4 bg-[#0d0f14] hover:bg-[#11131a] border-b border-[#1c1f26] cursor-pointer transition-colors duration-150"
      >
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          <span className="font-mono text-xs text-[#6e7382] w-7 shrink-0 tabular-nums">
            {item.username.length}L
          </span>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`font-mono text-sm sm:text-base font-semibold tracking-tight truncate ${isSold ? 'line-through text-[#6e7382]' : 'text-[#f4f4f6] group-hover:text-white'}`}>
                {item.username.startsWith('@') ? item.username : `@${item.username}`}
              </span>
              {item.isBest4 && (
                <span className="text-[10px] font-mono text-[#a0a3ad] border border-[#2b2f3a] px-1 py-0.2 rounded-[2px] shrink-0">
                  Prime
                </span>
              )}
              {item.isNew && !isSold && (
                <span className="text-[10px] font-mono text-emerald-400 border border-emerald-500/30 px-1 py-0.2 rounded-[2px] shrink-0">
                  New
                </span>
              )}
              {item.isHot && !isSold && (
                <span className="text-[10px] font-mono text-rose-400 border border-rose-500/30 px-1 py-0.2 rounded-[2px] shrink-0">
                  High demand
                </span>
              )}
            </div>
            {item.description && (
              <p className="text-xs text-[#8b909e] truncate max-w-xs sm:max-w-md mt-0.5">
                {item.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-5 shrink-0">
          <div className="text-right">
            <div className={`font-mono text-xs sm:text-sm font-semibold tabular-nums ${isSold ? 'text-[#6e7382]' : 'text-[#f4f4f6]'}`}>
              {displayPrice}
            </div>
            {originalPrice && (
              <div className="text-[10px] font-mono text-[#6e7382] line-through tabular-nums">
                {originalPrice}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {!isSold && onBuy && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onBuy(item);
                }}
                className="h-7 px-3 bg-[#f4f4f6] hover:bg-white text-[#07080a] font-mono text-xs font-medium tracking-tight transition-colors duration-150 rounded-[2px]"
              >
                Buy
              </button>
            )}
            <button
              onClick={handleCopy}
              title="Copy handle"
              className="h-7 w-7 flex items-center justify-center border border-[#1c1f26] bg-[#12141a] hover:bg-[#181b24] text-[#8b909e] hover:text-[#f4f4f6] transition-colors duration-150 rounded-[2px]"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
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
      </div>
    );
  }

  // Grid Card View
  return (
    <div
      onClick={() => onSelect(item)}
      className={`group relative flex flex-col justify-between border bg-[#0d0f14] hover:bg-[#11131a] p-4 sm:p-5 cursor-pointer transition-colors duration-150 rounded-[2px] ${
        isSold
          ? 'border-[#171920] opacity-60'
          : item.isBest4
          ? 'border-[#2e3340] hover:border-[#444a5c]'
          : 'border-[#1c1f26] hover:border-[#2b2f3a]'
      }`}
    >
      {/* Top category row */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-[11px] font-mono text-[#8b909e]">
          [{displayCategory}]
        </span>

        <div className="flex items-center gap-1.5">
          {item.isBest4 && (
            <span className="text-[10px] font-mono border border-[#2b2f3a] text-[#b3b7c2] px-1.5 py-0.5 rounded-[2px]">
              Prime
            </span>
          )}
          {item.isNew && !isSold && (
            <span className="text-[10px] font-mono border border-emerald-500/30 text-emerald-400 px-1.5 py-0.5 rounded-[2px]">
              New
            </span>
          )}
          {item.isHot && !isSold && (
            <span className="text-[10px] font-mono border border-rose-500/30 text-rose-400 px-1.5 py-0.5 rounded-[2px]">
              High demand
            </span>
          )}
          {isSold && (
            <span className="text-[10px] font-mono border border-[#242732] text-[#6e7382] px-1.5 py-0.5 rounded-[2px]">
              Sold
            </span>
          )}
        </div>
      </div>

      {/* Main Handle */}
      <div className="my-2 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className={`font-mono text-lg sm:text-xl font-semibold tracking-tight truncate ${isSold ? 'line-through text-[#6e7382]' : 'text-[#f4f4f6] group-hover:text-white'}`}>
            {item.username.startsWith('@') ? item.username : `@${item.username}`}
          </h3>
          <button
            onClick={handleCopy}
            title="Copy handle"
            className="h-7 w-7 flex items-center justify-center border border-[#1c1f26] bg-[#12141a] hover:bg-[#181b24] text-[#8b909e] hover:text-[#f4f4f6] transition-colors duration-150 shrink-0 rounded-[2px]"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
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
          <p className="text-xs text-[#8b909e] mt-2 line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        ) : (
          <p className="text-xs text-[#6e7382] mt-2">
            Verified identifier in cold escrow.
          </p>
        )}
      </div>

      {/* Price & Action Footer */}
      <div className="pt-3 mt-3 border-t border-[#1c1f26] flex items-center justify-between">
        <div>
          <div className="text-[10px] font-mono text-[#6e7382]">
            {isSold ? 'Status' : 'Price'}
          </div>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className={`font-mono text-base font-semibold tabular-nums ${isSold ? 'text-[#6e7382]' : 'text-[#f4f4f6]'}`}>
              {displayPrice}
            </span>
            {originalPrice && (
              <span className="text-[11px] font-mono line-through text-[#6e7382] tabular-nums">
                {originalPrice}
              </span>
            )}
            {discountPercent && (
              <span className="text-[10px] font-mono text-emerald-400 border border-emerald-500/30 px-1 rounded-[2px] tabular-nums">
                {discountPercent}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isSold ? (
            <button
              disabled
              className="h-8 px-3.5 border border-[#1c1f26] text-[#6e7382] font-mono text-xs cursor-not-allowed rounded-[2px]"
            >
              Claimed
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onBuy) {
                  onBuy(item);
                } else {
                  onSelect(item);
                }
              }}
              className="h-8 px-4 bg-[#f4f4f6] hover:bg-white text-[#07080a] font-mono font-medium text-xs tracking-tight transition-colors duration-150 rounded-[2px]"
            >
              Buy
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
