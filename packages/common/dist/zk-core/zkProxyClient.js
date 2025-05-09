/**
 * ZK Proxy Client module
 * 
 * This module provides utilities for interacting with the ZK proxy service,
 * including rate limiting functionality for API requests.
 */

/**
 * Rate limiter implementation for ZK API requests
 * Enforces request limits per minute and hour for different users
 */
export class RateLimiter {
  /**
   * Create a new rate limiter
   * @param {Object} options - Configuration options
   * @param {Object} options.defaultLimits - Default rate limits
   * @param {number} options.defaultLimits.maxRequestsPerMinute - Max requests per minute
   * @param {number} options.defaultLimits.maxRequestsPerHour - Max requests per hour
   * @param {number} options.cleanupIntervalMs - Cleanup interval in milliseconds
   */
  constructor(options = {}) {
    this.userRequests = {};
    this.defaultLimits = options.defaultLimits || {
      maxRequestsPerMinute: 10,
      maxRequestsPerHour: 100
    };
    
    // Validate default limits
    if (this.defaultLimits.maxRequestsPerMinute <= 0 || !Number.isInteger(this.defaultLimits.maxRequestsPerMinute)) {
      throw new Error('Invalid maxRequestsPerMinute: must be a positive integer');
    }
    
    if (this.defaultLimits.maxRequestsPerHour <= 0 || !Number.isInteger(this.defaultLimits.maxRequestsPerHour)) {
      throw new Error('Invalid maxRequestsPerHour: must be a positive integer');
    }
    
    // Set up cleanup interval
    const cleanupIntervalMs = options.cleanupIntervalMs || 60 * 60 * 1000; // Default: 1 hour
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);
    }
  }

  /**
   * Set custom rate limits for a specific user
   * @param {string} userId - The user ID
   * @param {Object} limits - The custom limits
   * @param {number} limits.maxRequestsPerMinute - Maximum requests per minute
   * @param {number} limits.maxRequestsPerHour - Maximum requests per hour
   * @throws {Error} If userId or limits are invalid
   */
  setUserLimits(userId, limits) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid userId: must be a non-empty string');
    }
    
    if (!limits || typeof limits !== 'object') {
      throw new Error('Invalid limits: must be an object');
    }
    
    // Validate limits
    if (limits.maxRequestsPerMinute !== undefined && 
        (limits.maxRequestsPerMinute <= 0 || !Number.isInteger(limits.maxRequestsPerMinute))) {
      throw new Error('Invalid maxRequestsPerMinute: must be a positive integer');
    }
    
    if (limits.maxRequestsPerHour !== undefined && 
        (limits.maxRequestsPerHour <= 0 || !Number.isInteger(limits.maxRequestsPerHour))) {
      throw new Error('Invalid maxRequestsPerHour: must be a positive integer');
    }
    
    // Initialize user data if it doesn't exist
    if (!this.userRequests[userId]) {
      this.userRequests[userId] = {
        minuteRequests: [],
        hourRequests: [],
        limits: { ...this.defaultLimits }
      };
    }

    // Update limits
    this.userRequests[userId].limits = {
      ...this.defaultLimits,
      ...limits
    };
  }

  /**
   * Check if a user has exceeded their rate limits
   * @param {string} userId - The user ID
   * @returns {Object} The rate limit check result
   * @throws {Error} If userId is invalid
   */
  checkRateLimit(userId) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid userId: must be a non-empty string');
    }
    
    // Initialize user data if it doesn't exist
    if (!this.userRequests[userId]) {
      this.userRequests[userId] = {
        minuteRequests: [],
        hourRequests: [],
        limits: { ...this.defaultLimits }
      };
    }

    const now = Date.now();
    const user = this.userRequests[userId];
    
    // Clean up old requests
    user.minuteRequests = user.minuteRequests.filter(time => now - time < 60 * 1000);
    user.hourRequests = user.hourRequests.filter(time => now - time < 60 * 60 * 1000);
    
    // Check limits
    const minuteLimit = {
      current: user.minuteRequests.length,
      max: user.limits.maxRequestsPerMinute,
      remaining: user.limits.maxRequestsPerMinute - user.minuteRequests.length,
      reset: now + 60 * 1000 - (now % (60 * 1000)) // Reset at the start of the next minute
    };

    const hourLimit = {
      current: user.hourRequests.length,
      max: user.limits.maxRequestsPerHour,
      remaining: user.limits.maxRequestsPerHour - user.hourRequests.length,
      reset: now + 60 * 60 * 1000 - (now % (60 * 60 * 1000)) // Reset at the start of the next hour
    };

    const allowed = 
      minuteLimit.current < minuteLimit.max &&
      hourLimit.current < hourLimit.max;

    if (allowed) {
      // Record the request
      user.minuteRequests.push(now);
      user.hourRequests.push(now);
    }

    return {
      allowed,
      minuteLimit,
      hourLimit,
      userId
    };
  }

  /**
   * Release a request from the rate limit count
   * @param {string} userId - The user ID
   * @returns {boolean} Whether the request was successfully released
   * @throws {Error} If userId is invalid
   */
  releaseRequest(userId) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid userId: must be a non-empty string');
    }
    
    if (!this.userRequests[userId]) {
      return false;
    }
    
    const user = this.userRequests[userId];
    let released = false;
    
    if (user.minuteRequests.length > 0) {
      user.minuteRequests.pop();
      released = true;
    }
    
    if (user.hourRequests.length > 0) {
      user.hourRequests.pop();
      released = true;
    }
    
    return released;
  }

  /**
   * Clean up old user data
   * @returns {number} Number of user records cleaned up
   */
  cleanup() {
    const now = Date.now();
    const cutoff = now - 24 * 60 * 60 * 1000; // 24 hours ago
    let cleanedCount = 0;
    
    for (const userId in this.userRequests) {
      const user = this.userRequests[userId];
      const lastRequestTime = Math.max(
        ...user.hourRequests.concat(user.minuteRequests, 0)
      );
      
      if (lastRequestTime < cutoff) {
        delete this.userRequests[userId];
        cleanedCount++;
      }
    }
    
    return cleanedCount;
  }

  /**
   * Get current status of the rate limiter
   * @returns {Object} Current rate limiter status
   */
  getStatus() {
    return {
      userCount: Object.keys(this.userRequests).length,
      defaultLimits: { ...this.defaultLimits },
      totalRequests: Object.values(this.userRequests).reduce(
        (total, user) => total + user.hourRequests.length, 
        0
      )
    };
  }

  /**
   * Destroy the rate limiter and stop the cleanup interval
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

/**
 * ZK Proxy client for interacting with the ZK proxy service
 */
