/**
 * @fileoverview Memory Efficient Cache implementation for Week 12.5
 * 
 * This file implements a high-performance memory-efficient caching system with features
 * like LRU (Least Recently Used) eviction, TTL (Time-To-Live) support, memory usage
 * tracking, and adaptive caching strategies.
 * 
 * @author ZK Protocol Team
 */

/**
 * A cache entry stores the value along with metadata
 */
class CacheEntry {
    constructor(value, options = {}) {
        this.value = value;
        this.addedAt = Date.now();
        this.lastAccessed = this.addedAt;
        this.expiresAt = options.ttl ? (this.addedAt + options.ttl) : 0;
        this.version = options.version || null;
        this.priority = options.priority || 0;
        this.accessCount = 0;

        // Calculate approximate size if not provided
        this.size = options.size || this.calculateSize(value);
    }

    /**
     * Check if the entry has expired
     */
    isExpired() {
        return this.expiresAt !== 0 && Date.now() > this.expiresAt;
    }

    /**
     * Mark the entry as accessed
     */
    markAccessed() {
        this.lastAccessed = Date.now();
        this.accessCount++;
    }

    /**
     * Calculate the approximate memory size of a value in bytes
     */
    calculateSize(value) {
        if (value === null || value === undefined) return 0;

        const type = typeof value;

        switch (type) {
            case 'boolean': return 4;
            case 'number': return 8;
            case 'string': return value.length * 2; // UTF-16 characters
            case 'object': {
                if (Array.isArray(value)) {
                    return value.reduce((size, item) => size + this.calculateSize(item), 0);
                }

                if (value instanceof Date) return 8;
                if (value instanceof Map || value instanceof Set) {
                    let size = 0;
                    value.forEach(item => {
                        size += this.calculateSize(item);
                    });
                    return size;
                }

                // Regular object
                let size = 0;
                for (const key in value) {
                    if (Object.prototype.hasOwnProperty.call(value, key)) {
                        size += key.length * 2; // Key size
                        size += this.calculateSize(value[key]); // Value size
                    }
                }
                return size;
            }
            default: return 8; // Default for other types
        }
    }
}

/**
 * MemoryEfficientCache provides a high-performance cache implementation
 * with memory efficiency features.
 */
export class MemoryEfficientCache {
    /**
     * Create a new memory efficient cache
     */
    constructor(options = {}) {
        this.cache = new Map();
        this.maxItems = options.maxItems || options.maxSize || Number.MAX_SAFE_INTEGER; // Support both naming conventions
        this.maxSizeBytes = (options.maxSizeMB || 100) * 1024 * 1024; // Convert MB to bytes
        this.defaultTtl = options.ttl || 0; // 0 means no expiration
        this.version = options.version || '1.0';
        this.currentSizeBytes = 0;
        this.onEviction = options.onEviction;

        // Initialize statistics
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            pruneCount: 0,
            accessTimes: []
        };

        // Set up automatic pruning if interval is provided
        this.pruneInterval = options.pruneInterval || null;
        this.pruneTimer = null;

