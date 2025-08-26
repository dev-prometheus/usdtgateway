import React, { useState } from 'react'
import TopBar from './components/TopBar';
import DappOverview from './components/DappOverview';
import SendModal from "./components/SendModal";
import ReceiveModal from "./components/ReceiveModal";
import { useAppKitAccount } from "@reown/appkit/react";

const App = () => {
  const { isConnected } = useAppKitAccount();
  const [showSend, setShowSend] = useState(false);
  const [showReceive, setShowReceive] = useState(false);

  return (
    <div className="app">
      <TopBar />

      <main className="main-content">
        {isConnected ? (
          <>
            <DappOverview
              onSend={() => setShowSend(true)}
              onReceive={() => setShowReceive(true)}
            />
            {showSend && <SendModal onClose={() => setShowSend(false)} />}
            {showReceive && <ReceiveModal onClose={() => setShowReceive(false)} />}
          </>
        ) : (
          <div className="connect-state">
            <div className="connect-illustration">
              <div className="wallet-graphic">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="6" width="18" height="12" rx="2" fill="url(#walletGradient)" />
                  <rect x="7" y="10" width="4" height="2" rx="1" fill="#ffffff" opacity="0.8" />
                  <defs>
                    <linearGradient id="walletGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#1d4ed8" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>

            <div className="connect-content">
              <h2>Connect Your Wallet</h2>
              <p>
                Start by connecting your wallet on <strong>Ethereum</strong> to view
                your portfolio and manage USDT transfers seamlessly.
              </p>

              <div className="features-grid">
                <div className="feature-item">
                  <div className="feature-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5z" />
                    </svg>
                  </div>
                  <span>Secure Transactions</span>
                </div>

                <div className="feature-item">
                  <div className="feature-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                  </div>
                  <span>Fast Transfers</span>
                </div>

                <div className="feature-item">
                  <div className="feature-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4z" />
                    </svg>
                  </div>
                  <span>Best Fees</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App
