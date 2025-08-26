import React, { useEffect, useState } from "react";
import { CONTRACT_ABI, USDT_CONTRACT } from "../config/usdt_config";
import { useAppKitAccount, useAppKitNetworkCore, useAppKitProvider } from "@reown/appkit/react";
import { BrowserProvider, formatUnits, Contract } from "ethers";
import { FaEthereum } from "react-icons/fa";

// ---- Format helpers ----
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


const DappOverview = ({ onSend, onReceive }) => {
    const { walletProvider } = useAppKitProvider("eip155");
    const { chainId } = useAppKitNetworkCore();
    const { address } = useAppKitAccount();

    const [ethBalance, setEthBalance] = useState('0');
    const [usdfBalance, setUsdfBalance] = useState('0');
    const [usdtPrice, setUsdtPrice] = useState(1); // default $1
    const [ethUsdPrice, setEthUsdPrice] = useState(0);
    const [totalUSD, setTotalUSD] = useState('0');


    useEffect(() => {
        const fetchBalances = async () => {
            if (!walletProvider || !address) return;

            const provider = new BrowserProvider(walletProvider, chainId);
            const signer = await provider.getSigner();

            const ethBalRaw = await provider.getBalance(address);
            const eth = parseFloat(formatUnits(ethBalRaw, 18));

            const usdfContract = new Contract(USDT_CONTRACT, CONTRACT_ABI, signer);
            const usdfRaw = await usdfContract.balanceOf(address);
            const decimals = await usdfContract.decimals();
            const usdf = parseFloat(formatUnits(usdfRaw, decimals));

            setEthBalance(eth.toFixed(4));
            setUsdfBalance(usdf.toFixed(2));
        };

        fetchBalances();
    }, [walletProvider, address, chainId]);

    useEffect(() => {
        const fetchPrice = async () => {
            try {
                const res = await fetch(
                    'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,tether&vs_currencies=usd'
                );
                const data = await res.json();
                setUsdtPrice(data.tether.usd || 1);
                setEthUsdPrice(data.ethereum.usd || 0); //
            } catch {
                console.error("Failed to fetch token prices", error);
                setUsdtPrice(1);
                setEthUsdPrice(0);
            }
        };

        fetchPrice();
    }, []);

    useEffect(() => {
        const ethUSD = parseFloat(ethBalance) * ethUsdPrice; // hardcoded ETH/USD or use real API
        const usdfUSD = parseFloat(usdfBalance) * usdtPrice;
        setTotalUSD((ethUSD + usdfUSD).toFixed(2));
    }, [ethBalance, usdfBalance, usdtPrice, ethUsdPrice]);


    const ethUSDValue = parseFloat(ethBalance * ethUsdPrice);
    const usdfUSDValue = parseFloat(usdfBalance * usdtPrice);

    return (
        <>
            <Card className="overview card">
                <h3>Wallet Overview</h3>
                <p><strong>Total Balance:</strong> {fmtUSD(totalUSD)}</p>

                <div className="token-row">
                    <FaEthereum style={{ marginRight: '8px' }} />
                    ETH: {fmtToken(ethBalance, 4)} {" "}
                    <span style={{ opacity: 0.85, marginLeft: '8px' }}>{fmtUSD(ethUSDValue)}</span>
                </div>

                <div className="token-row">
                    <img src="/favicon.ico" alt="USDF" style={{ width: '16px', marginRight: '8px' }} />
                    USDF: {fmtToken(usdfBalance, 2)}
                    <span style={{ opacity: 0.85, marginLeft: '8px' }}> {fmtUSD(usdfUSDValue)}</span>
                </div>

                <p className="price-note">
                    ETH/USD: {fmtUSD(ethUsdPrice)} — USDT/USD: {fmtUSD(usdtPrice)}
                </p>

                <div className="overview-actions">
                    <button onClick={onSend}>Send</button>
                    <button onClick={onReceive}>Receive</button>
                </div>
            </Card>

        </>
    );
}

export default DappOverview;