/**
 * Request Signature Verifier
 * 
 * This module provides cryptographic request signing and verification for
 * server-side ZK API endpoints to ensure request authenticity and integrity.
 */

import crypto from 'crypto';

/**
 * RequestSignatureVerifier class for creating and validating
 * signatures for API requests to prevent tampering.
 */
class RequestSignatureVerifier {
  /**
   * Create a new RequestSignatureVerifier instance
   * 
   * @param {Object} options - Configuration options
   * @param {string} [options.algorithm='sha256'] - Hash algorithm to use
   * @param {number} [options.signatureMaxAgeMs=300000] - Maximum age for signatures (5 minutes)
   * @param {Object} [options.keyPairs={}] - Map of client IDs to their public keys
   * @param {string} [options.serverSecretKey] - Server's secret key for HMAC signing
   */
  constructor(options = {}) {
    this.algorithm = options.algorithm || 'sha256';
    this.signatureMaxAgeMs = options.signatureMaxAgeMs || 300000; // 5 minutes
    this.keyPairs = new Map(Object.entries(options.keyPairs || {}));
    this.serverSecretKey = options.serverSecretKey || this._generateServerKey();
    
    // Statistics tracking
    this.stats = {
      totalVerifications: 0,
      validSignatures: 0,
      invalidSignatures: 0,
      expiredSignatures: 0,
      unknownClients: 0
    };
  }
  
  /**
   * Generate a random server key if none provided
   * @private
   */
  _generateServerKey() {
    return crypto.randomBytes(32).toString('hex');
  }
  
  /**
   * Register a new client public key
   * 
   * @param {string} clientId - Client identifier
   * @param {string} publicKey - Client's public key (PEM format)
   */
  registerClientKey(clientId, publicKey) {
    if (!clientId || typeof clientId !== 'string') {
      throw new Error('Client ID must be a non-empty string');
    }
    
    if (!publicKey || typeof publicKey !== 'string') {
      throw new Error('Public key must be a non-empty string');
    }
    
    // Store the public key
    this.keyPairs.set(clientId, publicKey);
    
    return true;
  }
  
  /**
   * Remove a client's public key
   * 
   * @param {string} clientId - Client identifier
   * @returns {boolean} True if client was removed, false if not found
   */
  removeClient(clientId) {
    return this.keyPairs.delete(clientId);
  }
  
  /**
   * Generate a request signature using the server's secret key (HMAC)
   * 
   * @param {Object} requestData - Request data to sign
   * @param {Object} [options] - Signing options
   * @param {string} [options.timestamp] - Optional timestamp to use instead of current time
   * @returns {Object} Signature data
   */
  signRequest(requestData, options = {}) {
    const timestamp = options.timestamp || Date.now().toString();
    const dataToSign = this._prepareDataToSign(requestData, timestamp);
    
    // Create HMAC signature
    const hmac = crypto.createHmac(this.algorithm, this.serverSecretKey);
    hmac.update(dataToSign);
    const signature = hmac.digest('hex');
    
    return {
      signature,
      timestamp,
      algorithm: this.algorithm
    };
  }
  
  /**
   * Verify a request signature from a client
   * 
   * @param {Object} requestData - Original request data
   * @param {Object} signatureInfo - Signature information
   * @param {string} signatureInfo.signature - Signature value
   * @param {string} signatureInfo.timestamp - Timestamp when signature was created
   * @param {string} signatureInfo.clientId - Client identifier
   * @param {string} [signatureInfo.algorithm] - Algorithm used for signing
   * @returns {Object} Verification result with status and message
   */
  verifyClientSignature(requestData, signatureInfo) {
    this.stats.totalVerifications++;
    
    // Basic validation
    if (!signatureInfo || !signatureInfo.signature || !signatureInfo.timestamp || !signatureInfo.clientId) {
      this.stats.invalidSignatures++;
      return {
        valid: false,
        reason: 'MISSING_SIGNATURE_INFO',
        message: 'Signature information is incomplete'
      };
    }
    
    // Check if client is registered
    if (!this.keyPairs.has(signatureInfo.clientId)) {
      this.stats.unknownClients++;
      return {
        valid: false,
        reason: 'UNKNOWN_CLIENT',
        message: 'Client is not registered'
      };
    }
    
    // Check signature age
    const timestamp = parseInt(signatureInfo.timestamp, 10);
    if (isNaN(timestamp)) {
      this.stats.invalidSignatures++;
      return {
        valid: false,
        reason: 'INVALID_TIMESTAMP',
        message: 'Signature timestamp is not a valid number'
      };
    }
    
    const now = Date.now();
    if (now - timestamp > this.signatureMaxAgeMs) {
      this.stats.expiredSignatures++;
      return {
        valid: false,
        reason: 'EXPIRED_SIGNATURE',
        message: `Signature expired (created ${Math.round((now - timestamp) / 1000)} seconds ago)`
      };
    }
    
    try {
      // Get client's public key
      const publicKey = this.keyPairs.get(signatureInfo.clientId);
      
      // Prepare the data that was signed
      const dataToVerify = this._prepareDataToSign(requestData, signatureInfo.timestamp);
      
      // Verify signature using public key
      const verifier = crypto.createVerify(signatureInfo.algorithm || this.algorithm);
      verifier.update(dataToVerify);
      
      const isValid = verifier.verify(
        publicKey,
        signatureInfo.signature,
        'hex'
      );
      
      if (isValid) {
        this.stats.validSignatures++;
        return {
          valid: true,
          message: 'Signature verified successfully'
        };
      } else {
        this.stats.invalidSignatures++;
        return {
          valid: false,
          reason: 'INVALID_SIGNATURE',
          message: 'Signature verification failed'
        };
      }
    } catch (error) {
      this.stats.invalidSignatures++;
      return {
        valid: false,
        reason: 'VERIFICATION_ERROR',
        message: `Error verifying signature: ${error.message}`,
        error: error.message
      };
    }
  }
  
