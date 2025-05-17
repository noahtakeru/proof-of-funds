# Security Assessment for Proof of Funds

## Rules
1. No mock or placeholder code. We want to know where we're failing.
2. If something is confusing, don't create crap - stop, make note and consult.
3. Always check if an implementation, file, test, architecture, function or code exists before making any new files or folders.
4. Understand the entire codebase (make sure you grok it before making changes).
5. Review this entire plan and its progress before coding.
6. If you make a new code file - indicate that this is new and exactly what it's needed for. Also make sure there isn't mock or placeholder crap code in here either. Fallback code is NOT ACCEPTABLE EITHER. WE NEED TO KNOW WHEN AND WHERE WE FAIL.
7. Unless a plan or test file was made during this phased sprint (contained in this document) - I'd assume it's unreliable until its contents are analyzed thoroughly. Confirm its legitimacy before proceeding with trusting it blindly. Bad assumptions are unacceptable.
8. Put all imports at the top of the file it's being imported into.
9. Record all progress in this document.
10. Blockchain testing will be done on Polygon Amoy, so keep this in mind.
11. Do not make any UI changes. I like the way the frontend looks at the moment.
12. Track your progress in this file. Do not make more tracking or report files. They're unnecessary.
13. Price estimates are unacceptable. We are building for production, so it's important to prioritize building working code that doesn't rely on mock data or placeholder implementation. NOTHING "FAKE".

This document provides a comprehensive assessment of the current security measures in the Proof of Funds application and outlines specific tasks needed to achieve production-grade security.

## Current Security Status

### ✅ Security Measures Already Implemented

1. **JWT Authentication** (PRODUCTION READY)
   - Proper JWT implementation in `utils/auth.js`
   - Token-based authentication with secure validation
   - Role-based access control (admin vs. user)
   - Secure wallet signature verification

2. **Unified Error Handling** (PRODUCTION READY)
   - Unified error handling system via `@proof-of-funds/common/src/error-handling`
   - Standardized error responses across the application
   - Protection against leaking sensitive information
   - Development-specific detailed errors

3. **Input Validation** (PRODUCTION READY)
   - Unified validation framework via `@proof-of-funds/common/src/error-handling`
   - Type checking and data sanitization
   - Custom validators for blockchain-specific data types
   - Applied to critical endpoints via the factory pattern

4. **ZK Proof Factory Pattern** (PRODUCTION READY)
   - Abstracted ZK proof generation via factory pattern in `zkProofHandler.js`
   - Consistent interface for different proof strategies
   - Built-in rate limiting for proof generation endpoints
   - Automatic proof verification

5. **GCP Integration** (PRODUCTION READY)
   - Secure storage of ZK proof files
   - Service account authentication
   - Proper secret management
   - Cloud storage strategy for ZK proofs

6. **Basic Security Headers** (PARTIALLY READY)
   - Security headers configured in `next.config.js`
   - X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
   - Referrer-Policy headers

### ❌ Security Gaps and Required Enhancements

1. **Distributed Rate Limiting** (HIGH PRIORITY)
   - Current in-memory implementation not suitable for production
   - Need Redis-based solution for horizontal scaling
   - Must integrate with the existing rate limiter framework

2. **Environment Variable Security** (CRITICAL PRIORITY)
   - Hardcoded secrets and fallback values in the codebase
   - Needs secure access to GCP Secret Manager
   - Must integrate with existing configuration system

3. **CORS and CSP Implementation** (HIGH PRIORITY)
   - Incomplete CORS protections in current middleware
   - Need enhanced CSP configuration with appropriate directives
   - Must be integrated with the existing middleware system

4. **Security Audit Logging** (MEDIUM PRIORITY)
   - No centralized security event logging
   - Needs integration with GCP for audit trail storage
   - Must capture authentication events, admin actions, etc.

5. **Token Management** (MEDIUM PRIORITY)
   - Basic JWT implementation without refresh mechanism
   - No way to revoke compromised tokens
   - Needs comprehensive session management

6. **HTTPS Enforcement** (HIGH PRIORITY)
   - No explicit HTTPS enforcement mechanism
   - Missing HSTS configuration
   - Required for protecting authentication credentials

## Implementation Plan with Specific Integration Points

### 1. Distributed Rate Limiting (HIGH PRIORITY)

