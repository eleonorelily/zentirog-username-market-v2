import { useSearchParams } from 'react-router-dom';

const OrderSuccess = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id') || 'N/A';
  const handle = searchParams.get('handle') || 'Discord Handle';

  return (
    <div className="min-h-screen bg-[#090a0d] text-[#eaebee] flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-[#101115] border border-[#262830] p-6 sm:p-8 space-y-6">
        <div className="border-b border-[#202228] pb-4">
          <span className="text-[10px] font-mono tracking-widest uppercase text-[#d4af37]">
            PAYMENT SUBMITTED
          </span>
          <h1 className="text-2xl font-display font-extrabold text-white mt-1 uppercase">
            Order Complete
          </h1>
          <p className="text-xs text-neutral-400 font-mono mt-1">
            Order Reference: {orderId}
          </p>
        </div>

        <div className="border border-[#202228] bg-[#0c0d10] p-4 space-y-2">
          <div className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">
            Acquired Identifier
          </div>
          <div className="font-mono text-xl font-bold text-white">
            {handle}
          </div>
        </div>

        <div className="border border-[#2a2416] bg-[#16120a] p-4 text-xs text-[#e4d7c5] space-y-2 leading-relaxed">
          <div className="font-mono font-bold text-[#d4af37] text-[11px] uppercase tracking-wider">
            Check Your Email Inbox
          </div>
          <p>
            Your account credentials, login credentials, and 2FA keys have been automatically dispatched to the email address you entered during checkout.
          </p>
          <p className="text-[11px] text-neutral-400">
            Please check your Inbox (and Spam/Junk folder if not visible immediately).
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2.5">
          <a
            href="/"
            className="w-full py-3 bg-[#d4af37] hover:bg-[#e2bd45] text-[#090a0d] font-mono font-bold text-xs uppercase tracking-wider text-center transition-colors"
          >
            Return to Market
          </a>
          <a
            href="https://discord.gg/z36zMpAGPm"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 border border-[#262830] hover:border-[#383b48] text-xs font-mono uppercase text-neutral-300 hover:text-white text-center transition-colors"
          >
            Need Support? Join Discord
          </a>
        </div>
      </div>
    </div>
  );
};

export default OrderSuccess;
