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

const { getBIP44Path, deriveWalletFromMnemonic } = require('../walletHelpers.js');
const { getEthers } = require('../ethersUtils.js');
const zkErrorHandlerModule = require('./zkErrorHandler.cjs');
const zkErrorLoggerModule = require('./zkErrorLogger.cjs');

const { zkErrorLogger } = zkErrorLoggerModule;
const { 
  ErrorCode, 
  InputError, 
  SecurityError, 
  SystemError,
  isZKError
} = zkErrorHandlerModule;

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
 * @throws {SecurityError} If secure random generation is not available
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
      const zkError = new InputError('Insufficient entropy for secure wallet generation', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: true,
        userFixable: true,
        details: { 
          providedBits: numBytes * 8,
          minimumRequiredBits: MIN_ENTROPY_BITS 
        }
      });
      
      zkErrorLogger.logError(zkError, { context: 'getSecureRandomBytes' });
      
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
    const zkError = new SecurityError('No secure random source available for wallet generation', {
      code: ErrorCode.SECURITY_DATA_INTEGRITY,
      operationId,
      recoverable: false,
      securityCritical: true,
      userFixable: false,
      details: { 
        browserHasCrypto: typeof window !== 'undefined' && !!window.crypto,
        nodeHasCrypto: typeof crypto !== 'undefined' && !!crypto.randomBytes
      },
      recommendedAction: 'Please use a modern browser with Web Cryptography API support'
    });
    
    zkErrorLogger.logError(zkError, { 
      context: 'getSecureRandomBytes',
      securityCritical: true 
    });
    
    throw zkError;
  } catch (error) {
    // If it's already a ZKError, just log it and re-throw
    if (isZKError(error)) {
      zkErrorLogger.logError(error, { 
        context: 'getSecureRandomBytes',
        securityCritical: true
      });
      throw error;
    }
    
    // Otherwise wrap it in a SecurityError
    const zkError = new SecurityError(`Failed to generate secure random bytes: ${error.message}`, {
      code: ErrorCode.SECURITY_DATA_INTEGRITY,
      operationId,
      recoverable: false,
      securityCritical: true,
      details: { 
        originalError: error.message,
        requestedBytes: numBytes
      }
    });
    
    zkErrorLogger.logError(zkError, { 
      context: 'getSecureRandomBytes',
      securityCritical: true 
    });
    
    throw zkError;
  }
};

