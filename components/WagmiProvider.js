// WagmiProvider Component
// 
// This component handles the blockchain connection configuration using the wagmi library
// It's dynamically imported to avoid ESM-related issues with Next.js

import { WagmiConfig, createClient, configureChains } from 'wagmi';
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc';
import { MetaMaskConnector } from 'wagmi/connectors/metaMask';
import { InjectedConnector } from 'wagmi/connectors/injected';

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
 * autoConnect: true allows wallet state to persist across page reloads
 */
const client = createClient({
    autoConnect: true, // Enable autoConnect to allow persistence
    connectors: [metaMaskConnector, injectedConnector],
    provider,
});

/**
 * WagmiProvider Component
 * Wraps children with the WagmiConfig provider
 */
export function WagmiProvider({ children }) {
    return <WagmiConfig client={client}>{children}</WagmiConfig>;
} 