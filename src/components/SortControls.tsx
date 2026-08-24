
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

type SortOption = 'alphabetical-asc' | 'alphabetical-desc' | 'price-asc' | 'price-desc';

interface SortControlsProps {
  sortOption: SortOption;
  onSortChange: (option: SortOption) => void;
}

const SortControls = ({ sortOption, onSortChange }: SortControlsProps) => {
  const sortOptions = [
    { value: 'alphabetical-asc', label: 'Alphabetical A-Z' },
    { value: 'alphabetical-desc', label: 'Alphabetical Z-A' },
    { value: 'price-asc', label: 'Price Low to High' },
    { value: 'price-desc', label: 'Price High to Low' },
  ];

  return (
    <div className="mb-8 flex justify-center">
      <div className="rounded-2xl border border-red-400/20 bg-black/42 p-4 shadow-[0_0_44px_rgba(127,29,29,0.18)] backdrop-blur">
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <span className="text-sm font-bold uppercase tracking-[0.18em] text-red-100/70">Sort by</span>
          <Select value={sortOption} onValueChange={(value) => onSortChange(value as SortOption)}>
            <SelectTrigger className="min-h-11 w-full border-red-300/25 bg-red-950/25 text-white sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-red-400/25 bg-black/95 text-white">
              {sortOptions.map((option) => (
                <SelectItem 
                  key={option.value} 
                  value={option.value}
                  className="text-white focus:bg-red-950/70 focus:text-white"
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};

export default SortControls;
