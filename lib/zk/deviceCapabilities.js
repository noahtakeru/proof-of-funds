/**
 * deviceCapabilities.js - Detects device capabilities for ZK operations
 * 
 * This module provides functions to detect device capabilities such as available memory,
 * CPU cores, and WebAssembly support. It helps determine if client-side ZK operations
 * are feasible or if server-side fallback should be used.
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This module acts as a device inspector that evaluates whether a user's device is
 * powerful enough to run complex privacy calculations locally. Think of it like:
 * 
 * 1. FITNESS TEST: Similar to how a doctor assesses if someone can safely run a marathon,
 *    this system checks if a device can handle computationally intensive operations by
 *    measuring available memory, processing power, and browser capabilities.
 * 
 * 2. SMART ROUTER: Like a GPS that routes you around traffic jams, this system
 *    automatically redirects complex calculations to a server when a device lacks
 *    the necessary capabilities, ensuring a smooth user experience regardless of device.
 * 
 * 3. RESOURCE ESTIMATOR: Similar to how video games display system requirements,
 *    this system assesses what operations are feasible on the current device and
 *    provides appropriate guidance.
 * 
 * 4. COMPATIBILITY CHECKER: Like how streaming services check if your device supports
 *    HD content, this system verifies if the necessary technical features for secure
 *    calculations are available in the user's browser.
 * 
 * Business value: Prevents frustrating crashes or slowdowns during financial verification
 * processes, ensures consistent user experience across different devices, optimizes resource
 * usage by running operations where they perform best, and increases successful completion
 * rates of verification operations.
 * 
 * Version: 1.0.0
 */

// Memory thresholds (in MB)
const MEMORY_THRESHOLDS = {
  LOW: 4 * 1024,     // 4GB - below this is considered low memory
  LIMITED: 8 * 1024, // 8GB - below this is considered limited memory
};

// CPU core thresholds
const CPU_THRESHOLDS = {
  LOW: 2,     // Below 2 cores is considered low
  LIMITED: 4, // Below 4 cores is considered limited
};

/**
 * Device capability result structure
 * @typedef {Object} DeviceCapabilities
 * @property {boolean} supportsWebAssembly - Whether the device supports WebAssembly
 * @property {boolean} supportsWebCrypto - Whether the device supports Web Crypto API
 * @property {boolean} supportsWebWorkers - Whether the device supports Web Workers
 * @property {number|null} availableMemory - Available memory in MB (if detectable)
 * @property {number|null} cpuCores - Number of CPU cores (if detectable)
 * @property {boolean} hasLowMemory - Whether the device has low memory
 * @property {boolean} hasLimitedMemory - Whether the device has limited memory
 * @property {boolean} hasLowCPU - Whether the device has low CPU
 * @property {string} deviceClass - Classification of device as 'high', 'medium', 'low', or 'incompatible' based on capabilities
 * @property {boolean} recommendServerSide - Whether server-side processing is recommended based on the device's capabilities
 * @property {Object} memoryRequirements - Memory requirements for different operations
 */

/**
 * Check if running in a browser environment
 * 
 * @returns {boolean} True if running in a browser
 */
function isBrowserEnvironment() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Get node environment information
 * 
 * @returns {Object} Node environment details
 */
function getNodeEnvironmentInfo() {
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    return {
      name: 'node',
      version: process.versions.node,
      isNode: true
    };
  }
  return null;
}

/**
 * Detect WebAssembly support
 * Checks if the browser supports WebAssembly and can instantiate a minimal module
 * 
 * @returns {boolean} True if WebAssembly is supported
 */
function detectWebAssembly() {
  try {
    // Check for basic WebAssembly support
    if (typeof WebAssembly !== 'object') {
      return false;
    }

    // Check if WebAssembly can be instantiated
    const module = new WebAssembly.Module(
      new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00])
    );
    const instance = new WebAssembly.Instance(module);
    return typeof instance === 'object';
  } catch (e) {
    return false;
  }
}

/**
 * Detect Web Crypto API support
 * Checks if the browser supports the Web Crypto API for cryptographic operations
 * 
 * @returns {boolean} True if Web Crypto API is supported
 */
function detectWebCrypto() {
  // Node.js crypto module
  if (!isBrowserEnvironment() && typeof crypto !== 'undefined') {
    return true;
  }
  
  // Browser Web Crypto API
  return !!(
    typeof window !== 'undefined' &&
    window.crypto &&
    window.crypto.subtle
  );
}

/**
 * Detect Web Workers support
 * Checks if the browser supports Web Workers for offloading computation
 * 
 * @returns {boolean} True if Web Workers are supported
 */
function detectWebWorkers() {
  // Only available in browser
  return isBrowserEnvironment() && typeof Worker !== 'undefined';
}

/**
 * Detect device memory
 * Attempts to determine the amount of memory available using various browser APIs
 * 
 * @returns {number|null} Available memory in MB or null if not detectable
 */
