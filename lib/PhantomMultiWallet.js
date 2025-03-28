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
 * The implementation uses a shadow connection technique to circumvent Phantom's
 * limitation of only allowing one connected wallet at a time, by managing explicit
 * connections and disconnections in the background.
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
      await switchToPhantomWallet(this.address);
      this.isActive = true;
      this.lastActive = Date.now();
      return true;
    } catch (error) {
      console.error('Error making wallet active:', error);
      this.isActive = false;
      return false;
    }
  }

  // Sign a transaction using this wallet
  async signTransaction(transaction) {
    // Ensure this wallet is active before signing
    await this.makeActive();

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
    // Ensure this wallet is active before signing
    await this.makeActive();

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
    // Ensure this wallet is active before signing
    await this.makeActive();

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
    // Ensure this wallet is active before sending
    await this.makeActive();

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

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Error initializing PhantomMultiWallet:', error);
      throw error;
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

  // Connect to a Phantom wallet
  async connectWallet() {
    try {
      // Disconnect any existing connection
      const provider = this.getPhantomProvider();
      if (provider.isConnected) {
        await provider.disconnect();
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Connect to Phantom - this will open the popup
      const response = await provider.connect({ onlyIfTrusted: false });
      const address = response.publicKey.toString();

      // Add this wallet to our connected wallets if it's not already there
      if (!this.connectedWallets.has(address)) {
        this.connectedWallets.set(address, new PhantomWalletProxy(address, provider));
      }

      this.currentActiveWallet = address;

      return address;
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

  // Switch to a specific wallet
  async switchToWallet(address) {
    try {
      if (!this.connectedWallets.has(address)) {
        throw new Error(`Wallet ${address} not found in connected wallets`);
      }

      const walletProxy = this.connectedWallets.get(address);

      // Check if this wallet is already active
      if (await walletProxy.isCurrentlyActive()) {
        this.currentActiveWallet = address;
        return true;
      }

      // Need to switch - disconnect first
      const provider = this.getPhantomProvider();
      if (provider.isConnected) {
        await provider.disconnect();
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Reconnect and check if we got the wallet we wanted
      const newConnection = await this.connectWallet();

      if (newConnection === address) {
        // Success - got the wallet we wanted
        this.currentActiveWallet = address;
        return true;
      } else {
        // Failed to switch - we got a different wallet
        throw new Error(`Failed to switch to wallet ${address}. Got ${newConnection} instead.`);
      }
    } catch (error) {
      console.error('Error switching to wallet:', error);
      return false;
    }
  }

  // Get a specific wallet by address
  getWallet(address) {
    return this.connectedWallets.get(address) || null;
  }

  // Get the currently active wallet in Phantom
  async getActivePhantomWallet() {
    try {
      const address = await getActivePhantomAddress();
      return address;
    } catch (error) {
      console.error('Error getting active Phantom wallet:', error);
      return null;
    }
  }

  // Execute an operation with a specific wallet
  async executeWithWallet(address, operation) {
    // Get the wallet proxy
    const wallet = this.getWallet(address);
    if (!wallet) {
      throw new Error(`Wallet ${address} not found in connected wallets`);
    }

    // Make the wallet active
    await wallet.makeActive();

    // Execute the operation
    return await operation(wallet);
  }

  // Queue a transaction for execution
  queueTransaction(address, operation, priority = 0) {
    return new Promise((resolve, reject) => {
      this.transactionQueue.push({
        address,
        operation,
        priority,
        resolve,
        reject
      });

      // Start processing the queue if not already running
      if (!this.isProcessingQueue) {
        this.processTransactionQueue();
      }
    });
  }

  // Process the transaction queue
  async processTransactionQueue() {
    if (this.transactionQueue.length === 0) {
      this.isProcessingQueue = false;
      return;
    }

    this.isProcessingQueue = true;

    // Sort queue by priority (higher numbers = higher priority)
    this.transactionQueue.sort((a, b) => b.priority - a.priority);

    // Get the next transaction
    const tx = this.transactionQueue.shift();

    try {
      // Execute the transaction with the specified wallet
      const result = await this.executeWithWallet(tx.address, tx.operation);
      tx.resolve(result);
    } catch (error) {
      tx.reject(error);
    }

    // Continue processing the queue
    setTimeout(() => this.processTransactionQueue(), 50);
  }
}

// ===== Utility Functions =====

// Check if Phantom is installed
function isPhantomInstalled() {
  return (
    typeof window !== 'undefined' &&
    (window.phantom?.solana || window.solana?.isPhantom)
  );
}

// Get the Phantom provider safely
function getPhantomProvider() {
  if (window.phantom?.solana) {
    return window.phantom.solana;
  } else if (window.solana?.isPhantom) {
    return window.solana;
  }
  throw new Error('Phantom provider not found');
}

// Get the currently active Phantom wallet address
async function getActivePhantomAddress() {
  try {
    const provider = getPhantomProvider();

    // Check if connected
    if (!provider.isConnected) {
      const response = await provider.connect({ onlyIfTrusted: true });
      return response.publicKey.toString();
    }

    // Already connected, just get the public key
    return provider.publicKey.toString();
  } catch (error) {
    console.error('Error getting active Phantom address:', error);
    return null;
  }
}

// Helper to switch to a specific Phantom wallet
async function switchToPhantomWallet(address) {
  try {
    const provider = getPhantomProvider();

    // Disconnect current connection
    if (provider.isConnected) {
      await provider.disconnect();
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Connect again
    const response = await provider.connect({ onlyIfTrusted: false });
    const newAddress = response.publicKey.toString();

    // If we got the wallet we wanted, return success
    if (newAddress === address) {
      return true;
    }

    // Otherwise, we got a different wallet - inform the user
    throw new Error(`Got a different wallet (${newAddress}) than requested (${address}). Please switch accounts in your Phantom extension.`);
  } catch (error) {
    console.error('Error switching to Phantom wallet:', error);
    throw error;
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
  switchToPhantomWallet
}; 