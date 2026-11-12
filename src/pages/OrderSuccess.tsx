import { useSearchParams, Link } from 'react-router-dom';

const OrderSuccess = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id') || 'ORD-REFERENCE';
  const handle = searchParams.get('handle') || 'Discord Handle';

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
              Sent to Your Email
            </div>
          </div>
        </div>

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

        {/* Cold Storage / No credentials note */}
        <div className="border border-[#382b18] bg-[#161209] p-4 text-xs text-[#d8cbb1] space-y-1.5">
          <div className="font-mono font-bold text-[#d4af37] text-[10px] uppercase tracking-wider">
            Cold Storage Inventory Notice
          </div>
          <p className="text-[11px] leading-relaxed text-neutral-300">
            If your email notification mentions that the handle was held in offline cold storage (or if you purchased before credentials were uploaded), please open a ticket on Discord and provide Order ID <strong className="text-white font-mono">{orderId}</strong> for instant transfer.
          </p>
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
            href="https://discord.gg/z36zMpAGPm"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3 border border-[#2b2e38] hover:border-[#3e4252] text-xs font-mono uppercase text-neutral-300 hover:text-white text-center transition-colors bg-[#14161d]"
          >
            Join Discord Desk
          </a>
        </div>
      </div>
    </div>
  );
};

export default OrderSuccess;
