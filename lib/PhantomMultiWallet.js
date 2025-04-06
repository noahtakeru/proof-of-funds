/**
 * PhantomMultiWallet.js - Enable simultaneous connections to multiple Phantom wallets
 * 
 * This module provides functionality to connect, manage, and interact with multiple Phantom wallet
 * accounts simultaneously, which is not natively supported by the Phantom wallet extension.
 * 
 * Key features:
 * - Connection to multiple Phantom wallets
 * - Transparent wallet switching for transaction signing
 * - Transaction queueing to prevent conflicts
 * - Persistence of wallet connections
 * - Message and transaction signing across all connected wallets
 * 
 * The implementation uses improved event listening and state management to work with
 * Phantom's limitation of only allowing one connected wallet at a time.
 */

/**
 * PhantomWalletProxy - Proxy class for each connected Phantom wallet
 * 
 * This class represents a single Phantom wallet connection and provides methods
 * to interact with it, handling the necessary background connection switching.
 * 
 * Each proxy maintains:
 * - The wallet's address
 * - Connection state information
 * - Methods for wallet-specific operations (signing, sending transactions)
 * - Tracking when the wallet was last active
 */

// Utility to help track wallet connections in background
class PhantomWalletProxy {
  constructor(address, provider) {
    this.address = address;
    this.provider = provider; // Reference to the Phantom provider
    this.isConnected = true;
    this.isActive = false; // True if this is the currently active wallet in Phantom
    this.lastActive = Date.now();
    this.connectionAttempts = 0;
    this.lastAttemptTime = 0;
    this.maxRetryDelay = 8000; // Max backoff delay in ms
  }

  // Check if this wallet is currently active in Phantom
  async isCurrentlyActive() {
    try {
      // Get current Phantom wallet and compare
      const currentAddress = await getActivePhantomAddress();
      this.isActive = currentAddress === this.address;
      if (this.isActive) {
        this.lastActive = Date.now();
        // Reset connection attempt counter on success
        this.connectionAttempts = 0;
        
        // Update wallet state in localStorage
        this._updateWalletConnectionState(true);
      }
      return this.isActive;
    } catch (error) {
      console.error('Error checking if wallet is active:', error);
      return false;
    }
  }

