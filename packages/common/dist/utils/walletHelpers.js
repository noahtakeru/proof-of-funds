/**
 * Wallet Helpers Module
 * 
 * This module provides utility functions for interacting with cryptocurrency wallets.
 */

/**
 * Get a list of all connected wallets
 * @returns {Array} Array of connected wallet objects
 */
export function getConnectedWallets() {
  try {
    if (typeof localStorage === 'undefined') {
      console.warn('localStorage not available, cannot retrieve wallet connections');
      return [];
    }
    
    const walletData = localStorage.getItem('walletData');
    if (!walletData) {
      return [];
    }
    
    const parsedData = JSON.parse(walletData);
    
    if (!parsedData.wallets) {
      return [];
    }
    
    const connectedWallets = [];
    
    // Add MetaMask wallets
    if (parsedData.wallets.metamask && Array.isArray(parsedData.wallets.metamask)) {
      connectedWallets.push(...parsedData.wallets.metamask);
    }
    
    // Add Phantom wallets
    if (parsedData.wallets.phantom && Array.isArray(parsedData.wallets.phantom)) {
      connectedWallets.push(...parsedData.wallets.phantom);
    }
    
    return connectedWallets;
  } catch (error) {
    console.error('Error retrieving connected wallets:', error);
    return [];
  }
}

/**
 * Save a wallet connection
 * @param {string} walletType - Type of wallet ('metamask', 'phantom', etc.)
 * @param {Array|Object} accounts - Array of wallet addresses or single wallet object
 * @returns {Promise<boolean>} Success or failure
 * @throws {Error} If parameters are invalid
 */
export async function saveWalletConnection(walletType, accounts) {
  if (!walletType || !accounts) {
    throw new Error('Missing required parameters');
  }
  
  try {
    if (typeof localStorage === 'undefined') {
      console.warn('localStorage not available, cannot save wallet connection');
      return false;
    }
    
    console.log(`Saving wallet connection for ${walletType}:`, accounts);
    
    // Get existing wallet data or initialize new structure
    let walletData;
    try {
      const storedData = localStorage.getItem('walletData');
      walletData = storedData ? JSON.parse(storedData) : { wallets: {} };
    } catch (error) {
      console.error('Error parsing stored wallet data, initializing new data structure:', error);
      walletData = { wallets: {} };
    }
    
    // Ensure wallets object exists
    if (!walletData.wallets) {
      walletData.wallets = {};
    }
    
    // Process accounts based on wallet type
    if (walletType === 'metamask' || walletType === 'evm') {
      // Initialize metamask wallet array if needed
      if (!walletData.wallets.metamask || !Array.isArray(walletData.wallets.metamask)) {
        walletData.wallets.metamask = [];
      }
      
      // Handle both array and single wallet object
      const walletArray = Array.isArray(accounts) ? accounts : [accounts];
      
      // Clear existing metamask wallets if we're explicitly setting new ones
      walletData.wallets.metamask = [];
      
      // Add each wallet
      for (const wallet of walletArray) {
        if (typeof wallet === 'string') {
          // If it's just an address string
          const address = wallet;
          const displayAddress = address.length > 10 
            ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` 
            : address;
            
          walletData.wallets.metamask.push({
            id: `metamask-${address.substring(2, 10)}`,
            address: address,
            displayAddress: displayAddress,
            fullAddress: address,
            type: 'evm',
            provider: 'metamask',
            name: `MetaMask ${displayAddress}`,
            chain: 'ethereum', // Default to ethereum
            connected: true,
            connectedAt: new Date().toISOString()
          });
        } else if (typeof wallet === 'object' && wallet !== null) {
          // If it's a wallet object, add it directly
          walletData.wallets.metamask.push(wallet);
        }
      }
    } else if (walletType === 'phantom' || walletType === 'solana') {
      // Initialize phantom wallet array if needed
      if (!walletData.wallets.phantom || !Array.isArray(walletData.wallets.phantom)) {
        walletData.wallets.phantom = [];
      }
      
      // Handle both array and single wallet object
      const walletArray = Array.isArray(accounts) ? accounts : [accounts];
      
      // Add each wallet
      for (const wallet of walletArray) {
        if (typeof wallet === 'string') {
          // If it's just an address string
          const address = wallet;
          const displayAddress = address.length > 10 
            ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` 
            : address;
            
          walletData.wallets.phantom.push({
            id: `phantom-${address.substring(0, 8)}`,
            address: address,
            displayAddress: displayAddress,
            fullAddress: address,
            type: 'solana',
            provider: 'phantom',
            name: `Phantom ${displayAddress}`,
            chain: 'solana',
            connected: true,
            connectedAt: new Date().toISOString()
          });
        } else if (typeof wallet === 'object' && wallet !== null) {
          // If it's a wallet object, add it directly
          walletData.wallets.phantom.push(wallet);
        }
      }
    }
    
    // Save updated wallet data
    localStorage.setItem('walletData', JSON.stringify(walletData));
    console.log('Wallet data saved successfully');
    
    // Dispatch wallet connection change event
    if (typeof window !== 'undefined') {
      const walletChangeEvent = new CustomEvent('wallet-connection-changed', {
        detail: { timestamp: Date.now(), walletType }
      });
      window.dispatchEvent(walletChangeEvent);
    }
    
    return true;
  } catch (error) {
    console.error('Error saving wallet connection:', error);
    return false;
  }
}

/**
 * Connect to MetaMask wallet
 * @returns {Promise<Object>} Connected wallet info
 * @throws {Error} If MetaMask is not installed or connection fails
 */
