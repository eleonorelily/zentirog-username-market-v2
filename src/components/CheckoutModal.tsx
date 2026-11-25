import React, { useState } from 'react';
import type { Username } from '@/types/username';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: Username | null;
  discordLink?: string;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  username,
  discordLink = 'https://discord.gg/5WC6sH2rrj',
}) => {
  const [email, setEmail] = useState('');
  const [discordUsername, setDiscordUsername] = useState('');
  const [discountCodeInput, setDiscountCodeInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    percent: number;
  } | null>(null);
  const [validatingCode, setValidatingCode] = useState(false);
  const [discountMessage, setDiscountMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [showCardNotice, setShowCardNotice] = useState(false);

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
      // Validate promo code via MongoDB-backed API endpoint
      const res = await fetch('/api/admin?action=validate_discount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();

      if (!data.valid) {
        setDiscountMessage({ text: data.reason || 'Invalid or expired promo code.', isError: true });
        return;
      }

      setAppliedDiscount({ code: data.code, percent: data.percent });
      setDiscountMessage({
        text: `Promo applied: ${data.percent}% OFF!`,
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
          amount: `$${basePriceNum.toFixed(2)}`,
          customerEmail: email.trim(),
          customerDiscord: discordUsername.trim(),
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans"
    >
      <div className="w-full max-w-md bg-[#0d0f14] border border-[#1c1f26] text-[#f4f4f6] flex flex-col rounded-[2px]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1c1f26] px-5 py-3.5 bg-[#0a0c10]">
          <span className="text-xs font-mono text-[#8b909e]">
            [checkout] Instant acquisition
          </span>
          <button
            onClick={onClose}
            className="text-[#8b909e] hover:text-[#f4f4f6] font-mono text-sm p-1 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Target Identifier Details */}
          <div className="border border-[#1c1f26] bg-[#090b0f] p-4 flex items-center justify-between rounded-[2px]">
            <div>
              <span className="text-[11px] font-mono text-[#6e7382]">
                Target handle
              </span>
              <div className="font-mono text-base font-semibold text-[#f4f4f6] mt-0.5">
                {username.username.startsWith('@') ? username.username : `@${username.username}`}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-mono text-[#6e7382]">
                Total due
              </span>
              <div className="flex items-baseline justify-end gap-1.5 mt-0.5">
                {appliedDiscount && (
                  <span className="font-mono text-xs text-[#6e7382] line-through tabular-nums">
                    ${basePriceNum.toFixed(2)}
                  </span>
                )}
                <div className="font-mono text-lg font-semibold text-[#f4f4f6] tabular-nums">
                  {isFreeCheckout ? 'Free' : `$${finalPriceNum.toFixed(2)}`}
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleCheckout} className="space-y-4">
            {/* Delivery Email Input */}
            <div>
              <label className="block text-xs font-mono text-[#8b909e] mb-1.5">
                Delivery email address *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@domain.com"
                className="w-full h-10 bg-[#090b0f] border border-[#1c1f26] focus:border-[#3e4352] px-3.5 text-xs font-mono text-[#f4f4f6] placeholder:text-[#6e7382] outline-none transition-colors rounded-[2px]"
              />
              <p className="mt-1 text-[11px] text-[#6e7382]">
                Account credentials will be dispatched automatically upon confirmation.
              </p>
            </div>

            {/* Optional Discord Username Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-mono text-[#8b909e]">
                  Discord username
                </label>
                <span className="text-[11px] font-mono text-[#6e7382]">
                  Optional
                </span>
              </div>
              <input
                type="text"
                value={discordUsername}
                onChange={(e) => setDiscordUsername(e.target.value)}
                placeholder="e.g. zentirog"
                className="w-full h-10 bg-[#090b0f] border border-[#1c1f26] focus:border-[#3e4352] px-3.5 text-xs font-mono text-[#f4f4f6] placeholder:text-[#6e7382] outline-none transition-colors rounded-[2px]"
              />
              <p className="mt-1 text-[11px] text-[#6e7382]">
                Used for buyer verification and support tracking.
              </p>
            </div>

            {/* Discount Code Input */}
            <div className="border-t border-[#1c1f26] pt-3">
              <label className="block text-xs font-mono text-[#8b909e] mb-1.5">
                Promo code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={discountCodeInput}
                  onChange={(e) => setDiscountCodeInput(e.target.value)}
                  placeholder="e.g. VIP10"
                  disabled={Boolean(appliedDiscount)}
                  className="flex-1 h-9 bg-[#090b0f] border border-[#1c1f26] focus:border-[#3e4352] px-3 text-xs font-mono text-[#f4f4f6] placeholder:text-[#6e7382] outline-none transition-colors disabled:opacity-50 rounded-[2px]"
                />
                {appliedDiscount ? (
                  <button
                    type="button"
                    onClick={handleRemoveDiscount}
                    className="h-9 px-3 bg-[#161822] hover:bg-[#1f2230] text-xs font-mono text-[#8b909e] hover:text-[#f4f4f6] border border-[#2b2f3d] transition-colors rounded-[2px]"
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleApplyDiscount}
                    disabled={validatingCode || !discountCodeInput.trim()}
                    className="h-9 px-4 bg-[#14161f] hover:bg-[#1b1e2a] text-xs font-mono text-[#f4f4f6] border border-[#232734] transition-colors disabled:opacity-50 rounded-[2px]"
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

            {/* Payment Method Switch */}
            <div className="border border-[#1c1f26] bg-[#090b0f] p-3 space-y-2 rounded-[2px]">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-[#6e7382]">Payment settlement</span>
                <span className="text-[#8b909e]">Crypto / Card</span>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCardNotice(false)}
                  className={`flex-1 h-8 text-xs font-mono border transition-colors rounded-[2px] ${
                    !showCardNotice
                      ? 'border-[#3e4352] bg-[#161822] text-[#f4f4f6]'
                      : 'border-[#1c1f26] bg-[#0d0f14] text-[#8b909e] hover:text-[#f4f4f6]'
                  }`}
                >
                  Crypto instant
                </button>
                <button
                  type="button"
                  onClick={() => setShowCardNotice(true)}
                  className={`flex-1 h-8 text-xs font-mono border transition-colors rounded-[2px] ${
                    showCardNotice
                      ? 'border-[#3e4352] bg-[#161822] text-[#f4f4f6]'
                      : 'border-[#1c1f26] bg-[#0d0f14] text-[#8b909e] hover:text-[#f4f4f6]'
                  }`}
                >
                  Card desk
                </button>
              </div>

              {showCardNotice && (
                <div className="mt-2.5 p-3.5 border border-[#2b2f3d] bg-[#12141c] space-y-2 rounded-[2px]">
                  <div className="text-xs font-mono text-[#f4f4f6]">
                    Card invoice via Discord desk
                  </div>
                  <p className="text-xs text-[#8b909e] leading-relaxed">
                    Credit and debit card payments are processed securely with buyer invoice protection via our Discord desk.
                  </p>
                  <p className="text-[11px] text-[#6e7382]">
                    Open a ticket or contact <strong className="text-[#f4f4f6] font-mono font-normal">@nonconfident</strong> to acquire <strong className="text-[#f4f4f6] font-mono font-normal">{username.username}</strong> with a card.
                  </p>
                  <a
                    href={discordLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center w-full h-8 bg-[#f4f4f6] hover:bg-white text-[#07080a] font-mono text-xs font-medium tracking-tight transition-colors rounded-[2px]"
                  >
                    Open Discord desk
                  </a>
                </div>
              )}
            </div>

            {/* Delivery Notice */}
            {!showCardNotice && (
              <div className="border border-[#1c1f26] bg-[#090b0f] p-3 text-[11px] text-[#6e7382] space-y-1 rounded-[2px]">
                <div className="font-mono text-[#8b909e] text-[11px]">
                  Automated delivery format
                </div>
                <p>
                  Credentials dispatched as <code className="text-[#b3b7c2]">email:password:token</code> with immediate handoff.
                </p>
              </div>
            )}

            {error && (
              <div className="p-3 border border-red-500/30 bg-red-950/20 text-red-300 text-xs font-mono rounded-[2px]">
                {error}
              </div>
            )}

            {/* Submit / Cancel Buttons */}
            {!showCardNotice && (
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 px-4 text-xs font-mono text-[#8b909e] hover:text-[#f4f4f6] border border-[#1c1f26] bg-[#0f1117] transition-colors rounded-[2px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="h-9 px-5 text-xs font-mono bg-[#f4f4f6] hover:bg-white text-[#07080a] font-medium tracking-tight transition-colors duration-150 disabled:opacity-50 rounded-[2px]"
                >
                  {loading
                    ? 'Processing...'
                    : isFreeCheckout
                    ? 'Claim identifier'
                    : 'Pay with Cryptomus'}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