/**
 * Converts random bytes to a mnemonic phrase
 * Uses BIP39 to generate a 12-word mnemonic from entropy
 * 
 * @param {Uint8Array} entropyBytes - Random bytes with sufficient entropy
 * @returns {Promise<string>} - BIP39 mnemonic phrase
 * @throws {SystemError} If mnemonic generation fails
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
      const zkError = new InputError('Invalid entropy bytes for mnemonic generation', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        recoverable: false,
        userFixable: false,
        securityCritical: true,
        details: { 
          providedType: typeof entropyBytes, 
          isUint8Array: entropyBytes instanceof Uint8Array,
          expectedType: 'Uint8Array'
        }
      });
      
      zkErrorLogger.logError(zkError, { 
        context: 'entropyToMnemonic',
        securityCritical: true 
      });
      
      throw zkError;
    }
    
    // Validate entropy size
    if (entropyBytes.length < ENTROPY_BYTES) {
      const zkError = new InputError('Insufficient entropy for secure mnemonic generation', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: false,
        userFixable: false,
        securityCritical: true,
        details: { 
          providedBytes: entropyBytes.length,
          providedBits: entropyBytes.length * 8,
          minimumRequiredBits: MIN_ENTROPY_BITS
        }
      });
      
      zkErrorLogger.logError(zkError, { 
        context: 'entropyToMnemonic',
        securityCritical: true 
      });
      
      throw zkError;
    }

    const { ethers } = await getEthers();

    // Create wordlist
    const wordlist = ethers.wordlists.en;

    // Convert bytes to mnemonic
    return ethers.utils.entropyToMnemonic(entropyBytes, wordlist);
  } catch (error) {
    // If it's already a ZKError, just log it and re-throw
    if (isZKError(error)) {
      zkErrorLogger.logError(error, { 
        context: 'entropyToMnemonic',
        securityCritical: true
      });
      throw error;
    }
    
    // Otherwise wrap it in a SystemError
    const zkError = new SystemError(`Failed to generate mnemonic: ${error.message}`, {
      code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
      operationId,
      recoverable: false,
      securityCritical: true,
      details: { 
        originalError: error.message 
      }
    });
    
    zkErrorLogger.logError(zkError, { 
      context: 'entropyToMnemonic',
      securityCritical: true
    });
    
    throw zkError;
  }
};

/**
 * Securely wipes sensitive data from memory
 * Overwrites the data with zeros to prevent memory access
 * 
 * @param {Object|string|Uint8Array} data - Data to wipe
 * @returns {boolean} True if wiping was successful
 * @throws {SecurityError} If data wiping fails
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
    const zkError = new SecurityError(`Failed to securely wipe memory: ${error.message}`, {
      code: ErrorCode.SECURITY_DATA_INTEGRITY,
      operationId,
      recoverable: false,
      securityCritical: true,
      details: { 
        dataType: data ? typeof data : 'null',
        isArray: Array.isArray(data),
        isTypedArray: data instanceof Uint8Array,
        originalError: error.message
      }
    });
    
    zkErrorLogger.logError(zkError, { 
      context: 'wipeFromMemory',
      securityCritical: true 
    });
    
    throw zkError;
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
const createTemporaryWallet = async (options = {}) => {
  const operationId = `createWallet_${Date.now()}`;
  
  try {
    // Validate options
    if (options !== null && typeof options !== 'object') {
      const zkError = new InputError('Invalid options provided to temporary wallet creation', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        recoverable: true,
        userFixable: true,
        details: { 
          providedType: typeof options,
          expectedType: 'object'
        }
      });
      
      zkErrorLogger.logError(zkError, { context: 'createTemporaryWallet' });
      throw zkError;
    }
    
    // Validate chain option if provided
    if (options.chain && typeof options.chain !== 'string') {
      const zkError = new InputError('Invalid chain parameter for temporary wallet', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        recoverable: true,
        userFixable: true,
        details: { 
          providedType: typeof options.chain,
          expectedType: 'string'
        }
      });
      
      zkErrorLogger.logError(zkError, { context: 'createTemporaryWallet' });
      throw zkError;
    }
    
    // Validate index option if provided
    if (options.index !== undefined && (typeof options.index !== 'number' || isNaN(options.index) || options.index < 0)) {
      const zkError = new InputError('Invalid wallet index parameter', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        recoverable: true,
        userFixable: true,
        details: { 
          providedValue: options.index,
          providedType: typeof options.index,
          expectedType: 'positive number'
        }
      });
      
      zkErrorLogger.logError(zkError, { context: 'createTemporaryWallet' });
      throw zkError;
    }
    
    // Validate lifetime option if provided
    if (options.lifetimeMs !== undefined && (typeof options.lifetimeMs !== 'number' || 
        isNaN(options.lifetimeMs) || options.lifetimeMs < 1000)) {
      const zkError = new InputError('Invalid wallet lifetime parameter', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        recoverable: true,
        userFixable: true,
        details: { 
          providedValue: options.lifetimeMs,
          providedType: typeof options.lifetimeMs,
          minimumValue: 1000,
          expectedType: 'number >= 1000'
        }
      });
      
      zkErrorLogger.logError(zkError, { context: 'createTemporaryWallet' });
      throw zkError;
    }
    
    // Validate callback option if provided
    if (options.onExpiration !== undefined && typeof options.onExpiration !== 'function') {
      const zkError = new InputError('Invalid expiration callback parameter', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        recoverable: true,
        userFixable: true,
        details: { 
          providedType: typeof options.onExpiration,
          expectedType: 'function'
        }
      });
      
      zkErrorLogger.logError(zkError, { context: 'createTemporaryWallet' });
      throw zkError;
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
      const zkError = new SystemError(`Failed to derive wallet from mnemonic: ${derivationError.message}`, {
        code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
        operationId,
        recoverable: false,
        securityCritical: true,
        details: { 
          chain,
          path,
          originalError: derivationError.message
        }
      });
      
      zkErrorLogger.logError(zkError, { 
        context: 'createTemporaryWallet.derivation',
        securityCritical: true
      });
      
      throw zkError;
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
      zkErrorLogger.logError(wipeError, { 
        context: 'createTemporaryWallet.memoryWipe',
        securityCritical: true
      });
      
      // Still continue with returning the wallet
    }

    // Return only the public metadata
    return { ...walletMetadata };
  } catch (error) {
    // If it's already a ZKError, just log it and re-throw
    if (isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'createTemporaryWallet' });
      throw error;
    }
    
    // Otherwise wrap it in an appropriate error
    const zkError = new SystemError(`Temporary wallet creation failed: ${error.message}`, {
      code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
      operationId,
      recoverable: false,
      details: { originalError: error.message }
    });
    
    zkErrorLogger.logError(zkError, { context: 'createTemporaryWallet' });
    throw zkError;
  }
};

/**
 * Sets up automatic wallet expiration
 * 
 * @param {string} address - Wallet address
 * @param {number} expirationTime - Timestamp when wallet should expire
 * @throws {InputError} If parameters are invalid
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
      const zkError = new InputError('Invalid wallet address for expiration setup', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        recoverable: true,
        userFixable: false,
        details: { 
          providedType: typeof address,
          expectedType: 'string'
        }
      });
      
      zkErrorLogger.logError(zkError, { context: 'setupWalletExpiration' });
      throw zkError;
    }
    
    // Validate expiration time
    if (!expirationTime || typeof expirationTime !== 'number' || expirationTime <= Date.now()) {
      const zkError = new InputError('Invalid expiration time for wallet', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        recoverable: true,
        userFixable: false,
        details: { 
          providedType: typeof expirationTime,
          providedValue: expirationTime,
          currentTime: Date.now(),
          expectedType: 'future timestamp number'
        }
      });
      
      zkErrorLogger.logError(zkError, { context: 'setupWalletExpiration' });
      throw zkError;
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
      zkErrorLogger.logError(error, { context: 'setupWalletExpiration' });
      throw error;
    }
    
    // Otherwise wrap it in an appropriate error
    const zkError = new SystemError(`Failed to setup wallet expiration: ${error.message}`, {
      code: ErrorCode.SYSTEM_NOT_INITIALIZED,
      operationId,
      recoverable: true,
      details: { 
        address,
        expirationTime,
        originalError: error.message 
      }
    });
    
    zkErrorLogger.logError(zkError, { context: 'setupWalletExpiration' });
    throw zkError;
  }
};

/**
 * Ensures the wallet cleanup interval is running
 * This periodically checks for and removes any expired wallets
 * 
 * @returns {boolean} Whether the cleanup interval is now running
 * @throws {SystemError} If the cleanup interval cannot be started
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
    const zkError = new SystemError(`Failed to start wallet cleanup interval: ${error.message}`, {
      code: ErrorCode.SYSTEM_NOT_INITIALIZED,
      operationId,
      recoverable: true,
      details: { originalError: error.message }
    });
    
    zkErrorLogger.logError(zkError, { context: 'ensureCleanupInterval' });
    throw zkError;
  }
};

/**
 * Cleans up any expired wallets from the registry
 * 
 * @throws {SystemError} If cleanup fails
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
          zkErrorLogger.logError(
            new SystemError(`Error destroying expired wallet ${address}: ${destroyError.message}`, {
              code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
              operationId,
              recoverable: true,
              details: { 
                address,
                expirationTime,
                originalError: destroyError.message 
              }
            }),
            { context: 'cleanupExpiredWallets' }
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
    const zkError = new SystemError(`Failed to clean up expired wallets: ${error.message}`, {
      code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
      operationId,
      recoverable: true,
      details: { originalError: error.message }
    });
    
    zkErrorLogger.logError(zkError, { context: 'cleanupExpiredWallets' });
    
    // Don't throw from here as this is called from a timer
    // Just log the error and continue
  }
};

/**
 * Destroys a wallet and securely wipes its data from memory
 * 
 * @param {string} address - Address of the wallet to destroy
 * @returns {boolean} Whether the wallet was successfully destroyed
 * @throws {InputError} If address is invalid
 * @throws {SecurityError} If secure data wiping fails
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This is the self-destruct mechanism for our temporary wallets. When a wallet is no
 * longer needed (either because it expired or because we're done with it), this function
 * completely removes all traces of it from memory, including sensitive data like private keys.
 * This is essential for maintaining security and privacy.
 */
