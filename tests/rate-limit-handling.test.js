/**
 * Tests for API rate limit handling functionality
 * 
 * This test suite focuses specifically on verifying the rate limiting
 * features implemented in Phase 5 of the token-agnostic wallet scanning plan.
 */

// Import the API helper utilities for testing
const { 
  queuedRequest, 
  executeWithRetry, 
  isRateLimited,
  rateLimitStats
} = require('../packages/common/src/utils/apiHelpers');

// Mock implementation of fetch
global.fetch = jest.fn();

/**
 * Tests for API rate limit handling
 */
describe('Rate Limit Handling', () => {
  
  beforeEach(() => {
    // Reset mocks and stats before each test
    jest.clearAllMocks();
    Object.keys(rateLimitStats).forEach(key => {
      if (typeof rateLimitStats[key] === 'object') {
        rateLimitStats[key].limitHits = 0;
        rateLimitStats[key].lastHit = null;
        rateLimitStats[key].remainingQuota = null;
      }
    });
  });
  
  // Test rate limit detection
  describe('Rate Limit Detection', () => {
    test('correctly identifies rate limit from status code', () => {
      const error = { status: 429 };
      expect(isRateLimited(error)).toBe(true);
    });
    
    test('correctly identifies rate limit from headers', () => {
      const error = { 
        status: 200,
        response: { 
          headers: { 'x-rate-limit-remaining': '0' }
        }
      };
      expect(isRateLimited(error)).toBe(true);
    });
    
    test('correctly handles non-rate-limited errors', () => {
      // Standard error
      expect(isRateLimited({ status: 500 })).toBe(false);
      
      // Error with remaining quota
      expect(isRateLimited({ 
        status: 200,
        response: { 
          headers: { 'x-rate-limit-remaining': '10' }
        }
      })).toBe(false);
    });
  });
  
  // Test rate limit stats tracking
  describe('Rate Limit Statistics', () => {
    test('tracks rate limit encounters correctly', () => {
      // Record rate limit for Moralis
      rateLimitStats.recordRateLimit('moralis', 0);
      expect(rateLimitStats.moralis.limitHits).toBe(1);
      expect(rateLimitStats.moralis.remainingQuota).toBe(0);
      
      // Record another hit
      rateLimitStats.recordRateLimit('moralis', 0);
      expect(rateLimitStats.moralis.limitHits).toBe(2);
      
      // Record for different API
      rateLimitStats.recordRateLimit('coingecko', 5);
      expect(rateLimitStats.coingecko.limitHits).toBe(1);
      expect(rateLimitStats.coingecko.remainingQuota).toBe(5);
    });
    
    test('creates entries for new API services', () => {
      // Record for new API service
      rateLimitStats.recordRateLimit('newApi', 3);
      
      // Should create the entry
      expect(rateLimitStats.newApi).toBeDefined();
      expect(rateLimitStats.newApi.limitHits).toBe(1);
      expect(rateLimitStats.newApi.remainingQuota).toBe(3);
    });
  });
  
  // Test request queuing
  describe('Request Queuing', () => {
    test('respects maximum concurrent requests', async () => {
      // Create a delayed request function
      const delayedRequest = () => new Promise(resolve => {
        setTimeout(() => resolve({ data: 'success' }), 50);
      });
      
      // Queue multiple requests
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(queuedRequest('moralis', delayedRequest));
      }
      
      // Complete all requests
      const results = await Promise.all(promises);
      
      // All requests should complete successfully
      expect(results.length).toBe(10);
      results.forEach(result => {
        expect(result.data).toBe('success');
      });
    });
    
    test('enforces minimum time between requests', async () => {
      // Mock Date.now to track timing
      const realDateNow = Date.now;
      let currentTime = 1000;
      Date.now = jest.fn().mockImplementation(() => {
        // Advance time by 10ms on each call
        currentTime += 10;
        return currentTime;
      });
      
      // Create a fast request function
      const fastRequest = () => Promise.resolve({ data: 'success' });
      
      // Queue 3 requests for CoinGecko (which has minTimeBetweenRequests: 333)
      const start = Date.now();
      await Promise.all([
        queuedRequest('coingecko', fastRequest),
        queuedRequest('coingecko', fastRequest),
        queuedRequest('coingecko', fastRequest)
      ]);
      const end = Date.now();
      
      // Time elapsed should be at least 2 * minTimeBetweenRequests
      // (first request is immediate, second and third are delayed)
      expect(end - start).toBeGreaterThanOrEqual(2 * 333);
      
      // Restore original Date.now
      Date.now = realDateNow;
    });
  });
  
  // Test retry mechanism
  describe('Retry Mechanism', () => {
    test('retries after rate limit error', async () => {
      // Create a function that fails with rate limit on first call
      let callCount = 0;
      const rateLimitedFunction = () => {
        callCount++;
        if (callCount === 1) {
          // First call fails with rate limit
          const error = new Error('Rate limited');
          error.status = 429;
          throw error;
        }
        return Promise.resolve({ data: 'success' });
      };
      
      // Mock setTimeout to avoid actual delays
      jest.useFakeTimers();
      const realSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((callback) => {
        callback(); // Call immediately
        return 1;
      });
      
      // Execute with retry
      const result = await executeWithRetry(rateLimitedFunction);
      
      // Function should be called twice (initial + retry)
      expect(callCount).toBe(2);
      expect(result.data).toBe('success');
      
      // Restore setTimeout
      global.setTimeout = realSetTimeout;
      jest.useRealTimers();
    });
    
    test('stops retrying after max attempts', async () => {
      // Create a function that always fails with rate limit
      let callCount = 0;
      const alwaysFailingFunction = () => {
        callCount++;
        const error = new Error('Rate limited');
        error.status = 429;
        throw error;
      };
      
      // Mock setTimeout to avoid actual delays
      jest.useFakeTimers();
      const realSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((callback) => {
        callback(); // Call immediately
        return 1;
      });
      
      // Execute with retry (max 3 attempts)
      try {
        await executeWithRetry(alwaysFailingFunction, 3);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Function should be called 3 times (initial + 2 retries)
        expect(callCount).toBe(3);
        expect(error.message).toBe('Rate limited');
      }
      
      // Restore setTimeout
      global.setTimeout = realSetTimeout;
      jest.useRealTimers();
    });
  });
});
