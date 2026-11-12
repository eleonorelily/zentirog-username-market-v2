export interface DiscountCode {
  code: string; // e.g. "VIP100" (uppercased)
  discountPercent: number; // e.g. 10, 20, 100
  maxUses: number; // e.g. 5, or 0 for unlimited
  usedCount: number; // how many times applied
  active: boolean;
  createdAt: number;
}
