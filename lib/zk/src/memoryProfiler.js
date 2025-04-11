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

import { 
  ErrorCode, 
  ErrorSeverity, 
  SystemError,
  MemoryError,
  InputError,
  isZKError 
} from './zkErrorHandler.js';
import { zkErrorLogger } from './zkErrorLogger.js';

/**
 * Custom error class for memory profiling issues
 * @extends MemoryError
 */
class MemoryProfilerError extends MemoryError {
  /**
   * Create a new memory profiler error
   * @param {string} message - Error message
   * @param {Object} options - Error options
   */
  constructor(message, options = {}) {
    super(message, {
      code: options.code || ErrorCode.MEMORY_ALLOCATION_FAILED,
      severity: options.severity || ErrorSeverity.WARNING,
      recoverable: options.recoverable !== undefined ? options.recoverable : true,
      details: {
        ...(options.details || {}),
        component: 'MemoryProfiler',
        operationId: options.operationId || `memory_profiler_${Date.now()}`
      }
    });
    
    this.name = 'MemoryProfilerError';
  }
}

/**
 * Helper function to log errors consistently
 * @param {Error} error - The error to log
 * @param {Object} additionalInfo - Additional context information
 * @returns {Error} The error for chaining
 */
function logError(error, additionalInfo = {}) {
  // Convert to MemoryProfilerError if it's not already a specialized error
  if (!isZKError(error)) {
    const operationId = additionalInfo.operationId || `memory_profiler_error_${Date.now()}`;
    error = new MemoryProfilerError(error.message || 'Unknown error in memory profiler', {
      operationId,
      details: {
        originalError: error,
        ...additionalInfo
      }
    });
  }
  
  // Log the error using zkErrorLogger
  zkErrorLogger.logError(error, additionalInfo);
  return error;
}

/**
 * Memory snapshot structure
 * @typedef {Object} MemorySnapshot
 * @property {number} timestamp - Timestamp when snapshot was taken
 * @property {number} jsHeapSizeLimit - Total available heap size (if available)
 * @property {number} totalJSHeapSize - Current total heap size (if available)
 * @property {number} usedJSHeapSize - Currently used heap size (if available)
 * @property {number} estimatedMemoryUsage - Estimated memory usage if browser APIs not available
 */

/**
 * Memory profile result
 * @typedef {Object} MemoryProfile
 * @property {string} operationType - Type of operation profiled
 * @property {string} circuitType - Type of circuit used
 * @property {MemorySnapshot[]} snapshots - Series of memory snapshots
 * @property {number} peakMemoryUsage - Peak memory usage during operation (in MB)
 * @property {number} averageMemoryUsage - Average memory usage during operation (in MB)
 * @property {number} duration - Duration of the operation in ms
 * @property {number} startTimestamp - Start time of profiling
 * @property {number} endTimestamp - End time of profiling
 * @property {Object} deviceInfo - Information about the device used
 */

// Registry to store memory profiles
const memoryProfiles = new Map();

/**
 * Get current memory usage
 * @returns {MemorySnapshot} Current memory snapshot
 */
