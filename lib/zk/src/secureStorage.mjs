/**
 * Secure Storage for Zero-Knowledge Proof System
 * 
 * This module provides secure storage mechanisms for sensitive data using browser
 * storage with proper encryption, automatic expiration, and secure cleanup.
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This module acts as a secure digital vault for sensitive information. Think of it like:
 * 
 * 1. SECURE SAFE DEPOSIT BOX: Stores sensitive financial information with proper
 *    encryption, similar to how a bank vault keeps valuables protected with multiple
 *    security measures.
 * 
 * 2. SELF-DESTRUCTING MESSAGES: Automatically removes sensitive data after a set time,
 *    like how some messaging apps delete messages after they've been read or a time period.
 * 
 * 3. DIGITAL SHREDDER: Thoroughly erases sensitive information when it's no longer needed,
 *    similar to how paper shredders destroy sensitive documents to prevent information theft.
 * 
 * 4. COMPARTMENTALIZED SECURITY: Organizes different types of data with appropriate
 *    security levels, like how a safe might have different sections for different valuables.
 * 
 * Business value: Protects users' sensitive financial information from unauthorized access,
 * prevents data leaks that could compromise privacy, enhances compliance with data
 * protection regulations, and builds user trust by demonstrating commitment to security.
 * 
 * @module secureStorage
 */

// Import secure key manager for cryptographic operations
import secureKeyManager from './SecureKeyManager.js';
import {
  SecurityError,
  InputError,
  SystemError,
  ErrorCode,
  getErrorLogger
} from './zkErrorHandler.mjs';

