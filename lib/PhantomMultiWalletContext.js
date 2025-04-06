/**
 * PhantomMultiWalletContext
 * 
 * A React Context provider that manages multiple Phantom wallet connections
 * and provides functions for interacting with the Solana blockchain.
 * 
 * This context handles:
 * - Initialization of the Phantom multi-wallet system
 * - Connection and tracking of multiple Phantom wallets
 * - Transaction signing and sending for each wallet
 * - Message signing for proof of ownership
 * - Batch transactions across multiple wallets
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import PhantomMultiWallet from './PhantomMultiWallet';
import { getConnectedWallets } from './walletHelpers';

// Create the context
const PhantomMultiWalletContext = createContext(null);

/**
 * Phantom Multi-Wallet Provider Component
 * 
 * Wraps the application with the Phantom wallet context provider
 * Initializes the multi-wallet system and provides wallet-related functions
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render
 */
export function PhantomMultiWalletProvider({ children }) {
    // State for managing the multi-wallet instance
    const [multiWallet, setMultiWallet] = useState(null);
    // State for tracking connected Phantom wallets
    const [connectedWallets, setConnectedWallets] = useState([]);
    // Status of the multi-wallet system
    const [status, setStatus] = useState('idle'); // idle, initializing, ready, error
    // Error message if initialization fails
    const [error, setError] = useState('');
    // Flag indicating if the system is initialized
    const [isInitialized, setIsInitialized] = useState(false);

    /**
     * Initialize the multi-wallet system on component mount
     * Detects Phantom wallet extension and sets up the system
     */
    useEffect(() => {
        // Flag to track if the component is still mounted
        let isMounted = true;

        /**
         * Initializes the PhantomMultiWallet instance
         * Creates a new instance and sets up the necessary state
         */
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

    /**
     * Loads connected Phantom wallets from multiple storage sources
     * Uses our enhanced multi-wallet discovery system combined with standard storage
     */
    const loadConnectedWallets = () => {
        try {
            // Load wallets from the standard wallet storage system
            const allWallets = getConnectedWallets();
            const phantomWallets = allWallets.filter(wallet => wallet.type === 'solana');
            
            // Also check our enhanced multi-wallet storage
            // First check phantomDiscoveredWallets (from PhantomMultiWallet)
            let enhancedWallets = [];
            try {
                const discoveredWallets = JSON.parse(localStorage.getItem('phantomDiscoveredWallets') || '[]');
                const walletState = JSON.parse(localStorage.getItem('phantomWalletState') || '{}');
                
                // Convert these to our standard wallet object format
                const newWallets = discoveredWallets.map(address => {
                    // Check if this wallet is already in our standard list
                    const existing = phantomWallets.find(w => w.fullAddress === address);
                    if (existing) return null;
                    
                    // Create a new wallet object
                    return {
                        id: `phantom-${address.substring(0, 8)}`,
                        name: 'Phantom',
                        address: formatAddress(address),
                        fullAddress: address,
                        chain: 'Solana',
                        type: 'solana',
                        // Include performance data if available
                        performance: walletState[address] || null
                    };
                }).filter(Boolean);
                
                enhancedWallets = newWallets;
            } catch (e) {
                console.error("Error loading enhanced wallet data:", e);
            }
            
            // Combine both sources
            const combinedWallets = [...phantomWallets, ...enhancedWallets];
            setConnectedWallets(combinedWallets);

            // If we have a multiWallet instance, add these wallets to it
            if (multiWallet && combinedWallets.length > 0) {
                const addresses = combinedWallets.map(wallet => wallet.fullAddress);
                multiWallet.addWallets(addresses);
                
                console.log(`Added ${addresses.length} wallets to PhantomMultiWallet system`);
                
                // If available, attempt to discover any additional wallets
                setTimeout(async () => {
                    try {
                        if (multiWallet.discoverAllWallets) {
                            const discoveredAddresses = await multiWallet.discoverAllWallets();
                            console.log(`PhantomMultiWallet discovered ${discoveredAddresses.length} wallets`);
                            
                            // Re-fetch wallet list to include newly discovered wallets
                            if (discoveredAddresses.length > 0) {
                                loadConnectedWallets();
                            }
                        }
                    } catch (err) {
                        console.error("Error discovering additional wallets:", err);
                    }
                }, 1000);
            }
        } catch (error) {
            console.error('Error loading connected wallets:', error);
            setError(`Failed to load connected wallets: ${error.message}`);
        }
    };
    
    // Helper function to format addresses (copied from walletHelpers to avoid circular dependency)
    const formatAddress = (address) => {
        if (!address) return '';
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    };

    /**
     * Refreshes the list of connected wallets
     * Useful after connecting or disconnecting wallets
     */
    const refreshConnectedWallets = () => {
        loadConnectedWallets();
    };

    /**
     * Connects a new Phantom wallet using the extension popup
     * Updates the local wallet list after connection
     * 
     * @returns {Promise<string>} The address of the newly connected wallet
     * @throws {Error} If connection fails or system is not initialized
     */
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

    /**
     * Signs a transaction with a specific wallet
     * 
     * @param {string} walletAddress - Address of the wallet to sign with
     * @param {Transaction} transaction - Solana transaction to sign
     * @returns {Promise<Transaction>} Signed transaction
     * @throws {Error} If signing fails or system is not initialized
     */
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

    /**
     * Signs multiple transactions with a specific wallet
     * 
     * @param {string} walletAddress - Address of the wallet to sign with
     * @param {Transaction[]} transactions - Array of Solana transactions to sign
     * @returns {Promise<Transaction[]>} Array of signed transactions
     * @throws {Error} If signing fails or system is not initialized
     */
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

    /**
     * Sends a transaction using a specific wallet
     * 
     * @param {string} walletAddress - Address of the wallet to send from
     * @param {Transaction} transaction - Solana transaction to send
     * @returns {Promise<string>} Transaction signature
     * @throws {Error} If sending fails or system is not initialized
     */
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

    /**
     * Signs a message with a specific wallet for verification purposes
     * Used in the Proof of Funds system to verify wallet ownership
     * 
     * @param {string} walletAddress - Address of the wallet to sign with
     * @param {Uint8Array|string} message - Message to sign
     * @returns {Promise<Uint8Array>} Signed message
     * @throws {Error} If signing fails or system is not initialized
     */
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

    /**
     * Processes transactions across multiple wallets in sequence
     * 
     * @param {Object} transactionsByWallet - Map of wallet addresses to their transactions
     * @returns {Promise<Object>} Results organized by wallet address
     * @throws {Error} If any transaction fails or system is not initialized
     */
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

    /**
     * Checks if a specific wallet address is currently connected
     * 
     * @param {string} walletAddress - Wallet address to check
     * @returns {boolean} True if the wallet is connected, false otherwise
     */
    const isWalletConnected = (walletAddress) => {
        return connectedWallets.some(wallet => wallet.fullAddress === walletAddress);
    };

    /**
     * Discovers all available Phantom wallets in the extension
     * Useful for showing users all their wallets without requiring connection
     * 
     * @returns {Promise<string[]>} Array of discovered wallet addresses
     * @throws {Error} If discovery fails or system is not initialized
     */
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

    // Context value with all the functions and state exposed to consumers
    const value = {
        status,              // Current status of the multi-wallet system
        error,               // Error message if initialization failed
        connectedWallets,    // List of connected Phantom wallets
        refreshConnectedWallets, // Function to refresh the wallet list
        connectWallet,       // Function to connect a new wallet
        signTransaction,     // Function to sign a transaction
        signAllTransactions, // Function to sign multiple transactions
        sendTransaction,     // Function to send a transaction
        signMessage,         // Function to sign a message
        batchTransactions,   // Function to process transactions across wallets
        isWalletConnected,   // Function to check if a wallet is connected
        discoverWallets,     // Function to discover available wallets
        isInitialized        // Flag indicating if the system is initialized
    };

    return (
        <PhantomMultiWalletContext.Provider value={value}>
            {children}
        </PhantomMultiWalletContext.Provider>
    );
}

/**
 * Custom hook to access the Phantom Multi-Wallet context
 * Provides access to all wallet functions and state
 * 
 * @returns {Object} The PhantomMultiWalletContext value
 * @throws {Error} If used outside of a PhantomMultiWalletProvider
 */
export function usePhantomMultiWallet() {
    const context = useContext(PhantomMultiWalletContext);

    if (context === null) {
        throw new Error('usePhantomMultiWallet must be used within a PhantomMultiWalletProvider');
    }

    return context;
}

/**
 * Export the context for direct access if needed
 * Most consumers should use the usePhantomMultiWallet hook instead
 */
export default PhantomMultiWalletContext; 