import React, { useEffect, useState, useMemo } from "react";
import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import { BrowserProvider, formatEther, isAddress, parseUnits, formatUnits, Contract } from "ethers";
import { CONTRACT_ABI, USDT_CONTRACT } from "../config/usdt_config";
import { USDT_GATEWAY, USDT_GATEWAY_ABI } from "../config/erc20_config";

// ---- Helpers ----
const fmtToken = (value, fractionDigits = 2) =>
    new Intl.NumberFormat("en-US", {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    }).format(Number(value) || 0);

const fmtUSD = (value) =>
    new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(value) || 0);

const SendModal = ({ onClose }) => {

    const { walletProvider } = useAppKitProvider("eip155");
    const { isConnected, address } = useAppKitAccount();

    const [recipient, setRecipient] = useState('');
    const [amount, setAmount] = useState('');

    const [status, setStatus] = useState('idle'); // idle | sending | success | error
    const [errorMsg, setErrorMsg] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);
    const [txHash, setTxHash] = useState("");

    const [ethPrice, setEthPrice] = useState(0); // fallback default
    const [ethBalance, setEthBalance] = useState("0");
    const [usdfBalance, setUsdfBalance] = useState("0");
    const [usdfDecimals, setUsdfDecimals] = useState(6);
    const [usdfBalanceWei, setUsdfBalanceWei] = useState(0n);
    const [requiredFeeWei, setRequiredFeeWei] = useState(0n);
    const [needsApprove, setNeedsApprove] = useState(false);

    // Derived
    const requiredFeeEth = useMemo(() => Number(formatEther(requiredFeeWei || 0n)), [requiredFeeWei]);

    // Keep at most `dp` decimals without converting through Number
    const limitDecimals = (str, dp) => {
        const [i, f = ""] = String(str).split(".");
        if (dp <= 0) return i;
        return f.length > dp ? `${i}.${f.slice(0, dp)}` : str;
    };


    // 🔁 Fetch ETH price on load
    useEffect(() => {
        const cached = localStorage.getItem("ETH_USD");
        if (cached) setEthPrice(Number(cached));
        (async () => {
            try {
                const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
                const d = await r.json();
                const p = d?.ethereum?.usd ?? 0;
                if (p) {
                    setEthPrice(p);
                    localStorage.setItem("ETH_USD", String(p));
                }
            } catch { }
        })();
    }, []);

    // Prefetch balances + fee when modal opens/changes
    useEffect(() => {
        const loadOverview = async () => {
            try {
                if (!walletProvider || !isConnected || !address) return;

                const provider = new BrowserProvider(walletProvider);
                const signer = await provider.getSigner();
                const sender = await signer.getAddress();

                // Balances
                const [ethBalWei, usdfContract] = await Promise.all([
                    provider.getBalance(sender),
                    (async () => new Contract(USDT_CONTRACT, CONTRACT_ABI, provider))(),
                ]);

                const decimals = await usdfContract.decimals();
                setUsdfDecimals(decimals);

                const usdfBalRaw = await usdfContract.balanceOf(sender);
                setUsdfBalanceWei(usdfBalRaw);
                setUsdfBalance(formatUnits(usdfBalRaw, decimals));
                setEthBalance(formatEther(ethBalWei));

                // Fee: read per-wallet effective fee from gateway
                const gateway = new Contract(USDT_GATEWAY, USDT_GATEWAY_ABI, provider);
                const fee = await gateway.effectiveFeeOf(sender); // BigInt
                setRequiredFeeWei(fee);
            } catch (e) {
                console.error("Prefetch error:", e);
            }
        };
        loadOverview();
    }, [walletProvider, isConnected, address]);

    useEffect(() => {
        if (!walletProvider || !isConnected || !address) return;
        let t;
        (async function pollFee() {
            try {
                const provider = new BrowserProvider(walletProvider);
                const gateway = new Contract(USDT_GATEWAY, USDT_GATEWAY_ABI, provider);
                const fee = await gateway.effectiveFeeOf(address);
                setRequiredFeeWei(fee);
            } catch { }
            t = setTimeout(pollFee, 20000); // every 20s
        })();
        return () => t && clearTimeout(t);
    }, [walletProvider, isConnected, address]);


    useEffect(() => {
        (async () => {
            if (!walletProvider || !isConnected || !address || !amount) {
                setNeedsApprove(false);
                return;
            }
            try {
                const provider = new BrowserProvider(walletProvider);
                const signer = await provider.getSigner();
                const usdf = new Contract(USDT_CONTRACT, CONTRACT_ABI, signer);
                const dec = await usdf.decimals();
                const amtWei = parseUnits(amount || "0", dec);
                const allowance = await usdf.allowance(address, USDT_GATEWAY);
                setNeedsApprove(allowance < amtWei);
            } catch {
                setNeedsApprove(false);
            }
        })();
    }, [walletProvider, isConnected, address, amount]);

    const reset = () => {
        setRecipient("");
        setAmount("");
        setStatus("idle");
        setErrorMsg("");
        setTxHash("");
        setShowSuccess(false);
        onClose();
    };

    const friendlyError = (m) => {
        const s = String(m);
        if (s.includes("InsufficientFee")) return "A fee is required for your wallet tier.";
        if (s.includes("InsufficientAllowance")) return "Approval too low. Please re-approve and retry.";
        if (s.includes("ERC20TransferFailed")) return "Token transfer failed. Check balance and try again.";
        if (s.includes("PAUSED")) return "Transfers are currently paused.";
        if (s.includes("user rejected")) return "You rejected the transaction.";
        if (s.includes("insufficient funds"))
            return "Insufficient ETH to cover fee and gas.";
        if (s.includes("replacement fee too low")) return "Network is busy; try again with a higher priority fee.";
        return s;
    };

    const handleSend = async () => {
        try {
            // ---- input validation
            if (!recipient || !amount) throw new Error("Please fill in all fields.");
            if (!isAddress(recipient)) throw new Error("Invalid recipient address.");
            if (!walletProvider || !isConnected) throw new Error("Wallet not ready. Please reconnect.");

            const amt = parseFloat(amount);
            if (isNaN(amt) || amt <= 0) throw new Error("Invalid amount entered.");
            if (recipient.toLowerCase() === address.toLowerCase())
                throw new Error("Cannot send tokens to your own address.");

            setStatus("sending");
            setErrorMsg("");
            setShowSuccess(false);
            setTxHash("");

            const provider = new BrowserProvider(walletProvider);
            const signer = await provider.getSigner();
            const sender = await signer.getAddress();

            const usdf = new Contract(USDT_CONTRACT, CONTRACT_ABI, signer);
            const gateway = new Contract(USDT_GATEWAY, USDT_GATEWAY_ABI, signer);

            // parse amount (wei)
            const decimals = await usdf.decimals();
            const amountWei = parseUnits(amount, decimals);

            // pre-check balances
            const [tokenBal, ethBal, feeWei] = await Promise.all([
                usdf.balanceOf(sender),
                provider.getBalance(sender),
                (async () => gateway.effectiveFeeOf(sender))(),
            ]);

            if (tokenBal < amountWei) throw new Error("Insufficient USDF balance");

            if (ethBal < feeWei) {
                throw new Error(
                    `Insufficient ETH for required fee: need ${formatEther(feeWei)} ETH`
                );
            }

            // ensure allowance for gateway
            const currentAllowance = await usdf.allowance(sender, USDT_GATEWAY);
            if (currentAllowance < amountWei) {
                const txApprove = await usdf.approve(USDT_GATEWAY, amountWei);
                setTxHash(txApprove.hash);
                await txApprove.wait();
            }

            // 🔒 static preflight (no state change) to catch reverts without noisy messages
            try {
                await gateway.sendUSDT.staticCall(recipient, amountWei, { value: feeWei });
            } catch (simErr) {
                const msg = String(simErr?.shortMessage || simErr?.message || "");
                setErrorMsg(friendlyError(msg));
                throw new Error("Transaction simulation failed — check fee, allowance, and balances.");
            }
            // Send through gateway
            const tx = await gateway.sendUSDT(recipient, amountWei, { value: feeWei });
            setTxHash(tx.hash);
            await tx.wait();

            setStatus("success");
            setShowSuccess(true);

            // refresh quick stats (best-effort)
            try {
                const [newEthBal, newTokenBal] = await Promise.all([
                    provider.getBalance(sender),
                    usdf.balanceOf(sender),
                ]);
                setEthBalance(formatEther(newEthBal));
                setUsdfBalance(formatUnits(newTokenBal, dec));
            } catch { }

            // auto-close
            setTimeout(() => reset(), 10000);
        } catch (err) {
            console.error("Send error:", err);
            const msg =
                err?.shortMessage ||
                err?.info?.error?.message ||
                err?.message ||
                "Transaction failed.";
            setErrorMsg(friendlyError(msg));
            setStatus("error");
        }
    };

    const feeUSD = requiredFeeEth * ethPrice;

    const amtOk = Number(amount) > 0;
    const addrOk = isAddress(recipient);
    const canSend = isConnected && addrOk && amtOk && status !== "sending" && !showSuccess;


    return (
        <>
            <div className="modal-overlay" onClick={reset}>
                <div className="modal-content send-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                        <div className="modal-title-section">
                            <h2 className="modal-title">Send USDT</h2>
                            <div className="network-badge">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                                    xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                                    <polygon points="12,2 4,12 12,16 20,12" fill="currentColor" />
                                    <polygon points="12,22 20,12 12,16 4,12" fill="currentColor" opacity=".6" />
                                </svg>
                                <span>Ethereum</span>
                            </div>
                        </div>
                        <button className="modal-close" onClick={reset}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"
                                xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                                <path d="M18.3 5.7a1 1 0 0 1 0 1.4L13.4 12l4.9 4.9a1 1 0 1 1-1.4 1.4L12 13.4l-4.9 4.9a1 1 0 0 1-1.4-1.4L10.6 12 5.7 7.1a1 1 0 0 1 1.4-1.4L12 10.6l4.9-4.9a1 1 0 0 1 1.4 0Z" />
                            </svg>
                        </button>
                    </div>

                    {(status === "idle" || status === "sending") && (
                        <>
                            <div className="balance-info">
                                <div className="balance-row">
                                    <span>USDT Balance</span>
                                    <span className="balance-value">{fmtToken(usdfBalance, 2)}</span>
                                </div>
                                <div className="balance-row">
                                    <span>ETH Balance</span>
                                    <span className="balance-value">{fmtToken(ethBalance, 5)} ETH</span>
                                </div>
                                <div className="balance-row">
                                    <span>Network Fee</span>
                                    <span className="balance-value">
                                        {requiredFeeEth === 0
                                            ? "Free"
                                            : `${requiredFeeEth} ETH (${fmtUSD(feeUSD)})`
                                        }
                                    </span>
                                </div>
                            </div>

                            <div className="form-section">
                                <div className="input-group">
                                    <label className="input-label">Recipient Address</label>
                                    <input
                                        type="text"
                                        placeholder="0x... Ethereum address"
                                        value={recipient}
                                        onChange={(e) => setRecipient(e.target.value)}
                                        className={`form-input ${recipient && !addrOk ? 'error' : ''}`}
                                    />
                                    {recipient && !addrOk && (
                                        <span className="input-error">Invalid Ethereum address</span>
                                    )}
                                </div>

                                <div className="input-group">
                                    <label className="input-label">
                                        <span>Amount (USDT)</span>
                                        <button className="max-button" type="button" onClick={() => {
                                            const full = formatUnits(usdfBalanceWei, usdfDecimals);
                                            const clamped = limitDecimals(
                                                full,
                                                Math.min(Number(usdfDecimals), 6)
                                            );
                                            setAmount(clamped);
                                        }}>
                                            MAX
                                        </button>
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        inputMode="decimal"
                                        placeholder="0.00"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="form-input"
                                    />
                                    {amount && parseFloat(amount) > parseFloat(usdfBalanceWei) && (
                                        <span className="input-error">Amount exceeds balance</span>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {status === 'success' && showSuccess && (
                        <div className="success-state">
                            <div className="success-icon" aria-hidden="true">
                                <svg width="60" height="60" viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="12" r="9" className="ring" />
                                    <path d="M8 12.5l2.6 2.6L16.5 9.5" className="mark" />
                                </svg>
                            </div>
                            <h3>Transaction Successful!</h3>
                            <p>Your USDT has been sent successfully.</p>
                            {txHash && (
                                <a
                                    href={`https://etherscan.io/tx/${txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="tx-link">
                                    View on Etherscan
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M7 17L17 7M17 7H7M17 7V17" />
                                    </svg>
                                </a>
                            )}
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="error-state">
                            <div className="error-icon">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm4.3 14.3a1 1 0 0 1-1.4 0L12 13.4l-2.9 2.9a1 1 0 0 1-1.4-1.4l2.9-2.9L7.7 8.1a1 1 0 0 1 1.4-1.4L12 9.6l2.9-2.9a1 1 0 0 1 1.4 1.4L13.4 11l2.9 2.9a1 1 0 0 1 0 1.4z" />
                                </svg>
                            </div>
                            <h3>Transaction Failed</h3>
                            <p className="error-message">{errorMsg}</p>
                        </div>
                    )}

                    {(status === 'idle' || status === 'error') && (
                        <div className="modal-actions">
                            <button
                                className={`modal-action-btn primary ${!canSend ? 'disabled' : ''}`}
                                onClick={handleSend}
                                disabled={!canSend}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
                                </svg>
                                <span>{status === "sending"
                                    ? "Sending…"
                                    : needsApprove
                                        ? "Approve"
                                        : "Send"}</span>
                            </button>
                            <button className="modal-action-btn secondary" onClick={reset}>
                                Cancel
                            </button>
                        </div>
                    )}

                    {status === 'sending' && (
                        <div className="sending-state">
                            <div className="loading-spinner">
                                <div className="spinner"></div>
                            </div>
                            <h3>Processing Transaction...</h3>
                            <p>Please confirm the transaction in your wallet and wait for network confirmation.</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

export default SendModal;