export class ZkProxyClient {
  /**
   * Create a new ZK Proxy client
   * @param {Object} options - Configuration options
   * @param {string} options.baseUrl - Base URL for the ZK proxy service
   * @param {RateLimiter} options.rateLimiter - Rate limiter instance
   * @param {number} options.timeout - Request timeout in milliseconds
   * @param {number} options.retryAttempts - Number of retry attempts
   * @param {number} options.retryDelayMs - Delay between retries in milliseconds
   */
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || '/api/zk';
    this.rateLimiter = options.rateLimiter || new RateLimiter();
    this.timeout = options.timeout || 60000; // 60 seconds
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelayMs = options.retryDelayMs || 1000; // 1 second
    
    // Validate baseUrl
    if (!this.baseUrl || typeof this.baseUrl !== 'string') {
      throw new Error('Invalid baseUrl: must be a non-empty string');
    }
    
    // Validate rateLimiter
    if (!(this.rateLimiter instanceof RateLimiter)) {
      throw new Error('Invalid rateLimiter: must be an instance of RateLimiter');
    }
    
    // Validate timeout
    if (this.timeout <= 0 || !Number.isInteger(this.timeout)) {
      throw new Error('Invalid timeout: must be a positive integer');
    }
    
    // Validate retryAttempts
    if (this.retryAttempts < 0 || !Number.isInteger(this.retryAttempts)) {
      throw new Error('Invalid retryAttempts: must be a non-negative integer');
    }
    
