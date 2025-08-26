import React from 'react';
import WalletConnect from './WalletConnect';

const TopBar = () => {
    return (
        <header className="topbar">
            <div className="brand">
                <div className="brand-icon">
                    <div className="pulse-dot"></div>
                </div>
                <span className="brand-text">USDT Gateway</span>
            </div>

            <div className="topbar-actions">
                <div className="network-pill">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                        xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                        <polygon points="12,2 4,12 12,16 20,12" fill="currentColor" />
                        <polygon points="12,22 20,12 12,16 4,12" fill="currentColor" opacity=".6" />
                    </svg>
                    <span>Ethereum</span>
                </div>
                <WalletConnect />
            </div>
        </header>
    );
};

export default TopBar;