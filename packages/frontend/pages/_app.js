// Main Application Component
// 
// This is the top-level component that wraps all pages in the Proof of Funds application.
// It handles global configuration including:
//  - Blockchain network setup (Polygon Amoy testnet)
//  - Wallet connection providers (MetaMask and other injected wallets)
//  - Global layout and styling
//  - Persistence management for wallet connections

import '../styles/globals.css';
import { AppProps } from 'next/app';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { PhantomMultiWalletProvider } from '@proof-of-funds/common/PhantomMultiWalletContext';
import { NetworkProvider } from '@proof-of-funds/common/context/NetworkContext';
import Script from 'next/script';
import { WagmiConfig, createConfig, configureChains } from 'wagmi';
import { mainnet, polygon, polygonMumbai } from 'wagmi/chains';
import { publicProvider } from 'wagmi/providers/public';
import { MetaMaskConnector } from 'wagmi/connectors/metaMask';

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
        default: { http: ['https://rpc-amoy.polygon.technology/'] },
        public: { http: ['https://rpc-amoy.polygon.technology/'] },
    },
    blockExplorers: {
        default: { name: 'PolygonScan', url: 'https://amoy.polygonscan.com/' },
    },
    testnet: true,
};

// Configure chains and providers for Wagmi
const { chains, publicClient, webSocketPublicClient } = configureChains(
    [mainnet, polygon, polygonMumbai, polygonAmoy],
    [publicProvider()]
);

// Create Wagmi configuration with MetaMask connector
// Setting autoConnect to false to prevent automatic reconnection after disconnect
const config = createConfig({
    autoConnect: false, // Don't automatically reconnect wallets
    publicClient,
    webSocketPublicClient,
    connectors: [
        new MetaMaskConnector({ chains }),
    ],
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
    // Analytics page view tracking
    useEffect(() => {
        const handleRouteChange = (url) => {
            if (window.gtag) {
                window.gtag('config', 'G-XXXXXXXXXX', {
                    page_path: url,
                });
            }
        };

        // Subscribe to Next.js route changes
        const handleRouteChangeComplete = (url) => handleRouteChange(url);

        // Add event listeners for route changes
        if (typeof window !== 'undefined') {
            import('next/router').then(({ default: router }) => {
                router.events.on('routeChangeComplete', handleRouteChangeComplete);
                return () => {
                    router.events.off('routeChangeComplete', handleRouteChangeComplete);
                };
            });
        }
    }, []);

    // Check and synchronize stored connection state on initial load
    useEffect(() => {
        // Only run in browser
        if (typeof window !== 'undefined') {
            // Check if user has explicitly disconnected wallets
            const hasDisconnected = localStorage.getItem('user_disconnected_wallets') === 'true';
            
            // If user has explicitly disconnected, ensure all connection flags are cleared
            if (hasDisconnected) {

                localStorage.removeItem('wagmi.connected');
                localStorage.removeItem('wagmi.connectors');
                localStorage.removeItem('userInitiatedConnection');
                return; // Skip checking for connections if disconnection is explicit
            }
            
            // Check if user has initiated connection
            const userInitiatedConnection = localStorage.getItem('userInitiatedConnection') === 'true';

            // If user hasn't explicitly initiated connection, ensure storage is consistent
            if (!userInitiatedConnection) {
                // If wagmi is connected but no user-initiated flag, set the flag
                if (localStorage.getItem('wagmi.connected') === 'true') {
                    localStorage.setItem('userInitiatedConnection', 'true');
                }
            }
        }
    }, []);

    return (
        <>
            {/* Google Analytics Measurement ID - Replace G-XXXXXXXXXX with your actual GA4 measurement ID */}
            <Script
                strategy="afterInteractive"
                src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"
            />
            <Script
                id="google-analytics"
                strategy="afterInteractive"
                dangerouslySetInnerHTML={{
                    __html: `
                        window.dataLayer = window.dataLayer || [];
                        function gtag(){dataLayer.push(arguments);}
                        gtag('js', new Date());
                        gtag('config', 'G-XXXXXXXXXX', {
                            page_path: window.location.pathname,
                        });
                    `,
                }}
            />
            <WagmiConfig config={config}>
                <NetworkProvider>
                    <PhantomMultiWalletProvider>
                        <Layout>
                            <Component {...pageProps} />
                        </Layout>
                    </PhantomMultiWalletProvider>
                </NetworkProvider>
            </WagmiConfig>
        </>
    );
}

export default MyApp; 