/**
 * Tamper Detection System (CommonJS Version)
 * 
 * This module provides security mechanisms to detect tampering with ZK inputs and proofs.
 */

// Import dependencies
const crypto = require('crypto');

// Simple tamper detection implementation for CommonJS
const TamperDetection = {
  /**
   * Generate a tamper-proof seal for data
   * @param {Object} data - Data to seal
   * @param {Object} options - Sealing options
   * @returns {Object} Sealed data with verification info
   */
  generateSeal: function(data, options = {}) {
    // Create a stringified version of the data for hashing
    const stringified = JSON.stringify(data);
    
    // Generate a simple hash as seal
    const hash = crypto.createHash('sha256').update(stringified).digest('hex');
    
    // Return data with seal
    return {
      data,
      seal: {
        hash,
        timestamp: Date.now(),
        algorithm: 'sha256',
        ...options
      }
    };
  },

  /**
   * Verify that sealed data hasn't been tampered with
   * @param {Object} sealedData - Data with seal to verify
   * @returns {boolean} Whether the data is intact
   */
  verifySeal: function(sealedData) {
    // Extract components
    const { data, seal } = sealedData;
    
    if (!data || !seal || !seal.hash) {
      return false;
    }
    
    // Regenerate hash from data
    const stringified = JSON.stringify(data);
    const hash = crypto.createHash('sha256').update(stringified).digest('hex');
    
    // Compare with the original hash
    return hash === seal.hash;
  },

  /**
   * Detect unexpected changes in ZK proof data
   * @param {Object} proof - ZK proof to check
   * @param {Object} expectedFields - Expected field values
   * @returns {Object} Tampering analysis results
   */
  detectTampering: function(proof, expectedFields = {}) {
    // Simplified implementation
    const issues = [];
    
    // Check that proof has the expected structure
    if (!proof || typeof proof !== 'object') {
      issues.push('Invalid proof structure');
    }
    
    // Check expected fields
    for (const [field, expectedValue] of Object.entries(expectedFields)) {
      if (proof && proof[field] !== expectedValue) {
        issues.push(`Field "${field}" has unexpected value`);
      }
    }
    
    return {
      tampered: issues.length > 0,
      issues,
      timestamp: Date.now()
    };
  }
};

// Export for CommonJS
module.exports = TamperDetection;