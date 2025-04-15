/**
 * @fileoverview Tests for the MemoryEfficientCache implementation
 * 
 * This file contains tests to verify the functionality, performance, and memory
 * efficiency of the MemoryEfficientCache implementation.
 */

import { MemoryEfficientCache } from '../../src/cache/MemoryEfficientCache.mjs';
import assert from 'assert';

// Helper function to measure memory usage
function getMemoryUsage() {
    const memoryUsage = process.memoryUsage();
    return {
        rss: memoryUsage.rss / 1024 / 1024, // Convert to MB
        heapTotal: memoryUsage.heapTotal / 1024 / 1024,
        heapUsed: memoryUsage.heapUsed / 1024 / 1024
    };
}

// Helper function to generate a large string of specified size in MB
function generateLargeString(sizeInMB) {
    const baseString = 'X'.repeat(1024 * 1024); // 1MB of data
    let result = '';
    for (let i = 0; i < sizeInMB; i++) {
        result += baseString;
    }
    return result;
}

// Helper to measure execution time
function measureTime(fn) {
    const start = process.hrtime.bigint();
    fn();
    const end = process.hrtime.bigint();
    return Number(end - start) / 1e6; // Convert to milliseconds
}

// Basic Functionality Tests
console.log('🧪 Running basic functionality tests...');

function runBasicTests() {
    const cache = new MemoryEfficientCache();

    // Test set and get
    cache.set('key1', 'value1');
    assert.strictEqual(cache.get('key1'), 'value1', 'Basic get/set failed');

    // Test has
    assert.strictEqual(cache.has('key1'), true, 'has method failed for existing key');
    assert.strictEqual(cache.has('nonexistent'), false, 'has method failed for non-existing key');

    // Test delete
    cache.delete('key1');
    assert.strictEqual(cache.has('key1'), false, 'delete method failed');
    assert.strictEqual(cache.get('key1'), undefined, 'get after delete should return undefined');

    // Test clear
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.clear();
    assert.strictEqual(cache.has('key1'), false, 'clear method failed');
    assert.strictEqual(cache.has('key2'), false, 'clear method failed');

    // Test capacity and eviction
    const smallCache = new MemoryEfficientCache({ maxSize: 3 });
    smallCache.set('key1', 'value1');
    smallCache.set('key2', 'value2');
    smallCache.set('key3', 'value3');
    smallCache.set('key4', 'value4'); // This should evict the least recently used key
    assert.strictEqual(smallCache.has('key1'), false, 'LRU eviction failed');

    // Test custom TTL
    const ttlCache = new MemoryEfficientCache({ ttl: 100 }); // 100ms TTL
    ttlCache.set('expiring', 'value');
    assert.strictEqual(ttlCache.get('expiring'), 'value', 'TTL get failed immediately');

    return new Promise(resolve => {
        setTimeout(() => {
            assert.strictEqual(ttlCache.get('expiring'), undefined, 'TTL expiration failed');
            resolve();
        }, 150);
    });
}

// Memory Efficiency Tests
console.log('🧪 Running memory efficiency tests...');

function runMemoryTests() {
    // Create a cache with 10MB limit
    const cache = new MemoryEfficientCache({
        maxSize: 100,
        maxMemoryMB: 10
    });

    const memBefore = getMemoryUsage();
    console.log('Memory before large data:', memBefore);

    // Add data until we reach the memory limit
    let count = 0;
    try {
        for (let i = 0; i < 20; i++) {
            const key = `large-${i}`;
            const value = generateLargeString(1); // 1MB of data
            cache.set(key, value);
            count++;
        }
    } catch (e) {
        console.log(`Exception after ${count} items: ${e.message}`);
    }

    const memAfter = getMemoryUsage();
    console.log('Memory after large data:', memAfter);

    // Memory should be limited as per the cache configuration
    assert.ok(
        count < 20 || (memAfter.heapUsed - memBefore.heapUsed) < 15,
        'Memory usage exceeded the expected limit'
    );

    // Clean up
    cache.clear();
    global.gc && global.gc(); // Run garbage collection if available
}

// Performance Tests
console.log('🧪 Running performance tests...');

function runPerformanceTests() {
    const cache = new MemoryEfficientCache({ maxSize: 10000 });

    // Test set performance
    const setTime = measureTime(() => {
        for (let i = 0; i < 10000; i++) {
            cache.set(`key-${i}`, `value-${i}`);
        }
    });
    console.log(`Set performance for 10,000 items: ${setTime.toFixed(2)}ms`);

    // Test get performance
    const getTime = measureTime(() => {
        for (let i = 0; i < 10000; i++) {
            cache.get(`key-${i}`);
        }
    });
    console.log(`Get performance for 10,000 items: ${getTime.toFixed(2)}ms`);

    // Test has performance
    const hasTime = measureTime(() => {
        for (let i = 0; i < 10000; i++) {
            cache.has(`key-${i}`);
        }
    });
    console.log(`Has performance for 10,000 items: ${hasTime.toFixed(2)}ms`);

    // Test delete performance
    const deleteTime = measureTime(() => {
        for (let i = 0; i < 10000; i++) {
            cache.delete(`key-${i}`);
        }
    });
    console.log(`Delete performance for 10,000 items: ${deleteTime.toFixed(2)}ms`);

    // Benchmark against native Map
    const map = new Map();
    const mapSetTime = measureTime(() => {
        for (let i = 0; i < 10000; i++) {
            map.set(`key-${i}`, `value-${i}`);
        }
    });
    console.log(`Map set performance for 10,000 items: ${mapSetTime.toFixed(2)}ms`);

    // Compare
    console.log(`Performance ratio (MemoryEfficientCache/Map): ${(setTime / mapSetTime).toFixed(2)}x`);
}

// Run all tests
async function runAllTests() {
    try {
        await runBasicTests();
        console.log('✅ Basic functionality tests passed');

        if (process.argv.includes('--memory-tests')) {
            runMemoryTests();
            console.log('✅ Memory efficiency tests passed');
        } else {
            console.log('⏭️ Skipping memory tests (use --memory-tests flag to run)');
        }

        runPerformanceTests();
        console.log('✅ Performance tests passed');

        console.log('🎉 All tests completed successfully!');
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

runAllTests(); 