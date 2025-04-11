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

// Modern JavaScript Module Format Re-Exporter
// This is a pure ESM module that will dynamically load the appropriate
// implementation for the current environment.

// Check if we're in an ESM environment by testing for import.meta
const isEsm = typeof import.meta === 'object';

// Create a logger function that can be used before the actual logger is loaded
const logDebug = (message) => {
  if (typeof process !== 'undefined' && process.env.DEBUG) {
    console.debug(`[secureStorage] ${message}`);
  }
};

const logError = (message, error) => {
  console.error(`[secureStorage] ${message}`, error);
};

/**
 * Error thrown when the module fails to load dependencies
 * 
 * @class SecureStorageModuleError
 * @extends Error
 */
class SecureStorageModuleError extends Error {
  /**
   * Create a new SecureStorageModuleError
   * 
   * @param {string} message - Error message
   * @param {Object} options - Additional options
   * @param {string} [options.code] - Error code
   * @param {string} [options.severity] - Error severity level
   * @param {boolean} [options.recoverable] - Whether the error is recoverable
   * @param {string} [options.operationId] - Unique operation ID for tracing
   * @param {Object} [options.details] - Additional error details
   * @param {Error} [options.originalError] - Original error that caused this one
   */
  constructor(message, options = {}) {
    super(message);
    this.name = 'SecureStorageModuleError';
    this.code = options.code || 'SECURE_STORAGE_MODULE_ERROR';
    this.severity = options.severity || 'ERROR';
    this.recoverable = options.recoverable !== undefined ? options.recoverable : true;
    this.operationId = options.operationId || `secure_storage_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    this.details = {
      ...(options.details || {}),
      component: 'secureStorage',
      timestamp: new Date().toISOString()
    };
    
    // Capture original error info if provided
    if (options.originalError) {
      this.originalError = options.originalError;
      this.originalStack = options.originalError.stack;
    }
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// Storage for lazy loading
let moduleExports = null;
let moduleLoadPromise = null;
let errorLogger = null;

/**
 * Load the appropriate module format based on the environment
 * 
 * @private
 * @async
 * @function loadModule
 * @returns {Promise<Object>} Promise that resolves to the module exports
 * @throws {SecureStorageModuleError} When module loading fails
 */
async function loadModule() {
  if (moduleExports) {
    return moduleExports;
  }
  
  if (!moduleLoadPromise) {
    const operationId = `load_secure_storage_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    moduleLoadPromise = (async () => {
      try {
        logDebug(`Loading module in ${isEsm ? 'ESM' : 'CommonJS'} environment (operationId: ${operationId})`);
        
        if (isEsm) {
          // ESM environment
          const [module, loggerModule] = await Promise.all([
            import('./secureStorage.mjs'),
            import('./zkErrorLogger.mjs')
          ]);
          
          moduleExports = module;
          errorLogger = loggerModule.default || loggerModule.zkErrorLogger;
          
          logDebug(`Successfully loaded ESM module (operationId: ${operationId})`);
        } else {
          // CommonJS environment
          moduleExports = require('./cjs/secureStorage.cjs');
          const loggerModule = require('./cjs/zkErrorLogger.cjs');
          errorLogger = loggerModule.zkErrorLogger;
          
          logDebug(`Successfully loaded CommonJS module (operationId: ${operationId})`);
        }
        
        return moduleExports;
      } catch (error) {
        // First try to log using structured logger if available
        try {
          if (errorLogger && errorLogger.logError) {
            await errorLogger.logError(error, {
              context: 'secureStorage.loadModule',
              operationId,
              details: {
                environment: isEsm ? 'ESM' : 'CommonJS',
                moduleType: 'secure-storage'
              }
            });
          }
        } catch (loggingError) {
          // If structured logging fails, fallback to console
          logError(`Error during structured logging: ${loggingError.message}`, loggingError);
        }
        
        // Always log to console for visibility
        logError(`Failed to load module: ${error.message} (operationId: ${operationId})`, error);
        
        // Throw a specialized error with context
        throw new SecureStorageModuleError(
          `Failed to load secureStorage module: ${error.message}`,
          {
            operationId,
            originalError: error,
            details: {
              environment: isEsm ? 'ESM' : 'CommonJS',
              moduleType: 'secure-storage'
            }
          }
        );
      }
    })();
  }
  
