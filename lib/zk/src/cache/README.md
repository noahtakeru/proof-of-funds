# Memory Efficient Cache

A high-performance, memory-efficient caching system for JavaScript/Node.js applications.

## Features

- **LRU Eviction**: Automatically removes least recently used entries when capacity is reached
- **TTL Support**: Time-to-live expiration for cache entries
- **Memory Usage Tracking**: Intelligent tracking of memory usage with configurable limits
- **Version-based Invalidation**: Invalidate groups of entries by version tag
- **Performance Monitoring**: Built-in performance statistics collection
- **Cache Warming**: Methods for pre-populating the cache
- **Computed Values**: Support for getting or computing values in a single operation

## Installation

This module is part of the ZK infrastructure and is already available in the project.

```javascript
import { MemoryEfficientCache } from './cache/MemoryEfficientCache.mjs';
```

## Usage

### Basic Usage

```javascript
// Create a new cache instance
const cache = new MemoryEfficientCache();

// Store a value
cache.set('key1', 'value1');

// Retrieve a value
const value = cache.get('key1');

// Check if a key exists
if (cache.has('key1')) {
  // Key exists and has not expired
}

// Delete a value
cache.delete('key1');

// Clear the entire cache
cache.clear();
```

### Configuration Options

```javascript
const cache = new MemoryEfficientCache({
  // Maximum number of items to store
  maxItems: 1000,
  
  // Maximum memory usage in MB
  maxSizeMB: 100,
  
  // Default TTL for entries in milliseconds (0 = no expiration)
  ttl: 60000, // 1 minute
  
  // Automatic pruning interval in milliseconds
  pruneInterval: 300000, // 5 minutes
  
  // Cache version
  version: '1.0',
  
  // Callback when an entry is evicted
  onEviction: (key, value) => {
    console.log(`Entry ${key} was evicted`);
  }
});
```

### Time-To-Live (TTL)

```javascript
// Set with a specific TTL (10 seconds)
cache.set('key1', 'value1', { ttl: 10000 });

// Set with no expiration
cache.set('key2', 'value2', { ttl: 0 });
```

### Version-based Invalidation

```javascript
// Set entries with version tags
cache.set('key1', 'value1', { version: '1.0' });
cache.set('key2', 'value2', { version: '1.0' });
cache.set('key3', 'value3', { version: '2.0' });

// Invalidate all entries with version 1.0
const invalidatedCount = cache.invalidateVersion('1.0');
// invalidatedCount = 2 (key1 and key2)
```

### Get or Compute

```javascript
// Get a value from cache or compute it if not present
const value = await cache.getOrCompute('key1', async () => {
  // Expensive operation to compute the value
  const result = await fetchDataFromAPI();
  return result;
});
```

### Cache Warming

```javascript
// Warm the cache with multiple entries
await cache.warmCache(
  ['key1', 'key2', 'key3'],
  async (key) => {
    // Compute the value for this key
    const result = await fetchDataForKey(key);
    return result;
  }
);
```

### Memory Management

The cache automatically manages memory usage based on the specified limits:

- When `maxItems` is reached, the least recently used items are evicted
- When `maxSizeMB` is reached, items are evicted until memory usage is below the limit

### Statistics

```javascript
// Get cache statistics
const stats = cache.getStats();

console.log(`Cache hit rate: ${stats.hitRate * 100}%`);
console.log(`Memory usage: ${stats.memoryUsage / (1024 * 1024)} MB`);
```

## Examples

For complete examples, see the [cache-example.mjs](../../examples/cache-example.mjs) file.

## API Reference

### Constructor

- `new MemoryEfficientCache(options)` - Create a new cache instance

### Methods

- `set(key, value, options)` - Store a value in the cache
- `get(key)` - Retrieve a value from the cache
- `has(key)` - Check if a key exists in the cache
- `delete(key)` - Remove a key from the cache
- `clear()` - Remove all entries from the cache
- `keys()` - Get all keys in the cache
- `size()` - Get the number of items in the cache
- `getOrCompute(key, computeFn, options)` - Get a value or compute it if not in cache
- `warmCache(keys, computeFn, options)` - Pre-populate the cache with multiple keys
- `prune()` - Remove all expired entries
- `invalidateVersion(version)` - Remove all entries with the specified version
- `getStats()` - Get statistics about the cache
- `getMemoryUsage()` - Get the current memory usage of the cache in bytes
- `dispose()` - Clean up resources used by the cache

## Implementation Details

The cache uses a Map for O(1) access times and tracks memory usage through approximation based on the data types and sizes of stored values. LRU tracking is performed by updating timestamp metadata on each access.

## License

[Include your license here] 