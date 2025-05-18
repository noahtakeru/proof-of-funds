/**
 * Security Configuration System
 * 
 * This module initializes and configures all security components, ensuring
 * that they are properly loaded and integrated. It provides a central point
 * of configuration for all security settings.
 * 
 * Part of the integration work from Engineer 1.
 */

const createDistributedRateLimiter = require('./distributedRateLimit');
const { getSecret } = require('@proof-of-funds/common/src/config/secrets');
const tokenManager = require('@proof-of-funds/common/src/auth/tokenManager');
const auditLogger = require('@proof-of-funds/common/src/logging/auditLogger');

/**
 * Security configuration options
 * @typedef {Object} SecurityConfig
 * @property {string} rateLimiterType - Type of rate limiter ('memory' or 'redis')
 * @property {string} redisUrl - URL for Redis connection
 * @property {Object} auditLoggerOptions - Options for audit logger
 * @property {Object} tokenManagerOptions - Options for token manager
 */

/**
 * Default security configuration
 */
const defaultConfig = {
  rateLimiterType: process.env.RATE_LIMITER_TYPE || 'memory',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  auditLoggerOptions: {
    projectId: process.env.GCP_PROJECT_ID || 'proof-of-funds-455506',
    bucketName: process.env.AUDIT_LOG_BUCKET || `${process.env.GCP_PROJECT_ID || 'proof-of-funds-455506'}-audit-logs`
  },
  tokenManagerOptions: {
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d'
  }
};

/**
 * Initialize all security components
 * @param {SecurityConfig} config - Security configuration
 * @returns {Object} Initialized security components
 */
async function initializeSecurity(config = {}) {
  // Merge default config with provided config
  const mergedConfig = {
    ...defaultConfig,
    ...config
  };
  
  // Log initialization
  console.log(`Initializing security components in ${process.env.NODE_ENV} environment`);
  
  try {
    // Initialize rate limiter
    console.log(`Using ${mergedConfig.rateLimiterType} rate limiter`);
    const rateLimiter = createDistributedRateLimiter({
      type: mergedConfig.rateLimiterType,
      redisUrl: mergedConfig.redisUrl
    });
    
    // Log audit initialization
    await auditLogger.log('security.initialization', 
      { environment: process.env.NODE_ENV },
      { service: 'security-config' }
    );
    
    // Check for JWT secret
    const jwtSecret = await getSecret('JWT_SECRET', {
      required: false,
      fallback: process.env.NODE_ENV !== 'production' ? 
        'proof-of-funds-jwt-secret-dev-only' : null
    });
    
    if (!jwtSecret && process.env.NODE_ENV === 'production') {
      console.warn('WARNING: JWT_SECRET is not set in production environment');
    }
    
    // Return initialized components
    return {
      rateLimiter,
      auditLogger,
      tokenManager,
      initialized: true,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Failed to initialize security components:', error);
    
    // Log initialization failure
    try {
      await auditLogger.log('security.initialization.failure',
        { error: error.message },
        { service: 'security-config' }
      );
    } catch (logError) {
      console.error('Failed to log initialization failure:', logError);
    }
    
    throw new Error(`Security initialization failed: ${error.message}`);
  }
}

/**
 * Create a rate-limited API handler
 * @param {Function} handler - API route handler
 * @param {Object} options - Rate limiting options
 * @returns {Function} Rate-limited handler
 */
function createSecureApiHandler(handler, options = {}) {
  const {
    limit = 10,
    resource = 'api',
    rateLimiterType = process.env.RATE_LIMITER_TYPE || 'memory'
  } = options;
  
  // Create rate limiter
  const limiter = createDistributedRateLimiter({
    type: rateLimiterType
  })(limit, resource);
  
  // Return wrapped handler
  return async (req, res) => {
    // Apply rate limiting
    const rateLimitResult = await limiter(req, res);
    if (!rateLimitResult) {
      // Rate limit response already sent
      return;
    }
    
    // Call original handler
    return handler(req, res);
  };
}

// Export security configuration
module.exports = {
  initializeSecurity,
  createSecureApiHandler,
  defaultConfig
};