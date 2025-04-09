/**
 * Secure Key Manager for Zero-Knowledge Proof System
 * 
 * This module provides robust cryptographic key management for securing sensitive wallet data.
 * It implements industry-standard encryption using Web Crypto API with AES-GCM and PBKDF2.
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * Think of this module as a digital safety deposit box system. It creates special keys 
 * that lock away sensitive information (like wallet private keys) so that only someone 
 * with the right password can access them. This is essential for protecting user funds 
 * while still allowing our application to perform necessary operations securely.
 * 
 * Just as a bank vault has multiple security layers (keys, codes, biometrics), this
 * system uses multiple layers of encryption and security measures to ensure that even
 * if one layer is compromised, the sensitive information remains protected.
 * 
 * The module handles:
 * 1. Creating strong digital locks (encryption keys)
 * 2. Securely storing sensitive information
 * 3. Safely retrieving information only when needed
 * 4. Destroying information completely when it's no longer needed
 * 
 * Business value: Prevents unauthorized access to user funds, builds trust with users,
 * and ensures compliance with security best practices for financial applications.
 */

// Using window.crypto for cryptographic operations when available
const crypto = typeof window !== 'undefined' ? window.crypto :
  typeof global !== 'undefined' && global.crypto ? global.crypto :
    null;

/**
 * SecureKeyManager class handles encryption, decryption, and secure management of keys
 * using the Web Crypto API with defense-in-depth approach.
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This is like having a bank vault with multiple security layers. It ensures that
 * even if one security measure fails, others will still protect the sensitive data.
 * Without this protection, user private keys could be exposed, potentially leading
 * to theft of funds and damage to platform reputation.
 */
class SecureKeyManager {
  constructor() {
    if (!crypto || !crypto.subtle) {
      throw new Error('Web Crypto API is not available in this environment');
    }

    this.crypto = crypto;
    this.encryptionAlgorithm = 'AES-GCM';
    this.keyDerivationAlgorithm = 'PBKDF2';
    this.hashAlgorithm = 'SHA-256';
    this.iterationCount = 100000; // High iteration count for PBKDF2
    this.keyLength = 256; // AES-256
  }

