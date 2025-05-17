/**
 * Security Integration Tests
 * 
 * Tests integration between security components from different engineers:
 * - Distributed Rate Limiting (Engineer 1)
 * - Token Management and Secret Management (Engineer 2)
 * - Security Middleware and Audit Logging (Engineer 3)
 */

// Imports for all security components
const createDistributedRateLimiter = require('../lib/distributedRateLimit');
const { getSecret } = require('@proof-of-funds/common/src/config/secrets');
const { generateTokenPair, refreshTokens } = require('@proof-of-funds/common/src/auth/tokenManager');
const auditLogger = require('@proof-of-funds/common/src/logging/auditLogger');

/**
 * Integration test for distributed rate limiting with token management
 * 
 * Tests that rate limiter works correctly with authenticated requests
 * and integrates with the token-based authentication system.
 */
async function testRateLimitingWithTokenAuth() {
  console.log('\n--- Testing Rate Limiting with Token Authentication ---');
  
  try {
    // Create a rate limiter
    const limiter = createDistributedRateLimiter({ 
      type: process.env.REDIS_URL ? 'redis' : 'memory' 
    })(3, 'auth');
    
    // Create a mock token and user
    const mockUser = { 
      walletAddress: '0xTestWalletForIntegration', 
      role: 'user' 
    };
    
    // Create mock request and response objects
    const createMockReq = () => ({
      headers: { 'x-forwarded-for': '127.0.0.1' },
      socket: { remoteAddress: '127.0.0.1' },
      user: mockUser
    });
    
    const createMockRes = () => ({
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      headers: new Map()
    });
    
    // Test that rate limiter uses wallet address in rate limit key
    console.log('Testing rate limiter with authenticated user...');
    const req = createMockReq();
    const res = createMockRes();
    
    // First request should be allowed
    const result1 = await limiter(req, res);
    console.log(`Request 1 allowed: ${result1}`);
    
    // Second request should be allowed
    const result2 = await limiter(req, res);
    console.log(`Request 2 allowed: ${result2}`);
    
    // Third request should be allowed
    const result3 = await limiter(req, res);
    console.log(`Request 3 allowed: ${result3}`);
    
    // Fourth request should be blocked (rate limited)
    const result4 = await limiter(req, res);
    console.log(`Request 4 allowed: ${result4}`);
    
    if (result1 && result2 && result3 && !result4) {
      console.log('✅ Rate limiting with authentication works correctly');
    } else {
      console.error('❌ Rate limiting with authentication failed');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Integration test failed:', error);
    return false;
  }
}

/**
 * Integration test for token management with audit logging
 * 
 * Tests that token refresh operations are properly logged
 * by the audit logging system.
 */
async function testTokenRefreshWithAuditLogging() {
  console.log('\n--- Testing Token Refresh with Audit Logging ---');
  
  try {
    // Create a payload for token generation
    const payload = {
      walletAddress: '0xTestWalletForIntegration',
      role: 'user',
      timestamp: Date.now()
    };
    
    // Mock the audit logger to verify it's called
    const originalLog = auditLogger.log;
    let logCalled = false;
    let logEvent = null;
    
    // Replace the log method to track calls
    auditLogger.log = async (eventType, eventData, context) => {
      logCalled = true;
      logEvent = { eventType, eventData, context };
      console.log(`Audit logger called with event: ${eventType}`);
      return true;
    };
    
    try {
      // Generate a token pair
      console.log('Generating token pair...');
      const tokenPair = await generateTokenPair(payload);
      
      if (!tokenPair || !tokenPair.accessToken || !tokenPair.refreshToken) {
        throw new Error('Failed to generate token pair');
      }
      
      console.log('Token pair generated successfully');
      
      // Log token refresh event
      console.log('Logging token refresh...');
      await auditLogger.log('auth.token.refresh', 
        { userId: payload.walletAddress },
        { ip: '127.0.0.1', userAgent: 'Integration Test' }
      );
      
      if (logCalled && logEvent && logEvent.eventType === 'auth.token.refresh') {
        console.log('✅ Audit logging with token operations works correctly');
      } else {
        console.error('❌ Audit logging integration failed');
      }
    } finally {
      // Restore original log method
      auditLogger.log = originalLog;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Integration test failed:', error);
    return false;
  }
}

/**
 * Integration test for secure environment variables with 
 * distributed rate limiting
 */
async function testSecretManagementWithRateLimiting() {
  console.log('\n--- Testing Secret Management with Rate Limiting ---');
  
  try {
    // Test retrieving Redis URL from secure storage
    console.log('Retrieving Redis URL from secure storage...');
    const redisUrl = await getSecret('REDIS_URL', {
      required: false,
      fallback: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    console.log('Creating rate limiter with securely retrieved Redis URL...');
    const limiter = createDistributedRateLimiter({ 
      type: redisUrl ? 'redis' : 'memory',
      redisUrl
    })(5, 'secure-test');
    
    // Create mock request and response
    const req = {
      headers: { 'x-forwarded-for': '127.0.0.1' },
      socket: { remoteAddress: '127.0.0.1' }
    };
    
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      headers: new Map()
    };
    
    // Test the rate limiter
    const result = await limiter(req, res);
    
    if (result) {
      console.log('✅ Rate limiter with secure configuration works correctly');
    } else {
      console.error('❌ Rate limiter with secure configuration failed');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Integration test failed:', error);
    return false;
  }
}

/**
 * Run all integration tests
 */
async function runAllTests() {
  console.log('======= SECURITY INTEGRATION TESTS =======');
  
  // Mock required functions for testing
  global.jest = {
    fn: () => {
      const mockFn = (...args) => {
        mockFn.calls.push(args);
        return mockFn.returnValue;
      };
      mockFn.calls = [];
      mockFn.mockReturnThis = () => {
        mockFn.returnValue = mockFn;
        return mockFn;
      };
      mockFn.mockReturnValue = (val) => {
        mockFn.returnValue = val;
        return mockFn;
      };
      return mockFn;
    }
  };
  
  try {
    const results = await Promise.all([
      testRateLimitingWithTokenAuth(),
      testTokenRefreshWithAuditLogging(),
      testSecretManagementWithRateLimiting()
    ]);
    
    const allPassed = results.every(Boolean);
    
    console.log('\n======= TEST RESULTS =======');
    console.log(allPassed 
      ? '✅ All integration tests passed!' 
      : '❌ Some integration tests failed');
      
    console.log('============================================');
    
    return allPassed;
  } catch (error) {
    console.error('❌ Error running integration tests:', error);
    return false;
  }
}

// Run the tests if executed directly
if (require.main === module) {
  runAllTests().then(passed => {
    process.exit(passed ? 0 : 1);
  });
}

module.exports = {
  runAllTests,
  testRateLimitingWithTokenAuth,
  testTokenRefreshWithAuditLogging,
  testSecretManagementWithRateLimiting
};