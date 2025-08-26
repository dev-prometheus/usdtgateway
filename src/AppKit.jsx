import { createAppKit } from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import  { mainnet } from "@reown/appkit/networks";


const projectId = "7b995bf019a79da1e29f3b13819f5a36";

const metadata = {
    name: "USDT Gateway",
    description: "USDT Gateway",
    url: window.location.origin,
    icons: [],
};

export const appKit = createAppKit({
    adapters: [new EthersAdapter()],
    networks: [mainnet],
    metadata: metadata,
    projectId: projectId,
       features: {
        analytics: true,
        onramp: true,
        connectMethodsOrder: ["wallet"],
        swaps: false,
        send: false,
        history: false,
        email: false,
        socials: false,

    },
    themeMode: "dark",
    themeVariables: {
        "--w3m-z-index": "1030",
    },
});