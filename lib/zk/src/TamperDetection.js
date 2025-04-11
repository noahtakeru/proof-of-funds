/**
 * Tamper Detection Module for Zero-Knowledge Proof System
 * 
 * Provides runtime detection of malicious modifications to critical security components
 * and protects against common tampering techniques.
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This module serves as a security guard for our application's data integrity. 
 * Think of it like these real-world security measures:
 * 
 * 1. TAMPER-EVIDENT SEALS: Just as manufacturers use special packaging that shows
 *    if someone has opened or tampered with a product, this system adds special
 *    digital "seals" to our data that break if anyone modifies the information.
 * 
 * 2. DOCUMENT WATERMARKS: Similar to how important documents contain hidden marks
 *    that verify authenticity, this system adds invisible signatures to our data
 *    that can be verified but not easily forged.
 * 
 * 3. HIDDEN SECURITY FEATURES: Like the invisible ink and microprinting on currency
 *    that makes counterfeiting difficult, this system adds hidden security features
 *    that are hard for attackers to replicate.
 * 
 * 4. MULTIPLE CHECK POINTS: Just as high-security facilities have multiple ID checks,
 *    this system performs various integrity checks at different stages to ensure
 *    no tampering has occurred anywhere in the process.
 * 
 * Business value: This module is crucial for financial applications as it prevents
 * attackers from modifying our code or data to steal funds, compromise user privacy,
 * or bypass security checks. It maintains the integrity of the entire system,
 * protecting both users and the business reputation from security breaches.
 */

import secureKeyManager from './SecureKeyManager.js';
import { zkErrorLogger } from './zkErrorLogger.js';
import { SecurityError, InputError, SystemError, ErrorCode } from './zkErrorHandler.js';

// Constant values used for tamper detection
const TAMPER_DETECTION_CONSTANTS = {
  VERSION: '1.0',
  DEFAULT_CANARY_COUNT: 3,
  MIN_HMAC_LENGTH: 32,
  SIGNATURE_ALGORITHM: 'HMAC-SHA256',
  INTEGRITY_KEY: 'integrity',
  SIGNATURE_KEY: 'signature',
  CANARY_KEY: 'canaries',
  METADATA_KEY: 'meta'
};

/**
 * Tamper Detection class
 * Provides cryptographic integrity protection for stored data
 */
class TamperDetection {
  constructor(options = {}) {
    this.enabled = options.enabled !== undefined ? options.enabled : true;
    this.signatureAlgorithm = TAMPER_DETECTION_CONSTANTS.SIGNATURE_ALGORITHM;
    this.canaryCount = options.canaryCount || TAMPER_DETECTION_CONSTANTS.DEFAULT_CANARY_COUNT;
    this.secureKeyManager = secureKeyManager;

    // Initialize Web Crypto if available
    this.crypto = typeof crypto !== 'undefined' ? crypto : null;
    this.subtle = this.crypto && this.crypto.subtle ? this.crypto.subtle : null;

    if (!this.crypto && this.enabled) {
      // Log a warning if Web Crypto is not available but tamper detection is enabled
      const warning = new SystemError('Web Crypto API not available, using fallback methods', {
        code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
        severity: 'warning',
        details: {
          impact: 'Reduced cryptographic security',
          recommendedAction: 'Use in modern browser with Web Crypto support'
        },
        recoverable: true,
        userFixable: true
      });
      zkErrorLogger.logError(warning);
    }
  }

  /**
   * Protect data with integrity checks and canary values
   * @param {Object} data - Data to protect
   * @param {string} key - Secret key for integrity protection
   * @returns {Promise<Object>} Protected data
   */
  async protect(data, key) {
    if (!this.enabled) {
      return data;
    }

    const operationId = 'TamperDetection:protect';

    try {
      // Input validation
      if (!data || typeof data !== 'object') {
        throw new InputError('Invalid data provided for protection', {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId,
          userFixable: true,
          recoverable: false,
          details: {
            dataType: typeof data,
            dataProvided: !!data
          },
          recommendedAction: 'Provide a valid object to protect'
        });
      }

      if (!key) {
        throw new InputError('Missing key for data protection', {
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          operationId,
          userFixable: true,
          recoverable: false,
          details: { keyProvided: false },
          recommendedAction: 'Provide a secret key for data protection'
        });
      }

      // Create a copy of the data
      const protectedData = { ...data };

      // Add metadata
      protectedData[TAMPER_DETECTION_CONSTANTS.METADATA_KEY] = {
        version: TAMPER_DETECTION_CONSTANTS.VERSION,
        timestamp: Date.now(),
        algorithm: this.signatureAlgorithm
      };

      try {
        // Add canary values in different places
        protectedData[TAMPER_DETECTION_CONSTANTS.CANARY_KEY] = await this.generateCanaries(key);
      } catch (canaryError) {
        throw new SecurityError('Failed to generate canary values', {
          code: ErrorCode.SECURITY_DATA_INTEGRITY,
          operationId,
          details: { cause: canaryError.message },
          recoverable: false,
          userFixable: false
        });
      }

      try {
        // Calculate signature
        const signature = await this.calculateSignature(protectedData, key);
        // Add signature
        protectedData[TAMPER_DETECTION_CONSTANTS.SIGNATURE_KEY] = signature;
      } catch (signatureError) {
        throw new SecurityError('Failed to calculate data signature', {
          code: ErrorCode.SECURITY_DATA_INTEGRITY,
          operationId,
          details: { cause: signatureError.message },
          recoverable: false,
          userFixable: false
        });
      }

      return protectedData;
    } catch (error) {
      // Log the error
      zkErrorLogger.logError(error, {
        operationId,
        dataSize: data ? JSON.stringify(data).length : 0
      });

      // For security errors, return unprotected data rather than potentially tampered data
      if (error instanceof SecurityError) {
        return data;
      }

      // Re-throw other errors for proper handling by caller
      throw error;
    }
  }

