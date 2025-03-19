// wallet-helpers.js - Centralized management for connected wallets
// This file contains utilities for wallet connection management

// Helper function to format wallet addresses for display
const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

// Connect to MetaMask and get all selected accounts
const connectMetaMask = async () => {
    // Check if MetaMask is available
    if (!window.ethereum) {
        throw new Error('MetaMask not detected. Please install MetaMask extension.');
    }

    try {
        // Find the explicit MetaMask provider if multiple providers exist
        let provider = window.ethereum;
        if (window.ethereum?.providers) {
            const metamaskProvider = window.ethereum.providers.find(p => p.isMetaMask);
            if (metamaskProvider) {
                provider = metamaskProvider;
                console.log('Found explicit MetaMask provider');
            }
        }

        // Force MetaMask to show its account selection UI
        await provider.request({
            method: 'wallet_requestPermissions',
            params: [{ eth_accounts: {} }]
        });

        // After permissions are granted, get the selected accounts
        const accounts = await provider.request({
            method: 'eth_accounts'
        });

        if (!accounts || accounts.length === 0) {
            throw new Error('No accounts were selected in MetaMask');
        }

        console.log('MetaMask connected with accounts:', accounts);

        // Return all selected accounts
        return accounts;
    } catch (error) {
        console.error('Error connecting to MetaMask:', error);
        throw error;
    }
};

// Connect to Phantom wallet
const connectPhantom = async () => {
    // Check if Phantom is available
    if (!window.solana || !window.solana.isPhantom) {
        throw new Error('Phantom wallet not detected. Please install Phantom extension.');
    }

    try {
        console.log('Starting Phantom connection process');

        // Force disconnect first to ensure UI always shows
        try {
            if (window.solana.isConnected) {
                console.log('Disconnecting Phantom wallet to force user selection UI');
                await window.solana.disconnect();
                console.log('Phantom disconnect completed');
            }
        } catch (disconnectError) {
            console.warn('Error during Phantom disconnect:', disconnectError);
            // Continue despite disconnect error - we'll try to connect anyway
        }

        // Increased delay to ensure disconnect completes
        await new Promise(resolve => setTimeout(resolve, 800));

        console.log('Requesting Phantom connection with UI prompt');
        // Connect to Phantom with explicit UI flag
        const response = await window.solana.connect({
            onlyIfTrusted: false // Force UI to show every time
        });

        const publicKey = response.publicKey.toString();
        console.log('Phantom connected with public key:', publicKey);

        // Return the public key in an array format for consistency with MetaMask
        return [publicKey];
    } catch (error) {
        console.error('Error connecting to Phantom:', error);
        throw error;
    }
};

// Disconnect a specific wallet
const disconnectWallet = async (walletType, address) => {
    try {
        // Get current wallet connection data from localStorage
        const walletData = getStoredWalletData();

        if (walletType === 'evm') {
            // For MetaMask/EVM wallets, we don't actually disconnect
            // We just remove it from our tracked wallets
            if (walletData && walletData.wallets && walletData.wallets.metamask) {
                // Filter out the specific address
                walletData.wallets.metamask = walletData.wallets.metamask.filter(
                    acc => acc.toLowerCase() !== address.toLowerCase()
                );

                // If no accounts left for this wallet type, remove it
                if (walletData.wallets.metamask.length === 0) {
                    delete walletData.wallets.metamask;
                }

                // Update storage
                saveWalletData(walletData);
            }
            console.log('Removed MetaMask wallet from tracking:', address);
            return true;
        } else if (walletType === 'solana') {
            // For Phantom, we need to disconnect and update localStorage
            if (window.solana && window.solana.isConnected) {
                await window.solana.disconnect();
                console.log('Disconnected from Phantom wallet');
            }

            // Remove Phantom connection from localStorage
            if (walletData && walletData.wallets && walletData.wallets.phantom) {
                delete walletData.wallets.phantom;

                // Update storage
                saveWalletData(walletData);
            }

            return true;
        }
        return false;
    } catch (error) {
        console.error('Error disconnecting wallet:', error);
        throw error;
    }
};

