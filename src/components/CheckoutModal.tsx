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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !username) return null;

  // Extract clean price
  const isSold = username.isSold || username.price === 'SOLD';
  const discountMatch = username.price.match(/\$(\d+(?:\.\d+)?)\s*\((\d+)%\s*off\s*\$(\d+(?:\.\d+)?)\)/);
  const displayPrice = isSold
    ? 'SOLD'
    : discountMatch
    ? `$${discountMatch[1]}`
    : username.price;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please provide a valid email address to receive your account credentials.');
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
          amount: displayPrice,
          customerEmail: email.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.paymentUrl) {
        throw new Error(data.error || 'Failed to generate crypto invoice.');
      }

      // Redirect customer to Cryptomus payment gateway
      window.location.href = data.paymentUrl;
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
          {/* Item details */}
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
                Price
              </span>
              <div className="font-mono text-xl font-bold text-[#d4af37]">
                {displayPrice}
              </div>
            </div>
          </div>

          <form onSubmit={handleCheckout} className="space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-neutral-300 mb-1.5" htmlFor="delivery-email">
                Delivery Email Address *
              </label>
              <input
                id="delivery-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your-email@example.com"
                className="w-full bg-[#0d0e12] border border-[#23252c] focus:border-[#d4af37] text-white px-3.5 py-2.5 text-sm font-mono focus:outline-none"
              />
              <p className="text-[11px] text-neutral-400 font-sans mt-1.5 leading-relaxed">
                Your Discord account login details and 2FA credentials will be dispatched automatically to this email once on-chain payment is confirmed.
              </p>
            </div>

            {/* Terms notice */}
            <div className="border border-[#2d2518] bg-[#16120b] p-3 text-xs text-[#e4d7c5] space-y-1">
              <span className="font-mono font-bold text-[#d4af37] block text-[10px] uppercase">
                Automatic Delivery Policy
              </span>
              <p className="text-[11px] leading-relaxed">
                You are purchasing full access to a pre-claimed Discord account. Upon receiving credentials, immediately secure the account by changing the email, password, and 2FA.
              </p>
            </div>

            {error && (
              <div className="border border-red-900/40 bg-[#160d0e] p-3 text-xs font-mono text-red-300">
                {error}
              </div>
            )}

            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="w-1/3 py-2.5 border border-[#262830] text-xs font-mono uppercase text-neutral-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || isSold}
                className="w-2/3 py-2.5 bg-[#d4af37] hover:bg-[#e2bd45] text-[#090a0d] font-mono font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {loading ? 'GENERATING INVOICE...' : 'PAY WITH CRYPTOMUS'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
