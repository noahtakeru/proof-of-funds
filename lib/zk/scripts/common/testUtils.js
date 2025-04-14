/**
 * Test utilities for ZK test framework
 * Common utilities for test setup, teardown, and execution
 */

import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import crypto from 'crypto';
import { ethers } from 'ethers';
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';

// Get dirname equivalent in ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Generate a random string suitable for test IDs
 * @param {number} length - Length of the random string
 * @returns {string} Random string
 */
export function generateRandomId(length = 8) {
    return crypto.randomBytes(length).toString('hex');
}

/**
 * Create a temporary test directory
 * @param {string} testName - Name of the test
 * @returns {string} Path to the created directory
 */
export function createTempTestDir(testName) {
    const tempDir = path.join(
        __dirname,
        '../../tests/temp',
        `${testName}-${generateRandomId()}`
    );

    fs.mkdirSync(tempDir, { recursive: true });
    return tempDir;
}

/**
 * Clean up a temporary test directory
 * @param {string} dirPath - Path to the directory to clean up
 * @returns {boolean} Success status
 */
export function cleanupTempDir(dirPath) {
    try {
        if (fs.existsSync(dirPath)) {
            // Recursive removal
            fs.rmSync(dirPath, { recursive: true, force: true });
        }
        return true;
    } catch (err) {
        console.error(`Error cleaning up temp directory: ${err.message}`);
        return false;
    }
}

/**
 * Create a test wallet with a random private key
 * @returns {ethers.Wallet} Test wallet
 */
export function createTestWallet() {
    return ethers.Wallet.createRandom();
}

/**
 * Generate a batch of test wallets
 * @param {number} count - Number of wallets to generate
 * @returns {Array<ethers.Wallet>} Array of test wallets
 */
export function generateTestWallets(count) {
    return Array.from({ length: count }, () => createTestWallet());
}

/**
 * Generate random test data
 * @param {number} size - Size of data in bytes
 * @returns {Buffer} Random data
 */
export function generateRandomData(size = 32) {
    return crypto.randomBytes(size);
}

/**
 * Create a worker thread and return a promise that resolves when the worker completes
 * @param {string} workerScript - Path to the worker script
 * @param {Object} workerData - Data to pass to the worker
 * @returns {Promise<any>} Promise that resolves with the worker result
 */
export function runWorker(workerScript, workerData) {
    return new Promise((resolve, reject) => {
        // Ensure script path is absolute
        let scriptPath = workerScript;
        if (!path.isAbsolute(scriptPath)) {
            scriptPath = path.resolve(__dirname, '../..', scriptPath);
        }

        const worker = new Worker(scriptPath, { workerData });

        worker.on('message', resolve);
        worker.on('error', reject);
        worker.on('exit', (code) => {
            if (code !== 0) {
                reject(new Error(`Worker stopped with exit code ${code}`));
            }
        });
    });
}

/**
 * Measure execution time of a function
 * @param {Function} fn - Function to measure
 * @param {Array} args - Arguments to pass to the function
 * @returns {Promise<Object>} Result with execution time and function result
 */
export async function measureExecutionTime(fn, ...args) {
    const start = performance.now();
    let result, error;

    try {
        result = await fn(...args);
    } catch (err) {
        error = err;
    }

    const end = performance.now();
    const executionTime = end - start;

    return {
        executionTime,
        result,
        error
    };
}

/**
 * Run a function with retry logic
 * @param {Function} fn - Function to run
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries
 * @param {number} options.delay - Delay between retries in ms
 * @param {number} options.backoffFactor - Exponential backoff factor
 * @param {Function} options.shouldRetry - Function to determine if retry should be attempted
 * @param {...any} args - Arguments to pass to the function
 * @returns {Promise<any>} Promise that resolves with the function result
 */