        if (this.pruneInterval) {
            this.pruneTimer = setInterval(() => this.prune(), this.pruneInterval);
        }
    }

    /**
     * Store a value in the cache
     */
    set(key, value, options = {}) {
        // Apply default TTL if not specified
        if (options.ttl === undefined && this.defaultTtl > 0) {
            options.ttl = this.defaultTtl;
        }

        // Create the new cache entry
        const entry = new CacheEntry(value, options);

        // Check if we're updating an existing entry
        const existingEntry = this.cache.get(key);
        if (existingEntry) {
            this.currentSizeBytes -= existingEntry.size;
        }

        // Check if adding this would exceed our memory limit
        const wouldExceedMemory = this.currentSizeBytes + entry.size > this.maxSizeBytes;
        const wouldExceedCount = !existingEntry && this.cache.size >= this.maxItems;

        if (wouldExceedMemory || wouldExceedCount) {
            // Try to make room by evicting entries
            const bytesNeeded = wouldExceedMemory ? entry.size : 0;
            const evicted = this.evictEntries(bytesNeeded);

            // If we still don't have room, fail the operation
            if (this.currentSizeBytes + entry.size > this.maxSizeBytes ||
                (!existingEntry && this.cache.size >= this.maxItems)) {
                return false;
            }
        }

        // Add the entry to the cache
        this.cache.set(key, entry);
        this.currentSizeBytes += entry.size;

        return true;
    }

    /**
     * Retrieve a value from the cache
     */
    get(key) {
        const startTime = performance.now();
        const entry = this.cache.get(key);

        if (!entry) {
            this.stats.misses++;
            return undefined;
        }

        // Check if the entry has expired
        if (entry.isExpired()) {
            this.delete(key);
            this.stats.misses++;
            return undefined;
        }

        // Update access metadata
        entry.markAccessed();

        // Update statistics
        this.stats.hits++;
        const accessTime = performance.now() - startTime;
        this.stats.accessTimes.push(accessTime);
        if (this.stats.accessTimes.length > 100) {
            this.stats.accessTimes.shift(); // Keep only the last 100 access times
        }

        return entry.value;
    }

    /**
     * Check if a key exists in the cache
     */
    has(key) {
        const entry = this.cache.get(key);

        if (!entry) {
            return false;
        }

        // Check if the entry has expired
        if (entry.isExpired()) {
            this.delete(key);
            return false;
        }

        return true;
    }

    /**
     * Remove a key from the cache
     */
    delete(key) {
        const entry = this.cache.get(key);

        if (!entry) {
            return false;
        }

        // Update memory usage
        this.currentSizeBytes -= entry.size;

        // Invoke the eviction callback if provided
        if (this.onEviction) {
            this.onEviction(key, entry.value);
        }

        return this.cache.delete(key);
    }

    /**
     * Get or compute a value
     */
    async getOrCompute(key, computeFn, options = {}) {
        const value = this.get(key);

        if (value !== undefined) {
            return value;
        }

        // Value not in cache, compute it
        const computed = await computeFn(key);

        // Store in cache
        this.set(key, computed, options);

        return computed;
    }

    /**
     * Clear all entries from the cache
     */
    clear() {
        this.cache.clear();
        this.currentSizeBytes = 0;
    }

    /**
     * Get all keys in the cache
     */
    keys() {
        // Filter out expired entries
        return Array.from(this.cache.entries())
            .filter(([_, entry]) => !entry.isExpired())
            .map(([key, _]) => key);
    }

    /**
     * Get the number of items in the cache
     */
    size() {
        return this.cache.size;
    }

    /**
     * Warm up the cache with values
     */
    async warmCache(keys, computeFn, options = {}) {
        await Promise.all(
            keys.map(key => this.getOrCompute(key, () => computeFn(key), options))
        );
    }

    /**
     * Remove all expired entries
     */
    prune() {
        let count = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (entry.isExpired()) {
                this.delete(key);
                count++;
            }
        }

        if (count > 0) {
            this.stats.pruneCount++;
        }

        return count;
    }

    /**
     * Invalidate all entries with a specific version
     */
    invalidateVersion(version) {
        let count = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (entry.version === version) {
                this.delete(key);
                count++;
            }
        }

        return count;
    }

    /**
     * Get statistics about the cache
     */
    getStats() {
        const avgAccessTime = this.stats.accessTimes.length > 0
            ? this.stats.accessTimes.reduce((sum, time) => sum + time, 0) / this.stats.accessTimes.length
            : 0;

        return {
            hits: this.stats.hits,
            misses: this.stats.misses,
            evictions: this.stats.evictions,
            size: this.cache.size,
            memoryUsage: this.currentSizeBytes,
            hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
            avgAccessTime,
            pruneCount: this.stats.pruneCount
        };
    }

    /**
     * Get the current memory usage of the cache in bytes
     */
    getMemoryUsage() {
        return this.currentSizeBytes;
    }

    /**
     * Dispose of resources used by the cache
     */
    dispose() {
        if (this.pruneTimer) {
            clearInterval(this.pruneTimer);
            this.pruneTimer = null;
        }
    }

    /**
     * Evict entries to make room in the cache
     * @private
     */
    evictEntries(bytesNeeded) {
        if (this.cache.size === 0) return 0;

        // Create a sorted array of entries by priority and last accessed time
        const entries = Array.from(this.cache.entries())
            .map(([key, entry]) => ({ key, entry }))
            .sort((a, b) => {
                // First sort by priority (lower priority gets evicted first)
                if (a.entry.priority !== b.entry.priority) {
                    return a.entry.priority - b.entry.priority;
                }
                // Then sort by last accessed time (oldest gets evicted first)
                return a.entry.lastAccessed - b.entry.lastAccessed;
            });

        let evicted = 0;
        let bytesFreed = 0;

        // Evict entries until we have enough space or run out of entries
        for (const { key, entry } of entries) {
            if ((bytesNeeded > 0 && bytesFreed >= bytesNeeded) ||
                (bytesNeeded === 0 && this.cache.size < this.maxItems)) {
                break;
            }

            this.delete(key);
            bytesFreed += entry.size;
            evicted++;
            this.stats.evictions++;
        }

        return evicted;
    }
} 