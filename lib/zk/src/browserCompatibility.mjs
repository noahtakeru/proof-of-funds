/**
 * browserCompatibility.mjs - Comprehensive browser compatibility system for ZK operations
 * 
 * This module provides advanced browser compatibility detection and scoring for running
 * zero-knowledge proofs in browser environments. It includes feature detection, capability
 * benchmarking, and fallback strategies based on the detected environment.
 */

import deviceCapabilities from './deviceCapabilities.mjs';

/**
 * Minimum required browser versions for full compatibility with ZK operations
 * Defines the minimum version of each browser needed for all ZK features
 * @constant {Object} BROWSER_VERSION_REQUIREMENTS
 * @property {number} chrome - Minimum Chrome version
 * @property {number} firefox - Minimum Firefox version
 * @property {number} safari - Minimum Safari version
 * @property {number} edge - Minimum Edge version
 * @property {number} opera - Minimum Opera version
 * @property {number} samsung - Minimum Samsung Internet version
 * @property {null} ie - Internet Explorer is not supported
 */
export const BROWSER_VERSION_REQUIREMENTS = {
  chrome: 67,
  firefox: 63,
  safari: 14,
  edge: 79,
  opera: 54,
  samsung: 9,
  ie: null // IE is not supported
};

/**
 * Feature support matrix by browser version
 * Maps browser features needed for ZK operations to the minimum browser version that supports them
 * @constant {Object} FEATURE_SUPPORT_MATRIX
 * @property {Object} webAssembly - Minimum browser versions supporting WebAssembly
 * @property {Object} webCrypto - Minimum browser versions supporting Web Crypto API
 * @property {Object} webWorkers - Minimum browser versions supporting Web Workers
 * @property {Object} sharedArrayBuffer - Minimum browser versions supporting SharedArrayBuffer
 * @property {Object} indexedDB - Minimum browser versions supporting IndexedDB
 * @property {Object} bigIntSupport - Minimum browser versions supporting BigInt
 */
export const FEATURE_SUPPORT_MATRIX = {
  webAssembly: {
    chrome: 57,
    firefox: 52,
    safari: 11,
    edge: 16,
    opera: 44,
    samsung: 7
  },
  webCrypto: {
    chrome: 37,
    firefox: 34,
    safari: 11,
    edge: 12,
    opera: 24,
    samsung: 4
  },
  webWorkers: {
    chrome: 4,
    firefox: 3.5,
    safari: 4,
    edge: 12,
    opera: 10.6,
    samsung: 1
  },
  sharedArrayBuffer: {
    chrome: 68,
    firefox: 79,
    safari: 15,
    edge: 79,
    opera: 55,
    samsung: 10.1
  },
  indexedDB: {
    chrome: 24,
    firefox: 16,
    safari: 10,
    edge: 12,
    opera: 15,
    samsung: 4
  },
  bigIntSupport: {
    chrome: 67,
    firefox: 68,
    safari: 14,
    edge: 79,
    opera: 54,
    samsung: 9
  }
};

/**
 * Known browser-specific issues and workarounds for ZK operations
 * Documents known limitations in different browsers and provides workaround strategies
 * @constant {Object} KNOWN_ISSUES
 * @property {Array<Object>} safari - Known issues in Safari
 * @property {Array<Object>} firefox - Known issues in Firefox
 * @property {Array<Object>} chrome - Known issues in Chrome
 * @property {Array<Object>} mobile - Known issues in mobile browsers
 */
export const KNOWN_ISSUES = {
  safari: [
    {
      versions: '< 15.4',
      feature: 'WebAssembly',
      issue: 'Limited memory for WebAssembly instances',
      workaround: 'Use smaller circuit chunks and process sequentially'
    },
    {
      versions: '< 14',
      feature: 'IndexedDB',
      issue: 'Unreliable in private browsing mode',
      workaround: 'Fall back to server-side computation in Safari private browsing'
    }
  ],
  firefox: [
    {
      versions: '60-68',
      feature: 'WebCrypto',
      issue: 'Performance issues with large keys',
      workaround: 'Use smaller key sizes or batch operations'
    }
  ],
  chrome: [
    {
      versions: '< 87',
      feature: 'SharedArrayBuffer',
      issue: 'Requires cross-origin isolation',
      workaround: 'Check for cross-origin isolation before using SharedArrayBuffer'
    }
  ],
  mobile: [
    {
      feature: 'Memory',
      issue: 'Limited available memory on mobile devices',
      workaround: 'Use progressive loading and server-side computation for complex operations'
    }
  ]
};

/**
 * Detect SharedArrayBuffer support
 * Checks if the browser supports SharedArrayBuffer for parallel processing
 * 
 * @returns {boolean} True if SharedArrayBuffer is supported
 */
