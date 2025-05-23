/**
 * EVM Wallet Utilities
 * 
 * This module provides utilities for interacting with EVM-compatible wallets
 * like MetaMask and WalletConnect.
 */

import {
  getChainName,
  getChainId,
  getRpcUrl
} from './chainMappings';

import {
  WALLET_TYPES,
  saveWalletConnection,
  disconnectWallet
} from './walletCore';

import {
  createError,
  ErrorCategory,
  ErrorCode
} from '../error-handling';

/**
 * Connect to MetaMask
 * @returns {Promise<Object>} Connection result object
 */
export async function connectMetaMask() {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw createError('MetaMask is not installed', {
      category: ErrorCategory.WALLET,
      code: ErrorCode.WALLET_NOT_FOUND
    });
  }
  
  try {
    // Determine the provider to use
    let provider = window.ethereum;
    if (window.ethereum.providers) {
      const metaMaskProvider = window.ethereum.providers.find(p => p.isMetaMask);
      if (metaMaskProvider) {
        provider = metaMaskProvider;
      }
    }
    
    // Request accounts with force parameter to ensure popup shows
    const accounts = await provider.request({
      method: 'eth_requestAccounts',
      params: [{ force: true }] // Force showing the popup
    });
    
    if (!accounts || accounts.length === 0) {
      throw createError('No accounts returned from MetaMask', {
        category: ErrorCategory.WALLET,
        code: ErrorCode.WALLET_CONNECTION_FAILED
      });
    }
    
    // Get chain information
    const chainIdHex = await provider.request({ method: 'eth_chainId' });
    const chainId = parseInt(chainIdHex, 16);
    const chainName = getChainName(chainId);
    
    // Create wallet object
    const wallet = {
      address: accounts[0],
      fullAddress: accounts[0],
      chainId,
      chain: chainName,
      type: WALLET_TYPES.METAMASK,
      connectedAt: Date.now(),
      id: `${WALLET_TYPES.METAMASK}-${accounts[0]}`
    };
    
    // Save connection to storage
    await saveWalletConnection(WALLET_TYPES.METAMASK, wallet);
    
    return {
      success: true,
      wallet
    };
  } catch (error) {
    // Handle user rejection separately
    if (error.code === 4001) {
      throw createError('User rejected connection request', {
        category: ErrorCategory.WALLET,
        code: ErrorCode.WALLET_SIGNATURE_REJECTED
      });
    }
    
    throw createError(`Error connecting to MetaMask: ${error.message}`, {
      category: ErrorCategory.WALLET,
      code: ErrorCode.WALLET_CONNECTION_FAILED,
      details: { originalError: error.message }
    });
  }
}

/**
 * Sign a message with MetaMask
 * @param {string} address - Wallet address
 * @param {string} message - Message to sign
 * @returns {Promise<string>} Signature
 */
export async function signMessageWithMetaMask(address, message) {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw createError('MetaMask is not installed', {
      category: ErrorCategory.WALLET,
      code: ErrorCode.WALLET_NOT_FOUND
    });
  }
  
  try {
    // Dynamically import ethers
    const ethers = await importEthers();
    
    // Determine the provider to use
    let provider = window.ethereum;
    if (window.ethereum.providers) {
      const metaMaskProvider = window.ethereum.providers.find(p => p.isMetaMask);
      if (metaMaskProvider) {
        provider = metaMaskProvider;
      }
    }
    
    // Create signer based on ethers version
    let signer;
    
    if (ethers.providers && ethers.providers.Web3Provider) {
      // ethers v5
      const ethProvider = new ethers.providers.Web3Provider(provider);
      signer = ethProvider.getSigner(address);
    } else if (ethers.BrowserProvider) {
      // ethers v6
      const ethProvider = new ethers.BrowserProvider(provider);
      signer = await ethProvider.getSigner(address);
    } else {
      throw createError('Unsupported ethers.js version', {
        category: ErrorCategory.SYSTEM,
        code: ErrorCode.INTERNAL_ERROR
      });
    }
    
    // Sign the message
    const signature = await signer.signMessage(message);
    return signature;
  } catch (error) {
    // Handle user rejection separately
    if (error.code === 4001) {
      throw createError('User rejected signature request', {
        category: ErrorCategory.WALLET,
        code: ErrorCode.WALLET_SIGNATURE_REJECTED
      });
    }
    
    throw createError(`Error signing message: ${error.message}`, {
      category: ErrorCategory.WALLET,
      code: ErrorCode.WALLET_CONNECTION_FAILED,
      details: { address, originalError: error.message }
    });
  }
}

/**
 * Switch to a different chain in MetaMask
 * @param {number|string} chainId - Chain ID
 * @returns {Promise<boolean>} Success or failure
 */