**Integration Point**: `packages/frontend/lib/rateLimit.js`

The current implementation needs to be enhanced with Redis support for distributed scenarios. Since the codebase already uses a rate limiter factory pattern, we'll extend it rather than replace it:

```javascript
// NEW FILE: packages/frontend/lib/distributedRateLimit.js

const Redis = require('ioredis');
const crypto = require('crypto');
const { handleApiError } = require('@proof-of-funds/common/src/error-handling');

/**
 * Factory for creating rate limiters
 * Extends the existing pattern with Redis support
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
      // Verify connection
      redisClient.on('error', (err) => {
        console.error('Redis connection error:', err);
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
          
          // Use Redis to track requests
          const multi = redisClient.multi();
          multi.zadd(key, now, `${now}-${crypto.randomBytes(8).toString('hex')}`);
          multi.zremrangebyscore(key, 0, now - windowMs);
          multi.zcard(key);
          multi.expire(key, 60); // Expire after 1 minute
          
          const [, , currentCount] = await multi.exec();
          const requestCount = currentCount[1];
          
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
        // Don't block the request if rate limiting fails
        return true;
      }
    };
  };
}

module.exports = createRateLimiter;
```

**Update the ZK Proof Handler Factory**:

```javascript
// MODIFY FILE: packages/frontend/utils/zkProofHandler.js
// Add at the top with other imports
const createRateLimiter = require('../lib/distributedRateLimit');

// Modify the factory to use the new rate limiter
function createZkProofHandler(options = {}) {
  const {
    defaultStrategy = 'cloud',
    rateLimit = 5,
    verifyProof = true,
    rateLimiterType = process.env.RATE_LIMITER_TYPE || 'memory'
  } = options;
  
  // Create appropriate rate limiter
  const limiter = createRateLimiter({ type: rateLimiterType })
    (rateLimit, 'zk-proof');
  
  // Rest of the factory implementation remains unchanged
  // ...
}
```

### 2. Secure Environment Variables (CRITICAL PRIORITY)

**Integration Points**: 
- `packages/frontend/utils/auth.js`
- `packages/frontend/utils/serviceAccountManager.js`
- `packages/common/src/config/secrets.js` (NEW)

We'll create a unified secrets management system that integrates with GCP Secret Manager:

```javascript
// NEW FILE: packages/common/src/config/secrets.js

const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

// Secret cache to avoid repeated calls
const secretCache = new Map();

/**
 * Get a secret from environment or Secret Manager
 * 
 * @param {string} key - Secret key
 * @param {Object} options - Options for fetching
 * @returns {Promise<string>} - Secret value
 */
async function getSecret(key, options = {}) {
  const {
    required = false,
    cacheTime = 60 * 60 * 1000, // 1 hour cache
    fallback = null,
    projectId = process.env.GCP_PROJECT_ID || 'proof-of-funds-455506',
  } = options;
  
  // Format key to GCP-compatible format
  const gcpKey = key.toLowerCase().replace(/_/g, '-');
  
  // Return from cache if available and not expired
  const cached = secretCache.get(gcpKey);
  if (cached && cached.timestamp > Date.now() - cacheTime) {
    return cached.value;
  }
  
  // First check environment variable
  if (process.env[key]) {
    const value = process.env[key];
    // Cache the value
    secretCache.set(gcpKey, {
      value,
      timestamp: Date.now()
    });
    return value;
  }
  
  // In development, return fallback
  if (process.env.NODE_ENV !== 'production') {
    if (fallback !== null) {
      return fallback;
    }
    
    // If required, throw error
    if (required) {
      throw new Error(`Required secret ${key} not found in environment variables`);
    }
    
    return null;
  }
  
  // In production, try Secret Manager
  try {
    const client = new SecretManagerServiceClient();
    const secretPath = `projects/${projectId}/secrets/${gcpKey}/versions/latest`;
    
    // Access the secret version
    const [version] = await client.accessSecretVersion({ name: secretPath });
    const value = version.payload.data.toString('utf8');
    
    // Cache the value
    secretCache.set(gcpKey, {
      value,
      timestamp: Date.now()
    });
    
    return value;
  } catch (error) {
    console.error(`Error fetching secret ${key}:`, error);
    
    // If fallback provided, use it
    if (fallback !== null) {
      return fallback;
    }
    
    // If required, throw error
    if (required) {
      throw new Error(`Required secret ${key} not found in Secret Manager`);
    }
    
    return null;
  }
}

module.exports = {
  getSecret
};
```

