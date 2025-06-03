/**
 * PhantomMultiWalletContext
 * 
 * A React context for managing multiple Phantom wallet connections.
 */

import { createContext, useContext, useState, useEffect } from 'react';

// Create context
const PhantomMultiWalletContext = createContext({
  connectedWallets: [],
  connect: async () => {},
  disconnect: () => {},
  isConnecting: false,
  error: null
});

// Provider component
export function PhantomMultiWalletProvider({ children }) {
  const [connectedWallets, setConnectedWallets] = useState([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);

  // Load saved wallet connections on component mount and listen for changes
  useEffect(() => {
    const loadWallets = () => {
      try {
        if (typeof localStorage !== 'undefined') {
          // Try to get wallets from the main wallet storage
          const walletData = localStorage.getItem('walletData');
          if (walletData) {
            const parsedData = JSON.parse(walletData);
            if (parsedData && parsedData.wallets && parsedData.wallets.phantom && Array.isArray(parsedData.wallets.phantom)) {
              // Convert wallet objects to our expected format
              const phantomWallets = parsedData.wallets.phantom.map(wallet => {
                // If it's already a wallet object
                if (typeof wallet === 'object' && wallet !== null && wallet.address) {
                  return {
                    address: wallet.address,
                    publicKey: wallet.address,
                    chain: wallet.chain || 'solana',
                    type: 'phantom',
                    connectedAt: wallet.connectedAt || new Date().toISOString()
                  };
                } 
                // If it's just a string address
                else if (typeof wallet === 'string') {
                  return {
                    address: wallet,
                    publicKey: wallet,
                    chain: 'solana',
                    type: 'phantom',
                    connectedAt: new Date().toISOString()
                  };
                }
                return null;
              }).filter(Boolean); // Remove any null entries
              
              console.log('Loaded Phantom wallets from central storage:', phantomWallets);
              setConnectedWallets(phantomWallets);
            } else {
              // Fallback to legacy storage
              const legacyWallets = localStorage.getItem('phantomWallets');
              if (legacyWallets) {
                console.log('Using legacy Phantom wallet storage');
                setConnectedWallets(JSON.parse(legacyWallets));
              }
            }
          }
        }
      } catch (err) {
        console.error('Error loading saved Phantom wallets:', err);
      }
    };
    
    // Load wallets initially
    loadWallets();
    
    // Listen for wallet connection changes
    const handleStorageChange = (e) => {
      if (e.key === 'walletData' || e.key === 'wallet-connection-changed') {
        console.log('Wallet storage changed, updating Phantom wallet list');
        loadWallets();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('wallet-connection-changed', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('wallet-connection-changed', handleStorageChange);
    };
  }, []);

  // Connect to a Phantom wallet
  const connect = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      // Check if Phantom is available
      if (typeof window === 'undefined') {
        throw new Error('Cannot connect to Phantom in a non-browser environment');
      }
      
      if (!window.solana || !window.solana.isPhantom) {
        throw new Error('Phantom wallet is not installed');
      }
      
      // Try to connect to Phantom
      const solanaProvider = window.solana;
      
      // Request connection
      await solanaProvider.connect();
      
      if (!solanaProvider.isConnected) {
        throw new Error('Failed to connect to Phantom wallet');
      }
      
      if (!solanaProvider.publicKey) {
        throw new Error('No public key available from Phantom wallet');
      }
      
      // Create wallet object
      const wallet = {
        address: solanaProvider.publicKey.toString(),
        publicKey: solanaProvider.publicKey.toString(),
        chain: 'solana',
        type: 'phantom',
        connectedAt: new Date().toISOString()
      };
      
      // Update state
      const updatedWallets = [...connectedWallets, wallet];
      setConnectedWallets(updatedWallets);
      
      // Save to localStorage using both formats for compatibility
      if (typeof localStorage !== 'undefined') {
        // Update legacy storage
        localStorage.setItem('phantomWallets', JSON.stringify(updatedWallets));
        
        // Update central wallet storage
        try {
          const walletData = localStorage.getItem('walletData');
          const parsedData = walletData ? JSON.parse(walletData) : { wallets: {} };
          
          // Ensure wallets object exists
          if (!parsedData.wallets) {
            parsedData.wallets = {};
          }
          
          // Ensure phantom wallets array exists
          if (!parsedData.wallets.phantom || !Array.isArray(parsedData.wallets.phantom)) {
            parsedData.wallets.phantom = [];
          }
          
          // Add the new wallet if it doesn't exist
          const walletAddress = wallet.address;
          const existingIndex = parsedData.wallets.phantom.findIndex(w => 
            (typeof w === 'string' && w === walletAddress) || 
            (typeof w === 'object' && w && w.address === walletAddress)
          );
          
          if (existingIndex === -1) {
            parsedData.wallets.phantom.push({
              id: `phantom-${walletAddress.substring(0, 8)}`,
              address: walletAddress,
              displayAddress: `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`,
              fullAddress: walletAddress,
              type: 'phantom',
              chain: 'solana',
              name: `Phantom ${walletAddress.substring(0, 6)}...`,
              connected: true,
              connectedAt: new Date().toISOString()
            });
          }
          
          // Save updated data
          localStorage.setItem('walletData', JSON.stringify(parsedData));
          
          // Trigger wallet connection change event
          const walletChangeEvent = new CustomEvent('wallet-connection-changed', {
            detail: { timestamp: Date.now(), walletType: 'phantom' }
          });
          window.dispatchEvent(walletChangeEvent);
        } catch (e) {
          console.error('Error updating central wallet storage:', e);
        }
      }
      
      return wallet;
    } catch (err) {
      const errorMessage = err.message || 'Failed to connect to Phantom wallet';
      setError(errorMessage);
      console.error('Phantom wallet connection error:', err);
      throw new Error(errorMessage);
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect a Phantom wallet
  const disconnect = (walletAddress) => {
    try {
      const updatedWallets = connectedWallets.filter(
        wallet => wallet.address !== walletAddress
      );
      setConnectedWallets(updatedWallets);
      
      // Save to localStorage - update both formats
      if (typeof localStorage !== 'undefined') {
        // Update legacy storage
        localStorage.setItem('phantomWallets', JSON.stringify(updatedWallets));
        
        // Update central wallet storage
        try {
          const walletData = localStorage.getItem('walletData');
          if (walletData) {
            const parsedData = JSON.parse(walletData);
            
            // If wallet structure exists
            if (parsedData.wallets && parsedData.wallets.phantom && Array.isArray(parsedData.wallets.phantom)) {
              // Filter out the disconnected wallet
              parsedData.wallets.phantom = parsedData.wallets.phantom.filter(w => {
                if (typeof w === 'string') {
                  return w !== walletAddress;
                } else if (typeof w === 'object' && w) {
                  return w.address !== walletAddress;
                }
                return true;
              });
              
              // Save updated data
              localStorage.setItem('walletData', JSON.stringify(parsedData));
              
              // Trigger wallet connection change event
              const walletChangeEvent = new CustomEvent('wallet-connection-changed', {
                detail: { timestamp: Date.now(), walletType: 'phantom', disconnected: true }
              });
              window.dispatchEvent(walletChangeEvent);
            }
          }
        } catch (e) {
          console.error('Error updating central wallet storage during disconnect:', e);
        }
      }
    } catch (err) {
      console.error('Error disconnecting Phantom wallet:', err);
    }
  };

  const value = {
    connectedWallets,
    connect,
    disconnect,
    isConnecting,
    error
  };

  return (
    <PhantomMultiWalletContext.Provider value={value}>
      {children}
    </PhantomMultiWalletContext.Provider>
  );
}

// Custom hook to use the context
export function usePhantomMultiWallet() {
  const context = useContext(PhantomMultiWalletContext);
  if (!context) {
    throw new Error('usePhantomMultiWallet must be used within a PhantomMultiWalletProvider');
  }
  return context;
}