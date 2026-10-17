import React, { useState } from 'react';
import type { Username } from '@/types/username';

interface HandleDetailModalProps {
  username: Username | null;
  onClose: () => void;
  discordLink: string;
}

export const HandleDetailModal: React.FC<HandleDetailModalProps> = ({
  username,
  onClose,
  discordLink,
}) => {
  const [copied, setCopied] = useState(false);

  if (!username) return null;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(username.username);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const len = username.username.length;
  const isLettersOnly = /^[a-zA-Z]+$/.test(username.username);
  const isAlphanumeric = /^[a-zA-Z0-9]+$/.test(username.username);
  const hasRepeating = /(.)\1/.test(username.username);

  // Price parsing
  const isSold = username.isSold || username.price === 'SOLD';
  const discountMatch = username.price.match(/\$(\d+(?:\.\d+)?)\s*\((\d+)%\s*off\s*\$(\d+(?:\.\d+)?)\)/);
  const displayPrice = isSold
    ? 'SOLD'
    : discountMatch
    ? `$${discountMatch[1]}`
    : username.price;
  const originalPrice = discountMatch ? `$${discountMatch[3]}` : null;
  const discountPercent = discountMatch ? `${discountMatch[2]}% OFF` : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="handle-detail-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85"
    >
      <div 
        className="w-full max-w-lg bg-[#101115] border border-[#262830] text-[#eaebee] max-h-[92vh] flex flex-col rounded-none"
      >
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-[#262830] px-5 py-3.5 bg-[#0d0e12]">
          <span className="text-[11px] font-mono tracking-widest uppercase text-neutral-400">
            Vault Identifier / Spec Sheet
          </span>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-neutral-400 hover:text-white font-mono p-1 text-sm"
          >
            ✕
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto">
          {/* Main Handle Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-mono tracking-widest uppercase text-[#d4af37] mb-1">
                {username.category || 'General Handle'}
              </div>
              <h2 id="handle-detail-title" className="text-3xl sm:text-4xl font-mono font-bold tracking-tight text-white select-all">
                @{username.username}
              </h2>
            </div>
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 border border-[#2c2f38] bg-[#16171d] hover:bg-[#202229] text-xs font-mono text-neutral-300 transition-colors shrink-0"
            >
              {copied ? 'COPIED' : 'COPY'}
            </button>
          </div>

          {/* Discord Simulation (Real Product Demo) */}
          <div className="border border-[#23252c] bg-[#0c0d10] p-4">
            <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-3">
              Discord Profile Rendering
            </div>
            <div className="flex items-center gap-3 bg-[#16181f] p-3 border border-[#202229]">
              <div className="w-10 h-10 bg-[#252834] border border-[#333745] flex items-center justify-center text-xs font-mono font-bold text-neutral-300">
                {username.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-sans font-bold text-sm text-white truncate">
                    {username.username}
                  </span>
                  <span className="text-[9px] font-mono bg-[#282b37] text-neutral-400 px-1.5 py-0.2 border border-[#373b4b]">
                    HANDLE
                  </span>
                </div>
                <div className="text-xs font-mono text-neutral-400">
                  @{username.username}
                </div>
              </div>
            </div>
          </div>

          {/* Metrics & Rarity Analysis */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-2">
              Identifier Metrics
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="border border-[#20222a] bg-[#0e0f13] p-2.5">
                <div className="text-xs font-mono text-neutral-400">Length</div>
                <div className="text-base font-mono font-bold text-white mt-0.5">{len} chars</div>
              </div>
              <div className="border border-[#20222a] bg-[#0e0f13] p-2.5">
                <div className="text-xs font-mono text-neutral-400">Character Set</div>
                <div className="text-xs font-mono font-bold text-white mt-1 truncate">
                  {isLettersOnly ? 'Letters Only' : isAlphanumeric ? 'Alphanumeric' : 'Special'}
                </div>
              </div>
              <div className="border border-[#20222a] bg-[#0e0f13] p-2.5">
                <div className="text-xs font-mono text-neutral-400">Repeats</div>
                <div className="text-base font-mono font-bold text-white mt-0.5">
                  {hasRepeating ? 'Yes' : 'Clean / Unique'}
                </div>
              </div>
            </div>
          </div>

          {/* Description / Origin Notes */}
          {username.description && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-1">
                Vault Notes
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed font-sans border-l-2 border-[#d4af37] pl-3 py-0.5">
                {username.description}
              </p>
            </div>
          )}

          {/* Acquisition & Safety Protocol */}
          <div className="border border-[#20222a] bg-[#0d0e12] p-3 text-xs text-neutral-400 space-y-1.5 font-sans">
            <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-300">
              Escrow & Claim Protocol
            </div>
            <p>
              1. Tap "Inquire via Discord" to connect with the authorized desk.
            </p>
            <p>
              2. Quote handle <span className="font-mono text-white">@{username.username}</span> to reserve.
            </p>
            <p>
              3. Verified handoff via direct transfer instructions.
            </p>
          </div>
        </div>

        {/* Action Bottom Section */}
        <div className="border-t border-[#262830] p-4 sm:p-5 bg-[#0d0e12] flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">
              {isSold ? 'Status' : 'Direct Price'}
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-mono font-bold ${isSold ? 'text-neutral-500' : 'text-white'}`}>
                {displayPrice}
              </span>
              {originalPrice && (
                <span className="text-xs font-mono line-through text-neutral-500">
                  {originalPrice}
                </span>
              )}
              {discountPercent && (
                <span className="text-[10px] font-mono text-[#d4af37] border border-[#d4af37]/40 px-1">
                  {discountPercent}
                </span>
              )}
            </div>
          </div>

          {isSold ? (
            <button
              disabled
              className="px-6 py-3 bg-[#1b1d24] text-neutral-500 border border-[#2a2d38] font-mono text-xs uppercase tracking-wider cursor-not-allowed"
            >
              Identifier Claimed
            </button>
          ) : (
            <a
              href={discordLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-[#d4af37] hover:bg-[#e2bd45] text-[#090a0d] font-mono font-bold text-xs uppercase tracking-wider transition-colors inline-flex items-center justify-center shrink-0"
            >
              Inquire via Discord
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
