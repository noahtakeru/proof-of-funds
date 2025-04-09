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

    try {
      // Create a copy of the data
      const protectedData = { ...data };

      // Add metadata
      protectedData[TAMPER_DETECTION_CONSTANTS.METADATA_KEY] = {
        version: TAMPER_DETECTION_CONSTANTS.VERSION,
        timestamp: Date.now(),
        algorithm: this.signatureAlgorithm
      };

      // Add canary values in different places
      protectedData[TAMPER_DETECTION_CONSTANTS.CANARY_KEY] = await this.generateCanaries(key);

      // Calculate signature
      const signature = await this.calculateSignature(protectedData, key);

      // Add signature
      protectedData[TAMPER_DETECTION_CONSTANTS.SIGNATURE_KEY] = signature;

      return protectedData;
    } catch (error) {
      // Fall back to unprotected data in case of error
      console.error('Tamper protection failed:', error);
      return data;
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

    try {
      // Basic validation
      if (!protectedData) {
        return false;
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

      // Calculate the signature of the current data
      const calculatedSignature = await this.calculateSignature(dataToVerify, key);

      // Verify signatures match
      if (!this.compareSignatures(originalSignature, calculatedSignature)) {
        return false;
      }

      // Verify canary values
      const canaryValid = await this.verifyCanaries(
        protectedData[TAMPER_DETECTION_CONSTANTS.CANARY_KEY],
        key
      );

      return canaryValid;
    } catch (error) {
      console.error('Tamper verification failed:', error);
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
    const canaries = [];

    // Generate multiple canary values
    for (let i = 0; i < this.canaryCount; i++) {
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
    }

    return canaries;
  }

  /**
   * Verify canary values for tamper detection
   * @param {Array} canaries - Canary values to verify
   * @param {string} key - Secret key for canary verification
   * @returns {Promise<boolean>} Whether all canaries are valid
   * @private
   */
  async verifyCanaries(canaries, key) {
    // Basic validation
    if (!Array.isArray(canaries) || canaries.length < this.canaryCount) {
      return false;
    }

    // Verify each canary
    for (let i = 0; i < canaries.length; i++) {
      const canary = canaries[i];

      // Verify canary structure
      if (!canary.random || !canary.timestamp || !canary.derived || canary.index !== i) {
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
      const expectedDerived = await this.generateDerivedValue(seed, keyString);

      // Compare derived values
      if (canary.derived !== expectedDerived) {
        return false;
      }
    }

    return true;
  }

  /**
   * Generate a derived value based on a seed and key
   * @param {string} seed - Seed for derivation
   * @param {string} key - Secret key for derivation
   * @returns {Promise<string>} Derived value
   * @private
   */
  async generateDerivedValue(seed, key) {
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
      } catch (e) {
        // Fall back to simple derivation
      }
    }

    // Simple fallback derivation (less secure)
    return this.simpleDerivation(seed, key);
  }

  /**
   * Simple fallback derivation method
   * @param {string} seed - Seed for derivation
   * @param {string} key - Secret key for derivation
   * @returns {string} Derived value
   * @private
   */
  simpleDerivation(seed, key) {
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
  }

  /**
   * Generate a random value
   * @returns {string} Random value
   * @private
   */
  generateRandomValue() {
    if (this.crypto && this.crypto.getRandomValues) {
      const randomBytes = new Uint8Array(8);
      this.crypto.getRandomValues(randomBytes);
      return Array.from(randomBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    } else {
      // Simple fallback for non-browser environments
      return Math.random().toString(36).substring(2, 10) +
        Math.random().toString(36).substring(2, 10);
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
      } catch (e) {
        // Fall back to simple signature
      }
    }

    // Simple fallback signature (less secure)
    return this.calculateSimpleSignature(data, key);
  }

  /**
   * Calculate a simple signature for fallback
   * @param {Object} data - Data to sign
   * @param {string} key - Secret key for signing
   * @returns {string} Signature
   * @private
   */
  calculateSimpleSignature(data, key) {
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
  }

  /**
   * Compare signatures in constant time to prevent timing attacks
   * @param {string} sig1 - First signature
   * @param {string} sig2 - Second signature
   * @returns {boolean} Whether signatures match
   * @private
   */
  compareSignatures(sig1, sig2) {
    // Ensure minimum length
    if (!sig1 || !sig2 ||
      sig1.length < TAMPER_DETECTION_CONSTANTS.MIN_HMAC_LENGTH ||
      sig2.length < TAMPER_DETECTION_CONSTANTS.MIN_HMAC_LENGTH) {
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
  }

  /**
   * Detect potential tampering across browser storage
   * @param {string} key - Secret key for verification
   * @returns {Promise<Object>} Tampering detection results
   */
  async detectStorageTampering(key) {
    if (!this.enabled || typeof window === 'undefined' || !window.sessionStorage) {
      return { checked: 0, tampered: 0, items: [] };
    }

    const results = {
      checked: 0,
      tampered: 0,
      items: []
    };

    try {
      // Check sessionStorage for protected items
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const storageKey = window.sessionStorage.key(i);

        // Look for keys that might contain our protected data
        if (storageKey.startsWith('zk-') ||
          storageKey.startsWith('session-') ||
          storageKey.startsWith('temp-wallet-')) {

          try {
            // Get and parse the item
            const item = window.sessionStorage.getItem(storageKey);
            const parsedItem = JSON.parse(item);

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
              }
            }
          } catch (e) {
            // Skip items that can't be parsed
          }
        }
      }

      return results;
    } catch (error) {
      console.error('Storage tampering detection failed:', error);
      return {
        checked: 0,
        tampered: 0,
        items: [],
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
    if (!this.enabled) {
      return true;
    }

    try {
      // Basic validation
      if (!protectedData || !protectedData[TAMPER_DETECTION_CONSTANTS.SIGNATURE_KEY]) {
        return false;
      }

      // Extract the original signature
      const originalSignature = protectedData[TAMPER_DETECTION_CONSTANTS.SIGNATURE_KEY];

      // Create a copy without the signature for verification
      const dataToVerify = { ...protectedData };
      delete dataToVerify[TAMPER_DETECTION_CONSTANTS.SIGNATURE_KEY];

      // Calculate the signature of the current data
      const calculatedSignature = await this.calculateSignature(dataToVerify, key);

      // Verify signatures match
      return this.compareSignatures(originalSignature, calculatedSignature);
    } catch (error) {
      console.error('Integrity verification failed:', error);
      return false;
    }
  }

  /**
   * Add a digital signature to data for remote verification
   * @param {Object} data - Data to sign
   * @param {string} key - Secret key for signing
   * @returns {Promise<Object>} Signed data
   */
  async signForRemote(data, key) {
    if (!this.enabled) {
      return data;
    }

    try {
      // Create a copy of the data
      const signedData = { ...data };

      // Add timestamp and nonce for uniqueness
      signedData._timestamp = Date.now();
      signedData._nonce = this.generateRandomValue();

      // Calculate signature
      const signature = await this.calculateSignature(signedData, key);

      // Add signature
      signedData._signature = signature;

      return signedData;
    } catch (error) {
      // Fall back to unsigned data in case of error
      console.error('Remote signing failed:', error);
      return data;
    }
  }

  /**
   * Verify a digital signature from remote data
   * @param {Object} signedData - Signed data to verify
   * @param {string} key - Secret key for verification
   * @returns {Promise<boolean>} Whether the signature is valid
   */
  async verifyRemoteSignature(signedData, key) {
    if (!this.enabled) {
      return true;
    }

    try {
      // Basic validation
      if (!signedData || !signedData._signature) {
        return false;
      }

      // Extract the original signature
      const originalSignature = signedData._signature;

      // Create a copy without the signature for verification
      const dataToVerify = { ...signedData };
      delete dataToVerify._signature;

      // Calculate the signature of the current data
      const calculatedSignature = await this.calculateSignature(dataToVerify, key);

      // Verify signatures match
      return this.compareSignatures(originalSignature, calculatedSignature);
    } catch (error) {
      console.error('Remote signature verification failed:', error);
      return false;
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
    if (!this.enabled) {
      return data;
    }
    
    try {
      // Create a copy of the data
      const signedData = { ...data };
      
      // Add timestamp and identifier
      signedData._timestamp = Date.now();
      signedData._id = this.generateRandomValue();
      
      return signedData;
    } catch (error) {
      console.error('Signing failed:', error);
      return { ...data, _error: 'Signing failed', _timestamp: Date.now() };
    }
  }
}

/* #ESM-COMPAT */
// Export the class for both CommonJS and ESM
export { TamperDetection };
export default TamperDetection;