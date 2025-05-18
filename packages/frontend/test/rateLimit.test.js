/**
 * Rate Limiter Integration Tests
 * 
 * Tests for both in-memory and Redis-based rate limiters
 * Note: These tests require a running Redis instance when testing the Redis limiter
 */

const createDistributedRateLimiter = require('../lib/distributedRateLimit');
const originalMemoryLimiter = require('../lib/rateLimit').default;

// Mock response and request objects
function createMockReq() {
  return {
    headers: { 'x-forwarded-for': '127.0.0.1' },
    socket: { remoteAddress: '127.0.0.1' },
    user: { walletAddress: '0xTestWallet' }
  };
}

function createMockRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    headers: new Map()
  };
  return res;
}

// Tests can be run by setting up Jest in the project
describe('Rate Limiter', () => {
  // Test for memory-based limiter
  test('Memory limiter should allow requests under limit', async () => {
    // Uses the original memory-based limiter
    const limiter = createDistributedRateLimiter({ type: 'memory' })(2, 'test');
    const req = createMockReq();
    const res = createMockRes();
    
    // First request should be allowed
    expect(await limiter(req, res)).toBe(true);
    
    // Second request should be allowed
    expect(await limiter(req, res)).toBe(true);
    
    // Third request should be blocked
    expect(await limiter(req, res)).toBe(false);
    expect(res.status).toHaveBeenCalledWith(429);
  });
  
  // Test for Redis-based limiter (requires Redis)
  test('Redis limiter should fall back to memory if Redis is unavailable', async () => {
    // Configure with invalid Redis URL to force fallback
    const limiter = createDistributedRateLimiter({ 
      type: 'redis', 
      redisUrl: 'redis://invalid:1234'
    })(2, 'test');
    
    const req = createMockReq();
    const res = createMockRes();
    
    // Should fall back to memory limiter
    expect(await limiter(req, res)).toBe(true);
  });
  
  // Integration with ZK Proof Handler
  test('Rate limiter integration with ZK Proof Handler', () => {
    // Import the handler factory
    const { createZkProofHandler } = require('../utils/zkProofHandler');
    
    // Create handler with memory limiter for test
    const handler = createZkProofHandler({
      rateLimit: 5,
      rateLimiterType: 'memory'
    });
    
    // Check that handler is properly created
    expect(typeof handler).toBe('function');
  });
});

// This module is a test file, not meant to be run directly
console.log('To run these tests, set up Jest in the project and run: npm test');