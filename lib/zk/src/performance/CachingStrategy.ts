/**
 * @fileoverview Intelligent caching strategy for ZK operations
 * 
 * This module provides tools for optimizing repeated operations through
 * intelligent caching, with automatic eviction policies and memory management.
 */

import { MemoryOptimizer } from './MemoryOptimizer';

/**
 * Eviction policy for cache entries
 */
export enum EvictionPolicy {
  /** Least Recently Used - Remove the oldest accessed item */
  LRU = 'lru',
  /** First In First Out - Remove the oldest added item */
  FIFO = 'fifo',
  /** Least Frequently Used - Remove the least used item */
  LFU = 'lfu',
  /** Time-To-Live - Remove items based on age */
  TTL = 'ttl',
  /** Random Replacement - Remove a random item */
  RANDOM = 'random',
  /** Size-based - Remove largest items first */
  SIZE = 'size'
}

/**
 * Cache entry metadata
 */
interface CacheEntryMeta {
  /** When the entry was created */
  createdAt: number;
  /** When the entry was last accessed */
  lastAccessed: number;
  /** Number of times the entry has been accessed */
  accessCount: number;
  /** Approximate size of the entry in bytes */
  sizeBytes: number;
  /** Optional time-to-live in milliseconds */
  ttlMs?: number;
  /** Optional priority (higher = more important) */
  priority?: number;
}

/**
 * Cache entry with value and metadata
 */
interface CacheEntry<T> {
  /** The cached value */
  value: T;
  /** Metadata about the cache entry */
  meta: CacheEntryMeta;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Current number of entries */
  size: number;
  /** Maximum allowed entries */
  maxSize: number;
  /** Total number of cache hits */
  hits: number;
  /** Total number of cache misses */
  misses: number;
  /** Hit rate (hits / (hits + misses)) */
  hitRate: number;
  /** Estimated total memory usage in bytes */
  memoryUsageBytes: number;
  /** Maximum allowed memory usage in bytes */
  maxMemoryBytes: number;
  /** Number of evictions that have occurred */
  evictionCount: number;
  /** Timestamp when stats were collected */
  timestamp: number;
}

/**
 * Configuration for the caching strategy
 */
export interface CachingConfig {
  /** Maximum number of entries in the cache */
  maxEntries: number;
  /** Maximum memory usage in bytes */
  maxMemoryBytes: number;
  /** Default time-to-live in milliseconds (0 = no expiration) */
  defaultTtlMs: number;
  /** Eviction policy */
  evictionPolicy: EvictionPolicy;
  /** Whether to track entry sizes */
  trackSize: boolean;
  /** Whether to track hot entries (frequently accessed) */
  trackHotEntries: boolean;
  /** Whether to precompute common values */
  enablePrecomputation: boolean;
  /** Whether to enable background refresh of expiring entries */
  enableBackgroundRefresh: boolean;
}

/**
 * Options when setting cache entries
 */
export interface CacheSetOptions {
  /** Time-to-live in milliseconds (0 = no expiration) */
  ttlMs?: number;
  /** Approximate size in bytes (if known) */
  sizeBytes?: number;
  /** Priority (higher = more important) */
  priority?: number;
  /** Function to refresh the value when it expires */
  refreshFn?: () => Promise<any>;
}

/**
 * Function to compute a cache value if not present
 */
export type ComputeFunction<T> = () => Promise<T>;

/**
 * Intelligent caching strategy for ZK operations
 */
