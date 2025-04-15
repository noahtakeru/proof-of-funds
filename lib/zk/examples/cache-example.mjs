/**
 * @fileoverview Example demonstrating the use of MemoryEfficientCache
 * 
 * This example shows how to use the MemoryEfficientCache for various
 * caching scenarios including:
 * - Basic caching
 * - TTL (Time-To-Live)
 * - Version-based invalidation
 * - Cache warming
 * - Memory management
 * 
 * @author ZK Protocol Team
 */

import { MemoryEfficientCache } from '../src/cache/MemoryEfficientCache.mjs';

// Simulate an expensive API call
async function fetchUserData(userId) {
    console.log(`Fetching data for user ${userId} from API...`);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Return mock user data
    return {
        id: userId,
        name: `User ${userId}`,
        email: `user${userId}@example.com`,
        preferences: {
            theme: userId % 2 === 0 ? 'light' : 'dark',
            notifications: userId % 3 === 0
        },
        lastLogin: new Date().toISOString(),
        accountCreated: '2023-01-01T00:00:00Z',
        profileData: 'A'.repeat(1024) // Add some size to the object
    };
}

// Simulate expensive computation
function computeAnalytics(data) {
    console.log(`Computing analytics for ${data.length} items...`);

    // Simulate CPU-intensive operation
    const startTime = Date.now();
    while (Date.now() - startTime < 200) {
        // Busy wait to simulate work
        Math.random() * Math.random();
    }

    return {
        total: data.length,
        active: data.filter(item => item.id % 2 === 0).length,
        inactive: data.filter(item => item.id % 2 !== 0).length,
        withNotifications: data.filter(item => item.preferences.notifications).length,
        timestamp: new Date().toISOString()
    };
}

// Example 1: Basic caching
async function basicCachingExample() {
    console.log('\n=== Example 1: Basic Caching ===');

    const cache = new MemoryEfficientCache();

    // Function to get user, either from cache or API
    async function getUser(userId) {
        const cacheKey = `user:${userId}`;

        // Check if in cache
        if (cache.has(cacheKey)) {
            console.log(`Cache hit for user ${userId}`);
            return cache.get(cacheKey);
        }

        // Not in cache, fetch from API
        const userData = await fetchUserData(userId);

        // Store in cache
        cache.set(cacheKey, userData);

        return userData;
    }

    // First request for user 1 (cache miss)
    const user1First = await getUser(1);
    console.log('User 1 data:', user1First.name);

    // Second request for user 1 (cache hit)
    const user1Second = await getUser(1);
    console.log('User 1 data (from cache):', user1Second.name);

    // Request for user 2 (cache miss)
    const user2 = await getUser(2);
    console.log('User 2 data:', user2.name);

    // Display cache stats
    console.log('Cache stats:', cache.getStats());
}

// Example 2: Time-To-Live (TTL)
async function ttlExample() {
    console.log('\n=== Example 2: Time-To-Live (TTL) ===');

    // Create cache with 2 second default TTL
    const cache = new MemoryEfficientCache({ ttl: 2000 });

    // Function to get user with TTL
    async function getUser(userId) {
        const cacheKey = `user:${userId}`;

        // Check if in cache
        if (cache.has(cacheKey)) {
            console.log(`Cache hit for user ${userId}`);
            return cache.get(cacheKey);
        }

        // Not in cache, fetch from API
        const userData = await fetchUserData(userId);

        // Store in cache (using default TTL)
        cache.set(cacheKey, userData);

        return userData;
    }

    // First request for user 1
    const user1First = await getUser(1);
    console.log('User 1 data:', user1First.name);

    // Second request for user 1 (cache hit)
    const user1Second = await getUser(1);
    console.log('User 1 data (from cache):', user1Second.name);

    // Wait for cache to expire
    console.log('Waiting for cache to expire...');
    await new Promise(resolve => setTimeout(resolve, 2100));

    // Third request for user 1 (cache miss due to TTL)
    const user1Third = await getUser(1);
    console.log('User 1 data (fetched again after TTL):', user1Third.name);

    // Display cache stats
    console.log('Cache stats:', cache.getStats());
}

// Example 3: Version-based invalidation
async function versionInvalidationExample() {
    console.log('\n=== Example 3: Version-based Invalidation ===');

    const cache = new MemoryEfficientCache();

    // Function to get user with version
    async function getUser(userId, version) {
        const cacheKey = `user:${userId}`;

        // Check if in cache
        if (cache.has(cacheKey)) {
            console.log(`Cache hit for user ${userId}`);
            return cache.get(cacheKey);
        }

        // Not in cache, fetch from API
        const userData = await fetchUserData(userId);

        // Store in cache with version
        cache.set(cacheKey, userData, { version });

        return userData;
    }

    // Load some users with version 1.0
    console.log('Loading users with version 1.0...');
    await getUser(1, '1.0');
    await getUser(2, '1.0');
    await getUser(3, '1.0');

    // Load some users with version 2.0
    console.log('Loading users with version 2.0...');
    await getUser(4, '2.0');
    await getUser(5, '2.0');

    console.log(`Cache size before invalidation: ${cache.size()}`);

    // Invalidate version 1.0
    console.log('Invalidating version 1.0...');
    const invalidated = cache.invalidateVersion('1.0');
    console.log(`Invalidated ${invalidated} entries`);

    console.log(`Cache size after invalidation: ${cache.size()}`);

    // Display keys left in cache
    console.log('Remaining keys in cache:', cache.keys());
}

