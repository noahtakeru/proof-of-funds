/**
 * Device Capabilities Detection Module (ESM Version)
 * 
 * This module provides functions to detect device capabilities such as available memory,
 * CPU cores, and WebAssembly support. It helps determine if client-side ZK operations
 * are feasible or if server-side fallback should be used.
 * 
 * @module deviceCapabilities
 */

import zkErrorLogger from './zkErrorLogger.mjs';
import { SystemError, ErrorCode, ErrorSeverity } from './zkErrorHandler.mjs';
// For Node.js environment, conditionally import os module
let osModule = null;
if (typeof process !== 'undefined' && process.versions && process.versions.node) {
  try {
    // Dynamic import of the os module
    import('os').then(os => {
      osModule = os;
    }).catch(() => {
      // Silently fail if os module can't be imported
    });
  } catch (e) {
    // Ignore errors
  }
}

/**
 * Memory threshold constants for device capability assessment
 * Defines memory thresholds to categorize devices by available memory
 * @constant {Object} MEMORY_THRESHOLDS
 * @property {number} LOW - Below this value (in MB) is considered low memory (4GB)
 * @property {number} LIMITED - Below this value (in MB) is considered limited memory (8GB)
 */
export const MEMORY_THRESHOLDS = {
  LOW: 4 * 1024,     // 4GB - below this is considered low memory
  LIMITED: 8 * 1024, // 8GB - below this is considered limited memory
};

/**
 * CPU core thresholds for device capability assessment
 * Defines CPU core thresholds to categorize devices by processing power
 * @constant {Object} CPU_THRESHOLDS
 * @property {number} LOW - Below this value is considered low CPU (2 cores)
 * @property {number} LIMITED - Below this value is considered limited CPU (4 cores)
 */
export const CPU_THRESHOLDS = {
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
 * Determines if code is running in a browser or another environment (like Node.js)
 * 
 * @returns {boolean} True if running in a browser
 */
export function isBrowserEnvironment() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Get node environment information
 * Retrieves information about the Node.js environment if applicable
 * 
 * @returns {Object|null} Node environment details or null if not in Node.js
 */
export function getNodeEnvironmentInfo() {
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
export function detectWebAssembly() {
  const operationId = `detectWebAssembly_${Date.now()}`;
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
  } catch (error) {
    const systemError = new SystemError(`Failed to detect WebAssembly support: ${error.message}`, {
      code: ErrorCode.COMPATIBILITY_WASM_UNAVAILABLE,
      severity: ErrorSeverity.WARNING,
      operationId,
      recoverable: true,
      details: { originalError: error.message }
    });

    zkErrorLogger.logError(systemError, {
      context: 'deviceCapabilities.detectWebAssembly'
    });

    return false;
  }
}

/**
 * Detect Web Crypto API support
 * Checks if the browser supports the Web Crypto API for cryptographic operations
 * 
 * @returns {boolean} True if Web Crypto API is supported
 */
export function detectWebCrypto() {
  const operationId = `detectWebCrypto_${Date.now()}`;
  try {
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
  } catch (error) {
    const systemError = new SystemError(`Failed to detect Web Crypto API support: ${error.message}`, {
      code: ErrorCode.COMPATIBILITY_API_UNAVAILABLE,
      severity: ErrorSeverity.WARNING,
      operationId,
      recoverable: true,
      details: { originalError: error.message }
    });

    zkErrorLogger.logError(systemError, {
      context: 'deviceCapabilities.detectWebCrypto'
    });

    return false;
  }
}

/**
 * Detect Web Workers support
 * Checks if the browser supports Web Workers for offloading computation
 * 
 * @returns {boolean} True if Web Workers are supported
 */
export function detectWebWorkers() {
  const operationId = `detectWebWorkers_${Date.now()}`;
  try {
    // Only available in browser
    return isBrowserEnvironment() && typeof Worker !== 'undefined';
  } catch (error) {
    const systemError = new SystemError(`Failed to detect Web Workers support: ${error.message}`, {
      code: ErrorCode.COMPATIBILITY_API_UNAVAILABLE,
      severity: ErrorSeverity.WARNING,
      operationId,
      recoverable: true,
      details: { originalError: error.message }
    });

    zkErrorLogger.logError(systemError, {
      context: 'deviceCapabilities.detectWebWorkers'
    });

    return false;
  }
}

/**
 * Detect device memory
 * Attempts to determine the amount of memory available using various browser APIs
 * 
 * @returns {number|null} Available memory in MB or null if not detectable
 */
export function detectDeviceMemory() {
  const operationId = `detectDeviceMemory_${Date.now()}`;
  try {
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
        zkErrorLogger.logError(new SystemError(`Error detecting Node.js memory: ${e.message}`, {
          code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
          severity: ErrorSeverity.WARNING,
          operationId,
          recoverable: true,
          details: { originalError: e.message }
        }), {
          context: 'deviceCapabilities.detectDeviceMemory'
        });

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
      zkErrorLogger.logError(new SystemError(`Error detecting browser memory: ${e.message}`, {
        code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
        severity: ErrorSeverity.WARNING,
        operationId,
        recoverable: true,
        details: { originalError: e.message }
      }), {
        context: 'deviceCapabilities.detectDeviceMemory'
      });

      return null;
    }
  } catch (error) {
    const systemError = new SystemError(`Failed to detect device memory: ${error.message}`, {
      code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
      severity: ErrorSeverity.WARNING,
      operationId,
      recoverable: true,
      details: { originalError: error.message }
    });

    zkErrorLogger.logError(systemError, {
      context: 'deviceCapabilities.detectDeviceMemory'
    });

    return null;
  }
}

