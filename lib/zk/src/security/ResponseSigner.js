/**
 * Response Signer for ZK API Endpoints
 * 
 * This module provides cryptographic signing of server responses to
 * protect against man-in-the-middle (MITM) attacks and tampering.
 */

import crypto from 'crypto';

/**
 * ResponseSigner class for signing and verifying server responses
 */
class ResponseSigner {
  /**
   * Create a new ResponseSigner instance
   * 
   * @param {Object} options - Configuration options 
   * @param {string} [options.algorithm='sha256'] - Hash algorithm to use
   * @param {string} [options.secretKey] - Secret key for signing responses
   * @param {number} [options.keyRotationInterval=86400000] - Key rotation interval in ms (1 day)
   */
  constructor(options = {}) {
    this.algorithm = options.algorithm || 'sha256';
    this.secretKey = options.secretKey || this._generateKey();
    this.previousKey = null; // Store previous key during rotation period
    this.keyGeneratedAt = Date.now();
    this.keyRotationInterval = options.keyRotationInterval || 86400000; // 1 day
    
    // Set up periodic key rotation
    this.rotationTimer = setInterval(() => this._rotateKey(), this.keyRotationInterval);
    
    // Statistics for monitoring
    this.stats = {
      totalSigned: 0,
      totalVerified: 0,
      validSignatures: 0,
      invalidSignatures: 0,
      rotationCount: 0
    };
  }
  
  /**
   * Generate a new secret key
   * @private
   * @returns {string} New secret key
   */
  _generateKey() {
    return crypto.randomBytes(32).toString('hex');
  }
  
  /**
   * Rotate the signing key
   * @private
   */
  _rotateKey() {
    this.previousKey = this.secretKey;
    this.secretKey = this._generateKey();
    this.keyGeneratedAt = Date.now();
    this.stats.rotationCount++;
  }
  
  /**
   * Sign a response to protect against tampering
   * 
   * @param {Object} responseData - Response data to sign
   * @returns {Object} The same response with added signature information
   */
  signResponse(responseData) {
    this.stats.totalSigned++;
    
    // Don't modify error responses with status codes
    if (responseData.error || responseData.statusCode >= 400) {
      return responseData;
    }
    
    const timestamp = Date.now().toString();
    
    // Create HMAC signature
    const hmac = crypto.createHmac(this.algorithm, this.secretKey);
    
    // Remove any existing signature (in case of re-signing)
    const { signature, signatureTimestamp, signatureAlgorithm, ...dataToSign } = responseData;
    
    // Create canonical representation for signing
    const canonicalData = {
      ...dataToSign,
      _timestamp: timestamp
    };
    
    // Sort keys to ensure consistent ordering
    const dataString = JSON.stringify(canonicalData, Object.keys(canonicalData).sort());
    
    hmac.update(dataString);
    const computedSignature = hmac.digest('hex');
    
    // Return original data with signature added
    return {
      ...responseData,
      signature: computedSignature,
      signatureTimestamp: timestamp,
      signatureAlgorithm: this.algorithm
    };
  }
  
  /**
   * Verify a signed response to detect tampering
   * 
   * @param {Object} responseData - Signed response to verify
   * @returns {Object} Verification result
   */
  verifyResponse(responseData) {
    this.stats.totalVerified++;
    
    // Basic validation
    if (!responseData || !responseData.signature || !responseData.signatureTimestamp) {
      this.stats.invalidSignatures++;
      return {
        valid: false,
        reason: 'MISSING_SIGNATURE',
        message: 'Response lacks signature information'
      };
    }
    
    const { signature, signatureTimestamp, signatureAlgorithm, ...dataToVerify } = responseData;
    
    // Create canonical data for verification
    const canonicalData = {
      ...dataToVerify,
      _timestamp: signatureTimestamp
    };
    
    // Sort keys for consistent ordering
    const dataString = JSON.stringify(canonicalData, Object.keys(canonicalData).sort());
    
    // Try with current key
    let hmac = crypto.createHmac(signatureAlgorithm || this.algorithm, this.secretKey);
    hmac.update(dataString);
    let expectedSignature = hmac.digest('hex');
    
    // Check if signature matches current key
    let isValid = signature === expectedSignature;
    
    // If not valid and we have a previous key (during rotation period), try that one
    if (!isValid && this.previousKey) {
      hmac = crypto.createHmac(signatureAlgorithm || this.algorithm, this.previousKey);
      hmac.update(dataString);
      expectedSignature = hmac.digest('hex');
      isValid = signature === expectedSignature;
    }
    
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
  }
  
  /**
   * Get statistics about signing/verification
   * 
   * @returns {Object} Statistics
   */
  getStats() {
    const verificationRate = this.stats.totalVerified > 0
      ? (this.stats.validSignatures / this.stats.totalVerified * 100).toFixed(2) + '%'
      : '0%';
    
    return {
      ...this.stats,
      verificationSuccessRate: verificationRate,
      lastKeyRotation: new Date(this.keyGeneratedAt).toISOString(),
      nextKeyRotation: new Date(this.keyGeneratedAt + this.keyRotationInterval).toISOString()
    };
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
    }
  }
}

// Create singleton instance for global use
const responseSigner = new ResponseSigner();

export { ResponseSigner, responseSigner };
export default responseSigner;