function detectDeviceMemory() {
  // Node.js environment detection
  if (!isBrowserEnvironment()) {
    try {
      // Try to use Node.js os module to get memory info
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const memoryUsage = process.memoryUsage();
        return Math.round(memoryUsage.heapTotal / (1024 * 1024));
      }
      return null;
    } catch (e) {
      console.warn('Error detecting Node.js memory:', e);
      return null;
    }
  }
  
  // Browser environment detection
  try {
    // Use navigator.deviceMemory if available (Chrome, Edge)
    if (navigator && navigator.deviceMemory) {
      // navigator.deviceMemory returns memory in GB, convert to MB
      return navigator.deviceMemory * 1024;
    }

    // Use performance.memory if available (Chrome)
    if (
      performance &&
      performance.memory &&
      performance.memory.jsHeapSizeLimit
    ) {
      // Convert bytes to MB
      return Math.round(performance.memory.jsHeapSizeLimit / (1024 * 1024));
    }

    // If we can't detect memory, return null
    return null;
  } catch (e) {
    console.warn('Error detecting device memory:', e);
    return null;
  }
}

/**
 * Detect CPU cores
 * Determines the number of CPU cores available to the browser
 * 
 * @returns {number|null} Number of CPU cores or null if not detectable
 */
function detectCPUCores() {
  // Node.js environment detection
  if (!isBrowserEnvironment()) {
    try {
      // Try to use Node.js os module to get CPU info
      if (typeof require === 'function') {
        try {
          const os = require('os');
          return os.cpus().length;
        } catch (e) {
          return null;
        }
      }
      return null;
    } catch (e) {
      console.warn('Error detecting Node.js CPU cores:', e);
      return null;
    }
  }
  
  // Browser environment detection
  try {
    if (navigator && navigator.hardwareConcurrency) {
      return navigator.hardwareConcurrency;
    }

    // If we can't detect CPU cores, return null
    return null;
  } catch (e) {
    console.warn('Error detecting CPU cores:', e);
    return null;
  }
}

/**
 * Detect browser type and version
 * Identifies the browser, its version, and whether it's running on a mobile device
 * 
 * @returns {Object} Browser information with name, version, and isMobile properties
 */
function detectBrowser() {
  // Node.js environment detection
  if (!isBrowserEnvironment()) {
    const nodeInfo = getNodeEnvironmentInfo();
    if (nodeInfo) {
      return {
        name: nodeInfo.name,
        version: nodeInfo.version,
        isMobile: false,
        isNode: true
      };
    }
    
    return {
      name: 'unknown',
      version: 'unknown',
      isMobile: false,
      isNode: true
    };
  }
  
  // Browser environment detection
  try {
    const userAgent = navigator.userAgent;
    let browser = 'unknown';
    let version = 'unknown';

    // Detect Chrome
    if (/Chrome/.test(userAgent) && !/Chromium|Edge|Edg/.test(userAgent)) {
      browser = 'chrome';
      version = userAgent.match(/Chrome\/(\d+\.\d+)/)?.[1] || 'unknown';
    }
    // Detect Firefox
    else if (/Firefox/.test(userAgent)) {
      browser = 'firefox';
      version = userAgent.match(/Firefox\/(\d+\.\d+)/)?.[1] || 'unknown';
    }
    // Detect Safari
    else if (/Safari/.test(userAgent) && !/Chrome|Chromium|Edge|Edg/.test(userAgent)) {
      browser = 'safari';
      version = userAgent.match(/Version\/(\d+\.\d+)/)?.[1] || 'unknown';
    }
    // Detect Edge (new Chromium-based)
    else if (/Edg/.test(userAgent)) {
      browser = 'edge';
      version = userAgent.match(/Edg\/(\d+\.\d+)/)?.[1] || 'unknown';
    }
    // Detect IE
    else if (/Trident/.test(userAgent)) {
      browser = 'ie';
      version = userAgent.match(/rv:(\d+\.\d+)/)?.[1] || 'unknown';
    }

    // Detect if mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

    return {
      name: browser,
      version,
      isMobile,
      isNode: false
    };
  } catch (e) {
    console.warn('Error detecting browser:', e);
    return {
      name: 'unknown',
      version: 'unknown',
      isMobile: false,
      isNode: false
    };
  }
}

/**
 * Get device class based on capabilities
 * Categorizes the device based on its capabilities into high, medium, low, or incompatible
 * 
 * @param {Object} capabilities - Device capabilities
 * @returns {string} Device class: 'high', 'medium', 'low', or 'incompatible'
 */
function getDeviceClass(capabilities) {
  // If essential features are not supported, device is incompatible
  if (!capabilities.supportsWebAssembly || !capabilities.supportsWebCrypto) {
    return 'incompatible';
  }

  // High-end device: good memory, cores, and all features
  if (
    !capabilities.hasLowMemory &&
    !capabilities.hasLimitedMemory &&
    !capabilities.hasLowCPU &&
    capabilities.supportsWebWorkers
  ) {
    return 'high';
  }

  // Low-end device: low memory or CPU
  if (capabilities.hasLowMemory || capabilities.hasLowCPU) {
    return 'low';
  }

  // Medium device: limited memory or limited CPU
  return 'medium';
}

