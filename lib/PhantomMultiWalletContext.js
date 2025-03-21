import React, { createContext, useContext, useState, useEffect } from 'react';
import PhantomMultiWallet from './PhantomMultiWallet';
import { getConnectedWallets } from './walletHelpers';

// Create the context
const PhantomMultiWalletContext = createContext(null);

// Context provider component
export function PhantomMultiWalletProvider({ children }) {
    const [multiWallet, setMultiWallet] = useState(null);
    const [connectedWallets, setConnectedWallets] = useState([]);
    const [status, setStatus] = useState('idle'); // idle, initializing, ready, error
    const [error, setError] = useState('');
    const [isInitialized, setIsInitialized] = useState(false);

    // Initialize the multi-wallet system and load connected wallets
    useEffect(() => {
        // Flag to track if the component is still mounted
        let isMounted = true;

        const initMultiWallet = async () => {
            try {
                if (!isMounted) return;

                setStatus('initializing');
                setError('');

                // Create a new PhantomMultiWallet instance
                const multiWalletInstance = new PhantomMultiWallet();

                // Initialize the instance
                await multiWalletInstance.initialize();

                if (!isMounted) return;

                setMultiWallet(multiWalletInstance);
                setIsInitialized(true);
                setStatus('ready');

                // Load the connected Phantom wallets
                loadConnectedWallets();
            } catch (error) {
                console.error('Error initializing PhantomMultiWallet:', error);

                if (!isMounted) return;

                setError(`Failed to initialize: ${error.message}`);
                setStatus('error');
            }
        };

        // Only initialize if Phantom is installed
        if (typeof window !== 'undefined' && (window.phantom?.solana || window.solana?.isPhantom)) {
            initMultiWallet();
        } else {
            if (isMounted) {
                setStatus('unavailable');
                setError('Phantom wallet not detected');
            }
        }

        // Cleanup
        return () => {
            isMounted = false;
        };
    }, []);

    // Load connected wallets from localStorage
    const loadConnectedWallets = () => {
        try {
            const allWallets = getConnectedWallets();
            const phantomWallets = allWallets.filter(wallet => wallet.type === 'solana');
            setConnectedWallets(phantomWallets);

            // If we have a multiWallet instance, add these wallets to it
            if (multiWallet && phantomWallets.length > 0) {
                const addresses = phantomWallets.map(wallet => wallet.fullAddress);
                multiWallet.addWallets(addresses);
            }
        } catch (error) {
            console.error('Error loading connected wallets:', error);
            setError(`Failed to load connected wallets: ${error.message}`);
        }
    };

    // Refresh the list of connected wallets
    const refreshConnectedWallets = () => {
        loadConnectedWallets();
    };

    // Connect a new wallet using Phantom popup
    const connectWallet = async () => {
        if (!isInitialized || !multiWallet) {
            throw new Error('Multi-wallet system not initialized');
        }

        try {
            const address = await multiWallet.connectWallet();

            // Update our wallet list
            refreshConnectedWallets();

            return address;
        } catch (error) {
            console.error('Error connecting wallet:', error);
            throw error;
        }
    };

    // Sign a transaction with a specific wallet
    const signTransaction = async (walletAddress, transaction) => {
        if (!isInitialized || !multiWallet) {
            throw new Error('Multi-wallet system not initialized');
        }

        try {
            return await multiWallet.queueTransaction(walletAddress, async (wallet) => {
                return await wallet.signTransaction(transaction);
            });
        } catch (error) {
            console.error('Error signing transaction:', error);
            throw error;
        }
    };

    // Sign multiple transactions with a specific wallet
    const signAllTransactions = async (walletAddress, transactions) => {
        if (!isInitialized || !multiWallet) {
            throw new Error('Multi-wallet system not initialized');
        }

        try {
            return await multiWallet.queueTransaction(walletAddress, async (wallet) => {
                return await wallet.signAllTransactions(transactions);
            });
        } catch (error) {
            console.error('Error signing multiple transactions:', error);
            throw error;
        }
    };

    // Send a transaction with a specific wallet
    const sendTransaction = async (walletAddress, transaction) => {
        if (!isInitialized || !multiWallet) {
            throw new Error('Multi-wallet system not initialized');
        }

        try {
            return await multiWallet.queueTransaction(walletAddress, async (wallet) => {
                return await wallet.sendTransaction(transaction);
            });
        } catch (error) {
            console.error('Error sending transaction:', error);
            throw error;
        }
    };

    // Sign a message with a specific wallet
    const signMessage = async (walletAddress, message) => {
        if (!isInitialized || !multiWallet) {
            throw new Error('Multi-wallet system not initialized');
        }

        try {
            return await multiWallet.queueTransaction(walletAddress, async (wallet) => {
                return await wallet.signMessage(message);
            });
        } catch (error) {
            console.error('Error signing message:', error);
            throw error;
        }
    };

    // Batch transactions across multiple wallets
    const batchTransactions = async (transactionsByWallet) => {
        if (!isInitialized || !multiWallet) {
            throw new Error('Multi-wallet system not initialized');
        }

        const results = {};

        try {
            // Process each wallet's transactions in order
            for (const [walletAddress, transactions] of Object.entries(transactionsByWallet)) {
                const walletResults = [];

                // Process each transaction for this wallet
                for (const tx of transactions) {
                    const result = await sendTransaction(walletAddress, tx);
                    walletResults.push(result);
                }

                results[walletAddress] = walletResults;
            }

            return results;
        } catch (error) {
            console.error('Error processing batch transactions:', error);
            throw error;
        }
    };

    // Check if a specific wallet is connected
    const isWalletConnected = (walletAddress) => {
        return connectedWallets.some(wallet => wallet.fullAddress === walletAddress);
    };

    // Discover all available Phantom wallets
    const discoverWallets = async () => {
        if (!isInitialized || !multiWallet) {
            throw new Error('Multi-wallet system not initialized');
        }

        try {
            return await multiWallet.discoverAllWallets();
        } catch (error) {
            console.error('Error discovering wallets:', error);
            throw error;
        }
    };

    // Context value
    const value = {
        status,
        error,
        connectedWallets,
        refreshConnectedWallets,
        connectWallet,
        signTransaction,
        signAllTransactions,
        sendTransaction,
        signMessage,
        batchTransactions,
        isWalletConnected,
        discoverWallets,
        isInitialized
    };

    return (
        <PhantomMultiWalletContext.Provider value={value}>
            {children}
        </PhantomMultiWalletContext.Provider>
    );
}

// Custom hook to use the context
export function usePhantomMultiWallet() {
    const context = useContext(PhantomMultiWalletContext);

    if (context === null) {
        throw new Error('usePhantomMultiWallet must be used within a PhantomMultiWalletProvider');
    }

    return context;
}

// Export the context for direct access if needed
export default PhantomMultiWalletContext; 