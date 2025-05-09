/**
 * PhantomMultiWalletContext
 * 
 * A React context for managing multiple Phantom wallet connections.
 */

const { createContext, useContext, useState, useEffect } = require('react');

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

  // Load saved wallet connections on component mount
  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const savedWallets = localStorage.getItem('phantomWallets');
        if (savedWallets) {
          setConnectedWallets(JSON.parse(savedWallets));
        }
      }
    } catch (err) {
      console.error('Error loading saved Phantom wallets:', err);
    }
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
      
      // Save to localStorage
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('phantomWallets', JSON.stringify(updatedWallets));
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
      
      // Save to localStorage
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('phantomWallets', JSON.stringify(updatedWallets));
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