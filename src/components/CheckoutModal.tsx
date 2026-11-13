import React, { useState, useEffect, useRef } from 'react';
import type { Username } from '@/types/username';
import { QRCodeSVG } from 'qrcode.react';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: Username | null;
  discordLink?: string;
}

interface LtcOrderState {
  orderId: string;
  usdAmount: number;
  ltcAmount: number;
  ltcAddress: string;
  qrValue: string;
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

  // LTC Autonomous Gateway State
  const [ltcOrder, setLtcOrder] = useState<LtcOrderState | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [copiedCreds, setCopiedCreds] = useState(false);
  const [unconfirmedDetected, setUnconfirmedDetected] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [deliveredCredentials, setDeliveredCredentials] = useState<string | null>(null);
  const [pollStatusText, setPollStatusText] = useState('Listening to Litecoin network...');

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setLtcOrder(null);
      setPaymentSuccess(false);
      setDeliveredCredentials(null);
      setUnconfirmedDetected(false);
      setError('');
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
  }, [isOpen]);

  // Polling blockchain for incoming payment
  useEffect(() => {
    if (!ltcOrder || paymentSuccess) return;

    const checkPayment = async () => {
      try {
        const res = await fetch('/api/ltc-check-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: ltcOrder.orderId }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.paid) {
            setPaymentSuccess(true);
            setDeliveredCredentials(data.credentials || '');
            if (pollingRef.current) clearInterval(pollingRef.current);
          } else if (data.hasUnconfirmedTx) {
            setUnconfirmedDetected(true);
            setPollStatusText('⚡ Transaction detected on mempool! Confirming transfer...');
          }
        }
      } catch (err) {
        // quiet network poll retry
      }
    };

    // Poll every 5 seconds
    pollingRef.current = setInterval(checkPayment, 5000);
    checkPayment();

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [ltcOrder, paymentSuccess]);

  if (!isOpen || !username) return null;

  // Extract base price
  const isSold = username.isSold || username.price === 'SOLD';
  const discountMatch = username.price.match(/\$(\d+(?:\.\d+)?)\s*\((\d+)%\s*off\s*\$(\d+(?:\.\d+)?)\)/);
  const basePriceNum = isSold
    ? 0
    : discountMatch
    ? parseFloat(discountMatch[1])
    : parseFloat(username.price.replace(/[^0-9.]/g, '')) || 0;

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
      const res = await fetch(
        'https://firestore.googleapis.com/v1/projects/zentirog-market-2026/databases/(default)/documents/settings/discounts'
      );
      if (!res.ok) throw new Error('Could not check promo codes at this time.');
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
      // 100% Free Promo branch uses existing instant redemption endpoint
      if (isFreeCheckout) {
        const response = await fetch('/api/create-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            usernameId: username.id,
            username: username.username,
            amount: '$0.00',
            customerEmail: email.trim(),
            customerDiscord: discordUsername.trim(),
            discountCode: appliedDiscount?.code || '',
          }),
        });
        const data = await response.json();
        if (data.redirectUrl) {
          window.location.href = data.redirectUrl;
          return;
        }
      }

      // Autonomous LTC Order Generation
      const response = await fetch('/api/ltc-create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usernameId: username.id,
          username: username.username,
          clientPrice: basePriceNum,
          customerEmail: email.trim(),
          customerDiscord: discordUsername.trim(),
          discountCode: appliedDiscount?.code || '',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize payment.');
      }

      setLtcOrder({
        orderId: data.orderId,
        usdAmount: data.usdAmount,
        ltcAmount: data.ltcAmount,
        ltcAddress: data.ltcAddress,
        qrValue: data.qrValue,
      });
    } catch (err: any) {
      setError(err.message || 'Order initialization failed.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: 'addr' | 'amt' | 'creds') => {
    navigator.clipboard.writeText(text);
    if (type === 'addr') {
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } else if (type === 'amt') {
      setCopiedAmount(true);
      setTimeout(() => setCopiedAmount(false), 2000);
    } else if (type === 'creds') {
      setCopiedCreds(true);
      setTimeout(() => setCopiedCreds(false), 2000);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 font-sans overflow-y-auto"
    >
      <div className="w-full max-w-lg bg-[#101115] border border-[#262830] text-[#eaebee] flex flex-col my-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#202228] px-5 py-3.5 bg-[#0d0e12]">
          <span className="text-[10px] font-mono tracking-widest uppercase text-[#d4af37] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#d4af37] animate-pulse"></span>
            INSTANT CRYPTO ACQUISITION (LTC)
          </span>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white font-mono text-sm p-1"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* SUCCESS SCREEN */}
          {paymentSuccess ? (
            <div className="space-y-5 text-center py-4">
              <div className="w-14 h-14 bg-[#142617] border border-[#2e7d32] text-[#4ade80] rounded-full mx-auto flex items-center justify-center text-2xl font-bold">
                ✓
              </div>
              <div>
                <h3 className="text-xl font-bold text-white font-mono">PAYMENT CONFIRMED</h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Identifier <strong className="text-[#d4af37]">{username.username}</strong> is now yours!
                </p>
              </div>

              {deliveredCredentials ? (
                <div className="text-left border border-[#d4af37]/50 bg-[#0c0d10] p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase text-[#d4af37] tracking-wider">
                      Account Credentials
                    </span>
                    <button
                      onClick={() => copyToClipboard(deliveredCredentials, 'creds')}
                      className="text-xs font-mono px-2.5 py-1 bg-[#202228] hover:bg-[#2c303c] text-white border border-[#3b3f4e] transition-colors"
                    >
                      {copiedCreds ? 'Copied ✓' : 'Copy Credentials'}
                    </button>
                  </div>
                  <pre className="font-mono text-sm bg-[#050608] border border-[#23252c] p-3 text-white overflow-x-auto whitespace-pre-wrap select-all">
                    {deliveredCredentials}
                  </pre>
                  <p className="text-[11px] text-neutral-400 pt-1">
                    A copy of these credentials and account transfer instructions has also been sent to your email.
                  </p>
                </div>
              ) : (
                <div className="border border-[#282a34] bg-[#0c0d10] p-4 text-left space-y-2">
                  <span className="text-[10px] font-mono uppercase text-[#d4af37] tracking-wider">
                    Cold Storage Ticket
                  </span>
                  <p className="text-xs text-neutral-300">
                    Your payment was verified. Open a ticket on Discord with order ID <code className="text-[#d4af37]">{ltcOrder?.orderId}</code> for immediate release.
                  </p>
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full py-3 bg-[#d4af37] hover:bg-[#b8972e] text-[#090a0d] font-mono font-bold text-xs uppercase tracking-widest transition-colors"
              >
                Done
              </button>
            </div>
          ) : ltcOrder ? (
            /* PAYMENT AWAITING SCREEN */
            <div className="space-y-4">
              <div className="border border-[#202228] bg-[#0c0d10] p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">
                    Target
                  </span>
                  <div className="font-mono text-base font-bold text-white">
                    {username.username.startsWith('@') ? username.username : `@${username.username}`}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">
                    Amount Due
                  </span>
                  <div className="font-mono text-base font-extrabold text-[#d4af37]">
                    ${ltcOrder.usdAmount.toFixed(2)} USD
                  </div>
                </div>
              </div>

              {/* QR and Payment Data */}
              <div className="border border-[#2a2d38] bg-[#0a0b0e] p-4 text-center space-y-3">
                <div className="inline-block p-2.5 bg-white rounded-md mx-auto shadow-lg">
                  <QRCodeSVG value={ltcOrder.qrValue} size={150} level="M" />
                </div>

                <div className="space-y-2 text-left pt-2">
                  {/* LTC Amount */}
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-1">
                      Send Exact Amount (LTC):
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-[#12141a] border border-[#2b2f3c] px-3 py-2 font-mono text-sm text-[#d4af37] font-bold select-all">
                        {ltcOrder.ltcAmount} LTC
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(String(ltcOrder.ltcAmount), 'amt')}
                        className="px-3 py-2 bg-[#1f222c] hover:bg-[#2b2f3e] border border-[#3b3f4f] text-xs font-mono text-white transition-colors"
                      >
                        {copiedAmount ? 'Copied ✓' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  {/* LTC Address */}
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-1">
                      Litecoin Deposit Address:
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-[#12141a] border border-[#2b2f3c] px-3 py-2 font-mono text-xs text-white break-all select-all">
                        {ltcOrder.ltcAddress}
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(ltcOrder.ltcAddress, 'addr')}
                        className="px-3 py-2 bg-[#1f222c] hover:bg-[#2b2f3e] border border-[#3b3f4f] text-xs font-mono text-white transition-colors"
                      >
                        {copiedAddress ? 'Copied ✓' : 'Copy'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="pt-2 border-t border-[#1c1e26] flex items-center justify-center gap-2 text-xs font-mono">
                  <span className={`w-2.5 h-2.5 rounded-full ${unconfirmedDetected ? 'bg-amber-400 animate-ping' : 'bg-[#d4af37] animate-pulse'}`}></span>
                  <span className={unconfirmedDetected ? 'text-amber-400 font-semibold' : 'text-neutral-400'}>
                    {pollStatusText}
                  </span>
                </div>
              </div>

              <div className="text-[11px] font-mono text-neutral-500 text-center">
                Order ID: <code className="text-neutral-400">{ltcOrder.orderId}</code> • Valid for 45 mins
              </div>
            </div>
          ) : (
            /* ORDER FORM SCREEN */
            <>
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
                    Login credentials will be dispatched automatically to this address once transaction is verified.
                  </p>
                </div>

                {/* Optional Discord Username Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-mono uppercase tracking-wider text-neutral-300">
                      Discord Username
                    </label>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
                      Optional
                    </span>
                  </div>
                  <input
                    type="text"
                    value={discordUsername}
                    onChange={(e) => setDiscordUsername(e.target.value)}
                    placeholder="e.g. zentirog or username#0000"
                    className="w-full bg-[#0a0b0e] border border-[#2c2f3a] focus:border-[#d4af37] px-3.5 py-2.5 text-sm font-mono text-white outline-none transition-colors"
                  />
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
                        disabled={validatingCode || !discountCodeInput.trim()}
                        onClick={handleApplyDiscount}
                        className="px-4 py-2 bg-[#1b1d24] hover:bg-[#252832] disabled:opacity-50 text-xs font-mono text-[#d4af37] border border-[#2c303c] transition-colors"
                      >
                        {validatingCode ? 'Checking...' : 'Apply'}
                      </button>
                    )}
                  </div>

                  {discountMessage && (
                    <p
                      className={`mt-1.5 text-xs font-mono ${
                        discountMessage.isError ? 'text-red-400' : 'text-emerald-400'
                      }`}
                    >
                      {discountMessage.text}
                    </p>
                  )}
                </div>

                {error && (
                  <div className="border border-red-900/60 bg-red-950/30 p-3 text-red-300 text-xs font-mono">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-[#d4af37] hover:bg-[#b8972e] disabled:opacity-50 text-[#090a0d] font-mono font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-3.5 h-3.5 border-2 border-[#090a0d] border-t-transparent rounded-full animate-spin"></span>
                      GENERATING SECURE LTC ORDER...
                    </span>
                  ) : isFreeCheckout ? (
                    'CLAIM IDENTIFIER (100% FREE)'
                  ) : (
                    'PAY WITH LITECOIN (0% FEES)'
                  )}
                </button>
              </form>

              {/* Card Notice Option */}
              <div className="border-t border-[#1d1f26] pt-3 text-center">
                <button
                  type="button"
                  onClick={() => setShowCardNotice(!showCardNotice)}
                  className="text-xs font-mono text-neutral-400 hover:text-white underline transition-colors"
                >
                  Prefer paying with Debit / Credit Card?
                </button>

                {showCardNotice && (
                  <div className="mt-3 p-3 bg-[#0d0e12] border border-[#262832] text-left text-xs space-y-2">
                    <p className="text-neutral-300">
                      Card payments are handled securely via ticket escrow on our official Discord server.
                    </p>
                    <a
                      href={discordLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-xs font-mono font-semibold text-[#d4af37] hover:underline"
                    >
                      Join Discord & Open Ticket &rarr;
                    </a>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
