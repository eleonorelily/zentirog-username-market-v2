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
    <header className="sticky top-0 z-40 w-full bg-[#07080a]/95 backdrop-blur-md border-b border-[#1c1f26]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4">
        {/* Brand identity */}
        <div className="flex items-center gap-5">
          <a href="/" className="flex items-center gap-2.5 group">
            <span className="font-mono text-sm sm:text-base font-semibold tracking-tight text-[#f4f4f6] group-hover:text-white transition-colors">
              zentirog
            </span>
            <span className="text-[11px] font-mono text-[#6e7382]">
              / vault
            </span>
          </a>

          {/* Swiss live ticker */}
          <div className="hidden md:flex items-center gap-2 pl-4 border-l border-[#1c1f26] text-xs font-mono tabular-nums text-[#8b909e]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/90" />
            <span className="text-[#f4f4f6] font-medium">{availableCount}</span>
            <span>available</span>
            <span className="text-[#3e424e]">/</span>
            <span>{totalCount} indexed</span>
          </div>
        </div>

        {/* Right action group */}
        <div className="flex items-center gap-4 sm:gap-6">
          <nav className="flex items-center gap-4 text-xs font-mono text-[#8b909e]">
            <button
              onClick={() => onOpenLegal('tos')}
              className="hover:text-[#f4f4f6] transition-colors hidden sm:inline-block"
            >
              Terms
            </button>
            <button
              onClick={() => onOpenLegal('privacy')}
              className="hover:text-[#f4f4f6] transition-colors hidden sm:inline-block"
            >
              Privacy
            </button>
          </nav>

          <a
            href={discordLink}
            target="_blank"
            rel="noopener noreferrer"
            className="h-8 px-3.5 bg-[#f4f4f6] hover:bg-white text-[#07080a] font-mono text-xs font-medium tracking-tight transition-colors inline-flex items-center gap-1.5 shrink-0 rounded-[2px]"
          >
            <span>Discord desk</span>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M7 17L17 7M17 7H7M17 7V17" />
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
};
