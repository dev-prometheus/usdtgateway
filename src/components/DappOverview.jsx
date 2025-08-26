import React, { useEffect, useState } from "react";
import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import { BrowserProvider, formatUnits, Contract } from "ethers";
import { CONTRACT_ABI, USDT_CONTRACT } from "../config/usdt_config";

// ---- Format helpers ----
const formatToken = (value, fractionDigits = 2) =>
    new Intl.NumberFormat("en-US", {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    }).format(Number(value) || 0);

const formatUSD = (value) =>
    new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(value) || 0);

const DappOverview = ({ onSend, onReceive }) => {
    const { walletProvider } = useAppKitProvider("eip155");
    const { address } = useAppKitAccount();

    const [ethBalance, setEthBalance] = useState('0');
    const [usdfBalance, setUsdfBalance] = useState('0');
    const [ethPrice, setEthPrice] = useState(0);
    const [usdtPrice, setUsdtPrice] = useState(1);
    const [totalUSD, setTotalUSD] = useState('0');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBalances = async () => {
            if (!walletProvider || !address) return;

            setLoading(true);
            try {
                const provider = new BrowserProvider(walletProvider);

                const ethBalWei = await provider.getBalance(address);
                const ethBal = formatUnits(ethBalWei, 18);
                setEthBalance(ethBal);

                const usdfContract = new Contract(USDT_CONTRACT, CONTRACT_ABI, provider);
                const usdfBalWei = await usdfContract.balanceOf(address);
                const decimals = await usdfContract.decimals();
                const usdfBal = formatUnits(usdfBalWei, decimals);
                setUsdfBalance(usdfBal);
            } catch (error) {
                console.error('Error fetching prices:', error);
                setEthBalance(0);
                setUsdfBalance(0);
            }
            setLoading(false);
        };

        fetchBalances();
    }, [walletProvider, address]);

    useEffect(() => {
        const fetchPrice = async () => {
            try {
                const res = await fetch(
                    'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,tether&vs_currencies=usd'
                );
                const data = await res.json();
                setEthPrice(data.ethereum.usd || 0);
                setUsdtPrice(data.tether.usd || 1);
            } catch {
                console.error("Failed to fetch token prices", error);
                setEthPrice(0);
                setUsdtPrice(1);
            }
        };

        fetchPrice();
    }, []);

    useEffect(() => {
        const ethUSD = parseFloat(ethBalance) * ethPrice; // hardcoded ETH/USD or use real API
        const usdfUSD = parseFloat(usdfBalance) * usdtPrice;
        setTotalUSD((ethUSD + usdfUSD).toFixed(2));
    }, [ethBalance, usdfBalance, usdtPrice, ethPrice]);


    const ethUSDValue = parseFloat(ethBalance * ethPrice);
    const usdfUSDValue = parseFloat(usdfBalance * usdtPrice);

    if (loading) {
        return (
            <div className="overview-card">
                <div className="loading-skeleton">
                    <div className="skeleton-line large"></div>
                    <div className="skeleton-line medium"></div>
                    <div className="skeleton-line small"></div>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="overview card">
                <div className="card-header">
                    <div className="balance-section">
                        <span className="balance-label">Total Portfolio</span>
                        <h1 className="total-balance">{formatUSD(totalUSD)}</h1>
                        <div className="balance-change positive">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M7 14l5-5 5 5" />
                            </svg>
                            <span>+2.4% (24h)</span>
                        </div>
                    </div>

                    <div className="portfolio-chart">
                        <div className="mini-chart">
                            <div className="chart-line"></div>
                        </div>
                    </div>
                </div>

                <div className="tokens-section">
                    <h3 className="section-title">Assets</h3>

                    <div className="token-list">
                        {/* ETH Token */}
                        <div className="token-item">
                            <div className="token-icon eth-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 1.5l-6.5 10.5L12 16l6.5-4L12 1.5zM5.5 13.5L12 22.5l6.5-9L12 18l-6.5-4.5z" />
                                </svg>
                            </div>

                            <div className="token-info">
                                <div className="token-name">Ethereum</div>
                                <div className="token-symbol">ETH</div>
                            </div>

                            <div className="token-balance">
                                <div className="balance-amount">{formatToken(ethBalance, 4)}</div>
                                <div className="balance-usd">{formatUSD(ethUSDValue)}</div>
                            </div>
                        </div>

                        {/* USDT Token */}
                        <div className="token-item">
                            <div className="token-icon usdt-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                </svg>
                            </div>

                            <div className="token-info">
                                <div className="token-name">Tether USD</div>
                                <div className="token-symbol">USDT</div>
                            </div>

                            <div className="token-balance">
                                <div className="balance-amount">{formatToken(usdfBalance, 2)}</div>
                                <div className="balance-usd">{formatUSD(usdfUSDValue)}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="price-ticker">
                    <div className="price-item">
                        <span>ETH/USD</span>
                        <span className="price-value">{formatUSD(ethPrice)}</span>
                    </div>
                    <div className="price-item">
                        <span>USDT/USD</span>
                        <span className="price-value"> {formatUSD(usdtPrice)}</span>
                    </div>
                </div>


                <div className="action-buttons">
                    <button className="action-btn primary" onClick={onSend}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
                        </svg>
                        <span>Send</span>
                    </button>

                    <button className="action-btn secondary" onClick={onReceive}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                        </svg>
                        <span>Receive</span>
                    </button>
                </div>
            </div>
        </>
    );
}

export default DappOverview;