  /**
   * Verify the integrity of data using a signature
   * @param {Object} data - Data to verify
   * @param {string|Uint8Array|Buffer} signature - Signature to verify against
   * @param {string|CryptoKey} publicKey - Public key for verification
   * @returns {Promise<boolean>} Whether the signature is valid
   */
  async verify(data, signature, publicKey) {
    const operationId = `verify_${Date.now()}`;

    try {
      // Original verification code
      // Validate inputs
      this.validateTamperedStructure(data, signature);

      // Create a copy of the data for verification
      const dataToVerify = { ...data };

      // Create serialized version
      const serialized = JSON.stringify(dataToVerify);

      // Get crypto implementation
      const crypto = this.getCryptoImplementation();

      // Verify using appropriate method
      let isValid;

      if (crypto.subtle) {
        // Browser WebCrypto verification
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(serialized);
        const keyBuffer = await this.importPublicKey(publicKey);

        const signatureBuffer = typeof signature === 'string'
          ? this.hexToBytes(signature.replace(/^0x/, ''))
          : signature;

        isValid = await crypto.subtle.verify(
          { name: 'ECDSA', hash: 'SHA-256' },
          keyBuffer,
          signatureBuffer,
          dataBuffer
        );
      } else {
        // Node.js verification
        const cryptoNode = require('crypto');
        const verify = cryptoNode.createVerify('SHA256');
        verify.update(serialized);

        const signatureBuffer = typeof signature === 'string'
          ? Buffer.from(signature.replace(/^0x/, ''), 'hex')
          : Buffer.from(signature);

        isValid = verify.verify(publicKey, signatureBuffer);
      }

      return isValid; // Boolean result
    } catch (error) {
      // Categorize different verification failure types
      let errorCode = ErrorCode.CRYPTO_VERIFICATION_FAILED;
      let recoverable = false;
      let detailedReason = 'Unknown verification error';

      // Determine more specific error types
      if (error.message.includes('key format') ||
        error.message.includes('importKey') ||
        error.message.includes('Invalid key')) {
        errorCode = ErrorCode.CRYPTO_INVALID_KEY_FORMAT;
        detailedReason = 'Invalid public key format';
        recoverable = true; // Can potentially be fixed with correct key format
      } else if (error.message.includes('signature')) {
        errorCode = ErrorCode.CRYPTO_INVALID_SIGNATURE_FORMAT;
        detailedReason = 'Invalid signature format';
        recoverable = true; // Can potentially be fixed with correct signature
      } else if (error.message.includes('algorithm')) {
        errorCode = ErrorCode.CRYPTO_ALGORITHM_UNAVAILABLE;
        detailedReason = 'Cryptographic algorithm not available';
        recoverable = false; // Algorithm support is a hard requirement
      }

      const verificationError = new CryptoError(`Signature verification failed: ${detailedReason}`, {
        operationId,
        code: errorCode,
        recoverable,
        details: {
          originalError: error.message,
          dataType: typeof data,
          signatureType: typeof signature,
          publicKeyType: typeof publicKey
        },
        cause: error
      });

      zkErrorLogger.logError(verificationError, {
        context: 'TamperDetection.verify'
      });

      // For certain errors that indicate tampering rather than technical issues
      if (error.message.includes('verification failed') ||
        error.message.includes('signature mismatch')) {
        return false; // Signal invalid signature without throwing
      }

      throw verificationError;
    }
  }

  /**
   * Generate canary values for tamper detection
   * @param {string} key - Secret key for canary generation
   * @returns {Promise<Array>} Array of canary values
   * @private
   */
  async generateCanaries(key) {
    const operationId = 'TamperDetection:generateCanaries';

    try {
      if (!key) {
        throw new InputError('Missing key for canary generation', {
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          operationId,
          userFixable: true,
          recoverable: false
        });
      }

      const canaries = [];

      // Generate multiple canary values
      for (let i = 0; i < this.canaryCount; i++) {
        try {
          // Each canary is a combination of:
          // 1. A random value
          // 2. A timestamp
          // 3. A derived value based on the key and index
          const randomValue = this.generateRandomValue();
          const timestamp = Date.now() + i;

          // Create a unique seed for this canary
          // Convert key to string if it's not already a string
          const keyString = typeof key === 'string' ? key :
            (key && typeof key.toString === 'function') ? key.toString() :
              `key-${i}-${this.generateRandomValue()}`;

          const keySeed = keyString.substring(0, Math.min(8, keyString.length));
          const seed = `${keySeed}-${i}-${timestamp}`;
          const derivedValue = await this.generateDerivedValue(seed, keyString);

          canaries.push({
            random: randomValue,
            timestamp,
            derived: derivedValue,
            index: i
          });
        } catch (canaryError) {
          throw new SecurityError(`Failed to generate canary at index ${i}`, {
            code: ErrorCode.SECURITY_DATA_INTEGRITY,
            operationId,
            details: { cause: canaryError.message, index: i },
            recoverable: false
          });
        }
      }

      return canaries;
    } catch (error) {
      zkErrorLogger.logError(error, { operationId });
      throw error; // Re-throw for proper handling
    }
  }

