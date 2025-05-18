/**
 * Solana Wallet Utilities
 * 
 * This module provides utilities for interacting with Solana-compatible wallets
 * like Phantom.
 */

import {
  saveWalletConnection,
  disconnectWallet,
  WALLET_TYPES
} from './walletCore';

import {
  createError,
  ErrorCategory,
  ErrorCode
} from '../error-handling';

/**
 * Connect to Phantom wallet
 * @returns {Promise<Object>} Connection result object
 */
export async function connectPhantom() {
  if (typeof window === 'undefined' || !window.solana) {
    throw createError('Phantom wallet is not installed', {
      category: ErrorCategory.WALLET,
      code: ErrorCode.WALLET_NOT_FOUND
    });
  }
  
  try {
    // Check if the provider is Phantom
    if (!window.solana.isPhantom) {
      throw createError('Phantom wallet is not installed', {
        category: ErrorCategory.WALLET,
        code: ErrorCode.WALLET_NOT_FOUND
      });
    }
    
    // Connect to Phantom
    const provider = window.solana;
    await provider.connect();
    
    if (!provider.isConnected) {
      throw createError('Failed to connect to Phantom wallet', {
        category: ErrorCategory.WALLET,
        code: ErrorCode.WALLET_CONNECTION_FAILED
      });
    }
    
    if (!provider.publicKey) {
      throw createError('No public key available from Phantom wallet', {
        category: ErrorCategory.WALLET,
        code: ErrorCode.WALLET_CONNECTION_FAILED
      });
    }
    
    // Create wallet object
    const publicKey = provider.publicKey.toString();
    const wallet = {
      address: publicKey,
      publicKey: publicKey,
      chain: 'solana',
      type: WALLET_TYPES.PHANTOM,
      connectedAt: Date.now(),
      id: `${WALLET_TYPES.PHANTOM}-${publicKey.substring(0, 8)}`
    };
    
    // Save connection to storage
    await saveWalletConnection(WALLET_TYPES.PHANTOM, wallet);
    
    return {
      success: true,
      wallet
    };
  } catch (error) {
    // Handle user rejection separately
    if (error.name === 'WalletConnectionError' || error.message.includes('User rejected')) {
      throw createError('User rejected connection request', {
        category: ErrorCategory.WALLET,
        code: ErrorCode.WALLET_SIGNATURE_REJECTED
      });
    }
    
    throw createError(`Error connecting to Phantom: ${error.message}`, {
      category: ErrorCategory.WALLET,
      code: ErrorCode.WALLET_CONNECTION_FAILED,
      details: { originalError: error.message }
    });
  }
}

/**
 * Sign a message with Phantom wallet
 * @param {string} walletAddress - Wallet address
 * @param {string|Uint8Array} message - Message to sign
 * @returns {Promise<Object>} Signature and signed message
 */
export async function signMessageWithPhantom(walletAddress, message) {
  if (typeof window === 'undefined' || !window.solana) {
    throw createError('Phantom wallet is not installed', {
      category: ErrorCategory.WALLET,
      code: ErrorCode.WALLET_NOT_FOUND
    });
  }
  
  try {
    // Check if the provider is Phantom
    if (!window.solana.isPhantom) {
      throw createError('Phantom wallet is not installed', {
        category: ErrorCategory.WALLET,
        code: ErrorCode.WALLET_NOT_FOUND
      });
    }
    
    // Connect to Phantom
    const provider = window.solana;
    
    // Ensure the wallet is connected
    if (!provider.isConnected || !provider.publicKey) {
      throw createError('Phantom wallet is not connected', {
        category: ErrorCategory.WALLET,
        code: ErrorCode.WALLET_CONNECTION_FAILED
      });
    }
    
    // Check if the connected address matches
    if (provider.publicKey.toString() !== walletAddress) {
      throw createError('Connected wallet address does not match the requested address', {
        category: ErrorCategory.WALLET,
        code: ErrorCode.WALLET_CONNECTION_FAILED
      });
    }
    
    // Convert message to Uint8Array if it's a string
    let encodedMessage;
    if (typeof message === 'string') {
      const encoder = new TextEncoder();
      encodedMessage = encoder.encode(message);
    } else {
      encodedMessage = message;
    }
    
    // Sign the message
    const { signature, publicKey } = await provider.signMessage(encodedMessage, 'utf8');
    
    return {
      signature: signature,
      publicKey: publicKey.toString(),
      message: message
    };
  } catch (error) {
    // Handle user rejection separately
    if (error.name === 'WalletSignTransactionError' || error.message.includes('User rejected')) {
      throw createError('User rejected signature request', {
        category: ErrorCategory.WALLET,
        code: ErrorCode.WALLET_SIGNATURE_REJECTED
      });
    }
    
    throw createError(`Error signing message: ${error.message}`, {
      category: ErrorCategory.WALLET,
      code: ErrorCode.WALLET_CONNECTION_FAILED,
      details: { walletAddress, originalError: error.message }
    });
  }
}

/**
 * Disconnect Phantom wallet
 * @returns {Promise<boolean>} Success or failure
 */
export async function disconnectPhantom() {
  if (typeof window === 'undefined' || !window.solana) {
    throw createError('Phantom wallet is not installed', {
      category: ErrorCategory.WALLET,
      code: ErrorCode.WALLET_NOT_FOUND
    });
  }
  
  try {
    // Check if the provider is Phantom
    if (!window.solana.isPhantom) {
      throw createError('Phantom wallet is not installed', {
        category: ErrorCategory.WALLET,
        code: ErrorCode.WALLET_NOT_FOUND
      });
    }
    
    // Disconnect from Phantom
    const provider = window.solana;
    await provider.disconnect();
    
    return true;
  } catch (error) {
    console.error('Error disconnecting Phantom wallet:', error);
    return false;
  }
}

/**
 * Check if Phantom is available and working
 * @returns {Promise<boolean>} true if Phantom is available
 */
export async function isPhantomAvailable() {
  if (typeof window === 'undefined') {
    return false;
  }
  
  // Check for solana object
  if (!window.solana) {
    return false;
  }
  
  // Check if it's Phantom
  if (!window.solana.isPhantom) {
    return false;
  }
  
  // Test if the provider is responding
  try {
    const version = await window.solana.getVersion();
    return !!version;
  } catch (err) {
    console.warn('Phantom health check failed:', err);
    return false;
  }
}

export default {
  connectPhantom,
  signMessageWithPhantom,
  disconnectPhantom,
  isPhantomAvailable
};