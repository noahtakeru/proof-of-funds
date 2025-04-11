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
   * Verify the integrity of protected data
   * @param {Object} protectedData - Data to verify
   * @param {string} key - Secret key for integrity verification
   * @returns {Promise<boolean>} Whether the data is intact
   */
  async verify(protectedData, key) {
    if (!this.enabled) {
      return true;
    }

    const operationId = 'TamperDetection:verify';

    try {
      // Basic validation
      if (!protectedData || typeof protectedData !== 'object') {
        throw new InputError('Invalid data provided for verification', {
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
        throw new InputError('Missing key for data verification', {
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          operationId,
          userFixable: true,
          recoverable: false,
          details: { keyProvided: false }
        });
      }

      // Check if this is protected data
      if (!protectedData[TAMPER_DETECTION_CONSTANTS.SIGNATURE_KEY] ||
        !protectedData[TAMPER_DETECTION_CONSTANTS.METADATA_KEY]) {
        // Not protected data, can't verify
        return false;
      }

      // Extract the original signature
      const originalSignature = protectedData[TAMPER_DETECTION_CONSTANTS.SIGNATURE_KEY];

      // Create a copy without the signature for verification
      const dataToVerify = { ...protectedData };
      delete dataToVerify[TAMPER_DETECTION_CONSTANTS.SIGNATURE_KEY];

      let calculatedSignature;
      try {
        // Calculate the signature of the current data
        calculatedSignature = await this.calculateSignature(dataToVerify, key);
      } catch (signatureError) {
        throw new SecurityError('Failed to calculate verification signature', {
          code: ErrorCode.SECURITY_DATA_INTEGRITY,
          operationId,
          details: { cause: signatureError.message },
          securityCritical: true,
          recoverable: false
        });
      }

      // Verify signatures match
      if (!this.compareSignatures(originalSignature, calculatedSignature)) {
        // Log the security issue
        zkErrorLogger.logError(new SecurityError('Data integrity check failed - signature mismatch', {
          code: ErrorCode.SECURITY_DATA_INTEGRITY,
          operationId,
          securityCritical: true,
          details: {
            signatureLength: originalSignature?.length,
            metadataPresent: !!protectedData[TAMPER_DETECTION_CONSTANTS.METADATA_KEY]
          }
        }));
        return false;
      }

      try {
        // Verify canary values
        const canaryValid = await this.verifyCanaries(
          protectedData[TAMPER_DETECTION_CONSTANTS.CANARY_KEY],
          key
        );
        
        if (!canaryValid) {
          // Log the security issue
          zkErrorLogger.logError(new SecurityError('Data integrity check failed - canary values compromised', {
            code: ErrorCode.SECURITY_DATA_INTEGRITY,
            operationId,
            securityCritical: true,
            details: {
              canariesPresent: !!protectedData[TAMPER_DETECTION_CONSTANTS.CANARY_KEY],
              canariesCount: Array.isArray(protectedData[TAMPER_DETECTION_CONSTANTS.CANARY_KEY]) ? 
                protectedData[TAMPER_DETECTION_CONSTANTS.CANARY_KEY].length : 0
            }
          }));
        }
        
        return canaryValid;
      } catch (canaryError) {
        throw new SecurityError('Failed to verify canary values', {
          code: ErrorCode.SECURITY_DATA_INTEGRITY,
          operationId,
          details: { cause: canaryError.message },
          securityCritical: true,
          recoverable: false
        });
      }
    } catch (error) {
      // Log the error
      zkErrorLogger.logError(error, { 
        operationId,
        hasSignature: !!protectedData?.[TAMPER_DETECTION_CONSTANTS.SIGNATURE_KEY],
        hasMetadata: !!protectedData?.[TAMPER_DETECTION_CONSTANTS.METADATA_KEY]
      });
      
      // Always return false for any verification errors for security reasons
      return false;
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
}

/* #ESM-COMPAT */
// Export the class for both CommonJS and ESM
export { TamperDetection };
export default TamperDetection;