  // Make this wallet active in Phantom with improved reliability
  async makeActive() {
    try {
      // Increment attempt counter for exponential backoff
      this.connectionAttempts++;
      this.lastAttemptTime = Date.now();
      
      // Check if wallet is already active
      const isActive = await this.isCurrentlyActive();
      if (isActive) {
        this.lastActive = Date.now();
        return true;
      }

      // Get backoff delay based on connection attempts (exponential with jitter)
      const baseDelay = Math.min(1000 * Math.pow(1.5, this.connectionAttempts - 1), this.maxRetryDelay);
      const jitter = Math.random() * 0.3 * baseDelay; // Add 0-30% jitter
      const delay = Math.floor(baseDelay + jitter);
      
      console.log(`Attempt #${this.connectionAttempts} to switch to wallet ${this.address}. Backoff: ${delay}ms`);
      
      // If we need to backoff, wait before trying
      if (this.connectionAttempts > 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Try to switch with improved connection management
      await requestPhantomWalletSwitch(this.address);

      // Verify the switch was successful
      const postSwitchAddress = await getActivePhantomAddressWithRetry();
      this.isActive = postSwitchAddress === this.address;

      if (this.isActive) {
        this.lastActive = Date.now();
        // Reset connection attempt counter on success
        this.connectionAttempts = 0;
        
        // Update wallet state in localStorage
        this._updateWalletConnectionState(true);
        return true;
      } else {
        console.warn(`Wallet switch was not successful. Expected: ${this.address}, Got: ${postSwitchAddress}`);
        
        // Update wallet state in localStorage
        this._updateWalletConnectionState(false, 'switch_failed');
        return false;
      }
    } catch (error) {
      console.error('Error making wallet active:', error);
      this.isActive = false;
      
      // Update wallet state in localStorage
      this._updateWalletConnectionState(false, error.message);
      return false;
    }
  }
  
  // Update wallet connection state in localStorage for better connectivity tracking
  _updateWalletConnectionState(success, errorMessage = null) {
    try {
      const walletState = JSON.parse(localStorage.getItem('phantomWalletState') || '{}');
      
      walletState[this.address] = {
        ...(walletState[this.address] || {}),
        lastAttempt: Date.now(),
        connected: success,
        connectionAttempts: this.connectionAttempts,
        lastActive: success ? Date.now() : (walletState[this.address]?.lastActive || 0)
      };
      
      if (errorMessage) {
        walletState[this.address].lastError = errorMessage;
      }
      
      localStorage.setItem('phantomWalletState', JSON.stringify(walletState));
    } catch (e) {
      console.error("Error updating wallet connection state:", e);
    }
  }

  // Sign a transaction using this wallet
  async signTransaction(transaction) {
    // Try to ensure this wallet is active before signing
    const isActive = await this.makeActive();
    if (!isActive) {
      console.warn('Could not activate wallet for signing, proceeding with current active wallet');
    }

    try {
      const provider = getPhantomProvider();
      return await provider.signTransaction(transaction);
    } catch (error) {
      console.error('Error signing transaction:', error);
      throw error;
    }
  }

  // Sign multiple transactions
  async signAllTransactions(transactions) {
    // Try to ensure this wallet is active before signing
    const isActive = await this.makeActive();
    if (!isActive) {
      console.warn('Could not activate wallet for signing, proceeding with current active wallet');
    }

    try {
      const provider = getPhantomProvider();
      return await provider.signAllTransactions(transactions);
    } catch (error) {
      console.error('Error signing multiple transactions:', error);
      throw error;
    }
  }

  // Sign a message
  async signMessage(message) {
    // Try to ensure this wallet is active before signing
    const isActive = await this.makeActive();
    if (!isActive) {
      console.warn('Could not activate wallet for signing, proceeding with current active wallet');
    }

    try {
      const provider = getPhantomProvider();
      return await provider.signMessage(message);
    } catch (error) {
      console.error('Error signing message:', error);
      throw error;
    }
  }

  // Send a transaction
  async sendTransaction(transaction) {
    // Try to ensure this wallet is active before sending
    const isActive = await this.makeActive();
    if (!isActive) {
      console.warn('Could not activate wallet for sending, proceeding with current active wallet');
    }

    try {
      const provider = getPhantomProvider();
      return await provider.sendTransaction(transaction);
    } catch (error) {
      console.error('Error sending transaction:', error);
      throw error;
    }
  }
}

// Main PhantomMultiWallet class
class PhantomMultiWallet {
  constructor() {
    this.connectedWallets = new Map(); // Map of address -> PhantomWalletProxy
    this.isInitialized = false;
    this.currentActiveWallet = null;
    this.transactionQueue = [];
    this.isProcessingQueue = false;
    this.accountChangeListener = null;
    this.walletSessionLog = new Map(); // Track wallet switching history
    this.lastReconnectAttempt = 0; // Timestamp of last reconnect attempt
  }

  // Get the Phantom provider safely
  getPhantomProvider() {
    return getPhantomProvider();
  }

  // Initialize the multi-wallet system
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Check if Phantom is installed
      if (!isPhantomInstalled()) {
        throw new Error('Phantom wallet not detected. Please install Phantom extension.');
      }

      // Initialize with any existing wallet connections from localStorage
      await this.loadSavedWallets();

