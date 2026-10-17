import React from 'react';

interface SkeletonLoaderProps {
  viewMode?: 'grid' | 'list';
  count?: number;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  viewMode = 'grid',
  count = 8,
}) => {
  const items = Array.from({ length: count });

  if (viewMode === 'list') {
    return (
      <div className="border border-[#262830] divide-y divide-[#1e2026]">
        {items.map((_, i) => (
          <div key={i} className="flex items-center justify-between p-4 bg-[#101115]">
            <div className="flex items-center gap-4">
              <div className="w-8 h-4 bg-[#1b1d24] skeleton-shimmer" />
              <div className="w-28 h-5 bg-[#1b1d24] skeleton-shimmer" />
              <div className="w-12 h-3 bg-[#17181f] skeleton-shimmer hidden sm:block" />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-16 h-5 bg-[#1b1d24] skeleton-shimmer" />
              <div className="w-16 h-8 bg-[#17181f] skeleton-shimmer" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((_, i) => (
        <div
          key={i}
          className="border border-[#262830] bg-[#101115] p-5 flex flex-col justify-between h-[210px]"
        >
          <div className="flex justify-between items-start">
            <div className="w-14 h-3 bg-[#1b1d24] skeleton-shimmer" />
            <div className="w-8 h-3 bg-[#1b1d24] skeleton-shimmer" />
          </div>

          <div className="space-y-2 my-auto">
            <div className="w-32 h-6 bg-[#1b1d24] skeleton-shimmer" />
            <div className="w-full h-3 bg-[#17181f] skeleton-shimmer" />
          </div>

          <div className="pt-3 border-t border-[#1e2026] flex items-center justify-between">
            <div className="w-16 h-5 bg-[#1b1d24] skeleton-shimmer" />
            <div className="w-14 h-7 bg-[#17181f] skeleton-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
};
