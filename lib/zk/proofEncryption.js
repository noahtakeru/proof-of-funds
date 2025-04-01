/**
 * Proof Encryption Module
 * 
 * Provides functionalities for encrypting and decrypting ZK proofs,
 * managing encryption keys, and handling secure proof sharing.
 */

import { ethers } from 'ethers';

/**
 * Encrypts a proof object with a unique access key
 * 
 * @param {Object} proofData - The proof data to encrypt
 * @param {string} accessKey - The access key for encryption
 * @returns {Promise<Object>} - Encrypted proof and metadata
 */
export async function encryptProof(proofData, accessKey) {
  try {
    // Generate a unique encryption key based on the access key
    const encryptionKey = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(`proof-encryption-${accessKey}`)
    );
    
    // Stringify the proof data
    const dataString = JSON.stringify(proofData);
    
    // Convert to bytes for encryption
    const dataBytes = ethers.utils.toUtf8Bytes(dataString);
    const keyBytes = ethers.utils.arrayify(encryptionKey);
    
    // For simplicity, we're using a basic XOR encryption here
    // In production, use a more secure encryption method like AES-GCM
    const encryptedBytes = new Uint8Array(dataBytes.length);
    for (let i = 0; i < dataBytes.length; i++) {
      encryptedBytes[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    
    // Convert encrypted data to base64 for storage/transmission
    const encryptedBase64 = Buffer.from(encryptedBytes).toString('base64');
    
    // Add metadata about the encryption
    return {
      encryptedData: encryptedBase64,
      encryptionMethod: 'xor-keccak256', // For demonstration
      accessKeyHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes(accessKey)),
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Error encrypting proof:', error);
    throw new Error('Failed to encrypt proof data');
  }
}

/**
 * Decrypts an encrypted proof using an access key
 * 
 * @param {Object} encryptedProof - The encrypted proof object
 * @param {string} accessKey - The access key for decryption
 * @returns {Promise<Object>} - The decrypted proof data
 */
export async function decryptProof(encryptedProof, accessKey) {
  try {
    // Verify that this is the correct access key
    const providedKeyHash = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(accessKey)
    );
    
    if (providedKeyHash !== encryptedProof.accessKeyHash) {
      throw new Error('Invalid access key');
    }
    
    // Generate the encryption key using the same method as during encryption
    const encryptionKey = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(`proof-encryption-${accessKey}`)
    );
    
    // Get the encrypted data
    const encryptedBytes = Buffer.from(encryptedProof.encryptedData, 'base64');
    const keyBytes = ethers.utils.arrayify(encryptionKey);
    
    // Decrypt using XOR (should match the encryption method)
    const decryptedBytes = new Uint8Array(encryptedBytes.length);
    for (let i = 0; i < encryptedBytes.length; i++) {
      decryptedBytes[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    
    // Convert back to string and parse JSON
    const decryptedString = ethers.utils.toUtf8String(decryptedBytes);
    return JSON.parse(decryptedString);
  } catch (error) {
    console.error('Error decrypting proof:', error);
    throw new Error('Failed to decrypt proof. The access key may be invalid.');
  }
}

/**
 * Generates a secure random access key for proof encryption
 * 
 * @returns {string} - A random access key
 */
export function generateAccessKey() {
  // Generate a random key (16 bytes = 128 bits of entropy)
  const randomBytes = ethers.utils.randomBytes(16);
  
  // Convert to a base64 string for easier handling
  return Buffer.from(randomBytes).toString('base64');
}

/**
 * Creates a proof sharing package with access key
 * This combines the encrypted proof with a reference ID
 * 
 * @param {Object} proofData - The original proof data
 * @param {string} walletAddress - The wallet address
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - A shareable proof package
 */
export async function createProofSharingPackage(proofData, walletAddress, options = {}) {
  // Generate a random access key
  const accessKey = generateAccessKey();
  
  // Encrypt the proof
  const encryptedProof = await encryptProof(proofData, accessKey);
  
  // Generate a reference ID
  const referenceId = generateProofReferenceId(proofData, walletAddress, encryptedProof.timestamp);
  
  // Create the sharing package
  return {
    referenceId,
    encryptedProof,
    accessKey,
    walletAddress,
    expiryTime: options.expiryTime || (Date.now() + 86400000), // Default 24hr expiry
    proofType: options.proofType || 0,
    metadataVersion: 1
  };
}

/**
 * Generates a reference ID for a proof
 * 
 * @param {Object} proofData - The proof data
 * @param {string} walletAddress - The wallet address
 * @param {number} timestamp - The proof creation timestamp
 * @returns {string} - A unique reference ID
 */
function generateProofReferenceId(proofData, walletAddress, timestamp) {
  // Create a unique but deterministic ID based on proof data
  const idInput = `${walletAddress}-${timestamp}-${JSON.stringify(proofData.publicSignals || [])}`;
  const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(idInput));
  
  // Return a shortened version that's easier to share
  return hash.substring(0, 18);
}

/**
 * Validates a proof sharing package structure
 * 
 * @param {Object} package - The proof sharing package to validate
 * @returns {boolean} - Whether the package is valid
 */
export function validateProofPackage(package) {
  // Check for required fields
  const requiredFields = [
    'referenceId', 
    'encryptedProof', 
    'walletAddress',
    'expiryTime'
  ];
  
  for (const field of requiredFields) {
    if (!package[field]) {
      console.error(`Missing required field in proof package: ${field}`);
      return false;
    }
  }
  
  // Check that the encrypted proof has the necessary structure
  if (!package.encryptedProof.encryptedData || 
      !package.encryptedProof.encryptionMethod || 
      !package.encryptedProof.accessKeyHash) {
    console.error('Invalid encrypted proof structure');
    return false;
  }
  
  // Check expiry time
  if (package.expiryTime < Date.now()) {
    console.error('Proof package has expired');
    return false;
  }
  
  return true;
}