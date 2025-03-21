import '../styles/globals.css';
// import '@rainbow-me/rainbowkit/styles.css';
import { AppProps } from 'next/app';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { WagmiConfig, createClient, configureChains } from 'wagmi';
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc';
import { MetaMaskConnector } from 'wagmi/connectors/metaMask';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { PhantomMultiWalletProvider } from '../lib/PhantomMultiWalletContext';

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

// Set up MetaMask connector with explicit options
const metaMaskConnector = new MetaMaskConnector({
    chains,
    options: {
        shimDisconnect: true,
        UNSTABLE_shimOnConnectSelectAccount: true,
    },
});

// Set up injected connector as fallback
const injectedConnector = new InjectedConnector({
    chains,
    options: {
        name: 'Injected',
        shimDisconnect: true,
    },
});

// Set up client - explicitly set autoConnect to false to prevent automatic connections
const client = createClient({
    autoConnect: false, // This ensures no automatic connection happens
    connectors: [metaMaskConnector, injectedConnector],
    provider,
});

// Import layout
const Layout = dynamic(() => import('../components/Layout'), {
    ssr: false,
});

function MyApp({ Component, pageProps }) {
    // Check and clear any stored connection state on initial load
    useEffect(() => {
        // Only run in browser
        if (typeof window !== 'undefined') {
            // If the user hasn't explicitly initiated a connection, clear any stored state
            const userInitiatedConnection = localStorage.getItem('userInitiatedConnection') === 'true';
            if (!userInitiatedConnection) {
                // Optionally clear connection data if auto-connection wasn't explicitly requested
                localStorage.removeItem('wagmi.connected');
                localStorage.removeItem('wagmi.connectors');
            }
        }
    }, []);

    return (
        <WagmiConfig client={client}>
            <PhantomMultiWalletProvider>
                <Layout>
                    <Component {...pageProps} />
                </Layout>
            </PhantomMultiWalletProvider>
        </WagmiConfig>
    );
}

export default MyApp; 