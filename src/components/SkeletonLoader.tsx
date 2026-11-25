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
      <div className="border border-[#1c1f26] divide-y divide-[#171920] rounded-[2px] overflow-hidden">
        {items.map((_, i) => (
          <div key={i} className="flex items-center justify-between p-4 bg-[#0d0f14]">
            <div className="flex items-center gap-4">
              <div className="w-8 h-4 bg-[#161822] skeleton-shimmer rounded-[2px]" />
              <div className="w-28 h-5 bg-[#161822] skeleton-shimmer rounded-[2px]" />
              <div className="w-12 h-3 bg-[#12141a] skeleton-shimmer hidden sm:block rounded-[2px]" />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-16 h-5 bg-[#161822] skeleton-shimmer rounded-[2px]" />
              <div className="w-16 h-7 bg-[#12141a] skeleton-shimmer rounded-[2px]" />
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
          className="border border-[#1c1f26] bg-[#0d0f14] p-5 flex flex-col justify-between h-[210px] rounded-[2px]"
        >
          <div className="flex justify-between items-start">
            <div className="w-14 h-3 bg-[#161822] skeleton-shimmer rounded-[2px]" />
            <div className="w-8 h-3 bg-[#161822] skeleton-shimmer rounded-[2px]" />
          </div>

          <div className="space-y-2 my-auto">
            <div className="w-32 h-6 bg-[#161822] skeleton-shimmer rounded-[2px]" />
            <div className="w-full h-3 bg-[#12141a] skeleton-shimmer rounded-[2px]" />
          </div>

          <div className="pt-3 border-t border-[#1c1f26] flex items-center justify-between">
            <div className="w-16 h-5 bg-[#161822] skeleton-shimmer rounded-[2px]" />
            <div className="w-14 h-7 bg-[#12141a] skeleton-shimmer rounded-[2px]" />
          </div>
        </div>
      ))}
    </div>
  );
};
