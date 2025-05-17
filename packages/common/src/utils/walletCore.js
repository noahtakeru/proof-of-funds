/**
 * Wallet Core
 * 
 * This module provides core wallet functionality for both EVM and non-EVM wallets.
 * It serves as the foundation for wallet-related functionality across the application.
 */

import {
  CHAIN_IDS,
  getChainName,
  getChainId,
  getRpcUrl,
  getNativeTokenSymbol
} from './chainMappings';

import {
  createError,
  ErrorCategory,
  ErrorCode,
  WalletError
} from '../error-handling';

// Wallet connection event name used for cross-component communication
export const WALLET_CONNECTION_EVENT = 'wallet-connection-changed';

/**
 * Wallet types supported by the application
 */
export const WALLET_TYPES = {
  METAMASK: 'metamask',
  PHANTOM: 'phantom',
  WALLETCONNECT: 'walletconnect'
};

/**
 * Storage key for wallet connection data
 */
export const WALLET_STORAGE_KEY = 'walletData';

/**
 * Get all connected wallets from storage
 * @returns {Array} Array of connected wallet objects
 */
export function getConnectedWallets() {
  try {
    if (typeof localStorage === 'undefined') {
      console.warn('localStorage not available, cannot retrieve wallet connections');
      return [];
    }
    
    const walletData = localStorage.getItem(WALLET_STORAGE_KEY);
    if (!walletData) {
      return [];
    }
    
    const parsedData = JSON.parse(walletData);
    
    if (!parsedData.wallets) {
      return [];
    }
    
    const connectedWallets = [];
    
    // Process wallets by type
    for (const [walletType, wallets] of Object.entries(parsedData.wallets)) {
      if (Array.isArray(wallets)) {
        // Add each wallet with its type
        for (const wallet of wallets) {
          if (wallet && (wallet.address || wallet.publicKey)) {
            connectedWallets.push({
              ...wallet,
              type: walletType,
              // Generate a unique ID if not present
              id: wallet.id || `${walletType}-${wallet.address || wallet.publicKey}`
            });
          }
        }
      }
    }
    
    return connectedWallets;
  } catch (error) {
    console.error('Error retrieving connected wallets:', error);
    return [];
  }
}

/**
 * Save wallet connection to storage
 * @param {string} walletType - Type of wallet ('metamask', 'phantom', etc.)
 * @param {Array|Object} accounts - Array of wallet addresses or wallet objects
 * @returns {Promise<boolean>} Success or failure
 */
export async function saveWalletConnection(walletType, accounts) {
  if (!walletType || !accounts) {
    throw createError('Missing required parameters', {
      category: ErrorCategory.WALLET,
      code: ErrorCode.WALLET_CONNECTION_FAILED
    });
  }
  
  try {
    if (typeof localStorage === 'undefined') {
      throw createError('localStorage not available', {
        category: ErrorCategory.WALLET,
        code: ErrorCode.WALLET_CONNECTION_FAILED
      });
    }
    
    // Normalize accounts to an array
    const accountsArray = Array.isArray(accounts) ? accounts : [accounts];
    
    // Get existing wallet data
    let walletData = {};
    const storedData = localStorage.getItem(WALLET_STORAGE_KEY);
    
    if (storedData) {
      try {
        walletData = JSON.parse(storedData);
      } catch (e) {
        console.warn('Could not parse stored wallet data, starting fresh');
        walletData = {};
      }
    }
    
    // Initialize wallets structure if not present
    if (!walletData.wallets) {
      walletData.wallets = {};
    }
    
    // Process accounts into wallet objects
    const normalizedAccounts = accountsArray.map(account => {
      // If account is already a wallet object, use it as is
      if (typeof account === 'object' && account !== null) {
        return {
          ...account,
          // Set connected timestamp if not present
          connectedAt: account.connectedAt || Date.now()
        };
      }
      
      // If account is a string (address), create a wallet object
      return {
        address: account,
        publicKey: account, // For compatibility with both EVM and Solana
        fullAddress: account,
        connectedAt: Date.now(),
        id: `${walletType}-${account}`,
        chain: walletType === WALLET_TYPES.PHANTOM ? 'solana' : 'ethereum' // Default chains
      };
    });
    
    // Update wallet data with new accounts
    walletData.wallets[walletType] = normalizedAccounts;
    
    // Store updated wallet data
    localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(walletData));
    
    // Dispatch wallet connection event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(WALLET_CONNECTION_EVENT, {
        detail: {
          walletType,
          accounts: normalizedAccounts,
          timestamp: Date.now()
        }
      }));
    }
    
    return true;
  } catch (error) {
    console.error('Error saving wallet connection:', error);
    throw createError(`Failed to save wallet connection: ${error.message}`, {
      category: ErrorCategory.WALLET,
      code: ErrorCode.WALLET_CONNECTION_FAILED,
      details: { walletType, error: error.message }
    });
  }
}

