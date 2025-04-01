/**
 * Temporary Wallet Manager
 * 
 * Manages temporary wallet generation, tracking, and lifecycle for
 * secure proof generation without exposing primary wallet addresses.
 * 
 * Uses BIP44 derivation to create deterministic wallets from a master seed.
 */

import { ethers } from 'ethers';
import { createTemporaryWallet } from './zkProofGenerator';

// Store temporary wallets in memory for the current session
const sessionWallets = new Map();

/**
 * Generates a master seed for temporary wallet creation
 * 
 * @returns {Promise<string>} - A master seed for wallet derivation
 */
export async function generateMasterSeed() {
  // Create a random mnemonic - in a production system this would be
  // stored securely in a database or HSM
  const wallet = ethers.Wallet.createRandom();
  return wallet.mnemonic.phrase;
}

/**
 * Creates a temporary wallet for a specific purpose
 * 
 * @param {string} masterSeed - The master seed for derivation
 * @param {string} purposeId - A unique ID for the wallet's purpose
 * @param {string} metadata - Additional metadata about the wallet's purpose
 * @returns {Promise<Object>} - Temporary wallet information
 */
export async function createTemporaryWalletForPurpose(masterSeed, purposeId, metadata = {}) {
  try {
    // Create a unique purpose string that combines the purpose ID and metadata
    const purpose = `${purposeId}-${JSON.stringify(metadata)}`;

    // Check if we already have a wallet for this purpose
    const existingWallet = sessionWallets.get(purpose);
    if (existingWallet) {
      console.log('Using existing temporary wallet for purpose:', purpose);
      return existingWallet;
    }

    // Create the temporary wallet
    const wallet = await createTemporaryWallet(masterSeed, purpose);

    // Add creation timestamp and metadata
    const walletInfo = {
      ...wallet,
      createdAt: Date.now(),
      metadata,
      status: 'active'
    };

    // Store in session for reuse
    sessionWallets.set(purpose, walletInfo);

    console.log(`Created temporary wallet ${wallet.address} for purpose: ${purpose}`);
    return walletInfo;
  } catch (error) {
    console.error('Error creating temporary wallet:', error);
    throw error;
  }
}

/**
 * Retrieves a temporary wallet by purpose
 * 
 * @param {string} purposeId - The purpose ID used when creating the wallet
 * @param {Object} metadata - The metadata used when creating the wallet
 * @returns {Object|null} - The wallet information or null if not found
 */
export function getTemporaryWalletByPurpose(purposeId, metadata = {}) {
  const purpose = `${purposeId}-${JSON.stringify(metadata)}`;
  return sessionWallets.get(purpose) || null;
}

/**
 * Archives a temporary wallet after its purpose has been fulfilled
 * 
 * @param {string} purposeId - The purpose ID of the wallet to archive
 * @param {Object} metadata - The metadata of the wallet to archive
 * @returns {boolean} - Whether the archiving was successful
 */
export function archiveTemporaryWallet(purposeId, metadata = {}) {
  try {
    const purpose = `${purposeId}-${JSON.stringify(metadata)}`;
    const wallet = sessionWallets.get(purpose);

    if (!wallet) {
      console.warn(`No temporary wallet found for purpose: ${purpose}`);
      return false;
    }

    // Update wallet status
    wallet.status = 'archived';
    wallet.archivedAt = Date.now();

    // Update in our storage
    sessionWallets.set(purpose, wallet);

    console.log(`Archived temporary wallet ${wallet.address} for purpose: ${purpose}`);
    return true;
  } catch (error) {
    console.error('Error archiving temporary wallet:', error);
    return false;
  }
}

/**
 * Gets all temporary wallets for the current session
 * 
 * @param {string} status - Optional filter for wallet status
 * @returns {Array<Object>} - Array of wallet information objects
 */
export function getAllTemporaryWallets(status = null) {
  const wallets = Array.from(sessionWallets.values());

  // Filter by status if provided
  if (status) {
    return wallets.filter(wallet => wallet.status === status);
  }

  return wallets;
}

/**
 * Derives the same temporary wallet from a seed phrase and purpose
 * This is useful for reconstructing a wallet when only the seed phrase and purpose are known
 * 
 * @param {string} seedPhrase - The BIP39 seed phrase
 * @param {string} purposeId - The purpose identifier
 * @param {Object} metadata - Additional metadata about the wallet's purpose
 * @returns {Promise<Object>} - The regenerated wallet
 */
export async function deriveTemporaryWallet(seedPhrase, purposeId, metadata = {}) {
  try {
    // Create the purpose string in the same way as when creating
    const purpose = `${purposeId}-${JSON.stringify(metadata)}`;

    // First check if we have this wallet in our session cache
    const existingWallet = sessionWallets.get(purpose);
    if (existingWallet) {
      return existingWallet;
    }

    // Convert seed phrase to seed
    const masterSeed = ethers.utils.mnemonicToSeed(seedPhrase);
    const seedHex = '0x' + Buffer.from(masterSeed).toString('hex');

    // Recreate the wallet
    const wallet = await createTemporaryWallet(seedHex, purpose);

    // Add to session cache
    const walletInfo = {
      ...wallet,
      createdAt: Date.now(),
      metadata,
      status: 'restored', // Mark as restored instead of active
      restoredAt: Date.now()
    };

    sessionWallets.set(purpose, walletInfo);

    console.log(`Derived temporary wallet ${wallet.address} from seed and purpose: ${purpose}`);
    return walletInfo;
  } catch (error) {
    console.error('Error deriving temporary wallet:', error);
    throw error;
  }
}

/**
 * Cleans up old temporary wallets to prevent memory leaks
 * This should be called periodically in long-running applications
 * 
 * @param {number} maxAgeMs - Maximum age in milliseconds before a wallet is removed
 * @returns {number} - Number of wallets cleared
 */
export function cleanupOldTemporaryWallets(maxAgeMs = 24 * 60 * 60 * 1000) {
  const now = Date.now();
  let count = 0;

  for (const [purpose, wallet] of sessionWallets.entries()) {
    // Keep active wallets regardless of age
    if (wallet.status === 'active') {
      continue;
    }

    // Remove old archived/restored wallets
    const creationTime = wallet.createdAt || 0;
    if (now - creationTime > maxAgeMs) {
      sessionWallets.delete(purpose);
      count++;
    }
  }

  if (count > 0) {
    console.log(`Cleared ${count} old temporary wallets`);
  }

  return count;
}