// Get the stored wallet data from localStorage
const getStoredWalletData = () => {
    try {
        const userInitiated = localStorage.getItem('userInitiatedConnection') === 'true';
        if (!userInitiated) {
            return { wallets: {} };
        }

        const storedData = localStorage.getItem('walletData');
        return storedData ? JSON.parse(storedData) : { wallets: {} };
    } catch (error) {
        console.error('Error getting stored wallet data:', error);
        return { wallets: {} };
    }
};

// Save wallet data to localStorage
const saveWalletData = (data) => {
    try {
        if (Object.keys(data.wallets).length === 0) {
            // Clear all data if no wallets left
            localStorage.removeItem('userInitiatedConnection');
            localStorage.removeItem('walletData');
        } else {
            // Set user initiated connection flag
            localStorage.setItem('userInitiatedConnection', 'true');

            // Store the wallet data
            localStorage.setItem('walletData', JSON.stringify(data));
        }
        return true;
    } catch (error) {
        console.error('Error saving wallet data:', error);
        return false;
    }
};

// Get all connected wallet details from localStorage
const getConnectedWallets = () => {
    try {
        const wallets = [];
        const walletData = getStoredWalletData();

        // No wallets stored
        if (!walletData || !walletData.wallets) {
            return wallets;
        }

        // Process MetaMask wallets
        if (walletData.wallets.metamask && walletData.wallets.metamask.length > 0) {
            walletData.wallets.metamask.forEach(account => {
                wallets.push({
                    id: `metamask-${account.toLowerCase()}`,
                    name: 'MetaMask',
                    address: formatAddress(account),
                    fullAddress: account,
                    chain: 'Polygon',
                    type: 'evm'
                });
            });
        }

        // Process Phantom wallet
        if (walletData.wallets.phantom && walletData.wallets.phantom.length > 0) {
            const phantomAddress = walletData.wallets.phantom[0];
            wallets.push({
                id: `phantom-${phantomAddress.substring(0, 8)}`,
                name: 'Phantom',
                address: formatAddress(phantomAddress),
                fullAddress: phantomAddress,
                chain: 'Solana',
                type: 'solana'
            });
        }

        return wallets;
    } catch (error) {
        console.error('Error getting connected wallets:', error);
        return [];
    }
};

// Save connected wallet details to localStorage
const saveWalletConnection = (walletType, accounts) => {
    if (!walletType || !accounts || accounts.length === 0) {
        return false;
    }

    try {
        // Get current wallet data
        const walletData = getStoredWalletData();

        // Initialize the wallet type if it doesn't exist
        if (!walletData.wallets[walletType]) {
            walletData.wallets[walletType] = [];
        }

        // For Phantom, replace the existing connection (single account only)
        if (walletType === 'phantom') {
            walletData.wallets.phantom = accounts;
        }
        // For MetaMask, add new accounts that don't already exist
        else if (walletType === 'metamask') {
            const existingAccounts = walletData.wallets.metamask || [];
            const lowerCaseExisting = existingAccounts.map(acc => acc.toLowerCase());

            // Add new accounts that don't already exist
            accounts.forEach(account => {
                if (!lowerCaseExisting.includes(account.toLowerCase())) {
                    existingAccounts.push(account);
                }
            });

            walletData.wallets.metamask = existingAccounts;
        }

        // Update timestamp
        walletData.timestamp = Date.now();

        // Save the updated data
        return saveWalletData(walletData);
    } catch (error) {
        console.error('Error saving wallet connection:', error);
        return false;
    }
};

// Clear all wallet connections
const clearAllWalletConnections = async () => {
    try {
        // Try to disconnect Phantom if connected
        if (window.solana && window.solana.isConnected) {
            await window.solana.disconnect();
        }

        // Clear localStorage data
        localStorage.removeItem('userInitiatedConnection');
        localStorage.removeItem('walletData');

        // Also clear legacy storage
        localStorage.removeItem('lastWalletConnection');

        return true;
    } catch (error) {
        console.error('Error clearing wallet connections:', error);
        return false;
    }
};

// Export all wallet helper functions
export {
    formatAddress,
    connectMetaMask,
    connectPhantom,
    disconnectWallet,
    getConnectedWallets,
    saveWalletConnection,
    clearAllWalletConnections
}; 