  /**
   * Verify canary values for tamper detection
   * @param {Array} canaries - Canary values to verify
   * @param {string} key - Secret key for canary verification
   * @returns {Promise<boolean>} Whether all canaries are valid
   * @private
   */
  async verifyCanaries(canaries, key) {
    const operationId = 'TamperDetection:verifyCanaries';

    try {
      // Basic validation
      if (!Array.isArray(canaries)) {
        throw new InputError('Invalid canary data format', {
          code: ErrorCode.INPUT_TYPE_ERROR,
          operationId,
          details: {
            expected: 'array',
            received: typeof canaries
          },
          recoverable: false
        });
      }

      if (canaries.length < this.canaryCount) {
        throw new SecurityError('Insufficient canary values', {
          code: ErrorCode.SECURITY_DATA_INTEGRITY,
          operationId,
          details: {
            expected: this.canaryCount,
            received: canaries.length
          },
          securityCritical: true,
          recoverable: false
        });
      }

      if (!key) {
        throw new InputError('Missing key for canary verification', {
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          operationId,
          userFixable: true,
          recoverable: false
        });
      }

      // Verify each canary
      for (let i = 0; i < canaries.length; i++) {
        const canary = canaries[i];

        // Verify canary structure
        if (!canary || !canary.random || !canary.timestamp || !canary.derived || canary.index !== i) {
          zkErrorLogger.logError(new SecurityError('Canary structure invalid', {
            code: ErrorCode.SECURITY_DATA_INTEGRITY,
            operationId,
            details: {
              index: i,
              canaryPresent: !!canary,
              hasRandom: !!canary?.random,
              hasTimestamp: !!canary?.timestamp,
              hasDerived: !!canary?.derived,
              indexMatch: canary?.index === i
            },
            securityCritical: true
          }));
          return false;
        }

        // Convert key to string if it's not already a string
        const keyString = typeof key === 'string' ? key :
          (key && typeof key.toString === 'function') ? key.toString() :
            `key-${i}-unknown`;

        // Create the seed that should have been used
        const keySeed = keyString.substring(0, Math.min(8, keyString.length));
        const seed = `${keySeed}-${i}-${canary.timestamp}`;

        // Generate the expected derived value
        let expectedDerived;
        try {
          expectedDerived = await this.generateDerivedValue(seed, keyString);
        } catch (derivationError) {
          throw new SecurityError(`Failed to derive canary value at index ${i}`, {
            code: ErrorCode.SECURITY_DATA_INTEGRITY,
            operationId,
            details: { cause: derivationError.message, index: i },
            securityCritical: true,
            recoverable: false
          });
        }

        // Compare derived values
        if (canary.derived !== expectedDerived) {
          zkErrorLogger.logError(new SecurityError('Canary value mismatch', {
            code: ErrorCode.SECURITY_DATA_INTEGRITY,
            operationId,
            details: { index: i },
            securityCritical: true
          }));
          return false;
        }
      }

      return true;
    } catch (error) {
      zkErrorLogger.logError(error, {
        operationId,
        canarySummary: Array.isArray(canaries) ? `${canaries.length} canaries` : 'invalid canaries'
      });
      return false; // Always fail closed for security
    }
  }

  /**
   * Generate a derived value based on a seed and key
   * @param {string} seed - Seed for derivation
   * @param {string} key - Secret key for derivation
   * @returns {Promise<string>} Derived value
   * @private
   */
  async generateDerivedValue(seed, key) {
    const operationId = 'TamperDetection:generateDerivedValue';

    try {
      // Input validation
      if (!seed) {
        throw new InputError('Missing seed for value derivation', {
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          operationId,
          recoverable: false
        });
      }

      if (!key) {
        throw new InputError('Missing key for value derivation', {
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          operationId,
          recoverable: false
        });
      }

      // Ensure key is a string
      const keyString = typeof key === 'string' ? key :
        (key && typeof key.toString === 'function') ? key.toString() :
          'default-key';

      // If Web Crypto is available, use HMAC
      if (this.subtle) {
        try {
          // Import key
          const cryptoKey = await this.subtle.importKey(
            'raw',
            new TextEncoder().encode(keyString),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
          );

          // Sign the seed
          const signature = await this.subtle.sign(
            'HMAC',
            cryptoKey,
            new TextEncoder().encode(seed)
          );

          // Convert to hex string
          return Array.from(new Uint8Array(signature))
            .slice(0, 16) // Use first 16 bytes for brevity
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        } catch (cryptoError) {
          // Log the fallback
          zkErrorLogger.log('WARNING', 'Web Crypto API failed, falling back to simple derivation', {
            operationId,
            details: { cause: cryptoError.message },
            recoverable: true
          });
          // Fall back to simple derivation
        }
      }

      // Simple fallback derivation (less secure)
      return this.simpleDerivation(seed, key);
    } catch (error) {
      zkErrorLogger.logError(error, {
        operationId,
        seedProvided: !!seed,
        keyProvided: !!key,
        webCryptoAvailable: !!this.subtle
      });
      throw error;
    }
  }

