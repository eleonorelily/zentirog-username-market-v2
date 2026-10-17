import React, { useState } from 'react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'tos' | 'privacy';
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'tos',
}) => {
  const [activeTab, setActiveTab] = useState<'tos' | 'privacy'>(defaultTab);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
    >
      <div 
        className="relative w-full max-w-2xl bg-[#101115] border border-[#262830] text-[#eaebee] max-h-[85vh] flex flex-col rounded-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#262830] px-6 py-4 bg-[#0d0e12]">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveTab('tos')}
              className={`text-xs uppercase tracking-widest font-mono pb-1 border-b-2 transition-colors ${
                activeTab === 'tos'
                  ? 'border-[#d4af37] text-white font-bold'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Terms of Transfer
            </button>
            <button
              onClick={() => setActiveTab('privacy')}
              className={`text-xs uppercase tracking-widest font-mono pb-1 border-b-2 transition-colors ${
                activeTab === 'privacy'
                  ? 'border-[#d4af37] text-white font-bold'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Privacy Policy
            </button>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-neutral-400 hover:text-white p-1 text-sm font-mono"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 text-sm text-neutral-300 leading-relaxed font-sans space-y-5">
          {activeTab === 'tos' ? (
            <>
              <div>
                <h3 id="legal-modal-title" className="text-base font-display font-bold text-white uppercase tracking-wider mb-2">
                  Zentirog Username Exchange Terms
                </h3>
                <p className="text-xs text-neutral-400 font-mono">
                  Effective Date: October 2026 / Version 2.4
                </p>
              </div>

              <div className="space-y-4">
                <section className="border border-[#382d1c] bg-[#1a150d] p-3">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-[#d4af37] mb-1 font-bold">
                    Important Buyer Notice: Account Sale & Security Responsibility
                  </h4>
                  <p className="text-xs text-neutral-200">
                    We sell full Discord accounts that already have these rare usernames claimed onto them. Once the account credentials are delivered and the transaction is finalized, complete responsibility for the security of that account transfers entirely to you (the buyer). You must immediately secure the account (change email, change password, enable 2FA, and generate backup codes). We are not responsible or liable for any account loss, locks, bans, unauthorized access, or issues occurring after the sale.
                  </p>
                </section>

                <section>
                  <h4 className="text-xs font-mono uppercase tracking-wider text-[#d4af37] mb-1">
                    1. Account Delivery & Handoff
                  </h4>
                  <p>
                    All items listed in the Zentirog Vault are sold as complete Discord accounts with the specified username pre-claimed. Inquiries and transaction handoffs are conducted directly via Discord. Once payment is confirmed, login credentials for the account holding the handle are provided to the buyer.
                  </p>
                </section>

                <section>
                  <h4 className="text-xs font-mono uppercase tracking-wider text-[#d4af37] mb-1">
                    2. Mandatory Buyer Security Protocol
                  </h4>
                  <p>
                    Upon receiving account access, the buyer must immediately:
                    (a) Update the email address to their own private email,
                    (b) Change the account password to a strong, unique password,
                    (c) Enable Two-Factor Authentication (2FA) and download backup codes.
                    Any subsequent account compromises, password loss, or security failures are solely the buyer's responsibility.
                  </p>
                </section>

                <section>
                  <h4 className="text-xs font-mono uppercase tracking-wider text-[#d4af37] mb-1">
                    3. Finality of Sale & Zero Liability
                  </h4>
                  <p>
                    All sales are strictly final. Once the account information has been transmitted to the purchaser, no refunds, replacements, or chargebacks are provided. Zentirog assumes zero liability for anything that occurs to the account after handoff.
                  </p>
                </section>

                <section>
                  <h4 className="text-xs font-mono uppercase tracking-wider text-[#d4af37] mb-1">
                    4. Platform Independence
                  </h4>
                  <p>
                    Zentirog operates as an independent peer marketplace. Discord is a trademark of Discord Inc. Zentirog is not affiliated with, endorsed by, or sponsored by Discord Inc.
                  </p>
                </section>
              </div>
            </>
          ) : (
            <>
              <div>
                <h3 id="legal-modal-title" className="text-base font-display font-bold text-white uppercase tracking-wider mb-2">
                  Privacy and Data Handling
                </h3>
                <p className="text-xs text-neutral-400 font-mono">
                  Last Updated: October 2026
                </p>
              </div>

              <div className="space-y-4">
                <section>
                  <h4 className="text-xs font-mono uppercase tracking-wider text-[#d4af37] mb-1">
                    1. Zero Trackers & Client-Side Privacy
                  </h4>
                  <p>
                    The Zentirog marketplace does not deploy behavioral trackers, third-party marketing cookies, canvas fingerprints, or commercial telemetry scripts. Catalog retrieval is conducted directly via static read queries against our distributed document store.
                  </p>
                </section>

                <section>
                  <h4 className="text-xs font-mono uppercase tracking-wider text-[#d4af37] mb-1">
                    2. Communications
                  </h4>
                  <p>
                    Handle purchase negotiations occur solely over encrypted Discord direct messages and tickets. We do not store credit card credentials, passwords, or personal identity documents on this web client.
                  </p>
                </section>

                <section>
                  <h4 className="text-xs font-mono uppercase tracking-wider text-[#d4af37] mb-1">
                    3. Local Storage
                  </h4>
                  <p>
                    Preferences such as catalog display format (grid vs. list) or recently filtered categories are cached exclusively within your browser's local sandbox and are never transmitted to external marketing servers.
                  </p>
                </section>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#262830] px-6 py-3 bg-[#0d0e12] flex items-center justify-between text-xs text-neutral-500 font-mono">
          <span>SECURE PROTOCOL / NO THIRD-PARTY LOGGING</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#1b1d22] hover:bg-[#252830] text-neutral-200 border border-[#2c2f38] uppercase tracking-wider text-xs font-mono transition-colors"
          >
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
};