export async function connectMetaMask() {
  if (typeof window === 'undefined') {
    throw new Error('Cannot connect to MetaMask in a non-browser environment');
  }
  
  // Detect browser environment
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  // Log ethereum provider details to help with debugging
  console.log('Environment check:', { 
    hasEthereum: !!window.ethereum,
    isMetaMask: window.ethereum?.isMetaMask,
    hasProviders: !!window.ethereum?.providers,
    providerCount: window.ethereum?.providers?.length,
    userAgent: navigator.userAgent,
    isSafari,
    isMobile
  });
  
  if (!window.ethereum) {
    if (isMobile) {
      throw new Error('MetaMask not detected. On mobile, please use the MetaMask mobile app browser.');
    } else {
      throw new Error('MetaMask is not installed. Please install the MetaMask browser extension to use this feature.');
    }
  }
  
  // If we have multiple providers (common with multiple wallets installed)
  // explicitly try to find MetaMask
  let provider = window.ethereum;
  if (window.ethereum.providers) {
    const metaMaskProvider = window.ethereum.providers.find(p => p.isMetaMask);
    if (metaMaskProvider) {
      console.log('Using dedicated MetaMask provider from multiple providers');
      provider = metaMaskProvider;
    }
  }
  
  try {
    console.log('Requesting MetaMask accounts...');
    
    // Clear localStorage items that might affect connection
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('wagmi.connected');
        localStorage.removeItem('wagmi.connectors');
        localStorage.removeItem('wagmi.injected.shimDisconnect');
      } catch (e) {
        console.log('Non-critical localStorage cleanup error:', e);
      }
    }
    
    // Simplified connection approach - directly request accounts with force parameter
    const accounts = await provider.request({
      method: 'eth_requestAccounts',
      params: [{ force: true }]
    });
    
    console.log('MetaMask returned accounts:', accounts);
    
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found. Please unlock MetaMask and try again.');
    }
    
    // Get the connected wallet address
    const address = accounts[0];
    
    if (!address) {
      throw new Error('Failed to get wallet address');
    }
    
    // Get the current chain ID with better error handling
    let chainIdHex, chainId, chainName;
    
    try {
      chainIdHex = await provider.request({ 
        method: 'eth_chainId' 
      });
      
      chainId = parseInt(chainIdHex, 16);
      console.info(`MetaMask connected with chain ID: ${chainIdHex} (parsed decimal: ${chainId})`);
      
      // Special handling for Polygon Amoy via hex ID
      if (chainIdHex === '0x13882') {
        console.info('Detected Polygon Amoy via hex chain ID: 0x13882 in connectMetaMask');
        chainId = 80002; // Force to correct ID
      }
      
      // Simplified chain name mapping with comprehensive list
      const chainMap = {
        1: 'ethereum',
        5: 'goerli',
        11155111: 'sepolia',
        137: 'polygon',
        80001: 'mumbai',
        80002: 'polygon-amoy',
        42161: 'arbitrum',
        421613: 'arbitrum-goerli',
        10: 'optimism',
        56: 'bsc',
        43114: 'avalanche',
        250: 'fantom',
        31337: 'hardhat',
        1337: 'localhost'
      };
      
      // Get chain name from mapping or generate a descriptive one
      chainName = chainMap[chainId] || `chain-${chainId}`;
    } catch (chainError) {
      console.error('Error getting chain ID in connectMetaMask:', chainError);
      // Use default values that won't break things
      chainId = provider.chainId ? parseInt(provider.chainId, 16) : -1;
      chainIdHex = provider.chainId || 'unknown';
      chainName = 'unknown-chain';
      console.warn(`Using fallback chain information in connectMetaMask: ${chainId} (${chainIdHex})`);
    }
    
    // Create wallet object for return value and storage
    const displayAddress = address.length > 10 ? 
                          `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : 
                          address;
    
    const wallet = {
      id: `metamask-${address.substring(2, 10)}`,
      address: address,
      displayAddress: displayAddress,
      fullAddress: address,
      type: 'evm',
      provider: 'metamask',
      name: `MetaMask ${displayAddress}`,
      chain: chainName,
      chainId,
      connected: true,
      connectedAt: new Date().toISOString()
    };
    
    // Save wallet connection
    await saveWalletConnection('metamask', [wallet]);
    
    // Set user initiated flag for asset scanning
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('userInitiatedConnection', 'true');
    }
    
    // Trigger a wallet connection change event
    if (typeof window !== 'undefined') {
      const walletChangeEvent = new CustomEvent('wallet-connection-changed', {
        detail: { timestamp: Date.now(), walletType: 'metamask' }
      });
      window.dispatchEvent(walletChangeEvent);
      console.log('Dispatched wallet-connection-changed event');
    }
    
    console.log('Successfully connected to MetaMask:', wallet);
    return wallet;
    
  } catch (error) {
    console.error('MetaMask connection error:', error);
    
    // Handle specific MetaMask errors
    if (error.code === 4001) {
      throw new Error('Connection rejected by user. Please try again.');
    } else if (error.code === -32002) {
      throw new Error('A connection request is already pending. Please check MetaMask.');
    } else if (error.code === -32603) {
      throw new Error('MetaMask encountered an internal error. Please try reloading the page.');
    } else if (error.message && error.message.includes('Already processing')) {
      throw new Error('MetaMask is busy. Please wait and try again in a few moments.');
    }
    
    throw new Error(`Failed to connect to MetaMask: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Disconnect a wallet by type and address
 * @param {string} walletType - Type of wallet (evm, solana)
 * @param {string} address - Wallet address to disconnect
 * @returns {Promise<boolean>} Success or failure
 * @throws {Error} If parameters are invalid or disconnection fails
 */
