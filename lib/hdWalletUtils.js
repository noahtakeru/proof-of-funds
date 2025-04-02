/**
 * Hierarchical Deterministic (HD) Wallet Utilities
 * 
 * A module for creating and managing temporary HD wallets in the Proof of Funds protocol.
 * This implements BIP44 derivation for creating deterministic wallets that the system
 * controls for proof submission.
 * 
 * Key features:
 * - Generation of HD wallets using BIP44 paths
 * - Secure storage of wallet private keys
 * - Lifecycle management (creation, funding, recycling)
 * - Integration with Polygon network for proof submission
 * 
 * This module specifically handles temporary system-controlled wallets,
 * not user-connected wallets which are managed separately.
 */

import { ethers } from 'ethers';
import CryptoJS from 'crypto-js';

// Wallet states for lifecycle management
export const WALLET_STATES = {
  CREATED: 'created',    // Wallet has been created but not funded
  FUNDED: 'funded',      // Wallet has been funded and is ready for use
  IN_USE: 'in_use',      // Wallet is currently being used for a proof
  COMPLETE: 'complete',  // Wallet has completed its task and can be recycled
  RECYCLED: 'recycled'   // Wallet has been emptied and is ready for reuse
};

// Storage keys
const TEMP_WALLETS_KEY = 'pof_temp_wallets';
const HD_SEED_KEY = 'pof_hd_seed_encrypted';

/**
 * Initializes the HD wallet system
 * Ensures necessary encryption keys and data structures exist
 * @returns {Promise<boolean>} Success status
 */
export const initializeHDWalletSystem = async () => {
  try {
    // Check if we already have an HD seed
    const hasHDSeed = localStorage.getItem(HD_SEED_KEY) !== null;
    
    if (!hasHDSeed) {
      // Generate a new HD seed
      console.log('Generating new HD wallet seed...');
      const wallet = ethers.Wallet.createRandom();
      
      // Store the encrypted mnemonic
      const encryptedMnemonic = encryptData(wallet.mnemonic.phrase, getEncryptionKey());
      localStorage.setItem(HD_SEED_KEY, encryptedMnemonic);
      
      console.log('HD wallet system initialized with new seed');
    } else {
      console.log('HD wallet system already initialized');
    }
    
    // Initialize temporary wallets array if it doesn't exist
    if (localStorage.getItem(TEMP_WALLETS_KEY) === null) {
      localStorage.setItem(TEMP_WALLETS_KEY, JSON.stringify([]));
    }
    
    return true;
  } catch (error) {
    console.error('Failed to initialize HD wallet system:', error);
    return false;
  }
};

/**
 * Creates a new temporary wallet using BIP44 derivation
 * @param {Object} options Configuration options
 * @param {number} options.index Derivation index (defaults to next available)
 * @param {string} options.chain Chain ID or name ('polygon', 'ethereum', etc.)
 * @param {string} options.purpose Purpose of the wallet
 * @returns {Promise<Object>} Created wallet information
 */
export const createTemporaryWallet = async (options = {}) => {
  try {
    // Ensure system is initialized
    await initializeHDWalletSystem();
    
    // Get HD wallet from seed
    const hdWallet = await getHDWalletFromSeed();
    
    // Determine index to use
    const index = options.index !== undefined ? options.index : getNextWalletIndex();
    
    // Configure for chain
    const chain = options.chain || 'polygon';
    const chainId = getChainId(chain);
    
    // Define path based on chain - use BIP44
    // m / purpose' / coin_type' / account' / change / address_index
    const path = `m/44'/${chainId}'/0'/0/${index}`;
    
    // Derive the wallet at this path
    const derivedWallet = hdWallet.derivePath(path);
    
    // Create wallet data structure
    const walletData = {
      id: `temp_${chain}_${index}`,
      address: derivedWallet.address,
      chain: chain,
      chainId: chainId,
      derivationPath: path,
      derivationIndex: index,
      encryptedPrivateKey: encryptData(derivedWallet.privateKey, getEncryptionKey()),
      createdAt: Date.now(),
      status: WALLET_STATES.CREATED,
      purpose: options.purpose || 'zk_proof',
      balance: '0',
      transactions: []
    };
    
    // Save to storage
    saveTemporaryWallet(walletData);
    
    // Return wallet information (without private key)
    return {
      id: walletData.id,
      address: walletData.address,
      chain: walletData.chain,
      status: walletData.status,
      createdAt: walletData.createdAt
    };
  } catch (error) {
    console.error('Failed to create temporary wallet:', error);
    throw new Error(`Temporary wallet creation failed: ${error.message}`);
  }
};

