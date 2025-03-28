/**
 * Main Application Component
 * 
 * This is the top-level component that wraps all pages in the Proof of Funds application.
 * It handles global configuration including:
 *  - Blockchain network setup (Polygon Amoy testnet)
 *  - Wallet connection providers (MetaMask and other injected wallets)
 *  - Global layout and styling
 *  - Persistence management for wallet connections
 */

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

/**
 * Polygon Amoy Testnet Configuration
 * Used for development and testing of blockchain interactions
 * Chain ID 80002 identifies this specific test network
 */
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

/**
 * Chain Configuration
 * Sets up the blockchain networks and RPC providers for the application
 * Currently only using Polygon Amoy testnet
 */
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

/**
 * MetaMask Wallet Connector
 * Primary connector for Ethereum wallets via MetaMask extension
 * shimDisconnect: Provides consistent disconnect behavior across browsers
 * UNSTABLE_shimOnConnectSelectAccount: Forces account selection popup on connect
 */
const metaMaskConnector = new MetaMaskConnector({
    chains,
    options: {
        shimDisconnect: true,
        UNSTABLE_shimOnConnectSelectAccount: true,
        chainId: 80002,
    },
});

/**
 * Generic Injected Wallet Connector
 * Fallback connector for other browser wallet extensions
 * Supports any wallet that injects an Ethereum provider
 */
const injectedConnector = new InjectedConnector({
    chains,
    options: {
        name: 'Injected',
        shimDisconnect: true,
    },
});

/**
 * Wagmi Client Configuration
 * Creates the client that handles wallet connections and blockchain interactions
 * autoConnect: true enables automatic wallet connection for previously connected wallets
 */
const client = createClient({
    autoConnect: true, // Enable auto-connection for better UX
    connectors: [metaMaskConnector, injectedConnector],
    provider,
});

/**
 * Dynamically import Layout component
 * Using dynamic import to prevent SSR issues with browser-specific components
 */
const Layout = dynamic(() => import('../components/Layout'), {
    ssr: false,
});

/**
 * Main Application Component
 * Wraps all pages with necessary providers and global layout
 * Handles wallet connection persistence logic
 */
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