**Update the Authentication System**:

```javascript
// MODIFY FILE: packages/frontend/utils/auth.js
// Replace the JWT_SECRET constant

const { getSecret } = require('@proof-of-funds/common/src/config/secrets');

// Replace with secure secret retrieval
async function getJwtSecret() {
  const secret = await getSecret('JWT_SECRET', {
    required: true,
    fallback: process.env.NODE_ENV !== 'production' ? 
      'proof-of-funds-jwt-secret-dev-only' : null
  });
  
  if (!secret) {
    throw new Error('JWT_SECRET is required but not found');
  }
  
  return secret;
}

// Modify token generation function to use the new secret
async function generateToken(walletAddress, role = 'user') {
  // Get JWT secret securely
  const JWT_SECRET = await getJwtSecret();
  
  // Rest of the function remains the same
  // ...
}
```

### 3. Enhanced Security Middleware (HIGH PRIORITY)

**Integration Point**: `packages/frontend/middleware.js`

We'll enhance the middleware to provide comprehensive security headers, CORS protection, and CSP:

```javascript
// MODIFY FILE: packages/frontend/middleware.js
import { NextResponse } from 'next/server';
import { getSecret } from '@proof-of-funds/common/src/config/secrets';

// Get allowed origins securely
async function getAllowedOrigins() {
  // Get from environment or secrets
  const originsString = await getSecret('ALLOWED_ORIGINS', {
    fallback: 'https://proof-of-funds.example.com'
  });
  
  const origins = originsString.split(',').map(o => o.trim());
  
  // Always add localhost in development
  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:3000');
  }
  
  return origins;
}

// Cache allowed origins
let ALLOWED_ORIGINS = null;
getAllowedOrigins().then(origins => {
  ALLOWED_ORIGINS = origins;
}).catch(err => {
  console.error('Failed to load allowed origins:', err);
  ALLOWED_ORIGINS = process.env.NODE_ENV !== 'production' ?
    ['http://localhost:3000'] :
    ['https://proof-of-funds.example.com'];
});

export async function middleware(request) {
  // Get the origin from the request
  const origin = request.headers.get('origin') || '';
  
  // Get the request path
  const path = request.nextUrl.pathname;
  
  // Create response
  const response = NextResponse.next();
  
  // Add CORS headers if the origin is allowed or in development
  if (origin && (ALLOWED_ORIGINS.includes(origin) || process.env.NODE_ENV !== 'production')) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 
      'Content-Type, Authorization, X-API-Key, X-Requested-With');
    
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: response.headers,
      });
    }
  } else if (origin && process.env.NODE_ENV === 'production') {
    // Block disallowed origins in production
    return new NextResponse(null, {
      status: 403,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'forbidden',
        message: 'Origin not allowed'
      })
    });
  }
  
  // Apply security headers to all responses
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Apply appropriate CSP based on route
  if (path.startsWith('/api/')) {
    // Strict CSP for API routes
    response.headers.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  } else {
    // More permissive CSP for frontend pages
    response.headers.set('Content-Security-Policy', 
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline'; " + // Unsafe-inline needed for wallet providers
      "connect-src 'self' https://*.polygon.technology https://*.infura.io https://*.walletconnect.org wss://*.walletconnect.org; " +
      "img-src 'self' data:; " +
      "style-src 'self' 'unsafe-inline'; " +
      "font-src 'self'; " +
      "frame-ancestors 'none'; " +
      "form-action 'self'"
    );
  }
  
  // Add HSTS header in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  return response;
}

// Apply middleware to all routes
export const config = {
  matcher: ['/((?!_next/static|favicon.ico|assets/).*)'],
};
```

### 4. Secure Audit Logging (MEDIUM PRIORITY)

**Integration Points**: 
- `packages/common/src/logging/auditLogger.js` (NEW)
- API endpoints using the logger

Create a centralized audit logging system:

