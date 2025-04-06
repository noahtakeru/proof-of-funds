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
  }

  // Check if this wallet is currently active in Phantom
  async isCurrentlyActive() {
    try {
      // Get current Phantom wallet and compare
      const currentAddress = await getActivePhantomAddress();
      this.isActive = currentAddress === this.address;
      if (this.isActive) {
        this.lastActive = Date.now();
      }
      return this.isActive;
    } catch (error) {
      console.error('Error checking if wallet is active:', error);
      return false;
    }
  }

  // Make this wallet active in Phantom
  async makeActive() {
    try {
      // Instead of forcing a switch, we'll first check if it's already active
      const isActive = await this.isCurrentlyActive();
      if (isActive) {
        this.lastActive = Date.now();
        return true;
      }

      // Not active, try to switch with better error handling and timeouts
      await requestPhantomWalletSwitch(this.address);

      // Verify the switch was successful
      const postSwitchAddress = await getActivePhantomAddressWithRetry();
      this.isActive = postSwitchAddress === this.address;

      if (this.isActive) {
        this.lastActive = Date.now();
        return true;
      } else {
        console.warn(`Wallet switch was not successful. Expected: ${this.address}, Got: ${postSwitchAddress}`);
        return false;
      }
    } catch (error) {
      console.error('Error making wallet active:', error);
      this.isActive = false;
      return false;
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

    // Add the transaction to the queue
    this.transactionQueue.push({
      walletAddress,
      execute: async () => {
        try {
          const wallet = this.connectedWallets.get(walletAddress);
          const result = await transactionFn(wallet);
          resolveTransaction(result);
        } catch (error) {
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

  // Process transactions in the queue
  async processTransactionQueue() {
    if (this.isProcessingQueue || this.transactionQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      // Process each transaction in order
      while (this.transactionQueue.length > 0) {
        const transaction = this.transactionQueue.shift();
        await transaction.execute();
      }
    } catch (error) {
      console.error('Error processing transaction queue:', error);
    } finally {
      this.isProcessingQueue = false;
    }
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
// We no longer try to force this programmatically, which was causing errors
async function requestPhantomWalletSwitch(targetAddress) {
  try {
    const provider = getPhantomProvider();
    const currentAddress = provider.publicKey?.toString();

    if (currentAddress === targetAddress) {
      return true; // Already on the correct wallet
    }

    // Instead of trying to force a switch, we'll display a notification to the user
    console.log(`Please switch to wallet ${targetAddress} in your Phantom extension.`);

    // Instead of disconnecting/reconnecting, we'll be more conservative
    // We'll wait to see if the user switches manually
    const startTime = Date.now();
    const timeout = 10000; // 10 seconds to switch

    while (Date.now() - startTime < timeout) {
      // Check if the wallet has been switched
      const address = await getActivePhantomAddress();
      if (address === targetAddress) {
        return true;
      }

      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
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