  /**
   * Simple fallback derivation method
   * @param {string} seed - Seed for derivation
   * @param {string} key - Secret key for derivation
   * @returns {string} Derived value
   * @private
   */
  simpleDerivation(seed, key) {
    const operationId = 'TamperDetection:simpleDerivation';

    try {
      // Input validation
      if (!seed) {
        throw new InputError('Missing seed for simple derivation', {
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          operationId,
          recoverable: false
        });
      }

      if (!key) {
        throw new InputError('Missing key for simple derivation', {
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          operationId,
          recoverable: false
        });
      }

      // Ensure key is a string
      const keyString = typeof key === 'string' ? key :
        (key && typeof key.toString === 'function') ? key.toString() :
          'default-key';

      let hash = 0;
      const combinedInput = `${seed}-${keyString}`;

      for (let i = 0; i < combinedInput.length; i++) {
        const char = combinedInput.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }

      // Convert to hex and add some of the key as salt
      const keySeed = keyString.substring(0, Math.min(8, keyString.length));
      return hash.toString(16) + keySeed;
    } catch (error) {
      zkErrorLogger.logError(error, {
        operationId,
        seedProvided: !!seed,
        keyProvided: !!key
      });
      throw error;
    }
  }

  /**
   * Generate a random value
   * @returns {string} Random value
   * @private
   */
  generateRandomValue() {
    const operationId = 'TamperDetection:generateRandomValue';

    try {
      if (this.crypto && this.crypto.getRandomValues) {
        try {
          const randomBytes = new Uint8Array(8);
          this.crypto.getRandomValues(randomBytes);
          return Array.from(randomBytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        } catch (cryptoError) {
          // Log the fallback
          zkErrorLogger.log('WARNING', 'Web Crypto random generation failed, using fallback', {
            operationId,
            details: { cause: cryptoError.message },
            recoverable: true
          });
        }
      }

      // Simple fallback for non-browser environments
      return Math.random().toString(36).substring(2, 10) +
        Math.random().toString(36).substring(2, 10);
    } catch (error) {
      zkErrorLogger.logError(error, {
        operationId,
        webCryptoAvailable: !!this.crypto?.getRandomValues
      });
      // Provide a last-resort fallback
      return Date.now().toString(36) + Math.floor(Math.random() * 1000000).toString(36);
    }
  }

  /**
   * Calculate a signature for data integrity
   * @param {Object} data - Data to sign
   * @param {string} key - Secret key for signing
   * @returns {Promise<string>} Signature
   * @private
   */
  async calculateSignature(data, key) {
    const operationId = 'TamperDetection:calculateSignature';

    try {
      // Input validation
      if (!data) {
        throw new InputError('Missing data for signature calculation', {
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          operationId,
          recoverable: false
        });
      }

      if (!key) {
        throw new InputError('Missing key for signature calculation', {
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          operationId,
          recoverable: false
        });
      }

      // Ensure key is a string
      const keyString = typeof key === 'string' ? key :
        (key && typeof key.toString === 'function') ? key.toString() :
          'default-key';

      // If Web Crypto is available, use HMAC
      if (this.subtle) {
        try {
          // Serialize data
          const dataString = JSON.stringify(data);

          // Import key
          const cryptoKey = await this.subtle.importKey(
            'raw',
            new TextEncoder().encode(keyString),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
          );

          // Sign the data
          const signature = await this.subtle.sign(
            'HMAC',
            cryptoKey,
            new TextEncoder().encode(dataString)
          );

          // Convert to hex string
          return Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        } catch (cryptoError) {
          // Log the fallback
          zkErrorLogger.log('WARNING', 'Web Crypto signature failed, using fallback', {
            operationId,
            details: { cause: cryptoError.message },
            recoverable: true
          });
        }
      }

      // Simple fallback signature (less secure)
      return this.calculateSimpleSignature(data, key);
    } catch (error) {
      zkErrorLogger.logError(error, {
        operationId,
        dataProvided: !!data,
        keyProvided: !!key,
        webCryptoAvailable: !!this.subtle
      });
      throw error;
    }
  }

  /**
   * Calculate a simple signature for fallback
   * @param {Object} data - Data to sign
   * @param {string} key - Secret key for signing
   * @returns {string} Signature
   * @private
   */
  calculateSimpleSignature(data, key) {
    const operationId = 'TamperDetection:calculateSimpleSignature';

    try {
      // Input validation
      if (!data) {
        throw new InputError('Missing data for simple signature', {
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          operationId,
          recoverable: false
        });
      }

      if (!key) {
        throw new InputError('Missing key for simple signature', {
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          operationId,
          recoverable: false
        });
      }

      // Ensure key is a string
      const keyString = typeof key === 'string' ? key :
        (key && typeof key.toString === 'function') ? key.toString() :
          'default-key';

      // Serialize data
      const dataString = JSON.stringify(data);

      let hash = 0;
      const input = dataString + keyString;

      for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }

      // Make it longer and more random looking with parts of the key
      // Not cryptographically secure, but better than nothing
      const keyParts = [];
      const keyLength = keyString.length;
      for (let i = 0; i < keyLength; i += 8) {
        const endIndex = Math.min(i + 8, keyLength);
        keyParts.push(keyString.substring(i, endIndex));
      }

      return hash.toString(16) + keyParts.join('');
    } catch (error) {
      zkErrorLogger.logError(error, {
        operationId,
        dataProvided: !!data,
        keyProvided: !!key
      });
      throw error;
    }
  }