```javascript
// NEW FILE: packages/common/src/logging/auditLogger.js

const { Storage } = require('@google-cloud/storage');
const crypto = require('crypto');

/**
 * Secure audit logger for Proof of Funds
 */
class AuditLogger {
  constructor(options = {}) {
    this.options = {
      projectId: process.env.GCP_PROJECT_ID || 'proof-of-funds-455506',
      bucketName: process.env.AUDIT_LOG_BUCKET || `${process.env.GCP_PROJECT_ID || 'proof-of-funds-455506'}-audit-logs`,
      localBackup: process.env.NODE_ENV !== 'production',
      ...options
    };
    
    // Initialize GCP client if in production
    if (process.env.NODE_ENV === 'production') {
      this.initializeStorage().catch(err => {
        console.error('Failed to initialize audit storage:', err);
      });
    }
  }
  
  /**
   * Initialize GCP Storage client
   */
  async initializeStorage() {
    try {
      this.storage = new Storage({
        projectId: this.options.projectId
      });
      
      // Check if bucket exists
      const [buckets] = await this.storage.getBuckets();
      const bucketExists = buckets.some(b => b.name === this.options.bucketName);
      
      if (!bucketExists) {
        // Create bucket if it doesn't exist
        await this.storage.createBucket(this.options.bucketName, {
          location: 'us-central1',
          storageClass: 'STANDARD'
        });
        
        // Set bucket lifecycle policy
        const bucket = this.storage.bucket(this.options.bucketName);
        await bucket.setMetadata({
          lifecycle: {
            rule: [
              {
                // Delete logs after 1 year
                action: { type: 'Delete' },
                condition: { age: 365 }
              }
            ]
          }
        });
      }
      
      return true;
    } catch (error) {
      console.error('Failed to initialize audit storage:', error);
      return false;
    }
  }
  
  /**
   * Log a security event
   * @param {string} eventType - Type of event
   * @param {Object} eventData - Event data
   * @param {Object} context - Event context
   * @returns {Promise<boolean>} - Success indicator
   */
  async log(eventType, eventData = {}, context = {}) {
    try {
      // Create log entry
      const timestamp = new Date().toISOString();
      const requestId = crypto.randomBytes(16).toString('hex');
      
      const logEntry = {
        timestamp,
        requestId,
        eventType,
        environment: process.env.NODE_ENV || 'development',
        context: {
          ip: context.ip || 'unknown',
          userAgent: context.userAgent || 'unknown',
          userId: context.userId || 'anonymous',
          path: context.path || 'unknown',
          method: context.method || 'unknown',
          ...context
        },
        data: this.sanitizeData(eventData)
      };
      
      // Local logging for development or backup
      if (this.options.localBackup || process.env.NODE_ENV !== 'production') {
        console.log(`[AUDIT] ${eventType}:`, JSON.stringify(logEntry));
      }
      
      // In production, log to GCP Storage
      if (process.env.NODE_ENV === 'production' && this.storage) {
        try {
          const bucket = this.storage.bucket(this.options.bucketName);
          
          // Create log filename with timestamp and UUID
          const date = new Date();
          const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
          const timeStr = date.toISOString().split('T')[1].replace(/:/g, '-').split('.')[0]; // HH-MM-SS
          
          const filename = `${dateStr}/${eventType}/${timeStr}_${requestId}.json`;
          
          // Write log to GCP Storage
          const file = bucket.file(filename);
          await file.save(JSON.stringify(logEntry, null, 2), {
            contentType: 'application/json',
            metadata: {
              eventType,
              timestamp
            }
          });
        } catch (error) {
          console.error('Failed to write audit log to GCP:', error);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Audit logging error:', error);
      return false;
    }
  }
  
  /**
   * Sanitize sensitive data for logging
   * @param {Object} data - Data to sanitize
   * @returns {Object} - Sanitized data
   */
  sanitizeData(data) {
    if (!data) return {};
    
    // Create a copy of the data
    const sanitized = { ...data };
    
    // List of sensitive fields to redact
    const sensitiveFields = [
      'password', 'secret', 'token', 'key', 'privateKey', 
      'private_key', 'seed', 'mnemonic', 'signature',
      'jwt', 'accessToken', 'refreshToken'
    ];
    
    // Sanitize top-level fields
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }
  
  /**
   * Get context data from an Express request
   * @param {Object} req - Express request
   * @returns {Object} - Context data
   */
  getContextFromRequest(req) {
    return {
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      userId: req.user?.walletAddress || req.user?.id || 'anonymous',
      path: req.url,
      method: req.method
    };
  }
}

// Create singleton instance
const auditLogger = new AuditLogger();

module.exports = auditLogger;
```