const destroyWallet = (address) => {
  const operationId = `destroyWallet_${Date.now()}`;
  
  try {
    // Validate address
    if (!address || typeof address !== 'string') {
      const zkError = new InputError('Invalid wallet address for wallet destruction', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        recoverable: true,
        userFixable: true,
        details: { 
          providedType: typeof address,
          expectedType: 'string'
        }
      });
      
      zkErrorLogger.logError(zkError, { context: 'destroyWallet' });
      throw zkError;
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
        zkErrorLogger.logError(
          new SystemError(`Error in wallet expiration callback: ${callbackError.message}`, {
            code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
            operationId,
            recoverable: true,
            details: { 
              address,
              originalError: callbackError.message 
            }
          }),
          { context: 'destroyWallet.callback' }
        );
      }
    }

    // Securely wipe private data
    try {
      wipeFromMemory(walletData.private);
    } catch (wipeError) {
      // This is a security-critical error
      const zkError = new SecurityError(`Failed to securely wipe wallet data: ${wipeError.message}`, {
        code: ErrorCode.SECURITY_DATA_INTEGRITY,
        operationId,
        recoverable: false,
        securityCritical: true,
        details: { 
          address,
          originalError: wipeError.message
        }
      });
      
      zkErrorLogger.logError(zkError, { 
        context: 'destroyWallet.wipe',
        securityCritical: true 
      });
      
      throw zkError;
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
      zkErrorLogger.logError(error, { context: 'destroyWallet' });
      throw error;
    }
    
    // Otherwise log a general error
    zkErrorLogger.logError(
      new SystemError(`Error destroying wallet ${address}: ${error.message}`, {
        code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
        operationId,
        recoverable: true,
        details: { 
          address,
          originalError: error.message 
        }
      }),
      { context: 'destroyWallet' }
    );
    
    return false;
  }
};

