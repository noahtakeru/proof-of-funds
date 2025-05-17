# Proof of Funds Security Implementation

This document provides an overview of the security implementation for the Proof of Funds application. It covers the distributed rate limiting, token management, secure secrets management, and security audit logging components.

## Security Components

### 1. Distributed Rate Limiting

A Redis-based rate limiting solution that supports horizontal scaling across multiple application instances.

**Key Features:**
- Distributed rate limiting using Redis
- Graceful fallback to in-memory rate limiting
- Privacy-preserving client identification with hashing
- Environment-specific behavior (dev/test/prod)
- Integration with existing rate limiting patterns

**Usage:**
```javascript
const createRateLimiter = require('./lib/distributedRateLimit');

// Create a rate limiter with 10 requests per minute for 'api' resources
const limiter = createRateLimiter({ 
  type: process.env.RATE_LIMITER_TYPE || 'memory' 
})(10, 'api');

// Apply rate limiting in an API handler
async function apiHandler(req, res) {
  const rateLimitResult = await limiter(req, res);
  if (!rateLimitResult) {
    // Rate limit exceeded, response already sent
    return;
  }
  
  // Handle the request normally
  // ...
}
```

### 2. Enhanced Security Headers and HTTPS Enforcement

Comprehensive security headers and HTTPS enforcement configured in Next.js.

**Key Features:**
- HTTP to HTTPS redirection in production
- Content Security Policy (CSP) with route-specific policies
- Strict Transport Security (HSTS) configuration
- X-Content-Type-Options, X-Frame-Options, X-XSS-Protection headers
- Permissions-Policy implementation

**Implementation:**
- Security headers are configured in `next.config.js`
- CORS and additional route-specific headers are configured in `middleware.js`

### 3. Secure Environment Variables Management

Secure access to sensitive environment variables and secrets via GCP Secret Manager.

**Key Features:**
- Integration with GCP Secret Manager
- Caching for performance optimization
- Environment-specific behavior (dev/prod)
- Fallback values for development environments

**Usage:**
```javascript
const { getSecret } = require('@proof-of-funds/common/src/config/secrets');

async function secureOperation() {
  // Get a secret with fallback for development
  const apiKey = await getSecret('API_KEY', {
    required: true,
    fallback: process.env.NODE_ENV !== 'production' ? 'dev-key' : null
  });
  
  // Use the secret
  // ...
}
```

### 4. Enhanced Token Management

Comprehensive JWT token management with refresh tokens and revocation capabilities.

**Key Features:**
- Token pair generation (access + refresh tokens)
- Token blacklisting/revocation
- Distributed token storage with Redis
- Refresh token rotation
- Secure JWT handling

**Usage:**
```javascript
const { generateTokenPair, refreshTokens } = require('@proof-of-funds/common/src/auth/tokenManager');

// Generate token pair
const tokenPair = await generateTokenPair({
  walletAddress: '0x123...',
  role: 'user'
});

// Refresh tokens
const newTokenPair = await refreshTokens(refreshToken);
```

### 5. Security Audit Logging

Centralized audit logging system for security events with GCP Storage integration.

**Key Features:**
- Structured security event logging
- Automatic sanitization of sensitive data
- GCP Storage integration for persistence
- Environment-specific behavior (dev/prod)
- Request context capture utilities

**Usage:**
```javascript
const auditLogger = require('@proof-of-funds/common/src/logging/auditLogger');

// Log a security event
await auditLogger.log('auth.login.success', 
  { walletAddress: '0x123...', role: 'user' },
  auditLogger.getContextFromRequest(req)
);
```

## Integration

All security components are integrated through:

1. **Security Configuration System**: A central module (`lib/securityConfig.js`) that initializes and configures all security components.

2. **Environment Configuration**: A comprehensive `.env.example` file with all required variables for security components.

3. **Integration Tests**: Comprehensive tests (`test/security-integration.test.js`) that verify interactions between security components.

4. **Validation Script**: A script (`scripts/validate-security.js`) to validate security components in deployment environments.

## Environment Variables

The following environment variables are used by security components:

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NODE_ENV` | Environment (development/production) | Yes | - |
| `RATE_LIMITER_TYPE` | Type of rate limiter (memory/redis) | No | memory |
| `REDIS_URL` | Redis connection URL | No | redis://localhost:6379 |
| `JWT_SECRET` | Secret for JWT signing | Yes | dev-only in development |
| `GCP_PROJECT_ID` | Google Cloud project ID | Yes | proof-of-funds-455506 |
| `AUDIT_LOG_BUCKET` | GCP bucket for audit logs | No | {PROJECT_ID}-audit-logs |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed origins | No | See CORS config |

## Security Best Practices

1. **Defense in Depth**: Multiple security layers working together.
2. **Environment-Specific Behavior**: Different security configurations for development vs. production.
3. **Graceful Degradation**: Components fall back gracefully when external services are unavailable.
4. **Principle of Least Privilege**: Minimal permissions and information disclosure.
5. **Secure by Default**: Security features enabled by default without explicit configuration.

## Validation and Testing

To validate security components:
```bash
node scripts/validate-security.js
```

To run integration tests:
```bash
node test/security-integration.test.js
```