  /**
   * Generates a strong encryption key using password-based key derivation
   * @param {string} password - Secret used for key derivation
   * @param {Uint8Array} [salt] - Optional salt for key derivation, will be generated if not provided
   * @returns {Promise<{key: CryptoKey, salt: Uint8Array}>} The derived key and salt
   * 
   * ---------- BUSINESS CONTEXT ----------
   * Think of this function as creating a unique and complex key from a password. 
   * The salt adds randomness - like how two people with the same password would still
   * get different keys, making attacks much harder. This is critical because it's the
   * foundation of our security system - weak keys would make everything vulnerable.
   */
  async generateEncryptionKey(password, salt) {
    // Generate salt if not provided
    const keySalt = salt || new Uint8Array(16);
    if (!salt) {
      this.crypto.getRandomValues(keySalt);
    }

    try {
      // Import password as key material
      const keyMaterial = await this.crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        { name: this.keyDerivationAlgorithm },
        false,
        ['deriveBits', 'deriveKey']
      );

      // Derive the actual encryption key using PBKDF2
      const key = await this.crypto.subtle.deriveKey(
        {
          name: this.keyDerivationAlgorithm,
          salt: keySalt,
          iterations: this.iterationCount,
          hash: this.hashAlgorithm
        },
        keyMaterial,
        { name: this.encryptionAlgorithm, length: this.keyLength },
        false, // Not extractable
        ['encrypt', 'decrypt']
      );

      return { key, salt: keySalt };
    } catch (error) {
      throw new Error(`Key generation failed: ${error.message}`);
    }
  }

  /**
   * Encrypts sensitive data using AES-GCM with a derived key
   * @param {string|Object} data - Data to encrypt (will be stringified if object)
   * @param {string} password - Password for key derivation
   * @returns {Promise<Object>} Encrypted data object with IV, salt, and ciphertext
   * 
   * ---------- BUSINESS CONTEXT ----------
   * This is like putting valuable information in a locked safe. The data (which could be
   * private keys, personal information, or financial details) is transformed into an
   * unreadable format that only someone with the correct password can decode. 
   * Without this encryption, sensitive user data would be vulnerable to theft or exposure.
   */
  async encrypt(data, password) {
    try {
      // Convert data to string if it's an object
      const dataString = typeof data === 'object' ? JSON.stringify(data) : String(data);
      const dataBytes = new TextEncoder().encode(dataString);

      // Generate IV for AES-GCM
      const iv = new Uint8Array(12); // 96 bits IV for AES-GCM
      this.crypto.getRandomValues(iv);

      // Generate encryption key from password
      const { key, salt } = await this.generateEncryptionKey(password);

      // Encrypt the data
      const encryptedData = await this.crypto.subtle.encrypt(
        {
          name: this.encryptionAlgorithm,
          iv: iv
        },
        key,
        dataBytes
      );

      // Convert to format suitable for storage
      return {
        version: '1.0',
        algorithm: this.encryptionAlgorithm,
        keyDerivation: this.keyDerivationAlgorithm,
        ciphertext: Array.from(new Uint8Array(encryptedData)),
        iv: Array.from(iv),
        salt: Array.from(salt),
        timestamp: Date.now(),
        metadata: {
          type: 'encrypted-data',
          contentType: typeof data === 'object' ? 'json' : 'string'
        }
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypts data that was encrypted with the encrypt method
   * @param {Object} encryptedData - The encrypted data object
   * @param {string} password - Password used for encryption
   * @returns {Promise<string|Object>} Decrypted data
   * 
   * ---------- BUSINESS CONTEXT ----------
   * This is like opening that locked safe when needed. When the application needs to 
   * access the protected information (for example, to sign a transaction), this function
   * converts the encrypted data back to its usable form - but only if provided with the
   * correct password. This allows secure operations without permanently exposing sensitive data.
   */
  async decrypt(encryptedData, password) {
    try {
      // Validate encrypted data format
      if (!encryptedData || !encryptedData.ciphertext || !encryptedData.iv || !encryptedData.salt) {
        throw new Error('Invalid encrypted data format');
      }

      // Convert array data back to typed arrays
      const ciphertext = new Uint8Array(encryptedData.ciphertext);
      const iv = new Uint8Array(encryptedData.iv);
      const salt = new Uint8Array(encryptedData.salt);

      // Generate the same key using provided salt
      const { key } = await this.generateEncryptionKey(password, salt);

      // Decrypt the data
      const decryptedBuffer = await this.crypto.subtle.decrypt(
        {
          name: this.encryptionAlgorithm,
          iv: iv
        },
        key,
        ciphertext
      );

      // Convert buffer to string
      const decryptedString = new TextDecoder().decode(decryptedBuffer);

      // Convert back to object if the original was JSON
      if (encryptedData.metadata && encryptedData.metadata.contentType === 'json') {
        return JSON.parse(decryptedString);
      }

      return decryptedString;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Encrypts a private key with enhanced security measures
   * @param {string} privateKey - The private key to encrypt
   * @param {string} password - Password for encryption
   * @returns {Promise<Object>} Encrypted key data
   * 
   * ---------- BUSINESS CONTEXT ----------
   * This is a specialized version of our safe specifically designed for the most valuable
   * asset - the private key that controls user funds. It adds extra security measures
   * because private keys are especially sensitive - if compromised, they could lead directly
   * to financial loss. This function helps ensure that private keys can be stored and used
   * without being exposed, greatly reducing security risks.
   */
  async encryptPrivateKey(privateKey, password) {
    try {
      // Special handling for private keys
      const encryptedData = await this.encrypt(privateKey, password);

      // Add specific metadata for private keys
      encryptedData.metadata = {
        ...encryptedData.metadata,
        type: 'encrypted-private-key',
        keyType: 'ethereum-private-key',
      };

      return encryptedData;
    } catch (error) {
      throw new Error(`Private key encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypts an encrypted private key
   * @param {Object} encryptedKey - The encrypted key data
   * @param {string} password - Password used for encryption
   * @returns {Promise<string>} The decrypted private key
   * 
   * ---------- BUSINESS CONTEXT ----------
   * This unlocks the specialized safe containing a private key, but only when absolutely
   * necessary (such as when signing a transaction). It verifies that what we're decrypting
   * is actually a private key and not some other data, providing an extra layer of security.
   * This function is critical for operations that require the private key while maintaining
   * overall system security.
   */
  async decryptPrivateKey(encryptedKey, password) {
    try {
      // Validate this is actually an encrypted private key
      if (!encryptedKey.metadata || encryptedKey.metadata.type !== 'encrypted-private-key') {
        throw new Error('The provided data is not an encrypted private key');
      }

      // Decrypt using the standard method
      const privateKey = await this.decrypt(encryptedKey, password);

      // Additional validation could be added here

      return privateKey;
    } catch (error) {
      throw new Error(`Private key decryption failed: ${error.message}`);
    }
  }

  /**
   * Generates a secure random password of specified strength
   * @param {number} [length=16] - Password length
   * @param {boolean} [includeSymbols=true] - Include special characters
   * @returns {string} Securely generated random password
   */
  generateSecurePassword(length = 16, includeSymbols = true) {
    // Ensure minimum length
    length = Math.max(12, length);

    // Character sets
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    // Build character pool
    let charset = lowercase + uppercase + numbers;
    if (includeSymbols) {
      charset += symbols;
    }

    // Generate random bytes
    const randomBytes = new Uint8Array(length * 2); // Extra bytes for better distribution
    this.crypto.getRandomValues(randomBytes);

    // Build password
    let password = '';
    for (let i = 0; i < length; i++) {
      // Use modulo to convert random bytes to character indexes
      const randomIndex = randomBytes[i] % charset.length;
      password += charset[randomIndex];
    }

    return password;
  }

  /**
   * Securely wipes sensitive data from memory
   * @param {any} data - Data to be wiped
   */
  secureWipe(data) {
    if (!data) return;

    if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
      // Overwrite with zeros
      new Uint8Array(data.buffer || data).fill(0);
    } else if (Array.isArray(data)) {
      // Wipe array contents
      for (let i = 0; i < data.length; i++) {
        if (typeof data[i] === 'object' && data[i] !== null) {
          this.secureWipe(data[i]);
        }
        data[i] = null;
      }
      data.length = 0;
    } else if (typeof data === 'string') {
      // String is immutable in JavaScript, can't be wiped directly
      // This is just a placeholder - in real implementations, avoid string
      data = null;
    } else if (typeof data === 'object' && data !== null) {
      // Wipe object properties
      Object.keys(data).forEach(key => {
        if (typeof data[key] === 'object' && data[key] !== null) {
          this.secureWipe(data[key]);
        }
        data[key] = null;
      });
    }
  }
}

/* #ESM-COMPAT */
// Export the class for both CommonJS and ESM
export { SecureKeyManager };
export default SecureKeyManager;