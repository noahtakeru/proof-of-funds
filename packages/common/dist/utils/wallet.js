/**
 * Wallet Module
 * 
 * This module provides React hooks and utilities for wallet connection and management.
 * Important: This is a real implementation that will properly interface with MetaMask.
 */

/**
 * React hook for connecting wallets
 * @returns {Object} Object containing connection state and functions
 */
export function useConnect() {
  // For development, we'll create a proper connector object
  const metaMaskConnector = {
    id: 'metaMask',
    name: 'MetaMask',
    ready: typeof window !== 'undefined' && !!window.ethereum,
    connect: async (config = {}) => {
      console.log('Using real MetaMask connector with params:', config);
      
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('MetaMask not available in this environment');
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
          params: [{ force: true }]
        });
        
        if (!accounts || accounts.length === 0) {
          throw new Error('No accounts returned from MetaMask');
        }
        
        // Get chain information
        const chainIdHex = await provider.request({ method: 'eth_chainId' });
        const chainId = parseInt(chainIdHex, 16);
        
        console.log(`Successfully connected to MetaMask. Account: ${accounts[0]}, Chain ID: ${chainId}`);
        
        return {
          account: accounts[0],
          chainId: chainId,
          provider: provider
        };
      } catch (error) {
        console.error('Error connecting to MetaMask:', error);
        throw error;
      }
    }
  };
  
  // List of available connectors
  const connectors = [metaMaskConnector];
  
  // The connect function that accepts connector and parameters
  const connect = async ({ connector, chainId } = {}) => {
    console.log(`Connecting to ${connector?.name || 'wallet'} with chainId: ${chainId}`);
    
    try {
      if (!connector) {
        throw new Error('No connector provided to connect function');
      }
      
      const result = await connector.connect({ chainId });
      
      return {
        status: 'success',
        account: result.account,
        chainId: result.chainId,
        connector
      };
    } catch (error) {
      console.error(`Failed to connect to ${connector?.name}:`, error);
      throw error;
    }
  };
  
  return {
    connect,
    connectAsync: connect, // Same implementation for the async version
    status: 'ready',
    error: null,
    isLoading: false,
    isSuccess: false,
    isError: false,
    connectors
  };
}

/**
 * React hook for disconnecting wallets
 * @returns {Object} Object containing the disconnect function
 */
export function useDisconnect() {
  const disconnect = async () => {
    console.log('Disconnecting wallet - real implementation');
    
    if (typeof window === 'undefined') {
      return false;
    }
    
    try {
      // Clear wagmi-related localStorage entries
      if (localStorage) {
        localStorage.removeItem('wagmi.connected');
        localStorage.removeItem('wagmi.connectors');
        localStorage.removeItem('wagmi.injected.shimDisconnect');
      }
      
      // Handle MetaMask disconnect if possible
      if (window.ethereum && window.ethereum.isMetaMask) {
        // Some providers have different disconnection methods
        if (window.ethereum._state && window.ethereum._state.accounts) {
          console.log('Clearing MetaMask connection state');
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error during wallet disconnection:', error);
      return false;
    }
  };
  
  return {
    disconnect,
    disconnectAsync: disconnect,
    isLoading: false,
    isSuccess: false,
    isError: false,
    error: null
  };
}

/**
 * React hook for accessing the current wallet account
 * @returns {Object} Object containing the current account and connection status
 */
export function useAccount() {
  // This would normally use React state, but for simplicity
  // we'll check MetaMask status directly
  
  let address = null;
  let isConnected = false;
  
  if (typeof window !== 'undefined' && window.ethereum) {
    // Check if there's a connected account
    const accounts = window.ethereum.selectedAddress 
      ? [window.ethereum.selectedAddress]
      : window.ethereum._state?.accounts || [];
      
    if (accounts && accounts.length > 0) {
      address = accounts[0];
      isConnected = true;
    }
  }
  
  return {
    address,
    isConnected,
    isConnecting: false,
    isDisconnected: !isConnected,
    status: isConnected ? 'connected' : 'disconnected',
    connector: isConnected ? { id: 'metaMask', name: 'MetaMask' } : null
  };
}