/**
 * Detect CPU cores
 * Determines the number of CPU cores available to the browser
 * 
 * @returns {number|null} Number of CPU cores or null if not detectable
 */
export function detectCPUCores() {
  const operationId = `detectCPUCores_${Date.now()}`;
  try {
    // Node.js environment detection
    if (!isBrowserEnvironment()) {
      try {
        // Try to use Node.js os module to get CPU info
        if (osModule) {
          return osModule.cpus().length;
        }
        return null;
      } catch (e) {
        zkErrorLogger.logError(new SystemError(`Error detecting Node.js CPU cores: ${e.message}`, {
          code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
          severity: ErrorSeverity.WARNING,
          operationId,
          recoverable: true,
          details: { originalError: e.message }
        }), {
          context: 'deviceCapabilities.detectCPUCores'
        });
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
      zkErrorLogger.logError(new SystemError(`Error detecting browser CPU cores: ${e.message}`, {
        code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
        severity: ErrorSeverity.WARNING,
        operationId,
        recoverable: true,
        details: { originalError: e.message }
      }), {
        context: 'deviceCapabilities.detectCPUCores'
      });
      return null;
    }
  } catch (error) {
    const systemError = new SystemError(`Failed to detect CPU cores: ${error.message}`, {
      code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
      severity: ErrorSeverity.WARNING,
      operationId,
      recoverable: true,
      details: { originalError: error.message }
    });

    zkErrorLogger.logError(systemError, {
      context: 'deviceCapabilities.detectCPUCores'
    });

    return null;
  }
}

/**
 * Detect browser type and version
 * Identifies the browser, its version, and whether it's running on a mobile device
 * 
 * @returns {Object} Browser information with name, version, and isMobile properties
 */
export function detectBrowser() {
  const operationId = `detectBrowser_${Date.now()}`;
  try {
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
      let isMobile = false;

      // Detect mobile devices
      if (/Mobi|Android|iPhone|iPad|iPod/i.test(userAgent)) {
        isMobile = true;
      }

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
      else if (/Safari/.test(userAgent) && !/Chrome/.test(userAgent)) {
        browser = 'safari';
        version = userAgent.match(/Version\/(\d+\.\d+)/)?.[1] || 'unknown';
      }
      // Detect Edge
      else if (/Edge|Edg/.test(userAgent)) {
        browser = 'edge';
        version = userAgent.match(/Edge\/(\d+\.\d+)|Edg\/(\d+\.\d+)/)?.[1] || 'unknown';
      }
      // Detect IE
      else if (/MSIE|Trident/.test(userAgent)) {
        browser = 'ie';
        version = userAgent.match(/MSIE (\d+\.\d+)/)?.[1] ||
          (userAgent.match(/rv:(\d+\.\d+)/) && userAgent.match(/rv:(\d+\.\d+)/)[1]) ||
          'unknown';
      }

      return {
        name: browser,
        version,
        isMobile
      };
    } catch (e) {
      zkErrorLogger.logError(new SystemError(`Error detecting browser details: ${e.message}`, {
        code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
        severity: ErrorSeverity.WARNING,
        operationId,
        recoverable: true,
        details: { originalError: e.message }
      }), {
        context: 'deviceCapabilities.detectBrowser'
      });

      return {
        name: 'unknown',
        version: 'unknown',
        isMobile: false
      };
    }
  } catch (error) {
    const systemError = new SystemError(`Failed to detect browser: ${error.message}`, {
      code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
      severity: ErrorSeverity.WARNING,
      operationId,
      recoverable: true,
      details: { originalError: error.message }
    });

    zkErrorLogger.logError(systemError, {
      context: 'deviceCapabilities.detectBrowser'
    });

    return {
      name: 'unknown',
      version: 'unknown',
      isMobile: false
    };
  }
}

