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
        // If already connected, disconnect first to force the account selection UI
        if (window.solana.isConnected) {
            await window.solana.disconnect();
            await new Promise(resolve => setTimeout(resolve, 300)); // Short delay
        }

        // Connect to Phantom - this shows the Phantom account selection UI
        const response = await window.solana.connect({
            onlyIfTrusted: false
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
        if (walletType === 'evm') {
            // For MetaMask/EVM wallets, we don't actually disconnect
            // We just remove it from our tracked wallets
            console.log('Removed MetaMask wallet from tracking:', address);
            return true;
        } else if (walletType === 'solana') {
            // For Phantom, we can disconnect
            if (window.solana && window.solana.isConnected) {
                await window.solana.disconnect();
                console.log('Disconnected from Phantom wallet');
            }
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error disconnecting wallet:', error);
        throw error;
    }
};

// Get all connected wallet details from localStorage
const getConnectedWallets = () => {
    try {
        const wallets = [];
        const userInitiated = localStorage.getItem('userInitiatedConnection') === 'true';

        if (!userInitiated) {
            return wallets;
        }

        const lastConnection = localStorage.getItem('lastWalletConnection');
        if (!lastConnection) {
            return wallets;
        }

        const data = JSON.parse(lastConnection);
        if (!data || !data.wallet || !data.accounts || !data.accounts.length) {
            return wallets;
        }

        // Build wallet objects based on the stored connection data
        if (data.wallet === 'metamask') {
            // Add each MetaMask account as a separate wallet
            data.accounts.forEach(account => {
                wallets.push({
                    id: `metamask-${account.toLowerCase()}`,
                    name: 'MetaMask',
                    address: formatAddress(account),
                    fullAddress: account,
                    chain: 'Polygon',
                    type: 'evm'
                });
            });
        } else if (data.wallet === 'phantom') {
            // Add Phantom wallet
            const phantomAddress = data.accounts[0];
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
        // Set user initiated connection flag
        localStorage.setItem('userInitiatedConnection', 'true');

        // Store the wallet connection details
        localStorage.setItem('lastWalletConnection', JSON.stringify({
            wallet: walletType,
            accounts: accounts,
            timestamp: Date.now()
        }));

        return true;
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