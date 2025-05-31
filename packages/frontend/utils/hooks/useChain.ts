/**
 * Chain Adapter Hook
 * 
 * This hook provides easy access to chain adapters in React components.
 * It handles connecting to chains, managing wallet states, and retrieving balances.
 */
import { useState, useEffect, useCallback } from 'react';
import { BigNumber } from 'ethers';

import { ChainAdapter, ConnectionStatus } from '../chains/ChainAdapter';
import chainRegistry, { ChainType } from '../chains/ChainAdapterRegistry';

/**
 * Chain state hook return type
 */
interface UseChainReturn {
  // Chain data
  chainId: number;
  chainName: string;
  connectionStatus: ConnectionStatus;
  walletAddress: string | null;
  balance: BigNumber | null;
  isReady: boolean;
  
  // Chain actions
  connect: () => Promise<string>;
  disconnect: () => Promise<void>;
  refreshBalance: () => Promise<BigNumber | null>;
  signMessage: (message: string) => Promise<string>;
  getTransactions: (options?: any) => Promise<any[]>;
}

/**
 * Hook for interacting with blockchain in React components
 * @param chainType Type of chain to connect to
 * @param chainId Optional specific chain ID
 * @returns Chain state and actions
 */
export function useChain(
  chainType: ChainType = ChainType.EVM,
  chainId?: number
): UseChainReturn {
  // Get the adapter for this chain
  const adapter = chainId 
    ? chainRegistry.getAdapter(chainId)
    : chainRegistry.getAdapterByType(chainType);
  
  // Component state
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    adapter.getConnectionStatus()
  );
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<BigNumber | null>(null);
  const [isReady, setIsReady] = useState<boolean>(adapter.isReady());
  
  /**
   * Connect to the chain
   */
  const connect = useCallback(async (): Promise<string> => {
    try {
      const address = await adapter.connect();
      setWalletAddress(address);
      setConnectionStatus(adapter.getConnectionStatus());
      return address;
    } catch (error) {
      console.error('Connection error:', error);
      setConnectionStatus(adapter.getConnectionStatus());
      throw error;
    }
  }, [adapter]);
  
  /**
   * Disconnect from the chain
   */
  const disconnect = useCallback(async (): Promise<void> => {
    try {
      await adapter.disconnect();
      setWalletAddress(null);
      setBalance(null);
      setConnectionStatus(adapter.getConnectionStatus());
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  }, [adapter]);
  
  /**
   * Refresh the wallet balance
   */
  const refreshBalance = useCallback(async (): Promise<BigNumber | null> => {
    if (!walletAddress || connectionStatus !== ConnectionStatus.CONNECTED) {
      return null;
    }
    
    try {
      const newBalance = await adapter.getBalance(walletAddress);
      setBalance(newBalance);
      return newBalance;
    } catch (error) {
      console.error('Balance refresh error:', error);
      return null;
    }
  }, [adapter, walletAddress, connectionStatus]);
  
  /**
   * Sign a message with the wallet
   */
  const signMessage = useCallback(async (message: string): Promise<string> => {
    if (connectionStatus !== ConnectionStatus.CONNECTED) {
      throw new Error('Wallet not connected');
    }
    
    return await adapter.signMessage(message);
  }, [adapter, connectionStatus]);
  
  /**
   * Get transactions for the connected wallet
   */
  const getTransactions = useCallback(async (options?: any): Promise<any[]> => {
    if (!walletAddress || connectionStatus !== ConnectionStatus.CONNECTED) {
      return [];
    }
    
    try {
      return await adapter.getTransactions(walletAddress, options);
    } catch (error) {
      console.error('Get transactions error:', error);
      return [];
    }
  }, [adapter, walletAddress, connectionStatus]);
  
  // Set up event listeners for connection status changes
  useEffect(() => {
    // Handle wallet events from EVMChainAdapter
    const handleAccountChanged = (event: CustomEvent) => {
      setWalletAddress(event.detail.address);
      setConnectionStatus(adapter.getConnectionStatus());
      refreshBalance();
    };
    
    const handleChainChanged = (event: CustomEvent) => {
      // If chain changed to something outside our selected chain, we need to update
      if (chainId && event.detail.chainId !== chainId) {
        setWalletAddress(null);
        setBalance(null);
        setConnectionStatus(ConnectionStatus.DISCONNECTED);
      } else {
        setWalletAddress(event.detail.address);
        setConnectionStatus(adapter.getConnectionStatus());
        refreshBalance();
      }
    };
    
    const handleDisconnected = () => {
      setWalletAddress(null);
      setBalance(null);
      setConnectionStatus(ConnectionStatus.DISCONNECTED);
    };
    
    // Add event listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('evmAccountChanged', handleAccountChanged as EventListener);
      window.addEventListener('evmChainChanged', handleChainChanged as EventListener);
      window.addEventListener('evmDisconnected', handleDisconnected as EventListener);
    }
    
    // Update ready state
    setIsReady(adapter.isReady());
    
    // Clean up event listeners
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('evmAccountChanged', handleAccountChanged as EventListener);
        window.removeEventListener('evmChainChanged', handleChainChanged as EventListener);
        window.removeEventListener('evmDisconnected', handleDisconnected as EventListener);
      }
    };
  }, [adapter, chainId, refreshBalance]);
  
  // Auto-refresh balance when connection status or wallet address changes
  useEffect(() => {
    if (connectionStatus === ConnectionStatus.CONNECTED && walletAddress) {
      refreshBalance();
    }
  }, [connectionStatus, walletAddress, refreshBalance]);
  
  return {
    chainId: adapter.getChainId(),
    chainName: adapter.getChainName(),
    connectionStatus,
    walletAddress,
    balance,
    isReady,
    connect,
    disconnect,
    refreshBalance,
    signMessage,
    getTransactions
  };
}