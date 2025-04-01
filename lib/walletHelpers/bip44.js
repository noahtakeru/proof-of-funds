/**
 * BIP44 Wallet Derivation Module
 * 
 * This module provides functions for deterministic wallet generation using the BIP44 standard.
 * It supports the creation of temporary wallets for zero-knowledge proofs without exposing
 * the user's main wallet addresses.
 * 
 * Key Features:
 * - Deterministic wallet derivation using the BIP44 standard
 * - Secure storage of derived wallet information
 * - Purpose-specific derivation path generation
 * 
 * Security:
 * - Private keys are encrypted at rest using AES-256
 * - Seeds are never stored in plaintext
 * - All sensitive operations are performed in memory
 */

import { ethers } from 'ethers';
import { entropyToMnemonic, mnemonicToSeed } from '@ethersproject/hdnode';
import CryptoJS from 'crypto-js';

// Constants for BIP44 derivation
const HARDENED_OFFSET = 0x80000000; // 2^31
const DEFAULT_PURPOSE = 44; // BIP44
const ETHEREUM_COIN_TYPE = 60;
const POLYGON_COIN_TYPE = 966; // Polygon / MATIC

// In-memory cache for temporary wallets (not persisted to localStorage)
let walletCache = {};

// Default derivation path structure
// m / purpose' / coin_type' / account' / change / address_index
const DEFAULT_DERIVATION_PATH = `m/${DEFAULT_PURPOSE}'/${POLYGON_COIN_TYPE}'/0'/0/`;

/**
 * Generates a secure random mnemonic for wallet derivation
 * 
 * @returns {string} A BIP39 mnemonic phrase
 */
export const generateMnemonic = () => {
    // Generate 16 bytes of random data (128 bits)
    const entropy = ethers.utils.randomBytes(16);
    // Convert entropy to a mnemonic phrase
    return entropyToMnemonic(entropy);
};

/**
 * Creates a deterministic derivation path based on purpose
 * 
 * @param {string} purpose - Purpose identifier for this wallet (e.g., "proof-0001")
 * @param {number} accountIndex - Account index (default: 0)
 * @returns {string} BIP44 derivation path
 */
export const generateDerivationPath = (purpose, accountIndex = 0) => {
    // Use the purpose string to generate a deterministic address index
    // Hash the purpose string to get a consistent number
    const purposeHash = ethers.utils.id(purpose);
    const addressIndex = parseInt(purposeHash.slice(2, 10), 16) % 1000000; // Use first 4 bytes, limit to reasonable size

    return `${DEFAULT_DERIVATION_PATH}${addressIndex}`;
};

/**
 * Derives a wallet from a seed and derivation path
 * 
 * @param {string} mnemonic - BIP39 mnemonic phrase
 * @param {string} path - BIP44 derivation path
 * @returns {Promise<Object>} Wallet information including address and encrypted private key
 */
export const deriveWalletFromMnemonic = async (mnemonic, path) => {
    try {
        // Create a wallet from the mnemonic
        const wallet = ethers.Wallet.fromMnemonic(mnemonic, path);

        // Return wallet information (address and private key)
        return {
            address: wallet.address,
            privateKey: wallet.privateKey,
            derivationPath: path,
            createdAt: Date.now()
        };
    } catch (error) {
        console.error('Error deriving wallet:', error);
        throw new Error('Failed to derive wallet from mnemonic');
    }
};

/**
 * Encrypts sensitive wallet data with a password
 * 
 * @param {Object} walletInfo - Wallet information to encrypt
 * @param {string} password - Password for encryption
 * @returns {string} Encrypted wallet data
 */
const encryptWalletData = (walletInfo, password) => {
    const walletData = JSON.stringify(walletInfo);
    return CryptoJS.AES.encrypt(walletData, password).toString();
};

/**
 * Decrypts wallet data with the provided password
 * 
 * @param {string} encryptedData - Encrypted wallet data
 * @param {string} password - Password for decryption
 * @returns {Object} Decrypted wallet information
 */
const decryptWalletData = (encryptedData, password) => {
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedData, password);
        const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
        return JSON.parse(decryptedData);
    } catch (error) {
        console.error('Error decrypting wallet data:', error);
        throw new Error('Failed to decrypt wallet data - incorrect password or corrupted data');
    }
};

/**
 * Securely stores derived wallet information
 * 
 * @param {Object} walletInfo - Wallet information including address and private key
 * @param {string} purpose - Purpose identifier for this wallet
 * @param {boolean} autoArchive - Whether to automatically archive after use
 * @returns {string} Address of the stored wallet
 */
export const storeDerivedWallet = (walletInfo, purpose, autoArchive = true) => {
    try {
        // Get existing temporary wallets from localStorage
        const storedWallets = localStorage.getItem('temporaryWallets') || '{}';
        const wallets = JSON.parse(storedWallets);

        // Generate a random password for encrypting this specific wallet
        // This adds another layer of security beyond localStorage
        const walletPassword = ethers.utils.hexlify(ethers.utils.randomBytes(16));

        // Only store public information in localStorage
        // The private key is encrypted and stored separately
        const walletPublicInfo = {
            address: walletInfo.address,
            purpose: purpose,
            derivationPath: walletInfo.derivationPath,
            createdAt: walletInfo.createdAt,
            autoArchive: autoArchive,
            status: 'active'
        };

        // Add the wallet to the list
        wallets[walletInfo.address] = walletPublicInfo;

        // Save public info to localStorage
        localStorage.setItem('temporaryWallets', JSON.stringify(wallets));

        // Encrypt and store the private key in our in-memory cache
        // We'll keep this in memory only and never persist it to localStorage
        const encryptedPrivateData = encryptWalletData(
            { privateKey: walletInfo.privateKey },
            walletPassword
        );

        // Store the encrypted data and password in memory
        walletCache[walletInfo.address] = {
            encryptedData: encryptedPrivateData,
            password: walletPassword
        };

        return walletInfo.address;
    } catch (error) {
        console.error('Error storing derived wallet:', error);
        throw new Error('Failed to securely store derived wallet');
    }
};