/**
 * Funds a temporary wallet with MATIC
 * @param {string} walletId ID of the temporary wallet to fund
 * @param {string} amount Amount of MATIC to send
 * @param {Object} provider Ethers provider to use
 * @returns {Promise<Object>} Transaction receipt
 */
export const fundTemporaryWallet = async (walletId, amount, provider) => {
  try {
    // Get wallet data
    const wallet = getTemporaryWallet(walletId);
    if (!wallet) {
      throw new Error(`Temporary wallet not found: ${walletId}`);
    }
    
    // Check if wallet is already funded
    if (wallet.status === WALLET_STATES.FUNDED || wallet.status === WALLET_STATES.IN_USE) {
      console.log(`Wallet ${walletId} is already funded`);
      return { alreadyFunded: true };
    }
    
    // Create service wallet from environment variable
    const serviceWalletPrivateKey = process.env.SERVICE_WALLET_PRIVATE_KEY;
    if (!serviceWalletPrivateKey) {
      throw new Error('Service wallet private key not configured');
    }
    
    // Create service wallet with provider
    const serviceWallet = new ethers.Wallet(serviceWalletPrivateKey, provider);
    
    // Send transaction
    const tx = await serviceWallet.sendTransaction({
      to: wallet.address,
      value: ethers.utils.parseEther(amount)
    });
    
    // Wait for confirmation
    const receipt = await tx.wait();
    
    // Update wallet status
    updateTemporaryWallet(walletId, {
      status: WALLET_STATES.FUNDED,
      balance: amount,
      transactions: [...(wallet.transactions || []), {
        type: 'funding',
        txHash: receipt.transactionHash,
        amount: amount,
        timestamp: Date.now()
      }]
    });
    
    return receipt;
  } catch (error) {
    console.error('Failed to fund temporary wallet:', error);
    throw new Error(`Wallet funding failed: ${error.message}`);
  }
};

/**
 * Gets a temporary wallet by ID or address
 * @param {string} idOrAddress Wallet ID or address
 * @returns {Object|null} Wallet data or null if not found
 */
export const getTemporaryWallet = (idOrAddress) => {
  try {
    // Get all wallets
    const wallets = JSON.parse(localStorage.getItem(TEMP_WALLETS_KEY) || '[]');
    
    // Find by ID or address
    return wallets.find(w => 
      w.id === idOrAddress || 
      w.address.toLowerCase() === idOrAddress.toLowerCase()
    ) || null;
  } catch (error) {
    console.error('Failed to get temporary wallet:', error);
    return null;
  }
};

/**
 * Gets all temporary wallets
 * @param {Object} filters Optional filters like status or chain
 * @returns {Array<Object>} Array of wallet data
 */
export const getAllTemporaryWallets = (filters = {}) => {
  try {
    // Get all wallets
    let wallets = JSON.parse(localStorage.getItem(TEMP_WALLETS_KEY) || '[]');
    
    // Apply filters if provided
    if (filters.status) {
      wallets = wallets.filter(w => w.status === filters.status);
    }
    
    if (filters.chain) {
      wallets = wallets.filter(w => w.chain === filters.chain);
    }
    
    if (filters.purpose) {
      wallets = wallets.filter(w => w.purpose === filters.purpose);
    }
    
    return wallets;
  } catch (error) {
    console.error('Failed to get all temporary wallets:', error);
    return [];
  }
};

/**
 * Updates a temporary wallet's data
 * @param {string} walletId ID of the wallet to update
 * @param {Object} updates Data to update
 * @returns {Object|null} Updated wallet data or null if not found
 */
