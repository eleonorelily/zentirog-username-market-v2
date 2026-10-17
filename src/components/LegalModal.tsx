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
                <section>
                  <h4 className="text-xs font-mono uppercase tracking-wider text-[#d4af37] mb-1">
                    1. Scope and Escrow Policy
                  </h4>
                  <p>
                    All items listed in the Zentirog Vault represent verified digital identifiers. Inquiries and final handoffs are coordinated via our designated Discord communication line. Transactions require mutual confirmation of payment before account transfer credentials or release protocols are executed.
                  </p>
                </section>

                <section>
                  <h4 className="text-xs font-mono uppercase tracking-wider text-[#d4af37] mb-1">
                    2. Finality of Transfer
                  </h4>
                  <p>
                    Due to the immutable nature of unique identifier claims on third-party networks, all completed transfers are final. Buyers are granted a 60-minute window upon release to verify handle binding to their designated Discord account.
                  </p>
                </section>

                <section>
                  <h4 className="text-xs font-mono uppercase tracking-wider text-[#d4af37] mb-1">
                    3. Buyer Verification
                  </h4>
                  <p>
                    Purchasers must possess an active, verified Discord profile. We do not facilitate transactions with unverified intermediaries or unauthorized payment gateways.
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
