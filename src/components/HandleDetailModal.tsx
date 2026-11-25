import React, { useState } from 'react';
import type { Username } from '@/types/username';
import { isFaceUsername, isPunctuatedUsername } from '@/lib/usernameParser';

interface HandleDetailModalProps {
  username: Username | null;
  onClose: () => void;
  onOpenCheckout?: (username: Username) => void;
  discordLink: string;
  platform?: string;
}

export const HandleDetailModal: React.FC<HandleDetailModalProps> = ({
  username,
  onClose,
  onOpenCheckout,
  discordLink,
  platform = 'discord',
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!username) return null;

  const cleanHandle = username.username.replace(/^@+/, '');

  const displayCategory = isFaceUsername(username.username, username.category)
    ? 'Face user'
    : isPunctuatedUsername(username.username, username.category)
    ? 'Punctuated user'
    : username.category || 'General handle';

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(username.username);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    const origin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'https://www.zentirog.com';
    const activePlatform = platform || 'discord';
    const shareUrl = `${origin}/${activePlatform}/@${cleanHandle}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const len = username.username.length;
  const isLettersOnly = /^[a-zA-Z]+$/.test(username.username);
  const isAlphanumeric = /^[a-zA-Z0-9]+$/.test(username.username);
  const hasRepeating = /(.)\1/.test(username.username);

  // Price parsing
  const isSold = username.isSold || username.price === 'SOLD';
  const discountMatch = username.price.match(/\$(\d+(?:\.\d+)?)\s*\((\d+)%\s*off\s*\$(\d+(?:\.\d+)?)\)/);
  const displayPrice = isSold
    ? 'Sold'
    : discountMatch
    ? `$${discountMatch[1]}`
    : username.price;
  const originalPrice = discountMatch ? `$${discountMatch[3]}` : null;
  const discountPercent = discountMatch ? `${discountMatch[2]}% off` : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="handle-detail-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm"
    >
      <div 
        className="w-full max-w-lg bg-[#0d0f14] border border-[#1c1f26] text-[#f4f4f6] max-h-[92vh] flex flex-col rounded-[2px]"
      >
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-[#1c1f26] px-5 py-3.5 bg-[#0a0c10]">
          <span className="text-xs font-mono text-[#8b909e]">
            [specimen] Identifier spec sheet
          </span>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-[#8b909e] hover:text-[#f4f4f6] font-mono p-1 text-sm transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto">
          {/* Main Handle Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-mono text-[#8b909e] mb-1">
                [{displayCategory}]
              </div>
              <h2 id="handle-detail-title" className="text-2xl sm:text-3xl font-mono font-semibold tracking-tight text-[#f4f4f6] select-all">
                {username.username.startsWith('@') ? username.username : `@${username.username}`}
              </h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleCopy}
                title="Copy username"
                className="h-8 px-3 border border-[#1c1f26] bg-[#12141a] hover:bg-[#181b24] text-xs font-mono text-[#8b909e] hover:text-[#f4f4f6] transition-colors rounded-[2px]"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={handleCopyLink}
                title="Copy direct link for posts"
                className="h-8 px-3 border border-[#262a36] bg-[#151822] hover:bg-[#1c202d] text-xs font-mono text-[#b3b7c2] hover:text-white transition-colors rounded-[2px]"
              >
                {copiedLink ? 'Link copied' : 'Share link'}
              </button>
            </div>
          </div>

          {/* Discord Simulation (Product Demo Moment) */}
          <div className="border border-[#1c1f26] bg-[#090b0f] p-4 rounded-[2px]">
            <div className="text-[11px] font-mono text-[#6e7382] mb-2.5">
              Discord profile rendering
            </div>
            <div className="flex items-center gap-3 bg-[#11131a] p-3 border border-[#1c1f26] rounded-[2px]">
              <div className="w-10 h-10 bg-[#1c1f28] border border-[#2b2f3d] flex items-center justify-center text-xs font-mono font-medium text-[#b3b7c2] rounded-[2px]">
                {username.username.replace(/^@+/, '').slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-sans font-medium text-sm text-[#f4f4f6] truncate">
                    {username.username.replace(/^@+/, '')}
                  </span>
                  <span className="text-[10px] font-mono bg-[#1c1f28] text-[#8b909e] px-1.5 py-0.2 border border-[#282c39] rounded-[2px]">
                    Account
                  </span>
                </div>
                <div className="text-xs font-mono text-[#6e7382]">
                  {username.username.startsWith('@') ? username.username : `@${username.username}`}
                </div>
              </div>
            </div>
          </div>

          {/* Identifier Metrics */}
          <div>
            <div className="text-[11px] font-mono text-[#6e7382] mb-2">
              Identifier metrics
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
              <div className="border border-[#1c1f26] bg-[#0f1117] p-2.5 rounded-[2px]">
                <div className="text-[#6e7382]">Length</div>
                <div className="font-medium text-[#f4f4f6] tabular-nums mt-0.5">{len} chars</div>
              </div>
              <div className="border border-[#1c1f26] bg-[#0f1117] p-2.5 rounded-[2px]">
                <div className="text-[#6e7382]">Character set</div>
                <div className="font-medium text-[#f4f4f6] mt-0.5 truncate">
                  {isLettersOnly ? 'Letters only' : isAlphanumeric ? 'Alphanumeric' : 'Special'}
                </div>
              </div>
              <div className="border border-[#1c1f26] bg-[#0f1117] p-2.5 rounded-[2px]">
                <div className="text-[#6e7382]">Structure</div>
                <div className="font-medium text-[#f4f4f6] mt-0.5">
                  {hasRepeating ? 'Repeating' : 'Unique'}
                </div>
              </div>
            </div>
          </div>

          {/* Description / Origin Notes */}
          {username.description && (
            <div>
              <div className="text-[11px] font-mono text-[#6e7382] mb-1">
                Vault notes
              </div>
              <p className="text-xs text-[#8b909e] leading-relaxed border-l border-[#2e3342] pl-3 py-0.5">
                {username.description}
              </p>
            </div>
          )}

          {/* Acquisition & Safety Protocol */}
          <div className="border border-[#1c1f26] bg-[#090b0f] p-3 text-xs text-[#8b909e] space-y-1.5 font-sans rounded-[2px]">
            <div className="font-mono text-[11px] text-[#b3b7c2]">
              Account delivery & custody protocol
            </div>
            <p>
              1. All listings are transferred as pre-claimed Discord accounts with the target username secured.
            </p>
            <p>
              2. Upon delivery, immediately update the email address, change password, and activate 2FA.
            </p>
            <p className="text-[#6e7382] font-mono text-[11px]">
              * Buyer assumes full security custody once credentials are delivered.
            </p>
          </div>
        </div>

        {/* Action Bottom Section */}
        <div className="border-t border-[#1c1f26] p-4 sm:p-5 bg-[#0a0c10] flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-mono text-[#6e7382]">
              {isSold ? 'Status' : 'Direct price'}
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-xl font-mono font-semibold tabular-nums ${isSold ? 'text-[#6e7382]' : 'text-[#f4f4f6]'}`}>
                {displayPrice}
              </span>
              {originalPrice && (
                <span className="text-xs font-mono line-through text-[#6e7382] tabular-nums">
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

          {isSold ? (
            <button
              disabled
              className="h-9 px-5 bg-[#14161f] text-[#6e7382] border border-[#1c1f26] font-mono text-xs cursor-not-allowed rounded-[2px]"
            >
              Claimed
            </button>
          ) : (
            <div className="flex items-center gap-2">
              {onOpenCheckout && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenCheckout(username);
                  }}
                  className="h-9 px-4 bg-[#f4f4f6] hover:bg-white text-[#07080a] font-mono font-medium text-xs tracking-tight transition-colors duration-150 inline-flex items-center justify-center shrink-0 rounded-[2px]"
                >
                  Crypto checkout
                </button>
              )}
              <a
                href={discordLink}
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 px-4 bg-[#14161f] hover:bg-[#1b1e2a] text-[#f4f4f6] border border-[#232734] font-mono text-xs tracking-tight transition-colors duration-150 inline-flex items-center justify-center shrink-0 rounded-[2px]"
              >
                Discord desk
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
