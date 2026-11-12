import React, { useState } from 'react';
import type { Username } from '@/types/username';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: Username | null;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  username,
}) => {
  const [email, setEmail] = useState('');
  const [discountCodeInput, setDiscountCodeInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    percent: number;
  } | null>(null);
  const [validatingCode, setValidatingCode] = useState(false);
  const [discountMessage, setDiscountMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !username) return null;

  // Extract base numerical price
  const isSold = username.isSold || username.price === 'SOLD';
  const discountMatch = username.price.match(/\$(\d+(?:\.\d+)?)\s*\((\d+)%\s*off\s*\$(\d+(?:\.\d+)?)\)/);
  const basePriceNum = isSold
    ? 0
    : discountMatch
    ? parseFloat(discountMatch[1])
    : parseFloat(username.price.replace(/[^0-9.]/g, '')) || 0;

  // Compute live discounted total
  let finalPriceNum = basePriceNum;
  if (appliedDiscount && appliedDiscount.percent > 0) {
    finalPriceNum = Math.max(0, basePriceNum * (1 - appliedDiscount.percent / 100));
  }

  const isFreeCheckout = finalPriceNum <= 0;

  const handleApplyDiscount = async () => {
    const code = discountCodeInput.trim().toUpperCase();
    if (!code) return;

    setValidatingCode(true);
    setDiscountMessage(null);

    try {
      // Validate by querying public Firestore doc settings/discounts
      const res = await fetch(
        'https://firestore.googleapis.com/v1/projects/zentirog-market-2026/databases/(default)/documents/settings/discounts'
      );
      if (!res.ok) {
        throw new Error('Could not check promo codes at this time.');
      }
      const data = await res.json();
      const codesList = data.fields?.codes?.arrayValue?.values || [];

      let found: { code: string; percent: number; maxUses: number; usedCount: number } | null = null;
      for (const item of codesList) {
        const map = item.mapValue?.fields || {};
        const codeStr = (map.code?.stringValue || '').toUpperCase();
        const active = map.active?.booleanValue ?? true;
        const maxUses = Number(map.maxUses?.integerValue ?? 0);
        const usedCount = Number(map.usedCount?.integerValue ?? 0);
        const percent = Number(map.discountPercent?.integerValue ?? 0);

        if (codeStr === code && active) {
          found = { code: codeStr, percent, maxUses, usedCount };
          break;
        }
      }

      if (!found) {
        setDiscountMessage({ text: 'Invalid or expired promo code.', isError: true });
        return;
      }

      if (found.maxUses > 0 && found.usedCount >= found.maxUses) {
        setDiscountMessage({ text: 'This promo code has reached its maximum uses.', isError: true });
        return;
      }

      setAppliedDiscount({ code: found.code, percent: found.percent });
      setDiscountMessage({
        text: `Promo applied: ${found.percent}% OFF!`,
        isError: false,
      });
    } catch (err: any) {
      setDiscountMessage({ text: err.message || 'Error validating discount code.', isError: true });
    } finally {
      setValidatingCode(false);
    }
  };

  const handleRemoveDiscount = () => {
    setAppliedDiscount(null);
    setDiscountCodeInput('');
    setDiscountMessage(null);
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please provide a valid delivery email address.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usernameId: username.id,
          username: username.username,
          customerEmail: email.trim(),
          discountCode: appliedDiscount?.code || '',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Checkout process rejected.');
      }

      // If 100% discount, redirect directly to order confirmation page
      if (data.isFreeOrder && data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }

      // Otherwise redirect to Cryptomus payment gateway
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }

      throw new Error('No payment destination URL returned.');
    } catch (err: any) {
      setError(err.message || 'Payment initiation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 font-sans"
    >
      <div className="w-full max-w-md bg-[#101115] border border-[#262830] text-[#eaebee] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#202228] px-5 py-3.5 bg-[#0d0e12]">
          <span className="text-[10px] font-mono tracking-widest uppercase text-[#d4af37]">
            INSTANT CRYPTO ACQUISITION
          </span>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white font-mono text-sm p-1"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Target Identifier Details */}
          <div className="border border-[#202228] bg-[#0c0d10] p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">
                Target Identifier
              </span>
              <div className="font-mono text-lg font-bold text-white">
                {username.username.startsWith('@') ? username.username : `@${username.username}`}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">
                Due Amount
              </span>
              <div className="flex items-baseline justify-end gap-1.5">
                {appliedDiscount && (
                  <span className="font-mono text-xs text-neutral-500 line-through">
                    ${basePriceNum.toFixed(2)}
                  </span>
                )}
                <div className="font-mono text-xl font-extrabold text-[#d4af37]">
                  {isFreeCheckout ? 'FREE' : `$${finalPriceNum.toFixed(2)}`}
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleCheckout} className="space-y-4">
            {/* Delivery Email Input */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-neutral-300 mb-1.5">
                Delivery Email Address *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@domain.com"
                className="w-full bg-[#0a0b0e] border border-[#2c2f3a] focus:border-[#d4af37] px-3.5 py-2.5 text-sm font-mono text-white outline-none transition-colors"
              />
              <p className="mt-1 text-[11px] text-neutral-400">
                Your login credentials will be dispatched automatically to this address once verified.
              </p>
            </div>

            {/* Discount Code Input */}
            <div className="border-t border-[#1d1f26] pt-3">
              <label className="block text-xs font-mono uppercase tracking-wider text-neutral-300 mb-1.5">
                Promo / Discount Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={discountCodeInput}
                  onChange={(e) => setDiscountCodeInput(e.target.value)}
                  placeholder="e.g. VIP100"
                  disabled={Boolean(appliedDiscount)}
                  className="flex-1 bg-[#0a0b0e] border border-[#2c2f3a] focus:border-[#d4af37] px-3 py-2 text-xs font-mono uppercase text-white outline-none transition-colors disabled:opacity-50"
                />
                {appliedDiscount ? (
                  <button
                    type="button"
                    onClick={handleRemoveDiscount}
                    className="px-3 py-2 bg-[#20222a] hover:bg-[#282a34] text-xs font-mono text-neutral-300 border border-[#343844] transition-colors"
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleApplyDiscount}
                    disabled={validatingCode || !discountCodeInput.trim()}
                    className="px-4 py-2 bg-[#181a22] hover:bg-[#222530] text-xs font-mono font-bold uppercase text-[#d4af37] border border-[#363a48] transition-colors disabled:opacity-50"
                  >
                    {validatingCode ? 'Checking...' : 'Apply'}
                  </button>
                )}
              </div>
              {discountMessage && (
                <p
                  className={`mt-1.5 text-xs font-mono ${
                    discountMessage.isError ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {discountMessage.text}
                </p>
              )}
            </div>

            {/* Security Policy Notice */}
            <div className="border border-[#23252d] bg-[#0c0d10] p-3.5 text-[11px] text-neutral-400 space-y-1 leading-relaxed">
              <div className="font-mono text-neutral-300 uppercase tracking-wider text-[10px] font-bold">
                Automated Delivery Terms
              </div>
              <p>
                Credentials format <code className="text-[#d4af37]">mail:pass:token</code>. In case a handle is stored in cold storage, you will receive priority Discord desk fulfillment upon checkout.
              </p>
            </div>

            {error && (
              <div className="p-3 border border-red-500/30 bg-red-950/20 text-red-300 text-xs font-mono">
                {error}
              </div>
            )}

            {/* Submit / Cancel Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-mono uppercase tracking-wider text-neutral-400 hover:text-white border border-[#22242b] bg-[#121318] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 text-xs font-mono uppercase tracking-wider font-bold bg-[#d4af37] hover:bg-[#e2bd45] text-[#090a0d] transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(212,175,55,0.2)]"
              >
                {loading
                  ? 'Processing...'
                  : isFreeCheckout
                  ? 'Claim Free Identifier'
                  : 'Pay with Cryptomus'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
