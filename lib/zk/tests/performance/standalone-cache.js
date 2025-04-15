/**
 * @fileoverview A memory-efficient caching system with multiple eviction policies
 * 
 * This implementation provides an adaptive, memory-efficient caching system with support
 * for several eviction policies, TTL-based expiration, compression, and memory usage 
 * monitoring capabilities.
 */

// Available eviction policies for the cache
export const EvictionPolicy = {
    /** Least Recently Used - evicts items that haven't been accessed in the longest time */
    LRU: 'LRU',
    /** Least Frequently Used - evicts items with the fewest access counts */
    LFU: 'LFU',
    /** First In, First Out - evicts oldest items first */
    FIFO: 'FIFO',
    /** Priority-based - evicts items with lowest priority first */
    PRIORITY: 'PRIORITY'
};

/**
 * Memory-efficient cache implementation with multiple eviction policies,
 * TTL support, and optional compression
 */
export class MemoryEfficientCache {
    /**
     * Create a new MemoryEfficientCache instance
     * 
     * @param {Object} config - Cache configuration options
     * @param {number} [config.maxSize=52428800] - Maximum size of the cache in bytes (50MB default)
     * @param {number} [config.defaultTTL=0] - Default time-to-live in milliseconds (0 = never expire)
     * @param {string} [config.evictionPolicy='LRU'] - Eviction policy to use when cache is full
     * @param {boolean} [config.compressionEnabled=false] - Whether to enable compression for large values
     * @param {number} [config.compressionThreshold=10240] - Size threshold in bytes for compressing values
     * @param {Function} [config.onMemoryPressure] - Callback function when memory pressure exceeds 90%
     */
    constructor(config = {}) {
        // Set defaults and apply configuration
        this.cache = new Map();
        this.maxSize = config.maxSize || 50 * 1024 * 1024; // 50MB default
        this.defaultTTL = config.defaultTTL || 0; // No expiration by default
        this.evictionPolicy = config.evictionPolicy || EvictionPolicy.LRU;
        this.compressionEnabled = config.compressionEnabled || false;
        this.compressionThreshold = config.compressionThreshold || 1024 * 10; // 10KB
        this.onMemoryPressure = config.onMemoryPressure;
        this.totalSize = 0;
        this.hits = 0;
        this.misses = 0;
        this.evictionCount = 0;
        this.expirationCount = 0;

        // Start periodic cleanup of expired entries
        this.startCleanupInterval();

        console.log('MemoryEfficientCache initialized', {
            maxSize: this.maxSize,
            defaultTTL: this.defaultTTL,
            evictionPolicy: this.evictionPolicy,
            compressionEnabled: this.compressionEnabled
        });
    }

    /**
     * Store a value in the cache
     * 
     * @param {string} key - The key to store the value under
     * @param {*} value - The value to store
     * @param {Object} [options={}] - Optional storage options
     * @param {number} [options.ttl] - Custom time-to-live in milliseconds
     * @param {number} [options.priority] - Custom priority for PRIORITY eviction policy
     * @returns {boolean} true if storage was successful
     */
    store(key, value, options = {}) {
        try {
            if (key === undefined || key === null) {
                console.error('Cannot store with undefined or null key', {
                    valueType: typeof value
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
                } catch (err) {
                    console.warn('Failed to compress cache value', {
                        key, error: err instanceof Error ? err.message : String(err)
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
                console.warn('Cache entry too large to store', {
                    key, valueSize, maxSize: this.maxSize, remainingSpace: this.maxSize - this.totalSize
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
        } catch (err) {
            console.error('Failed to store cache entry', {
                key, error: err instanceof Error ? err.message : String(err)
            });
            return false;
        }
    }

    /**
     * Retrieve a value from the cache
     * 
     * @param {string} key - The key to retrieve
     * @returns {*} The stored value, or undefined if not found
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
                } catch (err) {
                    console.warn('Failed to decompress cache value', {
                        key, error: err instanceof Error ? err.message : String(err)
                    });
                    // Return compressed value as fallback
                }
            }

            return value;
        } catch (err) {
            console.error('Failed to retrieve cache entry', {
                key, error: err instanceof Error ? err.message : String(err)
            });
            return undefined;
        }
    }

    /**
     * Invalidate one or more cache entries
     * 
     * @param {string} keyOrPattern - Key to invalidate, or pattern to match multiple keys
     * @param {boolean} [isPattern=false] - Whether to treat keyOrPattern as a pattern
     * @returns {number} Number of entries invalidated
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
            const patternRegex = new RegExp(
                '^' + keyOrPattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
            );

            let count = 0;
            for (const [key, entry] of this.cache.entries()) {
                if (patternRegex.test(key)) {
                    this.totalSize -= entry.size;
                    this.cache.delete(key);
                    count++;
                }
            }

            return count;
        } catch (err) {
            console.error('Failed to invalidate cache entries', {
                keyOrPattern, isPattern, error: err instanceof Error ? err.message : String(err)
            });
            return 0;
        }
    }

    /**
     * Get cache statistics
     * 
     * @returns {Object} Current cache statistics
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
     * @param {string} policy - The eviction policy to use
     * @returns {boolean} true if policy was set, false if invalid
     */
    setEvictionPolicy(policy) {
        if (!Object.values(EvictionPolicy).includes(policy)) {
            console.warn('Invalid eviction policy', {
                requestedPolicy: policy,
                availablePolicies: Object.values(EvictionPolicy)
            });
            return false;
        }

        this.evictionPolicy = policy;
        return true;
    }

    /**
     * Clear all cache entries
     * 
     * @returns {number} Number of entries cleared
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
     * @returns {number} Number of expired entries removed
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
                console.log('Removed expired cache entries', {
                    count: removed, totalRemaining: this.cache.size
                });
            }
        }, 60000);
    }

    /**
     * Estimate the size of a value in bytes
     * 
     * @private
     * @param {*} value - The value to estimate the size of
     * @returns {number} Estimated size in bytes
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
            return Math.max(value.length, 2); // At least 2 bytes for empty strings
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
     * @param {number} bytesNeeded - Number of bytes to free up
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
            console.log('Evicted cache entries', {
                count: evicted,
                bytesFreed,
                policy: this.evictionPolicy,
                totalRemaining: this.cache.size
            });
        }
    }

    /**
     * Compress a value to save memory
     * 
     * @private
     * @param {*} value - The value to compress
     * @returns {*} Compressed value
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
     * @param {*} compressedValue - The compressed value
     * @returns {*} Decompressed value
     */
    decompressValue(compressedValue) {
        // Placeholder for actual decompression logic
        // Should match the compression method used above

        // For simplicity, we're using base64 + JSON.parse as a placeholder
        const jsonString = Buffer.from(compressedValue, 'base64').toString();
        return JSON.parse(jsonString);
    }
} 