export async function disconnectWallet(walletType, address) {
  if (!walletType || !address) {
    throw new Error('Missing required parameters');
  }
  
  // Handle different wallet types
  if (walletType === 'evm' && typeof window !== 'undefined' && window.ethereum) {
    try {
      if (window.ethereum.disconnect && typeof window.ethereum.disconnect === 'function') {
        await window.ethereum.disconnect();
      }
      
      if (window.wagmiDisconnect && typeof window.wagmiDisconnect === 'function') {
        await window.wagmiDisconnect();
      }
    } catch (error) {
      console.warn('Could not disconnect from provider:', error.message);
    }
  } else if (walletType === 'solana' && typeof window !== 'undefined' && window.solana) {
    try {
      if (window.solana.disconnect && typeof window.solana.disconnect === 'function') {
        await window.solana.disconnect();
      }
    } catch (error) {
      console.warn('Could not disconnect Solana wallet:', error.message);
    }
  }
  
  console.warn('WARNING: No persistent wallet storage implemented');
  return true;
}

/**
 * Scan for assets across multiple blockchains
 * 
 * @param {Array} wallets - Array of wallet objects to scan
 * @param {Object} options - Options for scanning
 * @param {Array<string>} options.chains - Specific chains to scan (optional)
 * @param {boolean} options.includeZeroBalances - Whether to include tokens with zero balances
 * @param {boolean} options.includePotentialSpam - Whether to include tokens marked as potential spam
 * @returns {Promise<Object>} Asset summary object
 * @throws {Error} If scanning fails
 */
export async function scanMultiChainAssets(wallets, options = {}) {
  if (!wallets || !Array.isArray(wallets) || wallets.length === 0) {
    throw new Error('Valid wallet array is required');
  }

  // Default options
  const {
    chains: specificChains = null,
    includeZeroBalances = true,
    includePotentialSpam = true
  } = options;

  try {
    // Initialize the asset summary object
    const assetSummary = {
      totalAssets: [],
      totalValue: 0,
      chains: {},
      walletAddresses: wallets.map(w => w.address || w.fullAddress),
      meta: {
        scanStartTime: Date.now(),
        walletCount: wallets.length,
        includeZeroBalances,
        includePotentialSpam,
        specificChains: specificChains || "auto-detect"
      }
    };
    
    // Track any errors during scanning
    let scanErrors = [];
    
    // Check for browser environment
    if (typeof window === 'undefined' || !window.ethereum) {
      const error = new Error('Browser ethereum provider not available');
      scanErrors.push(error.message);
      console.error(error);
      
      // Continue with modified behavior rather than throwing
      console.warn('Continuing scan with limited functionality due to missing provider');
    }
    
    // Initialize array of chains to scan
    let chainsToScan = [];
    
    // If chains were specified in options, use them
    if (specificChains && Array.isArray(specificChains) && specificChains.length > 0) {
      chainsToScan = [...specificChains]; // Make a copy to ensure we don't modify the original
    } else {
      // Default to major chains if none specified
      chainsToScan = ['ethereum', 'polygon', 'bsc', 'arbitrum', 'avalanche', 'fantom'];
    }
    
    // Import the apiHelpers module for chain optimization
    let apiHelpers;
    try {
      apiHelpers = await import('./apiHelpers.js');
      
      // Optimize chain scanning order if optimization function is available
      if (apiHelpers.optimizeChainOrder) {
        chainsToScan = apiHelpers.optimizeChainOrder(chainsToScan);
      }
    } catch (importError) {
      console.warn('Could not import optimization utilities:', importError.message);
    }
    
    // Finalize the list of chains to scan
    
    // Import the moralisApi module
    let moralisApi;
    try {
      moralisApi = await import('./moralisApi.js');
    } catch (importError) {
      console.error('Failed to import Moralis API:', importError);
      scanErrors.push(`API import error: ${importError.message}`);
      throw new Error(`Failed to import Moralis API: ${importError.message}`);
    }
    
    // For error tracking
    const chainResults = {};
    
    // Process each chain sequentially to avoid rate limits
    
    // Ensure we have chains to scan
    if (chainsToScan.length === 0) {
      console.warn('No chains specified for scanning, using default chains');
      chainsToScan = ['ethereum', 'polygon', 'bsc']; // Use minimal set of defaults
    }
    
    for (const chainName of chainsToScan) {
      chainResults[chainName] = { success: false, error: null };
      
      try {
        // Process each wallet for this chain
        for (const wallet of wallets) {
          const walletAddress = wallet.address || wallet.fullAddress;
          
          if (!walletAddress) {
            console.warn(`Skipping wallet without address for chain ${chainName}`);
            continue;
          }
          
          
          // Get wallet assets with options for token-agnosticism
          const walletAssets = await moralisApi.getWalletAssetsWithValue(
            walletAddress, 
            chainName,
            {
              includeZeroBalances,
              includePotentialSpam
            }
          );
          
          // Check for errors but continue processing
          if (walletAssets.error || walletAssets.meta?.hasErrors) {
            console.warn(`Errors during ${chainName} scan for ${walletAddress}: ${walletAssets.error || 'See meta data'}`);
            if (!chainResults[chainName].error) {
              chainResults[chainName].error = walletAssets.error || 'Partial failure';
            }
          }
          
          // Process wallet assets even if there were some errors (partial results)
          if (walletAssets && walletAssets.totalAssets && walletAssets.totalAssets.length > 0) {
            // Initialize chain data if needed
            if (!assetSummary.chains[chainName]) {
              assetSummary.chains[chainName] = {
                nativeBalance: 0,
                tokens: {},
                nativeUSDValue: 0,
                tokensUSDValue: {},
                paginationInfo: walletAssets.meta?.pagination || {} // Store pagination info
              };
            }
            
            // Add assets to the summary
            for (const asset of walletAssets.totalAssets) {
              // Skip error tokens
              if (asset.type === 'error') continue;
              
              // Add to total assets array
              assetSummary.totalAssets.push({
                ...asset,
                chain: chainName  // Ensure chain name is set correctly
              });
              
              // Update chain-specific data
              if (asset.type === 'native') {
                assetSummary.chains[chainName].nativeBalance += asset.balance;
                assetSummary.chains[chainName].nativeUSDValue += (asset.usdValue || 0);
              } else {
                if (!assetSummary.chains[chainName].tokens[asset.symbol]) {
                  assetSummary.chains[chainName].tokens[asset.symbol] = 0;
                  assetSummary.chains[chainName].tokensUSDValue[asset.symbol] = 0;
                }
                assetSummary.chains[chainName].tokens[asset.symbol] += asset.balance;
                assetSummary.chains[chainName].tokensUSDValue[asset.symbol] += (asset.usdValue || 0);
              }
            }
            
            // Copy pagination metadata if available
            if (walletAssets.meta && walletAssets.meta.pagination) {
              if (!assetSummary.paginationInfo) {
                assetSummary.paginationInfo = {};
              }
              assetSummary.paginationInfo[chainName] = walletAssets.meta.pagination;
            }
            
            // Update total value
            assetSummary.totalValue += walletAssets.totalValue || 0;
            
            // Mark chain as successfully processed
            chainResults[chainName].success = true;
          } else if (walletAssets.meta) {
            // No assets but API call succeeded
            console.log(`No assets found for ${walletAddress} on ${chainName}`);
            chainResults[chainName].success = true;
            chainResults[chainName].emptyWallet = true;
          }
        }
      } catch (chainError) {
        console.error(`Error scanning chain ${chainName}:`, chainError);
        console.error(`Full error details: ${JSON.stringify(chainError)}`);
        scanErrors.push(`${chainName} scan error: ${chainError.message}`);
        chainResults[chainName].error = chainError.message;
      }
    }
    
    // Add totalUSDValue field for compatibility
    assetSummary.totalUSDValue = assetSummary.totalValue;
    
    // Import API utilities for cross-chain organization
    let organizeAssetsByCrossChain;
    try {
      const apiHelpers = await import('./apiHelpers.js');
      organizeAssetsByCrossChain = apiHelpers.organizeAssetsByCrossChain;
      
      // Organize all assets by cross-chain grouping
      if (organizeAssetsByCrossChain && assetSummary.totalAssets.length > 0) {
        assetSummary.crossChain = organizeAssetsByCrossChain(assetSummary.totalAssets);
        console.log(`Organized assets into ${assetSummary.crossChain.crossChainSummary.length} cross-chain groups`);
      }
    } catch (importError) {
      console.warn('Could not import cross-chain organization utilities:', importError.message);
    }
    
    // Add scan metadata
    assetSummary.meta = {
      ...assetSummary.meta,
      scanEndTime: Date.now(),
      scanDuration: Date.now() - assetSummary.meta.scanStartTime,
      chainsScanAttempted: chainsToScan,
      chainsScanned: Object.keys(assetSummary.chains),
      chainsWithErrors: Object.entries(chainResults)
        .filter(([_, result]) => result.error)
        .map(([chain, _]) => chain),
      totalTokenCount: assetSummary.totalAssets.length,
      hasErrors: scanErrors.length > 0,
      errors: scanErrors.length > 0 ? scanErrors : undefined,
      // Add pagination summary 
      pagination: assetSummary.paginationInfo || {},
      paginationSummary: {
        totalPagesProcessed: Object.values(assetSummary.paginationInfo || {})
          .reduce((sum, chainPagination) => sum + (chainPagination.totalPages || 0), 0),
        totalTokensProcessed: Object.values(assetSummary.paginationInfo || {})
          .reduce((sum, chainPagination) => sum + (chainPagination.totalTokens || 0), 0)
      },
      // Add cross-chain summary
      crossChainSummary: assetSummary.crossChain ? {
        totalGroups: assetSummary.crossChain.crossChainSummary.length,
        multiChainTokens: assetSummary.crossChain.crossChainSummary.filter(t => t.chainCount > 1).length
      } : undefined
    };
    
    
    return assetSummary;
  } catch (error) {
    console.error('Error in scanMultiChainAssets:', error);
    
    // Return error result with structured data
    return {
      totalAssets: [],
      totalValue: 0,
      totalUSDValue: 0,
      chains: {},
      walletAddresses: wallets.map(w => w.address || w.fullAddress),
      success: false,
      error: error.message,
      meta: {
        scanStartTime: Date.now(),
        scanEndTime: Date.now(),
        walletCount: wallets.length,
        hasErrors: true,
        criticalError: error.message,
        includeZeroBalances,
        includePotentialSpam
      }
    };
  }
}