export class CachingStrategy {
  private cache: Map<string, Map<string, CacheEntry<any>>> = new Map();
  private config: CachingConfig;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0
  };
  private memoryOptimizer?: MemoryOptimizer;
  private refreshTimers: Map<string, NodeJS.Timeout> = new Map();
  private precomputePromises: Map<string, Promise<any>> = new Map();
  
  /**
   * Create a new caching strategy
   */
  constructor(config?: Partial<CachingConfig>, memoryOptimizer?: MemoryOptimizer) {
    // Default configuration
    this.config = {
      maxEntries: 1000,
      maxMemoryBytes: 100 * 1024 * 1024, // 100MB
      defaultTtlMs: 5 * 60 * 1000, // 5 minutes
      evictionPolicy: EvictionPolicy.LRU,
      trackSize: true,
      trackHotEntries: true,
      enablePrecomputation: true,
      enableBackgroundRefresh: true
    };
    
    // Apply custom configuration
    if (config) {
      this.config = {
        ...this.config,
        ...config
      };
    }
    
    // Set memory optimizer if provided
    this.memoryOptimizer = memoryOptimizer;
  }
  
  /**
   * Get an entry from the cache
   * 
   * @param namespace Namespace to group related entries
   * @param key Key to identify the entry
   * @returns The cached value or null if not found
   */
  public get<T>(namespace: string, key: string): T | null {
    // Get namespace map
    const namespaceMap = this.cache.get(namespace);
    if (!namespaceMap) {
      this.stats.misses++;
      return null;
    }
    
    // Get cache entry
    const entry = namespaceMap.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    // Check if entry has expired
    if (this.hasExpired(entry)) {
      // Remove expired entry
      namespaceMap.delete(key);
      
      // Check if namespace is now empty
      if (namespaceMap.size === 0) {
        this.cache.delete(namespace);
      }
      
      this.stats.misses++;
      return null;
    }
    
    // Update entry metadata
    entry.meta.lastAccessed = Date.now();
    entry.meta.accessCount++;
    
    this.stats.hits++;
    return entry.value;
  }
  
  /**
   * Set an entry in the cache
   * 
   * @param namespace Namespace to group related entries
   * @param key Key to identify the entry
   * @param value Value to cache
   * @param options Cache set options
   */
  public set<T>(
    namespace: string,
    key: string,
    value: T,
    options: CacheSetOptions = {}
  ): void {
    // Create namespace if it doesn't exist
    if (!this.cache.has(namespace)) {
      this.cache.set(namespace, new Map());
    }
    
    const namespaceMap = this.cache.get(namespace)!;
    
    // Estimate size if not provided
    const sizeBytes = options.sizeBytes || this.estimateSize(value);
    
    // Create entry
    const entry: CacheEntry<T> = {
      value,
      meta: {
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 0,
        sizeBytes,
        ttlMs: options.ttlMs !== undefined ? options.ttlMs : this.config.defaultTtlMs,
        priority: options.priority
      }
    };
    
    // Check if we need to evict before adding
    if (this.shouldEvictBeforeAdd(sizeBytes)) {
      this.evict(namespace, key, sizeBytes);
    }
    
    // Add to cache
    namespaceMap.set(key, entry);
    
    // Setup background refresh if enabled and refresh function provided
    if (this.config.enableBackgroundRefresh && options.refreshFn && entry.meta.ttlMs! > 0) {
      this.setupBackgroundRefresh(namespace, key, options.refreshFn, entry.meta.ttlMs!);
    }
  }
  
  /**
   * Check if an entry exists in the cache
   * 
   * @param namespace Namespace to group related entries
   * @param key Key to identify the entry
   * @returns Whether the entry exists and is not expired
   */
  public has(namespace: string, key: string): boolean {
    // Get namespace map
    const namespaceMap = this.cache.get(namespace);
    if (!namespaceMap) {
      return false;
    }
    
    // Get cache entry
    const entry = namespaceMap.get(key);
    if (!entry) {
      return false;
    }
    
    // Check if entry has expired
    if (this.hasExpired(entry)) {
      // Remove expired entry
      namespaceMap.delete(key);
      
      // Check if namespace is now empty
      if (namespaceMap.size === 0) {
        this.cache.delete(namespace);
      }
      
      return false;
    }
    
    return true;
  }
  
  /**
   * Delete an entry from the cache
   * 
   * @param namespace Namespace to group related entries
   * @param key Key to identify the entry
   * @returns Whether the entry was deleted
   */
  public delete(namespace: string, key: string): boolean {
    // Get namespace map
    const namespaceMap = this.cache.get(namespace);
    if (!namespaceMap) {
      return false;
    }
    
    // Cancel any refresh timer
    const timerKey = `${namespace}:${key}`;
    if (this.refreshTimers.has(timerKey)) {
      clearTimeout(this.refreshTimers.get(timerKey));
      this.refreshTimers.delete(timerKey);
    }
    
    // Delete entry
    const deleted = namespaceMap.delete(key);
    
    // Check if namespace is now empty
    if (namespaceMap.size === 0) {
      this.cache.delete(namespace);
    }
    
    return deleted;
  }
  
  /**
   * Clear all entries from the cache
   */
  public clear(): void {
    // Clear all cache entries
    this.cache.clear();
    
    // Clear all refresh timers
    for (const timer of this.refreshTimers.values()) {
      clearTimeout(timer);
    }
    this.refreshTimers.clear();
    
    // Clear all precompute promises
    this.precomputePromises.clear();
  }
  
  /**
   * Get the number of entries in the cache
   */
  public size(): number {
    let count = 0;
    for (const namespaceMap of this.cache.values()) {
      count += namespaceMap.size;
    }
    return count;
  }
  
  /**
   * Get the approximate memory usage of the cache in bytes
   */
  public memoryUsage(): number {
    let totalBytes = 0;
    for (const namespaceMap of this.cache.values()) {
      for (const entry of namespaceMap.values()) {
        totalBytes += entry.meta.sizeBytes;
      }
    }
    return totalBytes;
  }
  
  /**
   * Get or compute a value from the cache
   * 
   * @param namespace Namespace to group related entries
   * @param key Key to identify the entry
   * @param computeFn Function to compute the value if not in cache
   * @param options Cache set options
   * @returns The cached or computed value
   */
  public async getOrCompute<T>(
    namespace: string,
    key: string,
    computeFn: ComputeFunction<T>,
    options: CacheSetOptions = {}
  ): Promise<T> {
    // Check if value is in cache
    const cachedValue = this.get<T>(namespace, key);
    if (cachedValue !== null) {
      return cachedValue;
    }
    
    // Check if there's already a computation in progress
    const computeKey = `${namespace}:${key}`;
    if (this.precomputePromises.has(computeKey)) {
      return this.precomputePromises.get(computeKey) as Promise<T>;
    }
    
    // Compute the value
    const computePromise = computeFn();
    this.precomputePromises.set(computeKey, computePromise);
    
    try {
      const value = await computePromise;
      
      // Cache the computed value
      this.set(namespace, key, value, {
        ...options,
        refreshFn: options.refreshFn || computeFn
      });
      
      return value;
    } finally {
      // Remove promise whether it succeeded or failed
      this.precomputePromises.delete(computeKey);
    }
  }
  
  /**
   * Prefetch values into the cache
   * 
   * @param items Array of items to prefetch
   * @param options Cache set options
   */
  public async prefetch<T>(
    items: Array<{
      namespace: string;
      key: string;
      computeFn: ComputeFunction<T>;
    }>,
    options: CacheSetOptions = {}
  ): Promise<void> {
    if (!this.config.enablePrecomputation) {
      return;
    }
    
    // Process items in parallel with concurrency limit
    const concurrencyLimit = 5;
    const activePromises: Promise<any>[] = [];
    
    for (const item of items) {
      // Skip if already in cache
      if (this.has(item.namespace, item.key)) {
        continue;
      }
      
      // Create promise for this item
      const promise = this.getOrCompute(
        item.namespace,
        item.key,
        item.computeFn,
        options
      );
      
      activePromises.push(promise);
      
      // Wait if we've hit the concurrency limit
      if (activePromises.length >= concurrencyLimit) {
        await Promise.race(activePromises.map(p => p.catch(() => {})));
        
        // Filter out completed promises
        const newActivePromises = activePromises.filter(p => !p.isResolved);
        activePromises.length = 0;
        activePromises.push(...newActivePromises);
      }
    }
    
    // Wait for remaining promises
    await Promise.all(activePromises.map(p => p.catch(() => {})));
  }
  
  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    // Calculate current memory usage
    const memoryUsageBytes = this.memoryUsage();
    
    // Count entries
    const size = this.size();
    
    // Calculate hit rate
    const totalAccesses = this.stats.hits + this.stats.misses;
    const hitRate = totalAccesses > 0 ? this.stats.hits / totalAccesses : 0;
    
    return {
      size,
      maxSize: this.config.maxEntries,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      memoryUsageBytes,
      maxMemoryBytes: this.config.maxMemoryBytes,
      evictionCount: this.stats.evictions,
      timestamp: Date.now()
    };
  }
  
  /**
   * Check if a cache entry has expired
   */
  private hasExpired(entry: CacheEntry<any>): boolean {
    // If no TTL, entry never expires
    if (!entry.meta.ttlMs || entry.meta.ttlMs === 0) {
      return false;
    }
    
    const now = Date.now();
    const expirationTime = entry.meta.createdAt + entry.meta.ttlMs;
    
    return now > expirationTime;
  }
  
  /**
   * Check if we need to evict entries before adding a new one
   */
  private shouldEvictBeforeAdd(newEntrySize: number): boolean {
    // Check if adding would exceed max entries
    if (this.size() >= this.config.maxEntries) {
      return true;
    }
    
    // Check if adding would exceed max memory
    if (this.config.trackSize && this.memoryUsage() + newEntrySize > this.config.maxMemoryBytes) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Evict entries to make room for a new entry
   */
  private evict(newNamespace: string, newKey: string, newSize: number): void {
    // If memory optimizer is available, try to optimize memory first
    if (this.memoryOptimizer) {
      this.memoryOptimizer.optimizeBeforeOperation();
    }
    
    // Determine how many entries to evict
    const spaceNeeded = this.memoryUsage() + newSize - this.config.maxMemoryBytes;
    const entriesOverLimit = this.size() + 1 - this.config.maxEntries;
    
    // Need to evict based on count or size
    const needEviction = entriesOverLimit > 0 || spaceNeeded > 0;
    
    if (!needEviction) {
      return;
    }
    
    // Choose eviction strategy based on policy
    switch (this.config.evictionPolicy) {
      case EvictionPolicy.LRU:
        this.evictLRU(newNamespace, newKey, spaceNeeded, entriesOverLimit);
        break;
      case EvictionPolicy.FIFO:
        this.evictFIFO(newNamespace, newKey, spaceNeeded, entriesOverLimit);
        break;
      case EvictionPolicy.LFU:
        this.evictLFU(newNamespace, newKey, spaceNeeded, entriesOverLimit);
        break;
      case EvictionPolicy.TTL:
        this.evictTTL(newNamespace, newKey, spaceNeeded, entriesOverLimit);
        break;
      case EvictionPolicy.RANDOM:
        this.evictRandom(newNamespace, newKey, spaceNeeded, entriesOverLimit);
        break;
      case EvictionPolicy.SIZE:
        this.evictSize(newNamespace, newKey, spaceNeeded, entriesOverLimit);
        break;
    }
  }
  
  /**
   * Evict based on Least Recently Used policy
   */
  private evictLRU(
    newNamespace: string,
    newKey: string,
    spaceNeeded: number,
    entriesOverLimit: number
  ): void {
    // Get all entries with metadata
    const allEntries = this.getAllEntriesWithMetadata(newNamespace, newKey);
    
    // Sort by last accessed time (oldest first)
    allEntries.sort((a, b) => a.meta.lastAccessed - b.meta.lastAccessed);
    
    // Evict entries until we've freed enough space
    this.evictEntries(allEntries, spaceNeeded, entriesOverLimit);
  }
  
  /**
   * Evict based on First In First Out policy
   */
  private evictFIFO(
    newNamespace: string,
    newKey: string,
    spaceNeeded: number,
    entriesOverLimit: number
  ): void {
    // Get all entries with metadata
    const allEntries = this.getAllEntriesWithMetadata(newNamespace, newKey);
    
    // Sort by creation time (oldest first)
    allEntries.sort((a, b) => a.meta.createdAt - b.meta.createdAt);
    
    // Evict entries until we've freed enough space
    this.evictEntries(allEntries, spaceNeeded, entriesOverLimit);
  }
  
  /**
   * Evict based on Least Frequently Used policy
   */
  private evictLFU(
    newNamespace: string,
    newKey: string,
    spaceNeeded: number,
    entriesOverLimit: number
  ): void {
    // Get all entries with metadata
    const allEntries = this.getAllEntriesWithMetadata(newNamespace, newKey);
    
    // Sort by access count (least first)
    allEntries.sort((a, b) => a.meta.accessCount - b.meta.accessCount);
    
    // Evict entries until we've freed enough space
    this.evictEntries(allEntries, spaceNeeded, entriesOverLimit);
  }
  
  /**
   * Evict based on Time-To-Live policy (evict closest to expiration)
   */
  private evictTTL(
    newNamespace: string,
    newKey: string,
    spaceNeeded: number,
    entriesOverLimit: number
  ): void {
    // Get all entries with metadata
    const allEntries = this.getAllEntriesWithMetadata(newNamespace, newKey);
    
    // Calculate time to expiration for each entry
    const now = Date.now();
    for (const entry of allEntries) {
      if (!entry.meta.ttlMs || entry.meta.ttlMs === 0) {
        entry.timeToExpiration = Number.MAX_SAFE_INTEGER; // Never expires
      } else {
        entry.timeToExpiration = (entry.meta.createdAt + entry.meta.ttlMs) - now;
      }
    }
    
    // Sort by time to expiration (closest first)
    allEntries.sort((a, b) => a.timeToExpiration - b.timeToExpiration);
    
    // Evict entries until we've freed enough space
    this.evictEntries(allEntries, spaceNeeded, entriesOverLimit);
  }
  
  /**
   * Evict based on Random policy
   */
  private evictRandom(
    newNamespace: string,
    newKey: string,
    spaceNeeded: number,
    entriesOverLimit: number
  ): void {
    // Get all entries with metadata
    const allEntries = this.getAllEntriesWithMetadata(newNamespace, newKey);
    
    // Shuffle array
    for (let i = allEntries.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allEntries[i], allEntries[j]] = [allEntries[j], allEntries[i]];
    }
    
    // Evict entries until we've freed enough space
    this.evictEntries(allEntries, spaceNeeded, entriesOverLimit);
  }
  
  /**
   * Evict based on Size policy (largest first)
   */
  private evictSize(
    newNamespace: string,
    newKey: string,
    spaceNeeded: number,
    entriesOverLimit: number
  ): void {
    // Get all entries with metadata
    const allEntries = this.getAllEntriesWithMetadata(newNamespace, newKey);
    
    // Sort by size (largest first)
    allEntries.sort((a, b) => b.meta.sizeBytes - a.meta.sizeBytes);
    
    // Evict entries until we've freed enough space
    this.evictEntries(allEntries, spaceNeeded, entriesOverLimit);
  }
  
  /**
   * Get all entries with metadata, excluding the new entry
   */
  private getAllEntriesWithMetadata(
    newNamespace: string,
    newKey: string
  ): Array<CacheEntry<any> & { namespace: string; key: string; timeToExpiration?: number }> {
    const allEntries: Array<CacheEntry<any> & { namespace: string; key: string; timeToExpiration?: number }> = [];
    
    for (const [namespace, namespaceMap] of this.cache.entries()) {
      for (const [key, entry] of namespaceMap.entries()) {
        // Skip the new entry if it already exists
        if (namespace === newNamespace && key === newKey) {
          continue;
        }
        
        allEntries.push({
          ...entry,
          namespace,
          key
        });
      }
    }
    
    return allEntries;
  }
  
  /**
   * Evict entries until we've freed enough space
   */
  private evictEntries(
    entries: Array<CacheEntry<any> & { namespace: string; key: string }>,
    spaceNeeded: number,
    entriesOverLimit: number
  ): void {
    let freedSpace = 0;
    let entriesRemoved = 0;
    
    for (const entry of entries) {
      // Skip entries with high priority if possible
      if (entry.meta.priority && entry.meta.priority > 0 && entriesRemoved >= entriesOverLimit && freedSpace >= spaceNeeded) {
        continue;
      }
      
      // Delete the entry
      this.delete(entry.namespace, entry.key);
      
      // Update tracking
      freedSpace += entry.meta.sizeBytes;
      entriesRemoved++;
      this.stats.evictions++;
      
      // Check if we've freed enough space
      if (entriesRemoved >= entriesOverLimit && freedSpace >= spaceNeeded) {
        break;
      }
    }
  }
  
  /**
   * Estimate the size of a value in bytes
   */
  private estimateSize(value: any): number {
    if (value === null || value === undefined) {
      return 0;
    }
    
    const type = typeof value;
    
    // Primitives
    if (type === 'boolean') return 4;
    if (type === 'number') return 8;
    if (type === 'string') return value.length * 2;
    
    // Objects
    if (type === 'object') {
      // Arrays
      if (Array.isArray(value)) {
        let size = 0;
        for (const item of value) {
          size += this.estimateSize(item);
        }
        return size;
      }
      
      // ArrayBuffer or TypedArray
      if (value.byteLength !== undefined) {
        return value.byteLength;
      }
      
      // Regular objects
      let size = 0;
      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          size += key.length * 2; // Key size
          size += this.estimateSize(value[key]); // Value size
        }
      }
      return size;
    }
    
    // Functions, symbols, etc.
    return 0;
  }
  
  /**
   * Setup background refresh for an entry
   */
  private setupBackgroundRefresh(
    namespace: string,
    key: string,
    refreshFn: () => Promise<any>,
    ttlMs: number
  ): void {
    // Calculate refresh time (90% of TTL to refresh before expiration)
    const refreshTime = Math.max(1000, ttlMs * 0.9);
    
    // Cancel any existing timer
    const timerKey = `${namespace}:${key}`;
    if (this.refreshTimers.has(timerKey)) {
      clearTimeout(this.refreshTimers.get(timerKey));
    }
    
    // Set up new timer
    const timer = setTimeout(async () => {
      try {
        // Check if entry still exists
        if (!this.has(namespace, key)) {
          return;
        }
        
        // Refresh the entry
        const value = await refreshFn();
        
        // Update the cache
        this.set(namespace, key, value, {
          ttlMs,
          refreshFn
        });
      } catch (error) {
        // If refresh fails, just let the entry expire normally
        console.error(`Failed to refresh cache entry ${namespace}:${key}:`, error);
      } finally {
        // Remove the timer
        this.refreshTimers.delete(timerKey);
      }
    }, refreshTime);
    
    // Store the timer
    this.refreshTimers.set(timerKey, timer);
  }
}