/**
 * Disconnect a wallet
 * @param {string} walletId - ID of the wallet to disconnect
 * @returns {Promise<boolean>} Success or failure
 */
export async function disconnectWallet(walletId) {
  try {
    if (typeof localStorage === 'undefined') {
      throw new Error('localStorage not available');
    }
    
    const walletData = localStorage.getItem(WALLET_STORAGE_KEY);
    if (!walletData) {
      return false; // No wallets to disconnect
    }
    
    const parsedData = JSON.parse(walletData);
    
    if (!parsedData.wallets) {
      return false; // No wallets to disconnect
    }
    
    let walletFound = false;
    
    // Find and remove the wallet with the given ID
    for (const [walletType, wallets] of Object.entries(parsedData.wallets)) {
      if (Array.isArray(wallets)) {
        const filteredWallets = wallets.filter(wallet => {
          const walletHasId = wallet && wallet.id === walletId;
          if (walletHasId) {
            walletFound = true;
          }
          return !walletHasId;
        });
        
        // Update if wallet was found and removed
        if (walletFound) {
          if (filteredWallets.length > 0) {
            parsedData.wallets[walletType] = filteredWallets;
          } else {
            delete parsedData.wallets[walletType];
          }
          break;
        }
      }
    }
    
    if (!walletFound) {
      return false; // Wallet not found
    }
    
    // Store updated wallet data
    localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(parsedData));
    
    // Dispatch wallet disconnection event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(WALLET_CONNECTION_EVENT, {
        detail: {
          walletId,
          action: 'disconnect',
          timestamp: Date.now()
        }
      }));
    }
    
    return true;
  } catch (error) {
    console.error('Error disconnecting wallet:', error);
    return false;
  }
}

/**
 * Disconnect all wallets
 * @returns {Promise<boolean>} Success or failure
 */
export async function disconnectAllWallets() {
  try {
    if (typeof localStorage === 'undefined') {
      throw new Error('localStorage not available');
    }
    
    // Remove wallet data
    localStorage.removeItem(WALLET_STORAGE_KEY);
    
    // Set flag to prevent automatic reconnection
    localStorage.setItem('user_disconnected_wallets', 'true');
    
    // Dispatch wallet disconnection event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(WALLET_CONNECTION_EVENT, {
        detail: {
          action: 'disconnect_all',
          timestamp: Date.now()
        }
      }));
    }
    
    return true;
  } catch (error) {
    console.error('Error disconnecting all wallets:', error);
    return false;
  }
}

/**
 * Check if a specific wallet address is connected
 * @param {string} address - The wallet address to check
 * @returns {boolean} True if the wallet is connected
 */
export function isWalletConnected(address) {
  try {
    const connectedWallets = getConnectedWallets();
    
    // Normalize address for comparison
    const normalizedAddress = address.toLowerCase();
    
    return connectedWallets.some(wallet => {
      const walletAddress = (wallet.address || wallet.publicKey || '').toLowerCase();
      return walletAddress === normalizedAddress;
    });
  } catch (error) {
    console.error('Error checking wallet connection:', error);
    return false;
  }
}

/**
 * Get wallet by ID
 * @param {string} walletId - ID of the wallet to get
 * @returns {Object|null} Wallet object or null if not found
 */
