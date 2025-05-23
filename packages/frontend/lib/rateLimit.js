/**
 * Simple in-memory rate limiter for Next.js API routes
 * 
 * This implementation uses a Map to store IP addresses and their request counts.
 * For production, consider using Redis or another distributed store.
 */

// In-memory store for rate limiting
const rateLimit = new Map();

// Clean up the store periodically to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateLimit.entries()) {
    if (now - data.timestamp > 60000) {
      rateLimit.delete(ip);
    }
  }
}, 60000);

/**
 * Rate limit middleware for Next.js API routes
 * @param {number} limit - Maximum number of requests per minute
 * @returns {Function} - Middleware function
 */
export default function rateLimiter(limit = 10) {
  return (req, res) => {
    // Get IP address
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '127.0.0.1';
    
    // Get current timestamp
    const now = Date.now();
    
    // Initialize or get rate limit data for this IP
    const rateLimitData = rateLimit.get(ip) || {
      count: 0,
      timestamp: now
    };
    
    // Reset count if more than a minute has passed
    if (now - rateLimitData.timestamp > 60000) {
      rateLimitData.count = 0;
      rateLimitData.timestamp = now;
    }
    
    // Increment count
    rateLimitData.count++;
    
    // Update rate limit data
    rateLimit.set(ip, rateLimitData);
    
    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - rateLimitData.count));
    
    // Check if rate limit exceeded
    if (rateLimitData.count > limit) {
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((rateLimitData.timestamp + 60000 - now) / 1000)
      });
    }
    
    // Return true to indicate rate limit not exceeded
    return true;
  };
}