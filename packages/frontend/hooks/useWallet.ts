/**
 * Wallet Hook
 * 
 * Custom hook for wallet connections and operations.
 * Integrates with the auth system for wallet-based authentication.
 */

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useAuth } from '../contexts/AuthContext';

// Supported wallet types
export type WalletType = 'metamask' | 'walletconnect' | 'coinbase' | 'unknown';

// Chain information
export interface Chain {
  chainId: number;
  name: string;
  symbol: string;
  rpcUrl: string;
  blockExplorer: string;
}

// Common chains
export const CHAINS: Record<number, Chain> = {
  1: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    symbol: 'ETH',
    rpcUrl: 'https://mainnet.infura.io/v3/',
    blockExplorer: 'https://etherscan.io'
  },
  137: {
    chainId: 137,
    name: 'Polygon',
    symbol: 'MATIC',
    rpcUrl: 'https://polygon-rpc.com',
    blockExplorer: 'https://polygonscan.com'
  },
  80001: {
    chainId: 80001,
    name: 'Polygon Mumbai',
    symbol: 'MATIC',
    rpcUrl: 'https://rpc-mumbai.maticvigil.com',
    blockExplorer: 'https://mumbai.polygonscan.com'
  },
  11155111: {
    chainId: 11155111,
    name: 'Sepolia',
    symbol: 'ETH',
    rpcUrl: 'https://sepolia.infura.io/v3/',
    blockExplorer: 'https://sepolia.etherscan.io'
  }
};

/**
 * Hook for wallet functionality
 */