      // Set up account change listeners
      this.setupAccountChangeListeners();

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Error initializing PhantomMultiWallet:', error);
      throw error;
    }
  }

  // Set up event listeners for wallet account changes
  setupAccountChangeListeners() {
    try {
      const provider = this.getPhantomProvider();

      // Remove any existing listeners to prevent duplicates
      if (this.accountChangeListener) {
        provider.off('accountChanged', this.accountChangeListener);
      }

      // Create new listener
      this.accountChangeListener = (publicKey) => {
        if (!publicKey) {
          console.log('Phantom wallet disconnected');
          this.currentActiveWallet = null;
          return;
        }

        const address = publicKey.toString();
        console.log('Phantom wallet account changed:', address);

        // Update current active wallet
        this.currentActiveWallet = address;

        // If we don't have this wallet in our list yet, add it
        if (!this.connectedWallets.has(address)) {
          this.connectedWallets.set(address, new PhantomWalletProxy(address, provider));
          console.log('Added new wallet to tracking:', address);
        }

        // Update the last active timestamp
        const proxy = this.connectedWallets.get(address);
        if (proxy) {
          proxy.isActive = true;
          proxy.lastActive = Date.now();
        }
      };

      // Register the listener
      provider.on('accountChanged', this.accountChangeListener);
      console.log('Registered Phantom accountChanged event listener');
    } catch (error) {
      console.error('Error setting up account change listeners:', error);
    }
  }

  // Load any saved wallets from localStorage
  async loadSavedWallets() {
    try {
      const walletData = getStoredWalletData();

      if (walletData?.wallets?.phantom && walletData.wallets.phantom.length > 0) {
        for (const address of walletData.wallets.phantom) {
          // Create a proxy for each saved wallet
          this.connectedWallets.set(address, new PhantomWalletProxy(address, this.getPhantomProvider()));
        }
        console.log(`Loaded ${this.connectedWallets.size} saved Phantom wallets`);
      }
    } catch (error) {
      console.error('Error loading saved wallets:', error);
    }
  }

  // Get all wallets currently loaded
  getAllWallets() {
    return Array.from(this.connectedWallets.keys());
  }

  // Connect to a Phantom wallet with improved error handling
  async connectWallet() {
    try {
      // Get the provider
      const provider = this.getPhantomProvider();

      // Check connection state
      const isConnected = provider.isConnected;

      // If already connected, get the current wallet first
      let currentWallet = null;
      if (isConnected) {
        try {
          currentWallet = provider.publicKey?.toString();
          console.log('Currently connected to wallet:', currentWallet);
        } catch (err) {
          console.warn('Could not get current wallet address, proceeding with connect flow', err);
        }
      }

      // Decide whether to proceed with connection
      let shouldConnect = true;

      // If we're connected and have a current wallet, and user wants a new wallet
      // we need to disconnect first
      if (isConnected && currentWallet) {
        try {
          console.log('Disconnecting from current wallet to allow new connection');
          await provider.disconnect();

          // Add a longer delay to ensure disconnect completes
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (disconnectError) {
          console.warn('Error disconnecting from current wallet, but proceeding anyway:', disconnectError);
        }
      }

      if (shouldConnect) {
        // With a clean state, connect to Phantom - this will open the popup
        console.log('Requesting new Phantom wallet connection');

        // We'll implement retry logic for the connection
        let retries = 0;
        const maxRetries = 3;
        let lastError = null;
        let response = null;

        while (retries < maxRetries && !response) {
          try {
            response = await provider.connect({ onlyIfTrusted: false });
            break;
          } catch (err) {
            lastError = err;
            retries++;
            console.warn(`Connection attempt ${retries} failed:`, err);

            // Wait longer between retries
            await new Promise(resolve => setTimeout(resolve, 1000 * retries));

            // If this is a user rejection, don't retry
            if (err.code === 4001) {
              throw err; // Rethrow user rejection
            }
          }
        }

        if (!response && lastError) {
          throw lastError;
        }

        const address = response.publicKey.toString();
        console.log('Successfully connected to Phantom wallet:', address);

        // Add this wallet to our connected wallets if it's not already there
        if (!this.connectedWallets.has(address)) {
          this.connectedWallets.set(address, new PhantomWalletProxy(address, provider));
        }

        this.currentActiveWallet = address;
        return address;
      } else {
        return currentWallet;
      }
    } catch (error) {
      console.error('Error connecting to Phantom wallet:', error);
      throw error;
    }
  }

  // Add connected wallets to the system
  addWallets(addresses) {
    for (const address of addresses) {
      if (!this.connectedWallets.has(address)) {
        this.connectedWallets.set(address, new PhantomWalletProxy(address, this.getPhantomProvider()));
      }
    }
    return this.getAllWallets();
  }

  // Queue a transaction for a specific wallet and execute it
  async queueTransaction(walletAddress, transactionFn) {
    if (!this.connectedWallets.has(walletAddress)) {
      throw new Error(`Wallet ${walletAddress} not found in connected wallets`);
    }

    // Create a promise that will be resolved when the transaction completes
    let resolveTransaction, rejectTransaction;
    const transactionPromise = new Promise((resolve, reject) => {
      resolveTransaction = resolve;
      rejectTransaction = reject;
    });

    // Track transaction start time for wallet session log
    const transactionId = Date.now().toString(36) + Math.random().toString(36).slice(2);
    
    // Log this wallet access request
    this.walletSessionLog.set(transactionId, {
      wallet: walletAddress,
      startTime: Date.now(),
      status: 'queued',
      type: 'transaction'
    });

    // Add the transaction to the queue
    this.transactionQueue.push({
      walletAddress,
      transactionId,
      execute: async () => {
        try {
          // Update wallet session log
          const sessionEntry = this.walletSessionLog.get(transactionId);
          if (sessionEntry) {
            sessionEntry.status = 'executing';
            sessionEntry.executeStartTime = Date.now();
          }
          
          // Process with retry logic
          let attempts = 0;
          const maxAttempts = 3;
          let lastError = null;
          
          while (attempts < maxAttempts) {
            try {
              const wallet = this.connectedWallets.get(walletAddress);
              
              if (!wallet) {
                throw new Error(`Wallet ${walletAddress} disappeared during transaction processing`);
              }
              
              // Make sure this wallet is active
              await this.ensureWalletIsActive(wallet, transactionId);
              
              // Execute the transaction
              const result = await transactionFn(wallet);
              
              // Update session log with success
              if (sessionEntry) {
                sessionEntry.status = 'completed';
                sessionEntry.completionTime = Date.now();
                sessionEntry.duration = sessionEntry.completionTime - sessionEntry.startTime;
              }
              
              resolveTransaction(result);
              return;
            } catch (error) {
              lastError = error;
              console.warn(`Transaction attempt ${attempts + 1} failed:`, error);
              
              // Update session log
              if (sessionEntry) {
                sessionEntry.status = `attempt_failed_${attempts + 1}`;
                sessionEntry.lastError = error.message;
              }
              
              attempts++;
              
              if (attempts < maxAttempts) {
                // Exponential backoff between retries
                const backoffTime = 500 * Math.pow(2, attempts - 1);
                await new Promise(resolve => setTimeout(resolve, backoffTime));
              }
            }
          }
          
          // All attempts failed
          if (sessionEntry) {
            sessionEntry.status = 'failed';
            sessionEntry.completionTime = Date.now();
            sessionEntry.duration = sessionEntry.completionTime - sessionEntry.startTime;
          }
          
          rejectTransaction(lastError || new Error('Transaction failed after multiple attempts'));
        } catch (error) {
          // Update session log with failure
          const sessionEntry = this.walletSessionLog.get(transactionId);
          if (sessionEntry) {
            sessionEntry.status = 'failed';
            sessionEntry.completionTime = Date.now();
            sessionEntry.duration = sessionEntry.completionTime - sessionEntry.startTime;
            sessionEntry.error = error.message;
          }
          
          rejectTransaction(error);
        }
      }
    });

    // Start processing the queue if not already processing
    if (!this.isProcessingQueue) {
      this.processTransactionQueue();
    }

    return transactionPromise;
  }
  
  // Ensure wallet is active with better error handling and logging
  async ensureWalletIsActive(wallet, transactionId) {
    try {
      // Check if wallet is already active
      const isCurrentlyActive = await wallet.isCurrentlyActive();
      
      if (isCurrentlyActive) {
        console.log(`Wallet ${wallet.address} is already active`);
        // Track in session log
        const sessionEntry = this.walletSessionLog.get(transactionId);
        if (sessionEntry) {
          sessionEntry.activationRequired = false;
        }
        return true;
      }
      
      console.log(`Need to switch to wallet ${wallet.address}`);
      
      // Track in session log
      const sessionEntry = this.walletSessionLog.get(transactionId);
      if (sessionEntry) {
        sessionEntry.activationRequired = true;
        sessionEntry.activationAttemptTime = Date.now();
      }
      
      // Throttle reconnection attempts (no more than once every 2 seconds)
      const now = Date.now();
      if (now - this.lastReconnectAttempt < 2000) {
        await new Promise(resolve => setTimeout(resolve, 2000 - (now - this.lastReconnectAttempt)));
      }
      this.lastReconnectAttempt = Date.now();
      
      // Attempt to make wallet active
      const activationSuccess = await wallet.makeActive();
      
      // Update session log
      if (sessionEntry) {
        sessionEntry.activationSuccess = activationSuccess;
        sessionEntry.activationCompletionTime = Date.now();
      }
      
      return activationSuccess;
    } catch (error) {
      console.error(`Error ensuring wallet ${wallet.address} is active:`, error);
      // Update session log with error
      const sessionEntry = this.walletSessionLog.get(transactionId);
      if (sessionEntry) {
        sessionEntry.activationError = error.message;
      }
      return false;
    }
  }

  // Process transactions in the queue with intelligent scheduling
  async processTransactionQueue() {
    if (this.isProcessingQueue || this.transactionQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      // Strategy: Group transactions by wallet to minimize switching
      const walletGroups = new Map();
      
      // Sort transactions into groups by wallet address
      for (const transaction of this.transactionQueue) {
        if (!walletGroups.has(transaction.walletAddress)) {
          walletGroups.set(transaction.walletAddress, []);
        }
        walletGroups.get(transaction.walletAddress).push(transaction);
      }
      
      // Empty the queue since we've copied all transactions
      this.transactionQueue = [];
      
      // Process each wallet group in sequence
      for (const [walletAddress, transactions] of walletGroups) {
        // First transaction in the group will trigger wallet switching
        const firstTransaction = transactions.shift();
        await firstTransaction.execute();
        
        // Process remaining transactions for this wallet 
        // These should be much faster since wallet is already active
        for (const transaction of transactions) {
          await transaction.execute();
        }
        
        // Add a small delay between wallet groups to allow for UI updates
        if (walletGroups.size > 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    } catch (error) {
      console.error('Error processing transaction queue:', error);
    } finally {
      this.isProcessingQueue = false;
      
      // Check if more transactions were added while we were processing
      if (this.transactionQueue.length > 0) {
        // Process the new transactions
        setTimeout(() => this.processTransactionQueue(), 100);
      }
    }
  }
  
  // Get the current transaction queue stats
  getQueueStats() {
    return {
      isProcessing: this.isProcessingQueue,
      queueLength: this.transactionQueue.length,
      queuedWallets: [...new Set(this.transactionQueue.map(tx => tx.walletAddress))],
      sessionLogSize: this.walletSessionLog.size
    };
  }

  // Clean up when no longer needed
  cleanup() {
    try {
      // Remove event listeners
      if (this.accountChangeListener) {
        const provider = this.getPhantomProvider();
        provider.off('accountChanged', this.accountChangeListener);
        this.accountChangeListener = null;
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
  
  // Discover all available wallets in the Phantom extension
  async discoverAllWallets() {
    // For Phantom, we need a more robust approach that works with their limitations
    
    // Get the current wallet first
    const provider = this.getPhantomProvider();
    if (!provider.isConnected || !provider.publicKey) {
      // Connect first if not already connected
      try {
        await provider.connect({ onlyIfTrusted: false });
      } catch (error) {
        console.error("Failed to connect to any wallet:", error);
        return [];
      }
    }
    
    // Start with the currently active wallet
    const currentAddress = provider.publicKey?.toString();
    const discoveredWallets = new Set();
    
    if (currentAddress) {
      console.log("Initial connected wallet:", currentAddress);
      discoveredWallets.add(currentAddress);
      
      // Add to our connection registry if not already there
      if (!this.connectedWallets.has(currentAddress)) {
        this.connectedWallets.set(currentAddress, new PhantomWalletProxy(currentAddress, provider));
      }
      
      // Save to persistent storage
      this._saveWalletToLocalRegistry(currentAddress);
    }
    
    // Check localStorage for previously discovered wallets
    try {
      const storedWallets = JSON.parse(localStorage.getItem('phantomDiscoveredWallets') || '[]');
      for (const address of storedWallets) {
        if (!discoveredWallets.has(address)) {
          discoveredWallets.add(address);
          console.log("Added previously discovered wallet:", address);
        }
      }
    } catch (e) {
      console.error("Error loading stored wallet data:", e);
    }
    
    // Save the complete list back to localStorage
    localStorage.setItem('phantomDiscoveredWallets', JSON.stringify([...discoveredWallets]));
    
    return [...discoveredWallets];
  }
  
  // Helper method to save a wallet to local registry
  _saveWalletToLocalRegistry(address) {
    if (!address) return;
    
    try {
      // Load existing registry
      const storedWallets = JSON.parse(localStorage.getItem('phantomDiscoveredWallets') || '[]');
      
      // Add this wallet if not already present
      if (!storedWallets.includes(address)) {
        storedWallets.push(address);
        localStorage.setItem('phantomDiscoveredWallets', JSON.stringify(storedWallets));
        
        // Also save connection state
        const walletState = JSON.parse(localStorage.getItem('phantomWalletState') || '{}');
        walletState[address] = {
          lastConnected: Date.now(),
          connected: true
        };
        localStorage.setItem('phantomWalletState', JSON.stringify(walletState));
      }
    } catch (e) {
      console.error("Error saving wallet to registry:", e);
    }
  }
}

// Helper to get the Phantom provider safely
function getPhantomProvider() {
  if (typeof window === 'undefined') {
    throw new Error('Cannot access Phantom provider: window is undefined');
  }

  const provider = window.phantom?.solana || window.solana;

  if (!provider) {
    throw new Error('Phantom provider not found');
  }

  return provider;
}

// Check if Phantom is installed
function isPhantomInstalled() {
  if (typeof window === 'undefined') return false;
  return window.phantom?.solana || (window.solana && window.solana.isPhantom);
}

// Get the currently active Phantom wallet address with improved error handling
async function getActivePhantomAddress() {
  try {
    const provider = getPhantomProvider();

    // Check if connected
    if (!provider.isConnected) {
      return null;
    }

    // Already connected, just get the public key
    return provider.publicKey?.toString() || null;
  } catch (error) {
    console.error('Error getting active Phantom address:', error);
    return null;
  }
}

// Get active Phantom address with retry logic
async function getActivePhantomAddressWithRetry(maxRetries = 3, initialDelay = 500) {
  let retries = 0;
  let lastError = null;

  while (retries < maxRetries) {
    try {
      const address = await getActivePhantomAddress();
      if (address) return address;

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, initialDelay * Math.pow(2, retries)));
      retries++;
    } catch (error) {
      lastError = error;
      console.warn(`Retry ${retries}/${maxRetries} failed:`, error);
      await new Promise(resolve => setTimeout(resolve, initialDelay * Math.pow(2, retries)));
      retries++;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return null;
}

// Request the user to switch to a specific Phantom wallet via the UI
// Uses a combination of cached connection state and connection manager approach
async function requestPhantomWalletSwitch(targetAddress) {
  try {
    const provider = getPhantomProvider();
    const currentAddress = provider.publicKey?.toString();

    if (currentAddress === targetAddress) {
      return true; // Already on the correct wallet
    }

    // Enhanced approach: Store wallet state in LocalStorage to maintain connection state
    const walletState = JSON.parse(localStorage.getItem('phantomWalletState') || '{}');
    
    // Check if we've previously connected to this wallet
    if (walletState[targetAddress]) {
      console.log(`Using cached connection state for wallet ${targetAddress}`);
      
      try {
        // Temporary disconnect to reset state
        await provider.disconnect();
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Try to reconnect with the wallet's identifier (works for some wallet implementations)
        await provider.connect({
          onlyIfTrusted: false
        });
        
        // Check if we got the target address
        const newAddress = provider.publicKey?.toString();
        if (newAddress === targetAddress) {
          console.log(`Successfully switched to wallet ${targetAddress}`);
          return true;
        }
      } catch (err) {
        console.log(`Cached connection attempt failed: ${err.message}`);
        // Fall through to manual method
      }
    }

    // Display guidance to the user
    console.log(`Please manually switch to wallet ${targetAddress} in your Phantom extension.`);
    
    // Add the wallet message indicator to localStorage 
    localStorage.setItem('phantomTargetWallet', targetAddress);
    
    // Monitor for switch
    const startTime = Date.now();
    const timeout = 10000; // 10 seconds to switch

    while (Date.now() - startTime < timeout) {
      const address = await getActivePhantomAddress();
      
      if (address === targetAddress) {
        // Save this successful connection in our state cache
        walletState[targetAddress] = {
          lastConnected: Date.now(),
          connected: true
        };
        localStorage.setItem('phantomWalletState', JSON.stringify(walletState));
        
        return true;
      }

      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    // If we get here, the user did not switch in time
    return false;
  } catch (error) {
    console.error('Error requesting wallet switch:', error);
    return false;
  }
}

// Import utility functions from existing walletHelpers
// These are needed by the PhantomMultiWallet class
import { getStoredWalletData, saveWalletData } from './walletHelpers';

// Export the main class and utilities
export default PhantomMultiWallet;
export {
  PhantomWalletProxy,
  isPhantomInstalled,
  getPhantomProvider,
  getActivePhantomAddress,
  requestPhantomWalletSwitch,
  getActivePhantomAddressWithRetry
}; 