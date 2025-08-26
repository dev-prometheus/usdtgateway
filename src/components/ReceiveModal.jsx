import React, { useState, useMemo } from "react";
import { useAppKitAccount } from "@reown/appkit/react";
import { QRCodeCanvas } from "qrcode.react";
import { FaRegCopy, FaTimes, FaShareAlt } from "react-icons/fa";
const ReceiveModal = ({ onClose }) => {
    const { address } = useAppKitAccount();
    const [copied, setCopied] = useState(false);

    const shortAddr = useMemo(() => {
        if (!address) return "";
        return `${address.slice(0, 6)}…${address.slice(-4)}`;
    }, [address]);

    const copyToClipboard = async () => {
        if (!address) return;
        try {
            await navigator.clipboard.writeText(address);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch (e) { }
    };

    const shareAddr = async () => {
        if (!address) return;
        if (navigator.share) {
            try {
                await navigator.share({ title: "My USDT address", text: address });
            } catch { }
        } else {
            copyToClipboard();
        }
    };

    return (
        <>

            <div className="modal-overlay" onClick={onClose}>
                <div className="modal-content receive-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                        <div className="modal-title-section">
                            <h2 className="modal-title">Receive USDT</h2>
                            <div className="network-badge">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                                    xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                                    <polygon points="12,2 4,12 12,16 20,12" fill="currentColor" />
                                    <polygon points="12,22 20,12 12,16 4,12" fill="currentColor" opacity=".6" />
                                </svg>
                                <span>Ethereum</span>
                            </div>
                        </div>
                        <button className="modal-close" onClick={onClose}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"
                                xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                                <path d="M18.3 5.7a1 1 0 0 1 0 1.4L13.4 12l4.9 4.9a1 1 0 1 1-1.4 1.4L12 13.4l-4.9 4.9a1 1 0 0 1-1.4-1.4L10.6 12 5.7 7.1a1 1 0 0 1 1.4-1.4L12 10.6l4.9-4.9a1 1 0 0 1 1.4 0Z" />
                            </svg>
                        </button>
                    </div>


                    <div className="safety-alert">
                        <div className="alert-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5z" />
                            </svg>
                        </div>
                        <div className="alert-content">
                            <strong>Important:</strong> Only send USDT (ERC-20) and ETH to this address. Other tokens will be permanently lost.
                        </div>
                    </div>

                    {/* QR card */}
                    <div className="qr-section">
                        <div className="qr-container">
                            <QRCodeCanvas
                                value={address || ""}
                                size={200}
                                bgColor="#ffffff"
                                fgColor="#000000"
                                includeMargin={false}
                            />
                        </div>
                        <div className="address-section">
                            <div className="address-label">Your USDT Address</div>
                            <div className="address-display">
                                <span className="address-text">{shortAddr || "No address"}</span>
                            </div>
                        </div>
                    </div>

                    <div className="action-row">
                        <button
                            className={`modal-action-btn secondary ${copied ? 'copied' : ''}`}
                            onClick={copyToClipboard}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                {copied ? (
                                    <path d="M20 6L9 17l-5-5" />
                                ) : (
                                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                                )}
                            </svg>
                            <span>{copied ? "Copied!" : "Copy Address"}</span>
                        </button>

                        <button className="modal-action-btn primary" onClick={shareAddr}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" />
                            </svg>
                            <span>Share</span>
                        </button>
                    </div>
                    <div className="receive-tips">
                        <div className="tip-item">
                            <div className="tip-icon">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                                </svg>
                            </div>
                            <span>Transactions typically confirm within 2-5 minutes</span>
                        </div>
                        <div className="tip-item">
                            <div className="tip-icon">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5z" />
                                </svg>
                            </div>
                            <span>Network fees are paid by the sender</span>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

export default ReceiveModal;