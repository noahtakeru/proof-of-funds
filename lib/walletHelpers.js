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

        // First completely disconnect from Phantom if connected
        // This is necessary because Phantom only connects to the currently active wallet
        // in the extension and doesn't have a native UI for selecting between accounts
        if (window.solana.isConnected) {
            console.log('Disconnecting existing Phantom connection');
            await window.solana.disconnect();
            console.log('Phantom disconnect completed');

            // Wait for disconnect to fully complete
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Clear any previous Phantom storage connections
        console.log('Using Phantom API to connect to current active wallet in extension');

        let publicKey;

        // First try the window.phantom.solana API (preferred)
        if (window.phantom?.solana) {
            try {
                console.log('Using window.phantom.solana.connect() API');
                // Connect to the current active wallet in Phantom
                const response = await window.phantom.solana.connect();
                publicKey = response.publicKey.toString();
                console.log('Connected using phantom.solana API:', publicKey);
            } catch (err) {
                console.error('Error using phantom.solana API:', err);
                throw err; // Let the error propagate
            }
        }
        // Fallback to the window.solana API
        else {
            console.log('Using window.solana.connect() API');
            try {
                const response = await window.solana.connect({
                    onlyIfTrusted: false  // Always show UI for first permission
                });
                publicKey = response.publicKey.toString();
                console.log('Connected using solana API:', publicKey);
            } catch (err) {
                console.error('Error using solana API:', err);
                throw err;
            }
        }

        // Return the public key in array format for consistency with MetaMask
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
            // For Phantom wallets, handle removal of specific wallet
            if (walletData && walletData.wallets && walletData.wallets.phantom) {
                // Filter out the specific Phantom address
                walletData.wallets.phantom = walletData.wallets.phantom.filter(
                    addr => addr !== address
                );

                // If no accounts left for Phantom, remove it
                if (walletData.wallets.phantom.length === 0) {
                    delete walletData.wallets.phantom;

                    // If currently connected to Phantom, disconnect
                    if (window.solana && window.solana.isConnected) {
                        await window.solana.disconnect();
                        console.log('Disconnected from Phantom wallet');
                    }
                }

                // Update storage
                saveWalletData(walletData);
                console.log('Removed Phantom wallet from tracking:', address);
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

        // Process Phantom wallets - handle multiple wallets
        if (walletData.wallets.phantom && walletData.wallets.phantom.length > 0) {
            walletData.wallets.phantom.forEach(phantomAddress => {
                wallets.push({
                    id: `phantom-${phantomAddress.substring(0, 8)}`,
                    name: 'Phantom',
                    address: formatAddress(phantomAddress),
                    fullAddress: phantomAddress,
                    chain: 'Solana',
                    type: 'solana'
                });
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

        // For Phantom, handle a single account or array of accounts
        if (walletType === 'phantom') {
            // Converting to array if a single address is passed
            const walletAddresses = Array.isArray(accounts) ? accounts : [accounts];

            // Get existing accounts
            const existingAccounts = walletData.wallets.phantom || [];

            // Add new accounts without duplicates
            walletAddresses.forEach(address => {
                if (!existingAccounts.includes(address)) {
                    existingAccounts.push(address);
                    console.log('Added Phantom wallet:', address);
                } else {
                    console.log('Phantom wallet already connected:', address);
                }
            });

            walletData.wallets.phantom = existingAccounts;
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