export async function switchChain(chainId) {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw createError('MetaMask is not installed', {
      category: ErrorCategory.WALLET,
      code: ErrorCode.WALLET_NOT_FOUND
    });
  }
  
  try {
    // Convert from string or number to hex
    const chainIdHex = typeof chainId === 'string' && chainId.startsWith('0x')
      ? chainId
      : `0x${parseInt(chainId, 10).toString(16)}`;
    
    // Determine the provider to use
    let provider = window.ethereum;
    if (window.ethereum.providers) {
      const metaMaskProvider = window.ethereum.providers.find(p => p.isMetaMask);
      if (metaMaskProvider) {
        provider = metaMaskProvider;
      }
    }
    
    // Try to switch to the chain
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }]
      });
      
      return true;
    } catch (switchError) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        // Try to add the chain
        await addChain(chainId);
        return true;
      }
      
      throw switchError;
    }
  } catch (error) {
    // Handle user rejection separately
    if (error.code === 4001) {
      throw createError('User rejected chain switch request', {
        category: ErrorCategory.WALLET,
        code: ErrorCode.WALLET_SIGNATURE_REJECTED
      });
    }
    
    throw createError(`Error switching chain: ${error.message}`, {
      category: ErrorCategory.WALLET,
      code: ErrorCode.WALLET_CONNECTION_FAILED,
      details: { chainId, originalError: error.message }
    });
  }
}

/**
 * Add a chain to MetaMask
 * @param {number|string} chainId - Chain ID
 * @returns {Promise<boolean>} Success or failure
 */
export async function addChain(chainId) {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw createError('MetaMask is not installed', {
      category: ErrorCategory.WALLET,
      code: ErrorCode.WALLET_NOT_FOUND
    });
  }
  
  try {
    // Convert to number if hex string
    const chainIdNum = typeof chainId === 'string' && chainId.startsWith('0x')
      ? parseInt(chainId, 16)
      : parseInt(chainId, 10);
    
    // Get chain information
    const chainName = getChainName(chainIdNum);
    const rpcUrl = getRpcUrl(chainIdNum);
    
    if (!rpcUrl) {
      throw createError(`No RPC URL found for chain ID ${chainIdNum}`, {
        category: ErrorCategory.WALLET,
        code: ErrorCode.INTERNAL_ERROR
      });
    }
    
    // Prepare chain parameters
    const chainParams = {
      chainId: `0x${chainIdNum.toString(16)}`,
      chainName: chainName.charAt(0).toUpperCase() + chainName.slice(1), // Capitalize name
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18
      },
      rpcUrls: [rpcUrl],
      blockExplorerUrls: []
    };
    
    // Adjust parameters for specific chains
    if (chainName === 'polygon' || chainName === 'polygon-amoy' || chainName === 'mumbai') {
      chainParams.nativeCurrency = {
        name: 'Matic',
        symbol: 'MATIC',
        decimals: 18
      };
    } else if (chainName === 'binance' || chainName === 'binance-testnet') {
      chainParams.nativeCurrency = {
        name: 'BNB',
        symbol: 'BNB',
        decimals: 18
      };
    } else if (chainName === 'avalanche') {
      chainParams.nativeCurrency = {
        name: 'Avax',
        symbol: 'AVAX',
        decimals: 18
      };
    }
    
    // Add the chain
    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [chainParams]
    });
    
    return true;
  } catch (error) {
    // Handle user rejection separately
    if (error.code === 4001) {
      throw createError('User rejected add chain request', {
        category: ErrorCategory.WALLET,
        code: ErrorCode.WALLET_SIGNATURE_REJECTED
      });
    }
    
    throw createError(`Error adding chain: ${error.message}`, {
      category: ErrorCategory.WALLET,
      code: ErrorCode.WALLET_CONNECTION_FAILED,
      details: { chainId, originalError: error.message }
    });
  }
}

/**
 * Import ethers library
 * @returns {Promise<Object>} ethers library
 */
async function importEthers() {
  try {
    // Import from proper location
    const ethers = await import('ethers');
    return ethers;
  } catch (error) {
    // Try fallback import from common
    try {
      const { getEthers } = await import('@proof-of-funds/common/utils/ethersUtils');
      const { ethers } = await getEthers();
      return ethers;
    } catch (fallbackError) {
      throw createError('Failed to load ethers library', {
        category: ErrorCategory.SYSTEM,
        code: ErrorCode.INTERNAL_ERROR,
        details: { originalError: error.message, fallbackError: fallbackError.message }
      });
    }
  }
}

export default {
  connectMetaMask,
  signMessageWithMetaMask,
  switchChain,
  addChain
};