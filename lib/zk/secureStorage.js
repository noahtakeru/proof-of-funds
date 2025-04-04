/**
 * Secure Storage for Zero-Knowledge Proof System
 * 
 * This module provides secure storage mechanisms for sensitive data using browser
 * storage with proper encryption, automatic expiration, and secure cleanup.
 */

import secureKeyManager from './SecureKeyManager';

// Utility for generating unique IDs
const generateUniqueId = () => {
  const timestampPart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `${timestampPart}-${randomPart}`;
};

/**
 * Storage prefixes by category
 */
const STORAGE_PREFIXES = {
  TEMP_WALLET: 'temp-wallet-',
  CIRCUIT_INPUT: 'zk-input-',
  PROOF_DATA: 'zk-proof-',
  SESSION_DATA: 'zk-session-'
};

/**
 * Default expiration times in milliseconds
 */
const DEFAULT_EXPIRATION = {
  TEMP_WALLET: 30 * 60 * 1000, // 30 minutes
  CIRCUIT_INPUT: 15 * 60 * 1000, // 15 minutes
  PROOF_DATA: 60 * 60 * 1000, // 1 hour
  SESSION_DATA: 24 * 60 * 60 * 1000 // 24 hours
};

/**
 * SecureStorage class for managing encrypted data in browser storage
 */
class SecureStorage {
  constructor() {
    this.storage = typeof window !== 'undefined' ? window.sessionStorage : null;
    this.secureKeyManager = secureKeyManager;
    this.cleanupIntervalId = null;
    
    // Initialize cleanup mechanism
    if (typeof window !== 'undefined') {
      this.initCleanupRoutine();
    }
  }

  /**
   * Initialize cleanup routine for expired items
   */
  initCleanupRoutine() {
    // Clean up expired items every minute
    if (!this.cleanupIntervalId) {
      this.cleanupIntervalId = setInterval(() => {
        this.cleanupExpiredItems();
      }, 60 * 1000);
      
      // Also run cleanup immediately
      this.cleanupExpiredItems();
      
      // Add event listener for page unload to clean up sensitive data
      window.addEventListener('beforeunload', () => {
        this.cleanupAllSensitiveData();
        clearInterval(this.cleanupIntervalId);
      });
    }
  }

  /**
   * Store encrypted wallet data in secure storage
   * @param {Object} walletData - Wallet data to store
   * @param {string} password - Password for encryption
   * @param {number} [expiresIn] - Expiration time in ms, defaults to 30 minutes
   * @returns {Promise<string>} Unique ID for the stored wallet
   */
  async storeWallet(walletData, password, expiresIn = DEFAULT_EXPIRATION.TEMP_WALLET) {
    if (!this.storage) {
      throw new Error('Secure storage is not available in this environment');
    }
    
    try {
      const walletId = generateUniqueId();
      
      // Encrypt private key separately with enhanced security
      const encryptedPrivateKey = await this.secureKeyManager.encryptPrivateKey(
        walletData.privateKey, 
        password
      );
      
      // Create storage object without private key
      const storageObject = {
        id: walletId,
        address: walletData.address,
        encryptedPrivateKey,
        expiresAt: Date.now() + expiresIn,
        created: Date.now(),
        type: 'wallet'
      };
      
      // Store in session storage
      this.storage.setItem(
        `${STORAGE_PREFIXES.TEMP_WALLET}${walletId}`,
        JSON.stringify(storageObject)
      );
      
      return walletId;
    } catch (error) {
      throw new Error(`Failed to store wallet: ${error.message}`);
    }
  }