/**
 * Convert cryptocurrency asset values to USD using Moralis API
 * @param {Object} assets - Assets to convert
 * @returns {Promise<Object>} USD values for assets
 * @throws {Error} If conversion fails
 */
export async function convertAssetsToUSD(assets) {
  if (!assets) {
    throw new Error('Assets parameter is required');
  }
  
  try {
    console.log('Converting assets to USD using Moralis API');
    
    // Import Moralis API
    let moralisApi;
    try {
      moralisApi = await import('./moralisApi.js');
      
      if (!moralisApi || !moralisApi.getTokenPricesWithMoralis) {
        throw new Error('Moralis API module missing required price functions');
      }
      
      console.log('Successfully imported Moralis API module for price conversion');
    } catch (importError) {
      console.error('Failed to import Moralis API module:', importError);
      throw new Error(`Moralis API module import failed: ${importError.message}`);
    }
    
    // If assets already have USD values, return early
    if (assets.convertedAssets && assets.totalUSDValue !== undefined) {
      console.log('Assets already converted to USD, returning as-is');
      return assets;
    }
    
    // Check if the assets were already processed with Moralis
    if (assets.totalAssets && assets.totalAssets.length > 0 && 
        assets.totalAssets[0].usdValue !== undefined) {
      console.log('Assets already have USD values from Moralis scan');
      
      // Create a properly formatted result with the existing USD values
      const result = JSON.parse(JSON.stringify(assets));
      
      // Initialize or populate convertedAssets array
      result.convertedAssets = result.totalAssets.map(asset => ({
        ...asset,
        price: asset.price || 0,
        usdValue: asset.usdValue || 0
      }));
      
      // Calculate totalUSDValue if not already present
      if (result.totalUSDValue === undefined) {
        result.totalUSDValue = result.convertedAssets.reduce((sum, asset) => sum + (asset.usdValue || 0), 0);
      }
      
      return result;
    }
    
    // Clone the input object to avoid mutating it
    const result = JSON.parse(JSON.stringify(assets));
    
    // Initialize converted assets array and total USD value
    result.convertedAssets = [];
    result.totalUSDValue = 0;
    
    // Extract assets and symbols for price lookup
    const totalAssets = assets.totalAssets || [];
    
    // Skip processing if no assets
    if (totalAssets.length === 0) {
      console.log('No assets to convert to USD');
      return result;
    }
    
    console.log(`Converting ${totalAssets.length} assets to USD`);
    
    // Get prices from Moralis for all tokens at once
    const prices = await moralisApi.getTokenPricesWithMoralis(
      totalAssets.map(asset => ({ symbol: asset.symbol, chain: asset.chain }))
    );
    
    console.log('Retrieved prices from Moralis:', prices);
    
    // Convert all total assets
    for (const asset of totalAssets) {
      // Skip zero balances
      if (asset.balance <= 0) {
        console.log(`Skipping zero balance asset: ${asset.symbol}`);
        continue;
      }
      
      // Get price from our price map (case insensitive)
      const price = prices[asset.symbol.toLowerCase()] || 0;
      const usdValue = asset.balance * price;
      
      console.log(`Converting ${asset.symbol}: ${asset.balance} * $${price} = $${usdValue}`);
      
      // Add to converted assets
      result.convertedAssets.push({
        ...asset,
        price,
        usdValue
      });
      
      // Add to total USD value
      result.totalUSDValue += usdValue;
    }
    
    // Make sure all chain data is properly initialized
    for (const [chain, chainData] of Object.entries(assets.chains || {})) {
      // Initialize USD values if not present
      if (!result.chains[chain]) {
        result.chains[chain] = { ...chainData };
      }
      
      if (result.chains[chain].nativeUSDValue === undefined) {
        result.chains[chain].nativeUSDValue = 0;
      }
      
      if (result.chains[chain].tokensUSDValue === undefined) {
        result.chains[chain].tokensUSDValue = {};
      }
      
      // Only convert if we need to (not already converted)
      if (Object.keys(result.chains[chain].tokensUSDValue).length === 0) {
        console.log(`Converting chain-specific balances for ${chain}`);
        
        // Convert native balance
        const nativeSymbol = getNativeSymbolForChain(chain);
        const nativePrice = prices[nativeSymbol.toLowerCase()] || 0;
        result.chains[chain].nativeUSDValue = chainData.nativeBalance * nativePrice;
        
        console.log(`Native ${nativeSymbol} on ${chain}: ${chainData.nativeBalance} * $${nativePrice} = $${result.chains[chain].nativeUSDValue}`);
        
        // Convert token balances
        for (const [tokenSymbol, tokenBalance] of Object.entries(chainData.tokens || {})) {
          const tokenPrice = prices[tokenSymbol.toLowerCase()] || 0;
          result.chains[chain].tokensUSDValue[tokenSymbol] = tokenBalance * tokenPrice;
          
          console.log(`Token ${tokenSymbol} on ${chain}: ${tokenBalance} * $${tokenPrice} = $${result.chains[chain].tokensUSDValue[tokenSymbol]}`);
        }
      }
    }
    
    console.log(`Total USD value: $${result.totalUSDValue}`);
    console.log('Finished converting assets to USD');
    
    return result;
  } catch (error) {
    console.error('Error in convertAssetsToUSD:', error);
    
    // Return original assets with empty USD values rather than throwing
    if (assets) {
      const result = JSON.parse(JSON.stringify(assets));
      result.convertedAssets = assets.totalAssets?.map(asset => ({
        ...asset,
        price: 0,
        usdValue: 0
      })) || [];
      result.totalUSDValue = 0;
      
      // Initialize USD values for chains
      for (const chain in (result.chains || {})) {
        result.chains[chain].nativeUSDValue = 0;
        result.chains[chain].tokensUSDValue = {};
      }
      
      console.log('Returning assets with zero USD values due to error');
      return result;
    }
    
    throw new Error(`Failed to convert assets to USD: ${error.message}`);
  }
}