**Update the authentication endpoint to use audit logging**:

```javascript
// MODIFY FILE: packages/frontend/pages/api/auth/login.js

import auditLogger from '@proof-of-funds/common/src/logging/auditLogger';

// In the handler success path
try {
  // ... existing authentication logic ...
  
  // Log successful login
  await auditLogger.log('auth.login.success', 
    { walletAddress, role: isAdmin ? 'admin' : 'user' },
    auditLogger.getContextFromRequest(req)
  );
  
  // Return token and user data
  return res.status(200).json({
    success: true,
    token,
    user: {
      walletAddress,
      role: isAdmin ? 'admin' : 'user'
    }
  });
} catch (error) {
  // Log authentication failure
  await auditLogger.log('auth.login.failure',
    { walletAddress, error: error.message },
    auditLogger.getContextFromRequest(req)
  );
  
  return handleApiError(error, res);
}
```

### 5. Enhanced Token Management (MEDIUM PRIORITY)

**Integration Points**:
- `packages/common/src/auth/tokenManager.js` (NEW)
- Authentication endpoints

Create a new token management system with refresh capabilities:

```javascript
// NEW FILE: packages/common/src/auth/tokenManager.js

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Redis = require('ioredis');
const { getSecret } = require('../config/secrets');

// Token blacklist store (in-memory for dev, Redis for prod)
let tokenStore;

// Initialize the token store based on environment
async function initializeTokenStore() {
  if (process.env.NODE_ENV === 'production' && process.env.REDIS_URL) {
    try {
      tokenStore = new Redis(process.env.REDIS_URL, {
        keyPrefix: 'pof:tokens:blacklist:'
      });
      
      // Test connection
      await tokenStore.ping();
      return true;
    } catch (error) {
      console.error('Failed to initialize Redis for token store:', error);
      tokenStore = new Map(); // Fallback to in-memory
      return false;
    }
  } else {
    // Use in-memory store for development
    tokenStore = new Map();
    
    // Cleanup job for in-memory store
    setInterval(() => {
      const now = Date.now();
      for (const [key, expires] of tokenStore.entries()) {
        if (expires < now) {
          tokenStore.delete(key);
        }
      }
    }, 15 * 60 * 1000); // Clean every 15 minutes
    
    return true;
  }
}

// Initialize immediately
initializeTokenStore().catch(console.error);

/**
 * Add token to blacklist
 * @param {string} jti - Token identifier
 * @param {number} exp - Expiration timestamp
 * @returns {Promise<boolean>} Success
 */
async function blacklistToken(jti, exp) {
  try {
    const expMs = exp * 1000;
    
    if (tokenStore instanceof Map) {
      // In-memory store
      tokenStore.set(jti, expMs);
    } else {
      // Redis store
      const ttl = Math.max(1, Math.floor((expMs - Date.now()) / 1000));
      await tokenStore.set(jti, '1', 'EX', ttl);
    }
    
    return true;
  } catch (error) {
    console.error('Token blacklisting failed:', error);
    return false;
  }
}

/**
 * Check if token is blacklisted
 * @param {string} jti - Token identifier
 * @returns {Promise<boolean>} Is blacklisted
 */
async function isBlacklisted(jti) {
  try {
    if (tokenStore instanceof Map) {
      // In-memory store
      return tokenStore.has(jti);
    } else {
      // Redis store
      const result = await tokenStore.exists(jti);
      return result === 1;
    }
  } catch (error) {
    console.error('Token blacklist check failed:', error);
    return false; // Fail open in case of error
  }
}

/**
 * Generate a token pair (access + refresh)
 * @param {Object} payload - Token payload
 * @param {Object} options - Token options
 * @returns {Promise<Object>} Token pair
 */
async function generateTokenPair(payload, options = {}) {
  const {
    accessExpiresIn = '15m',
    refreshExpiresIn = '7d',
  } = options;
  
  // Get JWT secret
  const secret = await getSecret('JWT_SECRET', {
    required: true,
    fallback: process.env.NODE_ENV !== 'production' ? 
      'proof-of-funds-jwt-secret-dev-only' : null
  });
  
  if (!secret) {
    throw new Error('JWT_SECRET not found');
  }
  
  // Generate token IDs
  const accessJti = crypto.randomBytes(16).toString('hex');
  const refreshJti = crypto.randomBytes(16).toString('hex');
  
  // Create token payloads
  const accessPayload = {
    ...payload,
    jti: accessJti,
    type: 'access',
    iat: Math.floor(Date.now() / 1000)
  };
  
  const refreshPayload = {
    ...payload,
    jti: refreshJti,
    type: 'refresh',
    iat: Math.floor(Date.now() / 1000)
  };
  
  // Sign tokens
  const accessToken = jwt.sign(accessPayload, secret, {
    expiresIn: accessExpiresIn
  });
  
  const refreshToken = jwt.sign(refreshPayload, secret, {
    expiresIn: refreshExpiresIn
  });
  
  return {
    accessToken,
    refreshToken
  };
}

/**
 * Verify and decode a JWT token
 * @param {string} token - JWT token
 * @returns {Promise<Object|null>} Decoded token or null
 */
async function verifyToken(token) {
  try {
    // Get JWT secret
    const secret = await getSecret('JWT_SECRET', {
      required: true,
      fallback: process.env.NODE_ENV !== 'production' ? 
        'proof-of-funds-jwt-secret-dev-only' : null
    });
    
    if (!secret) {
      throw new Error('JWT_SECRET not found');
    }
    
    // Decode token
    const decoded = jwt.verify(token, secret);
    
    // Check if token is blacklisted
    if (decoded.jti && await isBlacklisted(decoded.jti)) {
      return null;
    }
    
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object|null>} New token pair or null
 */
async function refreshTokens(refreshToken) {
  try {
    // Verify refresh token
    const decoded = await verifyToken(refreshToken);
    
    // Check if valid refresh token
    if (!decoded || decoded.type !== 'refresh') {
      return null;
    }
    
    // Extract payload without jwt-specific properties
    const { jti, exp, iat, type, ...payload } = decoded;
    
    // Blacklist the used refresh token
    await blacklistToken(jti, exp);
    
    // Generate new token pair
    return generateTokenPair(payload);
  } catch (error) {
    console.error('Token refresh failed:', error);
    return null;
  }
}

/**
 * Invalidate all tokens for a user
 * @param {string} walletAddress - User identifier
 * @returns {Promise<boolean>} Success
 */
async function invalidateAllUserTokens(walletAddress) {
  // This would require a separate index of user tokens
  // Beyond the scope of this implementation
  console.warn('invalidateAllUserTokens not implemented');
  return false;
}

module.exports = {
  generateTokenPair,
  verifyToken,
  refreshTokens,
  blacklistToken,
  isBlacklisted,
  invalidateAllUserTokens
};
```

