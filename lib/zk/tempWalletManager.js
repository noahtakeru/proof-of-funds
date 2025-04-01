/**
 * Temporary Wallet Manager
 * 
 * Manages temporary wallet generation, tracking, and lifecycle for
 * secure proof generation without exposing primary wallet addresses.
 * 
 * Uses BIP44 derivation to create deterministic wallets from a master seed.
 * Integrates with GCP Secret Manager for secure seed storage.
 */

import { ethers } from 'ethers';
import { createTemporaryWallet } from './zkProofGenerator';
import { getMasterSeed } from '../services/gcpSecretManager';
import { 
  generateDerivationPath, 
  deriveWalletFromMnemonic, 
  storeDerivedWallet,
  getDerivedWallet,
  listTemporaryWallets,
  archiveWallet 
} from '../walletHelpers/bip44';

// Store temporary wallets in memory for the current session
const sessionWallets = new Map();

// Minimum balance for a wallet to be considered funded (in MATIC)
const MIN_WALLET_BALANCE = 0.0005;

// Default funding amount (in MATIC)
const DEFAULT_FUNDING_AMOUNT = 0.01;

/**
 * Generates a master seed for temporary wallet creation
 * 
 * @returns {Promise<string>} - A master seed for wallet derivation
 */
export async function generateMasterSeed() {
  try {
    // Try to get master seed from GCP Secret Manager
    const seed = await getMasterSeed();
    console.log('Retrieved master seed from GCP Secret Manager');
    return seed;
  } catch (error) {
    console.warn('Failed to get master seed from GCP, using fallback method');
    
    // Fallback to creating a random mnemonic - in a production system
    // this would be stored securely in GCP Secret Manager
    const wallet = ethers.Wallet.createRandom();
    return wallet.mnemonic.phrase;
  }
}

/**
 * Creates a temporary wallet for a specific purpose
 * 
 * @param {string} masterSeed - The master seed for derivation
 * @param {string} purposeId - A unique ID for the wallet's purpose
 * @param {Object} metadata - Additional metadata about the wallet's purpose
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
    
    // Store in localStorage (without private key) using bip44 helper
    storeDerivedWallet({
      address: wallet.address,
      derivationPath: wallet.derivationPath,
      createdAt: walletInfo.createdAt
    }, purposeId, metadata.autoArchive || false);

    console.log(`Created temporary wallet ${wallet.address} for purpose: ${purpose}`);
    return walletInfo;
  } catch (error) {
    console.error('Error creating temporary wallet:', error);
    throw error;
  }
}

/**
 * Creates a wallet with a secure master seed from GCP
 * 
 * @param {string} purposeId - Purpose ID for the wallet
 * @param {boolean} autoArchive - Whether to automatically archive after use
 * @returns {Promise<Object>} - Created wallet information
 */
export async function createSecureWalletForProof(purposeId, autoArchive = true) {
  try {
    // Get master seed from GCP Secret Manager or fallback
    const masterSeed = await generateMasterSeed();
    
    // Create the wallet with the specified purpose
    return createTemporaryWalletForPurpose(masterSeed, purposeId, { autoArchive });
  } catch (error) {
    console.error('Error creating secure wallet for proof:', error);
    throw error;
  }
}

/**
 * Creates and funds a temporary wallet
 * 
 * @param {string} purposeId - Purpose of the wallet
 * @param {string} fundingAddress - Address to fund from
 * @param {boolean} waitForConfirmation - Whether to wait for tx confirmation
 * @param {boolean} autoArchive - Whether to auto-archive after use
 * @returns {Promise<Object>} - Created wallet info with transaction hash
 */
export async function createAndFundWallet(
  purposeId, 
  fundingAddress, 
  waitForConfirmation = true,
  autoArchive = true
) {
  try {
    // Create the temporary wallet
    const walletInfo = await createSecureWalletForProof(purposeId, autoArchive);
    
    // Fund the wallet
    const { txHash, balance } = await fundTemporaryWallet(
      walletInfo.address,
      fundingAddress,
      DEFAULT_FUNDING_AMOUNT,
      waitForConfirmation
    );
    
    // Return wallet info with funding details
    return {
      ...walletInfo,
      fundingTxHash: txHash,
      balance,
      funded: true
    };
  } catch (error) {
    console.error('Error creating and funding temporary wallet:', error);
    throw error;
  }
}

/**
 * Funds a temporary wallet with MATIC
 * 
 * @param {string} walletAddress - Address of the temporary wallet
 * @param {string} fundingAddress - Address to fund from
 * @param {number} amount - Amount to fund in MATIC (default: 0.01)
 * @param {boolean} waitForConfirmation - Whether to wait for confirmation
 * @returns {Promise<Object>} - Transaction hash and new balance
 */