export const updateTemporaryWallet = (walletId, updates) => {
  try {
    // Get all wallets
    const wallets = JSON.parse(localStorage.getItem(TEMP_WALLETS_KEY) || '[]');
    
    // Find wallet index
    const index = wallets.findIndex(w => w.id === walletId);
    if (index === -1) {
      console.warn(`Wallet not found: ${walletId}`);
      return null;
    }
    
    // Update wallet
    wallets[index] = {
      ...wallets[index],
      ...updates,
      lastUpdated: Date.now()
    };
    
    // Save changes
    localStorage.setItem(TEMP_WALLETS_KEY, JSON.stringify(wallets));
    
    return wallets[index];
  } catch (error) {
    console.error('Failed to update temporary wallet:', error);
    return null;
  }
};

/**
 * Recycles a temporary wallet by returning funds to service wallet
 * @param {string} walletId ID of the wallet to recycle
 * @param {Object} provider Ethers provider to use
 * @returns {Promise<Object>} Transaction receipt
 */
export const recycleTemporaryWallet = async (walletId, provider) => {
  try {
    // Get wallet data
    const wallet = getTemporaryWallet(walletId);
    if (!wallet) {
      throw new Error(`Temporary wallet not found: ${walletId}`);
    }
    
    // Check if wallet has funds
    const walletInstance = new ethers.Wallet(
      await getDecryptedPrivateKey(walletId),
      provider
    );
    
    const balance = await provider.getBalance(wallet.address);
    
    // If balance is zero, just mark as recycled
    if (balance.isZero()) {
      updateTemporaryWallet(walletId, {
        status: WALLET_STATES.RECYCLED,
        balance: '0'
      });
      return { noFunds: true };
    }
    
    // Get service wallet address
    const serviceWalletAddress = process.env.SERVICE_WALLET_ADDRESS;
    if (!serviceWalletAddress) {
      throw new Error('Service wallet address not configured');
    }
    
    // Calculate gas costs
    const gasPrice = await provider.getGasPrice();
    const gasLimit = 21000; // Standard transfer
    const gasCost = gasPrice.mul(gasLimit);
    
    // If balance is less than gas cost, we can't transfer
    if (balance.lt(gasCost)) {
      console.log(`Balance too low to recycle wallet ${walletId}`);
      updateTemporaryWallet(walletId, {
        status: WALLET_STATES.RECYCLED,
        balance: ethers.utils.formatEther(balance)
      });
      return { insufficientFunds: true };
    }
    
    // Calculate amount to send (balance - gas cost)
    const amountToSend = balance.sub(gasCost);
    
    // Send transaction
    const tx = await walletInstance.sendTransaction({
      to: serviceWalletAddress,
      value: amountToSend,
      gasLimit,
      gasPrice
    });
    
    // Wait for confirmation
    const receipt = await tx.wait();
    
    // Update wallet status
    updateTemporaryWallet(walletId, {
      status: WALLET_STATES.RECYCLED,
      balance: '0',
      transactions: [...(wallet.transactions || []), {
        type: 'recycling',
        txHash: receipt.transactionHash,
        amount: ethers.utils.formatEther(amountToSend),
        timestamp: Date.now()
      }]
    });
    
    return receipt;
  } catch (error) {
    console.error('Failed to recycle temporary wallet:', error);
    throw new Error(`Wallet recycling failed: ${error.message}`);
  }
};

/**
 * Gets the decrypted private key for a temporary wallet
 * @param {string} walletId ID of the wallet
 * @returns {Promise<string>} Decrypted private key
 */
export const getDecryptedPrivateKey = async (walletId) => {
  try {
    // Get wallet data
    const wallet = getTemporaryWallet(walletId);
    if (!wallet) {
      throw new Error(`Temporary wallet not found: ${walletId}`);
    }
    
    // Decrypt private key
    const privateKey = decryptData(wallet.encryptedPrivateKey, getEncryptionKey());
    
    return privateKey;
  } catch (error) {
    console.error('Failed to get decrypted private key:', error);
    throw new Error('Private key decryption failed');
  }
};