function getMemorySnapshot() {
  const snapshot = {
    timestamp: Date.now(),
    jsHeapSizeLimit: 0,
    totalJSHeapSize: 0,
    usedJSHeapSize: 0,
    estimatedMemoryUsage: 0
  };

  try {
    // Try to use performance.memory if available (Chrome only)
    if (typeof performance !== 'undefined' && performance.memory) {
      snapshot.jsHeapSizeLimit = performance.memory.jsHeapSizeLimit;
      snapshot.totalJSHeapSize = performance.memory.totalJSHeapSize;
      snapshot.usedJSHeapSize = performance.memory.usedJSHeapSize;

      // Convert bytes to MB
      snapshot.jsHeapSizeLimit = Math.round(snapshot.jsHeapSizeLimit / (1024 * 1024));
      snapshot.totalJSHeapSize = Math.round(snapshot.totalJSHeapSize / (1024 * 1024));
      snapshot.usedJSHeapSize = Math.round(snapshot.usedJSHeapSize / (1024 * 1024));

      // Use usedJSHeapSize as our primary metric
      snapshot.estimatedMemoryUsage = snapshot.usedJSHeapSize;
    } else {
      // Fallback: try to use Node.js process.memoryUsage if available
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const memUsage = process.memoryUsage();
        // Convert bytes to MB
        snapshot.estimatedMemoryUsage = Math.round(memUsage.heapUsed / (1024 * 1024));
        snapshot.jsHeapSizeLimit = Math.round(memUsage.heapTotal / (1024 * 1024));
        snapshot.totalJSHeapSize = Math.round(memUsage.rss / (1024 * 1024));
      } else {
        // Last resort: use navigator.deviceMemory as rough estimate
        if (typeof navigator !== 'undefined' && navigator.deviceMemory) {
          // Just use a percentage of available memory as estimate
          // This is very rough and not accurate for actual usage
          snapshot.jsHeapSizeLimit = navigator.deviceMemory * 1024; // Convert GB to MB
          snapshot.estimatedMemoryUsage = snapshot.jsHeapSizeLimit * 0.3; // Assume 30% usage
        } else {
          // If nothing available, just use a default value
          snapshot.estimatedMemoryUsage = 500; // Assume 500MB
        }
      }
    }
  } catch (error) {
    const operationId = `memory_snapshot_${Date.now()}`;
    logError(error, {
      operationId,
      details: {
        operation: 'getMemorySnapshot',
        recoveryAction: 'Using default memory estimate',
        snapshot: { ...snapshot },
        environment: {
          hasPerformance: typeof performance !== 'undefined',
          hasProcess: typeof process !== 'undefined',
          hasNavigator: typeof navigator !== 'undefined'
        }
      },
      severity: ErrorSeverity.WARNING,
      recoverable: true
    });
    
    // Use a default value as fallback
    snapshot.estimatedMemoryUsage = 500; // Assume 500MB
  }

  return snapshot;
}

/**
 * Get device information for profiling context
 * @returns {Object} Device information
 */
function getDeviceInfo() {
  const deviceInfo = {
    platform: 'unknown',
    memory: null,
    cores: null,
    browser: 'unknown',
    browserVersion: 'unknown',
    isMobile: false
  };

  try {
    // Detect platform
    if (typeof navigator !== 'undefined') {
      if (navigator.platform) {
        deviceInfo.platform = navigator.platform;
      }

      // Detect memory
      if (navigator.deviceMemory) {
        deviceInfo.memory = navigator.deviceMemory * 1024; // Convert GB to MB
      }

      // Detect cores
      if (navigator.hardwareConcurrency) {
        deviceInfo.cores = navigator.hardwareConcurrency;
      }

      // Detect browser
      const userAgent = navigator.userAgent;
      if (userAgent.indexOf('Chrome') > -1) {
        deviceInfo.browser = 'Chrome';
      } else if (userAgent.indexOf('Firefox') > -1) {
        deviceInfo.browser = 'Firefox';
      } else if (userAgent.indexOf('Safari') > -1) {
        deviceInfo.browser = 'Safari';
      } else if (userAgent.indexOf('Edge') > -1 || userAgent.indexOf('Edg') > -1) {
        deviceInfo.browser = 'Edge';
      }

      // Detect mobile
      deviceInfo.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

      // Try to get browser version
      const match = userAgent.match(/(Chrome|Firefox|Safari|Edge|Edg)\/(\d+\.\d+)/);
      if (match) {
        deviceInfo.browserVersion = match[2];
      }
    } else if (typeof process !== 'undefined') {
      // Node.js environment
      deviceInfo.platform = process.platform;
      deviceInfo.browser = 'Node.js';
      deviceInfo.browserVersion = process.version;

      // Get available memory in Node.js
      if (typeof require === 'function') {
        try {
          const os = require('os');
          deviceInfo.memory = Math.round(os.totalmem() / (1024 * 1024)); // Convert bytes to MB
          deviceInfo.cores = os.cpus().length;
        } catch (error) {
          // Create specific error for OS module issue
          const osModuleErrorId = `device_info_os_module_${Date.now()}`;
          logError(new MemoryProfilerError('Failed to load OS module for device info', {
            operationId: osModuleErrorId,
            code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
            details: {
              originalError: error,
              environment: 'Node.js',
              requireAvailable: typeof require === 'function'
            }
          }));
        }
      }
    }
  } catch (error) {
    const operationId = `device_info_${Date.now()}`;
    logError(error, {
      operationId,
      details: {
        operation: 'getDeviceInfo',
        partialInfo: { ...deviceInfo },
        environment: {
          hasNavigator: typeof navigator !== 'undefined',
          hasProcess: typeof process !== 'undefined',
          hasRequire: typeof require === 'function'
        }
      },
      severity: ErrorSeverity.WARNING,
      recoverable: true
    });
  }

  return deviceInfo;
}