export function getWalletById(walletId) {
  try {
    const connectedWallets = getConnectedWallets();
    return connectedWallets.find(wallet => wallet.id === walletId) || null;
  } catch (error) {
    console.error('Error getting wallet by ID:', error);
    return null;
  }
}

/**
 * Update wallet information
 * @param {string} walletId - ID of the wallet to update
 * @param {Object} updates - Properties to update
 * @returns {Promise<boolean>} Success or failure
 */
export async function updateWallet(walletId, updates) {
  try {
    if (typeof localStorage === 'undefined') {
      throw new Error('localStorage not available');
    }
    
    const walletData = localStorage.getItem(WALLET_STORAGE_KEY);
    if (!walletData) {
      return false; // No wallets to update
    }
    
    const parsedData = JSON.parse(walletData);
    
    if (!parsedData.wallets) {
      return false; // No wallets to update
    }
    
    let walletFound = false;
    
    // Find and update the wallet with the given ID
    for (const [walletType, wallets] of Object.entries(parsedData.wallets)) {
      if (Array.isArray(wallets)) {
        for (let i = 0; i < wallets.length; i++) {
          if (wallets[i] && wallets[i].id === walletId) {
            parsedData.wallets[walletType][i] = {
              ...wallets[i],
              ...updates,
              // Ensure ID doesn't change
              id: walletId
            };
            walletFound = true;
            break;
          }
        }
        
        if (walletFound) {
          break;
        }
      }
    }
    
    if (!walletFound) {
      return false; // Wallet not found
    }
    
    // Store updated wallet data
    localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(parsedData));
    
    // Dispatch wallet update event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(WALLET_CONNECTION_EVENT, {
        detail: {
          walletId,
          action: 'update',
          timestamp: Date.now()
        }
      }));
    }
    
    return true;
  } catch (error) {
    console.error('Error updating wallet:', error);
    return false;
  }
}

/**
 * Clean up malformed wallet entries
 * @returns {Promise<boolean>} Success or failure
 */
export async function cleanupWalletStorage() {
  try {
    if (typeof localStorage === 'undefined') {
      throw new Error('localStorage not available');
    }
    
    const walletData = localStorage.getItem(WALLET_STORAGE_KEY);
    if (!walletData) {
      return true; // Nothing to clean up
    }
    
    let parsedData;
    try {
      parsedData = JSON.parse(walletData);
    } catch (e) {
      // If data is invalid JSON, remove it
      localStorage.removeItem(WALLET_STORAGE_KEY);
      return true;
    }
    
    if (!parsedData.wallets || typeof parsedData.wallets !== 'object') {
      // Reset to empty wallets object
      parsedData.wallets = {};
      localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(parsedData));
      return true;
    }
    
    let changes = false;
    
    // Clean up each wallet type
    for (const [walletType, wallets] of Object.entries(parsedData.wallets)) {
      if (!Array.isArray(wallets)) {
        // Remove non-array wallet entries
        delete parsedData.wallets[walletType];
        changes = true;
        continue;
      }
      
      // Filter out invalid wallet entries
      const validWallets = wallets.filter(wallet => {
        return (
          wallet &&
          typeof wallet === 'object' &&
          (wallet.address || wallet.publicKey)
        );
      });
      
      // Update if any invalid wallets were removed
      if (validWallets.length !== wallets.length) {
        if (validWallets.length > 0) {
          parsedData.wallets[walletType] = validWallets;
        } else {
          delete parsedData.wallets[walletType];
        }
        changes = true;
      }
    }
    
    if (changes) {
      localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(parsedData));
    }
    
    return true;
  } catch (error) {
    console.error('Error cleaning up wallet storage:', error);
    return false;
  }
}

export default {
  WALLET_TYPES,
  WALLET_STORAGE_KEY,
  WALLET_CONNECTION_EVENT,
  getConnectedWallets,
  saveWalletConnection,
  disconnectWallet,
  disconnectAllWallets,
  isWalletConnected,
  getWalletById,
  updateWallet,
  cleanupWalletStorage
};