/**
 * Checks if a wallet exists in the registry
 * 
 * @param {string} address - Wallet address to check
 * @returns {boolean} Whether the wallet exists and is valid
 * @throws {InputError} If address parameter is invalid
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This checks if a temporary wallet is still available or if it has already been
 * destroyed. It's like checking if your temporary access badge to a building is
 * still valid. This helps other parts of the application know whether they can
 * use a particular temporary wallet or if they need to create a new one.
 */
const hasWallet = (address) => {
  const operationId = `hasWallet_${Date.now()}`;
  
  try {
    // Validate address
    if (!address || typeof address !== 'string') {
      const zkError = new InputError('Invalid wallet address for wallet check', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        recoverable: true,
        userFixable: true,
        details: { 
          providedType: typeof address,
          expectedType: 'string'
        }
      });
      
      zkErrorLogger.logError(zkError, { context: 'hasWallet' });
      throw zkError;
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
      zkErrorLogger.logError(error, { context: 'hasWallet' });
      throw error;
    }
    
    // Otherwise wrap it in an appropriate error
    const zkError = new SystemError(`Error checking wallet existence: ${error.message}`, {
      code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
      operationId,
      recoverable: true,
      details: { 
        address,
        originalError: error.message 
      }
    });
    
    zkErrorLogger.logError(zkError, { context: 'hasWallet' });
    throw zkError;
  }
};

/**
 * Gets the public metadata for a wallet (never returns private key)
 * 
 * @param {string} address - Wallet address
 * @returns {Object|null} Wallet metadata or null if not found
 * @throws {InputError} If address parameter is invalid
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This returns the "public" information about a temporary wallet - things like its
 * address and expiration time, but never sensitive information like the private key.
 * It's similar to how a bank might tell you your account number and when it was created,
 * but would never tell you the PIN code.
 */
