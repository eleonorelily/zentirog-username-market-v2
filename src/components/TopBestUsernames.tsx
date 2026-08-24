import { useState } from 'react';
import { Crown, Sparkles, Trophy, Flame, Check, Copy, MessageCircle, Tag, Lock, BadgeCheck } from 'lucide-react';
import type { Username } from '@/types/username';
import ScrollReveal from './ScrollReveal';

interface TopBestUsernamesProps {
  usernames: Username[];
  discordLink: string;
}

const parsePrice = (priceString: string) => {
  if (priceString === 'SOLD') {
    return { displayPrice: 'SOLD', hasDiscount: false };
  }

  const discountMatch = priceString.match(/\$(\d+(?:\.\d+)?)\s*\((\d+)%\s*off\s*\$(\d+(?:\.\d+)?)\)/);
  if (discountMatch) {
    return {
      displayPrice: `$${discountMatch[1]}`,
      originalPrice: `$${discountMatch[3]}`,
      discountPercent: `${discountMatch[2]}% OFF`,
      hasDiscount: true,
    };
  }

  return { displayPrice: priceString, hasDiscount: false };
};

export const TopBestUsernames = ({ usernames, discordLink }: TopBestUsernamesProps) => {
  const [copiedHandle, setCopiedHandle] = useState<string | null>(null);

  // Filter explicitly marked isBest4 first
  const explicitBest = usernames.filter((u) => u.isBest4 && !u.isSold);
  
  // Fill remaining slots with high-priority or available usernames if < 4
  const existingBestIds = new Set(explicitBest.map((u) => u.id || u.username));
  const remainingAvailable = usernames.filter((u) => !u.isSold && !existingBestIds.has(u.id || u.username));
  
  const featured = [...explicitBest, ...remainingAvailable].slice(0, 4);

  if (featured.length === 0) return null;

  const handleCopy = (handle: string) => {
    navigator.clipboard.writeText(handle);
    setCopiedHandle(handle);
    setTimeout(() => setCopiedHandle(null), 2000);
  };

  return (
    <section className="mb-14 relative z-10">
      <ScrollReveal className="relative rounded-[2.5rem] border border-amber-500/30 bg-gradient-to-b from-amber-950/20 via-black/40 to-black/60 p-6 md:p-10 shadow-[0_0_90px_rgba(245,158,11,0.15)] backdrop-blur overflow-hidden">
        {/* Glow backdrop */}
        <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/10 blur-[120px] rounded-full" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />

        {/* Section Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-amber-500/15 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-4 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              <Trophy className="h-4 w-4 text-amber-400" aria-hidden="true" />
              Hall of Fame
            </div>
            <h2 className="mt-3 text-3xl md:text-5xl font-black text-white tracking-tight flex items-center gap-3">
              4 Best Usernames of All Time
              <Sparkles className="h-7 w-7 text-amber-400 hidden sm:inline-block" aria-hidden="true" />
            </h2>
            <p className="mt-2 text-amber-100/70 text-sm md:text-base max-w-2xl">
              Hand-selected crown jewel handles. Verified ultra-rare stock directly controlled & guaranteed.
            </p>
          </div>
          <div className="shrink-0">
            <span className="inline-flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-950/30 px-4 py-2 text-xs font-bold text-amber-200">
              <Crown className="h-4 w-4 text-amber-400" />
              Curated by Admin
            </span>
          </div>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featured.map((item, index) => {
            const priceInfo = parsePrice(item.price);
            const rank = index + 1;
            const isCopied = copiedHandle === item.username;

            return (
              <div
                key={item.id || `${item.username}-${index}`}
                className="group relative flex flex-col rounded-2xl border border-amber-500/25 bg-gradient-to-b from-amber-950/30 via-black/50 to-red-950/20 p-5 transition-all duration-300 hover:-translate-y-2 hover:border-amber-400/60 hover:shadow-[0_20px_50px_rgba(245,158,11,0.22)]"
              >
                {/* Top Rank Pill & Badge */}
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/20 px-3 py-1 text-xs font-black text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.25)]">
                    <Crown className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
                    #{rank} BEST OF ALL TIME
                  </div>
                  {item.isHot && (
                    <span className="rounded-full border border-red-500/40 bg-red-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase text-red-200">
                      🔥 HOT
                    </span>
                  )}
                </div>

                {/* Username Handle */}
                <div className="mb-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3
                      className="font-black text-2xl text-white tracking-tight break-all group-hover:text-amber-200 transition-colors"
                      title={item.username}
                    >
                      {item.username}
                    </h3>
                    <button
                      onClick={() => handleCopy(item.username)}
                      title="Copy handle"
                      className="shrink-0 p-1.5 rounded-lg border border-amber-400/20 bg-amber-950/40 text-amber-300 hover:bg-amber-500/20 transition"
                    >
                      {isCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-200/60">
                      {item.category || 'Discord Handle'}
                    </span>
                    <BadgeCheck className="h-3.5 w-3.5 text-amber-400" />
                  </div>
                </div>

                {/* Price Display Box */}
                <div className="mb-4 rounded-xl border border-amber-400/15 bg-black/40 p-3.5">
                  {priceInfo.hasDiscount ? (
                    <div>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-3xl font-black text-amber-100">{priceInfo.displayPrice}</span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 text-[10px] font-black text-amber-300">
                          <Tag className="h-3 w-3" />
                          {priceInfo.discountPercent}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-amber-200/50">
                        <span className="line-through">{priceInfo.originalPrice}</span>
                        <span className="ml-1.5 text-[11px]">Special Drop</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-3xl font-black text-amber-100">{priceInfo.displayPrice}</div>
                  )}
                </div>

                {/* Complete Description (Fully Visible!) */}
                <div className="mb-5 flex-1 text-sm leading-relaxed text-amber-50/80 bg-amber-950/10 rounded-xl p-3 border border-amber-500/10">
                  {item.description || 'Exclusive top-tier verified Discord handle ready for immediate transfer.'}
                </div>

                {/* Bottom Action Footer */}
                <div className="mt-auto pt-3 border-t border-amber-500/15 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    Available Now
                  </span>
                  <a
                    href={discordLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-red-600 px-4 py-2 text-xs font-black text-white shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:brightness-110 transition"
                  >
                    <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    Deal
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollReveal>
    </section>
  );
};
