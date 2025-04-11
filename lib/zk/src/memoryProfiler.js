/**
 * memoryProfiler.js - Memory profiling utilities for ZK operations
 * 
 * This module provides tools to track and analyze memory usage during
 * ZK proof generation and verification. It helps identify memory bottlenecks
 * and ensures operations stay within memory budgets.
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This module is like a fitness tracker for our application's memory usage. Think of it like:
 * 
 * 1. RESOURCE MONITOR: Similar to how a coach monitors an athlete's vital signs during
 *    training, this system watches how much memory (computer resources) is being used
 *    during intensive privacy calculations to prevent crashes.
 * 
 * 2. PERFORMANCE ANALYZER: Works like car diagnostics that identify which parts of an
 *    engine are working inefficiently, helping developers pinpoint exactly where memory
 *    usage spikes occur during complex calculations.
 * 
 * 3. CAPACITY PLANNER: Functions like an event planner who knows exactly how many people
 *    can fit in a venue, helping determine whether a user's device has sufficient
 *    capacity to complete specific verification operations.
 * 
 * 4. EARLY WARNING SYSTEM: Acts like a dashboard warning light that alerts developers
 *    before memory problems become critical, allowing for preventative adjustments.
 * 
 * Business value: Prevents application crashes during verification processes, 
 * improves user experience by identifying memory inefficiencies, enables support for
 * lower-end devices by optimizing memory usage, and provides data-driven insights
 * for ongoing performance improvements.
 * 
 * Version: 1.0.0
 */

// ESM re-exporter that dynamically loads the appropriate implementation
// based on the current module system environment

/**
 * Load the appropriate module (ESM or CommonJS) based on the environment
 * @returns {Promise<Object>} The loaded module
 */
async function loadModule() {
  try {
    // First try to load the error logger
    let zkErrorLogger;
    try {
      zkErrorLogger = (await import('./zkErrorLogger.js')).zkErrorLogger;
    } catch (loggerError) {
      // Fall back to console if we can't load the logger
      zkErrorLogger = {
        logError: (err, context) => console.error(`[ERROR][${context.context || 'memoryProfiler'}] ${err.message}`, err, context),
        log: (level, message, details) => console.log(`[${level}] ${message}`, details)
      };
      zkErrorLogger.logError(loggerError, { context: 'memoryProfiler.loadModule.loadLogger' });
    }

    // Detect environment
    const isESM = typeof import.meta === 'object';
    
    try {
      if (isESM) {
        // In ESM environment, we don't have a .mjs version of this module yet
        // So just use dynamic import to load the CJS version via the Node.js ESM wrapper
        const cjsModule = await import('./cjs/memoryProfiler.cjs');
        zkErrorLogger.log('INFO', 'Loaded CommonJS module via ESM wrapper', { module: 'memoryProfiler' });
        return cjsModule;
      } else {
        // In CommonJS environment, directly require the CJS version
        const cjsModule = require('./cjs/memoryProfiler.cjs');
        return cjsModule;
      }
    } catch (importError) {
      zkErrorLogger.logError(importError, { 
        context: 'memoryProfiler.loadModule.importModule',
        details: { isESM, attempted: isESM ? 'ESM import of CJS' : 'CJS require' }
      });
      throw importError;
    }
  } catch (error) {
    console.error('Failed to load memoryProfiler module:', error);
    throw error;
  }
}

/**
 * Create a memory profiler for a specific operation
 * @param {string} operationId - Unique ID for the operation
 * @param {Object} options - Profiling options
 * @returns {Promise<Object>} Memory profiler object
 */
export async function createMemoryProfiler(operationId, options = {}) {
  const module = await loadModule();
  return module.createMemoryProfiler(operationId, options);
}

/**
 * Get current memory usage
 * @returns {Promise<Object>} Current memory snapshot
 */
export async function getMemorySnapshot() {
  const module = await loadModule();
  return module.getMemorySnapshot();
}

/**
 * Get device information for profiling context
 * @returns {Promise<Object>} Device information
 */
export async function getDeviceInfo() {
  const module = await loadModule();
  return module.getDeviceInfo();
}

/**
 * Get a stored memory profile by ID
 * @param {string} operationId - ID of the profile to retrieve
 * @returns {Promise<Object|null>} The memory profile or null if not found
 */
export async function getMemoryProfile(operationId) {
  const module = await loadModule();
  return module.getMemoryProfile(operationId);
}

/**
 * Get all stored memory profiles
 * @returns {Promise<Array>} Array of all memory profiles
 */
export async function getAllMemoryProfiles() {
  const module = await loadModule();
  return module.getAllMemoryProfiles();
}

/**
 * Clear all stored memory profiles
 * @returns {Promise<void>}
 */
export async function clearMemoryProfiles() {
  const module = await loadModule();
  return module.clearMemoryProfiles();
}

/**
 * Compare memory usage against budget
 * @param {Object} profile - The memory profile to check
 * @param {Object} budget - Memory budget to compare against
 * @returns {Promise<Object>} Comparison result with status and details
 */
export async function checkMemoryBudget(profile, budget) {
  const module = await loadModule();
  return module.checkMemoryBudget(profile, budget);
}

/**
 * Get memory recommendations based on profiling results
 * @param {Array} profiles - Array of memory profiles to analyze
 * @returns {Promise<Object>} Recommendations and insights
 */
export async function getMemoryRecommendations(profiles) {
  const module = await loadModule();
  return module.getMemoryRecommendations(profiles);
}

// Create a proxy for default export
const moduleProxy = new Proxy({}, {
  get: function(target, prop) {
    // Return a function that loads the module then calls the requested method
    return async function(...args) {
      const module = await loadModule();
      if (typeof module[prop] === 'function') {
        return module[prop](...args);
      }
      return undefined;
    };
  }
});

// Default export as a proxy to the actual implementation
export default moduleProxy;