export async function fundTemporaryWallet(
  walletAddress, 
  fundingAddress, 
  amount = DEFAULT_FUNDING_AMOUNT,
  waitForConfirmation = true
) {
  try {
    // Check if MetaMask is available
    if (!window.ethereum) {
      throw new Error('No Ethereum provider found. Please install MetaMask.');
    }
    
    // Get the provider and signer
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner(fundingAddress);
    
    // Convert MATIC amount to wei
    const amountWei = ethers.utils.parseEther(amount.toString());
    
    // Create transaction
    const tx = await signer.sendTransaction({
      to: walletAddress,
      value: amountWei
    });
    
    console.log(`Funding transaction sent: ${tx.hash}`);
    
    // Wait for confirmation if requested
    if (waitForConfirmation) {
      await tx.wait();
      console.log(`Funding transaction confirmed: ${tx.hash}`);
    }
    
    // Get updated balance
    const balance = await provider.getBalance(walletAddress);
    const balanceInMatic = ethers.utils.formatEther(balance);
    
    return {
      txHash: tx.hash,
      balance: balanceInMatic
    };
  } catch (error) {
    console.error('Error funding temporary wallet:', error);
    throw error;
  }
}

/**
 * Gets all temporary wallets with their balances
 * 
 * @returns {Promise<Array<Object>>} - Array of wallet info with balances
 */
export async function getTemporaryWalletsWithBalances() {
  try {
    // Get all active temporary wallets
    const wallets = listTemporaryWallets('active');
    
    // No Ethereum provider, return wallets without balances
    if (!window.ethereum) {
      return wallets.map(wallet => ({
        ...wallet,
        balance: null,
        hasEnoughFunds: false
      }));
    }
    
    // Get the provider
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    
    // Get balances for all wallets
    const walletsWithBalances = await Promise.all(
      wallets.map(async (wallet) => {
        try {
          const balance = await provider.getBalance(wallet.address);
          const balanceInMatic = ethers.utils.formatEther(balance);
          
          return {
            ...wallet,
            balance: balanceInMatic,
            hasEnoughFunds: parseFloat(balanceInMatic) >= MIN_WALLET_BALANCE
          };
        } catch (error) {
          console.error(`Error getting balance for ${wallet.address}:`, error);
          return {
            ...wallet,
            balance: null,
            hasEnoughFunds: false
          };
        }
      })
    );
    
    return walletsWithBalances;
  } catch (error) {
    console.error('Error getting wallets with balances:', error);
    // Return wallets without balances as fallback
    const wallets = listTemporaryWallets('active');
    return wallets.map(wallet => ({
      ...wallet,
      balance: null,
      hasEnoughFunds: false
    }));
  }
}

/**
 * Archives unused temporary wallets older than a threshold
 * 
 * @param {number} hoursThreshold - Hours since creation to consider a wallet unused
 * @returns {Promise<number>} - Number of wallets archived
 */
export async function recycleUnusedWallets(hoursThreshold = 24) {
  try {
    // Get all active temporary wallets
    const wallets = listTemporaryWallets('active');
    let count = 0;
    
    // Calculate threshold timestamp
    const thresholdTimestamp = Date.now() - (hoursThreshold * 60 * 60 * 1000);
    
    // Archive each wallet that's older than the threshold
    for (const wallet of wallets) {
      if (wallet.createdAt < thresholdTimestamp) {
        await archiveWallet(wallet.address);
        count++;
      }
    }
    
    console.log(`Recycled ${count} unused temporary wallets`);
    return count;
  } catch (error) {
    console.error('Error recycling unused wallets:', error);
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
  // First check session cache
  const purpose = `${purposeId}-${JSON.stringify(metadata)}`;
  if (sessionWallets.has(purpose)) {
    return sessionWallets.get(purpose);
  }
  
  // If not in session cache, check localStorage
  const wallets = listTemporaryWallets();
  const wallet = wallets.find(w => w.purpose === purposeId);
  
  if (wallet) {
    // Get full wallet info including private key if available
    return getDerivedWallet(wallet.address);
  }
  
  return null;
}

/**
 * Signs a message with a temporary wallet's private key
 * 
 * @param {string} purposeId - Purpose ID of the wallet
 * @param {string} message - Message to sign
 * @param {Object} metadata - Optional metadata
 * @returns {Promise<string>} - Signature
 */
export async function signWithTemporaryWallet(purposeId, message, metadata = {}) {
  try {
    // Get the wallet
    const wallet = getTemporaryWalletByPurpose(purposeId, metadata);
    
    if (!wallet) {
      throw new Error(`No temporary wallet found for purpose: ${purposeId}`);
    }
    
    if (!wallet.privateKey) {
      throw new Error(`Private key not available for wallet: ${wallet.address}`);
    }
    
    // Create wallet instance with private key
    const signingWallet = new ethers.Wallet(wallet.privateKey);
    
    // Sign the message
    const signature = await signingWallet.signMessage(message);
    
    // If wallet is set to auto-archive, archive it after use
    if (wallet.autoArchive) {
      await archiveWallet(wallet.address);
      console.log(`Auto-archived wallet ${wallet.address} after signing`);
    }
    
    return signature;
  } catch (error) {
    console.error('Error signing with temporary wallet:', error);
    throw error;
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