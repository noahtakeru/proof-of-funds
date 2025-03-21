import { useState, useEffect } from 'react';
import PhantomMultiWallet from '../lib/PhantomMultiWallet';
import { getConnectedWallets } from '../lib/walletHelpers';

/**
 * Component for handling transactions across multiple Phantom wallets.
 * This component acts as a wrapper around transaction operations.
 */
export default function PhantomMultiWalletTransactionHandler({
    children,
    onStatusChange = () => { }
}) {
    const [multiWallet, setMultiWallet] = useState(null);
    const [connectedWallets, setConnectedWallets] = useState([]);
    const [status, setStatus] = useState('idle'); // idle, initializing, ready, error
    const [error, setError] = useState('');
    const [isInitialized, setIsInitialized] = useState(false);

    // Initialize the multi-wallet system on component mount
    useEffect(() => {
        const initMultiWallet = async () => {
            try {
                setStatus('initializing');
                setError('');

                // Create a new PhantomMultiWallet instance
                const multiWalletInstance = new PhantomMultiWallet();

                // Initialize the instance
                await multiWalletInstance.initialize();

                setMultiWallet(multiWalletInstance);
                setIsInitialized(true);
                setStatus('ready');
                onStatusChange('ready');
            } catch (error) {
                console.error('Error initializing PhantomMultiWallet:', error);
                setError(`Failed to initialize: ${error.message}`);
                setStatus('error');
                onStatusChange('error', error.message);
            }
        };

        // Get connected wallets from localStorage
        const getConnectedPhantomWallets = () => {
            try {
                const allWallets = getConnectedWallets();
                const phantomWallets = allWallets.filter(wallet => wallet.type === 'solana');
                setConnectedWallets(phantomWallets);
                return phantomWallets;
            } catch (error) {
                console.error('Error getting connected Phantom wallets:', error);
                return [];
            }
        };

        // Only initialize if there are connected Phantom wallets
        const phantomWallets = getConnectedPhantomWallets();
        if (phantomWallets.length > 0) {
            initMultiWallet();
        } else {
            setStatus('idle');
        }

        // Cleanup on unmount
        return () => {
            // Any necessary cleanup
        };
    }, [onStatusChange]);

    // Function to sign a transaction with a specific wallet
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

    // Function to sign multiple transactions with a specific wallet
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

    // Function to send a transaction with a specific wallet
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

    // Function to sign a message with a specific wallet
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

    // Get all connected Phantom wallets
    const getPhantomWallets = () => {
        return connectedWallets;
    };

    // Check if a specific wallet is connected
    const isWalletConnected = (walletAddress) => {
        return connectedWallets.some(wallet => wallet.fullAddress === walletAddress);
    };

    // Context value to provide to children
    const contextValue = {
        status,
        error,
        connectedWallets,
        signTransaction,
        signAllTransactions,
        sendTransaction,
        signMessage,
        batchTransactions,
        getPhantomWallets,
        isWalletConnected
    };

    // Render children with the context value
    return (
        <>
            {typeof children === 'function'
                ? children(contextValue)
                : children
            }
        </>
    );
} 