/**
 * Generate a proof hash for verification
 * @param {string} walletAddress - Wallet address
 * @param {string|number} amount - Amount to verify
 * @param {number} proofType - Type of proof (0: standard, 1: threshold, 2: maximum)
 * @returns {string} Generated hash
 * @throws {Error} If hash generation fails
 */
export async function generateProofHash(walletAddress, amount, proofType) {
  try {
    // Import ethers dynamically
    const ethersUtils = await import('./ethersUtils.js');
    const { getEthers } = ethersUtils.default || ethersUtils;
    const { ethers } = await getEthers();
    
    if (!walletAddress) {
      throw new Error('Wallet address is required');
    }
    
    if (amount === undefined || amount === null) {
      throw new Error('Amount is required');
    }
    
    // Normalize address
    const normalizedAddress = walletAddress.toLowerCase();
    
    // Concatenate the values with a delimiter
    const timestamp = Math.floor(Date.now() / 1000);
    const dataToHash = `${normalizedAddress}:${amount.toString()}:${proofType}:${timestamp}`;
    
    // Create hash using ethers.js (handle both v5 and v6)
    let encodedData, hash;
    
    if (ethers.utils && ethers.utils.toUtf8Bytes && ethers.utils.keccak256) {
      // ethers v5
      encodedData = ethers.utils.toUtf8Bytes(dataToHash);
      hash = ethers.utils.keccak256(encodedData);
    } else if (ethers.toUtf8Bytes && ethers.keccak256) {
      // ethers v6
      encodedData = ethers.toUtf8Bytes(dataToHash);
      hash = ethers.keccak256(encodedData);
    } else {
      throw new Error('Unsupported ethers.js version - cannot find toUtf8Bytes or keccak256');
    }
    
    return hash;
  } catch (error) {
    console.error('Error generating proof hash:', error);
    throw new Error(`Failed to generate proof hash: ${error.message}`);
  }
}

