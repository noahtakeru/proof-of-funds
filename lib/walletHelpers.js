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

        // For Phantom, check if this is a new wallet and add it to the array
        if (walletType === 'phantom') {
            const newAccount = accounts[0]; // Phantom returns a single account
            const existingAccounts = walletData.wallets.phantom || [];

            // Check if this account is already in our list
            if (!existingAccounts.includes(newAccount)) {
                existingAccounts.push(newAccount);
                console.log('Added new Phantom wallet:', newAccount);
            } else {
                console.log('Phantom wallet already connected:', newAccount);
            }

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

// Get cryptocurrency price data from CoinGecko/CoinMarketCap
const getPriceData = async (assets) => {
    try {
        // For demonstration, we'll use CoinGecko API
        // In production, use API keys and implement proper rate limiting and fallback mechanisms
        const symbols = assets.map(asset => asset.symbol.toLowerCase()).join(',');
        const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${symbols}&vs_currencies=usd`);

        if (!response.ok) {
            throw new Error('Failed to fetch price data');
        }

        const priceData = await response.json();
        return priceData;
    } catch (error) {
        console.error('Error fetching price data:', error);
        throw error;
    }
};

// Scan assets across multiple chains
const scanMultiChainAssets = async (wallets) => {
    try {
        // Initialize with empty structure
        const assetSummary = {
            chains: {},
            totalAssets: [],
            wallets: wallets.map(wallet => ({
                chain: wallet.type === 'evm' ? (wallet.chain || 'ethereum').toLowerCase() : wallet.type,
                address: wallet.fullAddress
            })),
            totalUSDValue: 0,
            convertedAssets: []
        };

        // To avoid inconsistent return values causing re-renders,
        // we create a deterministic mock data set for development
        if (process.env.NODE_ENV === 'development' || typeof window === 'undefined') {
            // Use consistent mock data
            const mockData = {
                ethereum: {
                    nativeBalance: 1.25,
                    tokens: { USDC: 500, DAI: 100 }
                },
                polygon: {
                    nativeBalance: 250.5,
                    tokens: { USDC: 750, WETH: 0.5 }
                },
                solana: {
                    nativeBalance: 5.75,
                    tokens: { USDC: 1000, RAY: 25 }
                }
            };

            // Create mock chain data based on wallet types
            for (const wallet of wallets) {
                const chainKey = wallet.type === 'evm'
                    ? (wallet.chain || 'ethereum').toLowerCase()
                    : wallet.type;

                // Skip if we don't have mock data for this chain
                if (!mockData[chainKey]) continue;

                // Add chain data if not exists
                if (!assetSummary.chains[chainKey]) {
                    assetSummary.chains[chainKey] = {
                        nativeBalance: 0,
                        tokens: {}
                    };
                }

                // Add values from mock data
                assetSummary.chains[chainKey].nativeBalance += mockData[chainKey].nativeBalance;

                // Add token values
                Object.entries(mockData[chainKey].tokens).forEach(([symbol, balance]) => {
                    if (!assetSummary.chains[chainKey].tokens[symbol]) {
                        assetSummary.chains[chainKey].tokens[symbol] = 0;
                    }
                    assetSummary.chains[chainKey].tokens[symbol] += balance;
                });
            }

            // Calculate total assets
            for (const [chainKey, chainData] of Object.entries(assetSummary.chains)) {
                // Add native token to totalAssets
                const nativeSymbol = chainKey === 'ethereum' ? 'ETH' :
                    chainKey === 'polygon' ? 'MATIC' :
                        chainKey === 'solana' ? 'SOL' : chainKey.toUpperCase();

                if (chainData.nativeBalance > 0) {
                    assetSummary.totalAssets.push({
                        symbol: nativeSymbol,
                        balance: chainData.nativeBalance
                    });
                }

                // Add tokens to totalAssets
                Object.entries(chainData.tokens).forEach(([symbol, balance]) => {
                    // Check if this token is already in totalAssets
                    const existingAsset = assetSummary.totalAssets.find(a => a.symbol === symbol);
                    if (existingAsset) {
                        existingAsset.balance += balance;
                    } else {
                        assetSummary.totalAssets.push({
                            symbol,
                            balance
                        });
                    }
                });
            }

            return assetSummary;
        }

        // If not in development, process each wallet based on chain type
        for (const wallet of wallets) {
            // If this is an EVM chain wallet (Ethereum, Polygon, BSC)
            if (wallet.type === 'evm') {
                const chainId = wallet.chainId || (wallet.chain === 'Polygon' ? 137 : 1); // Default to mainnet
                const assets = await scanEVMWalletAssets(wallet.fullAddress, chainId);

                // Add chain data if not exists
                const chainKey = wallet.chain?.toLowerCase() || 'ethereum';
                if (!assetSummary.chains[chainKey]) {
                    assetSummary.chains[chainKey] = {
                        nativeBalance: 0,
                        tokens: {}
                    };
                }

                // Update chain balances
                assetSummary.chains[chainKey].nativeBalance += parseFloat(assets.nativeBalance || 0);

                // Update tokens
                for (const token of assets.tokens || []) {
                    if (!assetSummary.chains[chainKey].tokens[token.symbol]) {
                        assetSummary.chains[chainKey].tokens[token.symbol] = 0;
                    }
                    assetSummary.chains[chainKey].tokens[token.symbol] += parseFloat(token.balance);
                }

                // Add to total assets
                updateTotalAssets(assetSummary, assets);
            }
            // If Solana chain wallet
            else if (wallet.type === 'solana') {
                const assets = await scanSolanaWalletAssets(wallet.fullAddress);

                // Add chain data if not exists
                if (!assetSummary.chains.solana) {
                    assetSummary.chains.solana = {
                        nativeBalance: 0,
                        tokens: {}
                    };
                }

                // Update chain balances
                assetSummary.chains.solana.nativeBalance += parseFloat(assets.nativeBalance || 0);

                // Update tokens
                for (const token of assets.tokens || []) {
                    if (!assetSummary.chains.solana.tokens[token.symbol]) {
                        assetSummary.chains.solana.tokens[token.symbol] = 0;
                    }
                    assetSummary.chains.solana.tokens[token.symbol] += parseFloat(token.balance);
                }

                // Add to total assets
                updateTotalAssets(assetSummary, assets);
            }
        }

        return assetSummary;
    } catch (error) {
        console.error('Error scanning multi-chain assets:', error);
        throw error;
    }
};

// Helper to update total assets array
const updateTotalAssets = (assetSummary, assets) => {
    // Add native balance
    if (assets.nativeBalance && parseFloat(assets.nativeBalance) > 0) {
        const nativeSymbol = assets.nativeSymbol || 'ETH';
        const existingAsset = assetSummary.totalAssets.find(a => a.symbol === nativeSymbol);

        if (existingAsset) {
            existingAsset.balance += parseFloat(assets.nativeBalance);
        } else {
            assetSummary.totalAssets.push({
                symbol: nativeSymbol,
                balance: parseFloat(assets.nativeBalance)
            });
        }
    }

    // Add tokens
    for (const token of assets.tokens || []) {
        const existingToken = assetSummary.totalAssets.find(a => a.symbol === token.symbol);

        if (existingToken) {
            existingToken.balance += parseFloat(token.balance);
        } else {
            assetSummary.totalAssets.push({
                symbol: token.symbol,
                balance: parseFloat(token.balance)
            });
        }
    }
};

// Convert assets to USD equivalent
const convertAssetsToUSD = async (assetSummary) => {
    try {
        // Create a copy of the asset summary to avoid mutating the original
        const convertedSummary = JSON.parse(JSON.stringify(assetSummary));
        convertedSummary.convertedAssets = [];
        convertedSummary.totalUSDValue = 0;

        // For development and testing, use mock pricing data
        if (process.env.NODE_ENV === 'development' || typeof window === 'undefined') {
            // Fixed price mapping for development
            const mockPrices = {
                'ETH': 3500,
                'MATIC': 0.75,
                'SOL': 150,
                'BNB': 450,
                'USDC': 1.0,
                'DAI': 1.0,
                'WETH': 3500,
                'RAY': 5.0
            };

            // Calculate USD values for each asset
            for (const asset of assetSummary.totalAssets) {
                const price = mockPrices[asset.symbol] || 1.0; // Default to 1.0 if price not found
                const usdValue = asset.balance * price;

                convertedSummary.convertedAssets.push({
                    ...asset,
                    usdValue,
                    price
                });

                convertedSummary.totalUSDValue += usdValue;
            }

            // Also update chain-specific token values
            for (const [chainKey, chainData] of Object.entries(convertedSummary.chains)) {
                // Add USD value for native token
                const nativeSymbol = chainKey === 'ethereum' ? 'ETH' :
                    chainKey === 'polygon' ? 'MATIC' :
                        chainKey === 'solana' ? 'SOL' : chainKey.toUpperCase();

                const nativePrice = mockPrices[nativeSymbol] || 1.0;
                chainData.nativeUSDValue = chainData.nativeBalance * nativePrice;

                // Add USD values for tokens
                chainData.tokensUSDValue = {};
                Object.entries(chainData.tokens).forEach(([symbol, balance]) => {
                    const tokenPrice = mockPrices[symbol] || 1.0;
                    chainData.tokensUSDValue[symbol] = balance * tokenPrice;
                });
            }

            return convertedSummary;
        }

        // In production, fetch real prices from an API
        const priceMap = {};

        // Get list of all asset symbols
        const symbols = assetSummary.totalAssets.map(asset => asset.symbol);

        // Fetch prices for all symbols from a price API
        const prices = await fetchPricesForSymbols(symbols);

        // Create a price map
        for (const priceData of prices) {
            priceMap[priceData.symbol] = priceData.price;
        }

        // Calculate USD values for each asset
        for (const asset of assetSummary.totalAssets) {
            const price = priceMap[asset.symbol] || 0;
            const usdValue = asset.balance * price;

            convertedSummary.convertedAssets.push({
                ...asset,
                usdValue,
                price
            });

            convertedSummary.totalUSDValue += usdValue;
        }

        // Add USD values for chain-specific tokens
        for (const [chainKey, chainData] of Object.entries(convertedSummary.chains)) {
            // Get symbol for native token
            const nativeSymbol = chainKey === 'ethereum' ? 'ETH' :
                chainKey === 'polygon' ? 'MATIC' :
                    chainKey === 'solana' ? 'SOL' : chainKey.toUpperCase();

            // Add USD value for native token
            const nativePrice = priceMap[nativeSymbol] || 0;
            chainData.nativeUSDValue = chainData.nativeBalance * nativePrice;

            // Add USD values for tokens
            chainData.tokensUSDValue = {};
            Object.entries(chainData.tokens).forEach(([symbol, balance]) => {
                const tokenPrice = priceMap[symbol] || 0;
                chainData.tokensUSDValue[symbol] = balance * tokenPrice;
            });
        }

        return convertedSummary;
    } catch (error) {
        console.error('Error converting assets to USD:', error);
        return assetSummary; // Return original if conversion fails
    }
};

// Scan EVM wallet assets (Ethereum, Polygon, BSC)
const scanEVMWalletAssets = async (address, chainId) => {
    try {
        // For an actual implementation, you would:
        // 1. Use appropriate JSON-RPC endpoints for each chain
        // 2. Call eth_getBalance for native token balance
        // 3. Use token contract calls or indexers to get ERC20 token balances

        // This is a placeholder that returns mock data
        // In production, implement proper API calls to blockchain nodes or indexers

        // Use different native symbols based on chain ID
        let nativeSymbol = 'ETH';
        if (chainId === 137 || chainId === 80001) nativeSymbol = 'MATIC';
        if (chainId === 56) nativeSymbol = 'BNB';

        // Mock data - replace with actual API calls
        return {
            nativeBalance: '0.5', // Should be actual balance
            nativeSymbol,
            tokens: [
                { symbol: 'USDC', balance: '100.0' },
                { symbol: 'DAI', balance: '50.0' }
            ]
        };
    } catch (error) {
        console.error(`Error scanning EVM wallet assets for ${address}:`, error);
        throw error;
    }
};

// Scan Solana wallet assets
const scanSolanaWalletAssets = async (address) => {
    try {
        // For an actual implementation, you would:
        // 1. Use Solana Web3.js to connect to a Solana RPC node
        // 2. Query SOL balance and SPL token balances

        // This is a placeholder that returns mock data
        // In production, implement proper API calls to Solana nodes

        return {
            nativeBalance: '2.5',
            nativeSymbol: 'SOL',
            tokens: [
                { symbol: 'USDC', balance: '150.0' },
                { symbol: 'RAY', balance: '10.0' }
            ]
        };
    } catch (error) {
        console.error(`Error scanning Solana wallet assets for ${address}:`, error);
        throw error;
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
    clearAllWalletConnections,
    scanMultiChainAssets,
    convertAssetsToUSD
}; 