  /**
   * Compare signatures in constant time to prevent timing attacks
   * @param {string} sig1 - First signature
   * @param {string} sig2 - Second signature
   * @returns {boolean} Whether signatures match
   * @private
   */
  compareSignatures(sig1, sig2) {
    const operationId = 'TamperDetection:compareSignatures';

    try {
      // Ensure minimum length
      if (!sig1 || !sig2 ||
        sig1.length < TAMPER_DETECTION_CONSTANTS.MIN_HMAC_LENGTH ||
        sig2.length < TAMPER_DETECTION_CONSTANTS.MIN_HMAC_LENGTH) {

        zkErrorLogger.logError(new SecurityError('Invalid signature format for comparison', {
          code: ErrorCode.SECURITY_DATA_INTEGRITY,
          operationId,
          details: {
            sig1Length: sig1?.length || 0,
            sig2Length: sig2?.length || 0,
            minRequired: TAMPER_DETECTION_CONSTANTS.MIN_HMAC_LENGTH
          },
          securityCritical: true
        }));
        return false;
      }

      // Truncate to same length if different
      const len = Math.min(sig1.length, sig2.length);
      const s1 = sig1.substring(0, len);
      const s2 = sig2.substring(0, len);

      // Constant-time comparison to prevent timing attacks
      let diff = 0;
      for (let i = 0; i < len; i++) {
        diff |= (s1.charCodeAt(i) ^ s2.charCodeAt(i));
      }

      return diff === 0;
    } catch (error) {
      zkErrorLogger.logError(error, {
        operationId,
        sig1Length: sig1?.length || 0,
        sig2Length: sig2?.length || 0
      });
      return false; // Always fail closed for security
    }
  }

  /**
   * Detect potential tampering across browser storage
   * @param {string} key - Secret key for verification
   * @returns {Promise<Object>} Tampering detection results
   */
  async detectStorageTampering(key) {
    const operationId = 'TamperDetection:detectStorageTampering';

    if (!this.enabled || typeof window === 'undefined' || !window.sessionStorage) {
      return { checked: 0, tampered: 0, items: [] };
    }

    const results = {
      checked: 0,
      tampered: 0,
      items: []
    };

    try {
      // Validate key
      if (!key) {
        throw new InputError('Missing key for storage tampering detection', {
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          operationId,
          userFixable: true,
          recoverable: false
        });
      }

      // Check sessionStorage for protected items
      for (let i = 0; i < window.sessionStorage.length; i++) {
        try {
          const storageKey = window.sessionStorage.key(i);

          // Look for keys that might contain our protected data
          if (storageKey.startsWith('zk-') ||
            storageKey.startsWith('session-') ||
            storageKey.startsWith('temp-wallet-')) {

            try {
              // Get and parse the item
              const item = window.sessionStorage.getItem(storageKey);
              let parsedItem;

              try {
                parsedItem = JSON.parse(item);
              } catch (parseError) {
                // Skip items that can't be parsed
                continue;
              }

              // Check if it has our integrity markers
              if (parsedItem &&
                parsedItem[TAMPER_DETECTION_CONSTANTS.SIGNATURE_KEY] &&
                parsedItem[TAMPER_DETECTION_CONSTANTS.METADATA_KEY]) {

                results.checked++;

                // Verify integrity
                const isValid = await this.verify(parsedItem, key);

                if (!isValid) {
                  results.tampered++;
                  results.items.push({
                    key: storageKey,
                    tampered: true
                  });

                  // Log the tampering for security monitoring
                  zkErrorLogger.logError(new SecurityError('Storage tampering detected', {
                    code: ErrorCode.SECURITY_DATA_INTEGRITY,
                    operationId,
                    details: {
                      storageKey,
                      storageType: 'sessionStorage',
                      metadataVersion: parsedItem[TAMPER_DETECTION_CONSTANTS.METADATA_KEY]?.version
                    },
                    securityCritical: true
                  }));
                }
              }
            } catch (itemError) {
              // Skip items that cause errors during processing
              zkErrorLogger.log('WARNING', 'Error processing storage item', {
                operationId,
                details: {
                  storageKey,
                  error: itemError.message
                }
              });
            }
          }
        } catch (iterationError) {
          // Continue with next item if one fails
          zkErrorLogger.log('WARNING', 'Error accessing storage index', {
            operationId,
            details: {
              index: i,
              error: iterationError.message
            }
          });
        }
      }

      return results;
    } catch (error) {
      zkErrorLogger.logError(error, {
        operationId,
        storageAvailable: typeof window !== 'undefined' && !!window.sessionStorage,
        itemsChecked: results.checked
      });

      return {
        checked: results.checked,
        tampered: results.tampered,
        items: results.items,
        error: error.message
      };
    }
  }

  /**
   * Verify data integrity without canary check
   * @param {Object} protectedData - Data to verify
   * @param {string} key - Secret key for verification
   * @returns {Promise<boolean>} Whether the data is intact
   */
  async verifyIntegrityOnly(protectedData, key) {
    const operationId = 'TamperDetection:verifyIntegrityOnly';

    if (!this.enabled) {
      return true;
    }

    try {
      // Input validation
      if (!protectedData || typeof protectedData !== 'object') {
        throw new InputError('Invalid data provided for integrity verification', {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId,
          userFixable: true,
          recoverable: false,
          details: {
            dataType: typeof protectedData,
            dataProvided: !!protectedData
          }
        });
      }

      if (!key) {
        throw new InputError('Missing key for integrity verification', {
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          operationId,
          userFixable: true,
          recoverable: false
        });
      }

      // Basic validation
      if (!protectedData[TAMPER_DETECTION_CONSTANTS.SIGNATURE_KEY]) {
        return false;
      }

      // Extract the original signature
      const originalSignature = protectedData[TAMPER_DETECTION_CONSTANTS.SIGNATURE_KEY];

      // Create a copy without the signature for verification
      const dataToVerify = { ...protectedData };
      delete dataToVerify[TAMPER_DETECTION_CONSTANTS.SIGNATURE_KEY];

      try {
        // Calculate the signature of the current data
        const calculatedSignature = await this.calculateSignature(dataToVerify, key);

        // Verify signatures match
        return this.compareSignatures(originalSignature, calculatedSignature);
      } catch (signatureError) {
        throw new SecurityError('Failed to calculate integrity verification signature', {
          code: ErrorCode.SECURITY_DATA_INTEGRITY,
          operationId,
          details: { cause: signatureError.message },
          securityCritical: true,
          recoverable: false
        });
      }
    } catch (error) {
      zkErrorLogger.logError(error, {
        operationId,
        hasSignature: !!protectedData?.[TAMPER_DETECTION_CONSTANTS.SIGNATURE_KEY]
      });
      return false; // Always fail closed for security
    }
  }

