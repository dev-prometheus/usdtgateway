import React, { useState } from "react";
import { useAppKit, useAppKitAccount, useDisconnect } from "@reown/appkit/react";

const WalletConnect = () => {
    const { open } = useAppKit();
    const { address, isConnected } = useAppKitAccount();
    const { disconnect } = useDisconnect();
    const [copied, setCopied] = useState(false);

    const handleConnect = () => open({ view: 'Connect' });

    const shortAddress = (addr) => (addr ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : "");

    const copyAddr = async () => {
        if (!address) return;
        try {
            await navigator.clipboard.writeText(address);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        } catch { /* ignore */ }
    };


    if (!isConnected) {
        return (
            <button className="connect-btn" onClick={handleConnect}>

                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                    xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                    <path d="M21 12.5v-5A2.5 2.5 0 0 0 18.5 5H7.5A4.5 4.5 0 0 0 3 9.5v8A2.5 2.5 0 0 0 5.5 20h13a2.5 2.5 0 0 0 2.5-2.5v-5Z"
                        stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
                    <path d="M21 12.5H7.5" stroke="currentColor" stroke-width="1.75"
                        stroke-linecap="round" stroke-linejoin="round" opacity=".7" />
                    <circle cx="16.2" cy="15" r="1.15" fill="currentColor" />
                </svg>

                <span>Connect</span>
            </button>
        );
    }

    return (
        <div className="wallet-connected">

            <button
                className="address-pill"
                onClick={copyAddr}
                title={address}
                aria-label={`Copy wallet address ${address}`}
                disabled={!address}
            >
                <span className="addr">{shortAddress(address)}</span>

                {/* right side: copy or copied */}
                {copied ? (
                    <span className="copy-feedback" role="status" aria-live="polite">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M20 6L10 16l-4-4" stroke="currentColor" strokeWidth="2"
                                strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Copied
                    </span>
                ) : (
                    <span className="icon-right" aria-hidden="true">
                        {/* copy icon (overlapping squares) */}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <rect x="9" y="9" width="10" height="12" rx="2"
                                stroke="currentColor" strokeWidth="2" />
                            <rect x="5" y="3" width="10" height="12" rx="2"
                                stroke="currentColor" strokeWidth="2" opacity=".7" />
                        </svg>
                    </span>
                )}
            </button>

            <button className="disconnect-btn" onClick={disconnect}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                    <path d="M10 21H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h4"
                        stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                    <path d="M17 16l4-4-4-4M21 12H10"
                        stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                </svg>

            </button>
        </div>
    );
};

export default WalletConnect;