/**
 * Create a memory profiler for a specific operation
 * @param {string} operationId - Unique ID for the operation
 * @param {Object} options - Profiling options
 * @param {string} options.operationType - Type of operation (prove, verify, etc.)
 * @param {string} options.circuitType - Type of circuit (standard, threshold, maximum)
 * @param {number} [options.snapshotInterval=1000] - Interval between snapshots in ms
 * @returns {Object} Memory profiler object
 */
function createMemoryProfiler(operationId, options = {}) {
  const profiler = {
    operationId,
    operationType: options.operationType || 'unknown',
    circuitType: options.circuitType || 'unknown',
    snapshotInterval: options.snapshotInterval || 1000,
    snapshots: [],
    intervalId: null,
    startTime: null,
    endTime: null,
    isRunning: false,

    /**
     * Start profiling
     * @returns {Object} This profiler instance
     */
    start() {
      if (this.isRunning) {
        return this;
      }

      this.isRunning = true;
      this.startTime = Date.now();
      this.snapshots = [];

      // Take initial snapshot
      this.snapshots.push(getMemorySnapshot());

      // Set up interval for regular snapshots
      this.intervalId = setInterval(() => {
        this.snapshots.push(getMemorySnapshot());
      }, this.snapshotInterval);

      return this;
    },

    /**
     * Take a snapshot manually (in addition to automatic ones)
     * @param {string} [label] - Optional label for this snapshot
     * @returns {Object} This profiler instance
     */
    takeSnapshot(label) {
      if (!this.isRunning) {
        return this;
      }

      const snapshot = getMemorySnapshot();
      snapshot.label = label;
      this.snapshots.push(snapshot);

      return this;
    },

    /**
     * Stop profiling and calculate results
     * @returns {MemoryProfile} Memory profile result
     */
    stop() {
      if (!this.isRunning) {
        return null;
      }

      this.isRunning = false;
      this.endTime = Date.now();

      // Clear the interval
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }

      // Take final snapshot
      this.snapshots.push(getMemorySnapshot());

      // Calculate peak and average memory usage
      let totalMemory = 0;
      let peakMemory = 0;

      for (const snapshot of this.snapshots) {
        const memoryUsage = snapshot.estimatedMemoryUsage;
        totalMemory += memoryUsage;
        peakMemory = Math.max(peakMemory, memoryUsage);
      }

      const avgMemory = totalMemory / this.snapshots.length;

      // Create profile result
      const profile = {
        operationId: this.operationId,
        operationType: this.operationType,
        circuitType: this.circuitType,
        snapshots: this.snapshots,
        peakMemoryUsage: peakMemory,
        averageMemoryUsage: avgMemory,
        duration: this.endTime - this.startTime,
        startTimestamp: this.startTime,
        endTimestamp: this.endTime,
        deviceInfo: getDeviceInfo()
      };

      // Store in registry
      memoryProfiles.set(this.operationId, profile);

      return profile;
    },

    /**
     * Cancel profiling without calculating results
     */
    cancel() {
      if (!this.isRunning) {
        return;
      }

      this.isRunning = false;

      // Clear the interval
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }

      // Remove from registry if it was added
      if (memoryProfiles.has(this.operationId)) {
        memoryProfiles.delete(this.operationId);
      }
    }
  };

  return profiler;
}

