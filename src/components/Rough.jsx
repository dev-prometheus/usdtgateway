import React, { useEffect, useState, useMemo } from "react";
import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import {
  BrowserProvider,
  formatEther,
  isAddress,
  parseUnits,
  formatUnits,
  Contract,
} from "ethers";
import { FaTimes } from "react-icons/fa";
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

const getExplorerBase = (chainId) => {
  if (chainId === 1) return "https://etherscan.io";
  if (chainId === 11155111) return "https://sepolia.etherscan.io";
  return "https://etherscan.io";
};

const SendModal = ({ onClose }) => {
  const { walletProvider } = useAppKitProvider("eip155");
  const { isConnected, address, chainId } = useAppKitAccount();

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");

  const [status, setStatus] = useState("idle"); // idle | sending | success | error
  const [errorMsg, setErrorMsg] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [txHash, setTxHash] = useState("");

  const [ethPrice, setEthPrice] = useState(0);
  const [ethBalance, setEthBalance] = useState("0");
  const [usdfBalance, setUsdfBalance] = useState("0");
  const [usdfDecimals, setUsdfDecimals] = useState(6);
  const [usdfBalanceWei, setUsdfBalanceWei] = useState(0n);
  const [requiredFeeWei, setRequiredFeeWei] = useState(0n);
  const [needsApprove, setNeedsApprove] = useState(false);

  const requiredFeeEth = useMemo(
    () => Number(formatEther(requiredFeeWei || 0n)),
    [requiredFeeWei]
  );
  const explorer = useMemo(() => getExplorerBase(chainId), [chainId]);

  const limitDecimals = (str, dp) => {
    const [i, f = ""] = String(str).split(".");
    if (dp <= 0) return i;
    return f.length > dp ? `${i}.${f.slice(0, dp)}` : str;
  };

  // 🔁 Fetch ETH price
  useEffect(() => {
    const cached = localStorage.getItem("ETH_USD");
    if (cached) setEthPrice(Number(cached));
    (async () => {
      try {
        const r = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
        );
        const d = await r.json();
        const p = d?.ethereum?.usd ?? 0;
        if (p) {
          setEthPrice(p);
          localStorage.setItem("ETH_USD", String(p));
        }
      } catch {}
    })();
  }, []);

  // Prefetch balances + fee
  useEffect(() => {
    const loadOverview = async () => {
      try {
        if (!walletProvider || !isConnected || !address) return;

        const provider = new BrowserProvider(walletProvider);
        const signer = await provider.getSigner();
        const sender = await signer.getAddress();

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

        const gateway = new Contract(USDT_GATEWAY, USDT_GATEWAY_ABI, provider);
        const fee = await gateway.effectiveFeeOf(sender);
        setRequiredFeeWei(fee);
      } catch (e) {
        console.error("Prefetch error:", e);
      }
    };
    loadOverview();
  }, [walletProvider, isConnected, address]);

  // Fee polling
  useEffect(() => {
    if (!walletProvider || !isConnected || !address) return;
    let t;
    (async function pollFee() {
      try {
        const provider = new BrowserProvider(walletProvider);
        const gateway = new Contract(USDT_GATEWAY, USDT_GATEWAY_ABI, provider);
        const fee = await gateway.effectiveFeeOf(address);
        setRequiredFeeWei(fee);
      } catch {}
      t = setTimeout(pollFee, 20000);
    })();
    return () => t && clearTimeout(t);
  }, [walletProvider, isConnected, address]);

  // Approve check
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
    if (s.includes("InsufficientFee"))
      return "A fee is required for your wallet tier.";
    if (s.includes("InsufficientAllowance"))
      return "Approval too low. Please re-approve and retry.";
    if (s.includes("ERC20TransferFailed"))
      return "Token transfer failed. Check balance and try again.";
    if (s.includes("PAUSED")) return "Transfers are currently paused.";
    if (s.includes("user rejected")) return "You rejected the transaction.";
    if (s.includes("insufficient funds"))
      return "Insufficient ETH to cover fee and gas.";
    return s;
  };

  const handleSend = async () => {
    try {
      if (!recipient || !amount) throw new Error("Please fill in all fields.");
      if (!isAddress(recipient)) throw new Error("Invalid recipient address.");
      if (!walletProvider || !isConnected)
        throw new Error("Wallet not ready. Please reconnect.");

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

      const decimals = await usdf.decimals();
      const amountWei = parseUnits(amount, decimals);

      const [tokenBal, ethBal, feeWei] = await Promise.all([
        usdf.balanceOf(sender),
        provider.getBalance(sender),
        (async () => gateway.effectiveFeeOf(sender))(),
      ]);

      if (tokenBal < amountWei) throw new Error("Insufficient USDF balance");
      if (ethBal < feeWei)
        throw new Error(
          `Insufficient ETH for required fee: need ${formatEther(feeWei)} ETH`
        );

      const currentAllowance = await usdf.allowance(sender, USDT_GATEWAY);
      if (currentAllowance < amountWei) {
        const txApprove = await usdf.approve(USDT_GATEWAY, amountWei);
        setTxHash(txApprove.hash);
        await txApprove.wait();
      }

      try {
        await gateway.sendUSDT.staticCall(recipient, amountWei, { value: feeWei });
      } catch {
        throw new Error("Transaction simulation failed — check fee, allowance, and balances.");
      }

      const tx = await gateway.sendUSDT(recipient, amountWei, { value: feeWei });
      setTxHash(tx.hash);
      await tx.wait();

      setStatus("success");
      setShowSuccess(true);

      setTimeout(() => reset(), 10000);
    } catch (err) {
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
  const canSend =
    isConnected && addrOk && amtOk && status !== "sending" && !showSuccess;

  return (
    <div className="modal" onClick={reset}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ marginBottom: 6 }}>
          <h3>Send USDF</h3>
          <span className="net-pill">ETH • Base</span>
        </div>
        <button className="close-x" onClick={reset}>
          <FaTimes />
        </button>

        {(status === "idle" || status === "sending") && (
          <>
            <div className="mini-stats">
              <div>USDF Balance: {fmtToken(usdfBalance, 2)}</div>
              <div>ETH Balance: {fmtToken(ethBalance, 5)}</div>
              <div>
                Required Fee:{" "}
                {requiredFeeEth === 0
                  ? "No fee required"
                  : `${requiredFeeEth} ETH (${fmtUSD(feeUSD)})`}
              </div>
            </div>

            <div className="field">
              <label className="label">Recipient</label>
              <input
                type="text"
                placeholder="0x… address"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="input"
              />
              {!addrOk && recipient && (
                <span className="bad">Invalid recipient address</span>
              )}
            </div>

            <div className="field">
              <label className="label row">
                Amount (USDF)
                <button
                  className="btn secondary"
                  style={{ padding: "4px 10px", fontSize: 12 }}
                  onClick={() => {
                    const full = formatUnits(usdfBalanceWei, usdfDecimals);
                    const clamped = limitDecimals(
                      full,
                      Math.min(Number(usdfDecimals), 6)
                    );
                    setAmount(clamped);
                  }}
                >
                  Max
                </button>
              </label>
              <input
                type="number"
                step="any"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input"
              />
            </div>

            <div className="actions">
              <button
                className="btn"
                onClick={handleSend}
                disabled={!canSend}
              >
                {status === "sending"
                  ? "Sending…"
                  : needsApprove
                  ? "Approve & Send"
                  : "Send"}
              </button>
              <button className="btn secondary" onClick={reset}>
                Cancel
              </button>
            </div>
          </>
        )}

        {status === "success" && (
          <p className="ok">
            ✅ Transaction successful!{" "}
            {txHash && (
              <>
                <br />
                <a
                  href={`${explorer}/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ok"
                  style={{ textDecoration: "underline" }}
                >
                  View on Etherscan
                </a>
              </>
            )}
          </p>
        )}

        {status === "error" && <p className="bad">❌ {errorMsg}</p>}
      </div>
    </div>
  );
};

export default SendModal;