  /**
   * Retrieve a stored wallet
   * @param {string} walletId - ID of the wallet to retrieve
   * @param {string} password - Password for decryption
   * @returns {Promise<Object>} Decrypted wallet data
   */
  async getWallet(walletId, password) {
    if (!this.storage) {
      throw new Error('Secure storage is not available in this environment');
    }
    
    try {
      // Retrieve encrypted wallet data
      const storedData = this.storage.getItem(`${STORAGE_PREFIXES.TEMP_WALLET}${walletId}`);
      if (!storedData) {
        throw new Error('Wallet not found or expired');
      }
      
      const walletData = JSON.parse(storedData);
      
      // Check expiration
      if (Date.now() > walletData.expiresAt) {
        this.removeItem(`${STORAGE_PREFIXES.TEMP_WALLET}${walletId}`);
        throw new Error('Wallet has expired');
      }
      
      // Decrypt private key
      const privateKey = await this.secureKeyManager.decryptPrivateKey(
        walletData.encryptedPrivateKey,
        password
      );
      
      // Return wallet with decrypted private key
      return {
        id: walletData.id,
        address: walletData.address,
        privateKey,
        created: walletData.created,
        expiresAt: walletData.expiresAt
      };
    } catch (error) {
      throw new Error(`Failed to retrieve wallet: ${error.message}`);
    }
  }

  /**
   * Store encrypted circuit input data
   * @param {Object} inputData - Circuit input data to store
   * @param {string} password - Password for encryption
   * @param {number} [expiresIn] - Expiration time in ms
   * @returns {Promise<string>} Unique ID for the stored data
   */
  async storeCircuitInput(inputData, password, expiresIn = DEFAULT_EXPIRATION.CIRCUIT_INPUT) {
    if (!this.storage) {
      throw new Error('Secure storage is not available in this environment');
    }
    
    try {
      const inputId = generateUniqueId();
      
      // Encrypt the entire input data
      const encryptedData = await this.secureKeyManager.encrypt(inputData, password);
      
      // Create storage object
      const storageObject = {
        id: inputId,
        encryptedData,
        expiresAt: Date.now() + expiresIn,
        created: Date.now(),
        type: 'circuit-input'
      };
      
      // Store in session storage
      this.storage.setItem(
        `${STORAGE_PREFIXES.CIRCUIT_INPUT}${inputId}`,
        JSON.stringify(storageObject)
      );
      
      return inputId;
    } catch (error) {
      throw new Error(`Failed to store circuit input: ${error.message}`);
    }
  }

  /**
   * Retrieve stored circuit input data
   * @param {string} inputId - ID of the circuit input to retrieve
   * @param {string} password - Password for decryption
   * @returns {Promise<Object>} Decrypted circuit input data
   */
  async getCircuitInput(inputId, password) {
    if (!this.storage) {
      throw new Error('Secure storage is not available in this environment');
    }
    
    try {
      // Retrieve encrypted input data
      const storedData = this.storage.getItem(`${STORAGE_PREFIXES.CIRCUIT_INPUT}${inputId}`);
      if (!storedData) {
        throw new Error('Circuit input not found or expired');
      }
      
      const inputData = JSON.parse(storedData);
      
      // Check expiration
      if (Date.now() > inputData.expiresAt) {
        this.removeItem(`${STORAGE_PREFIXES.CIRCUIT_INPUT}${inputId}`);
        throw new Error('Circuit input has expired');
      }
      
      // Decrypt data
      const decryptedData = await this.secureKeyManager.decrypt(
        inputData.encryptedData,
        password
      );
      
      return decryptedData;
    } catch (error) {
      throw new Error(`Failed to retrieve circuit input: ${error.message}`);
    }
  }

  /**
   * Store session data with encryption
   * @param {string} key - Session data key
   * @param {any} data - Data to store
   * @param {string} password - Password for encryption
   * @param {number} [expiresIn] - Expiration time in ms
   * @returns {Promise<void>}
   */
  async storeSessionData(key, data, password, expiresIn = DEFAULT_EXPIRATION.SESSION_DATA) {
    if (!this.storage) {
      throw new Error('Secure storage is not available in this environment');
    }
    
    try {
      // Encrypt the data
      const encryptedData = await this.secureKeyManager.encrypt(data, password);
      
      // Create storage object
      const storageObject = {
        key,
        encryptedData,
        expiresAt: Date.now() + expiresIn,
        created: Date.now(),
        type: 'session-data'
      };
      
      // Store in session storage
      this.storage.setItem(
        `${STORAGE_PREFIXES.SESSION_DATA}${key}`,
        JSON.stringify(storageObject)
      );
    } catch (error) {
      throw new Error(`Failed to store session data: ${error.message}`);
    }
  }

