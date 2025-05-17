/**
 * Distributed Rate Limiter
 * 
 * Redis-based rate limiting solution for production environments that supports
 * horizontal scaling across multiple app instances. Extends the existing rate limiter
 * pattern and provides a fallback to in-memory rate limiting when Redis is unavailable.
 */

const Redis = require('ioredis');
const crypto = require('crypto');
const { createRateLimitError } = require('@proof-of-funds/common/src/error-handling');

/**
 * Factory for creating rate limiters
 * Extends the existing pattern with Redis support
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.type - Rate limiter type ('redis' or 'memory')
 * @param {string} options.redisUrl - Redis connection URL
 * @param {string} options.keyPrefix - Key prefix for Redis
 * @returns {Function} Rate limiter factory function
 */
function createRateLimiter(options = {}) {
  const {
    type = process.env.RATE_LIMITER_TYPE || 'memory',
    redisUrl = process.env.REDIS_URL,
    keyPrefix = 'pof-ratelimit:'
  } = options;
  
  // Initialize Redis client if using Redis
  let redisClient;
  if (type === 'redis' && redisUrl) {
    try {
      redisClient = new Redis(redisUrl);
      
      // Set up error handling for Redis connection
      redisClient.on('error', (err) => {
        console.error('Redis connection error:', err);
      });
      
      redisClient.on('connect', () => {
        console.log('Redis connection established for rate limiting');
      });
    } catch (error) {
      console.error('Failed to initialize Redis client:', error);
      throw new Error('Could not initialize distributed rate limiter');
    }
  }
  
  /**
   * Create a rate limiter middleware
   * @param {number} limit - Requests per minute
   * @param {string} resource - Resource identifier
   * @returns {Function} Rate limiting middleware
   */
  return function rateLimiter(limit = 10, resource = 'default') {
    // Generate a unique prefix for this limiter
    const prefix = `${keyPrefix}${resource}:`;
    
    return async (req, res) => {
      try {
        // Skip in test environment
        if (process.env.NODE_ENV === 'test') {
          return true;
        }
        
        // Calculate client identifier
        let clientId = req.headers['x-forwarded-for'] || 
                      req.socket.remoteAddress || 
                      'unknown';
        
        // If authenticated, include user ID in rate limit key
        if (req.user && req.user.walletAddress) {
          clientId = `${clientId}:${req.user.walletAddress}`;
        }
        
        // Create hash of the client ID for privacy
        const hashedClientId = crypto
          .createHash('sha256')
          .update(clientId)
          .digest('hex')
          .substring(0, 16);
        
        const key = `${prefix}${hashedClientId}`;
        
        // Handle different rate limiter types
        if (type === 'redis' && redisClient) {
          // Using Redis-based limiter
          const now = Date.now();
          const windowMs = 60 * 1000; // 1 minute window
          
          // Use Redis to track requests in a sliding window
          const multi = redisClient.multi();
          multi.zadd(key, now, `${now}-${crypto.randomBytes(8).toString('hex')}`);
          multi.zremrangebyscore(key, 0, now - windowMs);
          multi.zcard(key);
          multi.expire(key, 60); // Expire after 1 minute
          
          const results = await multi.exec();
          
          // Handle Redis errors
          if (!results || results.some(result => result[0])) {
            console.error('Redis error during rate limiting:', results);
            // Fall back to memory-based limiter
            return require('./rateLimit').default(limit)(req, res);
          }
          
          const requestCount = results[2][1];
          
          // Set rate limit headers
          res.setHeader('X-RateLimit-Limit', limit);
          res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - requestCount));
          
          // Check if over limit
          if (requestCount > limit) {
            res.setHeader('Retry-After', '60');
            res.status(429).json({
              error: 'rate_limit_exceeded',
              message: 'Too many requests, please try again later.',
              retryAfter: 60
            });
            return false;
          }
          
          return true;
        } else {
          // Fall back to memory-based limiter
          return require('./rateLimit').default(limit)(req, res);
        }
      } catch (error) {
        console.error('Rate limiting error:', error);
        
        // Log the error but don't block the request if rate limiting fails
        // This prevents a rate limiter failure from taking down the entire application
        return true;
      }
    };
  };
}

module.exports = createRateLimiter;