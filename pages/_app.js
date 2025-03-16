import '../styles/globals.css';
// import '@rainbow-me/rainbowkit/styles.css';
import { AppProps } from 'next/app';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { WagmiConfig, createClient, configureChains } from 'wagmi';
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc';
import { MetaMaskConnector } from 'wagmi/connectors/metaMask';

// Define Polygon Amoy testnet
const polygonAmoy = {
    id: 80002,
    name: 'Polygon Amoy',
    network: 'polygon-amoy',
    nativeCurrency: {
        decimals: 18,
        name: 'MATIC',
        symbol: 'MATIC',
    },
    rpcUrls: {
        default: 'https://rpc-amoy.polygon.technology/',
    },
    blockExplorers: {
        default: { name: 'PolygonScan', url: 'https://amoy.polygonscan.com/' },
    },
    testnet: true,
};

// Configure chains & providers
const { chains, provider } = configureChains(
    [polygonAmoy],
    [
        jsonRpcProvider({
            rpc: (chain) => ({
                http: chain.rpcUrls.default,
            }),
        }),
    ]
);

// Set up client
const client = createClient({
    autoConnect: true,
    connectors: [new MetaMaskConnector({ chains })],
    provider,
});

// Import layout
const Layout = dynamic(() => import('../components/Layout'), {
    ssr: false,
});

function MyApp({ Component, pageProps }) {
    return (
        <WagmiConfig client={client}>
            <Layout>
                <Component {...pageProps} />
            </Layout>
        </WagmiConfig>
    );
}

export default MyApp; 