// Create a minimal logger function in case the real one isn't available
let zkErrorLogger;
try {
  // Try to get the real logger
  zkErrorLogger = getErrorLogger();
} catch (err) {
  // Create a simple console-based logger as fallback
  console.warn('Using fallback error logger in secureStorage:', err.message);
  zkErrorLogger = {
    logError: (error, context = {}) => {
      console.error('[Fallback Error Logger]', error.message || 'Unknown error', {
        error,
        context
      });
      return { operationId: `fallback_${Date.now()}` };
    },
    debug: (...args) => console.debug('[Fallback]', ...args),
    info: (...args) => console.info('[Fallback]', ...args),
    warn: (...args) => console.warn('[Fallback]', ...args),
    error: (...args) => console.error('[Fallback]', ...args),
    critical: (...args) => console.error('[CRITICAL Fallback]', ...args)
  };
}

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
export const STORAGE_PREFIXES = {
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
export const DEFAULT_EXPIRATION = {
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
   * @throws {SecurityError} If secure storage is unavailable or encryption fails
   * @throws {InputError} If wallet data is invalid
   */
  async storeWallet(walletData, password, expiresIn = DEFAULT_EXPIRATION.TEMP_WALLET) {
    const operationId = `storeWallet_${Date.now()}`;
    
    try {
      if (!this.storage) {
        throw new SystemError('Secure storage is not available in this environment', {
          code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
          operationId,
          recoverable: false,
          securityCritical: true
        });
      }
      
      // Validate inputs
      if (!walletData || typeof walletData !== 'object') {
        throw new InputError('Wallet data must be a valid object', {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId,
          recoverable: false,
          userFixable: true,
          details: { providedType: typeof walletData }
        });
      }
      
      if (!walletData.privateKey) {
        throw new InputError('Wallet data must contain privateKey', {
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          operationId,
          recoverable: false,
          userFixable: true
        });
      }
      
      if (!password || typeof password !== 'string') {
        throw new InputError('Password must be a non-empty string', {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId, 
          recoverable: false,
          userFixable: true,
          details: { providedType: typeof password }
        });
      }

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
      
      zkErrorLogger.log('INFO', 'Wallet stored securely', {
        operationId,
        context: 'secureStorage.storeWallet',
        details: {
          walletId,
          expiresAt: new Date(storageObject.expiresAt).toISOString(),
          addressFragment: walletData.address ? `${walletData.address.substring(0, 6)}...` : 'undefined'
        }
      });
      
      return walletId;
    } catch (error) {
      // If it's already a ZKError, just add more context and rethrow
      if (error.code) {
        zkErrorLogger.logError(error, {
          context: 'secureStorage.storeWallet',
          operationId
        });
        throw error;
      }
      
      // Wrap other errors as SecurityError
      const securityError = new SecurityError(`Failed to store wallet: ${error.message}`, {
        code: ErrorCode.SECURITY_DATA_INTEGRITY,
        operationId,
        recoverable: false,
        securityCritical: true,
        details: { originalError: error.message }
      });
      
      zkErrorLogger.logError(securityError, {
        context: 'secureStorage.storeWallet'
      });
      
      throw securityError;
    }
  }

  /**
   * Retrieve a stored wallet
   * @param {string} walletId - ID of the wallet to retrieve
   * @param {string} password - Password for decryption
   * @returns {Promise<Object>} Decrypted wallet data
   * @throws {SecurityError} If secure storage is unavailable or decryption fails
   * @throws {InputError} If parameters are invalid
   */
  async getWallet(walletId, password) {
    const operationId = `getWallet_${Date.now()}`;
    
    try {
      if (!this.storage) {
        throw new SystemError('Secure storage is not available in this environment', {
          code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
          operationId,
          recoverable: false,
          securityCritical: true
        });
      }
      
      // Validate inputs
      if (!walletId || typeof walletId !== 'string') {
        throw new InputError('Wallet ID must be a non-empty string', {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId,
          recoverable: false,
          userFixable: true,
          details: { providedType: typeof walletId }
        });
      }
      
      if (!password || typeof password !== 'string') {
        throw new InputError('Password must be a non-empty string', {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId,
          recoverable: false,
          userFixable: true,
          details: { providedType: typeof password }
        });
      }

      // Retrieve encrypted wallet data
      const storedData = this.storage.getItem(`${STORAGE_PREFIXES.TEMP_WALLET}${walletId}`);
      if (!storedData) {
        throw new SecurityError('Wallet not found or expired', {
          code: ErrorCode.SECURITY_DATA_INTEGRITY,
          operationId,
          recoverable: false,
          userFixable: true,
          recommendedAction: 'The wallet may have expired. Please create a new wallet.'
        });
      }

      let walletData;
      try {
        walletData = JSON.parse(storedData);
      } catch (parseError) {
        throw new SecurityError('Wallet data is corrupted', {
          code: ErrorCode.SECURITY_DATA_INTEGRITY,
          operationId,
          recoverable: false,
          details: { originalError: parseError.message }
        });
      }

      // Check expiration
      if (Date.now() > walletData.expiresAt) {
        this.removeItem(`${STORAGE_PREFIXES.TEMP_WALLET}${walletId}`);
        throw new SecurityError('Wallet has expired', {
          code: ErrorCode.SECURITY_DATA_INTEGRITY,
          operationId,
          recoverable: false,
          userFixable: true,
          recommendedAction: 'Please create a new wallet or extend the expiration time.'
        });
      }

      // Decrypt private key
      const privateKey = await this.secureKeyManager.decryptPrivateKey(
        walletData.encryptedPrivateKey,
        password
      );

      // Return wallet with decrypted private key
      const result = {
        id: walletData.id,
        address: walletData.address,
        privateKey,
        created: walletData.created,
        expiresAt: walletData.expiresAt
      };
      
      zkErrorLogger.log('INFO', 'Wallet retrieved successfully', {
        operationId,
        context: 'secureStorage.getWallet',
        details: {
          walletId,
          addressFragment: walletData.address ? `${walletData.address.substring(0, 6)}...` : 'undefined',
          remainingTime: Math.round((walletData.expiresAt - Date.now()) / 60000) + ' minutes'
        }
      });
      
      return result;
    } catch (error) {
      // If it's already a ZKError, just add more context and rethrow
      if (error.code) {
        zkErrorLogger.logError(error, {
          context: 'secureStorage.getWallet',
          operationId
        });
        throw error;
      }
      
      // Wrap other errors as SecurityError
      const securityError = new SecurityError(`Failed to retrieve wallet: ${error.message}`, {
        code: ErrorCode.SECURITY_DATA_INTEGRITY,
        operationId,
        recoverable: false,
        securityCritical: true,
        details: { originalError: error.message }
      });
      
      zkErrorLogger.logError(securityError, {
        context: 'secureStorage.getWallet'
      });
      
      throw securityError;
    }
  }

  /**
   * Store encrypted circuit input data
   * @param {Object} inputData - Circuit input data to store
   * @param {string} password - Password for encryption
   * @param {number} [expiresIn] - Expiration time in ms
   * @returns {Promise<string>} Unique ID for the stored data
   * @throws {SecurityError} If secure storage is unavailable or encryption fails
   * @throws {InputError} If parameters are invalid
   */
  async storeCircuitInput(inputData, password, expiresIn = DEFAULT_EXPIRATION.CIRCUIT_INPUT) {
    const operationId = `storeCircuitInput_${Date.now()}`;
    
    try {
      if (!this.storage) {
        throw new SystemError('Secure storage is not available in this environment', {
          code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
          operationId,
          recoverable: false,
          securityCritical: true
        });
      }
      
      // Validate inputs
      if (!inputData || typeof inputData !== 'object') {
        throw new InputError('Input data must be a valid object', {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId,
          recoverable: false,
          userFixable: true,
          details: { providedType: typeof inputData }
        });
      }
      
      if (!password || typeof password !== 'string') {
        throw new InputError('Password must be a non-empty string', {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId,
          recoverable: false,
          userFixable: true,
          details: { providedType: typeof password }
        });
      }

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
      
      zkErrorLogger.log('INFO', 'Circuit input stored securely', {
        operationId,
        context: 'secureStorage.storeCircuitInput',
        details: {
          inputId,
          expiresAt: new Date(storageObject.expiresAt).toISOString(),
          dataSize: JSON.stringify(inputData).length
        }
      });
      
      return inputId;
    } catch (error) {
      // If it's already a ZKError, just add more context and rethrow
      if (error.code) {
        zkErrorLogger.logError(error, {
          context: 'secureStorage.storeCircuitInput',
          operationId
        });
        throw error;
      }
      
      // Wrap other errors as SecurityError
      const securityError = new SecurityError(`Failed to store circuit input: ${error.message}`, {
        code: ErrorCode.SECURITY_DATA_INTEGRITY,
        operationId,
        recoverable: false,
        securityCritical: true,
        details: { originalError: error.message }
      });
      
      zkErrorLogger.logError(securityError, {
        context: 'secureStorage.storeCircuitInput'
      });
      
      throw securityError;
    }
  }

  /**
   * Retrieve stored circuit input data
   * @param {string} inputId - ID of the circuit input to retrieve
   * @param {string} password - Password for decryption
   * @returns {Promise<Object>} Decrypted circuit input data
   * @throws {SecurityError} If secure storage is unavailable, data not found, or decryption fails
   * @throws {InputError} If parameters are invalid
   */
  async getCircuitInput(inputId, password) {
    const operationId = `getCircuitInput_${Date.now()}`;
    
    try {
      if (!this.storage) {
        throw new SystemError('Secure storage is not available in this environment', {
          code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
          operationId,
          recoverable: false,
          securityCritical: true
        });
      }
      
      // Validate inputs
      if (!inputId || typeof inputId !== 'string') {
        throw new InputError('Input ID must be a non-empty string', {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId,
          recoverable: false,
          userFixable: true,
          details: { providedType: typeof inputId }
        });
      }
      
      if (!password || typeof password !== 'string') {
        throw new InputError('Password must be a non-empty string', {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId,
          recoverable: false,
          userFixable: true,
          details: { providedType: typeof password }
        });
      }

      // Retrieve encrypted input data
      const storedData = this.storage.getItem(`${STORAGE_PREFIXES.CIRCUIT_INPUT}${inputId}`);
      if (!storedData) {
        throw new SecurityError('Circuit input not found or expired', {
          code: ErrorCode.SECURITY_DATA_INTEGRITY,
          operationId,
          recoverable: false,
          userFixable: true,
          recommendedAction: 'The circuit input may have expired. Please create a new input.'
        });
      }

      let inputData;
      try {
        inputData = JSON.parse(storedData);
      } catch (parseError) {
        throw new SecurityError('Circuit input data is corrupted', {
          code: ErrorCode.SECURITY_DATA_INTEGRITY,
          operationId,
          recoverable: false,
          details: { originalError: parseError.message }
        });
      }

      // Check expiration
      if (Date.now() > inputData.expiresAt) {
        this.removeItem(`${STORAGE_PREFIXES.CIRCUIT_INPUT}${inputId}`);
        throw new SecurityError('Circuit input has expired', {
          code: ErrorCode.SECURITY_DATA_INTEGRITY,
          operationId,
          recoverable: false,
          userFixable: true,
          recommendedAction: 'Please create a new circuit input or extend the expiration time.'
        });
      }

      // Decrypt data
      const decryptedData = await this.secureKeyManager.decrypt(
        inputData.encryptedData,
        password
      );
      
      zkErrorLogger.log('INFO', 'Circuit input retrieved successfully', {
        operationId,
        context: 'secureStorage.getCircuitInput',
        details: {
          inputId,
          remainingTime: Math.round((inputData.expiresAt - Date.now()) / 60000) + ' minutes'
        }
      });
      
      return decryptedData;
    } catch (error) {
      // If it's already a ZKError, just add more context and rethrow
      if (error.code) {
        zkErrorLogger.logError(error, {
          context: 'secureStorage.getCircuitInput',
          operationId
        });
        throw error;
      }
      
      // Wrap other errors as SecurityError
      const securityError = new SecurityError(`Failed to retrieve circuit input: ${error.message}`, {
        code: ErrorCode.SECURITY_DATA_INTEGRITY,
        operationId,
        recoverable: false,
        securityCritical: true,
        details: { originalError: error.message }
      });
      
      zkErrorLogger.logError(securityError, {
        context: 'secureStorage.getCircuitInput'
      });
      
      throw securityError;
    }
  }

  /**
   * Store session data with encryption
   * @param {string} key - Session data key
   * @param {any} data - Data to store
   * @param {string} password - Password for encryption
   * @param {number} [expiresIn] - Expiration time in ms
   * @returns {Promise<void>}
   * @throws {SecurityError} If secure storage is unavailable or encryption fails
   * @throws {InputError} If parameters are invalid
   */
  async storeSessionData(key, data, password, expiresIn = DEFAULT_EXPIRATION.SESSION_DATA) {
    const operationId = `storeSessionData_${Date.now()}`;
    
    try {
      if (!this.storage) {
        throw new SystemError('Secure storage is not available in this environment', {
          code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
          operationId,
          recoverable: false,
          securityCritical: true
        });
      }
      
      // Validate inputs
      if (!key || typeof key !== 'string') {
        throw new InputError('Key must be a non-empty string', {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId,
          recoverable: false,
          userFixable: true,
          details: { providedType: typeof key }
        });
      }
      
      if (data === undefined || data === null) {
        throw new InputError('Data must not be null or undefined', {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId,
          recoverable: false,
          userFixable: true,
          details: { providedType: data === null ? 'null' : 'undefined' }
        });
      }
      
      if (!password || typeof password !== 'string') {
        throw new InputError('Password must be a non-empty string', {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId,
          recoverable: false,
          userFixable: true,
          details: { providedType: typeof password }
        });
      }

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
      
      zkErrorLogger.log('INFO', 'Session data stored securely', {
        operationId,
        context: 'secureStorage.storeSessionData',
        details: {
          key,
          expiresAt: new Date(storageObject.expiresAt).toISOString(),
          dataType: typeof data,
          isArray: Array.isArray(data)
        }
      });
    } catch (error) {
      // If it's already a ZKError, just add more context and rethrow
      if (error.code) {
        zkErrorLogger.logError(error, {
          context: 'secureStorage.storeSessionData',
          operationId
        });
        throw error;
      }
      
      // Wrap other errors as SecurityError
      const securityError = new SecurityError(`Failed to store session data: ${error.message}`, {
        code: ErrorCode.SECURITY_DATA_INTEGRITY,
        operationId,
        recoverable: false,
        securityCritical: true,
        details: { originalError: error.message }
      });
      
      zkErrorLogger.logError(securityError, {
        context: 'secureStorage.storeSessionData'
      });
      
      throw securityError;
    }
  }

  /**
   * Retrieve session data
   * @param {string} key - Session data key
   * @param {string} password - Password for decryption
   * @returns {Promise<any>} Decrypted session data
   * @throws {SecurityError} If secure storage is unavailable, data not found, or decryption fails
   * @throws {InputError} If parameters are invalid
   */
  async getSessionData(key, password) {
    const operationId = `getSessionData_${Date.now()}`;
    
    try {
      if (!this.storage) {
        throw new SystemError('Secure storage is not available in this environment', {
          code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
          operationId,
          recoverable: false,
          securityCritical: true
        });
      }
      
      // Validate inputs
      if (!key || typeof key !== 'string') {
        throw new InputError('Key must be a non-empty string', {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId,
          recoverable: false,
          userFixable: true,
          details: { providedType: typeof key }
        });
      }
      
      if (!password || typeof password !== 'string') {
        throw new InputError('Password must be a non-empty string', {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId,
          recoverable: false,
          userFixable: true,
          details: { providedType: typeof password }
        });
      }

      // Retrieve encrypted session data
      const storedData = this.storage.getItem(`${STORAGE_PREFIXES.SESSION_DATA}${key}`);
      if (!storedData) {
        throw new SecurityError('Session data not found or expired', {
          code: ErrorCode.SECURITY_DATA_INTEGRITY,
          operationId,
          recoverable: false,
          userFixable: true,
          recommendedAction: 'The session data may have expired. Please create a new session.'
        });
      }

      let sessionData;
      try {
        sessionData = JSON.parse(storedData);
      } catch (parseError) {
        throw new SecurityError('Session data is corrupted', {
          code: ErrorCode.SECURITY_DATA_INTEGRITY,
          operationId,
          recoverable: false,
          details: { originalError: parseError.message }
        });
      }

      // Check expiration
      if (Date.now() > sessionData.expiresAt) {
        this.removeItem(`${STORAGE_PREFIXES.SESSION_DATA}${key}`);
        throw new SecurityError('Session data has expired', {
          code: ErrorCode.SECURITY_DATA_INTEGRITY,
          operationId,
          recoverable: false,
          userFixable: true,
          recommendedAction: 'Please create a new session or extend the expiration time.'
        });
      }

      // Decrypt data
      const decryptedData = await this.secureKeyManager.decrypt(
        sessionData.encryptedData,
        password
      );
      
      zkErrorLogger.log('INFO', 'Session data retrieved successfully', {
        operationId,
        context: 'secureStorage.getSessionData',
        details: {
          key,
          remainingTime: Math.round((sessionData.expiresAt - Date.now()) / 60000) + ' minutes'
        }
      });
      
      return decryptedData;
    } catch (error) {
      // If it's already a ZKError, just add more context and rethrow
      if (error.code) {
        zkErrorLogger.logError(error, {
          context: 'secureStorage.getSessionData',
          operationId
        });
        throw error;
      }
      
      // Wrap other errors as SecurityError
      const securityError = new SecurityError(`Failed to retrieve session data: ${error.message}`, {
        code: ErrorCode.SECURITY_DATA_INTEGRITY,
        operationId,
        recoverable: false,
        securityCritical: true,
        details: { originalError: error.message }
      });
      
      zkErrorLogger.logError(securityError, {
        context: 'secureStorage.getSessionData'
      });
      
      throw securityError;
    }
  }

  /**
   * Remove item from storage and wipe securely
   * @param {string} key - Key to remove
   */
  removeItem(key) {
    if (!this.storage) return;
    
    const operationId = `removeItem_${Date.now()}`;

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
        
        zkErrorLogger.log('INFO', 'Item removed from secure storage', {
          operationId,
          context: 'secureStorage.removeItem',
          details: { key }
        });
      }
    } catch (error) {
      // Log error but don't throw - removing items should never fail the calling code
      const systemError = new SystemError(`Error removing item ${key}: ${error.message}`, {
        code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
        operationId,
        recoverable: true,
        details: { key, originalError: error.message }
      });
      
      zkErrorLogger.logError(systemError, {
        context: 'secureStorage.removeItem'
      });
    }
  }

  /**
   * Cleanup expired items from storage
   */
  cleanupExpiredItems() {
    if (!this.storage) return;
    
    const operationId = `cleanupExpired_${Date.now()}`;

    try {
      const now = Date.now();
      let removedCount = 0;

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
              removedCount++;
              // Adjust index since we removed an item
              i--;
            }
          } catch (parseError) {
            // If there's an error parsing, remove the item
            this.storage.removeItem(key);
            removedCount++;
            i--;
            
            zkErrorLogger.log('WARNING', 'Removed corrupted item during cleanup', {
              operationId,
              context: 'secureStorage.cleanupExpiredItems',
              details: { key, error: parseError.message }
            });
          }
        }
      }
      
      if (removedCount > 0) {
        zkErrorLogger.log('INFO', `Cleaned up ${removedCount} expired items`, {
          operationId,
          context: 'secureStorage.cleanupExpiredItems'
        });
      }
    } catch (error) {
      // Log error but don't throw - cleanup should never fail the calling code
      const systemError = new SystemError(`Error cleaning up expired items: ${error.message}`, {
        code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
        operationId,
        recoverable: true,
        details: { originalError: error.message }
      });
      
      zkErrorLogger.logError(systemError, {
        context: 'secureStorage.cleanupExpiredItems'
      });
    }
  }

  /**
   * Clean up all sensitive data
   */
  cleanupAllSensitiveData() {
    if (!this.storage) return;
    
    const operationId = `cleanupAll_${Date.now()}`;

    try {
      const prefixes = Object.values(STORAGE_PREFIXES);
      let removedCount = 0;

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
        removedCount++;
      });
      
      if (removedCount > 0) {
        zkErrorLogger.log('INFO', `Cleaned up ${removedCount} sensitive items`, {
          operationId,
          context: 'secureStorage.cleanupAllSensitiveData'
        });
      }
    } catch (error) {
      // Log error but don't throw - cleanup should never fail the calling code
      const systemError = new SystemError(`Error cleaning up all sensitive data: ${error.message}`, {
        code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
        operationId,
        recoverable: true,
        details: { originalError: error.message }
      });
      
      zkErrorLogger.logError(systemError, {
        context: 'secureStorage.cleanupAllSensitiveData'
      });
    }
  }

  /**
   * Create a secure token from data for transferring between sessions
   * @param {Object} data - Data to tokenize
   * @returns {Promise<string>} Secure token
   * @throws {SecurityError} If token creation fails
   */
  async createSecureToken(data) {
    const operationId = `createSecureToken_${Date.now()}`;
    
    try {
      // Validate input
      if (!data || typeof data !== 'object') {
        throw new InputError('Data must be a valid object', {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId,
          recoverable: false,
          userFixable: true,
          details: { providedType: typeof data }
        });
      }
      
      // This is a placeholder implementation
      // In a real implementation, this would use encryption with a derived key
      const serialized = JSON.stringify(data);
      const encoded = btoa(serialized);
      
      zkErrorLogger.log('INFO', 'Secure token created', {
        operationId,
        context: 'secureStorage.createSecureToken',
        details: {
          dataType: typeof data,
          tokenLength: encoded.length
        }
      });
      
      return encoded;
    } catch (error) {
      // If it's already a ZKError, just add more context and rethrow
      if (error.code) {
        zkErrorLogger.logError(error, {
          context: 'secureStorage.createSecureToken',
          operationId
        });
        throw error;
      }
      
      // Wrap other errors as SecurityError
      const securityError = new SecurityError(`Failed to create secure token: ${error.message}`, {
        code: ErrorCode.SECURITY_KEY_ERROR,
        operationId,
        recoverable: false,
        securityCritical: true,
        details: { originalError: error.message }
      });
      
      zkErrorLogger.logError(securityError, {
        context: 'secureStorage.createSecureToken'
      });
      
      throw securityError;
    }
  }

  /**
   * Parse a secure token back into data
   * @param {string} token - Secure token to parse
   * @returns {Promise<Object>} Parsed data
   * @throws {SecurityError} If token parsing fails
   */
  async parseSecureToken(token) {
    const operationId = `parseSecureToken_${Date.now()}`;
    
    try {
      // Validate input
      if (!token || typeof token !== 'string') {
        throw new InputError('Token must be a non-empty string', {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId,
          recoverable: false,
          userFixable: true,
          details: { providedType: typeof token }
        });
      }
      
      // This is a placeholder implementation
      // In a real implementation, this would use decryption with a derived key
      const decoded = atob(token);
      const parsed = JSON.parse(decoded);
      
      zkErrorLogger.log('INFO', 'Secure token parsed', {
        operationId,
        context: 'secureStorage.parseSecureToken',
        details: {
          resultType: typeof parsed,
          isArray: Array.isArray(parsed)
        }
      });
      
      return parsed;
    } catch (error) {
      // If it's already a ZKError, just add more context and rethrow
      if (error.code) {
        zkErrorLogger.logError(error, {
          context: 'secureStorage.parseSecureToken',
          operationId
        });
        throw error;
      }
      
      // Wrap other errors as SecurityError
      const securityError = new SecurityError(`Failed to parse secure token: ${error.message}`, {
        code: ErrorCode.SECURITY_DATA_INTEGRITY,
        operationId,
        recoverable: false,
        securityCritical: true,
        details: { originalError: error.message }
      });
      
      zkErrorLogger.logError(securityError, {
        context: 'secureStorage.parseSecureToken'
      });
      
      throw securityError;
    }
  }

  /**
   * Get all storage keys matching our prefixes
   * @returns {Promise<string[]>} Array of matching keys
   */
  async getAllKeys() {
    if (!this.storage) return [];
    
    const operationId = `getAllKeys_${Date.now()}`;

    try {
      const keys = [];
      const prefixes = Object.values(STORAGE_PREFIXES);

      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (prefixes.some(prefix => key.startsWith(prefix))) {
          keys.push(key);
        }
      }
      
      zkErrorLogger.log('INFO', `Found ${keys.length} secure storage keys`, {
        operationId,
        context: 'secureStorage.getAllKeys'
      });
      
      return keys;
    } catch (error) {
      // Log error but don't throw for this non-critical operation
      const systemError = new SystemError(`Error getting all keys: ${error.message}`, {
        code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
        operationId,
        recoverable: true,
        details: { originalError: error.message }
      });
      
      zkErrorLogger.logError(systemError, {
        context: 'secureStorage.getAllKeys'
      });
      
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
    
    const operationId = `setItem_${Date.now()}`;

    try {
      // Validate key
      if (!key || typeof key !== 'string') {
        throw new InputError('Key must be a non-empty string', {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId,
          recoverable: false,
          userFixable: true,
          details: { providedType: typeof key }
        });
      }
      
      // Validate value
      if (value === undefined) {
        throw new InputError('Value must not be undefined', {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId,
          recoverable: false,
          userFixable: true
        });
      }
      
      // Serialization
      const serialized = JSON.stringify(value);
      
      // Here we would add compression if options.compress is true
      // and encryption if options.encrypt is true
      // This is simplified for now
      
      this.storage.setItem(key, serialized);
      
      zkErrorLogger.log('INFO', 'Item stored successfully', {
        operationId,
        context: 'secureStorage.setItem',
        details: {
          key,
          compress: !!options.compress,
          encrypt: !!options.encrypt,
          dataSize: serialized.length
        }
      });
      
      return true;
    } catch (error) {
      // If it's already a ZKError, just add more context and log it
      if (error.code) {
        zkErrorLogger.logError(error, {
          context: 'secureStorage.setItem',
          operationId
        });
      } else {
        // Wrap other errors as SystemError and log it
        const systemError = new SystemError(`Error setting item ${key}: ${error.message}`, {
          code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
          operationId,
          recoverable: true,
          details: { key, originalError: error.message }
        });
        
        zkErrorLogger.logError(systemError, {
          context: 'secureStorage.setItem'
        });
      }
      
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
    
    const operationId = `getItem_${Date.now()}`;

    try {
      // Validate key
      if (!key || typeof key !== 'string') {
        throw new InputError('Key must be a non-empty string', {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId,
          recoverable: false,
          userFixable: true,
          details: { providedType: typeof key }
        });
      }
      
      const serialized = this.storage.getItem(key);
      if (!serialized) return null;
      
      // Here we would add decompression if options.decompress is true
      // and decryption if options.decrypt is true
      // This is simplified for now
      
      const result = JSON.parse(serialized);
      
      zkErrorLogger.log('INFO', 'Item retrieved successfully', {
        operationId,
        context: 'secureStorage.getItem',
        details: {
          key,
          decompress: !!options.decompress,
          decrypt: !!options.decrypt,
          dataType: typeof result,
          isArray: Array.isArray(result)
        }
      });
      
      return result;
    } catch (error) {
      // If it's already a ZKError, just add more context and log it
      if (error.code) {
        zkErrorLogger.logError(error, {
          context: 'secureStorage.getItem',
          operationId
        });
      } else {
        // Wrap other errors as SystemError and log it
        const systemError = new SystemError(`Error getting item ${key}: ${error.message}`, {
          code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
          operationId,
          recoverable: true,
          details: { key, originalError: error.message }
        });
        
        zkErrorLogger.logError(systemError, {
          context: 'secureStorage.getItem'
        });
      }
      
      return null;
    }
  }
}

// Create singleton instance
const secureStorage = new SecureStorage();

// Export the singleton instance as default
export default secureStorage;