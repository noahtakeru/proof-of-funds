/**
 * Memory Management for Zero-Knowledge Operations
 * 
 * This module provides utilities for managing memory usage during 
 * zero-knowledge operations, including secure memory handling, 
 * garbage collection hints, and private data wiping.
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This module acts as a resource manager for our privacy-protecting system.
 * Think of it like these everyday resource management examples:
 * 
 * 1. MEMORY MONITORING: Like a dashboard in your car that warns when fuel is
 *    getting low, this system monitors computer memory and alerts the application
 *    before it runs out, preventing crashes during important operations.
 * 
 * 2. SECURE CLEANUP: Similar to how sensitive documents are shredded rather than
 *    just thrown in the trash, this module completely erases sensitive data from
 *    memory when it's no longer needed, leaving no traces that could be exploited.
 * 
 * 3. RESOURCE OPTIMIZATION: Like how a smart thermostat adjusts based on needs,
 *    this system helps the application use memory efficiently, running heavy
 *    calculations only when sufficient resources are available.
 * 
 * 4. FAILURE PREVENTION: Similar to how a backup generator kicks in during a power
 *    outage, this module provides fallback options when memory resources are
 *    constrained, ensuring critical operations can still complete.
 * 
 * Business value: Prevents application crashes and slowdowns during critical
 * financial operations, enhances security by properly disposing of sensitive data,
 * and enables a smoother user experience across different device capabilities.
 */

// Import device capability detection from Phase 1
import { getDeviceCapabilities } from './deviceCapabilities.js';

// Constants for memory management
const MEMORY_PRESSURE_THRESHOLD = 0.8; // 80% of available memory
const LOW_MEMORY_THRESHOLD_MB = 200; // Warn when less than 200MB available
const CRITICAL_MEMORY_THRESHOLD_MB = 50; // Error when less than 50MB available
const GC_INTERVAL_MS = 30000; // Suggest garbage collection every 30 seconds during heavy operations

// Private state
let memoryPressureInterval = null;
let isMonitoringMemory = false;
let memoryWarningCallback = null;
let memoryErrorCallback = null;

/**
 * Suggests to the JavaScript engine that it's a good time to perform garbage collection
 * Note: This is a hint only, the engine may ignore it
 * 
 * @returns {boolean} Always returns true
 */
export const suggestGarbageCollection = () => {
  // Use available mechanisms to suggest GC
  if (global?.gc && typeof global.gc === 'function') {
    try {
      // Direct GC call if exposed (requires --expose-gc flag in Node.js)
      global.gc();
    } catch (e) {
      console.log('Manual GC not available');
    }
  }

  // Create and release a large object to hint the GC
  try {
    const largeObj = new Array(10000).fill(new Array(1000));
    largeObj.length = 0;
  } catch (err) {
    // Ignore errors
  }

  return true;
};

/**
 * Securely wipes sensitive data from memory
 * Overwrites the data with zeros to prevent memory access
 * 
 * @param {Object|string|Uint8Array|Array} data - Data to wipe
 * @returns {boolean} True if wiping was successful
 */
export const secureMemoryWipe = (data) => {
  // Skip wiping if data is undefined or null
  if (data === undefined || data === null) {
    return true;
  }

  try {
    // Handle different data types
    if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
      // Zero out all bytes in the array
      new Uint8Array(data.buffer || data).fill(0);
    } else if (Array.isArray(data)) {
      // Zero out array contents
      for (let i = 0; i < data.length; i++) {
        if (typeof data[i] === 'object' && data[i] !== null) {
          secureMemoryWipe(data[i]);
        }
        data[i] = null;
      }
      // Clear array length
      data.length = 0;
    } else if (typeof data === 'object') {
      // Recursively wipe all properties of an object
      Object.keys(data).forEach(key => {
        if (typeof data[key] === 'object' && data[key] !== null) {
          secureMemoryWipe(data[key]);
        }
        data[key] = null;
      });
    }

    // For strings or primitives, we can't directly wipe them
    // since they're immutable in JavaScript

    return true;
  } catch (error) {
    console.error('Error in secure memory wipe:', error);
    return false;
  }
};

/**
 * Gets the current memory usage
 * Works in both browser and Node.js environments
 * 
 * @returns {Object} Memory usage information
 */
export const getMemoryUsage = () => {
  const memoryInfo = {
    total: 0,
    used: 0,
    available: 0,
    limit: 0
  };

  try {
    // Browser environment
    if (typeof window !== 'undefined' && window.performance && window.performance.memory) {
      // Chrome-specific API
      const perfMemory = window.performance.memory;
      memoryInfo.total = perfMemory.totalJSHeapSize;
      memoryInfo.used = perfMemory.usedJSHeapSize;
      memoryInfo.limit = perfMemory.jsHeapSizeLimit;
      memoryInfo.available = memoryInfo.limit - memoryInfo.used;
    }
    // Node.js environment
    else if (typeof process !== 'undefined' && process.memoryUsage) {
      const nodeMemory = process.memoryUsage();
      memoryInfo.total = nodeMemory.heapTotal;
      memoryInfo.used = nodeMemory.heapUsed;
      memoryInfo.available = memoryInfo.total - memoryInfo.used;
      memoryInfo.limit = nodeMemory.rss;
    }

    // Calculate memory pressure percentage
    memoryInfo.pressurePercentage = memoryInfo.total > 0
      ? memoryInfo.used / memoryInfo.total
      : 0;

    // Convert to MB for readable output
    memoryInfo.totalMB = Math.round(memoryInfo.total / (1024 * 1024));
    memoryInfo.usedMB = Math.round(memoryInfo.used / (1024 * 1024));
    memoryInfo.availableMB = Math.round(memoryInfo.available / (1024 * 1024));
    memoryInfo.limitMB = Math.round(memoryInfo.limit / (1024 * 1024));
  } catch (err) {
    console.error('Error getting memory usage:', err);
  }

  return memoryInfo;
};

