/**
 * memoryProfiler.js
 * 
 * Utilities for monitoring memory usage during ZK operations.
 */

// Collection for memory profiles
const memoryProfiles = new Map();
let nextProfileId = 1;

/**
 * Get current memory usage stats
 * 
 * @returns {Object} Memory usage in bytes
 */
function getMemoryUsage() {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    // Node.js environment
    const memoryUsage = process.memoryUsage();
    return {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      rss: memoryUsage.rss,
      external: memoryUsage.external,
      arrayBuffers: memoryUsage.arrayBuffers
    };
  } else if (typeof performance !== 'undefined' && performance.memory) {
    // Browser environment with performance.memory (Chrome)
    const memoryInfo = performance.memory;
    return {
      heapUsed: memoryInfo.usedJSHeapSize,
      heapTotal: memoryInfo.totalJSHeapSize,
      heapLimit: memoryInfo.jsHeapSizeLimit
    };
  } else {
    // Fallback for environments without memory info
    return {
      heapUsed: 0,
      heapTotal: 0,
      available: false
    };
  }
}

/**
 * Format bytes into a human-readable string
 * 
 * @param {number} bytes - Number of bytes
 * @param {number} decimals - Decimal places for formatting
 * @returns {string} Formatted string (e.g., "1.5 MB")
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Create a memory profiler
 * 
 * @param {string} name - Profiler name
 * @param {Object} options - Profiler options
 * @param {string} options.operationType - Type of operation
 * @param {string} options.circuitType - Type of circuit
 * @param {number} options.samplingIntervalMs - Memory sampling interval
 * @returns {Object} Memory profiler with start/stop methods
 */
