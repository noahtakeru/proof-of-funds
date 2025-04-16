/**
 * Test suite for NonceValidator
 * 
 * Tests the functionality of the NonceValidator class for anti-replay protection.
 */

import { NonceValidator } from '../NonceValidator';

describe('NonceValidator', () => {
  let validator;
  
  beforeEach(() => {
    // Create a new validator instance with shorter TTL for testing
    validator = new NonceValidator({
      ttlMs: 1000, // 1 second for faster testing
      maxSize: 100,
      timestampToleranceMs: 500, // 500ms tolerance
      strictOrder: false
    });
  });
  
  afterEach(() => {
    // Clean up resources
    validator.destroy();
  });
  
  test('should validate a valid nonce', () => {
    const result = validator.validateNonce('test-nonce-123', 'user1');
    expect(result.valid).toBe(true);
  });
  
  test('should reject an already used nonce', () => {
    validator.validateNonce('test-nonce-456', 'user1');
    const result = validator.validateNonce('test-nonce-456', 'user1');
    
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('ALREADY_USED');
  });
  
  test('should allow the same nonce for different users', () => {
    validator.validateNonce('shared-nonce-789', 'user1');
    const result = validator.validateNonce('shared-nonce-789', 'user2');
    
    expect(result.valid).toBe(true);
  });
  
  test('should reject a nonce with an expired timestamp', () => {
    const now = Date.now();
    const oldTimestamp = now - 2000; // 2 seconds ago, over TTL
    
    const result = validator.validateNonce('expired-nonce', 'user1', oldTimestamp);
    
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('EXPIRED');
  });
  
  test('should reject a nonce with a future timestamp', () => {
    const now = Date.now();
    const futureTimestamp = now + 2000; // 2 seconds in future, over tolerance
    
    const result = validator.validateNonce('future-nonce', 'user1', futureTimestamp);
    
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('FUTURE_TIMESTAMP');
  });
  
  test('should allow a nonce with timestamp within tolerance', () => {
    const now = Date.now();
    const nearFutureTimestamp = now + 300; // 300ms in future, within tolerance
    
    const result = validator.validateNonce('near-future-nonce', 'user1', nearFutureTimestamp);
    
    expect(result.valid).toBe(true);
  });
  
  test('should reject invalid nonce formats', () => {
    const shortResult = validator.validateNonce('abc', 'user1');
    expect(shortResult.valid).toBe(false);
    expect(shortResult.reason).toBe('INVALID_FORMAT');
    
    const nullResult = validator.validateNonce(null, 'user1');
    expect(nullResult.valid).toBe(false);
    expect(nullResult.reason).toBe('INVALID_FORMAT');
  });
  
  test('should clean up expired nonces', async () => {
    // Add some nonces
    validator.validateNonce('cleanup-test-1', 'user1');
    validator.validateNonce('cleanup-test-2', 'user2');
    validator.validateNonce('cleanup-test-3', 'user3');
    
    // Wait for TTL to expire
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    // Force cleanup
    const removedCount = validator.cleanupExpiredNonces();
    
    // Should have removed the expired nonces
    expect(removedCount).toBeGreaterThanOrEqual(3);
    
    // Should now allow reuse of previously used nonces
    const result = validator.validateNonce('cleanup-test-1', 'user1');
    expect(result.valid).toBe(true);
  });
  
  test('should enforce strict ordering when enabled', () => {
    // Create a new validator with strict ordering
    const strictValidator = new NonceValidator({
      ttlMs: 1000,
      strictOrder: true
    });
    
    try {
      // First nonce should be accepted
      const result1 = strictValidator.validateNonce('100', 'orderUser');
      expect(result1.valid).toBe(true);
      
      // Higher nonce should be accepted
      const result2 = strictValidator.validateNonce('200', 'orderUser');
      expect(result2.valid).toBe(true);
      
      // Lower nonce should be rejected
      const result3 = strictValidator.validateNonce('150', 'orderUser');
      expect(result3.valid).toBe(false);
      expect(result3.reason).toBe('OUT_OF_ORDER');
      
      // Non-numeric nonce should still work (not compared)
      const result4 = strictValidator.validateNonce('abc-xyz', 'orderUser');
      expect(result4.valid).toBe(true);
    } finally {
      strictValidator.destroy();
    }
  });
  
  test('should return stats on validation history', () => {
    // Valid nonce
    validator.validateNonce('stats-test-1', 'user1');
    
    // Invalid nonces
    validator.validateNonce('ab', 'user1'); // too short
    validator.validateNonce('stats-test-1', 'user1'); // already used
    
    const stats = validator.getStats();
    
    expect(stats.totalProcessed).toBe(3);
    expect(stats.rejected.alreadyUsed).toBe(1);
    expect(stats.rejected.invalid).toBe(1);
    expect(stats.currentCacheSize).toBeGreaterThan(0);
  });
  
  test('should reset nonce cache and statistics', () => {
    // Add some data
    validator.validateNonce('reset-test-1', 'user1');
    validator.validateNonce('ab', 'user1'); // invalid
    
    // Reset
    validator.reset();
    
    // Check stats are reset
    const stats = validator.getStats();
    expect(stats.totalProcessed).toBe(0);
    expect(stats.rejected.alreadyUsed).toBe(0);
    expect(stats.rejected.invalid).toBe(0);
    expect(stats.currentCacheSize).toBe(0);
    
    // Should allow previously used nonce after reset
    const result = validator.validateNonce('reset-test-1', 'user1');
    expect(result.valid).toBe(true);
  });
});