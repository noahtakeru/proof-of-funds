/**
 * Secure Key Manager for Zero-Knowledge Proof System (CommonJS Version)
 * 
 * This module provides robust cryptographic key management for securing sensitive wallet data.
 * It implements industry-standard encryption using Web Crypto API with AES-GCM and PBKDF2.
 */

const zkErrorHandlerModule = require('./zkErrorHandler.cjs');
const {
  SecurityError,
  InputError,
  CompatibilityError,
  ErrorCode
} = zkErrorHandlerModule;

const zkErrorLoggerModule = require('./zkErrorLogger.cjs');
const zkErrorLogger = zkErrorLoggerModule.default || zkErrorLoggerModule;

// Using window.crypto for cryptographic operations when available
const crypto = typeof window !== 'undefined' ? window.crypto :
  typeof global !== 'undefined' && global.crypto ? global.crypto :
    null;

/**
 * SecureKeyManager class handles encryption, decryption, and secure management of keys
 * using the Web Crypto API with defense-in-depth approach.
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

    // Initialize circuit breaker state
    this.circuitBreaker = {
      failures: 0,
      lastFailure: 0,
      maxFailures: 3,
      resetTimeMs: 60000, // 1 minute
      tripped: false
    };
  }

  /**
   * Check if circuit breaker is tripped
   * @returns {boolean} - True if the circuit breaker is tripped and operations should be rejected
   */
  isCircuitBreakerTripped() {
    // Reset circuit breaker after timeout
    if (this.circuitBreaker.tripped &&
      Date.now() - this.circuitBreaker.lastFailure > this.circuitBreaker.resetTimeMs) {
      this.circuitBreaker.tripped = false;
      this.circuitBreaker.failures = 0;
    }

    return this.circuitBreaker.tripped;
  }

  /**
   * Record a failure and possibly trip the circuit breaker
   */
  recordFailure() {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = Date.now();

    if (this.circuitBreaker.failures >= this.circuitBreaker.maxFailures) {
      this.circuitBreaker.tripped = true;

      // Log that circuit breaker has tripped
      zkErrorLogger.log('WARNING', 'Crypto circuit breaker tripped due to repeated failures', {
        context: 'SecureKeyManager.circuitBreaker',
        details: {
          failures: this.circuitBreaker.failures,
          resetTimeMs: this.circuitBreaker.resetTimeMs
        }
      });
    }
  }

  /**
   * Detect the current JavaScript environment
   * @returns {string} The environment type: 'node', 'browser', or 'unknown'
   */
  detectEnvironment() {
    if (typeof window === 'undefined' && typeof process !== 'undefined') {
      return 'node';
    } else if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      return 'browser';
    } else {
      return 'unknown';
    }
  }

  /**
   * Derive a cryptographic key from a password using environment-specific implementation
   * @param {string} password - The password to derive the key from
   * @param {Uint8Array|Array} salt - The salt value to use in key derivation
   * @param {number} [iterations=100000] - Iterations for the key derivation (higher is more secure but slower)
   * @returns {Promise<CryptoKey>} The derived key
   */
  async deriveKey(password, salt, iterations = 100000) {
    const environment = this.detectEnvironment();

    if (environment === 'node') {
      return this.deriveKeyNode(password, salt, iterations);
    } else if (environment === 'browser') {
      return this.deriveKeyBrowser(password, salt, iterations);
    } else {
      throw new SystemError('Unsupported environment for cryptographic operations', {
        code: ErrorCode.SYSTEM_ENVIRONMENT_UNSUPPORTED,
        recoverable: false
      });
    }
  }

  /**
   * Node.js specific key derivation implementation
   * @param {string} password - The password to derive the key from
   * @param {Uint8Array|Array} salt - The salt value to use in key derivation
   * @param {number} iterations - Iterations for the key derivation
   * @returns {Promise<Buffer>} The derived key
   */
  async deriveKeyNode(password, salt, iterations) {
    try {
      // Use Node.js crypto module in CJS format
      const crypto = require('crypto');

      // Convert password to Buffer if it's a string
      const passwordBuffer = typeof password === 'string'
        ? Buffer.from(password, 'utf8')
        : password;

      // Convert salt to Buffer if it's a string or array
      const saltBuffer = typeof salt === 'string'
        ? Buffer.from(salt, 'utf8')
        : Array.isArray(salt)
          ? Buffer.from(salt)
          : salt;

      // Use Node.js pbkdf2 function
      return new Promise((resolve, reject) => {
        crypto.pbkdf2(
          passwordBuffer,
          saltBuffer,
          iterations,
          32, // 256 bits
          'sha256',
          (err, derivedKey) => {
            if (err) reject(err);
            else resolve(derivedKey);
          }
        );
      });
    } catch (error) {
      const derivationError = new CryptoError(`Failed to derive key in Node.js: ${error.message}`, {
        code: ErrorCode.CRYPTO_KEY_DERIVATION_FAILED,
        details: { iterations },
        cause: error
      });

      zkErrorLogger.logError(derivationError, {
        context: 'SecureKeyManager.deriveKeyNode'
      });

      throw derivationError;
    }
  }

  /**
   * Browser specific key derivation implementation
   * @param {string} password - The password to derive the key from
   * @param {Uint8Array|Array} salt - The salt value to use in key derivation
   * @param {number} iterations - Iterations for the key derivation
   * @returns {Promise<CryptoKey>} The derived key
   */
  async deriveKeyBrowser(password, salt, iterations) {
    try {
      // Convert password to appropriate format
      const passwordBuffer = typeof password === 'string'
        ? new TextEncoder().encode(password)
        : password;

      // Convert salt to Uint8Array if it's an array
      const saltBuffer = Array.isArray(salt)
        ? new Uint8Array(salt)
        : salt;

      // Import password as key material
      const keyMaterial = await this.crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        { name: this.keyDerivationAlgorithm },
        false,
        ['deriveBits', 'deriveKey']
      );

      // Derive the actual encryption key using PBKDF2
      const key = await this.crypto.subtle.deriveKey(
        {
          name: this.keyDerivationAlgorithm,
          salt: saltBuffer,
          iterations: iterations,
          hash: this.hashAlgorithm
        },
        keyMaterial,
        { name: this.encryptionAlgorithm, length: this.keyLength },
        false, // Not extractable
        ['encrypt', 'decrypt']
      );

      return key;
    } catch (error) {
      const derivationError = new CryptoError(`Failed to derive key in browser: ${error.message}`, {
        code: ErrorCode.CRYPTO_KEY_DERIVATION_FAILED,
        details: { iterations },
        cause: error
      });

      zkErrorLogger.logError(derivationError, {
        context: 'SecureKeyManager.deriveKeyBrowser'
      });

      throw derivationError;
    }
  }

  /**
   * Generates a strong encryption key using password-based key derivation
   * @param {string} password - Secret used for key derivation
   * @param {Uint8Array} [salt] - Optional salt for key derivation, will be generated if not provided
   * @returns {Promise<{key: CryptoKey, salt: Uint8Array}>} The derived key and salt
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
   */
  async encrypt(data, password) {
    try {
      // Check if circuit breaker is tripped
      if (this.isCircuitBreakerTripped()) {
        throw new CryptoError('Crypto operations temporarily disabled due to repeated failures', {
          code: ErrorCode.CRYPTO_CIRCUIT_BREAKER_TRIPPED,
          recoverable: true,
          retryAfterMs: this.circuitBreaker.resetTimeMs - (Date.now() - this.circuitBreaker.lastFailure)
        });
      }

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

      try {
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
      } catch (cryptoError) {
        // Record the failure in the circuit breaker
        this.recordFailure();

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
    } finally {
      // Clear sensitive data from memory
      this.clearSensitiveData();
    }
  }

  /**
   * Decrypts data that was encrypted with the encrypt method
   * @param {Object} encryptedData - The encrypted data object
   * @param {string} password - Password used for encryption
   * @returns {Promise<string|Object>} Decrypted data
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
   * Decrypts a private key using the provided password
   * @param {Object} encryptedKey - The encrypted key object with salt, iv, etc.
   * @param {string} password - The password to decrypt with
   * @returns {Promise<string>} The decrypted private key
   */
  async decryptPrivateKey(encryptedKey, password) {
    const operationId = `decrypt_key_${Date.now()}`;

    try {
      // Validate inputs
      if (!encryptedKey) {
        throw new InputError('Encrypted key is required', {
          operationId,
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          details: { parameter: 'encryptedKey' }
        });
      }

      if (!password) {
        throw new InputError('Password is required', {
          operationId,
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          details: { parameter: 'password' }
        });
      }

      // Original decryption code
      const salt = encryptedKey.salt;
      const iv = encryptedKey.iv;
      const key = await this.deriveKey(password, salt);

      // Convert stored array format back to Uint8Array
      const ivBytes = new Uint8Array(iv);
      const ciphertextBytes = new Uint8Array(encryptedKey.ciphertext);

      try {
        // Decrypt the data
        const decryptedBytes = await this.crypto.subtle.decrypt(
          {
            name: this.encryptionAlgorithm,
            iv: ivBytes
          },
          key,
          ciphertextBytes
        );

        // Convert decrypted bytes to string
        const decryptedKey = new TextDecoder().decode(decryptedBytes);

        return decryptedKey;
      } catch (cryptoError) {
        throw new SecurityError('Failed to decrypt the private key', {
          code: ErrorCode.SECURITY_DECRYPTION_FAILED,
          operationId,
          details: {
            algorithm: this.encryptionAlgorithm,
            originalError: cryptoError.message
          },
          cause: cryptoError,
          recoverable: false,
          userFixable: false
        });
      }
    } catch (error) {
      if (error instanceof InputError) {
        throw error; // Rethrow validated errors
      }

      // Create a proper error for other cases
      const decryptError = new CryptoError(`Failed to decrypt private key: ${error.message}`, {
        operationId,
        code: ErrorCode.CRYPTO_DECRYPTION_FAILED,
        details: { cause: error.message },
        cause: error,
        recoverable: false
      });

      zkErrorLogger.logError(decryptError, {
        context: 'SecureKeyManager.decryptPrivateKey'
      });

      throw decryptError;
    } finally {
      // Memory safety: Clear sensitive variables
      this.clearSensitiveData();
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

  /**
   * Clears sensitive data from memory to prevent leaks
   * This method should be called after operations that handle sensitive data
   */
  clearSensitiveData() {
    // Create an array of property names that might contain sensitive data
    const sensitiveProps = [
      'currentKey',
      '_tempKey',
      '_privateKeyCache',
      '_encryptionKey'
    ];

    // Clear each property if it exists
    for (const prop of sensitiveProps) {
      if (this[prop]) {
        if (typeof this[prop] === 'string') {
          // Overwrite string with zeros
          this[prop] = '0'.repeat(this[prop].length);
        } else if (this[prop] instanceof Uint8Array) {
          // Overwrite typed array with zeros
          this[prop].fill(0);
        } else if (typeof this[prop] === 'object') {
          // For objects, set each property to null
          for (const key in this[prop]) {
            this[prop][key] = null;
          }
        }

        // Set to null to allow garbage collection
        this[prop] = null;
      }
    }

    // Force garbage collection if possible
    if (typeof global !== 'undefined' && global.gc) {
      try {
        global.gc();
      } catch (e) {
        // Ignore if not available
      }
    }
  }
}

// Export for CommonJS
module.exports = SecureKeyManager;
module.exports.default = SecureKeyManager;