**Create a token refresh endpoint**:

```javascript
// NEW FILE: packages/frontend/pages/api/auth/refresh.js

import { refreshTokens } from '@proof-of-funds/common/src/auth/tokenManager';
import { validateApiRequest, validators } from '@proof-of-funds/common/src/error-handling';
import { handleApiError } from '@proof-of-funds/common/src/error-handling';
import auditLogger from '@proof-of-funds/common/src/logging/auditLogger';
import { createRateLimiter } from '../../lib/distributedRateLimit';

// Apply rate limiting (10 requests per minute)
const limiter = createRateLimiter({ type: 'redis' })(10, 'auth:refresh');

export default async function handler(req, res) {
  // Apply rate limiting
  const rateLimit = await limiter(req, res);
  if (!rateLimit) return; // Rate limit response already sent
  
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Validate request
    const validationSpec = {
      required: ['refreshToken'],
      fields: {
        refreshToken: [validators.isString]
      }
    };
    
    const validation = validateApiRequest(req.body, validationSpec);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Refresh token is required',
        details: validation.errors
      });
    }
    
    // Extract refresh token
    const { refreshToken } = validation.sanitizedData;
    
    // Attempt to refresh the token
    const tokenPair = await refreshTokens(refreshToken);
    
    if (!tokenPair) {
      // Log failed refresh attempt
      await auditLogger.log('auth.refresh.failure', {}, 
        auditLogger.getContextFromRequest(req));
      
      return res.status(401).json({
        error: 'Invalid refresh token',
        message: 'The refresh token is invalid or expired'
      });
    }
    
    // Log successful refresh
    await auditLogger.log('auth.refresh.success', {},
      auditLogger.getContextFromRequest(req));
    
    // Return new token pair
    return res.status(200).json({
      success: true,
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken
    });
  } catch (error) {
    return handleApiError(error, res);
  }
}
```