/**
 * Determine if server-side processing is recommended
 * Based on device capabilities, decides if operations should be offloaded to server
 * 
 * @param {Object} capabilities - Device capabilities
 * @param {string} operationType - Type of operation ('standard', 'threshold', 'maximum')
 * @returns {boolean} True if server-side processing is recommended
 */
function shouldUseServerSide(capabilities, operationType) {
  // If device is incompatible, always use server-side
  if (capabilities.deviceClass === 'incompatible') {
    return true;
  }

  // If device is low-end, use server-side for all operations
  if (capabilities.deviceClass === 'low') {
    return true;
  }

  // For medium devices, use server-side for more complex operations
  if (capabilities.deviceClass === 'medium') {
    // Standard proof might be ok on medium devices
    if (operationType === 'standard' && !capabilities.hasLowMemory) {
      return false;
    }
    // All other operations should use server-side
    return true;
  }

  // For high-end devices, client-side is generally ok
  return false;
}

/**
 * Estimate memory requirements for an operation
 * Calculates estimated memory needed for different proof types
 * 
 * @param {string} operationType - Type of operation ('standard', 'threshold', 'maximum')
 * @returns {Object} Memory requirements in MB
 */
function getMemoryRequirements(operationType) {
  switch (operationType) {
    case 'standard':
      return { proving: 300, verifying: 100 };
    case 'threshold':
      return { proving: 400, verifying: 150 };
    case 'maximum':
      return { proving: 400, verifying: 150 };
    case 'batch':
      return { proving: 600, verifying: 200 };
    default:
      return { proving: 500, verifying: 200 };
  }
}

/**
 * Detect all device capabilities
 * Performs comprehensive detection of browser and hardware capabilities
 * 
 * @returns {DeviceCapabilities} Comprehensive device capability information
 */
function detectCapabilities() {
  // Check for Node.js environment
  const isInBrowser = isBrowserEnvironment();
  
  if (!isInBrowser) {
    // Return simplified capabilities for Node.js
    const nodeInfo = getNodeEnvironmentInfo();
    return {
      supportsWebAssembly: typeof WebAssembly !== 'undefined',
      supportsWebCrypto: typeof crypto !== 'undefined',
      supportsWebWorkers: false, // Web Workers not available in Node.js
      availableMemory: detectDeviceMemory(),
      cpuCores: detectCPUCores(),
      hasLowMemory: false, // Default to false for Node.js
      hasLimitedMemory: false, // Default to false for Node.js
      hasLowCPU: false, // Default to false for Node.js
      browser: {
        name: nodeInfo ? nodeInfo.name : 'node',
        version: nodeInfo ? nodeInfo.version : 'unknown',
        isMobile: false,
        isNode: true
      },
      deviceClass: 'node',
      recommendServerSide: true, // In Node.js, always recommend server-side processing
      memoryRequirements: getMemoryRequirements('standard'),
      isNode: true
    };
  }
  
  // Detect hardware capabilities
  const availableMemory = detectDeviceMemory();
  const cpuCores = detectCPUCores();

  // Detect browser features
  const supportsWebAssembly = detectWebAssembly();
  const supportsWebCrypto = detectWebCrypto();
  const supportsWebWorkers = detectWebWorkers();
  const browserInfo = detectBrowser();

  // Determine memory/CPU constraints
  const hasLowMemory = availableMemory !== null && availableMemory < MEMORY_THRESHOLDS.LOW;
  const hasLimitedMemory = availableMemory !== null && availableMemory < MEMORY_THRESHOLDS.LIMITED;
  const hasLowCPU = cpuCores !== null && cpuCores < CPU_THRESHOLDS.LOW;

  // Build capability object
  const capabilities = {
    supportsWebAssembly,
    supportsWebCrypto,
    supportsWebWorkers,
    availableMemory,
    cpuCores,
    hasLowMemory,
    hasLimitedMemory,
    hasLowCPU,
    browser: browserInfo,
    isNode: false
  };

  // Determine device class based on capabilities
  capabilities.deviceClass = getDeviceClass(capabilities);

  // Determine if server-side processing is recommended
  capabilities.recommendServerSide = shouldUseServerSide(capabilities, 'standard');

  // Add memory requirements
  capabilities.memoryRequirements = getMemoryRequirements('standard');

  return capabilities;
}

// Export all functions
module.exports = {
  detectCapabilities,
  detectWebAssembly,
  detectWebCrypto,
  detectWebWorkers,
  detectDeviceMemory,
  detectCPUCores,
  detectBrowser,
  getDeviceClass,
  shouldUseServerSide,
  getMemoryRequirements,
  isBrowserEnvironment,
  getNodeEnvironmentInfo,
  MEMORY_THRESHOLDS,
  CPU_THRESHOLDS
};

export default {
  detectCapabilities,
  detectWebAssembly,
  detectWebCrypto,
  detectWebWorkers,
  detectDeviceMemory,
  detectCPUCores,
  detectBrowser,
  getDeviceClass,
  shouldUseServerSide,
  getMemoryRequirements,
  isBrowserEnvironment,
  getNodeEnvironmentInfo,
  MEMORY_THRESHOLDS,
  CPU_THRESHOLDS
};