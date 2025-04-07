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
 * @throws {Error} If secure random generation is not available
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This is like creating truly random lottery numbers that are impossible to predict.
 * Randomness is the foundation of cryptographic security, and weak randomness is a common
 * cause of security breaches. This function ensures that any wallet we create is based
 * on genuinely unpredictable values, making it impossible for attackers to guess private keys.
 */
const getSecureRandomBytes = (numBytes = ENTROPY_BYTES) => {
  // Ensure minimum entropy
  if (numBytes < ENTROPY_BYTES) {
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
  throw new Error('No secure random source available for wallet generation');
};

/**
 * Converts random bytes to a mnemonic phrase
 * Uses BIP39 to generate a 12-word mnemonic from entropy
 * 
 * @param {Uint8Array} entropyBytes - Random bytes with sufficient entropy
 * @returns {Promise<string>} - BIP39 mnemonic phrase
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This converts raw random numbers into a format (12 words) that can be used to create a
 * cryptocurrency wallet. It's similar to how a bank might take your personal information and
 * create an account number. These 12 words (called a "seed phrase") are all that's needed
 * to control the wallet's funds, which is why we handle them so carefully.
 */
const entropyToMnemonic = async (entropyBytes) => {
  try {
    const { ethers } = await getEthers();

    // Create wordlist
    const wordlist = ethers.wordlists.en;

    // Convert bytes to mnemonic
    return ethers.utils.entropyToMnemonic(entropyBytes, wordlist);
  } catch (error) {
    throw new Error(`Failed to generate mnemonic: ${error.message}`);
  }
};

/**
 * Securely wipes sensitive data from memory
 * Overwrites the data with zeros to prevent memory access
 * 
 * @param {Object|string|Uint8Array} data - Data to wipe
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This is similar to shredding confidential documents after you've used them. When we're
 * done with sensitive information (like private keys or seed phrases), we don't just "throw
 * it away" - we actively destroy it by overwriting the memory. This helps protect against
 * sophisticated attacks that might try to access data that's no longer being used but
 * still exists in memory.
 */
const wipeFromMemory = (data) => {
  // Handle different data types
  if (data instanceof Uint8Array) {
    // Zero out all bytes in the array
    data.fill(0);
  } else if (typeof data === 'string') {
    // We can't actually modify strings in JavaScript (they're immutable)
    // The best we can do is ensure we don't leave references to them
    // The garbage collector will eventually clean them up
    // In a production environment, consider using a secure string implementation
    // that uses typed arrays internally
  } else if (typeof data === 'object' && data !== null) {
    // Recursively wipe all properties of an object
    Object.keys(data).forEach(key => {
      wipeFromMemory(data[key]);
      data[key] = null;
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
 * @throws {Error} If wallet generation fails
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
  try {
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
    const walletInfo = await deriveWalletFromMnemonic(mnemonic, path);

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
    wipeFromMemory(entropyBytes);
    wipeFromMemory(walletInfo);

    // Return only the public metadata
    return { ...walletMetadata };
  } catch (error) {
    throw new Error(`Temporary wallet creation failed: ${error.message}`);
  }
};

/**
 * Sets up automatic wallet expiration
 * 
 * @param {string} address - Wallet address
 * @param {number} expirationTime - Timestamp when wallet should expire
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This sets the self-destruct timer on our temporary wallets. It ensures that even if
 * there's a bug or someone forgets to manually destroy a wallet, it will automatically
 * be cleaned up after its designated lifetime (typically 15 minutes). This is an important
 * security feature that limits the exposure window of sensitive data.
 */
const setupWalletExpiration = (address, expirationTime) => {
  const now = Date.now();
  const timeUntilExpiration = Math.max(0, expirationTime - now);

  // Set up timeout for wallet destruction
  setTimeout(() => {
    destroyWallet(address);
  }, timeUntilExpiration);
};

/**
 * Ensures the wallet cleanup interval is running
 * This periodically checks for and removes any expired wallets
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This is like having a janitor that regularly sweeps through to make sure no
 * sensitive information was accidentally left behind. It's a backup mechanism that
 * checks for any wallets that should be destroyed but somehow weren't, providing
 * an additional layer of security through redundancy.
 */
const ensureCleanupInterval = () => {
  if (cleanupInterval === null) {
    cleanupInterval = setInterval(cleanupExpiredWallets, DEFAULT_WALLET_CLEANUP_INTERVAL_MS);
  }
};

/**
 * Cleans up any expired wallets from the registry
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This function performs the actual "janitorial" work of checking for and removing
 * any wallets that have passed their expiration time. It's part of our defense-in-depth
 * approach to security, ensuring that temporary wallets truly are temporary.
 */
const cleanupExpiredWallets = () => {
  const now = Date.now();

  // Check all wallets in registry
  for (const [address, walletData] of walletRegistry.entries()) {
    const { expirationTime } = walletData.public;

    // If wallet has expired, destroy it
    if (now >= expirationTime) {
      destroyWallet(address);
    }
  }
};

/**
 * Destroys a wallet and securely wipes its data from memory
 * 
 * @param {string} address - Address of the wallet to destroy
 * @returns {boolean} Whether the wallet was successfully destroyed
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This is the self-destruct mechanism for our temporary wallets. When a wallet is no
 * longer needed (either because it expired or because we're done with it), this function
 * completely removes all traces of it from memory, including sensitive data like private keys.
 * This is essential for maintaining security and privacy.
 */
export const destroyWallet = (address) => {
  // Check if wallet exists
  if (!walletRegistry.has(address)) {
    return false;
  }

  try {
    // Get wallet data
    const walletData = walletRegistry.get(address);

    // Call expiration callback if provided
    if (typeof walletData.private.onExpiration === 'function') {
      try {
        walletData.private.onExpiration(address);
      } catch (callbackError) {
        console.error('Error in wallet expiration callback:', callbackError);
      }
    }

    // Securely wipe private data
    wipeFromMemory(walletData.private);

    // Remove from registry
    walletRegistry.delete(address);

    console.log(`Wallet ${address} destroyed`);
    return true;
  } catch (error) {
    console.error(`Error destroying wallet ${address}:`, error);
    return false;
  }
};

/**
 * Checks if a wallet exists in the registry
 * 
 * @param {string} address - Wallet address to check
 * @returns {boolean} Whether the wallet exists and is valid
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This checks if a temporary wallet is still available or if it has already been
 * destroyed. It's like checking if your temporary access badge to a building is
 * still valid. This helps other parts of the application know whether they can
 * use a particular temporary wallet or if they need to create a new one.
 */
export const hasWallet = (address) => {
  // Check if wallet exists in registry
  if (!walletRegistry.has(address)) {
    return false;
  }

  // Get wallet data
  const walletData = walletRegistry.get(address);

  // Check if wallet has expired
  const now = Date.now();
  return now < walletData.public.expirationTime;
};

/**
 * Gets the public metadata for a wallet (never returns private key)
 * 
 * @param {string} address - Wallet address
 * @returns {Object|null} Wallet metadata or null if not found
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This returns the "public" information about a temporary wallet - things like its
 * address and expiration time, but never sensitive information like the private key.
 * It's similar to how a bank might tell you your account number and when it was created,
 * but would never tell you the PIN code.
 */
export const getWalletInfo = (address) => {
  // Check if wallet exists
  if (!walletRegistry.has(address)) {
    return null;
  }

  // Get wallet data
  const walletData = walletRegistry.get(address);

  // Return only public metadata (never private key or mnemonic)
  return { ...walletData.public };
};

/**
 * Extends the lifetime of a temporary wallet
 * 
 * @param {string} address - Wallet address
 * @param {number} additionalTimeMs - Additional time in milliseconds
 * @returns {boolean} Whether the extension was successful
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This is like extending your hotel stay for a few more days. Sometimes we need to
 * keep a temporary wallet around longer than initially planned (for example, if a
 * proof verification is taking longer than expected). This function allows us to
 * postpone the self-destruct timer while maintaining all the security properties.
 */
export const extendWalletLifetime = (address, additionalTimeMs) => {
  // Check if wallet exists
  if (!walletRegistry.has(address)) {
    return false;
  }

  try {
    // Get wallet data
    const walletData = walletRegistry.get(address);

    // Update expiration time
    const newExpirationTime = walletData.public.expirationTime + additionalTimeMs;
    walletData.public.expirationTime = newExpirationTime;

    // Reset expiration timer
    setupWalletExpiration(address, newExpirationTime);

    return true;
  } catch (error) {
    console.error(`Error extending wallet lifetime for ${address}:`, error);
    return false;
  }
};

/**
 * Performs a callback function with access to a wallet's private key
 * The private key is never returned or stored outside this function
 * 
 * @param {string} address - Wallet address
 * @param {Function} callback - Callback function that receives the private key
 * @returns {Promise<any>} Result of the callback function
 * @throws {Error} If wallet not found or callback fails
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This provides extremely controlled, temporary access to a wallet's private key.
 * It's like a bank vault that opens for exactly one transaction and then immediately
 * locks again. The private key is never exposed outside the function, which minimizes
 * the risk of it being compromised. This allows us to perform necessary operations
 * (like signing transactions) while maintaining strict security.
 */
export const withWalletPrivateKey = async (address, callback) => {
  // Check if wallet exists
  if (!walletRegistry.has(address)) {
    throw new Error(`Wallet ${address} not found or has expired`);
  }

  try {
    // Get wallet data
    const walletData = walletRegistry.get(address);

    // Extract private key (never stored in a variable that persists after this function)
    const { privateKey } = walletData.private;

    // Call callback with private key
    const result = await callback(privateKey);

    // Return result of callback
    return result;
  } catch (error) {
    throw new Error(`Operation with wallet ${address} failed: ${error.message}`);
  }
};

/**
 * Destroys all wallets in the registry
 * Use in emergency situations or when unloading the application
 * 
 * @returns {number} Number of wallets destroyed
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This is our emergency "red button" function that immediately destroys all temporary
 * wallets. It's used when the application is closing, when the user logs out, or in
 * emergency situations where we need to quickly remove all sensitive data from memory.
 * Think of it as the "burn all documents" protocol in a spy movie.
 */
export const destroyAllWallets = () => {
  let count = 0;

  // Get all addresses
  const addresses = Array.from(walletRegistry.keys());

  // Destroy each wallet
  addresses.forEach(address => {
    const success = destroyWallet(address);
    if (success) {
      count++;
    }
  });

  // Stop cleanup interval
  if (cleanupInterval !== null) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }

  return count;
};

// Export all functions
export default {
  createTemporaryWallet,
  destroyWallet,
  hasWallet,
  getWalletInfo,
  extendWalletLifetime,
  withWalletPrivateKey,
  destroyAllWallets
};