  /**
   * Verify a server-generated HMAC signature
   * 
   * @param {Object} requestData - Original request data
   * @param {Object} signatureInfo - Signature information
   * @param {string} signatureInfo.signature - Signature value
   * @param {string} signatureInfo.timestamp - Timestamp when signature was created
   * @returns {Object} Verification result with status and message
   */
  verifyServerSignature(requestData, signatureInfo) {
    this.stats.totalVerifications++;
    
    // Basic validation
    if (!signatureInfo || !signatureInfo.signature || !signatureInfo.timestamp) {
      this.stats.invalidSignatures++;
      return {
        valid: false,
        reason: 'MISSING_SIGNATURE_INFO',
        message: 'Signature information is incomplete'
      };
    }
    
    // Check signature age
    const timestamp = parseInt(signatureInfo.timestamp, 10);
    if (isNaN(timestamp)) {
      this.stats.invalidSignatures++;
      return {
        valid: false,
        reason: 'INVALID_TIMESTAMP',
        message: 'Signature timestamp is not a valid number'
      };
    }
    
    const now = Date.now();
    if (now - timestamp > this.signatureMaxAgeMs) {
      this.stats.expiredSignatures++;
      return {
        valid: false,
        reason: 'EXPIRED_SIGNATURE',
        message: `Signature expired (created ${Math.round((now - timestamp) / 1000)} seconds ago)`
      };
    }
    
    try {
      // Prepare the data that was signed
      const dataToVerify = this._prepareDataToSign(requestData, signatureInfo.timestamp);
      
      // Create HMAC with server key
      const hmac = crypto.createHmac(signatureInfo.algorithm || this.algorithm, this.serverSecretKey);
      hmac.update(dataToVerify);
      const expectedSignature = hmac.digest('hex');
      
      // Compare signatures
      const isValid = crypto.timingSafeEqual(
        Buffer.from(signatureInfo.signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
      
      if (isValid) {
        this.stats.validSignatures++;
        return {
          valid: true,
          message: 'Signature verified successfully'
        };
      } else {
        this.stats.invalidSignatures++;
        return {
          valid: false,
          reason: 'INVALID_SIGNATURE',
          message: 'Signature verification failed'
        };
      }
    } catch (error) {
      this.stats.invalidSignatures++;
      return {
        valid: false,
        reason: 'VERIFICATION_ERROR',
        message: `Error verifying signature: ${error.message}`,
        error: error.message
      };
    }
  }
  
  /**
   * Generate a client key pair for testing/development
   * 
   * @returns {Object} Object containing public and private keys
   */
  generateClientKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
    
    return { publicKey, privateKey };
  }
  
  /**
   * Create a client signature for a request
   * 
   * @param {Object} requestData - Request data to sign
   * @param {string} privateKey - Client's private key
   * @param {Object} [options] - Signing options
   * @param {string} [options.clientId] - Client identifier
   * @param {string} [options.timestamp] - Optional timestamp to use
   * @returns {Object} Signature data
   */
  createClientSignature(requestData, privateKey, options = {}) {
    const timestamp = options.timestamp || Date.now().toString();
    const dataToSign = this._prepareDataToSign(requestData, timestamp);
    
    // Create signature
    const signer = crypto.createSign(this.algorithm);
    signer.update(dataToSign);
    const signature = signer.sign(privateKey, 'hex');
    
    return {
      signature,
      timestamp,
      clientId: options.clientId || 'anonymous',
      algorithm: this.algorithm
    };
  }
  
  /**
   * Prepare data for signing in a consistent format
   * 
   * @param {Object} data - Data to sign
   * @param {string} timestamp - Timestamp for the signature
   * @returns {string} String representation of data to sign
   * @private
   */
  _prepareDataToSign(data, timestamp) {
    // Create a canonical representation of the data
    // Include timestamp to prevent replay attacks
    const canonicalData = {
      ...data,
      _timestamp: timestamp
    };
    
    // Sort keys to ensure consistent ordering
    return JSON.stringify(canonicalData, Object.keys(canonicalData).sort());
  }
  
  /**
   * Get statistics about signature verification
   * 
   * @returns {Object} Verification statistics
   */
  getStats() {
    const totalVerifications = this.stats.totalVerifications;
    const successRate = totalVerifications > 0
      ? (this.stats.validSignatures / totalVerifications * 100).toFixed(2) + '%'
      : '0%';
    
    return {
      ...this.stats,
      successRate,
      registeredClients: this.keyPairs.size
    };
  }
  
  /**
   * Reset verification statistics
   */
  resetStats() {
    this.stats = {
      totalVerifications: 0,
      validSignatures: 0,
      invalidSignatures: 0,
      expiredSignatures: 0,
      unknownClients: 0
    };
  }
}

// Create singleton instance for global use
const signatureVerifier = new RequestSignatureVerifier();

export { RequestSignatureVerifier, signatureVerifier };
export default signatureVerifier;