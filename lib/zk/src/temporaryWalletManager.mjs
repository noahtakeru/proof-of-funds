/**
 * Temporary Wallet Manager for Zero-Knowledge Proofs
 * 
 * Provides a secure system for creating and managing temporary wallets
 * used in zero-knowledge proof generation with robust privacy guarantees.
 * 
 * Security features:
 * - Cryptographically secure entropy source using window.crypto.getRandomValues()
 * - Minimum 128-bit entropy for seed generation
 * - Zero private key exposure model with memory wiping
 * - Automatic destruction with configurable lifetime
 * - Emergency purge capabilities for immediate destruction
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This module is like a secure "disposable gloves" system for handling sensitive
 * financial data. Just as medical professionals use disposable gloves to handle
 * materials without direct contact, this system creates temporary digital wallets
 * that our application can use to interact with blockchain data without exposing
 * the user's actual wallets to risk.
 * 
 * Key features in non-technical terms:
 * 
 * 1. TEMPORARY IDENTITY CREATION: Creates short-lived digital "identities" that
 *    can operate on behalf of users without exposing their real financial accounts.
 * 
 * 2. AUTOMATIC CLEANUP: Ensures these temporary identities are completely deleted
 *    after use, similar to properly disposing of medical gloves after a procedure.
 * 
 * 3. PRIVACY PROTECTION: Prevents any trace of the user's real financial information
 *    from being exposed during verification processes.
 * 
 * 4. EMERGENCY PURGE: Includes a "panic button" that immediately removes all
 *    temporary data if suspicious activity is detected.
 * 
 * Business value: Enables secure zero-knowledge operations by creating a protective
 * layer between user assets and the verification system, dramatically reducing risk
 * of exposure while maintaining the ability to generate valid proofs.
 */

import { getBIP44Path, deriveWalletFromMnemonic } from '../walletHelpers.js';
import { getEthers } from '../ethersUtils.js';
import zkErrorHandlerModule from './zkErrorHandler.js';
import zkErrorLoggerModule from './zkErrorLogger.js';

const { zkErrorLogger } = zkErrorLoggerModule;
const {
  ErrorCode,
  InputError,
  SecurityError,
  SystemError,
  isZKError,
  ErrorSeverity
} = zkErrorHandlerModule;

/**
 * Specialized error class for temporary wallet operations
 * Extends SystemError to provide structured error context specific to wallet operations
 * 
 * @class TemporaryWalletError
 * @extends SystemError
 */