/**
 * Gets an HD wallet from the encrypted seed phrase
 * @returns {Promise<ethers.Wallet>} HD wallet
 */
export const getHDWalletFromSeed = async () => {
  try {
    // Get encrypted seed
    const encryptedSeed = localStorage.getItem(HD_SEED_KEY);
    if (!encryptedSeed) {
      throw new Error('HD wallet seed not found');
    }
    
    // Decrypt seed
    const mnemonic = decryptData(encryptedSeed, getEncryptionKey());
    
    // Create HD wallet
    return ethers.Wallet.fromMnemonic(mnemonic);
  } catch (error) {
    console.error('Failed to get HD wallet from seed:', error);
    throw new Error('HD wallet retrieval failed');
  }
};

/**
 * Gets the next available index for wallet derivation
 * @returns {number} Next index
 */
export const getNextWalletIndex = () => {
  try {
    // Get all wallets
    const wallets = getAllTemporaryWallets();
    
    // Find highest index
    let highestIndex = -1;
    wallets.forEach(wallet => {
      if (wallet.derivationIndex > highestIndex) {
        highestIndex = wallet.derivationIndex;
      }
    });
    
    // Return next index
    return highestIndex + 1;
  } catch (error) {
    console.error('Failed to get next wallet index:', error);
    return 0;
  }
};

/**
 * Saves a temporary wallet to storage
 * @param {Object} walletData Wallet data to save
 */
export const saveTemporaryWallet = (walletData) => {
  try {
    // Get all wallets
    const wallets = JSON.parse(localStorage.getItem(TEMP_WALLETS_KEY) || '[]');
    
    // Check if wallet already exists
    const index = wallets.findIndex(w => w.id === walletData.id);
    
    if (index !== -1) {
      // Update existing wallet
      wallets[index] = {
        ...wallets[index],
        ...walletData,
        lastUpdated: Date.now()
      };
    } else {
      // Add new wallet
      wallets.push(walletData);
    }
    
    // Save changes
    localStorage.setItem(TEMP_WALLETS_KEY, JSON.stringify(wallets));
  } catch (error) {
    console.error('Failed to save temporary wallet:', error);
    throw error;
  }
};

/**
 * Encrypts data using AES
 * @param {string} data Data to encrypt
 * @param {string} key Encryption key
 * @returns {string} Encrypted data
 */
export const encryptData = (data, key) => {
  return CryptoJS.AES.encrypt(data, key).toString();
};

/**
 * Decrypts data using AES
 * @param {string} encryptedData Encrypted data
 * @param {string} key Decryption key
 * @returns {string} Decrypted data
 */
export const decryptData = (encryptedData, key) => {
  const bytes = CryptoJS.AES.decrypt(encryptedData, key);
  return bytes.toString(CryptoJS.enc.Utf8);
};

/**
 * Gets the encryption key
 * @returns {string} Encryption key
 */
export const getEncryptionKey = () => {
  // In a real implementation, this would use more secure methods
  // such as a key management service or hardware security module
  
  // For development, we use a key derived from browser info and domain
  const domain = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const entropy = `proof-of-funds-${domain}-hd-wallet-system`;
  
  return CryptoJS.SHA256(entropy).toString();
};

/**
 * Gets a chain ID for BIP44 derivation
 * @param {string} chain Chain name
 * @returns {number} BIP44 coin type
 */
export const getChainId = (chain) => {
  const chainMap = {
    'ethereum': 60,
    'polygon': 60, // Polygon uses Ethereum's coin type
    'bsc': 60,     // BSC uses Ethereum's coin type
    'solana': 501,
    'avalanche': 60
  };
  
  return chainMap[chain.toLowerCase()] || 60; // Default to Ethereum
};

export default {
  WALLET_STATES,
  initializeHDWalletSystem,
  createTemporaryWallet,
  fundTemporaryWallet,
  getTemporaryWallet,
  getAllTemporaryWallets,
  updateTemporaryWallet,
  recycleTemporaryWallet,
  getDecryptedPrivateKey,
  getHDWalletFromSeed,
  getNextWalletIndex
};