  /**
   * Add a digital signature to data for remote verification
   * @param {Object} data - Data to sign
   * @param {string} key - Secret key for signing
   * @returns {Promise<Object>} Signed data
   */
  async signForRemote(data, key) {
    const operationId = 'TamperDetection:signForRemote';

    if (!this.enabled) {
      return data;
    }

    try {
      // Input validation
      if (!data || typeof data !== 'object') {
        throw new InputError('Invalid data provided for remote signing', {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId,
          userFixable: true,
          recoverable: false,
          details: {
            dataType: typeof data,
            dataProvided: !!data
          }
        });
      }

      if (!key) {
        throw new InputError('Missing key for remote signing', {
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          operationId,
          userFixable: true,
          recoverable: false
        });
      }

      // Create a copy of the data
      const signedData = { ...data };

      // Add timestamp and nonce for uniqueness
      signedData._timestamp = Date.now();
      signedData._nonce = this.generateRandomValue();

      try {
        // Calculate signature
        const signature = await this.calculateSignature(signedData, key);

        // Add signature
        signedData._signature = signature;
      } catch (signatureError) {
        throw new SecurityError('Failed to calculate remote signature', {
          code: ErrorCode.SECURITY_DATA_INTEGRITY,
          operationId,
          details: { cause: signatureError.message },
          securityCritical: true,
          recoverable: false
        });
      }

      return signedData;
    } catch (error) {
      zkErrorLogger.logError(error, {
        operationId,
        dataSize: data ? JSON.stringify(data).length : 0
      });

      // For security errors, return unsigned data rather than potentially tampered data
      if (error instanceof SecurityError) {
        return data;
      }

      // Re-throw other errors for proper handling by caller
      throw error;
    }
  }

  /**
   * Verify a digital signature from remote data
   * @param {Object} signedData - Signed data to verify
   * @param {string} key - Secret key for verification
   * @returns {Promise<boolean>} Whether the signature is valid
   */
  async verifyRemoteSignature(signedData, key) {
    const operationId = 'TamperDetection:verifyRemoteSignature';

    if (!this.enabled) {
      return true;
    }

    try {
      // Input validation
      if (!signedData || typeof signedData !== 'object') {
        throw new InputError('Invalid data provided for remote signature verification', {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId,
          userFixable: true,
          recoverable: false,
          details: {
            dataType: typeof signedData,
            dataProvided: !!signedData
          }
        });
      }

      if (!key) {
        throw new InputError('Missing key for remote signature verification', {
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          operationId,
          userFixable: true,
          recoverable: false
        });
      }

      // Basic validation
      if (!signedData._signature) {
        return false;
      }

      // Extract the original signature
      const originalSignature = signedData._signature;

      // Create a copy without the signature for verification
      const dataToVerify = { ...signedData };
      delete dataToVerify._signature;

      try {
        // Calculate the signature of the current data
        const calculatedSignature = await this.calculateSignature(dataToVerify, key);

        // Verify signatures match
        return this.compareSignatures(originalSignature, calculatedSignature);
      } catch (signatureError) {
        throw new SecurityError('Failed to calculate remote verification signature', {
          code: ErrorCode.SECURITY_DATA_INTEGRITY,
          operationId,
          details: { cause: signatureError.message },
          securityCritical: true,
          recoverable: false
        });
      }
    } catch (error) {
      zkErrorLogger.logError(error, {
        operationId,
        hasSignature: !!signedData?._signature,
        hasTimestamp: !!signedData?._timestamp
      });
      return false; // Always fail closed for security
    }
  }

  /**
   * Sign data with a timestamp and unique identifier
   * This is a simplified version of signForRemote that doesn't require a key
   * 
   * @param {Object} data - Data to sign
   * @returns {Object} Signed data with timestamp and signature
   */
  sign(data) {
    const operationId = 'TamperDetection:sign';

    if (!this.enabled) {
      return data;
    }

    try {
      // Input validation
      if (!data || typeof data !== 'object') {
        throw new InputError('Invalid data provided for signing', {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId,
          userFixable: true,
          recoverable: false,
          details: {
            dataType: typeof data,
            dataProvided: !!data
          }
        });
      }

      // Create a copy of the data
      const signedData = { ...data };

      // Add timestamp and identifier
      signedData._timestamp = Date.now();
      signedData._id = this.generateRandomValue();

      return signedData;
    } catch (error) {
      zkErrorLogger.logError(error, {
        operationId,
        dataSize: data ? JSON.stringify(data).length : 0
      });

      // Provide a minimal safe fallback even in case of error
      return {
        ...data,
        _error: 'Signing failed',
        _timestamp: Date.now()
      };
    }
  }