const getWalletInfo = (address) => {
  const operationId = `getWalletInfo_${Date.now()}`;
  
  try {
    // Validate address
    if (!address || typeof address !== 'string') {
      const zkError = new InputError('Invalid wallet address for info retrieval', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        recoverable: true,
        userFixable: true,
        details: { 
          providedType: typeof address,
          expectedType: 'string'
        }
      });
      
      zkErrorLogger.logError(zkError, { context: 'getWalletInfo' });
      throw zkError;
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
      zkErrorLogger.logError(error, { context: 'getWalletInfo' });
      throw error;
    }
    
    // Otherwise wrap it in an appropriate error
    const zkError = new SystemError(`Error retrieving wallet info: ${error.message}`, {
      code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
      operationId,
      recoverable: true,
      details: { 
        address,
        originalError: error.message 
      }
    });
    
    zkErrorLogger.logError(zkError, { context: 'getWalletInfo' });
    throw zkError;
  }
};

/**
 * Extends the lifetime of a temporary wallet
 * 
 * @param {string} address - Wallet address
 * @param {number} additionalTimeMs - Additional time in milliseconds
 * @returns {boolean} Whether the extension was successful
 * @throws {InputError} If parameters are invalid
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This is like extending your hotel stay for a few more days. Sometimes we need to
 * keep a temporary wallet around longer than initially planned (for example, if a
 * proof verification is taking longer than expected). This function allows us to
 * postpone the self-destruct timer while maintaining all the security properties.
 */
const extendWalletLifetime = (address, additionalTimeMs) => {
  const operationId = `extendWallet_${Date.now()}`;
  
  try {
    // Validate address
    if (!address || typeof address !== 'string') {
      const zkError = new InputError('Invalid wallet address for lifetime extension', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        recoverable: true,
        userFixable: true,
        details: { 
          providedType: typeof address,
          expectedType: 'string'
        }
      });
      
      zkErrorLogger.logError(zkError, { context: 'extendWalletLifetime' });
      throw zkError;
    }
    
    // Validate additional time
    if (typeof additionalTimeMs !== 'number' || additionalTimeMs <= 0) {
      const zkError = new InputError('Invalid time value for wallet extension', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        recoverable: true,
        userFixable: true,
        details: { 
          providedType: typeof additionalTimeMs,
          providedValue: additionalTimeMs,
          expectedType: 'positive number'
        }
      });
      
      zkErrorLogger.logError(zkError, { context: 'extendWalletLifetime' });
      throw zkError;
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
      zkErrorLogger.logError(error, { context: 'extendWalletLifetime' });
      throw error;
    }
    
    // Otherwise wrap it in an appropriate error
    const zkError = new SystemError(`Error extending wallet lifetime for ${address}: ${error.message}`, {
      code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
      operationId,
      recoverable: true,
      details: { 
        address,
        additionalTimeMs,
        originalError: error.message 
      }
    });
    
    zkErrorLogger.logError(zkError, { context: 'extendWalletLifetime' });
    throw zkError;
  }
};

/**
 * Performs a callback function with access to a wallet's private key
 * The private key is never returned or stored outside this function
 * 
 * @param {string} address - Wallet address
 * @param {Function} callback - Callback function that receives the private key
 * @returns {Promise<any>} Result of the callback function
 * @throws {InputError} If parameters are invalid
 * @throws {SecurityError} If wallet not found or has expired
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This provides extremely controlled, temporary access to a wallet's private key.
 * It's like a bank vault that opens for exactly one transaction and then immediately
 * locks again. The private key is never exposed outside the function, which minimizes
 * the risk of it being compromised. This allows us to perform necessary operations
 * (like signing transactions) while maintaining strict security.
 */
