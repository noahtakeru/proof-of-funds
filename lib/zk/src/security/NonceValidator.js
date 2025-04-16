/**
 * Nonce Validator for ZK API Endpoints
 * 
 * This module provides anti-replay protection for server-side ZK operations
 * by verifying and tracking nonces to ensure each request is processed exactly once.
 * 
 * Implementation uses an in-memory cache with TTL for efficient tracking and
 * automatic cleanup of expired nonces.
 */

/**
 * NonceValidator class for validating and tracking API request nonces
 * to prevent replay attacks against server-side ZK operations.
 */
class NonceValidator {
  /**
   * Create a new NonceValidator instance
   * 
   * @param {Object} options - Configuration options
   * @param {number} [options.ttlMs=300000] - Nonce time-to-live in milliseconds (default: 5 minutes)
   * @param {number} [options.maxSize=10000] - Maximum number of nonces to track (prevents memory leaks)
   * @param {number} [options.timestampToleranceMs=60000] - Acceptable clock skew in milliseconds (default: 1 minute)
   * @param {boolean} [options.strictOrder=false] - Whether to enforce strictly increasing nonce values per user
   */
  constructor(options = {}) {
    // Configuration with defaults
    this.ttlMs = options.ttlMs || 300000; // 5 minutes
    this.maxSize = options.maxSize || 10000; // Maximum number of nonces to track
    this.timestampToleranceMs = options.timestampToleranceMs || 60000; // 1 minute tolerance for clock skew
    this.strictOrder = options.strictOrder || false; // When true, requires nonces to be strictly increasing

    // In-memory storage for tracking used nonces
    this.nonceCache = new Map();
    this.userLastNonce = new Map(); // Tracks the last nonce value per user (for strictOrder mode)
    
    // Statistics for monitoring
    this.stats = {
      totalProcessed: 0,
      rejected: {
        alreadyUsed: 0,
        expired: 0,
        future: 0,
        invalid: 0,
        outOfOrder: 0
      }
    };

    // Set up periodic cleanup to prevent memory leaks
    this.cleanupInterval = setInterval(() => this.cleanupExpiredNonces(), this.ttlMs / 2);
  }

  /**
   * Validate a nonce for a specific user/session
   * 
   * @param {string} nonce - Unique nonce value to validate
   * @param {string} userId - User or session identifier
   * @param {number} [timestamp] - Optional timestamp when nonce was created
   * @returns {Object} Validation result with status and message
   */
  validateNonce(nonce, userId, timestamp = Date.now()) {
    this.stats.totalProcessed++;

    // Basic validation
    if (!nonce || typeof nonce !== 'string' || nonce.length < 8) {
      this.stats.rejected.invalid++;
      return {
        valid: false,
        reason: 'INVALID_FORMAT',
        message: 'Nonce must be a string of at least 8 characters'
      };
    }

    if (!userId || typeof userId !== 'string') {
      this.stats.rejected.invalid++;
      return {
        valid: false,
        reason: 'INVALID_USER',
        message: 'User ID is required for nonce validation'
      };
    }

    // Parse timestamp if it's a string
    if (typeof timestamp === 'string') {
      timestamp = parseInt(timestamp, 10);
      if (isNaN(timestamp)) {
        this.stats.rejected.invalid++;
        return {
          valid: false,
          reason: 'INVALID_TIMESTAMP',
          message: 'Timestamp must be a valid number'
        };
      }
    }

    // Check timestamp to prevent replay of old requests
    const now = Date.now();
    const elapsedMs = now - timestamp;

    // Check if timestamp is too old (expired)
    if (elapsedMs > this.ttlMs) {
      this.stats.rejected.expired++;
      return {
        valid: false,
        reason: 'EXPIRED',
        message: `Nonce timestamp expired (created ${Math.round(elapsedMs / 1000)} seconds ago)`
      };
    }

    // Check if timestamp is in the future (potential attack or clock skew)
    if (timestamp > now + this.timestampToleranceMs) {
      this.stats.rejected.future++;
      return {
        valid: false,
        reason: 'FUTURE_TIMESTAMP',
        message: 'Nonce timestamp is in the future (beyond acceptable clock skew)'
      };
    }

    // Check if nonce has already been used for this user
    const userNonceKey = `${userId}:${nonce}`;
    if (this.nonceCache.has(userNonceKey)) {
      this.stats.rejected.alreadyUsed++;
      return {
        valid: false,
        reason: 'ALREADY_USED',
        message: 'Nonce has already been used'
      };
    }

    // Check strict ordering if enabled
    if (this.strictOrder && this.userLastNonce.has(userId)) {
      // For strict ordering, we assume nonces are numeric or have a numeric component
      const lastNonceValue = this.userLastNonce.get(userId);
      const currentNonceValue = parseInt(nonce, 10);
      
      if (!isNaN(currentNonceValue) && currentNonceValue <= lastNonceValue) {
        this.stats.rejected.outOfOrder++;
        return {
          valid: false,
          reason: 'OUT_OF_ORDER',
          message: 'Nonce value must be strictly increasing'
        };
      }
    }

    // Nonce is valid, record it to prevent reuse
    this.recordNonce(userNonceKey, userId, nonce, timestamp);

    return {
      valid: true,
      message: 'Nonce validated successfully'
    };
  }