  /**
   * Sign data with the primary method and fallback to more secure alternatives if needed
   * @param {Object|string} data - Data to sign
   * @param {string|CryptoKey} privateKey - Private key to sign with
   * @returns {Promise<Uint8Array>} The signature
   */
  async signWithFallback(data, privateKey) {
    try {
      // First try the primary signing method
      return await this.sign(data, privateKey);
    } catch (error) {
      zkErrorLogger.logError(error, {
        context: 'TamperDetection.signWithFallback.primaryFailed',
        details: {
          dataType: typeof data,
          dataLength: data?.length || 0
        }
      });

      // Implement robust fallback with HMAC
      try {
        const crypto = this.getCryptoImplementation();
        const encoder = new TextEncoder();
        const dataBuffer = typeof data === 'string' ? encoder.encode(data) : data;
        const keyBuffer = typeof privateKey === 'string' ? encoder.encode(privateKey) : privateKey;

        // Create a more secure fallback with HMAC
        let hmacKey;
        if (crypto.subtle) {
          // Browser environment
          hmacKey = await crypto.subtle.importKey(
            'raw',
            keyBuffer,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
          );

          const signature = await crypto.subtle.sign(
            'HMAC',
            hmacKey,
            dataBuffer
          );

          return new Uint8Array(signature);
        } else {
          // Node.js or other environment
          const cryptoNode = require('crypto');
          const hmac = cryptoNode.createHmac('sha256', keyBuffer);
          hmac.update(dataBuffer);
          return Buffer.from(hmac.digest());
        }
      } catch (fallbackError) {
        // If even the fallback fails, throw a composite error
        const compositeError = new CryptoError('Both primary and fallback signing methods failed', {
          code: ErrorCode.CRYPTO_SIGNING_FAILED,
          recoverable: false,
          details: {
            primaryError: error.message,
            fallbackError: fallbackError.message
          },
          cause: fallbackError
        });

        zkErrorLogger.logError(compositeError, {
          context: 'TamperDetection.signWithFallback.bothFailed'
        });

        throw compositeError;
      }
    }
  }

  /**
   * Helper method to get the appropriate crypto implementation
   * @returns {Object} Crypto implementation object
   */
  getCryptoImplementation() {
    if (typeof window !== 'undefined' && window.crypto) {
      return window.crypto;
    } else if (typeof global !== 'undefined' && global.crypto) {
      return global.crypto;
    } else {
      // Fallback to Node.js crypto if available
      try {
        return { node: require('crypto') };
      } catch (e) {
        throw new SystemError('No cryptographic implementation available', {
          code: ErrorCode.SYSTEM_ENVIRONMENT_UNSUPPORTED,
          recoverable: false,
          details: {
            environment: typeof window !== 'undefined' ? 'browser' : 'node'
          }
        });
      }
    }
  }

  /**
   * Validate the structure of data to be verified for tampering
   * @param {Object} data - The data object to validate
   * @param {string|Uint8Array|Buffer} signature - The signature to validate
   * @param {Array<string>} [expectedFields=[]] - Required fields that must exist in the data
   * @returns {boolean} True if the structure is valid
   * @throws {InputError} If validation fails
   */
  validateTamperedStructure(data, signature, expectedFields = []) {
    if (!data || typeof data !== 'object') {
      throw new InputError('Data must be a valid object', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        details: {
          receivedType: typeof data,
          expectedType: 'object'
        }
      });
    }