/**
 * Determine device class based on capabilities
 * Classifies the device as high, medium, low, or incompatible
 * 
 * @param {DeviceCapabilities} capabilities - Device capabilities object
 * @returns {string} Device class (high, medium, low, or incompatible)
 */
export function getDeviceClass(capabilities) {
  const operationId = `getDeviceClass_${Date.now()}`;
  try {
    // Check for incompatible devices
    if (!capabilities.supportsWebAssembly || !capabilities.supportsWebCrypto) {
      return 'incompatible';
    }

    // Check for low-end devices
    if (
      (capabilities.availableMemory !== null && capabilities.availableMemory < MEMORY_THRESHOLDS.LOW) ||
      (capabilities.cpuCores !== null && capabilities.cpuCores < CPU_THRESHOLDS.LOW)
    ) {
      return 'low';
    }

    // Check for medium-tier devices
    if (
      (capabilities.availableMemory !== null && capabilities.availableMemory < MEMORY_THRESHOLDS.LIMITED) ||
      (capabilities.cpuCores !== null && capabilities.cpuCores < CPU_THRESHOLDS.LIMITED) ||
      (capabilities.browser && capabilities.browser.isMobile)
    ) {
      return 'medium';
    }

    // High-end devices
    return 'high';
  } catch (error) {
    const systemError = new SystemError(`Failed to determine device class: ${error.message}`, {
      code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
      severity: ErrorSeverity.WARNING,
      operationId,
      recoverable: true,
      details: { originalError: error.message }
    });

    zkErrorLogger.logError(systemError, {
      context: 'deviceCapabilities.getDeviceClass'
    });

    // Default to medium as a safe fallback
    return 'medium';
  }
}

/**
 * Determine if server-side processing is recommended
 * Decides if the device should use server-side processing based on capabilities
 * 
 * @param {DeviceCapabilities} capabilities - Device capabilities
 * @param {string} operationType - Type of operation to perform (standard, complex)
 * @returns {boolean} True if server-side processing is recommended
 */
export function shouldUseServerSide(capabilities, operationType = 'standard') {
  const operationId = `shouldUseServerSide_${Date.now()}`;
  try {
    // If device is incompatible, use server-side
    if (capabilities.deviceClass === 'incompatible') {
      return true;
    }

    // Get memory requirements for the operation
    const memoryRequirements = getMemoryRequirements(operationType);

    // If low device, use server-side for all operations
    if (capabilities.deviceClass === 'low') {
      return true;
    }

    // If medium device, use server-side for complex operations
    if (capabilities.deviceClass === 'medium' && operationType === 'complex') {
      return true;
    }

    // If available memory is less than required for operation, use server-side
    if (
      capabilities.availableMemory !== null &&
      capabilities.availableMemory < memoryRequirements
    ) {
      return true;
    }

    // Otherwise, use client-side
    return false;
  } catch (error) {
    const systemError = new SystemError(`Failed to determine server-side processing recommendation: ${error.message}`, {
      code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
      severity: ErrorSeverity.WARNING,
      operationId,
      recoverable: true,
      details: { originalError: error.message }
    });

    zkErrorLogger.logError(systemError, {
      context: 'deviceCapabilities.shouldUseServerSide'
    });

    // Default to server-side as a safe fallback
    return true;
  }
}

