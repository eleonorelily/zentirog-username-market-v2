import { useState } from 'react';
import { BadgeCheck, Check, Copy, Crown, Flame, Lock, MessageCircle, Tag } from 'lucide-react';
import { useDiscordLink } from '@/hooks/useDiscordLink';

interface UsernameCardProps {
  username: string;
  price: string;
  description: string;
  isNew?: boolean;
  isSold?: boolean;
  isBest4?: boolean;
  index: number;
  discordLink?: string;
}

const UsernameCard = ({
  username,
  price,
  description,
  isNew = false,
  isSold = false,
  isBest4 = false,
  index,
  discordLink,
}: UsernameCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const fallbackLink = useDiscordLink();
  const activeDiscordLink = discordLink || fallbackLink;

  const usernameFontSize =
    username.length > 22 ? '0.78rem' :
    username.length > 18 ? '0.88rem' :
    username.length > 14 ? '1.02rem' :
    username.length > 11 ? '1.18rem' :
    '1.45rem';

  const parsePrice = (priceString: string) => {
    if (priceString === 'SOLD') {
      return { displayPrice: 'SOLD', hasDiscount: false };
    }

    const discountMatch = priceString.match(/\$(\d+(?:\.\d+)?)\s*\((\d+)%\s*off\s*\$(\d+(?:\.\d+)?)\)/);
    
    if (discountMatch) {
      return {
        displayPrice: `$${discountMatch[1]}`,
        originalPrice: `$${discountMatch[3]}`,
        discountPercent: `${discountMatch[2]}% off`,
        hasDiscount: true
      };
    }

    return { displayPrice: priceString, hasDiscount: false };
  };

  const priceInfo = parsePrice(price);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(username);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const formattedDescription = description || 'Verified username ready for a fast Discord transfer.';
  const isLongDescription = formattedDescription.length > 130;

  return (
    <div 
      className="relative group h-full flex flex-col"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ 
        animationDelay: `${index * 0.05}s`,
        zIndex: isHovered ? 30 : 10
      }}
    >
      <div
        className={`
          username-card relative flex-1 min-h-[390px] overflow-hidden rounded-2xl border p-6
          flex flex-col transition-all duration-300 ease-out
          ${isHovered ? '-translate-y-1.5 shadow-[0_20px_50px_rgba(239,68,68,0.3)]' : ''}
          ${isBest4 ? 'border-amber-400/40 bg-gradient-to-b from-amber-950/20 via-black/40 to-black/60 shadow-[0_0_30px_rgba(245,158,11,0.12)]' : ''}
          ${isSold ? 'border-zinc-500/30 opacity-75 bg-black/40' : 'border-red-500/20'}
        `}
      >
        <div className={`absolute inset-x-0 top-0 h-px ${isBest4 ? 'bg-gradient-to-r from-transparent via-amber-400/80 to-transparent' : 'bg-gradient-to-r from-transparent via-red-400/80 to-transparent'}`} />
        
        {/* Header badges */}
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className={`rounded-full border p-2 ${isBest4 ? 'border-amber-400/30 bg-amber-950/40 text-amber-300' : 'border-red-300/20 bg-red-950/40 text-red-200'}`}>
            {isSold ? <Lock className="h-4 w-4" aria-hidden="true" /> : <BadgeCheck className="h-4 w-4" aria-hidden="true" />}
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            {isBest4 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.25)]">
                <Crown className="h-3 w-3 text-amber-300" aria-hidden="true" />
                Best of All Time
              </span>
            )}
            {isNew && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/40 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-100">
                <Flame className="h-3 w-3" aria-hidden="true" />
                New
              </span>
            )}
            {isSold && (
              <span className="rounded-full border border-zinc-300/30 bg-zinc-700/40 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-zinc-200">
                Sold
              </span>
            )}
          </div>
        </div>

        {/* Username section */}
        <div className="mb-4">
          <div className="flex items-center justify-between gap-2">
            <h3
              className={`max-w-full font-black leading-tight tracking-normal transition-colors whitespace-nowrap overflow-hidden text-ellipsis ${
                isSold ? 'text-white/45 line-through' : isBest4 ? 'text-amber-100 group-hover:text-amber-300' : 'text-white group-hover:text-red-100'
              }`}
              style={{ fontSize: usernameFontSize }}
              title={username}
            >
              {username}
            </h3>
            <button
              onClick={handleCopy}
              title="Copy username handle"
              className="shrink-0 p-1.5 rounded-lg border border-red-500/20 bg-red-950/30 text-red-200 hover:bg-red-900/40 transition"
            >
              {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-red-200/60">
            Discord handle
          </p>
        </div>

        {/* Price Box */}
        <div className="mb-4 rounded-xl border border-red-500/15 bg-black/35 p-3.5">
          <div className="space-y-1">
            {priceInfo.hasDiscount ? (
              <>
                <div className="flex items-end justify-between gap-2">
                  <div className="text-3xl font-black leading-none text-red-100 transition-colors">
                    {priceInfo.displayPrice}
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-0.5 text-[11px] font-black text-white">
                    <Tag className="h-3 w-3" aria-hidden="true" />
                    {priceInfo.discountPercent}
                  </span>
                </div>
                <div className="text-xs text-red-50/60">
                  <span className="line-through">{priceInfo.originalPrice}</span>
                  <span className="ml-2">limited drop price</span>
                </div>
              </>
            ) : (
              <div className={`text-3xl font-black leading-none transition-colors ${
                isSold ? 'text-zinc-400' : 'text-red-100'
              }`}>
                {priceInfo.displayPrice}
              </div>
            )}
          </div>
        </div>

        {/* Complete Description Display */}
        <div className="mb-5 flex-1 rounded-xl bg-black/25 p-3 border border-red-500/10">
          <p className={`text-sm leading-relaxed text-red-50/80 transition-all ${
            !isExpanded && isLongDescription ? 'line-clamp-3' : ''
          }`}>
            {formattedDescription}
          </p>
          {isLongDescription && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-1 text-xs font-bold text-red-400 hover:text-red-300 underline"
            >
              {isExpanded ? 'Show less' : 'Read full description'}
            </button>
          )}
        </div>

        {/* Card Footer */}
        <div className="mt-auto flex items-center justify-between gap-3 pt-3 border-t border-red-500/15">
          <span className={`text-[11px] font-bold uppercase tracking-wider ${
            isSold ? 'text-zinc-400' : 'text-emerald-400'
          }`}>
            {isSold ? 'Claimed' : 'Available'}
          </span>
          <a
            href={activeDiscordLink}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black text-white transition hover:-translate-y-0.5 ${
              isBest4 ? 'bg-gradient-to-r from-amber-500 to-red-600 hover:from-amber-400 hover:to-red-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-red-600 hover:bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
            }`}
          >
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
            Deal
          </a>
        </div>

        <div className="pointer-events-none absolute -right-12 -top-16 h-36 w-36 rounded-full bg-red-500/10 blur-3xl transition group-hover:bg-red-400/20" />
      </div>
    </div>
  );
};

export default UsernameCard;
