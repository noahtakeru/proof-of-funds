/**
 * @fileoverview A memory-efficient caching system with multiple eviction policies
 *
 * This implementation provides an adaptive, memory-efficient caching system with support
 * for several eviction policies, TTL-based expiration, compression, and memory usage
 * monitoring capabilities.
 */
import zkErrorLoggerModule from '../zkErrorLogger.mjs';
// Get error logger
const { zkErrorLogger } = zkErrorLoggerModule;
/**
 * Available eviction policies for the cache
 */
export var EvictionPolicy;
(function (EvictionPolicy) {
    /** Least Recently Used - evicts items that haven't been accessed in the longest time */
    EvictionPolicy["LRU"] = "LRU";
    /** Least Frequently Used - evicts items with the fewest access counts */
    EvictionPolicy["LFU"] = "LFU";
    /** First In, First Out - evicts oldest items first */
    EvictionPolicy["FIFO"] = "FIFO";
    /** Priority-based - evicts items with lowest priority first */
    EvictionPolicy["PRIORITY"] = "PRIORITY";
})(EvictionPolicy || (EvictionPolicy = {}));
/**
 * Memory-efficient cache implementation with multiple eviction policies,
 * TTL support, and optional compression
 */
export class MemoryEfficientCache {
    /**
     * Create a new MemoryEfficientCache instance
     *
     * @param config - Cache configuration options
     */
    constructor(config = {}) {
        this.cache = new Map();
        this.totalSize = 0;
        this.hits = 0;
        this.misses = 0;
        this.evictionCount = 0;
        this.expirationCount = 0;
        this.cleanupInterval = null;
        // Set defaults and apply configuration
        this.maxSize = config.maxSize || 50 * 1024 * 1024; // 50MB default
        this.defaultTTL = config.defaultTTL || 0; // No expiration by default
        this.evictionPolicy = config.evictionPolicy || EvictionPolicy.LRU;
        this.compressionEnabled = config.compressionEnabled || false;
        this.compressionThreshold = config.compressionThreshold || 1024 * 10; // 10KB
        this.onMemoryPressure = config.onMemoryPressure;
        // Start periodic cleanup of expired entries
        this.startCleanupInterval();
        zkErrorLogger.log('INFO', 'MemoryEfficientCache initialized', {
            details: {
                maxSize: this.maxSize,
                defaultTTL: this.defaultTTL,
                evictionPolicy: this.evictionPolicy,
                compressionEnabled: this.compressionEnabled
            }
        });
    }
    /**
     * Store a value in the cache
     *
     * @param key - The key to store the value under
     * @param value - The value to store
     * @param options - Optional storage options
     * @returns true if storage was successful
     */
    store(key, value, options = {}) {
        try {
            if (key === undefined || key === null) {
                zkErrorLogger.log('ERROR', 'Cannot store with undefined or null key', {
                    details: { valueType: typeof value }
                });
                return false;
            }
            // Check if entry already exists and remove its size from the total
            if (this.cache.has(key)) {
                this.totalSize -= this.cache.get(key).size;
            }
            // Calculate size and check if compression should be used
            const valueSize = this.estimateSize(value);
            let compressed = false;
            let storedValue = value;
            // Apply compression if enabled and value is large enough
            if (this.compressionEnabled && valueSize > this.compressionThreshold) {
                try {
                    storedValue = this.compressValue(value);
                    compressed = true;
                }
                catch (err) {
                    zkErrorLogger.log('WARN', 'Failed to compress cache value', {
                        details: { key, error: err instanceof Error ? err.message : String(err) }
                    });
                    // Continue with uncompressed value
                }
            }
            // Determine TTL and expiration
            const ttl = options.ttl !== undefined ? options.ttl : this.defaultTTL;
            const now = Date.now();
            const expiresAt = ttl > 0 ? now + ttl : 0;
            // Create the cache entry
            const entry = {
                value: storedValue,
                createdAt: now,
                lastAccessed: now,
                accessCount: 0,
                expiresAt,
                size: valueSize,
                priority: options.priority,
                compressed
            };
            // If cache will exceed max size, perform eviction
            const newTotalSize = this.totalSize + valueSize;
            if (newTotalSize > this.maxSize) {
                this.evictEntries(newTotalSize - this.maxSize);
            }
            // Check if we're still over capacity after eviction
            if (this.totalSize + valueSize > this.maxSize) {
                zkErrorLogger.log('WARN', 'Cache entry too large to store', {
                    details: { key, valueSize, maxSize: this.maxSize, remainingSpace: this.maxSize - this.totalSize }
                });
                return false;
            }
            // Store the entry and update total size
            this.cache.set(key, entry);
            this.totalSize += valueSize;
            // Trigger memory pressure callback if approaching capacity
            const percentUsed = (this.totalSize / this.maxSize) * 100;
            if (percentUsed > 90 && this.onMemoryPressure) {
                setTimeout(() => {
                    if (this.onMemoryPressure) {
                        this.onMemoryPressure(percentUsed);
                    }
                }, 0);
            }
            return true;
        }
        catch (err) {
            zkErrorLogger.log('ERROR', 'Failed to store cache entry', {
                details: { key, error: err instanceof Error ? err.message : String(err) }
            });
            return false;
        }
    }
    /**
     * Retrieve a value from the cache
     *
     * @param key - The key to retrieve
     * @returns The stored value, or undefined if not found
     */
    retrieve(key) {
        try {
            const entry = this.cache.get(key);
            // Check if entry exists
            if (!entry) {
                this.misses++;
                return undefined;
            }
            // Check if entry has expired
            if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
                this.cache.delete(key);
                this.totalSize -= entry.size;
                this.expirationCount++;
                this.misses++;
                return undefined;
            }
            // Update metadata
            entry.lastAccessed = Date.now();
            entry.accessCount++;
            this.hits++;
            // Decompress if necessary
            let value = entry.value;
            if (entry.compressed) {
                try {
                    value = this.decompressValue(value);
                }
                catch (err) {
                    zkErrorLogger.log('WARN', 'Failed to decompress cache value', {
                        details: { key, error: err instanceof Error ? err.message : String(err) }
                    });
                    // Return compressed value as fallback
                }
            }
            return value;
        }
        catch (err) {
            zkErrorLogger.log('ERROR', 'Failed to retrieve cache entry', {
                details: { key, error: err instanceof Error ? err.message : String(err) }
            });
            return undefined;
        }
    }
    /**
     * Invalidate one or more cache entries
     *
     * @param keyOrPattern - Key to invalidate, or pattern to match multiple keys
     * @param isPattern - Whether to treat keyOrPattern as a pattern
     * @returns Number of entries invalidated
     */
    invalidate(keyOrPattern, isPattern = false) {
        try {
            if (!isPattern) {
                // Simple case: invalidate a single key
                if (this.cache.has(keyOrPattern)) {
                    const entry = this.cache.get(keyOrPattern);
                    this.totalSize -= entry.size;
                    this.cache.delete(keyOrPattern);
                    return 1;
                }
                return 0;
            }
            // Pattern matching case: convert pattern to regex
            const patternRegex = new RegExp('^' + keyOrPattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
            let count = 0;
            for (const [key, entry] of this.cache.entries()) {
                if (patternRegex.test(key)) {
                    this.totalSize -= entry.size;
                    this.cache.delete(key);
                    count++;
                }
            }
            return count;
        }
        catch (err) {
            zkErrorLogger.log('ERROR', 'Failed to invalidate cache entries', {
                details: { keyOrPattern, isPattern, error: err instanceof Error ? err.message : String(err) }
            });
            return 0;
        }
    }
    /**
     * Get cache statistics
     *
     * @returns Current cache statistics
     */
    getStats() {
        return {
            itemCount: this.cache.size,
            totalSize: this.totalSize,
            maxSize: this.maxSize,
            percentageUsed: (this.totalSize / this.maxSize) * 100,
            hits: this.hits,
            misses: this.misses,
            hitRatio: this.hits / (this.hits + this.misses || 1),
            evictionCount: this.evictionCount,
            expirationCount: this.expirationCount
        };
    }
    /**
     * Set the eviction policy
     *
     * @param policy - The eviction policy to use
     * @returns true if policy was set, false if invalid
     */
    setEvictionPolicy(policy) {
        if (!Object.values(EvictionPolicy).includes(policy)) {
            zkErrorLogger.log('WARN', 'Invalid eviction policy', {
                details: {
                    requestedPolicy: policy,
                    availablePolicies: Object.values(EvictionPolicy)
                }
            });
            return false;
        }
        this.evictionPolicy = policy;
        return true;
    }
    /**
     * Clear all cache entries
     *
     * @returns Number of entries cleared
     */
    clear() {
        const count = this.cache.size;
        this.cache.clear();
        this.totalSize = 0;
        return count;
    }
    /**
     * Clean up expired entries
     *
     * @private
     * @returns Number of expired entries removed
     */
    cleanupExpired() {
        if (this.defaultTTL === 0) {
            return 0; // Skip cleanup if default TTL is 0
        }
        const now = Date.now();
        let count = 0;
        for (const [key, entry] of this.cache.entries()) {
            if (entry.expiresAt > 0 && now > entry.expiresAt) {
                this.totalSize -= entry.size;
                this.cache.delete(key);
                count++;
                this.expirationCount++;
            }
        }
        return count;
    }
    /**
     * Start the periodic cleanup interval
     *
     * @private
     */
    startCleanupInterval() {
        // Clean up every minute
        this.cleanupInterval = setInterval(() => {
            const removed = this.cleanupExpired();
            if (removed > 0) {
                zkErrorLogger.log('INFO', 'Removed expired cache entries', {
                    details: { count: removed, totalRemaining: this.cache.size }
                });
            }
        }, 60000);
    }
    /**
     * Estimate the size of a value in bytes
     *
     * @private
     * @param value - The value to estimate the size of
     * @returns Estimated size in bytes
     */
    estimateSize(value) {
        if (value === null || value === undefined) {
            return 8;
        }
        const type = typeof value;
        if (type === 'boolean') {
            return 4;
        }
        if (type === 'number') {
            return 8;
        }
        if (type === 'string') {
            return value.length * 2; // UTF-16 characters are 2 bytes each
        }
        if (value instanceof Date) {
            return 8;
        }
        if (Array.isArray(value)) {
            return value.reduce((size, item) => size + this.estimateSize(item), 0);
        }
        if (type === 'object') {
            let size = 0;
            for (const key in value) {
                if (Object.prototype.hasOwnProperty.call(value, key)) {
                    size += key.length * 2; // Key size
                    size += this.estimateSize(value[key]); // Value size
                }
            }
            return size;
        }
        return 8; // Default size for other types
    }
    /**
     * Evict entries according to the current eviction policy
     *
     * @private
     * @param bytesNeeded - Number of bytes to free up
     */
    evictEntries(bytesNeeded) {
        if (this.cache.size === 0 || bytesNeeded <= 0) {
            return;
        }
        let bytesFreed = 0;
        const sortedEntries = Array.from(this.cache.entries());
        // Sort entries based on eviction policy
        switch (this.evictionPolicy) {
            case EvictionPolicy.LRU:
                // Sort by last accessed time (oldest first)
                sortedEntries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
                break;
            case EvictionPolicy.LFU:
                // Sort by access count (least first)
                sortedEntries.sort((a, b) => a[1].accessCount - b[1].accessCount);
                break;
            case EvictionPolicy.FIFO:
                // Sort by creation time (oldest first)
                sortedEntries.sort((a, b) => a[1].createdAt - b[1].createdAt);
                break;
            case EvictionPolicy.PRIORITY:
                // Sort by priority (lowest first), then by last accessed time
                sortedEntries.sort((a, b) => {
                    const priorityA = a[1].priority ?? 0;
                    const priorityB = b[1].priority ?? 0;
                    if (priorityA === priorityB) {
                        return a[1].lastAccessed - b[1].lastAccessed;
                    }
                    return priorityA - priorityB;
                });
                break;
        }
        // Evict entries until we've freed enough space
        let evicted = 0;
        for (const [key, entry] of sortedEntries) {
            if (bytesFreed >= bytesNeeded) {
                break;
            }
            this.cache.delete(key);
            bytesFreed += entry.size;
            this.totalSize -= entry.size;
            evicted++;
        }
        if (evicted > 0) {
            this.evictionCount += evicted;
            zkErrorLogger.log('INFO', 'Evicted cache entries', {
                details: {
                    count: evicted,
                    bytesFreed,
                    policy: this.evictionPolicy,
                    totalRemaining: this.cache.size
                }
            });
        }
    }
    /**
     * Compress a value to save memory
     *
     * @private
     * @param value - The value to compress
     * @returns Compressed value
     */
    compressValue(value) {
        // Placeholder for actual compression logic
        // In a real implementation, we'd use something like LZMA, Brotli, or other
        // compression algorithms based on the data type
        // For simplicity, we're using JSON.stringify + base64 as a placeholder
        // This isn't actual compression, just a placeholder for the interface
        const jsonString = JSON.stringify(value);
        return Buffer.from(jsonString).toString('base64');
    }
    /**
     * Decompress a value for retrieval
     *
     * @private
     * @param compressedValue - The compressed value
     * @returns Decompressed value
     */
    decompressValue(compressedValue) {
        // Placeholder for actual decompression logic
        // Should match the compression method used above
        // For simplicity, we're using base64 + JSON.parse as a placeholder
        const jsonString = Buffer.from(compressedValue, 'base64').toString();
        return JSON.parse(jsonString);
    }
}
