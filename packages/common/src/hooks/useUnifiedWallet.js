/**
 * Unified Wallet Hook
 * 
 * This hook provides a standardized interface for interacting with both
 * EVM (MetaMask) and Solana (Phantom) wallets.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getConnectedWallets,
  disconnectWallet,
  disconnectAllWallets,
  WALLET_CONNECTION_EVENT,
  WALLET_TYPES
} from '../utils/walletCore';
import { connectMetaMask, signMessageWithMetaMask } from '../utils/evmWallets';
import { connectPhantom, signMessageWithPhantom } from '../utils/solanaWallets';
import { createError, ErrorCategory, ErrorCode } from '../error-handling';

/**
 * Hook for unified wallet connection and management
 * @returns {Object} Wallet connection state and functions
 */
export function useUnifiedWallet() {
  const [connectedWallets, setConnectedWallets] = useState([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  
  // Load connected wallets on component mount and listen for changes
  useEffect(() => {
    const loadWallets = () => {
      try {
        const wallets = getConnectedWallets();
        setConnectedWallets(wallets);
      } catch (err) {
        console.error('Error loading connected wallets:', err);
        setError(err.message);
      }
    };
    
    // Load wallets initially
    loadWallets();
    
    // Add event listener for wallet connection changes
    const handleWalletEvent = () => {
      loadWallets();
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener(WALLET_CONNECTION_EVENT, handleWalletEvent);
    }
    
    // Cleanup event listener on unmount
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(WALLET_CONNECTION_EVENT, handleWalletEvent);
      }
    };
  }, []);
  
  /**
   * Connect to a wallet
   * @param {string} walletType - Type of wallet to connect to (metamask or phantom)
   * @returns {Promise<Object>} Connected wallet info
   */
  const connect = useCallback(async (walletType) => {
    setIsConnecting(true);
    setError(null);
    
    try {
      // Normalize wallet type to lowercase
      const wallet = walletType?.toLowerCase();
      
      if (wallet === WALLET_TYPES.METAMASK || wallet === 'evm') {
        const result = await connectMetaMask();
        setIsConnecting(false);
        return result;
      } else if (wallet === WALLET_TYPES.PHANTOM || wallet === 'solana') {
        const result = await connectPhantom();
        setIsConnecting(false);
        return result;
      } else {
        throw createError(`Unsupported wallet type: ${walletType}`, {
          category: ErrorCategory.WALLET,
          code: ErrorCode.INVALID_PARAMETER
        });
      }
    } catch (err) {
      setIsConnecting(false);
      setError(err.message);
      throw err;
    }
  }, []);
  
  /**
   * Disconnect a specific wallet
   * @param {string} walletId - ID of the wallet to disconnect
   * @returns {Promise<boolean>} Success or failure
   */
  const disconnect = useCallback(async (walletId) => {
    try {
      const success = await disconnectWallet(walletId);
      return success;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, []);
  
  /**
   * Disconnect all wallets
   * @returns {Promise<boolean>} Success or failure
   */
  const disconnectAll = useCallback(async () => {
    try {
      const success = await disconnectAllWallets();
      return success;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, []);
  
  /**
   * Sign a message with a specific wallet
   * @param {string} walletAddress - Address of the wallet to sign with
   * @param {string} message - Message to sign
   * @param {string} walletType - Type of wallet (metamask or phantom)
   * @returns {Promise<string|Object>} Signature
   */
  const signMessage = useCallback(async (walletAddress, message, walletType) => {
    try {
      // Determine wallet type if not specified
      if (!walletType) {
        // Try to determine wallet type from connected wallets
        const wallet = connectedWallets.find(w => 
          w.address === walletAddress || w.publicKey === walletAddress
        );
        
        if (wallet) {
          walletType = wallet.type;
        } else {
          throw createError('Wallet type not specified and cannot be determined', {
            category: ErrorCategory.WALLET,
            code: ErrorCode.INVALID_PARAMETER
          });
        }
      }
      
      if (walletType === WALLET_TYPES.METAMASK || walletType === 'evm') {
        return await signMessageWithMetaMask(walletAddress, message);
      } else if (walletType === WALLET_TYPES.PHANTOM || walletType === 'solana') {
        return await signMessageWithPhantom(walletAddress, message);
      } else {
        throw createError(`Unsupported wallet type for signing: ${walletType}`, {
          category: ErrorCategory.WALLET,
          code: ErrorCode.INVALID_PARAMETER
        });
      }
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [connectedWallets]);
  
  return {
    connectedWallets,
    isConnecting,
    error,
    connect,
    disconnect,
    disconnectAll,
    signMessage,
    // Helper functions
    getWalletsByType: (type) => connectedWallets.filter(w => w.type === type),
    isWalletConnected: (address) => connectedWallets.some(w => 
      w.address === address || w.publicKey === address
    )
  };
}

export default useUnifiedWallet;