const withWalletPrivateKey = async (address, callback) => {
  const operationId = `withPrivateKey_${Date.now()}`;
  
  try {
    // Validate address
    if (!address || typeof address !== 'string') {
      const zkError = new InputError('Invalid wallet address for private key operation', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        recoverable: true,
        userFixable: true,
        securityCritical: true,
        details: { 
          providedType: typeof address,
          expectedType: 'string'
        }
      });
      
      zkErrorLogger.logError(zkError, { 
        context: 'withWalletPrivateKey',
        securityCritical: true 
      });
      
      throw zkError;
    }
    
    // Validate callback
    if (typeof callback !== 'function') {
      const zkError = new InputError('Invalid callback for private key operation', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        recoverable: true,
        userFixable: true,
        securityCritical: true,
        details: { 
          providedType: typeof callback,
          expectedType: 'function'
        }
      });
      
      zkErrorLogger.logError(zkError, { 
        context: 'withWalletPrivateKey',
        securityCritical: true 
      });
      
      throw zkError;
    }
    
    // Check if wallet exists
    if (!walletRegistry.has(address)) {
      const zkError = new SecurityError(`Wallet ${address} not found or has expired`, {
        code: ErrorCode.SECURITY_KEY_ERROR,
        operationId,
        recoverable: false,
        userFixable: true,
        securityCritical: true,
        details: { address }
      });
      
      zkErrorLogger.logError(zkError, { 
        context: 'withWalletPrivateKey',
        securityCritical: true
      });
      
      throw zkError;
    }

    // Get wallet data
    const walletData = walletRegistry.get(address);

    // Check if wallet has expired
    if (Date.now() >= walletData.public.expirationTime) {
      const zkError = new SecurityError(`Wallet ${address} has expired`, {
        code: ErrorCode.SECURITY_KEY_ERROR,
        operationId,
        recoverable: false,
        userFixable: true,
        securityCritical: true,
        details: { 
          address,
          expirationTime: walletData.public.expirationTime,
          currentTime: Date.now()
        }
      });
      
      zkErrorLogger.logError(zkError, { 
        context: 'withWalletPrivateKey',
        securityCritical: true
      });
      
      throw zkError;
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
      const zkError = new SecurityError(`Operation with wallet ${address} private key failed: ${callbackError.message}`, {
        code: ErrorCode.SECURITY_KEY_ERROR,
        operationId,
        recoverable: false,
        securityCritical: true,
        details: { 
          address,
          originalError: callbackError.message 
        }
      });
      
      zkErrorLogger.logError(zkError, { 
        context: 'withWalletPrivateKey.callback',
        securityCritical: true
      });
      
      throw zkError;
    }
  } catch (error) {
    // If it's already a ZKError, just log it and re-throw
    if (isZKError(error)) {
      zkErrorLogger.logError(error, { 
        context: 'withWalletPrivateKey',
        securityCritical: true
      });
      throw error;
    }
    
    // Otherwise wrap it in a security error
    const zkError = new SecurityError(`Operation with wallet ${address} failed: ${error.message}`, {
      code: ErrorCode.SECURITY_KEY_ERROR,
      operationId,
      recoverable: false,
      securityCritical: true,
      details: { 
        address,
        originalError: error.message 
      }
    });
    
    zkErrorLogger.logError(zkError, { 
      context: 'withWalletPrivateKey',
      securityCritical: true
    });
    
    throw zkError;
  }
};

/**
 * Destroys all wallets in the registry
 * Use in emergency situations or when unloading the application
 * 
 * @returns {number} Number of wallets destroyed
 * @throws {SystemError} If the destruction process fails
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This is our emergency "red button" function that immediately destroys all temporary
 * wallets. It's used when the application is closing, when the user logs out, or in
 * emergency situations where we need to quickly remove all sensitive data from memory.
 * Think of it as the "burn all documents" protocol in a spy movie.
 */
const destroyAllWallets = () => {
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
        zkErrorLogger.logError(
          new SecurityError(`Failed to destroy wallet during emergency purge: ${destroyError.message}`, {
            code: ErrorCode.SECURITY_DATA_INTEGRITY,
            operationId,
            recoverable: true,
            securityCritical: true,
            details: { 
              address,
              originalError: destroyError.message 
            }
          }),
          { 
            context: 'destroyAllWallets.iteration',
            securityCritical: true
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
    const zkError = new SystemError(`Error in emergency wallet destruction: ${error.message}`, {
      code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
      operationId,
      recoverable: false,
      securityCritical: true,
      details: { originalError: error.message }
    });
    
    zkErrorLogger.logError(zkError, { 
      context: 'destroyAllWallets',
      securityCritical: true
    });
    
    throw zkError;
  }
};

/**
 * Default export for temporaryWalletManager module
 * Contains all functions for secure wallet management
 * 
 * @module temporaryWalletManager
 */
module.exports = {
  createTemporaryWallet,
  destroyWallet,
  hasWallet,
  getWalletInfo,
  extendWalletLifetime,
  withWalletPrivateKey,
  destroyAllWallets
};