/**
 * Check if MetaMask is available and working
 * @returns {Promise<boolean>} true if MetaMask is available and responding
 */
export async function isMetaMaskAvailable() {
  if (typeof window === 'undefined') {
    return false;
  }
  
  // Check for ethereum object
  if (!window.ethereum) {
    return false;
  }
  
  // Find the MetaMask provider if we have multiple providers
  let provider = window.ethereum;
  if (window.ethereum.providers) {
    const metaMaskProvider = window.ethereum.providers.find(p => p.isMetaMask);
    if (metaMaskProvider) {
      provider = metaMaskProvider;
    } else if (!window.ethereum.isMetaMask) {
      return false; // No MetaMask provider found
    }
  } else if (!window.ethereum.isMetaMask) {
    return false; // Not MetaMask
  }
  
  // Test if the provider is responding
  try {
    await provider.request({ method: 'eth_chainId' });
    return true;
  } catch (err) {
    console.warn('MetaMask health check failed:', err);
    return false;
  }
}

/**
 * Get the RPC URL for a given chain
 * @param {string} chain - The blockchain name
 * @returns {string} - RPC endpoint URL
 */
function getRpcUrl(chain) {
  const chainName = typeof chain === 'string' ? chain.toLowerCase() : 'unknown';
  
  // Default RPC endpoints for common chains
  const rpcEndpoints = {
    ethereum: 'https://eth-mainnet.g.alchemy.com/v2/demo',
    polygon: 'https://polygon-mainnet.g.alchemy.com/v2/demo',
    'polygon-amoy': 'https://polygon-amoy.g.alchemy.com/v2/demo',
    'polygon-mumbai': 'https://polygon-mumbai.g.alchemy.com/v2/demo',
    amoy: 'https://polygon-amoy.g.alchemy.com/v2/demo', // Alias for Polygon Amoy testnet
    mumbai: 'https://polygon-mumbai.g.alchemy.com/v2/demo', // Alias for Polygon Mumbai testnet
    arbitrum: 'https://arb-mainnet.g.alchemy.com/v2/demo',
    optimism: 'https://opt-mainnet.g.alchemy.com/v2/demo',
    'binance-smart-chain': 'https://bsc-dataseed.binance.org',
    bsc: 'https://bsc-dataseed.binance.org',
    avalanche: 'https://api.avax.network/ext/bc/C/rpc',
    fantom: 'https://rpc.ftm.tools',
    hardhat: 'http://localhost:8545',
    localhost: 'http://localhost:8545',
    sepolia: 'https://eth-sepolia.g.alchemy.com/v2/demo',
    goerli: 'https://eth-goerli.g.alchemy.com/v2/demo',
    unknown: 'https://polygon-amoy.g.alchemy.com/v2/demo' // Default to Polygon Amoy instead of Ethereum
  };
  
  // Log URL selection for debugging
  if (chainName === 'polygon-amoy' || chainName === 'amoy') {
    console.info(`Using RPC URL for Polygon Amoy: ${rpcEndpoints[chainName]}`);
  } else if (chainName === 'unknown') {
    console.warn('Unknown chain requested, defaulting to Polygon Amoy RPC');
  }
  
  return rpcEndpoints[chainName] || rpcEndpoints.unknown;
}

/**
 * Get the Solana RPC URL
 * @returns {string} - Solana RPC endpoint URL
 */
function getSolanaRpcUrl() {
  // Default to public Solana RPC endpoint
  // In production, you would use a dedicated endpoint with higher rate limits
  return 'https://api.mainnet-beta.solana.com';
}

/**
 * Dynamically import Solana web3.js to avoid SSR issues
 * @returns {Promise<Object>} - Solana Web3.js library
 */
async function dynamicImportSolanaWeb3() {
  try {
    // For ESM environments
    if (typeof require === 'undefined') {
      const solanaWeb3 = await import('@solana/web3.js');
      return solanaWeb3;
    } else {
      // For CommonJS environments
      return require('@solana/web3.js');
    }
  } catch (error) {
    console.error('Error loading @solana/web3.js:', error);
    throw new Error('Failed to load Solana web3.js library: ' + error.message);
  }
}

/**
 * Fetch Solana token metadata from token registry
 * @param {string} mintAddress - Token mint address
 * @returns {Promise<Object>} - Token metadata
 */
async function fetchSolanaTokenMetadata(mintAddress) {
  try {
    // Use Solana token list API to get token metadata
    const response = await fetch('https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json');
    const tokenList = await response.json();
    
    // Find the token in the list
    const token = tokenList.tokens.find(t => t.address === mintAddress);
    
    if (token) {
      return {
        symbol: token.symbol,
        name: token.name,
        logoURI: token.logoURI,
        decimals: token.decimals
      };
    }
    
    // If not found in token list, throw error
    throw new Error(`Token metadata not found for mint address: ${mintAddress}`);
  } catch (error) {
    console.error('Error fetching Solana token metadata:', error);
    throw error;
  }
}

/**
 * Get the native token symbol for a chain
 * @param {string} chain - The blockchain name
 * @returns {string} - Native token symbol
 */
