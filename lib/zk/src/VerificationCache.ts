/**
 * @file VerificationCache.ts
 * @description Implements a caching system for ZK proof verification results
 */

import { VerificationResult } from './types/contractTypes';
import { VerificationMethod } from './VerificationPathways';

/**
 * Cache entry for verification results
 */
interface CacheEntry {
  result: VerificationResult;
  timestamp: number;
  method: VerificationMethod;
  hits: number;
}

/**
 * Configuration for the verification cache
 */
export interface VerificationCacheConfig {
  maxSize: number;
  ttlMs: number;
  checkFrequencyMs?: number;
}

/**
 * Cache for ZK proof verification results
 */
export class VerificationCache {
  private cache: Map<string, CacheEntry> = new Map();
  private config: VerificationCacheConfig;
  private lastCleanup: number = 0;
  private hits: number = 0;
  private misses: number = 0;
  
  /**
   * Creates a new verification cache
   * @param config Cache configuration
   */
  constructor(config: VerificationCacheConfig) {
    this.config = {
      checkFrequencyMs: 60000, // 1 minute
      ...config
    };
  }
  
  /**
   * Stores a verification result in the cache
   * @param proofId The proof ID
   * @param method The verification method
   * @param result The verification result
   */
  set(proofId: string, method: VerificationMethod, result: VerificationResult): void {
    const key = this.getCacheKey(proofId, method);
    
    const entry: CacheEntry = {
      result,
      timestamp: Date.now(),
      method,
      hits: 0
    };
    
    this.cache.set(key, entry);
    
    // Check if we need to clean up expired entries
    this.maybeCleanup();
    
    // Trim cache if it exceeds max size
    if (this.cache.size > this.config.maxSize) {
      this.trim();
    }
  }
  
  /**
   * Gets a verification result from the cache
   * @param proofId The proof ID
   * @param method The verification method
   * @returns The verification result or null if not found or expired
   */
  get(proofId: string, method: VerificationMethod): VerificationResult | null {
    const key = this.getCacheKey(proofId, method);
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return null;
    }
    
    // Check if entry has expired
    const now = Date.now();
    if (now - entry.timestamp > this.config.ttlMs) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    
    // Update hit count and return the result
    entry.hits++;
    this.hits++;
    return entry.result;
  }
  
  /**
   * Checks if a proof has been verified
   * @param proofId The proof ID
   * @param method The verification method
   * @returns True if the proof has been verified and is in the cache
   */
  has(proofId: string, method: VerificationMethod): boolean {
    const key = this.getCacheKey(proofId, method);
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }
    
    // Check if entry has expired
    const now = Date.now();
    if (now - entry.timestamp > this.config.ttlMs) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * Removes an entry from the cache
   * @param proofId The proof ID
   * @param method The verification method
   * @returns True if the entry was found and removed
   */
  delete(proofId: string, method: VerificationMethod): boolean {
    const key = this.getCacheKey(proofId, method);
    return this.cache.delete(key);
  }
  
  /**
   * Clears all entries from the cache
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
  
  /**
   * Gets the current size of the cache
   * @returns The number of entries in the cache
   */
  size(): number {
    return this.cache.size;
  }
  
  /**
   * Gets statistics about the cache
   * @returns Cache statistics
   */
  stats(): {
    size: number;
    maxSize: number;
    ttlMs: number;
    hits: number;
    misses: number;
    hitRate: number;
    oldestEntryAge?: number;
    mostHit?: {
      proofId: string;
      method: VerificationMethod;
      hits: number;
    };
  } {
    const now = Date.now();
    let oldestEntry: CacheEntry | null = null;
    let oldestEntryKey: string | null = null;
    let mostHitEntry: CacheEntry | null = null;
    let mostHitEntryKey: string | null = null;
    
    // Find the oldest entry and most hit entry
    for (const [key, entry] of this.cache.entries()) {
      // Check for oldest
      if (!oldestEntry || entry.timestamp < oldestEntry.timestamp) {
        oldestEntry = entry;
        oldestEntryKey = key;
      }
      
      // Check for most hit
      if (!mostHitEntry || entry.hits > mostHitEntry.hits) {
        mostHitEntry = entry;
        mostHitEntryKey = key;
      }
    }
    
    // Calculate hit rate
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? (this.hits / totalRequests) : 0;
    
    // Parse the most hit entry key to get the proofId and method
    let mostHit;
    if (mostHitEntry && mostHitEntryKey) {
      const [proofId, method] = mostHitEntryKey.split(':');
      mostHit = {
        proofId,
        method: method as VerificationMethod,
        hits: mostHitEntry.hits
      };
    }
    
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      ttlMs: this.config.ttlMs,
      hits: this.hits,
      misses: this.misses,
      hitRate,
      oldestEntryAge: oldestEntry ? (now - oldestEntry.timestamp) : undefined,
      mostHit
    };
  }
  
  /**
   * Cleans up expired entries if the cleanup frequency has been reached
   */
  private maybeCleanup(): void {
    const now = Date.now();
    
    // Only cleanup if the frequency has been reached
    if (now - this.lastCleanup < this.config.checkFrequencyMs!) {
      return;
    }
    
    this.cleanup();
    this.lastCleanup = now;
  }
  
  /**
   * Cleans up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    
    // Find and remove expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.ttlMs) {
        this.cache.delete(key);
      }
    }
  }
  
  /**
   * Trims the cache to the maximum size
   */
  private trim(): void {
    if (this.cache.size <= this.config.maxSize) {
      return;
    }
    
    // Sort entries by hits (ascending) and then by age (oldest first)
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => {
        // First sort by hits
        const hitsDiff = a[1].hits - b[1].hits;
        if (hitsDiff !== 0) {
          return hitsDiff;
        }
        
        // Then sort by age
        return a[1].timestamp - b[1].timestamp;
      });
    
    // Remove entries until we reach the desired size
    const entriesToRemove = entries.slice(
      0,
      this.cache.size - this.config.maxSize
    );
    
    for (const [key] of entriesToRemove) {
      this.cache.delete(key);
    }
  }
  
  /**
   * Gets a cache key for a proof ID and method
   * @param proofId The proof ID
   * @param method The verification method
   * @returns The cache key
   */
  private getCacheKey(proofId: string, method: VerificationMethod): string {
    return `${proofId}:${method}`;
  }
}