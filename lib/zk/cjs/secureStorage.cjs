/**
 * Secure Storage Module (CommonJS Version)
 * 
 * This module provides secure storage mechanisms for sensitive data using browser
 * storage with proper encryption, automatic expiration, and secure cleanup.
 * 
 * This is the CommonJS version of secureStorage.mjs, offering the same functionality
 * but with CommonJS module syntax.
 */

// Import secure key manager for cryptographic operations
const secureKeyManager = require('./SecureKeyManager.cjs');
const { 
  SecurityError, 
  InputError, 
  SystemError, 
  ErrorCode 
} = require('./zkErrorHandler.cjs');
const { zkErrorLogger } = require('./zkErrorLogger.cjs');

/**
 * Generates a unique identifier for stored items
 * @returns {string} A unique ID with timestamp and random components
 * @private
 */
const generateUniqueId = () => {
  const timestampPart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `${timestampPart}-${randomPart}`;
};

/**
 * Storage prefixes by category
 * @enum {string}
 */
const STORAGE_PREFIXES = {
  /** Temporary wallet storage prefix */
  TEMP_WALLET: 'temp-wallet-',
  /** Zero-knowledge circuit input data prefix */
  CIRCUIT_INPUT: 'zk-input-',
  /** Zero-knowledge proof data prefix */
  PROOF_DATA: 'zk-proof-',
  /** Session-related data prefix */
  SESSION_DATA: 'zk-session-'
};

/**
 * Default expiration times in milliseconds
 * @enum {number}
 */
const DEFAULT_EXPIRATION = {
  /** Temporary wallet expiration (30 minutes) */
  TEMP_WALLET: 30 * 60 * 1000,
  /** Circuit input data expiration (15 minutes) */
  CIRCUIT_INPUT: 15 * 60 * 1000,
  /** Proof data expiration (1 hour) */
  PROOF_DATA: 60 * 60 * 1000,
  /** Session data expiration (24 hours) */
  SESSION_DATA: 24 * 60 * 60 * 1000
};

/**
 * SecureStorage class for managing encrypted data in browser storage
 */
class SecureStorage {
  /**
   * Create a secure storage instance
   * @constructor
   */
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
   * @private
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
   * @throws {Error} If secure storage is unavailable or encryption fails
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
   * @throws {Error} If secure storage is unavailable, wallet not found, or decryption fails
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
   * @throws {Error} If secure storage is unavailable or encryption fails
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
   * @throws {Error} If secure storage is unavailable, data not found, or decryption fails
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
   * @throws {Error} If secure storage is unavailable or encryption fails
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
   * @throws {Error} If secure storage is unavailable, data not found, or decryption fails
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

  /**
   * Create a secure token from data for transferring between sessions
   * @param {Object} data - Data to tokenize
   * @returns {Promise<string>} Secure token
   * @throws {Error} If token creation fails
   */
  async createSecureToken(data) {
    try {
      // This is a placeholder implementation
      // In a real implementation, this would use encryption with a derived key
      const serialized = JSON.stringify(data);
      const encoded = Buffer.from(serialized).toString('base64');
      return encoded;
    } catch (error) {
      throw new Error(`Failed to create secure token: ${error.message}`);
    }
  }

  /**
   * Parse a secure token back into data
   * @param {string} token - Secure token to parse
   * @returns {Promise<Object>} Parsed data
   * @throws {Error} If token parsing fails
   */
  async parseSecureToken(token) {
    try {
      // This is a placeholder implementation
      // In a real implementation, this would use decryption with a derived key
      const decoded = Buffer.from(token, 'base64').toString('utf8');
      return JSON.parse(decoded);
    } catch (error) {
      throw new Error(`Failed to parse secure token: ${error.message}`);
    }
  }

  /**
   * Get all storage keys matching our prefixes
   * @returns {Promise<string[]>} Array of matching keys
   */
  async getAllKeys() {
    if (!this.storage) return [];

    try {
      const keys = [];
      const prefixes = Object.values(STORAGE_PREFIXES);

      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (prefixes.some(prefix => key.startsWith(prefix))) {
          keys.push(key);
        }
      }

      return keys;
    } catch (error) {
      console.error('Error getting all keys:', error);
      return [];
    }
  }

  /**
   * Store an item with optional compression and encryption
   * @param {string} key - Storage key
   * @param {any} value - Value to store
   * @param {Object} [options] - Storage options
   * @param {boolean} [options.compress] - Whether to compress the data
   * @param {boolean} [options.encrypt] - Whether to encrypt the data
   * @returns {Promise<boolean>} Success indicator
   */
  async setItem(key, value, options = {}) {
    if (!this.storage) return false;

    try {
      // Serialization
      const serialized = JSON.stringify(value);
      
      // Here we would add compression if options.compress is true
      // and encryption if options.encrypt is true
      // This is simplified for now
      
      this.storage.setItem(key, serialized);
      return true;
    } catch (error) {
      console.error(`Error setting item ${key}:`, error);
      return false;
    }
  }

  /**
   * Retrieve an item with optional decompression and decryption
   * @param {string} key - Storage key
   * @param {Object} [options] - Retrieval options
   * @param {boolean} [options.decompress] - Whether to decompress the data
   * @param {boolean} [options.decrypt] - Whether to decrypt the data
   * @returns {Promise<any>} Retrieved value or null if not found
   */
  async getItem(key, options = {}) {
    if (!this.storage) return null;

    try {
      const serialized = this.storage.getItem(key);
      if (!serialized) return null;
      
      // Here we would add decompression if options.decompress is true
      // and decryption if options.decrypt is true
      // This is simplified for now
      
      return JSON.parse(serialized);
    } catch (error) {
      console.error(`Error getting item ${key}:`, error);
      return null;
    }
  }
}

// Create singleton instance
const secureStorage = new SecureStorage();

// Export for CommonJS
module.exports = { 
  secureStorage,
  STORAGE_PREFIXES,
  DEFAULT_EXPIRATION
};