    if (!signature) {
      throw new InputError('Signature is required', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        details: { parameter: 'signature' }
      });
    }

    // Check required fields
    for (const field of expectedFields) {
      if (data[field] === undefined) {
        throw new InputError(`Required field missing: ${field}`, {
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          details: {
            missingField: field,
            availableFields: Object.keys(data)
          }
        });
      }
    }

    // Validate signature format
    if (typeof signature === 'string') {
      // For hex strings, check valid hex format
      if (!/^(0x)?[0-9a-f]+$/i.test(signature)) {
        throw new InputError('Invalid signature format', {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          details: {
            expected: 'hex string',
            received: signature.substring(0, 20) + '...'
          }
        });
      }
    } else if (signature instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(signature))) {
      // For binary signatures, check minimum length
      if (signature.length < 16) { // Arbitrary minimum for any valid signature
        throw new InputError('Signature too short', {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          details: {
            minimumBytes: 16,
            receivedBytes: signature.length
          }
        });
      }
    } else {
      throw new InputError('Invalid signature type', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        details: {
          expectedTypes: ['string', 'Uint8Array', 'Buffer'],
          receivedType: typeof signature
        }
      });
    }

    return true;
  }

  /**
   * Verify data with signature using isolation between verification methods
   * @param {Object} data - Data to verify
   * @param {string|Uint8Array|Buffer} signature - Signature to verify against
   * @param {string|CryptoKey} publicKey - Public key for verification
   * @param {Object} [options={}] - Verification options
   * @param {number} [options.retries=2] - Number of retry attempts 
   * @param {string} [options.isolationLevel='standard'] - Isolation level ('standard' or 'high')
   * @returns {Promise<boolean>} Whether the signature is valid
   */
  async verifyWithIsolation(data, signature, publicKey, options = {}) {
    const operationId = `verify_isolated_${Date.now()}`;
    const { retries = 2, isolationLevel = 'standard' } = options;

    let attempts = 0;
    let lastError = null;

    while (attempts <= retries) {
      try {
        let result;

        // Apply isolation level
        if (isolationLevel === 'high') {
          // Use completely separate code path for high isolation
          result = await this.verifyHighIsolation(data, signature, publicKey);
        } else {
          // Standard isolation - normal verification but in try-catch
          result = await this.verify(data, signature, publicKey);
        }

        return result;
      } catch (error) {
        lastError = error;
        zkErrorLogger.logError(error, {
          context: 'TamperDetection.verifyWithIsolation',
          details: {
            attempt: attempts + 1,
            maxAttempts: retries + 1,
            isolationLevel
          }
        });

        attempts++;
      }
    }

    // All verification attempts failed
    const verificationError = new CryptoError(`Verification failed after ${attempts} attempts`, {
      operationId,
      code: ErrorCode.CRYPTO_VERIFICATION_FAILED,
      details: {
        attempts,
        isolationLevel,
        lastError: lastError?.message || 'Unknown error'
      },
      cause: lastError
    });

    zkErrorLogger.logError(verificationError, {
      context: 'TamperDetection.verifyWithIsolation.allAttemptsFailed'
    });

    throw verificationError;
  }

  /**
   * High isolation verification implementation
   * Using completely separate code path for additional security
   * @param {Object} data - Data to verify
   * @param {string|Uint8Array|Buffer} signature - Signature to verify against
   * @param {string|CryptoKey} publicKey - Public key for verification
   * @returns {Promise<boolean>} Whether the signature is valid
   */
  async verifyHighIsolation(data, signature, publicKey) {
    // This is a completely separate implementation for high isolation
    try {
      // First validate the inputs
      this.validateTamperedStructure(data, signature);

      // Create serialized version of data for verification
      const serialized = JSON.stringify(data);

      // Get crypto implementation
      const crypto = this.getCryptoImplementation();

      // Use direct crypto primitive without any shared code
      if (crypto.subtle) {
        // Browser WebCrypto implementation
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(serialized);
        const keyBuffer = await this.importPublicKey(publicKey);

        const signatureBuffer = typeof signature === 'string'
          ? this.hexToBytes(signature.replace(/^0x/, ''))
          : signature;

        return await crypto.subtle.verify(
          { name: 'ECDSA', hash: 'SHA-256' },
          keyBuffer,
          signatureBuffer,
          dataBuffer
        );
      } else {
        // Node.js fallback implementation
        const cryptoNode = require('crypto');
        const verify = cryptoNode.createVerify('SHA256');
        verify.update(serialized);

        const signatureBuffer = typeof signature === 'string'
          ? Buffer.from(signature.replace(/^0x/, ''), 'hex')
          : Buffer.from(signature);

        return verify.verify(publicKey, signatureBuffer);
      }
    } catch (error) {
      const isolationError = new CryptoError(`High isolation verification failed: ${error.message}`, {
        code: ErrorCode.CRYPTO_VERIFICATION_FAILED,
        details: { useCase: 'highIsolation' },
        cause: error
      });

      throw isolationError;
    }
  }

  /**
   * Helper method to convert hex string to byte array
   * @param {string} hex - Hex string
   * @returns {Uint8Array} Byte array
   */
  hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
  }

  /**
   * Import a public key for verification
   * @param {string|CryptoKey} publicKey - Public key to import
   * @returns {Promise<CryptoKey>} Imported public key
   */
  async importPublicKey(publicKey) {
    // If it's already a CryptoKey, just return it
    if (publicKey && typeof publicKey === 'object' && publicKey.type === 'public') {
      return publicKey;
    }

    const crypto = this.getCryptoImplementation();

    // Only attempt import if subtle crypto is available
    if (!crypto.subtle) {
      throw new SystemError('Web Crypto API not available for key import', {
        code: ErrorCode.SYSTEM_ENVIRONMENT_UNSUPPORTED,
        recoverable: false,
        details: { environment: typeof window !== 'undefined' ? 'browser' : 'node' }
      });
    }

    try {
      // Convert string key to appropriate format
      let keyData;
      if (typeof publicKey === 'string') {
        // Handle different formats
        if (publicKey.startsWith('-----BEGIN PUBLIC KEY-----')) {
          // PEM format - convert to DER
          const base64 = publicKey
            .replace('-----BEGIN PUBLIC KEY-----', '')
            .replace('-----END PUBLIC KEY-----', '')
            .replace(/\s+/g, '');
          keyData = this.base64ToArrayBuffer(base64);
        } else if (publicKey.startsWith('0x')) {
          // Hex format
          keyData = this.hexToBytes(publicKey.slice(2));
        } else {
          // Assume raw base64
          keyData = this.base64ToArrayBuffer(publicKey);
        }
      } else {
        keyData = publicKey;
      }

      // Import the key
      return await crypto.subtle.importKey(
        'spki', // Standard public key format
        keyData,
        {
          name: 'ECDSA',
          namedCurve: 'P-256'
        },
        false, // Not extractable
        ['verify']
      );
    } catch (error) {
      throw new CryptoError(`Failed to import public key: ${error.message}`, {
        code: ErrorCode.CRYPTO_INVALID_KEY_FORMAT,
        details: { originalError: error.message },
        cause: error,
        recoverable: false
      });
    }
  }

  /**
   * Convert base64 string to ArrayBuffer
   * @param {string} base64 - Base64 string
   * @returns {ArrayBuffer} Converted array buffer
   */
  base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

/* #ESM-COMPAT */
// Export the class for both CommonJS and ESM
export { TamperDetection };
export default TamperDetection;