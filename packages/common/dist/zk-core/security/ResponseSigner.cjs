/**
 * Response Signer module
 * 
 * This module provides utilities for signing API responses to ensure
 * they haven't been tampered with during transmission.
 */

const { createHmac, timingSafeEqual } = require('crypto');

// Default signature algorithm
const DEFAULT_ALGORITHM = 'sha256';

// Secret key for signing
let secretKey = null;

/**
 * Initialize the response signer with a secret key
 * @param {string} key - The secret key to use for signing
 * @throws {Error} If the key is invalid
 */
function initialize(key) {
  if (!key || typeof key !== 'string' || key.length < 32) {
    throw new Error('Invalid secret key: must be a string of at least 32 characters');
  }
  
  secretKey = key;
}

/**
 * Generate a secure HMAC signature for the data
 * @param {Object} data - The data to sign
 * @param {string} [algorithm=sha256] - The HMAC algorithm to use
 * @returns {string} The HMAC signature
 * @throws {Error} If the data cannot be signed or the secret key is not initialized
 */
function generateSignature(data, algorithm = DEFAULT_ALGORITHM) {
  if (!secretKey) {
    throw new Error('Response signer not initialized: call initialize() with a secret key first');
  }
  
  if (!data) {
    throw new Error('Cannot sign empty data');
  }
  
  try {
    // Convert data to JSON string
    const jsonStr = JSON.stringify(data);
    
    // Create HMAC
    const hmac = createHmac(algorithm, secretKey);
    hmac.update(jsonStr);
    
    // Get digest in hex format
    return `${algorithm}:${hmac.digest('hex')}`;
  } catch (error) {
    throw new Error(`Failed to generate signature: ${error.message}`);
  }
}

/**
 * Sign a response to protect against tampering
 * @param {Object} responseData - The response data to sign
 * @param {Object} [options] - Signing options
 * @param {string} [options.algorithm] - The HMAC algorithm to use
 * @param {number} [options.expireInSeconds] - Signature expiration time in seconds
 * @returns {Object} The signed response
 * @throws {Error} If the response cannot be signed
 */
function signResponse(responseData, options = {}) {
  if (!secretKey) {
    throw new Error('Response signer not initialized: call initialize() with a secret key first');
  }
  
  if (!responseData || typeof responseData !== 'object') {
    throw new Error('Invalid response data: must be an object');
  }
  
  try {
    // Create a deep copy of the response data
    const signedResponse = JSON.parse(JSON.stringify(responseData));
    
    // Add security metadata
    signedResponse._security = {
      timestamp: Date.now(),
      expires: options.expireInSeconds ? Date.now() + (options.expireInSeconds * 1000) : null,
      algorithm: options.algorithm || DEFAULT_ALGORITHM,
      version: '1.0'
    };
    
    // Generate and add signature
    // Note: We exclude the signature itself from the data being signed
    const { _security } = signedResponse;
    const signature = generateSignature(
      { ...signedResponse, _security: { ..._security, signature: undefined } },
      _security.algorithm
    );
    
    // Add signature to security metadata
    signedResponse._security.signature = signature;
    
    return signedResponse;
  } catch (error) {
    const enhancedError = new Error(`Failed to sign response: ${error.message}`);
    enhancedError.originalError = error;
    throw enhancedError;
  }
}

/**
 * Verify the signature on a signed response
 * @param {Object} signedResponse - The signed response to verify
 * @returns {Object} The verification result
 * @throws {Error} If the response cannot be verified
 */
function verifySignedResponse(signedResponse) {
  if (!secretKey) {
    throw new Error('Response signer not initialized: call initialize() with a secret key first');
  }
  
  try {
    // Ensure required properties are present
    if (!signedResponse || !signedResponse._security) {
      return {
        valid: false,
        message: 'Missing security metadata',
        reason: 'MISSING_SECURITY_METADATA'
      };
    }
    
    const { _security } = signedResponse;
    
    if (!_security.signature) {
      return {
        valid: false,
        message: 'Missing signature',
        reason: 'MISSING_SIGNATURE'
      };
    }
    
    if (!_security.timestamp) {
      return {
        valid: false,
        message: 'Missing timestamp',
        reason: 'MISSING_TIMESTAMP'
      };
    }
    
    // Extract signature for comparison
    const providedSignature = _security.signature;
    
    // Create a copy of the response without the signature for verification
    const responseForVerification = JSON.parse(JSON.stringify(signedResponse));
    responseForVerification._security = { 
      ...responseForVerification._security,
      signature: undefined 
    };
    
    // Generate expected signature
    const expectedSignature = generateSignature(
      responseForVerification,
      _security.algorithm || DEFAULT_ALGORITHM
    );
    
    // Verify signature using constant-time comparison to prevent timing attacks
    // Convert Buffer from hex
    const providedBuffer = Buffer.from(providedSignature.split(':')[1], 'hex');
    const expectedBuffer = Buffer.from(expectedSignature.split(':')[1], 'hex');
    
    if (providedBuffer.length !== expectedBuffer.length ||
        !timingSafeEqual(providedBuffer, expectedBuffer)) {
      return {
        valid: false,
        message: 'Invalid signature',
        reason: 'INVALID_SIGNATURE'
      };
    }
    
    // Check if response has expired
    if (_security.expires && Date.now() > _security.expires) {
      return {
        valid: false,
        message: 'Response has expired',
        reason: 'EXPIRED_RESPONSE',
        expiryTime: new Date(_security.expires).toISOString()
      };
    }
    
    // Check if the timestamp is reasonable
    const now = Date.now();
    const responseTime = Number(_security.timestamp);
    
    // Check if response is too old (15 minutes by default)
    if (now - responseTime > 15 * 60 * 1000) {
      return {
        valid: false,
        message: 'Response is too old',
        reason: 'STALE_RESPONSE',
        timestamp: new Date(responseTime).toISOString()
      };
    }
    
    // Check if response is from the future (clock skew or tampering)
    if (responseTime > now + 60 * 1000) {
      return {
        valid: false,
        message: 'Response timestamp is in the future',
        reason: 'FUTURE_RESPONSE',
        timestamp: new Date(responseTime).toISOString()
      };
    }
    
    // Extract the original response data without security metadata
    const { _security: _, ...originalData } = signedResponse;
    
    return {
      valid: true,
      message: 'Signature is valid',
      data: originalData,
      metadata: _security
    };
  } catch (error) {
    const enhancedError = new Error(`Error verifying signature: ${error.message}`);
    enhancedError.originalError = error;
    throw enhancedError;
  }
}

const responseSigner = exports.responseSigner = {
  initialize,
  signResponse,
  verifySignedResponse,
  
  // For testing purposes only
  _generateSignature: generateSignature
};