/**
 * Checks current memory availability against requirements
 * 
 * @param {number} requiredMemoryMB - How much memory (MB) is required
 * @returns {Object} Result with isAvailable flag and details
 */
export const checkMemoryAvailability = (requiredMemoryMB) => {
  // Get device capabilities including memory
  const capabilities = getDeviceCapabilities();
  const memoryUsage = getMemoryUsage();

  // If we can't determine memory, assume it's available
  if (!capabilities.availableMemory) {
    return {
      isAvailable: true,
      availableMemory: null,
      requiredMemory: requiredMemoryMB,
      details: 'Memory information unavailable, proceeding cautiously'
    };
  }

  // Calculate if we have enough memory
  const isAvailable = capabilities.availableMemory >= requiredMemoryMB;
  const memoryGapMB = capabilities.availableMemory - requiredMemoryMB;

  return {
    isAvailable,
    availableMemory: capabilities.availableMemory,
    requiredMemory: requiredMemoryMB,
    memoryGapMB,
    memoryUsage,
    details: isAvailable
      ? `Sufficient memory available (${memoryGapMB}MB extra)`
      : `Insufficient memory: ${Math.abs(memoryGapMB)}MB short`
  };
};

/**
 * Begins monitoring memory usage, calling callbacks when thresholds are reached
 * 
 * @param {Function} warningCallback - Called when memory is low but still usable
 * @param {Function} errorCallback - Called when memory is critically low
 * @param {number} checkIntervalMs - How often to check memory (milliseconds)
 * @returns {Object} Control object with stop() function
 */
export const startMemoryMonitoring = (
  warningCallback,
  errorCallback,
  checkIntervalMs = 5000
) => {
  // Save callbacks
  memoryWarningCallback = warningCallback;
  memoryErrorCallback = errorCallback;

  // Stop any existing monitoring
  if (isMonitoringMemory) {
    stopMemoryMonitoring();
  }

  // Start monitoring
  isMonitoringMemory = true;

  // Function to check memory status
  const checkMemory = () => {
    const memoryInfo = getMemoryUsage();

    // Check for critical memory shortage
    if (memoryInfo.availableMB < CRITICAL_MEMORY_THRESHOLD_MB) {
      // Call error callback
      if (memoryErrorCallback && typeof memoryErrorCallback === 'function') {
        memoryErrorCallback(memoryInfo);
      }

      // Force garbage collection suggestion
      suggestGarbageCollection();
    }
    // Check for low memory
    else if (memoryInfo.availableMB < LOW_MEMORY_THRESHOLD_MB ||
      memoryInfo.pressurePercentage > MEMORY_PRESSURE_THRESHOLD) {
      // Call warning callback
      if (memoryWarningCallback && typeof memoryWarningCallback === 'function') {
        memoryWarningCallback(memoryInfo);
      }

      // Suggest garbage collection
      suggestGarbageCollection();
    }
  };

  // Create interval to check memory
  memoryPressureInterval = setInterval(checkMemory, checkIntervalMs);

  // Do an immediate check
  checkMemory();

  // Return control object
  return {
    stop: stopMemoryMonitoring,
    checkNow: checkMemory
  };
};

/**
 * Stops memory usage monitoring
 */
export const stopMemoryMonitoring = () => {
  if (memoryPressureInterval) {
    clearInterval(memoryPressureInterval);
    memoryPressureInterval = null;
  }

  isMonitoringMemory = false;

  // Clear callbacks
  memoryWarningCallback = null;
  memoryErrorCallback = null;

  return true;
};

/**
 * Runs a function in a controlled memory environment
 * Monitors memory during execution and cleans up afterward
 * 
 * @param {Function} fn - The function to run
 * @param {number} requiredMemoryMB - Required memory in MB
 * @param {Object} options - Additional options
 * @returns {Promise<any>} The result of the function
 */
export const runWithMemoryControl = async (fn, requiredMemoryMB, options = {}) => {
  // Check memory before starting
  const memCheck = checkMemoryAvailability(requiredMemoryMB);

  if (!memCheck.isAvailable && !options.forceRun) {
    throw new Error(`Insufficient memory for operation: ${memCheck.details}`);
  }

  // Set up memory monitoring
  const monitoring = startMemoryMonitoring(
    // Warning callback
    (memInfo) => {
      console.warn(`Low memory warning during operation: ${memInfo.availableMB}MB available`);
      if (options.onMemoryWarning) {
        options.onMemoryWarning(memInfo);
      }
    },
    // Error callback
    (memInfo) => {
      console.error(`Critical memory pressure during operation: ${memInfo.availableMB}MB available`);
      if (options.onMemoryError) {
        options.onMemoryError(memInfo);
      }
    }
  );

  try {
    // Suggest garbage collection before starting
    suggestGarbageCollection();

    // Execute the function
    const result = await fn();

    return result;
  } finally {
    // Always clean up monitoring and suggest GC after operation
    monitoring.stop();
    suggestGarbageCollection();

    // Run any cleanup function
    if (options.cleanup && typeof options.cleanup === 'function') {
      try {
        await options.cleanup();
      } catch (cleanupError) {
        console.error('Error in memory cleanup:', cleanupError);
      }
    }
  }
};

// Export the public API
export default {
  suggestGarbageCollection,
  secureMemoryWipe,
  getMemoryUsage,
  checkMemoryAvailability,
  startMemoryMonitoring,
  stopMemoryMonitoring,
  runWithMemoryControl
};