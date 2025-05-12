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
import deviceCapabilitiesModule from './deviceCapabilities.mjs';
// Get device capabilities or throw if not available
const getDeviceCapabilities = deviceCapabilitiesModule.detectCapabilities || 
                            (() => {
                              throw new Error('Device capability detection not available');
                            });

// Import error handling classes and utilities
import { 
  ErrorCode, 
  MemoryError, 
  InsufficientMemoryError, 
  SecurityError, 
  SystemError,
  isZKError
} from '../error-handling/zkErrorHandler.mjs';

import zkErrorLogger from '../error-handling/zkErrorLogger.mjs';

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
 * @throws {SystemError} If the garbage collection operation encounters a critical failure
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
  const operationId = `suggestGC_${Date.now()}`;
  
  try {
    // Use available mechanisms to suggest GC
    if (global?.gc && typeof global.gc === 'function') {
      try {
        // Direct GC call if exposed (requires --expose-gc flag in Node.js)
        global.gc();
      } catch (e) {
        zkErrorLogger.logError(
          new SystemError('Manual GC not available', {
            code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
            operationId,
            recoverable: true,
            details: { originalError: e.message }
          }),
          { context: 'suggestGarbageCollection' }
        );
      }
    }

    // Create and release a large object to hint the GC
    try {
      const largeObj = new Array(10000).fill(new Array(1000));
      largeObj.length = 0;
    } catch (err) {
      // This is an acceptable failure, just log at warning level
      zkErrorLogger.log('WARNING', 'Failed to create hint object for GC', {
        operationId,
        code: ErrorCode.MEMORY_ALLOCATION_FAILED,
        details: { originalError: err.message }
      });
    }

    return true;
  } catch (error) {
    // Only critical system-level failures should reach here
    const zkError = new SystemError(`Critical failure in garbage collection: ${error.message}`, {
      code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
      operationId,
      recoverable: true,
      details: { originalError: error.message }
    });
    
    zkErrorLogger.logError(zkError, { context: 'suggestGarbageCollection' });
    throw zkError;
  }
};