export async function withRetry(fn, options = {}, ...args) {
    const maxRetries = options.maxRetries || 3;
    const initialDelay = options.delay || 1000;
    const backoffFactor = options.backoffFactor || 2;
    const shouldRetry = options.shouldRetry || (() => true);

    let lastError;
    let attempt = 0;

    while (attempt <= maxRetries) {
        try {
            return await fn(...args);
        } catch (err) {
            lastError = err;
            attempt++;

            if (attempt > maxRetries || !shouldRetry(err, attempt)) {
                break;
            }

            const delay = initialDelay * Math.pow(backoffFactor, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}

/**
 * Process a batch of items with concurrency control
 * @param {Array} items - Items to process
 * @param {Function} processor - Async function to process each item
 * @param {number} concurrency - Maximum number of concurrent operations
 * @returns {Promise<Array>} Results of processing
 */
export async function processBatchWithConcurrency(items, processor, concurrency = 5) {
    const results = [];
    const running = new Set();

    for (const item of items) {
        const promise = (async () => {
            try {
                return await processor(item);
            } finally {
                running.delete(promise);
            }
        })();

        running.add(promise);
        results.push(promise);

        if (running.size >= concurrency) {
            await Promise.race(running);
        }
    }

    return Promise.all(results);
}

/**
 * Calculate statistics for a set of numeric values
 * @param {Array<number>} values - Array of numeric values
 * @returns {Object} Statistics including min, max, mean, median, and std deviation
 */
export function calculateStats(values) {
    if (!values || values.length === 0) {
        return {
            min: null,
            max: null,
            mean: null,
            median: null,
            stdDev: null,
            count: 0
        };
    }

    // Sort values for median calculation
    const sortedValues = [...values].sort((a, b) => a - b);

    // Calculate min and max
    const min = sortedValues[0];
    const max = sortedValues[sortedValues.length - 1];

    // Calculate mean
    const sum = sortedValues.reduce((acc, val) => acc + val, 0);
    const mean = sum / sortedValues.length;

    // Calculate median
    let median;
    const midIndex = Math.floor(sortedValues.length / 2);
    if (sortedValues.length % 2 === 0) {
        median = (sortedValues[midIndex - 1] + sortedValues[midIndex]) / 2;
    } else {
        median = sortedValues[midIndex];
    }

    // Calculate standard deviation
    const sumSquaredDiffs = sortedValues.reduce((acc, val) => {
        const diff = val - mean;
        return acc + (diff * diff);
    }, 0);
    const stdDev = Math.sqrt(sumSquaredDiffs / sortedValues.length);

    return {
        min,
        max,
        mean,
        median,
        stdDev,
        count: sortedValues.length
    };
}

/**
 * Safely parse JSON with error handling
 * @param {string} jsonString - JSON string to parse
 * @param {any} defaultValue - Default value to return if parsing fails
 * @returns {any} Parsed object or default value
 */
export function safeJsonParse(jsonString, defaultValue = {}) {
    try {
        return JSON.parse(jsonString);
    } catch (err) {
        console.error(`Error parsing JSON: ${err.message}`);
        return defaultValue;
    }
}

/**
 * Format bytes to a human-readable string
 * @param {number} bytes - Number of bytes
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted string
 */
export function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

/**
 * Validate test result structure for consistency
 * @param {Object} result - Test result to validate
 * @returns {Object} Validated result with any missing fields filled with defaults
 */
export function validateTestResult(result) {
    const validated = { ...result };

    // Ensure basic structure
    if (!validated.name) validated.name = 'Unnamed Test';
    if (!validated.status) validated.status = 'unknown';
    if (!validated.executionTime) validated.executionTime = 0;
    if (!validated.timestamp) validated.timestamp = new Date().toISOString();

    // Ensure details
    if (!validated.details) validated.details = {};

    return validated;
}

/**
 * Create a standardized test result object
 * @param {string} name - Test name
 * @param {string} status - Test status (passed, failed, skipped)
 * @param {number} executionTime - Execution time in milliseconds
 * @param {Object} details - Additional test details
 * @returns {Object} Test result object
 */
export function createTestResult(name, status, executionTime, details = {}) {
    return validateTestResult({
        name,
        status,
        executionTime,
        details,
        timestamp: new Date().toISOString()
    });
}

export default {
    generateRandomId,
    createTempTestDir,
    cleanupTempDir,
    createTestWallet,
    generateTestWallets,
    generateRandomData,
    runWorker,
    measureExecutionTime,
    withRetry,
    processBatchWithConcurrency,
    calculateStats,
    safeJsonParse,
    formatBytes,
    validateTestResult,
    createTestResult
}; 