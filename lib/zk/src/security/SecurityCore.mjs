/**
 * @fileoverview Security Core Module
 * 
 * Central module for ZK security functionality providing validation, verification,
 * and core security services. This consolidated module combines functionality
 * previously spread across multiple security modules.
 * 
 * Key responsibilities:
 * - Cryptographic signature verification
 * - Nonce generation and validation
 * - Anti-tampering protections
 * - Request/response security
 * 
 * @author ZK Infrastructure Team
 */

import crypto from 'crypto';
import { zkErrorLogger } from '../zkErrorLogger.mjs';
import { SecurityError, InputError, ErrorCode } from '../zkErrorHandler.mjs';

/**
 * Security Core class that provides fundamental security services
 * for ZK proof systems.
 */
export class SecurityCore {
  /**
   * Create a new SecurityCore instance
   * 
   * @param {Object} options - Configuration options
   * @param {string} [options.algorithm='sha256'] - Hash algorithm
   * @param {number} [options.nonceLength=32] - Nonce length in bytes
   * @param {number} [options.nonceExpiryMs=600000] - Nonce expiry in milliseconds (10 minutes)
   * @param {number} [options.signatureMaxAgeMs=300000] - Maximum age for signatures (5 minutes)
   * @param {Object} [options.keyPairs={}] - Map of client IDs to their public keys
   * @param {string} [options.serverSecretKey] - Server's secret key for HMAC signing
   */
  constructor(options = {}) {
    this.algorithm = options.algorithm || 'sha256';
    this.nonceLength = options.nonceLength || 32;
    this.nonceExpiryMs = options.nonceExpiryMs || 600000; // 10 minutes
    this.signatureMaxAgeMs = options.signatureMaxAgeMs || 300000; // 5 minutes
    this.keyPairs = new Map(Object.entries(options.keyPairs || {}));
    this.serverSecretKey = options.serverSecretKey || this._generateServerKey();
    
    // In-memory nonce store (replace with persistent store in production)
    this.nonceStore = new Map();
    
    // Statistics tracking
    this.stats = {
      nonceGenerated: 0,
      nonceValidated: 0,
      nonceRejected: 0,
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
   * @returns {boolean} True if registration succeeded
   */
  registerClientKey(clientId, publicKey) {
    const operationId = `registerClientKey_${Date.now()}`;
    
    if (!clientId || typeof clientId !== 'string') {
      const error = new InputError('Client ID must be a non-empty string', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: true,
        userFixable: true,
        details: {
          providedClientId: clientId,
          expectedType: 'non-empty string',
          actualType: typeof clientId
        }
      });
      
      zkErrorLogger.logError(error, { context: 'SecurityCore.registerClientKey' });
      throw error;
    }
    
    if (!publicKey || typeof publicKey !== 'string') {
      const error = new InputError('Public key must be a non-empty string', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: true,
        userFixable: true,
        details: {
          clientId,
          providedKeyType: typeof publicKey,
          expectedType: 'non-empty string'
        }
      });
      
      zkErrorLogger.logError(error, { context: 'SecurityCore.registerClientKey' });
      throw error;
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
  
  // ===== SIGNATURE VERIFICATION FUNCTIONALITY =====
  
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
      
      // Create a proper security error
      const verificationError = new SecurityError(`Error verifying signature: ${error.message}`, {
        code: ErrorCode.SECURITY_SIGNATURE_INVALID,
        operationId: `verifySig_${Date.now()}`,
        recoverable: true,
        details: {
          originalError: error.message,
          timestamp: signatureInfo.timestamp
        }
      });
      
      zkErrorLogger.logError(verificationError, { 
        context: 'SecurityCore.verifyClientSignature'
      });
      
      return {
        valid: false,
        reason: 'VERIFICATION_ERROR',
        message: `Error verifying signature: ${error.message}`,
        error: verificationError.message
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
      
      // Create a proper security error
      const verificationError = new SecurityError(`Error verifying signature: ${error.message}`, {
        code: ErrorCode.SECURITY_SIGNATURE_INVALID,
        operationId: `verifySig_${Date.now()}`,
        recoverable: true,
        details: {
          originalError: error.message,
          timestamp: signatureInfo.timestamp
        }
      });
      
      zkErrorLogger.logError(verificationError, { 
        context: 'SecurityCore.verifyServerSignature'
      });
      
      return {
        valid: false,
        reason: 'VERIFICATION_ERROR',
        message: `Error verifying signature: ${error.message}`,
        error: verificationError.message
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
  
  // ===== NONCE MANAGEMENT FUNCTIONALITY =====
  
  /**
   * Generate a cryptographically secure nonce
   * 
   * @param {Object} [options] - Nonce generation options
   * @param {string} [options.context] - Context identifier for the nonce
   * @param {number} [options.expiryMs] - Custom expiry time in milliseconds
   * @returns {Object} Nonce object with value and metadata
   */
  generateNonce(options = {}) {
    try {
      const nonceValue = crypto.randomBytes(this.nonceLength).toString('hex');
      const context = options.context || 'default';
      const now = Date.now();
      const expiryTime = now + (options.expiryMs || this.nonceExpiryMs);
      
      // Store nonce with metadata
      this.nonceStore.set(nonceValue, {
        createdAt: now,
        expiresAt: expiryTime,
        context,
        used: false
      });
      
      this.stats.nonceGenerated++;
      
      return {
        nonce: nonceValue,
        expiresAt: expiryTime,
        context
      };
    } catch (error) {
      const securityError = new SecurityError('Failed to generate nonce', {
        code: ErrorCode.SECURITY_NONCE_GENERATION_FAILED,
        details: { error: error.message },
        recoverable: true
      });
      
      zkErrorLogger.logError(securityError, { context: 'SecurityCore.generateNonce' });
      throw securityError;
    }
  }
  
  /**
   * Validate a nonce
   * 
   * @param {string} nonce - Nonce to validate
   * @param {Object} [options] - Validation options
   * @param {string} [options.context] - Expected context
   * @param {boolean} [options.markAsUsed=true] - Whether to mark nonce as used
   * @returns {Object} Validation result with status and message
   */
  validateNonce(nonce, options = {}) {
    const markAsUsed = options.markAsUsed !== false;
    const now = Date.now();
    
    this.stats.nonceValidated++;
    
    // Check if nonce exists
    if (!this.nonceStore.has(nonce)) {
      this.stats.nonceRejected++;
      return {
        valid: false,
        reason: 'INVALID_NONCE',
        message: 'Nonce not found'
      };
    }
    
    const nonceData = this.nonceStore.get(nonce);
    
    // Check if nonce has expired
    if (now > nonceData.expiresAt) {
      this.stats.nonceRejected++;
      return {
        valid: false,
        reason: 'EXPIRED_NONCE',
        message: `Nonce expired at ${new Date(nonceData.expiresAt).toISOString()}`
      };
    }
    
    // Check if nonce has been used
    if (nonceData.used) {
      this.stats.nonceRejected++;
      return {
        valid: false,
        reason: 'USED_NONCE',
        message: 'Nonce has already been used'
      };
    }
    
    // Check context if provided
    if (options.context && nonceData.context !== options.context) {
      this.stats.nonceRejected++;
      return {
        valid: false,
        reason: 'CONTEXT_MISMATCH',
        message: `Nonce context mismatch: expected ${options.context}, got ${nonceData.context}`
      };
    }
    
    // Mark nonce as used
    if (markAsUsed) {
      nonceData.used = true;
      this.nonceStore.set(nonce, nonceData);
    }
    
    return {
      valid: true,
      message: 'Nonce valid'
    };
  }
  
  /**
   * Clear expired nonces from storage
   * 
   * @returns {number} Number of nonces removed
   */
  cleanupExpiredNonces() {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [nonce, data] of this.nonceStore.entries()) {
      if (now > data.expiresAt) {
        this.nonceStore.delete(nonce);
        removedCount++;
      }
    }
    
    return removedCount;
  }
  
  /**
   * Get statistics about security operations
   * 
   * @returns {Object} Security statistics
   */
  getStats() {
    const totalVerifications = this.stats.totalVerifications;
    const successRate = totalVerifications > 0
      ? (this.stats.validSignatures / totalVerifications * 100).toFixed(2) + '%'
      : '0%';
    
    const nonceValidationRate = this.stats.nonceValidated > 0
      ? (100 - (this.stats.nonceRejected / this.stats.nonceValidated * 100)).toFixed(2) + '%'
      : '0%';
    
    return {
      ...this.stats,
      signatureSuccessRate: successRate,
      nonceValidationRate,
      registeredClients: this.keyPairs.size,
      activeNonces: this.nonceStore.size
    };
  }
  
  /**
   * Reset all statistics counters
   */
  resetStats() {
    this.stats = {
      nonceGenerated: 0,
      nonceValidated: 0,
      nonceRejected: 0,
      totalVerifications: 0,
      validSignatures: 0,
      invalidSignatures: 0,
      expiredSignatures: 0,
      unknownClients: 0
    };
  }
}

// Create singleton instance for global use
const securityCore = new SecurityCore();

export { SecurityCore, securityCore };
export default securityCore;