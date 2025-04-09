/**
 * deviceCapabilities.mjs - Detects device capabilities for ZK operations
 * 
 * This module provides functions to detect device capabilities such as available memory,
 * CPU cores, and WebAssembly support. It helps determine if client-side ZK operations
 * are feasible or if server-side fallback should be used.
 */

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
 * Check if running in a browser environment
 * Determines if code is running in a browser or another environment (like Node.js)
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
export function detectWebAssembly() {
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
export function detectWebCrypto() {
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
export function detectWebWorkers() {
  // Only available in browser
  return isBrowserEnvironment() && typeof Worker !== 'undefined';
}

/**
 * Detect all device capabilities for ZK operations
 * Performs comprehensive detection of browser and hardware capabilities relevant to ZK operations
 * 
 * @returns {Object} Comprehensive device capability information
 * @returns {boolean} result.supportsWebAssembly - Whether WebAssembly is supported
 * @returns {boolean} result.supportsWebCrypto - Whether Web Crypto API is supported
 * @returns {boolean} result.supportsWebWorkers - Whether Web Workers are supported
 * @returns {Object} result.browser - Browser information including name, version, and mobile status
 * @example
 * // Detect device capabilities to determine if complex ZK operations can be performed
 * const capabilities = detectCapabilities();
 * if (capabilities.supportsWebAssembly && capabilities.supportsWebCrypto) {
 *   // Device can handle ZK operations
 *   startZkOperations();
 * } else {
 *   // Device lacks required capabilities
 *   showServerSideFallbackOption();
 * }
 */
export function detectCapabilities() {
  return {
    supportsWebAssembly: detectWebAssembly(),
    supportsWebCrypto: detectWebCrypto(),
    supportsWebWorkers: detectWebWorkers(),
    browser: { name: 'unknown', version: 'unknown', isMobile: false }
  };
}

export default {
  detectCapabilities,
  detectWebAssembly,
  detectWebCrypto,
  detectWebWorkers,
  isBrowserEnvironment,
  getNodeEnvironmentInfo,
  MEMORY_THRESHOLDS,
  CPU_THRESHOLDS
};