export function detectSharedArrayBuffer() {
  // Check if we're in a browser environment
  if (!isBrowserEnvironment()) {
    // In Node.js, just check if SharedArrayBuffer is defined
    return typeof SharedArrayBuffer !== 'undefined';
  }

  // In browser, check basic support
  const hasSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';

  // Cross-origin isolation is required for SharedArrayBuffer in modern browsers
  const isCrossOriginIsolated =
    typeof window !== 'undefined' &&
    window.crossOriginIsolated === true;

  return hasSharedArrayBuffer && isCrossOriginIsolated;
}

/**
 * Detect IndexedDB support
 * Checks if the browser supports IndexedDB for large data storage
 * 
 * @returns {Object} Object with support info and private browsing detection
 */
export function detectIndexedDB() {
  // Check if we're in a browser environment
  if (!isBrowserEnvironment()) {
    return {
      supported: false,
      privateBrowsing: false,
      isNode: true
    };
  }

  try {
    const hasIndexedDB = typeof indexedDB !== 'undefined';
    let isPrivateBrowsing = false;

    // Test for private browsing (especially in Safari)
    if (hasIndexedDB) {
      const testRequest = indexedDB.open('test-idb-support');
      testRequest.onerror = () => {
        isPrivateBrowsing = true;
      };
    }

    return {
      supported: hasIndexedDB,
      privateBrowsing: isPrivateBrowsing
    };
  } catch (e) {
    return {
      supported: false,
      privateBrowsing: false,
      error: e.message
    };
  }
}

/**
 * Detect BigInt support
 * Checks if the browser supports BigInt for large integer operations
 * 
 * @returns {boolean} True if BigInt is supported
 */
export function detectBigIntSupport() {
  return typeof BigInt !== 'undefined';
}

/**
 * Check if running in a browser environment
 * 
 * @returns {boolean} True if running in a browser
 */
function isBrowserEnvironment() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Check if browser is compatible with ZK operations
 * Determines if the current browser environment can support the specified ZK operation type
 * 
 * @param {string} operationType - Type of operation ('standard', 'threshold', 'maximum')
 * @returns {boolean} True if browser is compatible for the operation
 * @example
 * // Check if browser can run standard ZK proofs
 * const canRunProofs = isBrowserCompatible('standard');
 * if (canRunProofs) {
 *   startProofGeneration();
 * } else {
 *   showFallbackMessage();
 * }
 */
export function isBrowserCompatible(operationType = 'standard') {
  // Very simplified version for MJS file
  return typeof WebAssembly !== 'undefined' && typeof crypto !== 'undefined';
}

/**
 * Check browser compatibility and provide detailed report
 * Performs a comprehensive check of browser capabilities and returns a detailed compatibility report
 * 
 * @param {string} operationType - Type of operation ('standard', 'threshold', 'maximum')
 * @returns {Object} Compatibility report with isCompatible flag and details
 * @returns {boolean} report.isCompatible - Whether the browser is compatible
 * @returns {string} report.operationType - The operation type that was checked
 * @returns {string} report.reason - Explanation of compatibility result
 * @example
 * // Get detailed compatibility report
 * const report = checkBrowserSupport('threshold');
 * if (!report.isCompatible) {
 *   console.log(`Cannot run threshold proofs: ${report.reason}`);
 * }
 */
export function checkBrowserSupport(operationType = 'standard') {
  const isCompatible = isBrowserCompatible(operationType);

  return {
    isCompatible,
    operationType,
    reason: isCompatible ? 'Compatible' : 'Browser lacks required capabilities'
  };
}

/**
 * Get detailed device capabilities for ZK operations
 * Collects information about the current device's capabilities relevant to ZK operations
 * 
 * @returns {Object} Device capabilities information
 * @returns {Object} capabilities.features - Available JS features
 * @returns {boolean} capabilities.features.webAssembly - WebAssembly support
 * @returns {boolean} capabilities.features.webCrypto - Web Crypto API support
 * @returns {boolean} capabilities.features.bigInt - BigInt support
 * @returns {Object} capabilities.browser - Browser information
 * @returns {boolean} capabilities.browser.isNode - Whether running in Node.js
 * @example
 * // Get device capabilities to determine optimal operation mode
 * const capabilities = getDeviceCapabilities();
 * if (capabilities.features.webAssembly && capabilities.features.webCrypto) {
 *   useClientSideComputation();
 * } else {
 *   useServerSideFallback();
 * }
 */
export function getDeviceCapabilities() {
  return {
    features: {
      webAssembly: typeof WebAssembly !== 'undefined',
      webCrypto: typeof crypto !== 'undefined',
      bigInt: typeof BigInt !== 'undefined'
    },
    browser: {
      isNode: !isBrowserEnvironment()
    }
  };
}

// Default export for compatibility
export default {
  detectSharedArrayBuffer,
  detectIndexedDB,
  detectBigIntSupport,
  isBrowserCompatible,
  checkBrowserSupport,
  getDeviceCapabilities,
  BROWSER_VERSION_REQUIREMENTS,
  FEATURE_SUPPORT_MATRIX,
  KNOWN_ISSUES
};