function getNativeSymbolForChain(chain) {
  const chainName = typeof chain === 'string' ? chain.toLowerCase() : 'unknown';
  
  const symbolMap = {
    ethereum: 'ETH',
    polygon: 'MATIC',
    'polygon-amoy': 'MATIC',
    'polygon-mumbai': 'MATIC',
    mumbai: 'MATIC',
    amoy: 'MATIC',
    arbitrum: 'ETH',
    optimism: 'ETH',
    'binance-smart-chain': 'BNB',
    bsc: 'BNB',
    avalanche: 'AVAX',
    fantom: 'FTM',
    solana: 'SOL',
    hardhat: 'ETH',
    localhost: 'ETH',
    sepolia: 'ETH',
    unknown: 'UNKNOWN'
  };
  
  return symbolMap[chainName] || 'UNKNOWN';
}

/**
 * Dynamically scan for all ERC20 token balances in a wallet
 * @param {string} walletAddress - Address to check balances for
 * @param {Object} provider - Ethers provider
 * @param {string} chain - Chain name
 * @returns {Promise<Object>} - Object mapping token symbols to balances
 */
async function scanErc20Tokens(walletAddress, provider, chain) {
  try {
    // Basic ERC20 ABI for balanceOf, decimals, symbol and name functions
    const minABI = [
      {
        "constant": true,
        "inputs": [{ "name": "_owner", "type": "address" }],
        "name": "balanceOf",
        "outputs": [{ "name": "balance", "type": "uint256" }],
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "decimals",
        "outputs": [{ "name": "", "type": "uint8" }],
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "symbol",
        "outputs": [{ "name": "", "type": "string" }],
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "name",
        "outputs": [{ "name": "", "type": "string" }],
        "type": "function"
      }
    ];
    
    const results = {};
    const ethersUtils = await import('./ethersUtils.js');
    const { getEthers } = ethersUtils.default || ethersUtils;
    const { ethers } = await getEthers();
   
    // Try to use wallet's native API
    if (typeof window !== 'undefined' && window.ethereum && window.ethereum.request) {
      try {
        const assets = await window.ethereum.request({
          method: 'wallet_getAssets'
        }).catch(() => null);
        
        if (assets && Array.isArray(assets)) {
          // Process assets returned by the wallet
          for (const asset of assets) {
            if (asset.type === 'ERC20' && asset.balance && asset.decimals) {
              const formattedBalance = parseFloat(asset.balance) / Math.pow(10, asset.decimals);
              if (formattedBalance > 0) {
                results[asset.symbol] = formattedBalance;
              }
            }
          }
          
          // If we got assets from the wallet, return them
          if (Object.keys(results).length > 0) {
            return results;
          }
        }
      } catch (walletApiError) {
        // Fall through to on-chain method
      }
    }
    
    // Use on-chain data to find token transfers
    try {
      // ERC20 Transfer event signature
      const ERC20_TRANSFER_EVENT = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
      
      // Get recent blocks for scanning
      let fromBlock;
      try {
        const currentBlock = await provider.getBlockNumber();
        fromBlock = Math.max(0, currentBlock - 5000);
      } catch (blockError) {
        fromBlock = "latest";
      }
      
      // Format address for topics
      const addressHex = ethers.utils ? 
        ethers.utils.hexlify(ethers.utils.zeroPad(walletAddress, 32)) : 
        ethers.zeroPadValue(ethers.getAddress(walletAddress), 32);
      
      // Get transfer logs
      const filter = {
        fromBlock,
        toBlock: "latest",
        topics: [ERC20_TRANSFER_EVENT, null, addressHex]
      };
      
      const logs = await provider.getLogs(filter).catch(() => []);
      
      // Extract token addresses
      const tokenAddresses = [...new Set(logs
        .filter(log => log && log.address)
        .map(log => log.address.toLowerCase()))];
      
      // Check token balances
      for (const tokenAddress of tokenAddresses.slice(0, 20)) {
        try {
          const contract = new ethers.Contract(tokenAddress, minABI, provider);
          const balance = await contract.balanceOf(walletAddress);
          
          if (!balance.isZero()) {
            let symbol = '';
            let decimals = 18;
            
            try {
              symbol = await contract.symbol();
              decimals = await contract.decimals();
            } catch (metadataError) {
              try {
                const name = await contract.name();
                symbol = name.substring(0, 5);
              } catch (nameError) {
                symbol = tokenAddress.substring(0, 6) + '...';
              }
            }
            
            let formattedBalance;
            if (ethers.utils && ethers.utils.formatUnits) {
              formattedBalance = parseFloat(ethers.utils.formatUnits(balance, decimals));
            } else if (ethers.formatUnits) {
              formattedBalance = parseFloat(ethers.formatUnits(balance, decimals));
            } else {
              throw new Error('Unsupported ethers.js version');
            }
            
            if (formattedBalance > 0) {
              results[symbol] = formattedBalance;
            }
          }
        } catch (tokenError) {
          // Skip tokens that fail
        }
      }
    } catch (scanError) {
      // Continue with what we have
    }
    
    return results;
  } catch (error) {
    // Return what we have even if there was an error
    return {};
  }
}

/**
 * Helper function to get token list URL for a specific chain
 * @param {string} chain - Chain name or ID
 * @returns {Promise<string|null>} - URL of the token list or null if not available
 */
async function getTokenListUrl(chain) {
  // Convert chain name to lowercase for comparison
  const chainName = typeof chain === 'string' ? chain.toLowerCase() : '';
  
  // Map of token list URLs by chain
  const tokenListUrls = {
    ethereum: 'https://tokens.coingecko.com/ethereum/all.json',
    polygon: 'https://tokens.coingecko.com/polygon-pos/all.json',
    'polygon-mumbai': 'https://tokens.coingecko.com/polygon-pos/all.json',
    'polygon-amoy': 'https://tokens.coingecko.com/polygon-pos/all.json',
    arbitrum: 'https://tokens.coingecko.com/arbitrum-one/all.json',
    optimism: 'https://tokens.coingecko.com/optimistic-ethereum/all.json',
    bsc: 'https://tokens.coingecko.com/binance-smart-chain/all.json',
    avalanche: 'https://tokens.coingecko.com/avalanche/all.json',
  };
  
  // Log token list URL for debugging
  console.info(`Using token list URL for chain ${chainName}: ${tokenListUrls[chainName] || 'none available'}`);
  
  return tokenListUrls[chainName] || null;
}