  /**
   * Record a nonce as used
   * 
   * @param {string} userNonceKey - Combined user/nonce key
   * @param {string} userId - User identifier
   * @param {string} nonce - Nonce value
   * @param {number} timestamp - Timestamp when nonce was created
   * @private
   */
  recordNonce(userNonceKey, userId, nonce, timestamp) {
    // Record the nonce with expiration time
    this.nonceCache.set(userNonceKey, {
      nonce,
      userId,
      timestamp,
      expiresAt: Date.now() + this.ttlMs
    });

    // Update last nonce value for user if strict ordering is enabled
    if (this.strictOrder) {
      const nonceValue = parseInt(nonce, 10);
      if (!isNaN(nonceValue)) {
        this.userLastNonce.set(userId, nonceValue);
      }
    }

    // If we've reached max size, trigger cleanup
    if (this.nonceCache.size >= this.maxSize) {
      this.cleanupExpiredNonces();
    }
  }

  /**
   * Remove expired nonces from cache
   * @private
   */
  cleanupExpiredNonces() {
    const now = Date.now();
    let removedCount = 0;

    // Remove expired nonces
    for (const [key, nonceData] of this.nonceCache.entries()) {
      if (nonceData.expiresAt <= now) {
        this.nonceCache.delete(key);
        removedCount++;
      }
    }

    // If cache is still too large, remove oldest entries
    if (this.nonceCache.size > this.maxSize) {
      // Sort by expiration time and keep only the newest maxSize entries
      const entries = Array.from(this.nonceCache.entries());
      entries.sort((a, b) => b[1].expiresAt - a[1].expiresAt);
      
      // Keep only the newest entries up to maxSize
      const entriesToKeep = entries.slice(0, this.maxSize);
      
      // Clear cache and re-add the entries to keep
      this.nonceCache.clear();
      for (const [key, value] of entriesToKeep) {
        this.nonceCache.set(key, value);
      }
    }

    return removedCount;
  }

  /**
   * Get statistics about nonce validation
   * 
   * @returns {Object} Nonce validation statistics
   */
  getStats() {
    return {
      ...this.stats,
      currentCacheSize: this.nonceCache.size,
      acceptanceRate: this.stats.totalProcessed > 0 
        ? ((this.stats.totalProcessed - Object.values(this.stats.rejected).reduce((a, b) => a + b, 0)) / 
           this.stats.totalProcessed * 100).toFixed(2) + '%'
        : '100%'
    };
  }

  /**
   * Reset nonce cache and statistics
   */
  reset() {
    this.nonceCache.clear();
    this.userLastNonce.clear();
    this.stats = {
      totalProcessed: 0,
      rejected: {
        alreadyUsed: 0,
        expired: 0,
        future: 0,
        invalid: 0,
        outOfOrder: 0
      }
    };
  }

  /**
   * Destroy the validator and clean up resources
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.nonceCache.clear();
    this.userLastNonce.clear();
  }
}

// Create singleton instance for global use
const nonceValidator = new NonceValidator();

export { NonceValidator, nonceValidator };
export default nonceValidator;