/**
 * Retrieves a temporary wallet by address
 * 
 * @param {string} address - Address of the wallet to retrieve
 * @returns {Object} Combined wallet information (public and private)
 */
export const getDerivedWallet = (address) => {
    try {
        // Normalize the address
        const normalizedAddress = address.toLowerCase();

        // Get public wallet info from localStorage
        const storedWallets = localStorage.getItem('temporaryWallets') || '{}';
        const wallets = JSON.parse(storedWallets);

        // Check if wallet exists
        if (!wallets[normalizedAddress]) {
            throw new Error(`Temporary wallet ${normalizedAddress} not found`);
        }

        // Get wallet public info
        const walletPublicInfo = wallets[normalizedAddress];

        // Check if private key is in memory cache
        if (!walletCache[normalizedAddress]) {
            return { ...walletPublicInfo, privateKey: null };
        }

        // Decrypt private key from memory cache
        const { encryptedData, password } = walletCache[normalizedAddress];
        const decryptedData = decryptWalletData(encryptedData, password);

        // Return combined wallet information
        return {
            ...walletPublicInfo,
            privateKey: decryptedData.privateKey
        };
    } catch (error) {
        console.error('Error retrieving derived wallet:', error);
        throw new Error('Failed to retrieve wallet information');
    }
};

/**
 * Lists all temporary wallets
 * 
 * @param {string} status - Filter by status ('active', 'archived', or null for all)
 * @returns {Array} Array of wallet information objects
 */
export const listTemporaryWallets = (status = null) => {
    try {
        // Get stored wallets from localStorage
        const storedWallets = localStorage.getItem('temporaryWallets') || '{}';
        const wallets = JSON.parse(storedWallets);

        // Convert to array
        const walletArray = Object.values(wallets);

        // Filter by status if provided
        if (status) {
            return walletArray.filter(wallet => wallet.status === status);
        }

        return walletArray;
    } catch (error) {
        console.error('Error listing temporary wallets:', error);
        return [];
    }
};

/**
 * Archives a temporary wallet
 * 
 * @param {string} address - Address of the wallet to archive
 * @returns {boolean} True if successful, false otherwise
 */
export const archiveWallet = (address) => {
    try {
        // Normalize the address
        const normalizedAddress = address.toLowerCase();

        // Get stored wallets from localStorage
        const storedWallets = localStorage.getItem('temporaryWallets') || '{}';
        const wallets = JSON.parse(storedWallets);

        // Check if wallet exists
        if (!wallets[normalizedAddress]) {
            return false;
        }

        // Update wallet status
        wallets[normalizedAddress].status = 'archived';
        wallets[normalizedAddress].archivedAt = Date.now();

        // Save updated wallets to localStorage
        localStorage.setItem('temporaryWallets', JSON.stringify(wallets));

        // Remove private key from memory cache
        delete walletCache[normalizedAddress];

        return true;
    } catch (error) {
        console.error('Error archiving wallet:', error);
        return false;
    }
};

/**
 * Creates a new temporary wallet for proof generation
 * 
 * @param {string} purpose - Purpose identifier for this wallet
 * @param {boolean} autoArchive - Whether to automatically archive after use
 * @returns {Promise<Object>} Newly created wallet information
 */
export const createWalletForProof = async (purpose, autoArchive = true) => {
    try {
        // Generate new mnemonic
        const mnemonic = generateMnemonic();

        // Generate derivation path based on purpose
        const path = generateDerivationPath(purpose);

        // Derive wallet
        const walletInfo = await deriveWalletFromMnemonic(mnemonic, path);

        // Store wallet securely
        storeDerivedWallet(walletInfo, purpose, autoArchive);

        // Return wallet information (but not private key)
        return {
            address: walletInfo.address,
            purpose: purpose,
            derivationPath: path,
            createdAt: walletInfo.createdAt,
            autoArchive: autoArchive
        };
    } catch (error) {
        console.error('Error creating wallet for proof:', error);
        throw new Error('Failed to create temporary wallet for proof');
    }
};

/**
 * Wipes all temporary wallet data from memory and storage
 * Use with caution - this will permanently delete all wallet information
 * 
 * @returns {boolean} True if successful
 */
export const wipeAllTemporaryWallets = () => {
    try {
        // Clear localStorage
        localStorage.removeItem('temporaryWallets');

        // Clear memory cache
        walletCache = {};

        return true;
    } catch (error) {
        console.error('Error wiping temporary wallets:', error);
        return false;
    }
};

// Export all functions that should be available outside this module
export default {
    generateMnemonic,
    generateDerivationPath,
    deriveWalletFromMnemonic,
    storeDerivedWallet,
    getDerivedWallet,
    listTemporaryWallets,
    archiveWallet,
    createWalletForProof,
    wipeAllTemporaryWallets
}; 