// Example 4: Cache warming
async function cacheWarmingExample() {
    console.log('\n=== Example 4: Cache Warming ===');

    const cache = new MemoryEfficientCache();

    // Pre-warm the cache with some users
    console.log('Pre-warming cache with users 1-5...');
    const userIds = [1, 2, 3, 4, 5];

    const startTime = Date.now();

    await cache.warmCache(
        userIds.map(id => `user:${id}`),
        async (key) => {
            const userId = parseInt(key.split(':')[1]);
            return await fetchUserData(userId);
        }
    );

    console.log(`Cache warming completed in ${Date.now() - startTime}ms`);
    console.log(`Cache size after warming: ${cache.size()}`);

    // Now fetch some users (should be cache hits)
    console.log('\nFetching users from warmed cache:');
    for (let id of [1, 3, 5]) {
        const cacheKey = `user:${id}`;
        const beforeTime = Date.now();
        const user = cache.get(cacheKey);
        console.log(`User ${id} fetched in ${Date.now() - beforeTime}ms:`, user.name);
    }

    // Display cache stats
    console.log('Cache stats:', cache.getStats());
}

// Example 5: Memory management
async function memoryManagementExample() {
    console.log('\n=== Example 5: Memory Management ===');

    // Create a cache with memory and size limits
    const cache = new MemoryEfficientCache({
        maxItems: 10,       // Maximum 10 items
        maxSizeMB: 1        // Maximum 1MB total
    });

    // Helper to create large objects of specified size
    function createLargeObject(id, sizeKB) {
        return {
            id,
            name: `Large Object ${id}`,
            data: 'X'.repeat(sizeKB * 1024),
            createdAt: new Date().toISOString()
        };
    }

    // Add objects until we hit limits
    console.log('Adding objects to cache until limits are reached...');
    let objectsAdded = 0;

    for (let i = 1; i <= 20; i++) {
        // Create object of increasing size
        const sizeKB = 100 + (i * 10);
        const object = createLargeObject(i, sizeKB);

        // Try to add to cache
        const added = cache.set(`object:${i}`, object);

        if (added) {
            objectsAdded++;
            console.log(`Added object ${i} (${sizeKB}KB), cache size: ${cache.size()}`);
        } else {
            console.log(`Failed to add object ${i} (${sizeKB}KB), limit reached`);
            break;
        }
    }

    console.log(`Total objects added: ${objectsAdded}`);
    console.log(`Final cache size: ${cache.size()} items`);
    console.log(`Memory usage: ${(cache.getMemoryUsage() / (1024 * 1024)).toFixed(2)}MB`);

    // Try to access all objects
    console.log('\nAccessing objects (checking which ones are still in cache):');
    for (let i = 1; i <= 20; i++) {
        const key = `object:${i}`;
        if (cache.has(key)) {
            const obj = cache.get(key);
            console.log(`Object ${i} is in cache, size: ${(obj.data.length / 1024).toFixed(2)}KB`);
        } else {
            console.log(`Object ${i} is not in cache (evicted due to limits)`);
        }
    }
}

// Example 6: getOrCompute functionality
async function getOrComputeExample() {
    console.log('\n=== Example 6: getOrCompute Functionality ===');

    const cache = new MemoryEfficientCache();

    // Create sample data
    const users = [];
    for (let i = 1; i <= 10; i++) {
        users.push(await fetchUserData(i));
    }

    // Function to compute analytics
    async function getAnalytics(cacheKey) {
        console.log('Computing analytics from scratch...');
        return computeAnalytics(users);
    }

    // First call - will compute
    console.log('First call to getOrCompute (should compute):');
    const startTime1 = Date.now();
    const analytics1 = await cache.getOrCompute('analytics:daily', getAnalytics);
    console.log(`Analytics computed in ${Date.now() - startTime1}ms:`, analytics1);

    // Second call - should use cache
    console.log('\nSecond call to getOrCompute (should use cache):');
    const startTime2 = Date.now();
    const analytics2 = await cache.getOrCompute('analytics:daily', getAnalytics);
    console.log(`Analytics retrieved in ${Date.now() - startTime2}ms:`, analytics2);

    // Display cache stats
    console.log('Cache stats:', cache.getStats());
}

// Run all examples
async function runAllExamples() {
    await basicCachingExample();
    await ttlExample();
    await versionInvalidationExample();
    await cacheWarmingExample();
    await memoryManagementExample();
    await getOrComputeExample();

    console.log('\n=== All examples completed ===');
}

// Run the examples
runAllExamples().catch(console.error); 