// Removed hardcoded token lists - we now dynamically discover tokens

/**
 * Try to find CoinGecko ID for a token symbol
 * @param {string} symbol - Token symbol
 * @returns {Promise<string|null>} - CoinGecko ID or null if not found
 */
async function findCoinGeckoId(symbol) {
  // Try to query CoinGecko search API
  try {
    const response = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}`);
    if (response.ok) {
      const data = await response.json();
      
      if (data && data.coins && data.coins.length > 0) {
        // Find exact match first
        const exactMatch = data.coins.find(coin => 
          coin.symbol.toLowerCase() === symbol.toLowerCase()
        );
        
        if (exactMatch) {
          return exactMatch.id;
        }
        
        // Otherwise return first result as best guess
        return data.coins[0].id;
      }
    }
  } catch (error) {
    // Silent fail - we'll return null
  }
  
  return null;
}

/**
 * Fetch current token prices in USD
 * @param {Array} assets - Array of asset objects with symbol property
 * @returns {Promise<Object>} - Price data object mapping token symbols to USD prices
 */
async function fetchTokenPrices(assets) {
  try {
    // Extract unique symbols
    const symbols = [...new Set(assets.map(asset => asset.symbol.toLowerCase()))];
    
    // Map of symbols to CoinGecko IDs
    const coinGeckoIdMap = {
      eth: 'ethereum',
      matic: 'matic-network',
      sol: 'solana',
      usdc: 'usd-coin',
      usdt: 'tether',
      dai: 'dai',
      weth: 'weth',
      wbtc: 'wrapped-bitcoin',
      btc: 'bitcoin',
      bnb: 'binancecoin',
      avax: 'avalanche-2',
      ftm: 'fantom',
      wmatic: 'matic-network', 
      link: 'chainlink',
      uni: 'uniswap',
      aave: 'aave',
      eurs: 'stasis-eurs'
    };
    
    // Get list of IDs to fetch
    const ids = symbols
      .map(symbol => coinGeckoIdMap[symbol.toLowerCase()])
      .filter(id => id !== undefined)
      .join(',');
    
    if (!ids) {
      return {};
    }
    
    // Try our API route first
    if (typeof window !== 'undefined') {
      try {
        const response = await fetch(`/api/token-prices?ids=${ids}`);
        if (response.ok) {
          const data = await response.json();
          
          // Process the price data
          const prices = {};
          for (const symbol of symbols) {
            const geckoId = coinGeckoIdMap[symbol.toLowerCase()];
            if (geckoId && data[geckoId]) {
              prices[symbol.toLowerCase()] = data[geckoId].usd;
            } else {
              prices[symbol.toLowerCase()] = 0;
            }
          }
          
          return prices;
        }
      } catch (proxyError) {
        // Fall through to direct API
      }
    }
    
    // Direct API call to CoinGecko
    try {
      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Process the price data
        const prices = {};
        for (const symbol of symbols) {
          const geckoId = coinGeckoIdMap[symbol.toLowerCase()];
          if (geckoId && data[geckoId]) {
            prices[symbol.toLowerCase()] = data[geckoId].usd;
          } else {
            prices[symbol.toLowerCase()] = 0;
          }
        }
        
        return prices;
      }
    } catch (apiError) {
      // Fall through to error handling
    }
    
    // If all methods fail, return zeros
    const fallbackPrices = {};
    for (const symbol of symbols) {
      fallbackPrices[symbol.toLowerCase()] = 0;
    }
    return fallbackPrices;
  } catch (error) {
    // Return zeros in case of any error
    const fallbackPrices = {};
    for (const symbol of symbols) {
      fallbackPrices[symbol.toLowerCase()] = 0;
    }
    return fallbackPrices;
  }
}

/**
 * Generate a temporary wallet for proof submission
 * @returns {Promise<Object>} Temporary wallet with address and private key
 * @throws {Error} If wallet generation fails
 */
export async function generateTemporaryWallet() {
  try {
    // Import ethers dynamically
    const ethersUtils = await import('./ethersUtils.js');
    const { getEthers } = ethersUtils.default || ethersUtils;
    const { ethers } = await getEthers();
    
    // Create random wallet (handle both ethers v5 and v6)
    let wallet;
    
    if (ethers.Wallet && typeof ethers.Wallet.createRandom === 'function') {
      // Create the wallet
      wallet = ethers.Wallet.createRandom();
      
      // Handle mnemonic access differences between versions
      let mnemonicPhrase, mnemonicPath;
      
      if (wallet._mnemonic && typeof wallet._mnemonic === 'function') {
        // ethers v5
        const mnemonicObj = wallet._mnemonic();
        mnemonicPhrase = mnemonicObj.phrase;
        mnemonicPath = mnemonicObj.path;
      } else if (wallet.mnemonic) {
        // ethers v6
        mnemonicPhrase = wallet.mnemonic.phrase;
        mnemonicPath = wallet.mnemonic.path;
      }
      
      // Return wallet data without exposing private key in logs
      return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        mnemonic: mnemonicPhrase,
        path: mnemonicPath,
        createDate: new Date().toISOString()
      };
    } else {
      throw new Error('Unsupported ethers.js version - cannot find Wallet.createRandom');
    }
  } catch (error) {
    console.error('Error generating temporary wallet:', error);
    throw new Error(`Failed to generate temporary wallet: ${error.message}`);
  }
}