export function useWallet() {
  const auth = useAuth();
  
  // State for wallet connection
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<WalletType>('unknown');
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Initialize wallet from auth context
  useEffect(() => {
    if (auth.isAuthenticated && auth.authType === 'wallet' && auth.user?.walletAddress) {
      setWalletAddress(auth.user.walletAddress);
      
      // Detect wallet type
      if (window.ethereum?.isMetaMask) {
        setWalletType('metamask');
      } else if (window.ethereum?.isCoinbaseWallet) {
        setWalletType('coinbase');
      } else if (window.ethereum?.isWalletConnect) {
        setWalletType('walletconnect');
      }
      
      // Setup provider and signer if available
      if (window.ethereum) {
        const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
        setProvider(web3Provider);
        setSigner(web3Provider.getSigner());
        
        // Get chain ID
        web3Provider.getNetwork().then(network => {
          setChainId(network.chainId);
        }).catch(console.error);
      }
    } else {
      setWalletAddress(null);
      setWalletType('unknown');
      setProvider(null);
      setSigner(null);
      setChainId(null);
    }
  }, [auth.isAuthenticated, auth.authType, auth.user?.walletAddress]);
  
  // Setup event listeners for wallet changes
  useEffect(() => {
    if (!window.ethereum) return;
    
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        // User disconnected wallet
        auth.logout();
      } else if (walletAddress !== accounts[0].toLowerCase()) {
        // User switched accounts - require re-authentication
        auth.logout();
      }
    };
    
    const handleChainChanged = (chainIdHex: string) => {
      const newChainId = parseInt(chainIdHex, 16);
      setChainId(newChainId);
    };
    
    const handleDisconnect = () => {
      auth.logout();
    };
    
    // Add event listeners
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
    window.ethereum.on('disconnect', handleDisconnect);
    
    // Remove event listeners on cleanup
    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
      window.ethereum.removeListener('disconnect', handleDisconnect);
    };
  }, [walletAddress, auth]);
  
  /**
   * Connect wallet and authenticate
   */
  const connect = useCallback(async (): Promise<boolean> => {
    try {
      setIsConnecting(true);
      setConnectionError(null);
      
      // Check if ethereum is available
      if (!window.ethereum) {
        setConnectionError('No Ethereum provider found. Please install MetaMask or another wallet.');
        return false;
      }
      
      // Request accounts
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      
      // Create a challenge message with timestamp to prevent replay attacks
      const timestamp = Date.now();
      const nonce = Math.floor(Math.random() * 1000000);
      const message = `Sign this message to authenticate with Proof of Funds.\n\nTimestamp: ${timestamp}\nNonce: ${nonce}`;
      
      // Sign the message
      const signature = await signer.signMessage(message);
      
      // Authenticate with the signature
      const success = await auth.loginWithWallet(signature, message, address);
      
      if (success) {
        setProvider(provider);
        setSigner(signer);
        setWalletAddress(address);
        
        // Detect wallet type
        if (window.ethereum.isMetaMask) {
          setWalletType('metamask');
        } else if (window.ethereum.isCoinbaseWallet) {
          setWalletType('coinbase');
        } else if (window.ethereum.isWalletConnect) {
          setWalletType('walletconnect');
        }
        
        // Get chain ID
        const network = await provider.getNetwork();
        setChainId(network.chainId);
      }
      
      return success;
    } catch (error) {
      console.error('Wallet connection error:', error);
      setConnectionError(error instanceof Error ? error.message : 'Failed to connect wallet');
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [auth]);
  
  /**
   * Disconnect wallet
   */
  const disconnect = useCallback(async (): Promise<void> => {
    await auth.logout();
    setWalletAddress(null);
    setWalletType('unknown');
    setProvider(null);
    setSigner(null);
    setChainId(null);
  }, [auth]);
  
  /**
   * Switch to a different chain
   * @param targetChainId Chain ID to switch to
   */
  const switchChain = useCallback(async (targetChainId: number): Promise<boolean> => {
    try {
      if (!window.ethereum) {
        throw new Error('No Ethereum provider found');
      }
      
      // Format chain ID as hex
      const chainIdHex = `0x${targetChainId.toString(16)}`;
      
      try {
        // Try to switch to the chain
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainIdHex }]
        });
        
        // Update provider and signer
        if (window.ethereum) {
          const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
          setProvider(web3Provider);
          setSigner(web3Provider.getSigner());
          setChainId(targetChainId);
        }
        
        return true;
      } catch (switchError: any) {
        // This error code indicates that the chain has not been added to MetaMask
        if (switchError.code === 4902) {
          const chain = CHAINS[targetChainId];
          
          if (!chain) {
            throw new Error(`Chain with ID ${targetChainId} is not supported`);
          }
          
          // Add the chain
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: chainIdHex,
              chainName: chain.name,
              nativeCurrency: {
                name: chain.symbol,
                symbol: chain.symbol,
                decimals: 18
              },
              rpcUrls: [chain.rpcUrl],
              blockExplorerUrls: [chain.blockExplorer]
            }]
          });
          
          // Try to switch again
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: chainIdHex }]
          });
          
          // Update provider and signer
          if (window.ethereum) {
            const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
            setProvider(web3Provider);
            setSigner(web3Provider.getSigner());
            setChainId(targetChainId);
          }
          
          return true;
        }
        
        throw switchError;
      }
    } catch (error) {
      console.error('Error switching chain:', error);
      return false;
    }
  }, []);
  
  /**
   * Get wallet balance
   */
  const getBalance = useCallback(async (): Promise<string> => {
    if (!provider || !walletAddress) {
      return '0';
    }
    
    try {
      const balance = await provider.getBalance(walletAddress);
      return ethers.utils.formatEther(balance);
    } catch (error) {
      console.error('Error getting balance:', error);
      return '0';
    }
  }, [provider, walletAddress]);
  
  /**
   * Get chain information
   */
  const getChainInfo = useCallback((): Chain | null => {
    if (!chainId) {
      return null;
    }
    
    return CHAINS[chainId] || null;
  }, [chainId]);
  
  /**
   * Check if a specific chain is supported
   * @param chainId Chain ID to check
   */
  const isChainSupported = useCallback((chainId: number): boolean => {
    return !!CHAINS[chainId];
  }, []);
  
  return {
    // Connection state
    isConnected: !!walletAddress,
    isConnecting,
    walletAddress,
    walletType,
    provider,
    signer,
    chainId,
    connectionError,
    
    // Chain information
    getChainInfo,
    isChainSupported,
    
    // Connection methods
    connect,
    disconnect,
    switchChain,
    getBalance
  };
}

export default useWallet;