export function createMemoryProfiler(name, options = {}) {
  // Generate a unique ID for this profile
  const profileId = `${name}-${nextProfileId++}`;
  
  // Initialize memory profile
  const memoryProfile = {
    id: profileId,
    name,
    operationType: options.operationType || 'unknown',
    circuitType: options.circuitType || 'unknown',
    startTime: 0,
    endTime: 0,
    initialMemory: null,
    finalMemory: null,
    peakMemory: {
      heapUsed: 0,
      timestamp: 0
    },
    samples: [],
    samplingIntervalMs: options.samplingIntervalMs || 1000,
    samplingIntervalId: null,
    isRunning: false,
    metadata: {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node.js',
      platform: typeof navigator !== 'undefined' ? navigator.platform : process.platform,
      timestamp: Date.now()
    }
  };
  
  // Store the profile
  memoryProfiles.set(profileId, memoryProfile);
  
  // Create the profiler object
  return {
    /**
     * Start memory profiling
     * 
     * @returns {Object} Current memory profile
     */
    start: () => {
      if (memoryProfile.isRunning) {
        return memoryProfile;
      }
      
      // Record start time
      memoryProfile.startTime = Date.now();
      memoryProfile.isRunning = true;
      
      // Get initial memory usage
      memoryProfile.initialMemory = getMemoryUsage();
      memoryProfile.peakMemory = {
        heapUsed: memoryProfile.initialMemory.heapUsed,
        timestamp: memoryProfile.startTime
      };
      
      // Add first sample
      memoryProfile.samples.push({
        timestamp: memoryProfile.startTime,
        memory: memoryProfile.initialMemory
      });
      
      // Start sampling interval
      memoryProfile.samplingIntervalId = setInterval(() => {
        if (!memoryProfile.isRunning) {
          clearInterval(memoryProfile.samplingIntervalId);
          return;
        }
        
        const currentMemory = getMemoryUsage();
        const timestamp = Date.now();
        
        // Add sample
        memoryProfile.samples.push({
          timestamp,
          memory: currentMemory
        });
        
        // Update peak memory if necessary
        if (currentMemory.heapUsed > memoryProfile.peakMemory.heapUsed) {
          memoryProfile.peakMemory = {
            heapUsed: currentMemory.heapUsed,
            timestamp
          };
        }
      }, memoryProfile.samplingIntervalMs);
      
      return memoryProfile;
    },
    
    /**
     * Stop memory profiling
     * 
     * @param {Object} additionalData - Additional data to include
     * @returns {Object} Final memory profile
     */
    stop: (additionalData = {}) => {
      if (!memoryProfile.isRunning) {
        return memoryProfile;
      }
      
      // Record end time
      memoryProfile.endTime = Date.now();
      memoryProfile.isRunning = false;
      
      // Get final memory usage
      memoryProfile.finalMemory = getMemoryUsage();
      
      // Add final sample
      memoryProfile.samples.push({
        timestamp: memoryProfile.endTime,
        memory: memoryProfile.finalMemory
      });
      
      // Clear sampling interval
      if (memoryProfile.samplingIntervalId) {
        clearInterval(memoryProfile.samplingIntervalId);
        memoryProfile.samplingIntervalId = null;
      }
      
      // Calculate memory usage metrics
      const memoryUsed = memoryProfile.finalMemory.heapUsed - memoryProfile.initialMemory.heapUsed;
      const peakMemoryUsed = memoryProfile.peakMemory.heapUsed - memoryProfile.initialMemory.heapUsed;
      
      // Add memory metrics
      memoryProfile.memoryMetrics = {
        initialHeapUsed: memoryProfile.initialMemory.heapUsed,
        finalHeapUsed: memoryProfile.finalMemory.heapUsed,
        peakHeapUsed: memoryProfile.peakMemory.heapUsed,
        memoryUsed,
        peakMemoryUsed,
        memoryUsedFormatted: formatBytes(memoryUsed),
        peakMemoryUsedFormatted: formatBytes(peakMemoryUsed),
        duration: memoryProfile.endTime - memoryProfile.startTime
      };
      
      // Add any additional data
      memoryProfile.additionalData = additionalData;
      
      return memoryProfile;
    },
    
    /**
     * Force a memory sample to be taken
     * 
     * @returns {Object} Current memory sample
     */
    takeSample: () => {
      if (!memoryProfile.isRunning) {
        return null;
      }
      
      const currentMemory = getMemoryUsage();
      const timestamp = Date.now();
      
      // Add sample
      const sample = {
        timestamp,
        memory: currentMemory
      };
      
      memoryProfile.samples.push(sample);
      
      // Update peak memory if necessary
      if (currentMemory.heapUsed > memoryProfile.peakMemory.heapUsed) {
        memoryProfile.peakMemory = {
          heapUsed: currentMemory.heapUsed,
          timestamp
        };
      }
      
      return sample;
    },
    
    /**
     * Get the profile ID
     * 
     * @returns {string} Profile ID
     */
    getId: () => profileId,
    
    /**
     * Check if profiling is running
     * 
     * @returns {boolean} True if profiling is active
     */
    isRunning: () => memoryProfile.isRunning
  };
}

/**
 * Get memory profile results
 * 
 * @param {string} profileId - ID of the profile (optional)
 * @returns {Object|Array} Memory profile results
 */
export function getMemoryProfile(profileId) {
  if (profileId) {
    return memoryProfiles.get(profileId);
  }
  
  // Return all profiles as an array
  return Array.from(memoryProfiles.values());
}

/**
 * Clear all memory profiles
 */
export function clearMemoryProfiles() {
  // Ensure all profiling intervals are stopped
  for (const profile of memoryProfiles.values()) {
    if (profile.isRunning && profile.samplingIntervalId) {
      clearInterval(profile.samplingIntervalId);
    }
  }
  
  memoryProfiles.clear();
}

/**
 * Get current memory status
 * 
 * @returns {Object} Current memory status
 */
export function getCurrentMemoryStatus() {
  const memory = getMemoryUsage();
  
  return {
    ...memory,
    heapUsedFormatted: formatBytes(memory.heapUsed),
    heapTotalFormatted: memory.heapTotal ? formatBytes(memory.heapTotal) : 'N/A',
    heapLimitFormatted: memory.heapLimit ? formatBytes(memory.heapLimit) : 'N/A',
    timestamp: Date.now()
  };
}

export default {
  createMemoryProfiler,
  getMemoryProfile,
  clearMemoryProfiles,
  getCurrentMemoryStatus,
  formatBytes
};