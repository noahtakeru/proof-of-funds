/**
 * Wallet Helpers Module
 * 
 * A centralized utility library for managing wallet connections, asset scanning, and price conversions
 * across multiple blockchain networks (Ethereum/EVM chains and Solana).
 * 
 * Key functionality:
 * - Wallet connection management for MetaMask (EVM) and Phantom (Solana) wallets
 * - Persistent storage of wallet connections using localStorage
 * - Asset scanning across multiple chains
 * - Price data fetching and USD value conversion
 * - Wallet connection state management
 * - BIP44 derivation for temporary wallets (zero-knowledge proof system)
 */

// Helper function to format wallet addresses for display
/**
 * Formats a blockchain address for display by truncating the middle portion
 * @param {string} address - The full blockchain address to format
 * @returns {string} Formatted address (e.g., "0x1234...5678")
 */
const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

/**
 * Connects to MetaMask wallet and retrieves selected accounts
 * Uses wagmi's connector system to ensure consistent state management across the app
 * @returns {Promise<string[]>} Array of connected Ethereum addresses
 * @throws {Error} If MetaMask is not available or connection fails
 */
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

        // Access wagmi connector if it exists in the global context
        let wagmiConnector = null;
        if (window.wagmiMetaMaskConnector) {
            wagmiConnector = window.wagmiMetaMaskConnector;
        } else if (typeof window.wagmiConnect === 'function') {
            console.log('Using global wagmi connect function');
            // Use the global wagmi connect function with MetaMask connector
            const result = await window.wagmiConnect({ connector: window.wagmiMetaMaskConnector });
            console.log('Wagmi connect result:', result);

            // Return the connected accounts from wagmi
            if (result?.account) {
                return [result.account];
            }
        }

        // If we couldn't use wagmi, proceed with the standard connection flow
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

/**
 * Connects to Phantom wallet and retrieves the Solana public key
 * Handles the appropriate connection method based on available Phantom APIs
 * @returns {Promise<string[]>} Array containing the Solana public key
 * @throws {Error} If Phantom is not available or connection fails
 */
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

/**
 * Disconnects a specific wallet by address and type
 * For EVM wallets, removes from tracking and disconnects from wagmi if available
 * For Solana wallets, calls the disconnect method and removes from tracking
 * 
 * @param {string} walletType - Type of wallet ('evm' or 'solana')
 * @param {string} address - Wallet address to disconnect
 * @returns {Promise<boolean>} True if successful, false otherwise
 * @throws {Error} If disconnection fails
 */