  /**
   * Retrieve session data
   * @param {string} key - Session data key
   * @param {string} password - Password for decryption
   * @returns {Promise<any>} Decrypted session data
   */
  async getSessionData(key, password) {
    if (!this.storage) {
      throw new Error('Secure storage is not available in this environment');
    }
    
    try {
      // Retrieve encrypted session data
      const storedData = this.storage.getItem(`${STORAGE_PREFIXES.SESSION_DATA}${key}`);
      if (!storedData) {
        throw new Error('Session data not found or expired');
      }
      
      const sessionData = JSON.parse(storedData);
      
      // Check expiration
      if (Date.now() > sessionData.expiresAt) {
        this.removeItem(`${STORAGE_PREFIXES.SESSION_DATA}${key}`);
        throw new Error('Session data has expired');
      }
      
      // Decrypt data
      const decryptedData = await this.secureKeyManager.decrypt(
        sessionData.encryptedData,
        password
      );
      
      return decryptedData;
    } catch (error) {
      throw new Error(`Failed to retrieve session data: ${error.message}`);
    }
  }

  /**
   * Remove item from storage and wipe securely
   * @param {string} key - Key to remove
   */
  removeItem(key) {
    if (!this.storage) return;
    
    try {
      // Get the item first
      const item = this.storage.getItem(key);
      if (item) {
        // Parse it to get the structure
        const parsedItem = JSON.parse(item);
        
        // Wipe sensitive data
        if (parsedItem && typeof parsedItem === 'object') {
          this.secureKeyManager.secureWipe(parsedItem);
        }
        
        // Remove from storage
        this.storage.removeItem(key);
      }
    } catch (error) {
      console.error(`Error removing item ${key}:`, error);
    }
  }

  /**
   * Cleanup expired items from storage
   */
  cleanupExpiredItems() {
    if (!this.storage) return;
    
    try {
      const now = Date.now();
      
      // Iterate through storage
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        
        // Check if this is one of our items
        if (key.startsWith(STORAGE_PREFIXES.TEMP_WALLET) ||
            key.startsWith(STORAGE_PREFIXES.CIRCUIT_INPUT) ||
            key.startsWith(STORAGE_PREFIXES.PROOF_DATA) ||
            key.startsWith(STORAGE_PREFIXES.SESSION_DATA)) {
          
          try {
            // Get item and parse
            const item = JSON.parse(this.storage.getItem(key));
            
            // Check expiration
            if (item.expiresAt && item.expiresAt < now) {
              this.removeItem(key);
              // Adjust index since we removed an item
              i--;
            }
          } catch (e) {
            // If there's an error parsing, remove the item
            this.storage.removeItem(key);
            i--;
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up expired items:', error);
    }
  }

  /**
   * Clean up all sensitive data
   */
  cleanupAllSensitiveData() {
    if (!this.storage) return;
    
    try {
      const prefixes = Object.values(STORAGE_PREFIXES);
      
      // Collect keys to remove
      const keysToRemove = [];
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        
        // Check if this is one of our items
        if (prefixes.some(prefix => key.startsWith(prefix))) {
          keysToRemove.push(key);
        }
      }
      
      // Remove collected keys
      keysToRemove.forEach(key => {
        this.removeItem(key);
      });
    } catch (error) {
      console.error('Error cleaning up all sensitive data:', error);
    }
  }
}

// Export as singleton
const secureStorage = new SecureStorage();
export default secureStorage;