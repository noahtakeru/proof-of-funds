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
  if (typeof localStorage !== 'undefined') {
    try {
      const walletData = localStorage.getItem('walletData');
      if (walletData) {
        const parsedData = JSON.parse(walletData);
        
        // Handle different data formats
        if (Array.isArray(parsedData)) {
          // Direct array format (old format)
          return parsedData;
        } else if (parsedData && typeof parsedData === 'object') {
          if (parsedData.wallets) {
            // New format with wallets grouped by type
            const result = [];
            
            // Extract all wallet objects from each wallet type
            Object.keys(parsedData.wallets).forEach(walletType => {
              const typeWallets = parsedData.wallets[walletType];
              
              if (Array.isArray(typeWallets)) {
                typeWallets.forEach(wallet => {
                  // If wallet is just an address string, convert it to a wallet object
                  if (typeof wallet === 'string') {
                    const address = wallet;
                    const displayAddress = address.length > 10 ? 
                                        `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : 
                                        address;
                    
                    result.push({
                      id: `${walletType}-${address.substring(2, 10)}`,
                      address: address,
                      displayAddress: displayAddress,
                      fullAddress: address,
                      type: walletType === 'metamask' ? 'evm' : walletType,
                      name: `${walletType === 'metamask' ? 'MetaMask' : 'Wallet'} ${displayAddress}`,
                      chain: walletType === 'metamask' ? 'ethereum' : 'unknown',
                      connected: true
                    });
                  } else if (typeof wallet === 'object' && wallet !== null) {
                    // Already a wallet object
                    result.push(wallet);
                  }
                });
              }
            });
            
            return result;
          }
        }
      }
    } catch (error) {
      console.error('Error getting connected wallets:', error);
    }
  }
  
  // Default empty array if no wallets are found
  return [];
}

/**
 * Save a wallet connection to localStorage
 * @param {string} walletType - Type of wallet ('metamask', 'phantom', etc.)
 * @param {Array|Object} accounts - Array of wallet addresses or single wallet object
 * @returns {Promise<boolean>} Success or failure
 * @throws {Error} If parameters are invalid
 */
export async function saveWalletConnection(walletType, accounts) {
  if (!walletType) {
    throw new Error('Missing wallet type');
  }
  
  // Fix issues with non-array inputs
  let accountsArray;
  
  // Handle different inputs to make the function more robust
  if (!accounts) {
    throw new Error('Missing accounts parameter');
  } else if (Array.isArray(accounts)) {
    // Normal case: accounts is already an array
    accountsArray = accounts;
  } else if (typeof accounts === 'object' && accounts.address) {
    // Handle case where a single wallet object is passed
    accountsArray = [accounts.address];
  } else if (typeof accounts === 'object' && accounts.accounts && Array.isArray(accounts.accounts)) {
    // Handle case where accounts is wrapped in an object
    accountsArray = accounts.accounts;
  } else if (typeof accounts === 'string') {
    // Handle case where a single address string is passed
    accountsArray = [accounts];
  } else {
    console.error('Invalid accounts parameter:', accounts);
    throw new Error('Invalid accounts parameter format');
  }
  
  // Final validation after normalization
  if (accountsArray.length === 0) {
    throw new Error('Empty accounts array after normalization');
  }

  if (typeof localStorage === 'undefined') {
    throw new Error('Local storage is not available in this environment');
  }

  try {
    // Get existing wallet data
    let walletData;
    try {
      const storedData = localStorage.getItem('walletData');
      walletData = storedData ? JSON.parse(storedData) : {};
    } catch (e) {
      console.warn('Failed to parse existing wallet data, initializing new structure', e);
      walletData = {};
    }

    // Initialize wallets object if it doesn't exist
    if (!walletData.wallets) {
      walletData.wallets = {};
    }

    // Initialize wallet type array if it doesn't exist
    if (!walletData.wallets[walletType] || !Array.isArray(walletData.wallets[walletType])) {
      walletData.wallets[walletType] = [];
    }

    // Each account needs to be a proper wallet object
    accountsArray.forEach(account => {
      if (!account) return; // Skip null/undefined entries
      
      // Handle various account formats
      const accountStr = typeof account === 'string' ? account : 
                        (account.address || account.publicKey || account.toString());
      
      // Normalize address format
      const address = String(accountStr).toLowerCase();
      
      // Create a displayAddress for UI
      const displayAddress = address.length > 10 ? 
                            `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : 
                            address;
      
      // Check if wallet already exists
      const existingIndex = walletData.wallets[walletType] ? 
        walletData.wallets[walletType].findIndex(
          wallet => wallet && typeof wallet === 'object' && wallet.address && 
          wallet.address.toLowerCase() === address.toLowerCase()
        ) : -1;
      
      // If wallet doesn't exist, create a new wallet object with all required properties
      if (existingIndex === -1) {
        // Generate a unique ID
        const uniqueId = `${walletType}-${address.substring(2, 10)}`;
        
        // Create a proper wallet object with all required fields
        const walletObj = {
          id: uniqueId,
          address: address,
          displayAddress: displayAddress,
          fullAddress: address,
          type: walletType === 'metamask' ? 'evm' : walletType,
          name: `${walletType === 'metamask' ? 'MetaMask' : 'Wallet'} ${displayAddress}`,
          chain: walletType === 'metamask' ? 'ethereum' : 'unknown',
          connected: true,
          connectedAt: new Date().toISOString()
        };
        
        // Initialize the array if needed
        if (!Array.isArray(walletData.wallets[walletType])) {
          walletData.wallets[walletType] = [];
        }
        
        // Add the wallet object
        walletData.wallets[walletType].push(walletObj);
      }
    });

    // Update timestamp
    walletData.timestamp = Date.now();
    
    // Save to localStorage
    localStorage.setItem('walletData', JSON.stringify(walletData));
    console.log('Saved wallet connection:', walletType, accountsArray, walletData);
    return true;
  } catch (error) {
    const enhancedError = new Error(`Failed to save wallet connection: ${error.message}`);
    enhancedError.originalError = error;
    enhancedError.walletType = walletType;
    enhancedError.accounts = accountsArray;
    throw enhancedError;
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
    
    // First, try to force disconnect to ensure we get a fresh connection popup
    try {
      // Force disconnect from MetaMask to ensure the popup shows
      if (provider.isConnected && provider.isConnected()) {
        console.log('Provider already connected, disconnecting first to force re-auth...');
        try {
          // Try wallet-specific disconnection methods
          if (provider.disconnect && typeof provider.disconnect === 'function') {
            await provider.disconnect();
          }
        } catch (disconnectError) {
          console.log('Disconnect attempt before connect (expected):', disconnectError);
        }
      }
      
      // Clear any existing permissions from MetaMask
      try {
        // Request to clear permissions, which forces a new popup
        await provider.request({
          method: 'wallet_revokePermissions',
          params: [{ eth_accounts: {} }]
        });
      } catch (permError) {
        console.log('Permission revocation attempt (expected):', permError);
      }
    } catch (preConnectErr) {
      console.log('Pre-connection cleanup (non-critical):', preConnectErr);
    }
    
    // Force MetaMask to show popup by using specific params
    const requestAccountsOptions = { 
      method: 'eth_requestAccounts',
      params: [{ force: true }] // Try to force approval screen
    };
    
    // Add a delay to ensure browser processes user interaction
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Request account access with forceApproval parameter to always show the popup
    console.log('Calling ethereum.request with provider to force auth popup');
    const accounts = await provider.request(requestAccountsOptions);
    
    console.log('MetaMask returned accounts:', accounts);
    
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found. Please unlock MetaMask and try again.');
    }
    
    // Get the connected wallet address
    const address = accounts[0];
    
    if (!address) {
      throw new Error('Failed to get wallet address');
    }
    
    // Get the current chain ID
    const chainIdHex = await provider.request({ 
      method: 'eth_chainId' 
    });
    
    const chainId = parseInt(chainIdHex, 16);
    let chainName = 'unknown';
    
    // Map chain ID to name
    const chainMap = {
      1: 'ethereum',
      5: 'goerli',
      11155111: 'sepolia',
      137: 'polygon',
      80001: 'mumbai',
      42161: 'arbitrum',
      421613: 'arbitrum-goerli'
    };
    
    if (chainMap[chainId]) {
      chainName = chainMap[chainId];
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
    
    // Save a full wallet object instead of just the address
    await saveWalletConnection('metamask', [wallet]);
    
    return wallet;
  } catch (error) {
    console.error('MetaMask connection error:', error);
    
    // Handle specific MetaMask errors
    if (error.code === 4001) {
      // User rejected the request
      throw new Error('Connection rejected by user. Please try again.');
    } else if (error.code === -32002) {
      // Request already pending
      throw new Error('A connection request is already pending. Please check MetaMask.');
    } else if (error.code === -32603) {
      // Internal error
      throw new Error('MetaMask encountered an internal error. Please try reloading the page.');
    } else if (error.message && error.message.includes('Already processing')) {
      // Another common MetaMask error
      throw new Error('MetaMask is busy. Please wait and try again in a few moments.');
    }
    
    const enhancedError = new Error(`Failed to connect to MetaMask: ${error.message || 'Unknown error'}`);
    enhancedError.originalError = error;
    enhancedError.code = error.code;
    throw enhancedError;
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
  if (!walletType) {
    throw new Error('walletType is required');
  }
  
  if (!address) {
    throw new Error('address is required');
  }
  
  // Handle different wallet types
  if (walletType === 'evm') {
    // Disconnect EVM wallet (MetaMask, etc.)
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        // Some providers have a disconnect method
        if (window.ethereum.disconnect && typeof window.ethereum.disconnect === 'function') {
          await window.ethereum.disconnect();
        }
        
        // For wagmi integration
        if (window.wagmiDisconnect && typeof window.wagmiDisconnect === 'function') {
          await window.wagmiDisconnect();
        }
      } catch (error) {
        console.warn('Could not disconnect from provider directly:', error.message);
        // Continue to remove from local storage even if provider disconnect fails
      }
    }
  } else if (walletType === 'solana') {
    // Disconnect Solana wallet (Phantom, etc.)
    if (typeof window !== 'undefined' && window.solana) {
      try {
        // Try to disconnect if the wallet supports it
        if (window.solana.disconnect && typeof window.solana.disconnect === 'function') {
          await window.solana.disconnect();
        }
      } catch (error) {
        console.warn('Could not disconnect Solana wallet:', error.message);
        // Continue to remove from local storage even if wallet disconnect fails
      }
    }
  }
  
  // Update localStorage regardless of provider disconnect result
  if (typeof localStorage === 'undefined') {
    throw new Error('Local storage is not available in this environment');
  }
  
  try {
    const walletDataStr = localStorage.getItem('walletData');
    if (walletDataStr) {
      const walletData = JSON.parse(walletDataStr);
      
      // Handle both old and new formats
      if (Array.isArray(walletData)) {
        // Old format - direct array of wallets
        const updatedWallets = walletData.filter(wallet => 
          !(wallet.type === walletType && (wallet.address === address || wallet.fullAddress === address))
        );
        localStorage.setItem('walletData', JSON.stringify(updatedWallets));
      } else if (walletData && typeof walletData === 'object' && walletData.wallets) {
        // New format - wallets organized by wallet type
        const normalizedAddress = address.toLowerCase();
        
        // Find the wallet type that might contain this address
        Object.keys(walletData.wallets).forEach(type => {
          if (Array.isArray(walletData.wallets[type])) {
            // Remove matching wallet objects or addresses
            walletData.wallets[type] = walletData.wallets[type].filter(wallet => {
              if (typeof wallet === 'string') {
                return wallet.toLowerCase() !== normalizedAddress;
              } else if (wallet && typeof wallet === 'object') {
                const walletAddr = (wallet.address || wallet.fullAddress || '').toLowerCase();
                return !(walletAddr === normalizedAddress || 
                  (wallet.type === walletType && walletAddr === normalizedAddress));
              }
              return true;
            });
          }
        });
        
        localStorage.setItem('walletData', JSON.stringify(walletData));
      }
    }
    
    // Clear other wallet-related localStorage flags to prevent auto-reconnect
    if (walletType === 'metamask' || walletType === 'evm') {
      // Clear wagmi connection data to prevent auto-reconnect
      localStorage.removeItem('wagmi.connected');
      localStorage.removeItem('wagmi.connectors');
      localStorage.removeItem('wagmi.injected.shimDisconnect');
      localStorage.removeItem('wagmi.store');
      localStorage.removeItem('wagmi.wallet');
      
      // Remove the userInitiatedConnection flag to prevent re-scanning
      localStorage.removeItem('userInitiatedConnection');
      
      // Remove MetaMask-specific local storage data
      localStorage.removeItem('WALLETCONNECT_DEEPLINK_CHOICE');
      localStorage.removeItem('metamask-disconnected');
      
      // Set flag to indicate user has explicitly disconnected wallets
      // This prevents auto-reconnection on page refresh
      localStorage.setItem('user_disconnected_wallets', 'true');
    } else if (walletType === 'phantom' || walletType === 'solana') {
      // Remove Phantom-specific storage
      localStorage.removeItem('phantomDiscoveredWallets');
      localStorage.removeItem('phantomWalletState');
      
      // Set disconnection flag for Solana wallets too
      localStorage.setItem('user_disconnected_wallets', 'true');
    }
    
    console.log(`Disconnected wallet: ${walletType} - ${address}`);
    return true;
  } catch (error) {
    const enhancedError = new Error(`Failed to update wallet data: ${error.message}`);
    enhancedError.originalError = error;
    enhancedError.walletType = walletType;
    enhancedError.address = address;
    throw enhancedError;
  }
}

/**
 * Scan for assets across multiple blockchains
 * @returns {Promise<Array>} Array of found assets
 * @throws {Error} If scanning fails
 */
export async function scanMultiChainAssets() {
  throw new Error('scanMultiChainAssets function not implemented');
}

/**
 * Convert cryptocurrency asset values to USD
 * @param {Object} assets - Assets to convert
 * @returns {Promise<Object>} USD values for assets
 * @throws {Error} If conversion fails
 */
export async function convertAssetsToUSD(assets) {
  if (!assets) {
    throw new Error('Assets parameter is required');
  }
  
  throw new Error('convertAssetsToUSD function not implemented');
}

/**
 * Generate a proof hash for verification
 * @param {Object} data - Data to hash
 * @returns {string} Generated hash
 * @throws {Error} If hash generation fails
 */
export function generateProofHash(data) {
  if (!data) {
    throw new Error('Data parameter is required');
  }
  
  throw new Error('generateProofHash function not implemented');
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
 * Generate a temporary wallet for proof submission
 * @returns {Promise<Object>} Temporary wallet
 * @throws {Error} If wallet generation fails
 */
export async function generateTemporaryWallet() {
  throw new Error('generateTemporaryWallet function not implemented');
}