/**
 * Securely wipes sensitive data from memory
 * Overwrites the data with zeros to prevent memory access
 * 
 * @param {Object|string|Uint8Array|Array} data - Data to wipe
 * @returns {boolean} True if wiping was successful
 * @throws {SecurityError} If the secure wiping operation fails
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
  const operationId = `secureWipe_${Date.now()}`;

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
    const zkError = new SecurityError(`Failed to securely wipe memory: ${error.message}`, {
      code: ErrorCode.SECURITY_DATA_INTEGRITY,
      operationId,
      recoverable: false,
      securityCritical: true,
      details: { 
        dataType: data ? typeof data : 'null',
        isArray: Array.isArray(data),
        isTypedArray: data instanceof Uint8Array,
        originalError: error.message
      }
    });
    
    zkErrorLogger.logError(zkError, { 
      context: 'secureMemoryWipe',
      securityCritical: true 
    });
    
    // Although we're throwing, don't include sensitive details about what was being wiped
    throw zkError;
  }
};

/**
 * Gets the current memory usage
 * Works in both browser and Node.js environments
 * 
 * @returns {Object} Memory usage information
 * @throws {SystemError} If memory information cannot be retrieved
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
  const operationId = `getMemUsage_${Date.now()}`;
  
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
    
    // If all memory values are 0, memory info may not be available
    if (memoryInfo.total === 0 && memoryInfo.used === 0 && memoryInfo.limit === 0) {
      zkErrorLogger.log('WARNING', 'Could not determine memory usage - environment may not support memory API', {
        operationId,
        code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED
      });
    }
    
    return memoryInfo;
  } catch (err) {
    const zkError = new SystemError(`Failed to get memory usage: ${err.message}`, {
      code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
      operationId,
      recoverable: true,
      details: { 
        environment: typeof window !== 'undefined' ? 'browser' : 'node',
        originalError: err.message 
      }
    });
    
    zkErrorLogger.logError(zkError, { context: 'getMemoryUsage' });
    
    // Return partial information as best effort
    return memoryInfo;
  }
};

/**
 * Checks current memory availability against requirements
 * 
 * @param {number} requiredMemoryMB - How much memory (MB) is required
 * @returns {Object} Result with isAvailable flag and details
 * @throws {MemoryError} If memory information cannot be determined
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
  const operationId = `checkMemory_${Date.now()}`;
  
  try {
    // Validate input
    if (typeof requiredMemoryMB !== 'number' || requiredMemoryMB <= 0) {
      const zkError = new MemoryError('Invalid required memory value', {
        code: ErrorCode.MEMORY_ALLOCATION_FAILED,
        operationId,
        recoverable: true,
        userFixable: true,
        details: { 
          providedValue: requiredMemoryMB,
          expectedType: 'positive number' 
        }
      });
      
      zkErrorLogger.logError(zkError, { context: 'checkMemoryAvailability' });
      throw zkError;
    }
    
    // Get device capabilities including memory
    const capabilities = getDeviceCapabilities();
    const memoryUsage = getMemoryUsage();

    // If we can't determine memory, assume it's available but log warning
    if (!capabilities.availableMemory) {
      zkErrorLogger.log('WARNING', 'Memory availability detection unsupported - proceeding cautiously', {
        operationId,
        code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
        details: { 
          requiredMemoryMB,
          deviceCapabilities: capabilities
        }
      });
      
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
    
    // For critically low memory, log a warning
    if (!isAvailable && Math.abs(memoryGapMB) > LOW_MEMORY_THRESHOLD_MB) {
      zkErrorLogger.log('WARNING', 'Insufficient memory for operation', {
        operationId,
        code: ErrorCode.MEMORY_INSUFFICIENT,
        details: { 
          requiredMemoryMB,
          availableMemoryMB: capabilities.availableMemory,
          memoryGapMB
        }
      });
    }

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
  } catch (error) {
    // If it's already a ZKError, just log it and re-throw
    if (isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'checkMemoryAvailability' });
      throw error;
    }
    
    // Otherwise wrap it in a MemoryError
    const zkError = new MemoryError(`Failed to check memory availability: ${error.message}`, {
      code: ErrorCode.MEMORY_ALLOCATION_FAILED,
      operationId,
      recoverable: true,
      details: { 
        requiredMemoryMB,
        originalError: error.message 
      }
    });
    
    zkErrorLogger.logError(zkError, { context: 'checkMemoryAvailability' });
    throw zkError;
  }
};

/**
 * Starts periodic monitoring of memory usage
 * Triggers callbacks when memory limits are approached
 * 
 * @param {Function} warningCallback - Called when available memory is low
 * @param {Function} errorCallback - Called when available memory is critically low
 * @param {number} checkIntervalMs - How often to check memory (milliseconds)
 * @returns {Object} Control object with stop and checkNow methods
 * @throws {SystemError} If memory monitoring cannot be started
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
  const operationId = `startMemMonitor_${Date.now()}`;
  
  try {
    // Validate inputs
    if (warningCallback && typeof warningCallback !== 'function') {
      const zkError = new SystemError('Invalid warning callback provided', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        recoverable: true,
        userFixable: true,
        details: { 
          providedType: typeof warningCallback,
          expectedType: 'function' 
        }
      });
      
      zkErrorLogger.logError(zkError, { context: 'startMemoryMonitoring' });
      throw zkError;
    }
    
    if (errorCallback && typeof errorCallback !== 'function') {
      const zkError = new SystemError('Invalid error callback provided', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        recoverable: true,
        userFixable: true,
        details: { 
          providedType: typeof errorCallback,
          expectedType: 'function' 
        }
      });
      
      zkErrorLogger.logError(zkError, { context: 'startMemoryMonitoring' });
      throw zkError;
    }
    
    if (typeof checkIntervalMs !== 'number' || checkIntervalMs < 500) {
      const zkError = new SystemError('Invalid check interval provided', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        recoverable: true,
        userFixable: true,
        details: { 
          providedValue: checkIntervalMs,
          expectedType: 'number >= 500' 
        }
      });
      
      zkErrorLogger.logError(zkError, { context: 'startMemoryMonitoring' });
      throw zkError;
    }
    
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
      try {
        const memoryInfo = getMemoryUsage();

        // Check for critical memory shortage
        if (memoryInfo.availableMB < CRITICAL_MEMORY_THRESHOLD_MB) {
          // Log critical memory state
          zkErrorLogger.log('ERROR', 'Critical memory shortage detected', {
            operationId,
            code: ErrorCode.MEMORY_INSUFFICIENT,
            details: {
              availableMemoryMB: memoryInfo.availableMB,
              thresholdMB: CRITICAL_MEMORY_THRESHOLD_MB,
              pressurePercentage: memoryInfo.pressurePercentage
            }
          });
          
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
          // Log memory warning
          zkErrorLogger.log('WARNING', 'Low memory detected', {
            operationId,
            code: ErrorCode.MEMORY_INSUFFICIENT,
            details: {
              availableMemoryMB: memoryInfo.availableMB,
              thresholdMB: LOW_MEMORY_THRESHOLD_MB,
              pressurePercentage: memoryInfo.pressurePercentage,
              pressureThreshold: MEMORY_PRESSURE_THRESHOLD
            }
          });
          
          // Call warning callback
          if (memoryWarningCallback && typeof memoryWarningCallback === 'function') {
            memoryWarningCallback(memoryInfo);
          }

          // Suggest garbage collection
          suggestGarbageCollection();
        }
      } catch (checkError) {
        // Log the error but don't stop monitoring
        zkErrorLogger.logError(
          new SystemError(`Error during memory check: ${checkError.message}`, {
            code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
            operationId,
            recoverable: true,
            details: { originalError: checkError.message }
          }),
          { context: 'memoryCheck' }
        );
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
  } catch (error) {
    // If it's already a ZKError, just log it and re-throw
    if (isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'startMemoryMonitoring' });
      throw error;
    }
    
    // Otherwise wrap it in a SystemError
    const zkError = new SystemError(`Failed to start memory monitoring: ${error.message}`, {
      code: ErrorCode.SYSTEM_NOT_INITIALIZED,
      operationId,
      recoverable: true,
      details: { originalError: error.message }
    });
    
    zkErrorLogger.logError(zkError, { context: 'startMemoryMonitoring' });
    throw zkError;
  }
};

/**
 * Stops memory monitoring
 * 
 * @returns {boolean} Whether monitoring was stopped successfully
 * @throws {SystemError} If memory monitoring cannot be stopped
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
  const operationId = `stopMemMonitor_${Date.now()}`;
  
  try {
    // If there's no interval, monitoring is already stopped
    if (!memoryPressureInterval) {
      zkErrorLogger.log('INFO', 'Memory monitoring already stopped', {
        operationId
      });
      return true;
    }
    
    // Clean up the interval
    clearInterval(memoryPressureInterval);
    memoryPressureInterval = null;

    isMonitoringMemory = false;

    // Clear callbacks
    memoryWarningCallback = null;
    memoryErrorCallback = null;

    zkErrorLogger.log('INFO', 'Memory monitoring stopped successfully', {
      operationId
    });
    
    return true;
  } catch (error) {
    const zkError = new SystemError(`Failed to stop memory monitoring: ${error.message}`, {
      code: ErrorCode.SYSTEM_NOT_INITIALIZED,
      operationId,
      recoverable: true,
      details: { originalError: error.message }
    });
    
    zkErrorLogger.logError(zkError, { context: 'stopMemoryMonitoring' });
    throw zkError;
  }
};

/**
 * Runs a function with memory monitoring and control
 * 
 * @param {Function} fn - Function to run
 * @param {number} requiredMemoryMB - How much memory (MB) is required
 * @param {Object} options - Additional options
 * @param {boolean} options.strictMemoryCheck - Whether to abort if memory is insufficient
 * @param {Function} options.onMemoryWarning - Called when memory is low
 * @param {Function} options.onMemoryError - Called when memory is critically low
 * @param {Function} options.cleanup - Called when function completes
 * @param {boolean} options.forceRun - Run even if memory is insufficient
 * @returns {Promise<any>} Result of the function
 * @throws {InsufficientMemoryError} If memory is insufficient and strictMemoryCheck=true
 * @throws {Error} Any error thrown by the function being run
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
  const operationId = `memControl_${Date.now()}`;
  
  try {
    // Validate inputs
    if (typeof fn !== 'function') {
      const zkError = new SystemError('Invalid function provided to memory control', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { 
          providedType: typeof fn,
          expectedType: 'function' 
        }
      });
      
      zkErrorLogger.logError(zkError, { context: 'runWithMemoryControl' });
      throw zkError;
    }
    
    if (typeof requiredMemoryMB !== 'number' || requiredMemoryMB <= 0) {
      const zkError = new SystemError('Invalid required memory value', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        recoverable: true,
        userFixable: true,
        details: { 
          providedValue: requiredMemoryMB,
          expectedType: 'positive number' 
        }
      });
      
      zkErrorLogger.logError(zkError, { context: 'runWithMemoryControl' });
      throw zkError;
    }
    
    // Check memory before starting
    const memCheck = checkMemoryAvailability(requiredMemoryMB);

    if (!memCheck.isAvailable && !options.forceRun) {
      const zkError = new InsufficientMemoryError(
        `Insufficient memory for operation: ${memCheck.details}`, 
        {
          code: ErrorCode.MEMORY_INSUFFICIENT,
          operationId,
          recoverable: true,
          userFixable: true,
          details: { 
            requiredMemoryMB,
            availableMemoryMB: memCheck.availableMemory,
            memoryGapMB: memCheck.memoryGapMB
          },
          recommendedAction: "Try closing other applications/tabs or switch to server-side processing."
        }
      );
      
      zkErrorLogger.logError(zkError, { context: 'runWithMemoryControl' });
      throw zkError;
    }

    // Set up memory monitoring with proper error handling
    let monitoring;
    try {
      monitoring = startMemoryMonitoring(
        // Warning callback
        (memInfo) => {
          zkErrorLogger.log('WARNING', 'Low memory warning during operation', {
            operationId,
            code: ErrorCode.MEMORY_INSUFFICIENT,
            details: {
              availableMemoryMB: memInfo.availableMB,
              requiredMemoryMB
            }
          });
          
          if (options.onMemoryWarning) {
            options.onMemoryWarning(memInfo);
          }
        },
        // Error callback
        (memInfo) => {
          zkErrorLogger.log('ERROR', 'Critical memory pressure during operation', {
            operationId,
            code: ErrorCode.MEMORY_LIMIT_EXCEEDED,
            details: {
              availableMemoryMB: memInfo.availableMB,
              requiredMemoryMB
            }
          });
          
          if (options.onMemoryError) {
            options.onMemoryError(memInfo);
          }
        }
      );
    } catch (monitorError) {
      // Log the error but proceed with the operation
      zkErrorLogger.logError(
        new SystemError(`Failed to start memory monitoring: ${monitorError.message}`, {
          code: ErrorCode.SYSTEM_NOT_INITIALIZED,
          operationId,
          recoverable: true,
          details: { originalError: monitorError.message }
        }),
        { context: 'runWithMemoryControl' }
      );
      
      // Create a dummy monitoring object to prevent errors in finally block
      monitoring = { 
        stop: () => {}
      };
    }

    try {
      // Suggest garbage collection before starting
      suggestGarbageCollection();

      // Execute the function
      const result = await fn();

      return result;
    } catch (fnError) {
      // If it's already a ZKError, just log it and re-throw
      if (isZKError(fnError)) {
        zkErrorLogger.logError(fnError, { 
          context: 'runWithMemoryControl.execution',
          details: { requiredMemoryMB } 
        });
        throw fnError;
      }
      
      // Otherwise wrap it in a SystemError
      const zkError = new SystemError(`Error executing memory-controlled function: ${fnError.message}`, {
        code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
        operationId,
        recoverable: false,
        details: { 
          requiredMemoryMB,
          originalError: fnError.message 
        }
      });
      
      zkErrorLogger.logError(zkError, { context: 'runWithMemoryControl.execution' });
      throw zkError;
    } finally {
      // Always clean up monitoring and suggest GC after operation
      try {
        monitoring.stop();
      } catch (stopError) {
        // Just log this error, don't throw from finally
        zkErrorLogger.logError(
          new SystemError(`Error stopping memory monitoring: ${stopError.message}`, {
            code: ErrorCode.SYSTEM_NOT_INITIALIZED,
            operationId,
            recoverable: true,
            details: { originalError: stopError.message }
          }),
          { context: 'runWithMemoryControl.cleanup' }
        );
      }
      
      // Suggest GC
      try {
        suggestGarbageCollection();
      } catch (gcError) {
        // Just log this error, don't throw from finally
        zkErrorLogger.logError(
          new SystemError(`Error suggesting garbage collection: ${gcError.message}`, {
            code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
            operationId,
            recoverable: true,
            details: { originalError: gcError.message }
          }),
          { context: 'runWithMemoryControl.cleanup' }
        );
      }

      // Run any cleanup function
      if (options.cleanup && typeof options.cleanup === 'function') {
        try {
          await options.cleanup();
        } catch (cleanupError) {
          // Log but don't throw from finally
          zkErrorLogger.logError(
            new SystemError(`Error in memory cleanup: ${cleanupError.message}`, {
              code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
              operationId,
              recoverable: true,
              details: { originalError: cleanupError.message }
            }),
            { context: 'runWithMemoryControl.cleanup' }
          );
        }
      }
    }
  } catch (error) {
    // If it's already a ZKError, just log it and re-throw
    if (isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'runWithMemoryControl' });
      throw error;
    }
    
    // Otherwise wrap it in a SystemError
    const zkError = new SystemError(`Unexpected error in memory control: ${error.message}`, {
      code: ErrorCode.SYSTEM_NOT_INITIALIZED,
      operationId,
      recoverable: false,
      details: { 
        requiredMemoryMB,
        originalError: error.message 
      }
    });
    
    zkErrorLogger.logError(zkError, { context: 'runWithMemoryControl' });
    throw zkError;
  }
};

// Named exports for ESM
export {
  MEMORY_PRESSURE_THRESHOLD,
  LOW_MEMORY_THRESHOLD_MB,
  CRITICAL_MEMORY_THRESHOLD_MB,
  GC_INTERVAL_MS
};

// Default export for compatibility
export default {
  suggestGarbageCollection,
  secureMemoryWipe,
  getMemoryUsage,
  checkMemoryAvailability,
  startMemoryMonitoring,
  stopMemoryMonitoring,
  runWithMemoryControl,
  MEMORY_PRESSURE_THRESHOLD,
  LOW_MEMORY_THRESHOLD_MB,
  CRITICAL_MEMORY_THRESHOLD_MB,
  GC_INTERVAL_MS
};