/**
 * Get memory requirements for an operation
 * Returns the estimated memory requirements for different types of ZK operations
 * 
 * @param {string} operationType - Type of operation (standard, complex)
 * @returns {number} Estimated memory requirement in MB
 */
export function getMemoryRequirements(operationType = 'standard') {
  const operationId = `getMemoryRequirements_${Date.now()}`;
  try {
    // Memory requirements for different operation types
    const requirements = {
      standard: 2 * 1024, // 2GB for standard proofs
      complex: 4 * 1024,  // 4GB for complex proofs
      recursive: 8 * 1024 // 8GB for recursive proofs
    };

    return requirements[operationType] || requirements.standard;
  } catch (error) {
    const systemError = new SystemError(`Failed to get memory requirements: ${error.message}`, {
      code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
      severity: ErrorSeverity.WARNING,
      operationId,
      recoverable: true,
      details: { originalError: error.message }
    });

    zkErrorLogger.logError(systemError, {
      context: 'deviceCapabilities.getMemoryRequirements'
    });

    // Return a conservative estimate as fallback
    return 4 * 1024; // 4GB
  }
}

/**
 * Detect all device capabilities for ZK operations
 * Performs comprehensive detection of browser and hardware capabilities relevant to ZK operations
 * 
 * @returns {DeviceCapabilities} Comprehensive device capability information
 * @example
 * // Detect device capabilities to determine if complex ZK operations can be performed
 * const capabilities = detectCapabilities();
 * if (capabilities.deviceClass === 'high' && !capabilities.recommendServerSide) {
 *   // Device can handle ZK operations
 *   startZkOperations();
 * } else {
 *   // Device lacks required capabilities
 *   showServerSideFallbackOption();
 * }
 */
export function detectCapabilities() {
  const operationId = `detectCapabilities_${Date.now()}`;
  try {
    // Detect basic features
    const supportsWebAssembly = detectWebAssembly();
    const supportsWebCrypto = detectWebCrypto();
    const supportsWebWorkers = detectWebWorkers();

    // Detect hardware capabilities
    const availableMemory = detectDeviceMemory();
    const cpuCores = detectCPUCores();

    // Detect browser
    const browser = detectBrowser();

    // Determine memory status
    const hasLowMemory = availableMemory !== null && availableMemory < MEMORY_THRESHOLDS.LOW;
    const hasLimitedMemory = availableMemory !== null && availableMemory < MEMORY_THRESHOLDS.LIMITED;

    // Determine CPU status
    const hasLowCPU = cpuCores !== null && cpuCores < CPU_THRESHOLDS.LOW;

    // Create capabilities object
    const capabilities = {
      supportsWebAssembly,
      supportsWebCrypto,
      supportsWebWorkers,
      availableMemory,
      cpuCores,
      hasLowMemory,
      hasLimitedMemory,
      hasLowCPU,
      browser
    };

    // Classify device
    capabilities.deviceClass = getDeviceClass(capabilities);

    // Determine server-side recommendation
    capabilities.recommendServerSide = shouldUseServerSide(capabilities);

    // Add memory requirements
    capabilities.memoryRequirements = {
      standard: getMemoryRequirements('standard'),
      complex: getMemoryRequirements('complex'),
      recursive: getMemoryRequirements('recursive')
    };

    return capabilities;
  } catch (error) {
    const systemError = new SystemError(`Failed to detect device capabilities: ${error.message}`, {
      code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
      severity: ErrorSeverity.WARNING,
      operationId,
      recoverable: true,
      details: { originalError: error.message }
    });

    zkErrorLogger.logError(systemError, {
      context: 'deviceCapabilities.detectCapabilities'
    });

    // Return a minimal capabilities object with conservative defaults
    return {
      supportsWebAssembly: false,
      supportsWebCrypto: false,
      supportsWebWorkers: false,
      availableMemory: null,
      cpuCores: null,
      hasLowMemory: true,
      hasLimitedMemory: true,
      hasLowCPU: true,
      browser: { name: 'unknown', version: 'unknown', isMobile: false },
      deviceClass: 'incompatible',
      recommendServerSide: true,
      memoryRequirements: {
        standard: 2 * 1024,
        complex: 4 * 1024,
        recursive: 8 * 1024
      }
    };
  }
}

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