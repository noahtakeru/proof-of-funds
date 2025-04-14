/**
 * @jest-environment node
 * @jest-global describe
 * @jest-global test
 * @jest-global expect
 * @jest-global beforeEach
 * @jest-global jest
 */

import { VerificationCache } from '../src/VerificationCache.js';

describe('VerificationCache', () => {
  let cache;
  
  beforeEach(() => {
    // Create a new cache for each test
    cache = new VerificationCache({
      maxSize: 5,
      ttlMs: 1000 // 1 second TTL for easier testing
    });
  });
  
  describe('Basic cache operations', () => {
    test('should store and retrieve values', () => {
      const proofId = '0x1234';
      const method = 'onchain';
      const result = { isVerified: true, proofId: '0x1234' };
      
      cache.set(proofId, method, result);
      
      const cachedResult = cache.get(proofId, method);
      
      expect(cachedResult).toEqual(result);
    });
    
    test('should check if values exist', () => {
      const proofId = '0x1234';
      const method = 'onchain';
      const result = { isVerified: true, proofId: '0x1234' };
      
      cache.set(proofId, method, result);
      
      expect(cache.has(proofId, method)).toBe(true);
      expect(cache.has('nonexistent', method)).toBe(false);
    });
    
    test('should delete values', () => {
      const proofId = '0x1234';
      const method = 'onchain';
      const result = { isVerified: true, proofId: '0x1234' };
      
      cache.set(proofId, method, result);
      expect(cache.has(proofId, method)).toBe(true);
      
      cache.delete(proofId, method);
      expect(cache.has(proofId, method)).toBe(false);
    });
    
    test('should clear all values', () => {
      const proofId1 = '0x1234';
      const proofId2 = '0x5678';
      const method = 'onchain';
      const result = { isVerified: true };
      
      cache.set(proofId1, method, result);
      cache.set(proofId2, method, result);
      
      expect(cache.size()).toBe(2);
      
      cache.clear();
      
      expect(cache.size()).toBe(0);
      expect(cache.has(proofId1, method)).toBe(false);
      expect(cache.has(proofId2, method)).toBe(false);
    });
  });
  
  describe('Time-to-live (TTL) behavior', () => {
    test('should expire entries after TTL', async () => {
      const proofId = '0x1234';
      const method = 'onchain';
      const result = { isVerified: true, proofId: '0x1234' };
      
      cache.set(proofId, method, result);
      
      // Entry should be available immediately
      expect(cache.get(proofId, method)).toEqual(result);
      
      // Wait for the entry to expire
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Entry should be expired
      expect(cache.get(proofId, method)).toBeNull();
    });
    
    test('should consider entries when checking existence', async () => {
      const proofId = '0x1234';
      const method = 'onchain';
      const result = { isVerified: true, proofId: '0x1234' };
      
      cache.set(proofId, method, result);
      
      // Entry should exist immediately
      expect(cache.has(proofId, method)).toBe(true);
      
      // Wait for the entry to expire
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Entry should not exist after expiration
      expect(cache.has(proofId, method)).toBe(false);
    });
  });
  
  describe('Size management', () => {
    test('should trim cache when exceeding maxSize', () => {
      // Add more entries than the max size
      for (let i = 0; i < 10; i++) {
        const proofId = `0x${i}`;
        const method = 'onchain';
        const result = { isVerified: true, proofId: `0x${i}` };
        
        cache.set(proofId, method, result);
      }
      
      // Cache size should be limited to maxSize
      expect(cache.size()).toBe(5);
      
      // The most recently added entries should be kept
      expect(cache.has('0x9', 'onchain')).toBe(true);
      expect(cache.has('0x8', 'onchain')).toBe(true);
      
      // The oldest entries should be removed
      expect(cache.has('0x0', 'onchain')).toBe(false);
      expect(cache.has('0x1', 'onchain')).toBe(false);
    });
    
    test('should prioritize more frequently accessed entries when trimming', () => {
      // Add entries and access some more frequently
      for (let i = 0; i < 5; i++) {
        const proofId = `0x${i}`;
        const method = 'onchain';
        const result = { isVerified: true, proofId: `0x${i}` };
        
        cache.set(proofId, method, result);
        
        // Access entries with even indices multiple times
        if (i % 2 === 0) {
          for (let j = 0; j < 3; j++) {
            cache.get(proofId, method);
          }
        }
      }
      
      // Add a new entry to trigger trimming
      cache.set('0x5', 'onchain', { isVerified: true, proofId: '0x5' });
      
      // Frequently accessed entries should be kept
      expect(cache.has('0x0', 'onchain')).toBe(true);
      expect(cache.has('0x2', 'onchain')).toBe(true);
      expect(cache.has('0x4', 'onchain')).toBe(true);
      
      // Less frequently accessed entries might be removed
      // (actually depends on implementation details)
    });
  });
  
  describe('Statistics', () => {
    test('should track hit and miss statistics', () => {
      const proofId = '0x1234';
      const method = 'onchain';
      const result = { isVerified: true, proofId: '0x1234' };
      
      // Add an entry
      cache.set(proofId, method, result);
      
      // Hit
      cache.get(proofId, method);
      
      // Miss
      cache.get('nonexistent', method);
      
      const stats = cache.stats();
      
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });
    
    test('should provide comprehensive stats', () => {
      const proofId = '0x1234';
      const method = 'onchain';
      const result = { isVerified: true, proofId: '0x1234' };
      
      // Add an entry
      cache.set(proofId, method, result);
      
      // Access it a few times
      cache.get(proofId, method);
      cache.get(proofId, method);
      
      const stats = cache.stats();
      
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(stats).toHaveProperty('ttlMs');
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('oldestEntryAge');
      
      expect(stats.size).toBe(1);
      expect(stats.maxSize).toBe(5);
      expect(stats.hits).toBe(2);
      expect(stats.oldestEntryAge).toBeGreaterThanOrEqual(0);
    });
  });
});