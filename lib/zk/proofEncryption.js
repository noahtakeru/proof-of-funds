/**
 * Proof Encryption Module
 * 
 * Provides utilities for encrypting and decrypting ZK proofs.
 * This module ensures that proof data is protected during storage and transfer.
 * 
 * Features:
 * - Secure access key generation for encrypting/decrypting proofs
 * - AES encryption for proof data
 * - Access key hashing for storage
 * - Access key verification
 */

import CryptoJS from 'crypto-js';

/**
 * Generate a secure random access key for proof encryption
 * 
 * @param {number} length - Length of the access key (default: 12)
 * @returns {string} A random access key
 */
export function generateAccessKey(length = 12) {
  // Use crypto.getRandomValues if available (browser environment)
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = new Uint32Array(length);
    window.crypto.getRandomValues(values);

    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset[values[i] % charset.length];
    }
    return result;
  }

  // Fallback to Math.random (less secure, but works in all environments)
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    result += charset[randomIndex];
  }

  return result;
}

/**
 * Encrypt a proof payload using the provided access key
 * 
 * @param {Object} proofData - The proof data to encrypt
 * @param {string} accessKey - The access key for encryption
 * @returns {string} The encrypted proof data
 */
export function encryptProof(proofData, accessKey) {
  try {
    if (!proofData || !accessKey) {
      throw new Error('Proof data and access key are required');
    }

    // Convert the proof data to a JSON string
    const proofString = typeof proofData === 'string'
      ? proofData
      : JSON.stringify(proofData);

    // Encrypt the proof data using AES
    const encryptedData = CryptoJS.AES.encrypt(proofString, accessKey).toString();

    return encryptedData;
  } catch (error) {
    console.error('Error encrypting proof:', error);
    return null;
  }
}

/**
 * Decrypt an encrypted proof using the provided access key
 * 
 * @param {string|Object} encryptedProof - The encrypted proof data or object containing encryptedData
 * @param {string} accessKey - The access key for decryption
 * @returns {Object|null} The decrypted proof data, or null if decryption fails
 */
export function decryptProof(encryptedProof, accessKey) {
  try {
    if (!encryptedProof || !accessKey) {
      throw new Error('Encrypted proof and access key are required');
    }

    // Extract the encrypted data string
    let encryptedData;
    if (typeof encryptedProof === 'string') {
      encryptedData = encryptedProof;
    } else if (encryptedProof.encryptedData) {
      encryptedData = encryptedProof.encryptedData;
    } else {
      throw new Error('Invalid encrypted proof format');
    }

    // Decrypt the proof data using AES
    const decryptedBytes = CryptoJS.AES.decrypt(encryptedData, accessKey);
    const decryptedString = decryptedBytes.toString(CryptoJS.enc.Utf8);

    if (!decryptedString) {
      throw new Error('Invalid access key or corrupted data');
    }

    // Parse the decrypted string as JSON
    return JSON.parse(decryptedString);
  } catch (error) {
    console.error('Error decrypting proof:', error);
    return null;
  }
}

/**
 * Generate a SHA-256 hash of the access key for secure storage
 * 
 * @param {string} accessKey - The access key to hash
 * @returns {string} The hashed access key
 */
export function hashAccessKey(accessKey) {
  return CryptoJS.SHA256(accessKey).toString();
}

/**
 * Verify if the provided access key matches its hashed version
 * 
 * @param {string} accessKey - The access key to verify
 * @param {string} hashedKey - The hashed access key to compare against
 * @returns {boolean} True if the access key matches the hash, false otherwise
 */
export function verifyAccessKey(accessKey, hashedKey) {
  const computedHash = hashAccessKey(accessKey);
  return computedHash === hashedKey;
}

export default {
  generateAccessKey,
  encryptProof,
  decryptProof,
  hashAccessKey,
  verifyAccessKey
};