  return moduleLoadPromise;
}

/**
 * Get a module property, ensuring module is loaded first
 * 
 * @private
 * @async
 * @function getModuleProp
 * @param {string} prop - Property name to get
 * @returns {Promise<*>} Promise that resolves to the property value
 */
async function getModuleProp(prop) {
  try {
    const module = await loadModule();
    return module[prop];
  } catch (error) {
    // Try to use error logger if available
    try {
      if (errorLogger && errorLogger.logError) {
        await errorLogger.logError(error, {
          context: 'secureStorage.getModuleProp',
          details: {
            property: prop,
            environment: isEsm ? 'ESM' : 'CommonJS'
          }
        });
      }
    } catch (loggingError) {
      logError(`Error during property access logging: ${loggingError.message}`, loggingError);
    }
    
    // Always log to console
    logError(`Failed to access property '${prop}': ${error.message}`, error);
    throw error;
  }
}

// Create a proxy to lazily load the module and access its properties
const moduleProxy = new Proxy({}, {
  get: (target, prop) => {
    // Special case for Symbol.toStringTag to avoid errors with console.log
    if (prop === Symbol.toStringTag) {
      return 'Module';
    }
    
    // Return a function that loads the module before accessing the property
    return (...args) => {
      return getModuleProp(prop)
        .then(value => typeof value === 'function' ? value(...args) : value)
        .catch(error => {
          // Log error and rethrow
          logError(`Error accessing or executing ${String(prop)}: ${error.message}`, error);
          throw error;
        });
    };
  }
});

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
 * Secure storage system with encryption, expiration, and secure cleanup.
 * This provides a dynamic proxy that loads the appropriate implementation
 * based on the environment (ESM or CommonJS).
 * 
 * @type {Object}
 * @property {Function} storeWallet - Store encrypted wallet data securely
 * @property {Function} getWallet - Retrieve wallet data with decryption
 * @property {Function} storeCircuitInput - Store encrypted circuit input data
 * @property {Function} getCircuitInput - Retrieve circuit input data with decryption
 * @property {Function} storeSessionData - Store session data with encryption
 * @property {Function} getSessionData - Retrieve session data with decryption
 * @property {Function} removeItem - Remove and securely wipe an item from storage
 * @property {Function} cleanupExpiredItems - Clean up all expired items from storage
 * @property {Function} cleanupAllSensitiveData - Clean up all sensitive data
 * @property {Function} createSecureToken - Create a secure token for data transfer
 * @property {Function} parseSecureToken - Parse a secure token back into data
 * @property {Function} getAllKeys - Get all storage keys matching our prefixes
 * @property {Function} setItem - Store an item with optional compression and encryption
 * @property {Function} getItem - Retrieve an item with optional decompression and decryption
 * 
 * @example
 * // Store sensitive wallet data with automatic expiration
 * const walletId = await secureStorage.storeWallet(
 *   { address: '0x123...', privateKey: '0xabc...' },
 *   'password123',
 *   30 * 60 * 1000 // 30 minutes
 * );
 * 
 * // Retrieve wallet data with decryption
 * const wallet = await secureStorage.getWallet(walletId, 'password123');
 * 
 * // Store circuit input data
 * const inputId = await secureStorage.storeCircuitInput(
 *   { amount: '1000000000', address: '0x456...' },
 *   'password123'
 * );
 * 
 * // Clean up expired items
 * await secureStorage.cleanupExpiredItems();
 */
export default moduleProxy;