class TemporaryWalletError extends SystemError {
  /**
   * Create a new TemporaryWalletError
   * 
   * @param {string} message - Error message
   * @param {Object} options - Error options
   * @param {string} [options.code=ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE] - Error code
   * @param {ErrorSeverity} [options.severity=ErrorSeverity.ERROR] - Error severity
   * @param {boolean} [options.recoverable=true] - Whether the error is recoverable
   * @param {boolean} [options.securityCritical=false] - Whether this is a security-critical error
   * @param {string} [options.operation='unknown'] - The wallet operation that failed
   * @param {string} [options.operationId] - Unique identifier for the operation
   * @param {Object} [options.details={}] - Additional error details
   */
  constructor(message, options = {}) {
    super(message, {
      code: options.code || ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
      severity: options.severity || ErrorSeverity.ERROR,
      recoverable: options.recoverable !== undefined ? options.recoverable : true,
      details: {
        ...(options.details || {}),
        component: 'TemporaryWalletManager',
        operation: options.operation || 'unknown',
        operationId: options.operationId || `temp_wallet_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
      }
    });

    this.name = 'TemporaryWalletError';

    // Set security critical flag if provided
    this.securityCritical = !!options.securityCritical;

    // Capture current stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TemporaryWalletError);
    }
  }
}

/**
 * Helper function for logging errors consistently
 * Converts generic errors to TemporaryWalletError and logs them
 * 
 * @param {Error} error - The error to log
 * @param {Object} additionalInfo - Additional context information
 * @param {string} [additionalInfo.operation] - The operation that failed
 * @param {string} [additionalInfo.context] - The context where the error occurred
 * @param {boolean} [additionalInfo.securityCritical] - Whether this is a security-critical error
 * @returns {Error} The logged error (converted to TemporaryWalletError if needed)
 */
function logWalletError(error, additionalInfo = {}) {
  // Convert to TemporaryWalletError if it's not already a specialized error
  if (!isZKError(error)) {
    const operationId = additionalInfo.operationId || `temp_wallet_error_${Date.now()}`;
    error = new TemporaryWalletError(error.message || 'Unknown error in temporary wallet operation', {
      operationId,
      operation: additionalInfo.operation || 'unknown_operation',
      securityCritical: additionalInfo.securityCritical || false,
      details: {
        originalError: error,
        ...additionalInfo
      }
    });
  }

  // Log the error
  if (zkErrorLogger && zkErrorLogger.logError) {
    zkErrorLogger.logError(error, additionalInfo);
  } else {
    console.error('[TemporaryWalletManager]', error.message, additionalInfo);
  }

  return error;
}

// Constants for wallet configuration
const DEFAULT_TEMP_WALLET_LIFETIME_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_WALLET_CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute
const MIN_ENTROPY_BITS = 128; // Minimum entropy for wallet generation
const ENTROPY_BYTES = MIN_ENTROPY_BITS / 8; // Convert bits to bytes

// In-memory wallet registry (never stored to localStorage/disk)
// Maps wallet address to wallet metadata
const walletRegistry = new Map();

// Set up cleanup interval
let cleanupInterval = null;

/**
 * Securely generates cryptographically strong random bytes
 * Uses window.crypto.getRandomValues() in browsers
 * Falls back to a secure Node.js implementation if needed
 * 
 * @param {number} numBytes - Number of random bytes to generate (min 16 for 128-bit entropy)
 * @returns {Uint8Array} - Array of random bytes
 * @throws {TemporaryWalletError} If secure random generation is not available
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This is like creating truly random lottery numbers that are impossible to predict.
 * Randomness is the foundation of cryptographic security, and weak randomness is a common
 * cause of security breaches. This function ensures that any wallet we create is based
 * on genuinely unpredictable values, making it impossible for attackers to guess private keys.
 */
const getSecureRandomBytes = (numBytes = ENTROPY_BYTES) => {
  const operationId = `secureRandom_${Date.now()}`;

  try {
    // Ensure minimum entropy
    if (numBytes < ENTROPY_BYTES) {
      const zkError = new TemporaryWalletError('Insufficient entropy for secure wallet generation', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        operation: 'getSecureRandomBytes',
        securityCritical: true,
        recoverable: true,
        userFixable: true,
        details: {
          providedBits: numBytes * 8,
          minimumRequiredBits: MIN_ENTROPY_BITS,
          entropySource: 'crypto.getRandomValues'
        }
      });

      logWalletError(zkError, {
        context: 'getSecureRandomBytes',
        securityCritical: true
      });

      // Correct the error by using the minimum instead of throwing
      numBytes = ENTROPY_BYTES;
    }

    // Create buffer for random bytes
    const buffer = new Uint8Array(numBytes);

    // Browser environment with window.crypto
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(buffer);
      return buffer;
    }

    // Node.js environment
    if (typeof crypto !== 'undefined' && crypto.randomBytes) {
      const nodeRandomBytes = crypto.randomBytes(numBytes);
      buffer.set(new Uint8Array(nodeRandomBytes));
      return buffer;
    }

    // If we get here, we don't have access to a secure random source
    const zkError = new TemporaryWalletError('No secure random source available for wallet generation', {
      code: ErrorCode.SECURITY_DATA_INTEGRITY,
      operationId,
      operation: 'getSecureRandomBytes',
      securityCritical: true,
      recoverable: false,
      userFixable: false,
      details: {
        browserHasCrypto: typeof window !== 'undefined' && !!window.crypto,
        nodeHasCrypto: typeof crypto !== 'undefined' && !!crypto.randomBytes,
        numBytesRequested: numBytes,
        entropy: 'insufficient',
        timestamp: new Date().toISOString()
      },
      recommendedAction: 'Please use a modern browser with Web Cryptography API support'
    });

    throw logWalletError(zkError, {
      context: 'getSecureRandomBytes',
      securityCritical: true,
      entropyRequested: numBytes * 8 + ' bits'
    });
  } catch (error) {
    // If it's already a ZKError, just log it and re-throw
    if (isZKError(error)) {
      throw logWalletError(error, {
        context: 'getSecureRandomBytes',
        securityCritical: true,
        operation: 'getSecureRandomBytes'
      });
    }

    // Otherwise wrap it in a TemporaryWalletError
    const zkError = new TemporaryWalletError(`Failed to generate secure random bytes: ${error.message}`, {
      code: ErrorCode.SECURITY_DATA_INTEGRITY,
      operationId,
      operation: 'getSecureRandomBytes',
      securityCritical: true,
      recoverable: false,
      details: {
        originalError: error.message,
        requestedBytes: numBytes,
        requestedBits: numBytes * 8,
        entropySource: typeof window !== 'undefined' ? 'browser' : 'node',
        timestamp: new Date().toISOString()
      }
    });

    throw logWalletError(zkError, {
      context: 'getSecureRandomBytes',
      securityCritical: true
    });
  }
};

/**
 * Converts random bytes to a mnemonic phrase
 * Uses BIP39 to generate a 12-word mnemonic from entropy
 * 
 * @param {Uint8Array} entropyBytes - Random bytes with sufficient entropy
 * @returns {Promise<string>} - BIP39 mnemonic phrase
 * @throws {TemporaryWalletError} If mnemonic generation fails
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This converts raw random numbers into a format (12 words) that can be used to create a
 * cryptocurrency wallet. It's similar to how a bank might take your personal information and
 * create an account number. These 12 words (called a "seed phrase") are all that's needed
 * to control the wallet's funds, which is why we handle them so carefully.
 */
const entropyToMnemonic = async (entropyBytes) => {
  const operationId = `entropyToMnemonic_${Date.now()}`;

  try {
    // Validate input
    if (!entropyBytes || !(entropyBytes instanceof Uint8Array)) {
      const zkError = new TemporaryWalletError('Invalid entropy bytes for mnemonic generation', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        operation: 'entropyToMnemonic',
        securityCritical: true,
        recoverable: false,
        userFixable: false,
        details: {
          providedType: typeof entropyBytes,
          isUint8Array: entropyBytes instanceof Uint8Array,
          expectedType: 'Uint8Array',
          timestamp: new Date().toISOString()
        }
      });

      throw logWalletError(zkError, {
        context: 'entropyToMnemonic',
        securityCritical: true,
        operation: 'entropyToMnemonic'
      });
    }

    // Validate entropy size
    if (entropyBytes.length < ENTROPY_BYTES) {
      const zkError = new TemporaryWalletError('Insufficient entropy for secure mnemonic generation', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        operation: 'entropyToMnemonic',
        securityCritical: true,
        recoverable: false,
        userFixable: false,
        details: {
          providedBytes: entropyBytes.length,
          providedBits: entropyBytes.length * 8,
          minimumRequiredBits: MIN_ENTROPY_BITS,
          timestamp: new Date().toISOString()
        }
      });

      throw logWalletError(zkError, {
        context: 'entropyToMnemonic',
        securityCritical: true,
        entropySource: 'user-provided'
      });
    }

    const { ethers } = await getEthers();

    // Create wordlist
    const wordlist = ethers.wordlists.en;

    // Convert bytes to mnemonic
    return ethers.utils.entropyToMnemonic(entropyBytes, wordlist);
  } catch (error) {
    // If it's already a ZKError, just log it and re-throw
    if (isZKError(error)) {
      throw logWalletError(error, {
        context: 'entropyToMnemonic',
        securityCritical: true
      });
    }

    // Otherwise wrap it in a TemporaryWalletError
    const zkError = new TemporaryWalletError(`Failed to generate mnemonic: ${error.message}`, {
      code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
      operationId,
      operation: 'entropyToMnemonic',
      securityCritical: true,
      recoverable: false,
      details: {
        originalError: error.message,
        hasEntropyBytes: !!entropyBytes,
        entropyBytesLength: entropyBytes ? entropyBytes.length : 0,
        errorType: error.name || typeof error,
        timestamp: new Date().toISOString()
      }
    });

    throw logWalletError(zkError, {
      context: 'entropyToMnemonic',
      securityCritical: true
    });
  }
};

/**
 * Securely wipes sensitive data from memory
 * Overwrites the data with zeros to prevent memory access
 * 
 * @param {Object|string|Uint8Array} data - Data to wipe
 * @returns {boolean} True if wiping was successful
 * @throws {TemporaryWalletError} If data wiping fails
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This is similar to shredding confidential documents after you've used them. When we're
 * done with sensitive information (like private keys or seed phrases), we don't just "throw
 * it away" - we actively destroy it by overwriting the memory. This helps protect against
 * sophisticated attacks that might try to access data that's no longer being used but
 * still exists in memory.
 */
const wipeFromMemory = (data) => {
  const operationId = `wipeMemory_${Date.now()}`;

  // Skip wiping if data is undefined or null
  if (data === undefined || data === null) {
    return true;
  }

  try {
    // Handle different data types
    if (data instanceof Uint8Array) {
      // Zero out all bytes in the array
      data.fill(0);
    } else if (typeof data === 'string') {
      // We can't actually modify strings in JavaScript (they're immutable)
      // The best we can do is ensure we don't leave references to them
      // The garbage collector will eventually clean them up

      // Log info about string memory handling
      zkErrorLogger.log('INFO', 'String memory cannot be directly wiped due to JavaScript immutability', {
        operationId,
        code: ErrorCode.SECURITY_DATA_INTEGRITY,
        details: {
          dataType: 'string',
          stringLength: data.length
        }
      });

      // In a production environment, consider using a secure string implementation
      // that uses typed arrays internally
    } else if (typeof data === 'object' && data !== null) {
      // Recursively wipe all properties of an object
      Object.keys(data).forEach(key => {
        if (typeof data[key] === 'object' && data[key] !== null) {
          wipeFromMemory(data[key]);
        }
        data[key] = null;
      });
    }

    return true;
  } catch (error) {
    const zkError = new TemporaryWalletError(`Failed to securely wipe memory: ${error.message}`, {
      code: ErrorCode.SECURITY_DATA_INTEGRITY,
      operationId,
      operation: 'wipeFromMemory',
      securityCritical: true,
      recoverable: false,
      details: {
        dataType: data ? typeof data : 'null',
        isArray: Array.isArray(data),
        isTypedArray: data instanceof Uint8Array,
        originalError: error.message,
        timestamp: new Date().toISOString(),
        memoryWipeAttempted: true
      }
    });

    throw logWalletError(zkError, {
      context: 'wipeFromMemory',
      securityCritical: true,
      dataStructure: Array.isArray(data) ? 'array' : (data instanceof Uint8Array ? 'typedArray' : typeof data)
    });
  }
};

/**
 * Generates a temporary wallet with maximum security
 * 
 * @param {Object} options - Options for wallet generation
 * @param {string} options.chain - Blockchain to generate for (default: 'ethereum')
 * @param {number} options.index - Address index to use (default: random)
 * @param {number} options.lifetimeMs - Wallet lifetime in milliseconds (default: 15 minutes)
 * @param {boolean} options.persistent - Whether to keep the wallet after page refresh (default: false)
 * @param {Function} options.onExpiration - Callback when wallet expires (optional)
 * @returns {Promise<Object>} Wallet metadata, but never containing private key
 * @throws {SecurityError} If wallet generation fails due to security issues
 * @throws {InputError} If options are invalid
 * @throws {SystemError} If system cannot create the wallet
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This creates a temporary "burner" wallet that has no connection to the user's real wallet.
 * It's like creating a one-time-use email address when you don't want to share your main email.
 * 
 * The temporary wallet:
 * 1. Has a limited lifetime (typically 15 minutes)
 * 2. Is automatically destroyed when no longer needed
 * 3. Leaves no trace that can be linked back to the user
 * 
 * This is essential for our zero-knowledge proofs to truly protect privacy, as it breaks
 * the link between the proof and the user's identity/main wallet.
 */
export const createTemporaryWallet = async (options = {}) => {
  const operationId = `createWallet_${Date.now()}`;

  try {
    // Validate options
    if (options !== null && typeof options !== 'object') {
      const zkError = new TemporaryWalletError('Invalid options provided to temporary wallet creation', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        operation: 'createTemporaryWallet',
        recoverable: true,
        userFixable: true,
        details: {
          providedType: typeof options,
          expectedType: 'object',
          timestamp: new Date().toISOString()
        }
      });

      throw logWalletError(zkError, { context: 'createTemporaryWallet' });
    }

    // Validate chain option if provided
    if (options.chain && typeof options.chain !== 'string') {
      const zkError = new TemporaryWalletError('Invalid chain parameter for temporary wallet', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        operation: 'createTemporaryWallet.validateChain',
        recoverable: true,
        userFixable: true,
        details: {
          providedType: typeof options.chain,
          expectedType: 'string',
          timestamp: new Date().toISOString()
        }
      });

      throw logWalletError(zkError, { context: 'createTemporaryWallet' });
    }

    // Validate index option if provided
    if (options.index !== undefined && (typeof options.index !== 'number' || isNaN(options.index) || options.index < 0)) {
      const zkError = new TemporaryWalletError('Invalid wallet index parameter', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        operation: 'createTemporaryWallet.validateIndex',
        recoverable: true,
        userFixable: true,
        details: {
          providedValue: options.index,
          providedType: typeof options.index,
          expectedType: 'positive number',
          timestamp: new Date().toISOString()
        }
      });

      throw logWalletError(zkError, { context: 'createTemporaryWallet' });
    }

    // Validate lifetime option if provided
    if (options.lifetimeMs !== undefined && (typeof options.lifetimeMs !== 'number' ||
      isNaN(options.lifetimeMs) || options.lifetimeMs < 1000)) {
      const zkError = new TemporaryWalletError('Invalid wallet lifetime parameter', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        operation: 'createTemporaryWallet.validateLifetime',
        recoverable: true,
        userFixable: true,
        details: {
          providedValue: options.lifetimeMs,
          providedType: typeof options.lifetimeMs,
          minimumValue: 1000,
          expectedType: 'number >= 1000',
          timestamp: new Date().toISOString()
        }
      });

      throw logWalletError(zkError, { context: 'createTemporaryWallet' });
    }

    // Validate callback option if provided
    if (options.onExpiration !== undefined && typeof options.onExpiration !== 'function') {
      const zkError = new TemporaryWalletError('Invalid expiration callback parameter', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        operation: 'createTemporaryWallet.validateCallback',
        recoverable: true,
        userFixable: true,
        details: {
          providedType: typeof options.onExpiration,
          expectedType: 'function',
          timestamp: new Date().toISOString()
        }
      });

      throw logWalletError(zkError, { context: 'createTemporaryWallet' });
    }

    // Ensure cleanup interval is running
    ensureCleanupInterval();

    // Generate secure random bytes
    const entropyBytes = getSecureRandomBytes();

    // Convert to mnemonic
    const mnemonic = await entropyToMnemonic(entropyBytes);

    // Configure wallet options
    const chain = options.chain || 'ethereum';
    const index = options.index || Math.floor(Math.random() * 100); // Random index if not specified
    const path = getBIP44Path(chain, index);
    const lifetimeMs = options.lifetimeMs || DEFAULT_TEMP_WALLET_LIFETIME_MS;
    const persistent = !!options.persistent;
    const creationTime = Date.now();
    const expirationTime = creationTime + lifetimeMs;

    // Derive wallet from mnemonic
    let walletInfo;
    try {
      walletInfo = await deriveWalletFromMnemonic(mnemonic, path);
    } catch (derivationError) {
      const zkError = new TemporaryWalletError(`Failed to derive wallet from mnemonic: ${derivationError.message}`, {
        code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
        operationId,
        operation: 'createTemporaryWallet.derivation',
        recoverable: false,
        securityCritical: true,
        details: {
          chain,
          path,
          bip44Path: path,
          index,
          originalError: derivationError.message,
          errorType: derivationError.name || typeof derivationError,
          timestamp: new Date().toISOString()
        }
      });

      throw logWalletError(zkError, {
        context: 'createTemporaryWallet.derivation',
        securityCritical: true,
        chain
      });
    }

    // Extract only what we need
    const { address, privateKey } = walletInfo;

    // Create public wallet metadata (safe to expose)
    const walletMetadata = {
      address,
      chain,
      path,
      index,
      creationTime,
      expirationTime,
      persistent,
      // Note: We do NOT include the mnemonic or private key in the metadata
    };

    // Create private wallet data (kept only in memory, never exposed)
    const privateWalletData = {
      privateKey,
      mnemonic,
      // Include reference to callback if provided
      onExpiration: options.onExpiration
    };

    // Store wallet in registry with separate public and private data
    walletRegistry.set(address, {
      public: walletMetadata,
      private: privateWalletData
    });

    // Setup auto-destruction
    setupWalletExpiration(address, expirationTime);

    // Wipe the sensitive data we no longer need
    try {
      wipeFromMemory(entropyBytes);
      wipeFromMemory(walletInfo);
    } catch (wipeError) {
      // Log the error but don't fail the wallet creation
      logWalletError(wipeError, {
        context: 'createTemporaryWallet.memoryWipe',
        securityCritical: true,
        operation: 'createTemporaryWallet.wipeSensitiveData'
      });

      // Still continue with returning the wallet
    }

    // Return only the public metadata
    return { ...walletMetadata };
  } catch (error) {
    // If it's already a ZKError, just log it and re-throw
    if (isZKError(error)) {
      throw logWalletError(error, {
        context: 'createTemporaryWallet',
        operation: 'createTemporaryWallet'
      });
    }

    // Otherwise wrap it in a TemporaryWalletError
    const zkError = new TemporaryWalletError(`Temporary wallet creation failed: ${error.message}`, {
      code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
      operationId,
      operation: 'createTemporaryWallet',
      recoverable: false,
      details: {
        originalError: error.message,
        errorType: error.name || typeof error,
        options: {
          ...(options || {}),
          // Never include sensitive data in logs
          privateKey: options.privateKey ? '[REDACTED]' : undefined,
          mnemonic: options.mnemonic ? '[REDACTED]' : undefined,
          seed: options.seed ? '[REDACTED]' : undefined
        },
        timestamp: new Date().toISOString()
      }
    });

    throw logWalletError(zkError, {
      context: 'createTemporaryWallet',
      chain: options.chain || 'ethereum'
    });
  }
};

/**
 * Sets up automatic wallet expiration
 * 
 * @param {string} address - Wallet address
 * @param {number} expirationTime - Timestamp when wallet should expire
 * @throws {TemporaryWalletError} If parameters are invalid
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This sets the self-destruct timer on our temporary wallets. It ensures that even if
 * there's a bug or someone forgets to manually destroy a wallet, it will automatically
 * be cleaned up after its designated lifetime (typically 15 minutes). This is an important
 * security feature that limits the exposure window of sensitive data.
 */
const setupWalletExpiration = (address, expirationTime) => {
  const operationId = `setupExpiration_${Date.now()}`;

  try {
    // Validate address
    if (!address || typeof address !== 'string') {
      const zkError = new TemporaryWalletError('Invalid wallet address for expiration setup', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        operation: 'setupWalletExpiration',
        recoverable: true,
        userFixable: false,
        details: {
          providedType: typeof address,
          expectedType: 'string',
          timestamp: new Date().toISOString()
        }
      });

      throw logWalletError(zkError, {
        context: 'setupWalletExpiration',
        operation: 'setupWalletExpiration'
      });
    }

    // Validate expiration time
    if (!expirationTime || typeof expirationTime !== 'number' || expirationTime <= Date.now()) {
      const zkError = new TemporaryWalletError('Invalid expiration time for wallet', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        operation: 'setupWalletExpiration',
        recoverable: true,
        userFixable: false,
        details: {
          providedType: typeof expirationTime,
          providedValue: expirationTime,
          currentTime: Date.now(),
          expectedType: 'future timestamp number',
          timestamp: new Date().toISOString()
        }
      });

      throw logWalletError(zkError, {
        context: 'setupWalletExpiration',
        address: address
      });
    }

    const now = Date.now();
    const timeUntilExpiration = Math.max(0, expirationTime - now);

    // Set up timeout for wallet destruction
    setTimeout(() => {
      destroyWallet(address);
    }, timeUntilExpiration);

    // Log that expiration is set up
    zkErrorLogger.log('INFO', 'Wallet expiration timer set', {
      operationId,
      details: {
        address,
        expirationTime,
        expiresInMs: timeUntilExpiration
      }
    });
  } catch (error) {
    // If it's already a ZKError, just log it and re-throw
    if (isZKError(error)) {
      throw logWalletError(error, {
        context: 'setupWalletExpiration',
        address: address || 'unknown'
      });
    }

    // Otherwise wrap it in a TemporaryWalletError
    const zkError = new TemporaryWalletError(`Failed to setup wallet expiration: ${error.message}`, {
      code: ErrorCode.SYSTEM_NOT_INITIALIZED,
      operationId,
      operation: 'setupWalletExpiration',
      recoverable: true,
      details: {
        address,
        expirationTime,
        originalError: error.message,
        timeUntilExpiration: expirationTime ? Math.max(0, expirationTime - Date.now()) : null,
        timestamp: new Date().toISOString()
      }
    });

    throw logWalletError(zkError, {
      context: 'setupWalletExpiration',
      address: address || 'unknown'
    });
  }
};

/**
 * Ensures the wallet cleanup interval is running
 * This periodically checks for and removes any expired wallets
 * 
 * @returns {boolean} Whether the cleanup interval is now running
 * @throws {TemporaryWalletError} If the cleanup interval cannot be started
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This is like having a janitor that regularly sweeps through to make sure no
 * sensitive information was accidentally left behind. It's a backup mechanism that
 * checks for any wallets that should be destroyed but somehow weren't, providing
 * an additional layer of security through redundancy.
 */
const ensureCleanupInterval = () => {
  const operationId = `ensureCleanup_${Date.now()}`;

  try {
    // If interval is already running, just return
    if (cleanupInterval !== null) {
      return true;
    }

    // Create interval to check memory
    cleanupInterval = setInterval(cleanupExpiredWallets, DEFAULT_WALLET_CLEANUP_INTERVAL_MS);

    zkErrorLogger.log('INFO', 'Wallet cleanup interval started', {
      operationId,
      details: {
        intervalMs: DEFAULT_WALLET_CLEANUP_INTERVAL_MS
      }
    });

    return true;
  } catch (error) {
    const zkError = new TemporaryWalletError(`Failed to start wallet cleanup interval: ${error.message}`, {
      code: ErrorCode.SYSTEM_NOT_INITIALIZED,
      operationId,
      operation: 'ensureCleanupInterval',
      recoverable: true,
      securityCritical: true,
      details: {
        originalError: error.message,
        intervalMs: DEFAULT_WALLET_CLEANUP_INTERVAL_MS,
        isIntervalNull: cleanupInterval === null,
        timestamp: new Date().toISOString()
      }
    });

    throw logWalletError(zkError, {
      context: 'ensureCleanupInterval',
      securityCritical: true
    });
  }
};

/**
 * Cleans up any expired wallets from the registry
 * 
 * @throws {TemporaryWalletError} If cleanup fails
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This function performs the actual "janitorial" work of checking for and removing
 * any wallets that have passed their expiration time. It's part of our defense-in-depth
 * approach to security, ensuring that temporary wallets truly are temporary.
 */
const cleanupExpiredWallets = () => {
  const operationId = `cleanupWallets_${Date.now()}`;

  try {
    const now = Date.now();
    let expiredCount = 0;

    // Check all wallets in registry
    for (const [address, walletData] of walletRegistry.entries()) {
      const { expirationTime } = walletData.public;

      // If wallet has expired, destroy it
      if (now >= expirationTime) {
        try {
          const destroyed = destroyWallet(address);
          if (destroyed) {
            expiredCount++;
          }
        } catch (destroyError) {
          // Log but continue processing other wallets
          logWalletError(
            new TemporaryWalletError(`Error destroying expired wallet ${address}: ${destroyError.message}`, {
              code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
              operationId,
              operation: 'cleanupExpiredWallets.destroyWallet',
              recoverable: true,
              securityCritical: true,
              details: {
                address,
                expirationTime,
                originalError: destroyError.message,
                currentTime: now,
                timeOverdue: now - expirationTime,
                timestamp: new Date().toISOString()
              }
            }),
            {
              context: 'cleanupExpiredWallets',
              securityCritical: true
            }
          );
        }
      }
    }

    // Only log if there were wallets to clean up
    if (expiredCount > 0) {
      zkErrorLogger.log('INFO', 'Expired wallets cleaned up', {
        operationId,
        details: {
          expiredWalletsRemoved: expiredCount
        }
      });
    }
  } catch (error) {
    const zkError = new TemporaryWalletError(`Failed to clean up expired wallets: ${error.message}`, {
      code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
      operationId,
      operation: 'cleanupExpiredWallets',
      recoverable: true,
      securityCritical: true,
      details: {
        originalError: error.message,
        walletCount: walletRegistry.size,
        currentTime: Date.now(),
        timestamp: new Date().toISOString()
      }
    });

    logWalletError(zkError, {
      context: 'cleanupExpiredWallets',
      securityCritical: true
    });

    // Don't throw from here as this is called from a timer
    // Just log the error and continue
  }
};

/**
 * Destroys a wallet and securely wipes its data from memory
 * 
 * @param {string} address - Address of the wallet to destroy
 * @returns {boolean} Whether the wallet was successfully destroyed
 * @throws {TemporaryWalletError} If address is invalid or data wiping fails
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This is the self-destruct mechanism for our temporary wallets. When a wallet is no
 * longer needed (either because it expired or because we're done with it), this function
 * completely removes all traces of it from memory, including sensitive data like private keys.
 * This is essential for maintaining security and privacy.
 */
export const destroyWallet = (address) => {
  const operationId = `destroyWallet_${Date.now()}`;

  try {
    // Validate address
    if (!address || typeof address !== 'string') {
      const zkError = new TemporaryWalletError('Invalid wallet address for wallet destruction', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        operation: 'destroyWallet',
        recoverable: true,
        userFixable: true,
        details: {
          providedType: typeof address,
          expectedType: 'string',
          timestamp: new Date().toISOString()
        }
      });

      throw logWalletError(zkError, { context: 'destroyWallet' });
    }

    // Check if wallet exists
    if (!walletRegistry.has(address)) {
      // Not finding a wallet isn't an error, it might have been destroyed already
      zkErrorLogger.log('INFO', 'Attempted to destroy non-existent wallet', {
        operationId,
        details: { address }
      });
      return false;
    }

    // Get wallet data
    const walletData = walletRegistry.get(address);

    // Call expiration callback if provided
    if (typeof walletData.private.onExpiration === 'function') {
      try {
        walletData.private.onExpiration(address);
      } catch (callbackError) {
        // Log but continue with destruction
        logWalletError(
          new TemporaryWalletError(`Error in wallet expiration callback: ${callbackError.message}`, {
            code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
            operationId,
            operation: 'destroyWallet.callback',
            recoverable: true,
            securityCritical: true,
            details: {
              address,
              originalError: callbackError.message,
              callbackType: typeof walletData.private.onExpiration,
              timestamp: new Date().toISOString()
            }
          }),
          {
            context: 'destroyWallet.callback',
            securityCritical: true
          }
        );
      }
    }

    // Securely wipe private data
    try {
      wipeFromMemory(walletData.private);
    } catch (wipeError) {
      // This is a security-critical error
      const zkError = new TemporaryWalletError(`Failed to securely wipe wallet data: ${wipeError.message}`, {
        code: ErrorCode.SECURITY_DATA_INTEGRITY,
        operationId,
        operation: 'destroyWallet.wipe',
        recoverable: false,
        securityCritical: true,
        details: {
          address,
          originalError: wipeError.message,
          wipeAttempted: true,
          timestamp: new Date().toISOString()
        }
      });

      throw logWalletError(zkError, {
        context: 'destroyWallet.wipe',
        securityCritical: true,
        address
      });
    }

    // Remove from registry
    walletRegistry.delete(address);

    zkErrorLogger.log('INFO', `Wallet destroyed`, {
      operationId,
      details: { address }
    });

    return true;
  } catch (error) {
    // If it's already a ZKError, just log it and re-throw
    if (isZKError(error)) {
      throw logWalletError(error, {
        context: 'destroyWallet',
        address
      });
    }

    // Otherwise log a general error
    const zkError = new TemporaryWalletError(`Error destroying wallet ${address}: ${error.message}`, {
      code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
      operationId,
      operation: 'destroyWallet',
      recoverable: true,
      securityCritical: true,
      details: {
        address,
        originalError: error.message,
        walletExists: walletRegistry.has(address),
        timestamp: new Date().toISOString()
      }
    });

    logWalletError(zkError, {
      context: 'destroyWallet',
      securityCritical: true,
      address
    });

    return false;
  }
};

/**
 * Checks if a wallet exists in the registry
 * 
 * @param {string} address - Wallet address to check
 * @returns {boolean} Whether the wallet exists and is valid
 * @throws {TemporaryWalletError} If address parameter is invalid
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This checks if a temporary wallet is still available or if it has already been
 * destroyed. It's like checking if your temporary access badge to a building is
 * still valid. This helps other parts of the application know whether they can
 * use a particular temporary wallet or if they need to create a new one.
 */
export const hasWallet = (address) => {
  const operationId = `hasWallet_${Date.now()}`;

  try {
    // Validate address
    if (!address || typeof address !== 'string') {
      const zkError = new TemporaryWalletError('Invalid wallet address for wallet check', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        operation: 'hasWallet',
        recoverable: true,
        userFixable: true,
        details: {
          providedType: typeof address,
          expectedType: 'string',
          timestamp: new Date().toISOString()
        }
      });

      throw logWalletError(zkError, { context: 'hasWallet' });
    }

    // Check if wallet exists in registry
    if (!walletRegistry.has(address)) {
      return false;
    }

    // Get wallet data
    const walletData = walletRegistry.get(address);

    // Check if wallet has expired
    const now = Date.now();
    return now < walletData.public.expirationTime;
  } catch (error) {
    // If it's already a ZKError, just log it and re-throw
    if (isZKError(error)) {
      throw logWalletError(error, {
        context: 'hasWallet',
        address: address || 'unknown'
      });
    }

    // Otherwise wrap it in a TemporaryWalletError
    const zkError = new TemporaryWalletError(`Error checking wallet existence: ${error.message}`, {
      code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
      operationId,
      operation: 'hasWallet',
      recoverable: true,
      details: {
        address,
        originalError: error.message,
        timestamp: new Date().toISOString()
      }
    });

    throw logWalletError(zkError, {
      context: 'hasWallet',
      address: address || 'unknown'
    });
  }
};

/**
 * Gets the public metadata for a wallet (never returns private key)
 * 
 * @param {string} address - Wallet address
 * @returns {Object|null} Wallet metadata or null if not found
 * @throws {TemporaryWalletError} If address parameter is invalid
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This returns the "public" information about a temporary wallet - things like its
 * address and expiration time, but never sensitive information like the private key.
 * It's similar to how a bank might tell you your account number and when it was created,
 * but would never tell you the PIN code.
 */
export const getWalletInfo = (address) => {
  const operationId = `getWalletInfo_${Date.now()}`;

  try {
    // Validate address
    if (!address || typeof address !== 'string') {
      const zkError = new TemporaryWalletError('Invalid wallet address for info retrieval', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        operation: 'getWalletInfo',
        recoverable: true,
        userFixable: true,
        details: {
          providedType: typeof address,
          expectedType: 'string',
          timestamp: new Date().toISOString()
        }
      });

      throw logWalletError(zkError, { context: 'getWalletInfo' });
    }

    // Check if wallet exists
    if (!walletRegistry.has(address)) {
      return null;
    }

    // Get wallet data
    const walletData = walletRegistry.get(address);

    // Return only public metadata (never private key or mnemonic)
    return { ...walletData.public };
  } catch (error) {
    // If it's already a ZKError, just log it and re-throw
    if (isZKError(error)) {
      throw logWalletError(error, {
        context: 'getWalletInfo',
        address: address || 'unknown'
      });
    }

    // Otherwise wrap it in a TemporaryWalletError
    const zkError = new TemporaryWalletError(`Error retrieving wallet info: ${error.message}`, {
      code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
      operationId,
      operation: 'getWalletInfo',
      recoverable: true,
      details: {
        address,
        originalError: error.message,
        walletExists: walletRegistry.has(address),
        timestamp: new Date().toISOString()
      }
    });

    throw logWalletError(zkError, {
      context: 'getWalletInfo',
      address: address || 'unknown'
    });
  }
};

/**
 * Extends the lifetime of a temporary wallet
 * 
 * @param {string} address - Wallet address
 * @param {number} additionalTimeMs - Additional time in milliseconds
 * @returns {boolean} Whether the extension was successful
 * @throws {TemporaryWalletError} If parameters are invalid
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This is like extending your hotel stay for a few more days. Sometimes we need to
 * keep a temporary wallet around longer than initially planned (for example, if a
 * proof verification is taking longer than expected). This function allows us to
 * postpone the self-destruct timer while maintaining all the security properties.
 */
export const extendWalletLifetime = (address, additionalTimeMs) => {
  const operationId = `extendWallet_${Date.now()}`;

  try {
    // Validate address
    if (!address || typeof address !== 'string') {
      const zkError = new TemporaryWalletError('Invalid wallet address for lifetime extension', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        operation: 'extendWalletLifetime',
        recoverable: true,
        userFixable: true,
        details: {
          providedType: typeof address,
          expectedType: 'string',
          timestamp: new Date().toISOString()
        }
      });

      throw logWalletError(zkError, { context: 'extendWalletLifetime' });
    }

    // Validate additional time
    if (typeof additionalTimeMs !== 'number' || additionalTimeMs <= 0) {
      const zkError = new TemporaryWalletError('Invalid time value for wallet extension', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        operation: 'extendWalletLifetime',
        recoverable: true,
        userFixable: true,
        details: {
          providedType: typeof additionalTimeMs,
          providedValue: additionalTimeMs,
          expectedType: 'positive number',
          timestamp: new Date().toISOString()
        }
      });

      throw logWalletError(zkError, {
        context: 'extendWalletLifetime',
        address
      });
    }

    // Check if wallet exists
    if (!walletRegistry.has(address)) {
      zkErrorLogger.log('WARNING', 'Attempted to extend lifetime of non-existent wallet', {
        operationId,
        details: {
          address,
          additionalTimeMs
        }
      });

      return false;
    }

    // Get wallet data
    const walletData = walletRegistry.get(address);

    // Update expiration time
    const newExpirationTime = walletData.public.expirationTime + additionalTimeMs;
    walletData.public.expirationTime = newExpirationTime;

    // Reset expiration timer
    setupWalletExpiration(address, newExpirationTime);

    zkErrorLogger.log('INFO', 'Wallet lifetime extended', {
      operationId,
      details: {
        address,
        additionalTimeMs,
        newExpirationTime
      }
    });

    return true;
  } catch (error) {
    // If it's already a ZKError, just log it and re-throw
    if (isZKError(error)) {
      throw logWalletError(error, {
        context: 'extendWalletLifetime',
        address: address || 'unknown',
        additionalTimeMs
      });
    }

    // Otherwise wrap it in a TemporaryWalletError
    const zkError = new TemporaryWalletError(`Error extending wallet lifetime for ${address}: ${error.message}`, {
      code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
      operationId,
      operation: 'extendWalletLifetime',
      recoverable: true,
      details: {
        address,
        additionalTimeMs,
        originalError: error.message,
        walletExists: walletRegistry.has(address),
        currentTime: Date.now(),
        timestamp: new Date().toISOString()
      }
    });

    throw logWalletError(zkError, {
      context: 'extendWalletLifetime',
      address: address || 'unknown'
    });
  }
};

/**
 * Performs a callback function with access to a wallet's private key
 * The private key is never returned or stored outside this function
 * 
 * @param {string} address - Wallet address
 * @param {Function} callback - Callback function that receives the private key
 * @returns {Promise<any>} Result of the callback function
 * @throws {TemporaryWalletError} If parameters are invalid or wallet access fails
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This provides extremely controlled, temporary access to a wallet's private key.
 * It's like a bank vault that opens for exactly one transaction and then immediately
 * locks again. The private key is never exposed outside the function, which minimizes
 * the risk of it being compromised. This allows us to perform necessary operations
 * (like signing transactions) while maintaining strict security.
 */
export const withWalletPrivateKey = async (address, callback) => {
  const operationId = `withPrivateKey_${Date.now()}`;

  try {
    // Validate address
    if (!address || typeof address !== 'string') {
      const zkError = new TemporaryWalletError('Invalid wallet address for private key operation', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        operation: 'withWalletPrivateKey',
        recoverable: true,
        userFixable: true,
        securityCritical: true,
        details: {
          providedType: typeof address,
          expectedType: 'string',
          timestamp: new Date().toISOString()
        }
      });

      throw logWalletError(zkError, {
        context: 'withWalletPrivateKey',
        securityCritical: true,
        operation: 'withWalletPrivateKey.validateAddress'
      });
    }

    // Validate callback
    if (typeof callback !== 'function') {
      const zkError = new TemporaryWalletError('Invalid callback for private key operation', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        operation: 'withWalletPrivateKey',
        recoverable: true,
        userFixable: true,
        securityCritical: true,
        details: {
          providedType: typeof callback,
          expectedType: 'function',
          timestamp: new Date().toISOString()
        }
      });

      throw logWalletError(zkError, {
        context: 'withWalletPrivateKey',
        securityCritical: true,
        operation: 'withWalletPrivateKey.validateCallback',
        address
      });
    }

    // Check if wallet exists
    if (!walletRegistry.has(address)) {
      const zkError = new TemporaryWalletError(`Wallet ${address} not found or has expired`, {
        code: ErrorCode.SECURITY_KEY_ERROR,
        operationId,
        operation: 'withWalletPrivateKey',
        recoverable: false,
        userFixable: true,
        securityCritical: true,
        details: {
          address,
          walletExists: false,
          registrySize: walletRegistry.size,
          timestamp: new Date().toISOString()
        }
      });

      throw logWalletError(zkError, {
        context: 'withWalletPrivateKey',
        securityCritical: true,
        operation: 'withWalletPrivateKey.checkWalletExists',
        address
      });
    }

    // Get wallet data
    const walletData = walletRegistry.get(address);

    // Check if wallet has expired
    if (Date.now() >= walletData.public.expirationTime) {
      const zkError = new TemporaryWalletError(`Wallet ${address} has expired`, {
        code: ErrorCode.SECURITY_KEY_ERROR,
        operationId,
        operation: 'withWalletPrivateKey',
        recoverable: false,
        userFixable: true,
        securityCritical: true,
        details: {
          address,
          expirationTime: walletData.public.expirationTime,
          currentTime: Date.now(),
          timeSinceExpiration: Date.now() - walletData.public.expirationTime,
          timestamp: new Date().toISOString()
        }
      });

      throw logWalletError(zkError, {
        context: 'withWalletPrivateKey',
        securityCritical: true,
        operation: 'withWalletPrivateKey.checkExpiration',
        address
      });
    }

    // Extract private key (never stored in a variable that persists after this function)
    const { privateKey } = walletData.private;

    // Log access to private key (without the actual key)
    zkErrorLogger.log('INFO', 'Controlled access to private key granted', {
      operationId,
      details: { address }
    });

    // Call callback with private key
    try {
      const result = await callback(privateKey);

      // Return result of callback
      return result;
    } catch (callbackError) {
      // This is a security-critical error because it involves private key operations
      const zkError = new TemporaryWalletError(`Operation with wallet ${address} private key failed: ${callbackError.message}`, {
        code: ErrorCode.SECURITY_KEY_ERROR,
        operationId,
        operation: 'withWalletPrivateKey.callback',
        recoverable: false,
        securityCritical: true,
        details: {
          address,
          originalError: callbackError.message,
          callbackError: callbackError.name || typeof callbackError,
          timestamp: new Date().toISOString()
        }
      });

      throw logWalletError(zkError, {
        context: 'withWalletPrivateKey.callback',
        securityCritical: true,
        address
      });
    }
  } catch (error) {
    // If it's already a ZKError, just log it and re-throw
    if (isZKError(error)) {
      throw logWalletError(error, {
        context: 'withWalletPrivateKey',
        securityCritical: true,
        address: address || 'unknown'
      });
    }

    // Otherwise wrap it in a TemporaryWalletError
    const zkError = new TemporaryWalletError(`Operation with wallet ${address} failed: ${error.message}`, {
      code: ErrorCode.SECURITY_KEY_ERROR,
      operationId,
      operation: 'withWalletPrivateKey',
      recoverable: false,
      securityCritical: true,
      details: {
        address,
        originalError: error.message,
        errorType: error.name || typeof error,
        timestamp: new Date().toISOString()
      }
    });

    throw logWalletError(zkError, {
      context: 'withWalletPrivateKey',
      securityCritical: true,
      address: address || 'unknown'
    });
  }
};

/**
 * Destroys all wallets in the registry
 * Use in emergency situations or when unloading the application
 * 
 * @returns {number} Number of wallets destroyed
 * @throws {TemporaryWalletError} If the destruction process fails
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This is our emergency "red button" function that immediately destroys all temporary
 * wallets. It's used when the application is closing, when the user logs out, or in
 * emergency situations where we need to quickly remove all sensitive data from memory.
 * Think of it as the "burn all documents" protocol in a spy movie.
 */
export const destroyAllWallets = () => {
  const operationId = `destroyAllWallets_${Date.now()}`;

  try {
    let count = 0;
    let errors = 0;

    // Get all addresses
    const addresses = Array.from(walletRegistry.keys());

    // Nothing to do if no wallets exist
    if (addresses.length === 0) {
      zkErrorLogger.log('INFO', 'No wallets to destroy', { operationId });
      return 0;
    }

    zkErrorLogger.log('INFO', 'Emergency destruction of all wallets initiated', {
      operationId,
      details: { walletCount: addresses.length }
    });

    // Destroy each wallet
    addresses.forEach(address => {
      try {
        const success = destroyWallet(address);
        if (success) {
          count++;
        }
      } catch (destroyError) {
        // Log but continue with other wallets
        logWalletError(
          new TemporaryWalletError(`Failed to destroy wallet during emergency purge: ${destroyError.message}`, {
            code: ErrorCode.SECURITY_DATA_INTEGRITY,
            operationId,
            operation: 'destroyAllWallets.iteration',
            recoverable: true,
            securityCritical: true,
            details: {
              address,
              originalError: destroyError.message,
              successfullyDestroyed: count,
              remainingWallets: addresses.length - count - errors,
              timestamp: new Date().toISOString()
            }
          }),
          {
            context: 'destroyAllWallets.iteration',
            securityCritical: true,
            address
          }
        );

        errors++;
      }
    });

    // Stop cleanup interval
    if (cleanupInterval !== null) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }

    // If we failed to destroy some wallets, that's a security concern
    if (errors > 0) {
      zkErrorLogger.log('WARNING', 'Some wallets could not be destroyed during emergency purge', {
        operationId,
        code: ErrorCode.SECURITY_DATA_INTEGRITY,
        details: {
          successfullyDestroyed: count,
          failedToDestroy: errors,
          totalAttempted: addresses.length
        }
      });
    } else {
      zkErrorLogger.log('INFO', 'All wallets successfully destroyed', {
        operationId,
        details: { walletsDestroyed: count }
      });
    }

    return count;
  } catch (error) {
    const zkError = new TemporaryWalletError(`Error in emergency wallet destruction: ${error.message}`, {
      code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
      operationId,
      operation: 'destroyAllWallets',
      recoverable: false,
      securityCritical: true,
      details: {
        originalError: error.message,
        registrySize: walletRegistry.size,
        timestamp: new Date().toISOString()
      }
    });

    throw logWalletError(zkError, {
      context: 'destroyAllWallets',
      securityCritical: true,
      registrySize: walletRegistry.size
    });
  }
};

/**
 * Default export for temporaryWalletManager module
 * Contains all functions for secure wallet management
 * 
 * @module temporaryWalletManager
 */
export default {
  createTemporaryWallet,
  destroyWallet,
  hasWallet,
  getWalletInfo,
  extendWalletLifetime,
  withWalletPrivateKey,
  destroyAllWallets
};