    // Validate retryDelayMs
    if (this.retryDelayMs <= 0 || !Number.isInteger(this.retryDelayMs)) {
      throw new Error('Invalid retryDelayMs: must be a positive integer');
    }
  }

  /**
   * Generate a unique request ID
   * @private
   * @returns {string} Unique request ID
   */
  _generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Add timeout to a fetch request
   * @private
   * @param {Promise} fetchPromise - The fetch promise
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {Promise} Promise that resolves or rejects based on timeout
   */
  _fetchWithTimeout(fetchPromise, timeoutMs) {
    return Promise.race([
      fetchPromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  /**
   * Execute a fetch request with retries
   * @private
   * @param {string} url - The URL to fetch
   * @param {Object} options - Fetch options
   * @returns {Promise<Response>} The fetch response
   */
  async _fetchWithRetry(url, options) {
    let retries = 0;
    let lastError;

    while (retries <= this.retryAttempts) {
      try {
        const response = await this._fetchWithTimeout(fetch(url, options), this.timeout);
        
        if (response.ok) {
          return response;
        }
        
        // Handle specific HTTP errors
        if (response.status === 429) {
          // Rate limit exceeded - no retry
          const errorData = await response.json();
          throw new Error(`Rate limit exceeded: ${errorData.message || 'Too many requests'}`);
        } else if (response.status >= 500) {
          // Server error - retry
          const errorData = await response.json();
          throw new Error(`Server error (${response.status}): ${errorData.message || 'Unknown server error'}`);
        } else {
          // Client error - no retry
          const errorData = await response.json();
          throw new Error(`Client error (${response.status}): ${errorData.message || 'Unknown client error'}`);
        }
      } catch (error) {
        lastError = error;
        
        // Don't retry client errors (4xx) except 408 (Request Timeout)
        if (error.message.includes('Client error') && !error.message.includes('(408)')) {
          break;
        }
        
        retries++;
        
        if (retries <= this.retryAttempts) {
          // Exponential backoff with jitter
          const delay = this.retryDelayMs * Math.pow(2, retries - 1) * (0.5 + Math.random() * 0.5);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('Failed to fetch after maximum retry attempts');
  }

  /**
   * Generate a proof using the ZK proxy service
   * @param {Object} proofRequest - The proof request
   * @param {Object} options - Request options
   * @param {string} options.userId - User ID for rate limiting
   * @returns {Promise<Object>} The generated proof
   * @throws {Error} If the request fails
   */
  async generateProof(proofRequest, options = {}) {
    if (!proofRequest || typeof proofRequest !== 'object') {
      throw new Error('Invalid proofRequest: must be an object');
    }
    
    const userId = options.userId || 'anonymous';
    const requestId = this._generateRequestId();
    
    // Check rate limit
    const rateLimit = this.rateLimiter.checkRateLimit(userId);
    if (!rateLimit.allowed) {
      throw new Error(`Rate limit exceeded. Try again in ${Math.ceil((rateLimit.minuteLimit.reset - Date.now()) / 1000)} seconds.`);
    }
    
    try {
      // Add metadata to request
      const enhancedRequest = {
        ...proofRequest,
        metadata: {
          ...(proofRequest.metadata || {}),
          requestId,
          timestamp: Date.now(),
          userId
        }
      };
      
      // Send request
      const response = await this._fetchWithRetry(`${this.baseUrl}/fullProve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
          'X-User-ID': userId
        },
        body: JSON.stringify(enhancedRequest)
      });

      const result = await response.json();
      
      // Validate response
      if (!result || !result.proof || !result.publicSignals) {
        throw new Error('Invalid response: missing proof or publicSignals');
      }
      
      return result;
    } catch (error) {
      // Release rate limit on error
      this.rateLimiter.releaseRequest(userId);
      
      // Enhance error with context
      const enhancedError = new Error(`Failed to generate proof: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.requestId = requestId;
      enhancedError.userId = userId;
      throw enhancedError;
    }
  }

  /**
   * Verify a proof using the ZK proxy service
   * @param {Object} verifyRequest - The verify request
   * @param {Object} options - Request options
   * @param {string} options.userId - User ID for rate limiting
   * @returns {Promise<Object>} The verification result
   * @throws {Error} If the request fails
   */
  async verifyProof(verifyRequest, options = {}) {
    if (!verifyRequest || typeof verifyRequest !== 'object') {
      throw new Error('Invalid verifyRequest: must be an object');
    }
    
    if (!verifyRequest.proof) {
      throw new Error('Invalid verifyRequest: missing proof');
    }
    
    if (!verifyRequest.publicSignals) {
      throw new Error('Invalid verifyRequest: missing publicSignals');
    }
    
    const userId = options.userId || 'anonymous';
    const requestId = this._generateRequestId();
    
    // Check rate limit
    const rateLimit = this.rateLimiter.checkRateLimit(userId);
    if (!rateLimit.allowed) {
      throw new Error(`Rate limit exceeded. Try again in ${Math.ceil((rateLimit.minuteLimit.reset - Date.now()) / 1000)} seconds.`);
    }
    
    try {
      // Add metadata to request
      const enhancedRequest = {
        ...verifyRequest,
        metadata: {
          ...(verifyRequest.metadata || {}),
          requestId,
          timestamp: Date.now(),
          userId
        }
      };
      
      // Send request
      const response = await this._fetchWithRetry(`${this.baseUrl}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
          'X-User-ID': userId
        },
        body: JSON.stringify(enhancedRequest)
      });

      const result = await response.json();
      
      // Validate response
      if (result.valid === undefined) {
        throw new Error('Invalid response: missing valid field');
      }
      
      return result;
    } catch (error) {
      // Release rate limit on error
      this.rateLimiter.releaseRequest(userId);
      
      // Enhance error with context
      const enhancedError = new Error(`Failed to verify proof: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.requestId = requestId;
      enhancedError.userId = userId;
      throw enhancedError;
    }
  }
  
  /**
   * Get the status of the ZK proxy service
   * @returns {Promise<Object>} Service status
   * @throws {Error} If the request fails
   */
  async getStatus() {
    try {
      const response = await this._fetchWithRetry(`${this.baseUrl}/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      return await response.json();
    } catch (error) {
      throw new Error(`Failed to get service status: ${error.message}`);
    }
  }
}