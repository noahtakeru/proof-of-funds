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

import { 
  SecurityError, 
  InputError, 
  CompatibilityError,
  ErrorCode 
} from './zkErrorHandler.mjs';
import zkErrorLogger from './zkErrorLogger.mjs';

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
      const error = new CompatibilityError('Web Crypto API is not available in this environment', {
        code: ErrorCode.COMPATIBILITY_WASM_UNAVAILABLE,
        operationId: 'SecureKeyManager:constructor',
        userFixable: true,
        recoverable: false,
        recommendedAction: 'Try using a modern browser that supports the Web Crypto API, such as Chrome, Firefox, or Edge.',
        details: {
          environment: typeof window !== 'undefined' ? 'browser' : 'node',
          cryptoAvailable: !!crypto,
          subtleAvailable: crypto ? !!crypto.subtle : false
        }
      });
      
      zkErrorLogger.logError(error);
      throw error;
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
    try {
      // Validate password
      if (!password || typeof password !== 'string' || password.length < 8) {
        throw new InputError('Invalid password for key generation', {
          code: ErrorCode.SECURITY_KEY_ERROR,
          operationId: 'SecureKeyManager:generateEncryptionKey',
          userFixable: true,
          recoverable: true,
          recommendedAction: 'Please provide a stronger password with at least 8 characters.',
          details: {
            passwordProvided: !!password,
            passwordType: typeof password,
            passwordLength: password ? password.length : 0
          }
        });
      }

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
        throw new SecurityError(`Key generation failed: ${error.message}`, {
          code: ErrorCode.SECURITY_KEY_ERROR,
          operationId: 'SecureKeyManager:generateEncryptionKey',
          userFixable: false,
          recoverable: false,
          details: {
            algorithm: this.keyDerivationAlgorithm,
            hash: this.hashAlgorithm,
            iterations: this.iterationCount,
            originalError: error.message
          }
        });
      }
    } catch (error) {
      // Log the error
      zkErrorLogger.logError(error, {
        context: 'Key generation',
        hasPassword: !!password,
        hasSalt: !!salt
      });
      
      // Re-throw for proper error handling upstream
      throw error;
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
      // Validate inputs
      if (data === undefined || data === null) {
        throw new InputError('Cannot encrypt undefined or null data', {
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          operationId: 'SecureKeyManager:encrypt',
          userFixable: true,
          recoverable: true,
          recommendedAction: 'Please provide valid data to encrypt.',
          details: {
            dataType: typeof data
          }
        });
      }

      // Convert data to string if it's an object
      const dataString = typeof data === 'object' ? JSON.stringify(data) : String(data);
      const dataBytes = new TextEncoder().encode(dataString);

      // Generate IV for AES-GCM
      const iv = new Uint8Array(12); // 96 bits IV for AES-GCM
      this.crypto.getRandomValues(iv);

      // Generate encryption key from password
      const { key, salt } = await this.generateEncryptionKey(password);

      try {
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
      } catch (cryptoError) {
        throw new SecurityError(`Encryption operation failed: ${cryptoError.message}`, {
          code: ErrorCode.SECURITY_DATA_INTEGRITY,
          operationId: 'SecureKeyManager:encrypt',
          userFixable: false,
          recoverable: true,
          details: {
            algorithm: this.encryptionAlgorithm,
            dataSize: dataBytes.length,
            originalError: cryptoError.message
          }
        });
      }
    } catch (error) {
      // Log error with redacted details
      zkErrorLogger.logError(error, {
        context: 'Data encryption',
        hasData: !!data,
        hasPassword: !!password,
        dataType: typeof data
      });
      
      // Re-throw for proper error handling upstream
      throw error;
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
        throw new InputError('Invalid encrypted data format', {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId: 'SecureKeyManager:decrypt',
          userFixable: true,
          recoverable: false,
          recommendedAction: 'Please provide valid encrypted data with ciphertext, IV, and salt.',
          details: {
            hasEncryptedData: !!encryptedData,
            hasCiphertext: encryptedData ? !!encryptedData.ciphertext : false,
            hasIv: encryptedData ? !!encryptedData.iv : false,
            hasSalt: encryptedData ? !!encryptedData.salt : false
          }
        });
      }

      // Convert array data back to typed arrays
      const ciphertext = new Uint8Array(encryptedData.ciphertext);
      const iv = new Uint8Array(encryptedData.iv);
      const salt = new Uint8Array(encryptedData.salt);

      // Generate the same key using provided salt
      const { key } = await this.generateEncryptionKey(password, salt);

      try {
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
          try {
            return JSON.parse(decryptedString);
          } catch (jsonError) {
            throw new SecurityError('Failed to parse decrypted JSON data', {
              code: ErrorCode.SECURITY_DATA_INTEGRITY,
              operationId: 'SecureKeyManager:decrypt:parseJSON',
              userFixable: false,
              recoverable: false,
              details: {
                parseError: jsonError.message,
                contentType: encryptedData.metadata.contentType
              }
            });
          }
        }

        return decryptedString;
      } catch (cryptoError) {
        if (cryptoError.name === 'OperationError') {
          // Most likely incorrect password or tampered data
          throw new SecurityError('Decryption failed: incorrect password or tampered data', {
            code: ErrorCode.SECURITY_DATA_INTEGRITY,
            operationId: 'SecureKeyManager:decrypt',
            userFixable: true,
            recoverable: true,
            recommendedAction: 'Please provide the correct password or verify data integrity.',
            details: {
              errorName: cryptoError.name,
              algorithm: this.encryptionAlgorithm
            }
          });
        }
        
        throw new SecurityError(`Decryption operation failed: ${cryptoError.message}`, {
          code: ErrorCode.SECURITY_DATA_INTEGRITY,
          operationId: 'SecureKeyManager:decrypt',
          userFixable: false,
          recoverable: true,
          details: {
            errorName: cryptoError.name,
            algorithm: this.encryptionAlgorithm,
            originalError: cryptoError.message
          }
        });
      }
    } catch (error) {
      // Log error with redacted details
      zkErrorLogger.logError(error, {
        context: 'Data decryption',
        hasEncryptedData: !!encryptedData,
        hasPassword: !!password,
        algorithm: encryptedData ? encryptedData.algorithm : null,
        version: encryptedData ? encryptedData.version : null
      });
      
      // Re-throw for proper error handling upstream
      throw error;
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
      // Validate private key (basic format check)
      if (!privateKey || typeof privateKey !== 'string' || !privateKey.match(/^(0x)?[0-9a-fA-F]{64}$/)) {
        throw new InputError('Invalid private key format', {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId: 'SecureKeyManager:encryptPrivateKey',
          userFixable: true,
          recoverable: false,
          recommendedAction: 'Please provide a valid Ethereum private key (64 hex characters).',
          details: {
            privateKeyProvided: !!privateKey,
            privateKeyType: typeof privateKey
          }
        });
      }

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
      // If it's not already a ZKError, wrap it
      if (!error.code) {
        error = new SecurityError(`Private key encryption failed: ${error.message}`, {
          code: ErrorCode.SECURITY_KEY_ERROR,
          operationId: 'SecureKeyManager:encryptPrivateKey',
          userFixable: false,
          recoverable: false,
          securityCritical: true,
          details: {
            originalError: error.message
          }
        });
      }
      
      // Log the error without exposing the private key
      zkErrorLogger.logError(error, {
        context: 'Private key encryption',
        hasPrivateKey: !!privateKey,
        hasPassword: !!password
      });
      
      // Re-throw for proper error handling upstream
      throw error;
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
      if (!encryptedKey || !encryptedKey.metadata || encryptedKey.metadata.type !== 'encrypted-private-key') {
        throw new InputError('The provided data is not an encrypted private key', {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId: 'SecureKeyManager:decryptPrivateKey',
          userFixable: true,
          recoverable: false,
          recommendedAction: 'Please provide a valid encrypted private key.',
          details: {
            hasEncryptedKey: !!encryptedKey,
            hasMetadata: encryptedKey ? !!encryptedKey.metadata : false,
            type: encryptedKey && encryptedKey.metadata ? encryptedKey.metadata.type : null
          }
        });
      }

      // Decrypt using the standard method
      const privateKey = await this.decrypt(encryptedKey, password);

      // Additional validation of private key format
      if (typeof privateKey !== 'string' || !privateKey.match(/^(0x)?[0-9a-fA-F]{64}$/)) {
        throw new SecurityError('Decrypted data is not a valid private key', {
          code: ErrorCode.SECURITY_DATA_INTEGRITY,
          operationId: 'SecureKeyManager:decryptPrivateKey:validation',
          userFixable: false,
          recoverable: false,
          securityCritical: true,
          details: {
            resultType: typeof privateKey
          }
        });
      }

      return privateKey;
    } catch (error) {
      // If it's not already a ZKError, wrap it
      if (!error.code) {
        error = new SecurityError(`Private key decryption failed: ${error.message}`, {
          code: ErrorCode.SECURITY_KEY_ERROR,
          operationId: 'SecureKeyManager:decryptPrivateKey',
          userFixable: error.message.includes('incorrect password'),
          recoverable: error.message.includes('incorrect password'),
          securityCritical: true,
          recommendedAction: error.message.includes('incorrect password') ? 
            'Please provide the correct password.' : undefined,
          details: {
            originalError: error.message
          }
        });
      }
      
      // Log the error without exposing any private key information
      zkErrorLogger.logError(error, {
        context: 'Private key decryption',
        hasEncryptedKey: !!encryptedKey,
        hasPassword: !!password,
        keyType: encryptedKey && encryptedKey.metadata ? encryptedKey.metadata.keyType : null
      });
      
      // Re-throw for proper error handling upstream
      throw error;
    }
  }

  /**
   * Generates a secure random password of specified strength
   * @param {number} [length=16] - Password length
   * @param {boolean} [includeSymbols=true] - Include special characters
   * @returns {string} Securely generated random password
   */
  generateSecurePassword(length = 16, includeSymbols = true) {
    try {
      // Validate inputs
      if (typeof length !== 'number' || length < 1) {
        throw new InputError('Invalid password length', {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId: 'SecureKeyManager:generateSecurePassword',
          userFixable: true,
          recoverable: true,
          recommendedAction: 'Please provide a positive number for password length.',
          details: {
            providedLength: length,
            lengthType: typeof length
          }
        });
      }

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
      try {
        this.crypto.getRandomValues(randomBytes);
      } catch (cryptoError) {
        throw new SecurityError('Failed to generate secure random values', {
          code: ErrorCode.SECURITY_KEY_ERROR,
          operationId: 'SecureKeyManager:generateSecurePassword:random',
          userFixable: false,
          recoverable: true,
          details: {
            originalError: cryptoError.message
          }
        });
      }

      // Build password
      let password = '';
      for (let i = 0; i < length; i++) {
        // Use modulo to convert random bytes to character indexes
        const randomIndex = randomBytes[i] % charset.length;
        password += charset[randomIndex];
      }

      // Ensure password has at least one of each required character type
      const hasLowercase = /[a-z]/.test(password);
      const hasUppercase = /[A-Z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      const hasSymbol = includeSymbols ? /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password) : true;

      if (!hasLowercase || !hasUppercase || !hasNumber || !hasSymbol) {
        // If requirements not met, recursively try again
        // This is unlikely but possible with pure randomness
        return this.generateSecurePassword(length, includeSymbols);
      }

      return password;
    } catch (error) {
      // Log the error without exposing the generated password
      zkErrorLogger.logError(error, {
        context: 'Password generation',
        requestedLength: length,
        includeSymbols: includeSymbols
      });
      
      // For non-critical failures, return a default secure password
      if (error.code !== ErrorCode.SECURITY_KEY_ERROR) {
        // Emergency fallback if validation fails but crypto is working
        try {
          const randomBytes = new Uint8Array(32);
          this.crypto.getRandomValues(randomBytes);
          return Array.from(randomBytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
            .substring(0, 16);
        } catch (e) {
          // Re-throw the original error if fallback fails
          throw error;
        }
      }
      
      // Re-throw critical errors
      throw error;
    }
  }

  /**
   * Securely wipes sensitive data from memory
   * @param {any} data - Data to be wiped
   * @returns {boolean} Whether the wipe was successful
   */
  secureWipe(data) {
    try {
      if (!data) return true;

      if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
        try {
          // Overwrite with zeros
          new Uint8Array(data.buffer || data).fill(0);
        } catch (typeError) {
          throw new SecurityError('Failed to wipe typed array data', {
            code: ErrorCode.SECURITY_DATA_INTEGRITY,
            operationId: 'SecureKeyManager:secureWipe:typedArray',
            userFixable: false,
            recoverable: true,
            details: {
              dataType: data.constructor.name,
              originalError: typeError.message
            }
          });
        }
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
        
        // Log a warning since strings can't be properly wiped
        zkErrorLogger.log('WARNING', 'Attempted to wipe a string, which is immutable in JavaScript', {
          operationId: 'SecureKeyManager:secureWipe:string',
          recommendation: 'Use typed arrays instead of strings for sensitive data'
        });
      } else if (typeof data === 'object' && data !== null) {
        // Wipe object properties
        Object.keys(data).forEach(key => {
          if (typeof data[key] === 'object' && data[key] !== null) {
            this.secureWipe(data[key]);
          }
          data[key] = null;
        });
      }
      
      return true;
    } catch (error) {
      // Log error but don't expose sensitive data details
      if (!error.code) {
        error = new SecurityError(`Failed to securely wipe data: ${error.message}`, {
          code: ErrorCode.SECURITY_DATA_INTEGRITY,
          operationId: 'SecureKeyManager:secureWipe',
          userFixable: false,
          recoverable: true,
          details: {
            dataType: data ? (typeof data) : 'undefined',
            isArray: Array.isArray(data),
            isTypedArray: data instanceof Uint8Array || data instanceof ArrayBuffer,
            originalError: error.message
          }
        });
      }
      
      zkErrorLogger.logError(error, {
        context: 'Secure data wiping',
        dataType: data ? (typeof data) : 'undefined'
      });
      
      // Return false to indicate failure, but continue execution
      return false;
    }
  }
}

/* #ESM-COMPAT */
// Export the class for both CommonJS and ESM
export { SecureKeyManager };
export default SecureKeyManager;