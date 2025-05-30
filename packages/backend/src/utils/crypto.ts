/**
 * Cryptography Utilities
 * 
 * Helper functions for cryptographic operations
 */
import { ethers } from 'ethers';
import crypto from 'crypto';

/**
 * Verify Ethereum signature
 * 
 * @param message Original message that was signed
 * @param signature Signature to verify
 * @param expectedAddress Expected Ethereum address that signed the message
 * @returns True if signature is valid, false otherwise
 */
export const verifySignature = async (
  message: string, 
  signature: string, 
  expectedAddress: string
): Promise<boolean> => {
  try {
    // Recover address from signature
    const msgHash = ethers.hashMessage(message);
    const msgHashBytes = ethers.getBytes(msgHash);
    const recoveredPubKey = ethers.recoverPublicKey(msgHashBytes, signature);
    const recoveredAddress = ethers.computeAddress(recoveredPubKey);
    
    // Check if recovered address matches expected address
    return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
};

/**
 * Generate a random symmetric encryption key
 * 
 * @returns Buffer containing the generated key
 */
export const generateEncryptionKey = (): Buffer => {
  return crypto.randomBytes(32); // 256-bit key
};

/**
 * Encrypt data using AES-GCM
 * 
 * @param data Data to encrypt (object will be stringified)
 * @param key Encryption key as Buffer
 * @returns Encrypted data as base64 string with IV and auth tag
 */
export const encryptData = (data: any, key: Buffer): string => {
  // Generate random IV
  const iv = crypto.randomBytes(16);
  
  // Create cipher
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  // Convert data to string if it's an object
  const dataString = typeof data === 'object' ? JSON.stringify(data) : String(data);
  
  // Encrypt data
  const encrypted = Buffer.concat([
    cipher.update(dataString, 'utf8'),
    cipher.final()
  ]);
  
  // Get auth tag
  const authTag = cipher.getAuthTag();
  
  // Combine IV, auth tag, and encrypted data
  const result = Buffer.concat([
    // First 4 bytes: Version identifier for future compatibility
    Buffer.from([0x01, 0x00, 0x00, 0x00]),
    // Next 16 bytes: IV
    iv,
    // Next 16 bytes: Auth tag
    authTag,
    // Remaining bytes: Encrypted data
    encrypted
  ]);
  
  // Return as base64 string
  return result.toString('base64');
};

/**
 * Decrypt data using AES-GCM
 * 
 * @param encryptedData Encrypted data as base64 string
 * @param key Decryption key as Buffer
 * @returns Decrypted data, parsed as JSON if possible
 */
export const decryptData = (encryptedData: string, key: Buffer): any => {
  // Convert base64 string to buffer
  const data = Buffer.from(encryptedData, 'base64');
  
  // Extract components
  const version = data.slice(0, 4); // Version identifier
  const iv = data.slice(4, 20); // IV is 16 bytes
  const authTag = data.slice(20, 36); // Auth tag is 16 bytes
  const encrypted = data.slice(36); // Rest is encrypted data
  
  // Check version for compatibility
  if (version[0] !== 0x01 || version[1] !== 0x00) {
    throw new Error('Unsupported encryption version');
  }
  
  // Create decipher
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  // Decrypt data
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);
  
  // Convert to string and try to parse as JSON
  const decryptedString = decrypted.toString('utf8');
  
  try {
    return JSON.parse(decryptedString);
  } catch (e) {
    // Return as string if not valid JSON
    return decryptedString;
  }
};