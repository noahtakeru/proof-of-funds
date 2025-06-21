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
import { AuthProvider } from '../contexts/AuthContext';
import { UserPreferencesProvider } from '../contexts/UserPreferencesContext';

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
        new MetaMaskConnector({ 
            chains,
            options: {
                shimDisconnect: true, // Add shimDisconnect option
                UNSTABLE_shimOnConnectSelectAccount: true // Force account selection on connect
            }
        }),
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

    // Handle wallet connection persistence and prevent auto-connection
    useEffect(() => {
        const clearAllWalletState = () => {
            console.log('Clearing all wallet connection state');
            
            // Clear all wagmi-related state
            localStorage.removeItem('wagmi.connected');
            localStorage.removeItem('wagmi.connectors');
            localStorage.removeItem('wagmi.injected.shimDisconnect');
            localStorage.removeItem('userInitiatedConnection');
            
            // Clear all wallet connection data
            localStorage.removeItem('walletData');
            localStorage.removeItem('walletconnect');
            localStorage.removeItem('WALLET_CONNECT_SELECTED_EVENT');
            localStorage.removeItem('WALLETCONNECT_DEEPLINK_CHOICE');
            
            // Set disconnection flag
            localStorage.setItem('user_disconnected_wallets', 'true');
            
            // Clear any MetaMask or wallet-related storage
            try {
                for (const key in localStorage) {
                    if (key.includes('metamask') || 
                        key.includes('wallet') || 
                        key.includes('connection') || 
                        key.includes('wagmi') ||
                        key.includes('ethereum') ||
                        key.includes('phantom')) {
                        localStorage.removeItem(key);
                    }
                }
            } catch (e) {
                console.warn('Error clearing wallet localStorage items:', e);
            }
        };
        
        // Only run in browser
        if (typeof window !== 'undefined') {
            // Force clear all wallet state on page load in development
            if (process.env.NODE_ENV !== 'production') {
                clearAllWalletState();
                return;
            }
            
            // In production, use session-based approach
            const sessionKey = 'walletSessionStarted';
            const isNewSession = !sessionStorage.getItem(sessionKey);
            
            // Mark session as started
            if (isNewSession) {
                console.log('New browser session detected');
                sessionStorage.setItem(sessionKey, 'true');
                clearAllWalletState();
                return; // Skip further wallet initialization for new sessions
            }
            
            // For existing sessions, check for explicit disconnection
            const hasDisconnected = localStorage.getItem('user_disconnected_wallets') === 'true';
            if (hasDisconnected) {
                clearAllWalletState();
                return;
            }
        }
    }, []);
    
    // Additional effect to disconnect from any wallets immediately on load
    useEffect(() => {
        if (typeof window !== 'undefined' && window.ethereum) {
            console.log('Ethereum provider detected, ensuring disconnected state');
            // This will disconnect any connected accounts
            if (window.ethereum._state && window.ethereum._state.accounts) {
                window.ethereum._state.accounts = [];
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
                        <AuthProvider>
                            <UserPreferencesProvider>
                                <Layout>
                                    <Component {...pageProps} />
                                </Layout>
                            </UserPreferencesProvider>
                        </AuthProvider>
                    </PhantomMultiWalletProvider>
                </NetworkProvider>
            </WagmiConfig>
        </>
    );
}

export default MyApp; 