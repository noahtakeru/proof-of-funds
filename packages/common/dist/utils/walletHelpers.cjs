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
        return JSON.parse(walletData);
      }
    } catch (error) {
      console.error('Error getting connected wallets:', error);
    }
  }
  return [];
}

/**
 * Save a wallet connection to localStorage
 * @param {Object} wallet - Wallet object to save
 * @returns {Promise<boolean>} Success or failure
 * @throws {Error} If wallet object is invalid
 */
export async function saveWalletConnection(wallet) {
  if (!wallet) {
    throw new Error('Missing wallet object');
  }
  
  if (!wallet.address) {
    throw new Error('Invalid wallet object: missing address');
  }
  
  if (!wallet.type) {
    throw new Error('Invalid wallet object: missing wallet type');
  }

  if (typeof localStorage === 'undefined') {
    throw new Error('Local storage is not available in this environment');
  }

  try {
    // Get existing wallets
    const existingWallets = getConnectedWallets();
    
    // Check if this wallet is already saved
    const existingWalletIndex = existingWallets.findIndex(w => 
      w.address === wallet.address && w.type === wallet.type
    );
    
    if (existingWalletIndex >= 0) {
      // Update existing wallet
      existingWallets[existingWalletIndex] = {
        ...existingWallets[existingWalletIndex],
        ...wallet,
        lastConnected: new Date().toISOString()
      };
    } else {
      // Add new wallet
      existingWallets.push({
        ...wallet,
        lastConnected: new Date().toISOString()
      });
    }
    
    // Save to localStorage
    localStorage.setItem('walletData', JSON.stringify(existingWallets));
    return true;
  } catch (error) {
    const enhancedError = new Error(`Failed to save wallet connection: ${error.message}`);
    enhancedError.originalError = error;
    enhancedError.wallet = wallet;
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
  
  if (!window.ethereum) {
    throw new Error('MetaMask is not installed. Please install MetaMask to use this feature.');
  }
  
  try {
    // Request account access
    const accounts = await window.ethereum.request({ 
      method: 'eth_requestAccounts' 
    });
    
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found. Please unlock MetaMask and try again.');
    }
    
    // Get the connected wallet address
    const address = accounts[0];
    
    if (!address) {
      throw new Error('Failed to get wallet address');
    }
    
    // Get the current chain ID
    const chainIdHex = await window.ethereum.request({ 
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
    
    // Create wallet object
    const wallet = {
      address,
      type: 'evm',
      provider: 'metamask',
      chain: chainName,
      chainId,
      connected: true,
      connectedAt: new Date().toISOString()
    };
    
    // Save the connection
    await saveWalletConnection(wallet);
    
    return wallet;
  } catch (error) {
    // Handle specific MetaMask errors
    if (error.code === 4001) {
      // User rejected the request
      throw new Error('Connection rejected by user. Please try again.');
    } else if (error.code === -32002) {
      // Request already pending
      throw new Error('A connection request is already pending. Please check MetaMask.');
    }
    
    const enhancedError = new Error(`Failed to connect to MetaMask: ${error.message}`);
    enhancedError.originalError = error;
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
    const walletData = localStorage.getItem('walletData');
    if (walletData) {
      const wallets = JSON.parse(walletData);
      // Filter out the disconnected wallet
      const updatedWallets = wallets.filter(wallet => 
        !(wallet.type === walletType && (wallet.address === address || wallet.fullAddress === address))
      );
      localStorage.setItem('walletData', JSON.stringify(updatedWallets));
    }
    
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
 * Generate a temporary wallet for proof submission
 * @returns {Promise<Object>} Temporary wallet
 * @throws {Error} If wallet generation fails
 */
export async function generateTemporaryWallet() {
  throw new Error('generateTemporaryWallet function not implemented');
}