import React from 'react';

interface NavbarProps {
  totalCount: number;
  availableCount: number;
  discordLink: string;
  onOpenLegal: (tab: 'tos' | 'privacy') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  totalCount,
  availableCount,
  discordLink,
  onOpenLegal,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-[#0a0b0e]/95 border-b border-[#1f2127]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4">
        {/* Brand identity */}
        <div className="flex items-center gap-4">
          <a href="/" className="flex items-center gap-2 group">
            <span className="font-display font-extrabold tracking-[0.25em] text-base sm:text-lg text-white group-hover:text-[#d4af37] transition-colors uppercase">
              Zentirog
            </span>
            <span className="text-[10px] font-mono tracking-widest uppercase border border-[#2b2e38] text-neutral-400 px-1.5 py-0.5 hidden xs:inline-block">
              Vault
            </span>
          </a>

          {/* Quick live status indicator */}
          <div className="hidden md:flex items-center gap-2 pl-4 border-l border-[#1f2127] text-xs font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-neutral-300 font-bold">{availableCount}</span>
            <span className="text-neutral-400">Available</span>
            <span className="text-neutral-600">/</span>
            <span className="text-neutral-400">{totalCount} Indexed</span>
          </div>
        </div>

        {/* Right action group */}
        <div className="flex items-center gap-3 sm:gap-5">
          <div className="flex items-center gap-3 text-xs font-mono text-neutral-400">
            <button
              onClick={() => onOpenLegal('tos')}
              className="hover:text-white transition-colors uppercase tracking-wider hidden sm:inline-block"
            >
              Terms
            </button>
            <button
              onClick={() => onOpenLegal('privacy')}
              className="hover:text-white transition-colors uppercase tracking-wider hidden sm:inline-block"
            >
              Privacy
            </button>
          </div>

          <a
            href={discordLink}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-[#d4af37] hover:bg-[#e2bd45] text-[#090a0d] font-mono font-bold text-xs uppercase tracking-wider transition-colors inline-flex items-center gap-1.5 shrink-0"
          >
            <span>Direct Discord</span>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 17L17 7M17 7H7M17 7V17" />
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
};