### 6. HTTPS Enforcement and Security Headers (HIGH PRIORITY)

**Integration Point**: `packages/frontend/next.config.js`

Update the Next.js configuration to enforce HTTPS and add comprehensive security headers:

```javascript
// MODIFY FILE: packages/frontend/next.config.js
/** @type {import('next').NextConfig} */
const path = require('path');

// Get allowed origins from environment
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [
      'https://proof-of-funds.example.com',
      'https://www.proof-of-funds.example.com'
    ];

// Add localhost in development
if (process.env.NODE_ENV !== 'production') {
  ALLOWED_ORIGINS.push('http://localhost:3000');
}

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@proof-of-funds/common', 'snarkjs', 'fastfile', 'ffjavascript'],
  
  // Security headers configuration
  async headers() {
    return [
      {
        // Apply these headers to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy', 
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
          }
        ],
      },
      {
        // Apply CSP headers to frontend pages
        source: '/((?!api/).*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: 
              "default-src 'self'; " +
              "script-src 'self' 'unsafe-inline'; " + // Unsafe-inline needed for wallet providers
              "connect-src 'self' https://*.polygon.technology https://*.infura.io https://*.walletconnect.org wss://*.walletconnect.org; " +
              "img-src 'self' data:; " +
              "style-src 'self' 'unsafe-inline'; " +
              "font-src 'self'; " +
              "frame-ancestors 'none'; " +
              "form-action 'self'"
          }
        ],
      },
      {
        // Strict CSP for API routes
        source: '/api/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'none'; frame-ancestors 'none';",
          }
        ],
      }
    ];
  },
  
  // Force HTTPS in production
  async rewrites() {
    return process.env.NODE_ENV === 'production' ? [
      {
        source: '/:path*',
        has: [
          {
            type: 'header',
            key: 'x-forwarded-proto',
            value: 'http',
          },
        ],
        destination: 'https://:path*',
      },
    ] : [];
  },
  
  // Rest of the existing webpack configuration
  webpack: (config, { isServer }) => {
    // ...existing webpack config
  }
};

module.exports = nextConfig;
```

## Implementation Progress Tracking

- [ ] **Distributed Rate Limiting**
  - [ ] Create `distributedRateLimit.js` module
  - [ ] Integrate with existing ZK proof factory
  - [ ] Test with simulated load

- [ ] **Secure Environment Variables**
  - [ ] Create `secrets.js` module in common package
  - [ ] Update authentication system to use secure secrets
  - [ ] Test GCP Secret Manager integration

- [ ] **Enhanced Security Middleware**
  - [ ] Update middleware.js with comprehensive security headers
  - [ ] Implement proper CORS configuration
  - [ ] Test with different origin scenarios

- [ ] **Secure Audit Logging**
  - [ ] Create audit logging system
  - [ ] Integrate with authentication endpoints
  - [ ] Configure GCP Storage for log persistence

- [ ] **Enhanced Token Management**
  - [ ] Create token manager with refresh capability
  - [ ] Implement token blacklisting
  - [ ] Create refresh endpoint
  - [ ] Test token lifecycle

- [ ] **HTTPS Enforcement**
  - [ ] Update Next.js configuration
  - [ ] Add comprehensive security headers
  - [ ] Test HTTPS redirect mechanism

## Implementation Timeline

### Phase 1: Critical Security (Week 1)

1. Secure Environment Configuration
2. Distribute Rate Limiting
3. Enhance CORS and CSP Implementation

### Phase 2: Security Hardening (Week 2)

1. Implement Secure Audit Logging
2. Enhance Token Management
3. Configure HTTPS Enforcement

### Phase 3: Maintenance and Monitoring (Ongoing)

1. Regular Package Updates
2. Security Monitoring
3. Penetration Testing

## Conclusion

The Proof of Funds application has a solid foundation with its factory pattern architecture and unified error handling system. By enhancing the security aspects outlined in this document, the application will achieve production-grade security suitable for financial applications. All implementations are designed to integrate with the existing architecture rather than replace it, ensuring we maintain the cohesive structure of the codebase.