/**
 * Get a stored memory profile by ID
 * @param {string} operationId - ID of the profile to retrieve
 * @returns {MemoryProfile|null} The memory profile or null if not found
 */
function getMemoryProfile(operationId) {
  return memoryProfiles.get(operationId) || null;
}

/**
 * Get all stored memory profiles
 * @returns {MemoryProfile[]} Array of all memory profiles
 */
function getAllMemoryProfiles() {
  return Array.from(memoryProfiles.values());
}

/**
 * Clear all stored memory profiles
 */
function clearMemoryProfiles() {
  memoryProfiles.clear();
}

/**
 * Compare memory usage against budget
 * @param {MemoryProfile} profile - The memory profile to check
 * @param {Object} budget - Memory budget to compare against
 * @returns {Object} Comparison result with status and details
 */
function checkMemoryBudget(profile, budget) {
  const operationId = `check_memory_budget_${Date.now()}`;
  
  try {
    // Validate inputs
    if (!profile || !budget) {
      const error = new InputError('Invalid profile or budget for memory budget check', {
        operationId,
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        severity: ErrorSeverity.WARNING,
        details: {
          profile: profile ? 'provided' : 'missing',
          budget: budget ? 'provided' : 'missing'
        }
      });
      
      logError(error);
      
      return { 
        status: 'error', 
        message: 'Invalid profile or budget',
        error: error.toLogFormat()
      };
    }

    const { operationType, circuitType, peakMemoryUsage } = profile;
    if (!operationType || !circuitType || peakMemoryUsage === undefined) {
      const error = new InputError('Invalid profile structure for memory budget check', {
        operationId,
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        severity: ErrorSeverity.WARNING,
        details: {
          hasOperationType: !!operationType,
          hasCircuitType: !!circuitType,
          hasPeakMemoryUsage: peakMemoryUsage !== undefined
        }
      });
      
      logError(error);
      
      return { 
        status: 'error', 
        message: 'Invalid profile structure',
        error: error.toLogFormat()
      };
    }
    
    const deviceType = profile.deviceInfo?.isMobile ? 'mobile' : 'desktop';

    // Determine budget for this operation and device type
    let budgetValue = 0;

    if (budget[deviceType]) {
      if (operationType === 'prove') {
        // For prove operations, use circuit-specific budget
        const proofGenKey = `${circuitType}ProofGeneration`;
        budgetValue = budget[deviceType][proofGenKey] || 0;
      } else if (operationType === 'verify') {
        budgetValue = budget[deviceType].proofVerification || 0;
      } else if (operationType === 'load') {
        budgetValue = budget[deviceType].circuitLoading || 0;
      }
    }

    if (budgetValue === 0) {
      // Log as warning since missing budget is a legitimate issue to note
      logError(new MemoryProfilerError(`No budget defined for ${operationType} operation on ${circuitType} circuit`, {
        operationId,
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        severity: ErrorSeverity.INFO,
        recoverable: true,
        details: {
          operationType,
          circuitType,
          deviceType,
          budgetStructure: JSON.stringify(budget)
        }
      }));
      
      return {
        status: 'warning',
        message: `No budget defined for ${operationType} operation on ${circuitType} circuit`,
        peakMemoryUsage,
        budget: 'undefined'
      };
    }

    // Calculate percentage of budget used
    const percentageUsed = (peakMemoryUsage / budgetValue) * 100;

    // Determine status based on usage
    let status, message;

    if (peakMemoryUsage <= budgetValue) {
      if (percentageUsed > 90) {
        status = 'warning';
        message = `Memory usage (${peakMemoryUsage}MB) is approaching budget (${budgetValue}MB)`;
        
        // Log approaching budget as warning
        logError(new MemoryProfilerError(message, {
          operationId,
          code: ErrorCode.MEMORY_LIMIT_EXCEEDED,
          severity: ErrorSeverity.WARNING,
          recoverable: true,
          details: {
            operationType,
            circuitType,
            deviceType,
            peakMemoryUsage,
            budgetValue,
            percentageUsed
          }
        }));
      } else {
        status = 'success';
        message = `Memory usage (${peakMemoryUsage}MB) is within budget (${budgetValue}MB)`;
      }
    } else {
      status = 'error';
      message = `Memory usage (${peakMemoryUsage}MB) exceeds budget (${budgetValue}MB)`;
      
      // Log exceeded budget as error
      logError(new MemoryProfilerError(message, {
        operationId,
        code: ErrorCode.MEMORY_LIMIT_EXCEEDED,
        severity: ErrorSeverity.ERROR,
        recoverable: false,
        details: {
          operationType,
          circuitType,
          deviceType,
          peakMemoryUsage,
          budgetValue,
          percentageUsed,
          excess: Math.max(0, peakMemoryUsage - budgetValue)
        }
      }));
    }

    return {
      status,
      message,
      peakMemoryUsage,
      budget: budgetValue,
      percentageUsed,
      excess: Math.max(0, peakMemoryUsage - budgetValue)
    };
  } catch (error) {
    // Handle unexpected errors in budget checking
    logError(error, {
      operationId,
      details: {
        operation: 'checkMemoryBudget',
        profile: profile ? {
          operationType: profile.operationType,
          circuitType: profile.circuitType,
          peakMemoryUsage: profile.peakMemoryUsage
        } : 'not provided',
        budget: budget ? Object.keys(budget) : 'not provided'
      }
    });
    
    return {
      status: 'error',
      message: 'Failed to check memory budget due to unexpected error',
      error: error.message
    };
  }
}

