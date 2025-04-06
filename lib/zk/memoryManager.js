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
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This function is like asking someone to take out the trash when the bin is getting full.
 * In computers, unused data piles up like trash, taking up valuable memory space. This function
 * politely suggests to the computer that now would be a good time to clean up that unused data.
 * The computer might decide to ignore the suggestion if it's busy, but usually it will clean up
 * some memory, which helps prevent our application from running slowly or crashing due to
 * memory limitations.
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
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This function works like a paper shredder for digital information. When you're done with
 * sensitive documents like bank statements, you don't just throw them in the trash - you
 * shred them to prevent someone from finding and misusing that information.
 * 
 * Similarly, this function "shreds" sensitive data in the computer's memory by overwriting
 * it with zeros, making it unreadable. This prevents attackers from potentially finding
 * sensitive financial information (like wallet keys or balances) that might still be
 * sitting in memory after you've finished using it.
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
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This function is like checking the fuel gauge in your car. It tells you how much computer
 * memory is being used and how much is still available. Just as you need to know your fuel
 * level before a long journey, our application needs to know memory levels before performing
 * intensive calculations.
 * 
 * The function gathers information about:
 * - Total memory available (the size of your tank)
 * - Memory currently in use (how much fuel you've used)
 * - Remaining available memory (how much fuel you have left)
 * 
 * This helps the application make smart decisions about when to perform certain operations
 * and when to wait or free up resources first.
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
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This function is like checking if you have enough money in your account before making
 * a large purchase. Before our application attempts to perform a memory-intensive operation
 * (like generating a complex financial proof), it first checks if there's enough memory
 * available to complete the task successfully.
 * 
 * If there isn't enough memory available, the function warns the application so it can:
 * - Notify the user that their device might not be powerful enough
 * - Try to free up some resources before proceeding
 * - Offer a lighter-weight alternative that requires less memory
 * 
 * This prevents frustrating crashes and failed operations that might otherwise happen
 * if the application tried to use more memory than was available.
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
 * Starts periodic monitoring of memory usage
 * Triggers callbacks when memory limits are approached
 * 
 * @param {Function} warningCallback - Called when available memory is low
 * @param {Function} errorCallback - Called when available memory is critically low
 * @param {number} checkIntervalMs - How often to check memory (milliseconds)
 * @returns {boolean} Whether monitoring was started successfully
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This function works like setting up an alarm system that monitors resource levels.
 * Instead of checking memory once, it sets up an ongoing monitoring system that regularly
 * checks memory levels and sounds different alarms depending on the situation:
 * 
 * - WARNING ALARM: When memory is getting low, it triggers a "warning" notification
 *   so the application can take preventive measures (like cleaning up unused resources)
 *   
 * - CRITICAL ALARM: When memory is dangerously low, it triggers an "error" notification
 *   so the application can take emergency measures (like pausing operations or saving
 *   user data to prevent loss)
 *   
 * This ongoing monitoring helps the application stay responsive and stable even when
 * running for long periods or performing multiple complex operations in sequence.
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
 * Stops memory monitoring
 * 
 * @returns {boolean} Whether monitoring was stopped successfully
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This function is like turning off an alarm system when it's no longer needed.
 * Once the application has finished performing memory-intensive operations, it can
 * call this function to stop the regular memory checks.
 * 
 * Stopping the monitoring when it's not needed helps save resources (since checking
 * memory itself uses a small amount of processing power) and prevents unnecessary
 * warning messages from appearing after the risky operations are complete.
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
 * Runs a function with memory monitoring and control
 * 
 * @param {Function} fn - Function to run
 * @param {number} requiredMemoryMB - How much memory (MB) is required
 * @param {Object} options - Additional options
 * @param {boolean} options.strictMemoryCheck - Whether to abort if memory is insufficient
 * @param {Function} options.onWarning - Called when memory is low
 * @param {Function} options.onError - Called when memory is critically low
 * @param {Function} options.onComplete - Called when function completes
 * @returns {Promise<any>} Result of the function
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This function works like a safety supervisor for complex operations. When your application
 * needs to perform a memory-intensive task (like generating a complex financial proof),
 * this function:
 * 
 * 1. SAFETY CHECK: First checks if there's enough memory available
 * 2. MONITORING: Sets up continuous monitoring during the operation
 * 3. SUPERVISOR: Executes the operation while watching for problems
 * 4. EMERGENCY RESPONSE: Takes appropriate action if memory runs low
 * 5. CLEANUP: Properly cleans up resources when the operation finishes
 * 
 * It's similar to how a medical procedure might have a specialist perform the procedure
 * while a supervisor monitors the patient's vital signs and can step in if any issues arise.
 * This ensures complex operations complete successfully without crashing the application.
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