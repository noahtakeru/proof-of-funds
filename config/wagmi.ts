import { getDefaultWallets } from '@rainbow-me/rainbowkit';
import { http, createConfig } from 'wagmi';
import { polygonAmoy } from 'wagmi/chains';
import { POLYGON_AMOY_CHAIN_ID } from './constants';

// Define custom Polygon Amoy testnet if needed
const customPolygonAmoy = {
    id: POLYGON_AMOY_CHAIN_ID,
    name: 'Polygon Amoy',
    network: 'polygon-amoy',
    nativeCurrency: {
        decimals: 18,
        name: 'MATIC',
        symbol: 'MATIC',
    },
    rpcUrls: {
        default: { http: ['https://rpc-amoy.polygon.technology/'] },
    },
    blockExplorers: {
        default: { name: 'PolygonScan', url: 'https://amoy.polygonscan.com/' },
    },
    testnet: true,
};

// Use either the built-in chain or custom one
const chain = polygonAmoy || customPolygonAmoy;

const { connectors } = getDefaultWallets({
    appName: 'Proof of Funds',
    projectId: 'a6eeca927fdae9c86fdfbe1f604ccf0e',
});

export const wagmiConfig = createConfig({
    chains: [chain],
    connectors,
    transports: {
        [chain.id]: http(),
    },
});

export const chains = [chain]; 