/**
 * Get memory recommendations based on profiling results
 * @param {MemoryProfile[]} profiles - Array of memory profiles to analyze
 * @returns {Object} Recommendations and insights
 */
function getMemoryRecommendations(profiles) {
  const operationId = `memory_recommendations_${Date.now()}`;
  
  try {
    // Validate input
    if (!profiles || profiles.length === 0) {
      const error = new InputError('No profiles to analyze for memory recommendations', {
        operationId,
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        severity: ErrorSeverity.INFO,
        recoverable: true,
        details: {
          profilesProvided: !!profiles,
          profileCount: profiles ? profiles.length : 0
        }
      });
      
      logError(error);
      
      return { 
        message: 'No profiles to analyze',
        error: error.toLogFormat() 
      };
    }

    // Calculate stats for each operation type
    const operationStats = {};
    const invalidProfiles = [];

    for (const profile of profiles) {
      try {
        // Validate profile structure
        if (!profile || !profile.operationType || !profile.circuitType || 
            profile.peakMemoryUsage === undefined || profile.duration === undefined) {
          invalidProfiles.push(profile);
          continue;
        }
        
        const { operationType, circuitType, peakMemoryUsage, duration } = profile;
        const key = `${operationType}-${circuitType}`;

        if (!operationStats[key]) {
          operationStats[key] = {
            operationType,
            circuitType,
            count: 0,
            totalMemory: 0,
            peakMemory: 0,
            totalDuration: 0,
            samples: []
          };
        }

        const stats = operationStats[key];
        stats.count++;
        stats.totalMemory += peakMemoryUsage;
        stats.peakMemory = Math.max(stats.peakMemory, peakMemoryUsage);
        stats.totalDuration += duration;
        stats.samples.push({ peakMemoryUsage, duration });
      } catch (profileError) {
        // Log issue with individual profile but continue processing others
        logError(profileError, {
          operationId: `${operationId}_profile_processing`,
          details: {
            operation: 'processProfile',
            profile: profile ? {
              operationType: profile.operationType,
              circuitType: profile.circuitType
            } : 'invalid profile'
          },
          severity: ErrorSeverity.WARNING,
          recoverable: true
        });
        
        invalidProfiles.push(profile);
      }
    }
    
    // Log if any profiles were invalid
    if (invalidProfiles.length > 0) {
      logError(new InputError('Some memory profiles had invalid structure', {
        operationId,
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        severity: ErrorSeverity.WARNING,
        recoverable: true,
        details: {
          validProfileCount: profiles.length - invalidProfiles.length,
          invalidProfileCount: invalidProfiles.length,
          invalidProfiles: invalidProfiles.map(p => ({
            operationType: p?.operationType,
            circuitType: p?.circuitType,
            hasMemoryUsage: p?.peakMemoryUsage !== undefined,
            hasDuration: p?.duration !== undefined
          }))
        }
      }));
    }

    // If no valid profiles after filtering, return early
    if (Object.keys(operationStats).length === 0) {
      return { 
        message: 'No valid profiles to analyze',
        validProfiles: 0,
        invalidProfiles: invalidProfiles.length
      };
    }

    // Generate recommendations based on statistics
    const recommendations = {
      operations: [],
      generalRecommendations: [],
      memoryHotspots: [],
      analysisMetadata: {
        validProfiles: profiles.length - invalidProfiles.length,
        invalidProfiles: invalidProfiles.length,
        timestamp: new Date().toISOString(),
        operationId
      }
    };

    // Convert operation stats to array and add averages
    for (const key in operationStats) {
      const stats = operationStats[key];
      stats.avgMemory = stats.totalMemory / stats.count;
      stats.avgDuration = stats.totalDuration / stats.count;
      recommendations.operations.push(stats);
    }

    // Sort operations by peak memory (highest first)
    recommendations.operations.sort((a, b) => b.peakMemory - a.peakMemory);

    // Identify memory hotspots (operations using the most memory)
    recommendations.memoryHotspots = recommendations.operations
      .filter(op => op.peakMemory > 400) // More than 400MB is considered high
      .map(op => ({
        operation: `${op.operationType} on ${op.circuitType}`,
        peakMemory: op.peakMemory,
        avgMemory: op.avgMemory,
        recommendation: `Consider optimizing ${op.operationType} operation for ${op.circuitType} circuit to reduce peak memory usage (${op.peakMemory}MB).`
      }));

    // Generate general recommendations based on observations
    if (recommendations.memoryHotspots.length > 0) {
      recommendations.generalRecommendations.push(
        "Implement progressive memory management to reduce peak memory usage in identified hotspots."
      );
    }

    // Add recommendations for circuit loading optimization if relevant
    const loadOperations = recommendations.operations.filter(op => op.operationType === 'load');
    if (loadOperations.length > 0) {
      recommendations.generalRecommendations.push(
        "Consider lazy loading of circuit artifacts to reduce initial memory impact."
      );
    }

    // Add recommendation for parallelization if machines have multiple cores
    const hasMultiCoreProfiles = profiles.some(p => p.deviceInfo?.cores && p.deviceInfo.cores > 2);
    if (hasMultiCoreProfiles) {
      recommendations.generalRecommendations.push(
        "Use Web Workers for compute-intensive operations to improve performance without increasing memory pressure."
      );
    }

    // Add recommendation for low-memory devices if any profiles are from such devices
    const hasLowMemoryProfiles = profiles.some(p =>
      p.deviceInfo?.memory && p.deviceInfo.memory < 4096 && p.deviceInfo.isMobile
    );
    if (hasLowMemoryProfiles) {
      recommendations.generalRecommendations.push(
        "Implement server-side fallback for proof generation on low-memory mobile devices."
      );
    }

    return recommendations;
  } catch (error) {
    // Handle unexpected errors in recommendation generation
    logError(error, {
      operationId,
      details: {
        operation: 'getMemoryRecommendations',
        profileCount: profiles?.length || 0
      },
      severity: ErrorSeverity.ERROR,
      recoverable: true
    });
    
    return {
      message: 'Failed to generate memory recommendations',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

export {
  createMemoryProfiler,
  getMemorySnapshot,
  getDeviceInfo,
  getMemoryProfile,
  getAllMemoryProfiles,
  clearMemoryProfiles,
  checkMemoryBudget,
  getMemoryRecommendations
};

export default {
  createMemoryProfiler,
  getMemorySnapshot,
  getDeviceInfo,
  getMemoryProfile,
  getAllMemoryProfiles,
  clearMemoryProfiles,
  checkMemoryBudget,
  getMemoryRecommendations
};