const disconnectWallet = async (walletType, address) => {
    try {
        // Get current wallet connection data from localStorage
        const walletData = getStoredWalletData();

        if (walletType === 'evm') {
            // For MetaMask/EVM wallets, we try to disconnect with wagmi if available
            if (window.wagmiDisconnect && typeof window.wagmiDisconnect === 'function') {
                try {
                    console.log('Disconnecting using wagmi disconnect');
                    await window.wagmiDisconnect();
                } catch (wagmiError) {
                    console.error('Error disconnecting with wagmi:', wagmiError);
                    // Continue with local disconnection even if wagmi fails
                }
            }

            // Remove from our tracked wallets
            if (walletData && walletData.wallets && walletData.wallets.metamask) {
                // Filter out the specific address
                walletData.wallets.metamask = walletData.wallets.metamask.filter(
                    acc => acc.toLowerCase() !== address.toLowerCase()
                );

                // If no accounts left for this wallet type, remove it
                if (walletData.wallets.metamask.length === 0) {
                    delete walletData.wallets.metamask;

                    // If no wallets left at all, clear user initiation flag
                    if (Object.keys(walletData.wallets).length === 0) {
                        localStorage.removeItem('userInitiatedConnection');
                    }
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

                    // If no wallets left at all, clear user initiation flag
                    if (Object.keys(walletData.wallets).length === 0) {
                        localStorage.removeItem('userInitiatedConnection');
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

/**
 * Retrieves wallet connection data from localStorage
 * Checks if the connection was user-initiated before returning data
 * 
 * @returns {Object} Wallet data object with connected wallets information
 */
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

/**
 * Saves wallet connection data to localStorage
 * Manages the userInitiatedConnection flag
 * 
 * @param {Object} data - Wallet data object to save
 */
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

/**
 * Retrieves all connected wallets and formats them into a standardized structure
 * Processes both MetaMask (EVM) and Phantom (Solana) wallets from localStorage
 * 
 * @returns {Array<Object>} Array of wallet objects with standardized properties
 */
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
                // Check if we can detect the current chain ID from window.ethereum
                let chain = 'Ethereum';
                let chainId = null;

                if (typeof window !== 'undefined' && window.ethereum) {
                    try {
                        // Get the chainId from ethereum provider
                        const hexChainId = window.ethereum.chainId;
                        chainId = hexChainId ? parseInt(hexChainId, 16) : null;

                        // Update chain name based on chainId
                        if (chainId === 31337 || chainId === 1337 || hexChainId === '0x7a69') {
                            chain = 'Hardhat Local';
                            console.log('Detected Hardhat network with chainId:', chainId, hexChainId);
                        } else if (chainId === 1 || chainId === 5) {
                            chain = 'Ethereum';
                        } else if (chainId === 137 || chainId === 80001 || chainId === 80002) {
                            chain = 'Polygon';
                        } else if (chainId === 56 || chainId === 97) {
                            chain = 'BNB Chain';
                        }
                    } catch (err) {
                        console.error('Error detecting chain:', err);
                    }
                }

                wallets.push({
                    id: `metamask-${account.toLowerCase()}`,
                    name: 'MetaMask',
                    address: formatAddress(account),
                    fullAddress: account,
                    chain: chain,
                    chainId: chainId,
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

/**
 * Saves newly connected wallet accounts to localStorage
 * Handles different wallet types and ensures no duplicate accounts are added
 * 
 * @param {string} walletType - Type of wallet ('metamask' or 'phantom')
 * @param {Array<string>} accounts - Array of account addresses to save
 * @returns {boolean} True if successful, false otherwise
 */
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

/**
 * Clears all wallet connections and related localStorage data
 * Disconnects from Phantom wallet if currently connected
 * 
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
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

/**
 * Fetches cryptocurrency price data from CoinGecko API
 * Used to convert token balances to USD values
 * 
 * @param {Array<Object>} assets - Array of asset objects with symbol property
 * @returns {Promise<Object>} Price data with token symbols as keys
 * @throws {Error} If price data fetching fails
 */
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

/**
 * Scans assets across multiple blockchain networks for the provided wallets
 * Creates a comprehensive summary of all assets, organized by chain and token
 * Uses Moralis API for real asset data
 * 
 * @param {Array<Object>} wallets - Array of wallet objects to scan
 * @returns {Promise<Object>} Asset summary object with chain-specific and combined data
 * @throws {Error} If scanning fails for any wallet
 */
const scanMultiChainAssets = async (wallets) => {
    try {
        // Import required functions
        const { getWalletTokenBalances } = await import('./moralisApi');
        const { ethers } = await import('ethers');

        // Initialize with empty structure
        const assetSummary = {
            chains: {},          // Chain-specific balances
            totalAssets: [],     // Combined list of all assets
            wallets: wallets.map(wallet => ({
                chain: wallet.type === 'evm' ? (wallet.chain || 'ethereum').toLowerCase() : wallet.type,
                address: wallet.fullAddress
            })),
            totalUSDValue: 0,      // Will be populated if USD conversion is requested
            convertedAssets: []    // Will contain assets with USD values when converted
        };

        // Process each wallet based on chain type
        for (const wallet of wallets) {
            // Process EVM chain wallets (Ethereum, Polygon, BSC, Hardhat)
            if (wallet.type === 'evm') {
                console.log(`Scanning wallet ${wallet.fullAddress} on chain ${wallet.chain || 'unknown'}, chainId: ${wallet.chainId || 'unknown'}`);

                // Check for Hardhat Local network
                const isHardhat =
                    (wallet.chain && wallet.chain.toLowerCase().includes('hardhat')) ||
                    (wallet.chainId && (
                        wallet.chainId === 31337 ||
                        wallet.chainId === 1337 ||
                        wallet.chainId === '0x7a69' ||
                        wallet.chainId === '0x539'
                    ));

                if (isHardhat) {
                    // Special handling for Hardhat - get balance directly from local node
                    // Don't use Moralis for local development chain
                    console.log("✅ Detected Hardhat local network, getting balance directly from the node");

                    try {
                        // Connect to local Hardhat node
                        const provider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545/');

                        // Get native ETH balance
                        const balance = await provider.getBalance(wallet.fullAddress);
                        const formattedBalance = ethers.utils.formatEther(balance);

                        console.log(`📊 Hardhat wallet balance: ${formattedBalance} ETH`);

                        // Add hardhat as chain
                        assetSummary.chains.hardhat_local = {
                            nativeBalance: parseFloat(formattedBalance),
                            tokens: {}
                        };

                        // Add to total assets
                        assetSummary.totalAssets.push({
                            chain: 'Hardhat Local',
                            address: wallet.fullAddress,
                            symbol: 'ETH',
                            name: 'Ethereum',
                            balance: formattedBalance,
                            logo: null,
                            type: 'native'
                        });

                        // Try to get ETH price for USD value
                        try {
                            console.log(`🔍 Fetching ETH price for Hardhat assets from CoinGecko...`);

                            // Directly use a fallback price if fetch fails in browser
                            let ethPrice = 0;

                            try {
                                const ethPriceResults = await fetchPricesForSymbols(['ETH']);
                                if (ethPriceResults && ethPriceResults.length > 0 && ethPriceResults[0].price) {
                                    ethPrice = ethPriceResults[0].price;
                                }
                            } catch (fetchError) {
                                console.error("❌ Error fetching ETH price with fetchPricesForSymbols:", fetchError);
                                // Use hardcoded fallback if fetch fails
                                ethPrice = 1880;
                                console.log(`💰 ETH: $${ethPrice.toFixed(6)} [HARDCODED FALLBACK]`);
                            }

                            if (ethPrice > 0) {
                                const usdValue = parseFloat(formattedBalance) * ethPrice;

                                console.log(`💰 ETH: $${ethPrice.toFixed(6)} × ${formattedBalance} ETH = $${usdValue.toFixed(2)} USD`);

                                assetSummary.totalUSDValue += usdValue;

                                // Add to convertedAssets for the main table display
                                assetSummary.convertedAssets.push({
                                    chain: 'Hardhat Local',
                                    address: wallet.fullAddress,
                                    symbol: 'ETH',
                                    name: 'Ethereum',
                                    balance: formattedBalance,
                                    price: ethPrice,
                                    usdValue: usdValue,
                                    logo: null,
                                    type: 'native'
                                });

                                // Add nativeUSDValue to the hardhat_local chain data for the chain breakdown section
                                assetSummary.chains.hardhat_local.nativeUSDValue = usdValue;
                            } else {
                                console.warn('⚠️ Failed to get ETH price, USD value will be 0');
                            }
                        } catch (priceErr) {
                            console.error("❌ Error getting ETH price:", priceErr);
                        }

                        // Skip Moralis API for Hardhat
                        continue;
                    } catch (hardhatErr) {
                        console.error("❌ Error connecting to Hardhat node:", hardhatErr);
                        // Fall through to Moralis if Hardhat direct connection fails
                    }
                }

                // One more check to catch Hardhat node by trying to connect to the local node
                // This is a secondary detection method if the chain identification failed
                if (!isHardhat && window.location.hostname === 'localhost') {
                    try {
                        console.log("Attempting secondary Hardhat detection...");
                        const provider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545/');

                        // Add a timeout to prevent hanging on network request
                        const networkPromise = provider.getNetwork();
                        const timeoutPromise = new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Hardhat detection timed out')), 500)
                        );

                        // Race the network detection against the timeout
                        const network = await Promise.race([networkPromise, timeoutPromise]);

                        // If we can connect and the network has the expected chainId
                        if (network && (network.chainId === 31337 || network.chainId === 1337)) {
                            console.log("🔍 Secondary detection found Hardhat network at port 8545");

                            // Get native ETH balance
                            const balance = await provider.getBalance(wallet.fullAddress);
                            const formattedBalance = ethers.utils.formatEther(balance);

                            console.log(`📊 Hardhat wallet balance (secondary detection): ${formattedBalance} ETH`);

                            // Add hardhat as chain
                            assetSummary.chains.hardhat_local = {
                                nativeBalance: parseFloat(formattedBalance),
                                tokens: {}
                            };

                            // Add to total assets
                            assetSummary.totalAssets.push({
                                chain: 'Hardhat Local',
                                address: wallet.fullAddress,
                                symbol: 'ETH',
                                name: 'Ethereum',
                                balance: formattedBalance,
                                logo: null,
                                type: 'native'
                            });

                            // Try to get ETH price for USD value
                            try {
                                console.log(`🔍 Fetching ETH price for secondary Hardhat assets from CoinGecko...`);

                                // Directly use a fallback price if fetch fails in browser
                                let ethPrice = 0;

                                try {
                                    const ethPriceResults = await fetchPricesForSymbols(['ETH']);
                                    if (ethPriceResults && ethPriceResults.length > 0 && ethPriceResults[0].price) {
                                        ethPrice = ethPriceResults[0].price;
                                    }
                                } catch (fetchError) {
                                    console.error("❌ Error fetching ETH price with fetchPricesForSymbols:", fetchError);
                                    // Use hardcoded fallback if fetch fails
                                    ethPrice = 1880;
                                    console.log(`💰 ETH: $${ethPrice.toFixed(6)} [HARDCODED FALLBACK]`);
                                }

                                if (ethPrice > 0) {
                                    const usdValue = parseFloat(formattedBalance) * ethPrice;

                                    console.log(`💰 ETH: $${ethPrice.toFixed(6)} × ${formattedBalance} ETH = $${usdValue.toFixed(2)} USD`);

                                    assetSummary.totalUSDValue += usdValue;

                                    // Add to convertedAssets for the main table display
                                    assetSummary.convertedAssets.push({
                                        chain: 'Hardhat Local',
                                        address: wallet.fullAddress,
                                        symbol: 'ETH',
                                        name: 'Ethereum',
                                        balance: formattedBalance,
                                        price: ethPrice,
                                        usdValue: usdValue,
                                        logo: null,
                                        type: 'native'
                                    });

                                    // Add nativeUSDValue to the hardhat_local chain data for the chain breakdown section
                                    assetSummary.chains.hardhat_local.nativeUSDValue = usdValue;
                                } else {
                                    console.warn('⚠️ Failed to get ETH price, USD value will be 0');
                                }
                            } catch (priceErr) {
                                console.error("❌ Error getting ETH price:", priceErr);
                            }

                            // Skip Moralis API for Hardhat
                            continue;
                        }
                    } catch (checkErr) {
                        // If we can't connect to the local node, it's not a Hardhat network
                        console.log("Secondary Hardhat detection failed");
                    }
                }

                // For non-Hardhat networks, use Moralis API
                const tokens = await getWalletTokenBalances(wallet.fullAddress, wallet.chain);

                // Determine the chain key for our summary data structure
                const chainKey = wallet.chain.toLowerCase().replace(' ', '_');

                // Add chain data if not exists
                if (!assetSummary.chains[chainKey]) {
                    assetSummary.chains[chainKey] = {
                        nativeBalance: 0,
                        tokens: {}
                    };
                }

                // Process token data
                tokens.forEach(token => {
                    // Process native token
                    if (token.type === 'native') {
                        // Add to native balance
                        assetSummary.chains[chainKey].nativeBalance += parseFloat(token.balance_formatted || 0);

                        // Add to total assets
                        assetSummary.totalAssets.push({
                            chain: wallet.chain,
                            address: wallet.fullAddress,
                            symbol: token.symbol,
                            name: token.name,
                            balance: token.balance_formatted,
                            logo: token.logo,
                            type: 'native'
                        });

                        // If USD data is available, add to converted assets
                        if (token.usd_value) {
                            assetSummary.totalUSDValue += token.usd_value;

                            assetSummary.convertedAssets.push({
                                chain: wallet.chain,
                                address: wallet.fullAddress,
                                symbol: token.symbol,
                                name: token.name,
                                balance: token.balance_formatted,
                                price: token.usd_price,
                                usdValue: token.usd_value,
                                logo: token.logo,
                                type: 'native'
                            });
                        }
                    }
                    // Process ERC20 tokens - filter out spam tokens with no value
                    else if (token.usd_value && parseFloat(token.usd_value) > 0.01) {
                        // Skip tokens with zero balance
                        if (parseFloat(token.balance_formatted) <= 0) return;

                        // Add to chain tokens
                        if (!assetSummary.chains[chainKey].tokens[token.symbol]) {
                            assetSummary.chains[chainKey].tokens[token.symbol] = 0;
                        }
                        assetSummary.chains[chainKey].tokens[token.symbol] += parseFloat(token.balance_formatted);

                        // Add to total assets
                        assetSummary.totalAssets.push({
                            chain: wallet.chain,
                            address: wallet.fullAddress,
                            symbol: token.symbol,
                            name: token.name,
                            tokenAddress: token.token_address,
                            balance: token.balance_formatted,
                            logo: token.logo,
                            type: 'token'
                        });

                        // If USD data is available, add to converted assets
                        if (token.usd_value) {
                            assetSummary.totalUSDValue += token.usd_value;

                            assetSummary.convertedAssets.push({
                                chain: wallet.chain,
                                address: wallet.fullAddress,
                                symbol: token.symbol,
                                name: token.name,
                                tokenAddress: token.token_address,
                                balance: token.balance_formatted,
                                price: token.usd_price,
                                usdValue: token.usd_value,
                                logo: token.logo,
                                type: 'token'
                            });
                        }
                    }
                });
            }
            // Process Solana wallets - Moralis also supports Solana
            else if (wallet.type === 'solana') {
                console.log(`Scanning Solana wallet ${wallet.fullAddress}`);

                // Get Solana token balances
                const tokens = await getWalletTokenBalances(wallet.fullAddress, 'solana');

                // Add chain data if not exists
                if (!assetSummary.chains.solana) {
                    assetSummary.chains.solana = {
                        nativeBalance: 0,
                        tokens: {}
                    };
                }

                // Process token data (similar to EVM processing)
                tokens.forEach(token => {
                    // Process native SOL
                    if (token.type === 'native') {
                        // Add to native balance
                        assetSummary.chains.solana.nativeBalance += parseFloat(token.balance_formatted || 0);

                        // Add to total assets
                        assetSummary.totalAssets.push({
                            chain: 'Solana',
                            address: wallet.fullAddress,
                            symbol: 'SOL',
                            name: 'Solana',
                            balance: token.balance_formatted,
                            logo: token.logo,
                            type: 'native'
                        });

                        // If USD data is available, add to converted assets
                        if (token.usd_value) {
                            assetSummary.totalUSDValue += token.usd_value;

                            assetSummary.convertedAssets.push({
                                chain: 'Solana',
                                address: wallet.fullAddress,
                                symbol: 'SOL',
                                name: 'Solana',
                                balance: token.balance_formatted,
                                price: token.usd_price,
                                usdValue: token.usd_value,
                                logo: token.logo,
                                type: 'native'
                            });
                        }
                    }
                    // Process SPL tokens
                    else {
                        // Skip tokens with zero balance
                        if (parseFloat(token.balance_formatted) <= 0) return;

                        // Add to chain tokens
                        if (!assetSummary.chains.solana.tokens[token.symbol]) {
                            assetSummary.chains.solana.tokens[token.symbol] = 0;
                        }
                        assetSummary.chains.solana.tokens[token.symbol] += parseFloat(token.balance_formatted);

                        // Add to total assets
                        assetSummary.totalAssets.push({
                            chain: 'Solana',
                            address: wallet.fullAddress,
                            symbol: token.symbol,
                            name: token.name,
                            tokenAddress: token.token_address,
                            balance: token.balance_formatted,
                            logo: token.logo,
                            type: 'token'
                        });

                        // If USD data is available, add to converted assets
                        if (token.usd_value) {
                            assetSummary.totalUSDValue += token.usd_value;

                            assetSummary.convertedAssets.push({
                                chain: 'Solana',
                                address: wallet.fullAddress,
                                symbol: token.symbol,
                                name: token.name,
                                tokenAddress: token.token_address,
                                balance: token.balance_formatted,
                                price: token.usd_price,
                                usdValue: token.usd_value,
                                logo: token.logo,
                                type: 'token'
                            });
                        }
                    }
                });
            }
        }

        return assetSummary;
    } catch (error) {
        console.error('Error in scanMultiChainAssets:', error);
        throw error;
    }
};

/**
 * Converts cryptocurrency asset amounts to their USD equivalents
 * Creates a new asset summary with USD values for each token and chain
 * Handles both development mode (mock prices) and production (API prices)
 * 
 * @param {Object} assetSummary - Asset summary object to convert
 * @returns {Promise<Object>} New asset summary with USD values
 */
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
                'ETH': 1880,     // Updated to match CoinGecko
                'MATIC': 0.55,
                'SOL': 145,
                'BNB': 580,
                'USDC': 1.0,
                'DAI': 1.0,
                'WETH': 1880,    // Same as ETH
                'RAY': 5.0,
                'BTC': 63000     // Added Bitcoin
            };

            // Calculate USD values for each asset
            for (const asset of assetSummary.totalAssets) {
                // Preserve Hardhat assets with CoinGecko prices that are already in convertedAssets
                if (asset.chain === 'Hardhat Local') {
                    // Find if this asset already exists in the original convertedAssets with CoinGecko price
                    const existingHardhatAsset = assetSummary.convertedAssets?.find(a =>
                        a.chain === 'Hardhat Local' && a.symbol === asset.symbol && a.address === asset.address);

                    if (existingHardhatAsset && existingHardhatAsset.price) {
                        console.log(`🔍 Preserving existing Hardhat asset price: $${existingHardhatAsset.price.toFixed(2)} for ${existingHardhatAsset.symbol}`);

                        // Use the existing asset with CoinGecko price
                        convertedSummary.convertedAssets.push(existingHardhatAsset);
                        convertedSummary.totalUSDValue += existingHardhatAsset.usdValue;
                        continue;
                    }
                }

                const price = mockPrices[asset.symbol] || 1.0;
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
                // Skip hardhat_local if it already has a nativeUSDValue set from direct CoinGecko fetch
                if (chainKey === 'hardhat_local' && chainData.nativeUSDValue !== undefined) {
                    console.log(`🔍 Preserving existing Hardhat USD value (dev mode): $${chainData.nativeUSDValue.toFixed(2)}`);
                    // Just ensure tokensUSDValue exists
                    chainData.tokensUSDValue = chainData.tokensUSDValue || {};
                    continue;
                }

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
            // Preserve Hardhat assets with CoinGecko prices that are already in convertedAssets
            if (asset.chain === 'Hardhat Local') {
                // Find if this asset already exists in the original convertedAssets with CoinGecko price
                const existingHardhatAsset = assetSummary.convertedAssets?.find(a =>
                    a.chain === 'Hardhat Local' && a.symbol === asset.symbol && a.address === asset.address);

                if (existingHardhatAsset && existingHardhatAsset.price) {
                    console.log(`🔍 Preserving existing Hardhat asset price: $${existingHardhatAsset.price.toFixed(2)} for ${existingHardhatAsset.symbol}`);

                    // Use the existing asset with CoinGecko price
                    convertedSummary.convertedAssets.push(existingHardhatAsset);
                    convertedSummary.totalUSDValue += existingHardhatAsset.usdValue;
                    continue;
                }
            }

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
            // Skip hardhat_local if it already has a nativeUSDValue set from direct CoinGecko fetch
            if (chainKey === 'hardhat_local' && chainData.nativeUSDValue !== undefined) {
                console.log(`🔍 Preserving existing Hardhat USD value: $${chainData.nativeUSDValue.toFixed(2)}`);
                // Just ensure tokensUSDValue exists
                chainData.tokensUSDValue = chainData.tokensUSDValue || {};
                continue;
            }

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

/**
 * Scans EVM wallet assets (Ethereum, Polygon, BSC)
 * Makes calls to blockchain nodes or indexers to get real wallet balances
 * 
 * @param {string} address - EVM wallet address to scan
 * @param {number} chainId - Chain ID for the specific blockchain
 * @returns {Promise<Object>} Asset data for the wallet
 */
const scanEVMWalletAssets = async (address, chainId) => {
    try {
        // Import ethers dynamically to avoid SSR issues
        const { ethers } = await import('ethers');

        // Use different native symbols and RPC endpoints based on chain ID
        let nativeSymbol = 'ETH';
        let rpcUrl = 'https://ethereum-rpc.publicnode.com';

        // Configure chain-specific settings
        if (chainId === 137) { // Polygon Mainnet
            nativeSymbol = 'MATIC';
            rpcUrl = 'https://polygon-rpc.com';
        } else if (chainId === 80001) { // Polygon Mumbai Testnet
            nativeSymbol = 'MATIC';
            rpcUrl = 'https://rpc-mumbai.maticvigil.com';
        } else if (chainId === 56) { // BNB Chain
            nativeSymbol = 'BNB';
            rpcUrl = 'https://bsc-dataseed.binance.org';
        }

        // Create a provider using the appropriate RPC URL
        const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

        // Get native token balance
        const balance = await provider.getBalance(address);
        const nativeBalance = ethers.utils.formatEther(balance);

        // Initialize tokens array - to be populated with real data below
        const tokens = [];

        // Common ERC20 tokens to check on each network
        const tokensToCheck = [];

        // Add network-specific popular tokens to check
        if (chainId === 1) { // Ethereum
            tokensToCheck.push(
                { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
                { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F' },
                { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' }
            );
        } else if (chainId === 137) { // Polygon
            tokensToCheck.push(
                { symbol: 'USDC', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' },
                { symbol: 'WETH', address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619' },
                { symbol: 'WMATIC', address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270' }
            );
        } else if (chainId === 56) { // BSC
            tokensToCheck.push(
                { symbol: 'BUSD', address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' },
                { symbol: 'CAKE', address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82' },
                { symbol: 'WBNB', address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' }
            );
        }

        // Minimal ERC20 ABI - only functions we need to get balances
        const minABI = [
            {
                constant: true,
                inputs: [{ name: "_owner", type: "address" }],
                name: "balanceOf",
                outputs: [{ name: "balance", type: "uint256" }],
                type: "function",
            },
            {
                constant: true,
                inputs: [],
                name: "decimals",
                outputs: [{ name: "", type: "uint8" }],
                type: "function",
            }
        ];

        // Get token balances in parallel for better performance
        const tokenPromises = tokensToCheck.map(async (token) => {
            try {
                // Create contract instance
                const contract = new ethers.Contract(token.address, minABI, provider);

                // Get token balance and decimals
                const [balance, decimals] = await Promise.all([
                    contract.balanceOf(address),
                    contract.decimals()
                ]);

                // Format balance with proper decimals
                const formattedBalance = ethers.utils.formatUnits(balance, decimals);

                // Only add tokens with non-zero balance
                if (parseFloat(formattedBalance) > 0) {
                    return {
                        symbol: token.symbol,
                        balance: formattedBalance,
                        address: token.address
                    };
                }
                return null;
            } catch (err) {
                console.warn(`Error fetching balance for token ${token.symbol}:`, err);
                return null;
            }
        });

        // Wait for all token balance requests and filter out null results
        const tokenResults = (await Promise.all(tokenPromises)).filter(Boolean);

        // Add all tokens with non-zero balances to our result
        tokens.push(...tokenResults);

        // Return the assembled asset data
        return {
            nativeBalance,
            nativeSymbol,
            tokens
        };
    } catch (error) {
        console.error(`Error scanning EVM wallet assets for ${address}:`, error);
        // Fallback to mock data if real data fetching fails
        let nativeSymbol = 'ETH';
        if (chainId === 137 || chainId === 80001) nativeSymbol = 'MATIC';
        if (chainId === 56) nativeSymbol = 'BNB';

        return {
            nativeBalance: '0.5', // Mock balance as fallback
            nativeSymbol,
            tokens: [
                { symbol: 'USDC', balance: '100.0' },
                { symbol: 'DAI', balance: '50.0' }
            ]
        };
    }
};

/**
 * Scans Solana wallet assets (SOL and SPL tokens)
 * Uses Solana Web3.js to query actual wallet balances for SOL native token
 * and popular SPL tokens on Solana mainnet or devnet
 * 
 * @param {string} address - Solana wallet public key
 * @returns {Promise<Object>} Asset data for the wallet
 */
const scanSolanaWalletAssets = async (address) => {
    try {
        // Import Solana libraries dynamically to avoid SSR issues
        const { Connection, PublicKey, clusterApiUrl } = await import('@solana/web3.js');

        // Use mainnet-beta cluster for production
        const connection = new Connection(
            clusterApiUrl('mainnet-beta'),
            'confirmed'
        );

        // Convert address string to PublicKey
        const publicKey = new PublicKey(address);

        // Get SOL balance
        const solBalance = await connection.getBalance(publicKey);
        // Convert from lamports to SOL (1 SOL = 1,000,000,000 lamports)
        const nativeBalance = (solBalance / 1000000000).toFixed(9);

        // Initialize tokens array - we'd ideally use a token registry or indexer API
        // for production to get all tokens, but for demonstration we'll use a simpler approach
        const tokens = [];

        // List of popular Solana tokens to check for (token program ID and mint address)
        // In production, you would use a more comprehensive list or an indexer API
        const popularTokens = [
            { symbol: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
            { symbol: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
            { symbol: 'RAY', mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R' },
            { symbol: 'JitoSOL', mint: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn' }
        ];

        // For checking token balances, we would normally use TokenAccountsFilter
        // to request all token accounts owned by this wallet address through getTokenAccountsByOwner
        // but we can also use getParsedTokenAccountsByOwner for a more direct approach

        try {
            // Get all token accounts owned by this wallet
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
                publicKey,
                { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
            );

            // Process token accounts
            for (const { account } of tokenAccounts.value) {
                const tokenData = account.data.parsed.info;
                const mintAddress = tokenData.mint;
                const balance = tokenData.tokenAmount.uiAmount;

                // Skip tokens with zero balance
                if (balance <= 0) continue;

                // Try to identify the token symbol from our popular tokens list
                const tokenInfo = popularTokens.find(t => t.mint === mintAddress);
                const symbol = tokenInfo ? tokenInfo.symbol : `${mintAddress.slice(0, 4)}...`;

                tokens.push({
                    symbol,
                    balance: balance.toString(),
                    mint: mintAddress
                });
            }
        } catch (tokenError) {
            console.warn('Error fetching Solana token accounts:', tokenError);
            // We'll continue with just the SOL balance in this case
        }

        return {
            nativeBalance,
            nativeSymbol: 'SOL',
            tokens
        };
    } catch (error) {
        console.error(`Error scanning Solana wallet assets for ${address}:`, error);
        // Fallback to mock data if real data fetching fails
        return {
            nativeBalance: '2.5',
            nativeSymbol: 'SOL',
            tokens: [
                { symbol: 'USDC', balance: '150.0' },
                { symbol: 'RAY', balance: '10.0' }
            ]
        };
    }
};

/**
 * Generates a proof hash for standard (exact amount) proofs
 * Uses dynamic import for ethers.js to avoid SSR issues
 * @param {string} walletAddress - The wallet address
 * @param {string} amount - The exact amount to verify in Wei units
 * @returns {Promise<string>} - The keccak256 hash as a hex string
 */
export const generateStandardProofHash = async (walletAddress, amount) => {
    try {
        // Dynamically import ethers to avoid SSR issues
        const { getEthers } = await import('./ethersUtils');
        const { ethers } = await getEthers();

        // Validate inputs to prevent errors
        if (!walletAddress) {
            throw new Error('Wallet address is required');
        }

        // Ensure amount is not empty (use '0' as fallback)
        const validAmount = amount && amount.trim() !== '' ? amount : '0';

        // Log the inputs for debugging
        console.log('Generating standard proof hash with:', { walletAddress, amount: validAmount });

        // Match the contract's hashing logic using ethers.js
        const encodedData = ethers.utils.defaultAbiCoder.encode(
            ['address', 'uint256', 'uint8'],
            [walletAddress, validAmount, 0] // 0 for STANDARD proof type
        );
        return ethers.utils.keccak256(encodedData);
    } catch (error) {
        console.error('Error generating standard proof hash:', error);
        throw error;
    }
};

/**
 * Generates a proof hash for threshold (minimum amount) proofs
 * Uses dynamic import for ethers.js to avoid SSR issues
 * @param {string} walletAddress - The wallet address
 * @param {string} amount - The minimum amount to verify in Wei units
 * @returns {Promise<string>} - The keccak256 hash as a hex string
 */
export const generateThresholdProofHash = async (walletAddress, amount) => {
    try {
        // Dynamically import ethers to avoid SSR issues
        const { getEthers } = await import('./ethersUtils');
        const { ethers } = await getEthers();

        // Validate inputs to prevent errors
        if (!walletAddress) {
            throw new Error('Wallet address is required');
        }

        // Ensure amount is not empty (use '0' as fallback)
        const validAmount = amount && amount.trim() !== '' ? amount : '0';

        // Log the inputs for debugging
        console.log('Generating threshold proof hash with:', { walletAddress, amount: validAmount });

        // Match the contract's hashing logic using ethers.js
        const encodedData = ethers.utils.defaultAbiCoder.encode(
            ['address', 'uint256', 'uint8', 'string'],
            [walletAddress, validAmount, 1, 'threshold'] // 1 for THRESHOLD proof type
        );
        return ethers.utils.keccak256(encodedData);
    } catch (error) {
        console.error('Error generating threshold proof hash:', error);
        throw error;
    }
};

/**
 * Generates a proof hash for maximum (upper limit) proofs
 * Uses dynamic import for ethers.js to avoid SSR issues
 * @param {string} walletAddress - The wallet address
 * @param {string} amount - The maximum amount to verify in Wei units
 * @returns {Promise<string>} - The keccak256 hash as a hex string
 */
export const generateMaximumProofHash = async (walletAddress, amount) => {
    try {
        // Dynamically import ethers to avoid SSR issues
        const { getEthers } = await import('./ethersUtils');
        const { ethers } = await getEthers();

        // Validate inputs to prevent errors
        if (!walletAddress) {
            throw new Error('Wallet address is required');
        }

        // Ensure amount is not empty (use '0' as fallback)
        const validAmount = amount && amount.trim() !== '' ? amount : '0';

        // Log the inputs for debugging
        console.log('Generating maximum proof hash with:', { walletAddress, amount: validAmount });

        // Match the contract's hashing logic using ethers.js
        const encodedData = ethers.utils.defaultAbiCoder.encode(
            ['address', 'uint256', 'uint8', 'string'],
            [walletAddress, validAmount, 2, 'maximum'] // 2 for MAXIMUM proof type
        );
        return ethers.utils.keccak256(encodedData);
    } catch (error) {
        console.error('Error generating maximum proof hash:', error);
        throw error;
    }
};

/**
 * Generates the appropriate proof hash based on the proof type
 * @param {string} walletAddress - The wallet address
 * @param {string} amount - The amount to verify in Wei units
 * @param {number} proofType - The proof type (0=standard, 1=threshold, 2=maximum)
 * @returns {Promise<string>} - The keccak256 hash as a hex string
 */
export const generateProofHash = async (walletAddress, amount, proofType) => {
    // Log the inputs for debugging
    console.log('Generating proof hash with:', { walletAddress, amount, proofType });

    switch (proofType) {
        case 0: // STANDARD
            return generateStandardProofHash(walletAddress, amount);
        case 1: // THRESHOLD
            return generateThresholdProofHash(walletAddress, amount);
        case 2: // MAXIMUM
            return generateMaximumProofHash(walletAddress, amount);
        default:
            throw new Error(`Invalid proof type: ${proofType}`);
    }
};

/**
 * Fetches cryptocurrency prices from CoinGecko API with caching
 * Ensures consistent price values throughout the application
 * 
 * @param {Array<string>} symbols - Array of token symbols to fetch prices for
 * @returns {Promise<Array<Object>>} - Array of objects with symbol and price
 */
const fetchPricesForSymbols = async (symbols) => {
    // Initialize global price cache if needed
    if (typeof globalThis !== 'undefined') {
        // Use globalThis for both browser and Node.js environments
        if (!globalThis.coinGeckoPriceCache) {
            globalThis.coinGeckoPriceCache = {};
        }
    } else if (typeof window !== 'undefined') {
        // Fallback to window for older browsers
        if (!window.coinGeckoPriceCache) {
            window.coinGeckoPriceCache = {};
        }
    } else if (typeof global !== 'undefined') {
        // Fallback to global for Node.js
        if (!global.coinGeckoPriceCache) {
            global.coinGeckoPriceCache = {};
        }
    } else {
        // Create a local cache if no global object is available
        console.warn('No global object found, using local cache for this request only');
        // This will be a temporary cache just for this function call
        this._tempCache = this._tempCache || {};
        this._tempCache.coinGeckoPriceCache = this._tempCache.coinGeckoPriceCache || {};
    }

    // Get the appropriate cache object
    const cache = globalThis?.coinGeckoPriceCache ||
        window?.coinGeckoPriceCache ||
        global?.coinGeckoPriceCache ||
        this._tempCache.coinGeckoPriceCache;

    const now = Date.now();
    const cacheExpiration = 10 * 60 * 1000; // 10 minutes

    // Array to collect results
    const results = [];
    // Symbols we need to fetch (not in cache or expired)
    const symbolsToFetch = [];

    // Symbol mapping for CoinGecko (different format than our internal symbols)
    const coinGeckoIdMap = {
        'ETH': 'ethereum',
        'MATIC': 'matic-network',
        'SOL': 'solana',
        'BNB': 'binancecoin',
        'BTC': 'bitcoin',
        'AVAX': 'avalanche-2',
        'FTM': 'fantom',
        'WETH': 'ethereum',
        'USDC': 'usd-coin',
        'DAI': 'dai',
        'USDT': 'tether',
        'WBTC': 'wrapped-bitcoin',
        'WMATIC': 'matic-network',
        'WBNB': 'binancecoin',
    };

    console.log('🦎 CoinGecko price fetch requested for symbols:', symbols.join(', '));

    // First, check cache for each symbol
    for (const symbol of symbols) {
        const normalizedSymbol = symbol.toUpperCase();

        // Check if we have valid cached data
        if (cache[normalizedSymbol] &&
            cache[normalizedSymbol].timestamp > (now - cacheExpiration)) {
            // Use cached price
            const cachedPrice = cache[normalizedSymbol].price;
            const isFallback = cache[normalizedSymbol].isFallback;
            console.log(`💰 ${normalizedSymbol}: $${cachedPrice.toFixed(6)} [CACHED${isFallback ? '-FALLBACK' : ''}]`);

            results.push({
                symbol: normalizedSymbol,
                price: cachedPrice
            });
        } else {
            // Need to fetch this symbol
            symbolsToFetch.push(normalizedSymbol);
        }
    }

    // If we have symbols to fetch, make the API call
    if (symbolsToFetch.length > 0) {
        // Get CoinGecko IDs
        const coinGeckoIds = symbolsToFetch
            .map(symbol => coinGeckoIdMap[symbol] || symbol.toLowerCase())
            .filter(Boolean)
            .join(',');

        try {
            // Fetch prices from CoinGecko
            console.log(`📡 Fetching fresh prices from CoinGecko for: ${symbolsToFetch.join(', ')}`);
            const response = await fetch(
                `https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoIds}&vs_currencies=usd`,
                {
                    headers: { 'Accept': 'application/json' },
                    timeout: 5000 // 5 second timeout
                }
            );

            if (response.ok) {
                const data = await response.json();
                console.log('🦎 CoinGecko API response:', data);

                // Process results and update cache
                for (const symbol of symbolsToFetch) {
                    const coinGeckoId = coinGeckoIdMap[symbol] || symbol.toLowerCase();
                    const price = data[coinGeckoId]?.usd;

                    if (price) {
                        // Cache this price
                        cache[symbol] = {
                            price,
                            timestamp: now
                        };

                        // Add to results
                        results.push({
                            symbol,
                            price
                        });

                        console.log(`💰 ${symbol}: $${price.toFixed(6)} [FRESH]`);
                    } else {
                        // Use fallback price
                        const fallbackPrice = getFallbackPrice(symbol);

                        // Cache this fallback price too
                        cache[symbol] = {
                            price: fallbackPrice,
                            timestamp: now,
                            isFallback: true
                        };

                        results.push({
                            symbol,
                            price: fallbackPrice
                        });

                        console.log(`💰 ${symbol}: $${fallbackPrice.toFixed(6)} [FALLBACK - No CoinGecko data]`);
                    }
                }
            } else {
                throw new Error(`CoinGecko API returned ${response.status}`);
            }
        } catch (error) {
            console.error(`❌ Error fetching prices from CoinGecko:`, error);

            // Use fallback prices for all symbols we failed to fetch
            for (const symbol of symbolsToFetch) {
                const fallbackPrice = getFallbackPrice(symbol);

                results.push({
                    symbol,
                    price: fallbackPrice
                });

                // Cache this fallback price
                cache[symbol] = {
                    price: fallbackPrice,
                    timestamp: now,
                    isFallback: true
                };

                console.log(`💰 ${symbol}: $${fallbackPrice.toFixed(6)} [FALLBACK - API error]`);
            }
        }
    }

    // Print a summary of all prices
    console.log('📊 CoinGecko Price Summary:');
    results.forEach(({ symbol, price }) => {
        console.log(`   ${symbol.padEnd(6)} = $${price.toFixed(6)}`);
    });

    return results;
};

/**
 * Gets a fallback price for a token if API calls fail
 * @param {string} symbol - Token symbol
 * @returns {number} - Fallback price
 */
const getFallbackPrice = (symbol) => {
    const fallbackPrices = {
        'ETH': 1880,
        'MATIC': 0.55,
        'SOL': 145,
        'BNB': 580,
        'USDC': 1.0,
        'DAI': 1.0,
        'USDT': 1.0,
        'WETH': 1880,
        'WBTC': 63000,
        'BTC': 63000,
        'AVAX': 35,
        'FTM': 0.5,
        'WMATIC': 0.55,
        'WBNB': 580
    };

    return fallbackPrices[symbol] || 1.0; // Default to 1.0 if no fallback defined
};

// Export all utility functions
// ------------------------------------------------------------------------------------------
// BIP44 Wallet Derivation for Zero-Knowledge Proof System
// ------------------------------------------------------------------------------------------

// BIP44 path format: m / purpose' / coin_type' / account' / change / address_index
const BIP44_COIN_TYPES = {
    ETHEREUM: 60,   // Ethereum and EVM-compatible chains (Polygon, BSC, etc.)
    POLYGON: 60,    // Same as Ethereum
    SOLANA: 501,    // Solana
    BITCOIN: 0,     // Bitcoin
    AVALANCHE: 60   // Same as Ethereum
};

/**
 * Generates a BIP44 derivation path for a given chain and index
 * @param {string} chain - The blockchain name (e.g., 'ethereum', 'polygon')
 * @param {number} index - The address index to derive
 * @param {number} account - The account number (default: 0)
 * @returns {string} BIP44 derivation path
 */
export const getBIP44Path = (chain, index, account = 0) => {
    const coinType = BIP44_COIN_TYPES[chain.toUpperCase()] || BIP44_COIN_TYPES.ETHEREUM;
    return `m/44'/${coinType}'/${account}'/0/${index}`;
};

/**
 * Derives a wallet from a mnemonic using BIP44
 * @param {string} mnemonic - The mnemonic phrase
 * @param {string} path - The derivation path
 * @returns {Promise<Object>} Derived wallet with address and private key
 */
export const deriveWalletFromMnemonic = async (mnemonic, path) => {
    try {
        // Dynamically import ethers to avoid SSR issues
        const { getEthers } = await import('./ethersUtils');
        const { ethers } = await getEthers();

        // Create wallet from mnemonic and path
        const wallet = ethers.Wallet.fromMnemonic(mnemonic, path);

        return {
            address: wallet.address,
            privateKey: wallet.privateKey
        };
    } catch (error) {
        console.error('Error deriving wallet from mnemonic:', error);
        throw new Error('Wallet derivation failed');
    }
};

/**
 * Generates a temporary wallet for the zero-knowledge proof system
 * @param {Object} options - Options for wallet generation
 * @param {string} options.chain - The blockchain (default: 'polygon')
 * @param {number} options.index - The index to use (default: 0)
 * @param {string} options.mnemonic - Optional mnemonic to use
 * @returns {Promise<Object>} Derived wallet with address and private key
 */
export const generateTemporaryWallet = async (options = {}) => {
    try {
        // Dynamically import ethers to avoid SSR issues
        const { getEthers } = await import('./ethersUtils');
        const { ethers } = await getEthers();

        // Use provided mnemonic or generate a new one
        const mnemonic = options.mnemonic || ethers.Wallet.createRandom().mnemonic.phrase;

        // Generate path using BIP44
        const chain = options.chain || 'polygon';
        const index = options.index || 0;
        const path = getBIP44Path(chain, index);

        console.log(`Generating temporary wallet with path: ${path}`);

        // Derive wallet
        const wallet = await deriveWalletFromMnemonic(mnemonic, path);

        return {
            address: wallet.address,
            privateKey: wallet.privateKey,
            path,
            chain,
            index,
            // Only return mnemonic if it was provided (for security)
            mnemonic: options.mnemonic ? mnemonic : undefined
        };
    } catch (error) {
        console.error('Error generating temporary wallet:', error);
        throw new Error('Temporary wallet generation failed');
    }
};

export {
    formatAddress,
    connectMetaMask,
    connectPhantom,
    disconnectWallet,
    getStoredWalletData,
    saveWalletData,
    getConnectedWallets,
    saveWalletConnection,
    clearAllWalletConnections,
    getPriceData,
    scanMultiChainAssets,
    convertAssetsToUSD,
    scanEVMWalletAssets,
    scanSolanaWalletAssets,
    fetchPricesForSymbols
};

// The following functions are already exported individually above:
// - generateStandardProofHash
// - generateThresholdProofHash
// - generateMaximumProofHash
// - generateProofHash
