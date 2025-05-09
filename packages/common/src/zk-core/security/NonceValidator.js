/**
 * Nonce Validator module
 * 
 * This module provides utilities for validating nonces to prevent replay attacks.
 */

// In-memory store of used nonces (for demo purposes)
// In a production environment, this would be a persistent store
const usedNonces = new Set();
const nonceExpirationMap = new Map();

// Cleanup old nonces periodically
const NONCE_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
const NONCE_EXPIRATION = 24 * 60 * 60 * 1000; // 24 hours

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [nonce, expiration] of nonceExpirationMap.entries()) {
      if (now > expiration) {
        usedNonces.delete(nonce);
        nonceExpirationMap.delete(nonce);
      }
    }
  }, NONCE_CLEANUP_INTERVAL);
}

/**
 * Generate a nonce for use in a request
 * @returns {string} The generated nonce
 */
function generateNonce() {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Validate a nonce to prevent replay attacks
 * @param {string} nonce - The nonce to validate
 * @param {string} userId - The user ID
 * @param {number} timestamp - The timestamp when the nonce was created
 * @returns {Object} The validation result
 */
function validateNonce(nonce, userId, timestamp) {
  // Ensure nonce is a string
  if (typeof nonce !== 'string') {
    return {
      valid: false,
      message: 'Invalid nonce format',
      reason: 'FORMAT_ERROR'
    };
  }

  // Ensure nonce is not empty
  if (!nonce.trim()) {
    return {
      valid: false,
      message: 'Nonce cannot be empty',
      reason: 'EMPTY_NONCE'
    };
  }

  // Create a user-specific nonce
  const userNonce = `${userId}:${nonce}`;

  // Check if nonce has been used before
  if (usedNonces.has(userNonce)) {
    return {
      valid: false,
      message: 'Nonce has already been used',
      reason: 'REPLAY_ATTACK'
    };
  }

  // Check timestamp if provided
  if (timestamp) {
    const now = Date.now();
    const nonceTime = Number(timestamp);

    // Ensure timestamp is a valid number
    if (isNaN(nonceTime)) {
      return {
        valid: false,
        message: 'Invalid timestamp format',
        reason: 'TIMESTAMP_FORMAT_ERROR'
      };
    }

    // Check if nonce is too old (5 minutes)
    if (now - nonceTime > 5 * 60 * 1000) {
      return {
        valid: false,
        message: 'Nonce is expired',
        reason: 'EXPIRED_NONCE'
      };
    }

    // Check if nonce is from the future (clock skew or tampering)
    if (nonceTime > now + 60 * 1000) {
      return {
        valid: false,
        message: 'Nonce timestamp is in the future',
        reason: 'FUTURE_NONCE'
      };
    }
  }

  // Add nonce to used nonces set
  usedNonces.add(userNonce);
  nonceExpirationMap.set(userNonce, Date.now() + NONCE_EXPIRATION);

  return {
    valid: true,
    message: 'Nonce is valid'
  };
}

export const nonceValidator = {
  generateNonce,
  validateNonce
};