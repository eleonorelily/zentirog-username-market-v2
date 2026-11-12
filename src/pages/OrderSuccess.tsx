import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useDiscordLink } from '@/hooks/useDiscordLink';

const OrderSuccess = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id') || 'ORD-REFERENCE';
  const handle = searchParams.get('handle') || 'Discord Handle';
  const token = searchParams.get('token') || '';
  const discordLink = useDiscordLink();

  const [credentials, setCredentials] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(token));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) return;

    const fetchDetails = async () => {
      try {
        const res = await fetch(`/api/order-details?order_id=${encodeURIComponent(orderId)}&handle=${encodeURIComponent(handle)}&token=${encodeURIComponent(token)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.credentials) {
            setCredentials(data.credentials);
          }
        }
      } catch (err) {
        console.error('Error fetching order details:', err);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchDetails();
  }, [orderId, handle, token]);

  const handleCopyCredentials = () => {
    if (!credentials) return;
    navigator.clipboard.writeText(credentials);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasCredentials = Boolean(credentials && credentials.trim().length > 0);

  return (
    <div className="min-h-screen bg-[#090a0d] text-[#eaebee] flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="max-w-xl w-full bg-[#101115] border border-[#262830] p-6 sm:p-8 space-y-6">
        
        {/* Header */}
        <div className="border-b border-[#202228] pb-4 flex items-start justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono tracking-widest uppercase text-[#d4af37]">
              ORDER FULFILLMENT STATUS
            </span>
            <h1 className="text-2xl font-display font-extrabold text-white mt-1 uppercase tracking-wide">
              Acquisition Confirmed
            </h1>
            <p className="text-xs text-neutral-400 font-mono mt-1">
              Order ID: <span className="text-neutral-200">{orderId}</span>
            </p>
          </div>
          <span className="shrink-0 px-2.5 py-1 text-[10px] font-mono uppercase font-bold tracking-wider text-emerald-400 border border-emerald-500/30 bg-emerald-950/20">
            COMPLETED
          </span>
        </div>

        {/* Target handle */}
        <div className="border border-[#202228] bg-[#0c0d10] p-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">
              Acquired Identifier
            </div>
            <div className="font-mono text-2xl font-bold text-white mt-0.5">
              {handle.startsWith('@') ? handle : `@${handle}`}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">
              Delivery
            </div>
            <div className="text-xs font-mono text-[#d4af37] font-semibold mt-1">
              Dispatched to Email & Below
            </div>
          </div>
        </div>

        {/* Live On-Screen Credentials Card */}
        {isLoading ? (
          <div className="border border-[#2c303c] bg-[#12141c] p-5 text-center text-xs font-mono text-neutral-400">
            Decentralized security handshake in progress...
          </div>
        ) : hasCredentials ? (
          <div className="border border-[#383d4e] bg-[#12141c] p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-[#202228] pb-2.5">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#d4af37]">
                Account Credentials
              </span>
              <button
                onClick={handleCopyCredentials}
                className="px-2.5 py-1 text-[11px] font-mono font-bold uppercase tracking-wider border border-[#d4af37] bg-[#d4af37] hover:bg-[#e2bd45] text-[#090a0d] transition-colors"
              >
                {copied ? 'Copied!' : 'Copy Credentials'}
              </button>
            </div>
            <div className="p-3 border border-[#23252d] bg-[#08090b]">
              <pre className="font-mono text-sm text-white font-semibold whitespace-pre-wrap break-all select-all m-0">
                {credentials}
              </pre>
            </div>
          </div>
        ) : (
          <div className="border border-[#382b18] bg-[#161209] p-4 text-xs text-[#d8cbb1] space-y-2">
            <div className="font-mono font-bold text-[#d4af37] text-[10px] uppercase tracking-wider">
              Cold Storage Vault Notice
            </div>
            <p className="text-[11px] leading-relaxed text-neutral-300">
              This handle was secured in offline cold storage. Please open a ticket on Discord or message owner <strong className="text-white font-mono">@nonconfident</strong> with Order ID <strong className="text-white font-mono">{orderId}</strong> for immediate direct delivery.
            </p>
          </div>
        )}

        {/* Access Instructions Card */}
        <div className="border border-[#2b2d38] bg-[#12141a] p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-[#202228] pb-3">
            <span className="w-2 h-2 rounded-full bg-[#d4af37] animate-pulse" />
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[#d4af37]">
              Account Access & Login Instructions
            </h2>
          </div>

          <div className="space-y-3.5 text-xs text-neutral-300 leading-relaxed font-sans">
            <div>
              <span className="font-mono text-white font-bold block mb-1">
                1. Credential Format Guide
              </span>
              <p className="text-neutral-400 mb-1.5">
                Your credentials are provided in one of the following standard industry formats:
              </p>
              <div className="space-y-1 font-mono text-[11px]">
                <div className="p-2 border border-[#262830] bg-[#08090b] text-[#d4af37]">
                  mail:pass:token
                </div>
                <div className="p-2 border border-[#262830] bg-[#08090b] text-neutral-300">
                  mail:pass:dcpass:token
                </div>
              </div>
            </div>

            <div className="border-t border-[#1e2028] pt-3">
              <span className="font-mono text-white font-bold block mb-1">
                2. Temporary Webmail Inbox (Yopmail Access)
              </span>
              <p className="text-neutral-400">
                If your account credential contains only <code className="text-[#d4af37] bg-black/50 px-1 py-0.5 font-mono">mail:pass</code> and the email domain is <strong className="text-white">@zormail.onl</strong>, <strong className="text-white">@ztmail.vip</strong>, or <strong className="text-white">@1xp.fr</strong>:
              </p>
              <div className="mt-2 p-3 border border-[#2b2a1a] bg-[#19160d] text-[11px] text-[#e0d6be] space-y-1.5">
                <p>
                  1. Go directly to <a href="https://yopmail.com" target="_blank" rel="noopener noreferrer" className="text-[#d4af37] underline font-bold hover:text-white">https://yopmail.com</a>
                </p>
                <p>
                  2. Type the username portion (everything before the @) into the check inbox field.
                </p>
                <p>
                  3. You will immediately access the email inbox with no password needed to view Discord login codes or verification links!
                </p>
              </div>
            </div>

            <div className="border-t border-[#1e2028] pt-3">
              <span className="font-mono text-white font-bold block mb-1">
                3. Discord 48-Hour Security Limit
              </span>
              <p className="text-neutral-400">
                If your newly logged in Discord account shows a temporary restriction or limit for 2 days, <strong className="text-neutral-200">do not worry</strong> — this is an automated standard security protection triggered whenever Discord detects a login from a new device/IP. It automatically clears in 48 hours without any action required.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
          <Link
            to="/"
            className="flex-1 py-3 bg-[#d4af37] hover:bg-[#e2bd45] text-[#090a0d] font-mono font-bold text-xs uppercase tracking-wider text-center transition-colors"
          >
            Return to Market
          </Link>
          <a
            href={discordLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3 border border-[#2b2e38] hover:border-[#3e4252] text-xs font-mono uppercase text-neutral-300 hover:text-white text-center transition-colors bg-[#14161d]"
          >
            Join Discord Desk (@nonconfident)
          </a>
        </div>
      </div>
    </div>
  );
};

export default OrderSuccess;
