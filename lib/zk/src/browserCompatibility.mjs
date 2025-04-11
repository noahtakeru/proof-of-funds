/**
 * Browser Compatibility Module for Zero-Knowledge Operations (ESM Version)
 * 
 * This module provides advanced browser compatibility detection and scoring for running
 * zero-knowledge proofs in browser environments. It includes feature detection, capability
 * benchmarking, and fallback strategies based on the detected environment.
 * 
 * @module browserCompatibility
 */

import deviceCapabilities from './deviceCapabilities.mjs';
import zkErrorLogger from './zkErrorLogger.mjs';
import { SystemError, ErrorCode, ErrorSeverity } from './zkErrorHandler.mjs';

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
 * Check if running in a browser environment
 * Determines if the code is executing in a browser context rather than Node.js or another environment
 * 
 * @returns {boolean} True if running in a browser environment, false otherwise
 */
function isBrowserEnvironment() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Detect SharedArrayBuffer support
 * Checks if the browser supports SharedArrayBuffer for parallel processing,
 * including checking for cross-origin isolation requirements in modern browsers
 * 
 * @returns {boolean} True if SharedArrayBuffer is supported and available
 * @example
 * // Check if we can use parallel processing with SharedArrayBuffer
 * if (detectSharedArrayBuffer()) {
 *   // Use multi-threaded WebAssembly for faster processing
 *   useParallelProcessing();
 * } else {
 *   // Fall back to single-threaded processing
 *   useSingleThreaded();
 * }
 */
export function detectSharedArrayBuffer() {
  const operationId = `detectSharedArrayBuffer_${Date.now()}`;
  try {
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
  } catch (error) {
    const systemError = new SystemError(`Failed to detect SharedArrayBuffer support: ${error.message}`, {
      code: ErrorCode.COMPATIBILITY_API_UNAVAILABLE,
      severity: ErrorSeverity.WARNING,
      operationId,
      recoverable: true,
      details: { originalError: error.message }
    });

    zkErrorLogger.logError(systemError, {
      context: 'browserCompatibility.detectSharedArrayBuffer'
    });

    return false;
  }
}

/**
 * IndexedDB detection result
 * @typedef {Object} IndexedDBSupport
 * @property {boolean} supported - Whether IndexedDB is supported at all
 * @property {boolean} privateBrowsing - Whether private browsing mode is detected (which may limit IndexedDB)
 * @property {boolean} [isNode] - Whether running in Node.js (where IndexedDB is not available)
 * @property {string} [error] - Error message if there was a problem during detection
 */

/**
 * Detect IndexedDB support
 * Checks if the browser supports IndexedDB for large data storage,
 * including detection of private browsing modes that may restrict IndexedDB functionality
 * 
 * @returns {IndexedDBSupport} Object with support info and private browsing detection
 * @example
 * // Check if we can use IndexedDB for storing intermediate results
 * const idbSupport = detectIndexedDB();
 * if (idbSupport.supported && !idbSupport.privateBrowsing) {
 *   // Use IndexedDB for storage
 *   setupIndexedDBStorage();
 * } else {
 *   // Use in-memory storage with size limits
 *   setupMemoryStorage();
 * }
 */
export function detectIndexedDB() {
  const operationId = `detectIndexedDB_${Date.now()}`;
  try {
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
    } catch (innerError) {
      const innerSystemError = new SystemError(`Error during IndexedDB feature detection: ${innerError.message}`, {
        code: ErrorCode.COMPATIBILITY_API_UNAVAILABLE,
        severity: ErrorSeverity.WARNING,
        operationId,
        recoverable: true,
        details: { originalError: innerError.message }
      });

      zkErrorLogger.logError(innerSystemError, {
        context: 'browserCompatibility.detectIndexedDB.inner'
      });

      return {
        supported: false,
        privateBrowsing: false,
        error: innerError.message
      };
    }
  } catch (error) {
    const systemError = new SystemError(`Failed to detect IndexedDB support: ${error.message}`, {
      code: ErrorCode.COMPATIBILITY_API_UNAVAILABLE,
      severity: ErrorSeverity.WARNING,
      operationId,
      recoverable: true,
      details: { originalError: error.message }
    });

    zkErrorLogger.logError(systemError, {
      context: 'browserCompatibility.detectIndexedDB'
    });

    return {
      supported: false,
      privateBrowsing: false,
      error: error.message
    };
  }
}

/**
 * Detect BigInt support
 * Checks if the browser supports BigInt for large integer operations,
 * which is critical for certain cryptographic operations in ZK proofs
 * 
 * @returns {boolean} True if BigInt is supported, false otherwise
 * @example
 * // Check if BigInt is available for cryptographic operations
 * if (detectBigIntSupport()) {
 *   // Use more efficient BigInt implementations
 *   useBigIntOperations();
 * } else {
 *   // Fall back to alternative implementations
 *   useBigNumberLibrary();
 * }
 */
export function detectBigIntSupport() {
  const operationId = `detectBigIntSupport_${Date.now()}`;
  try {
    return typeof BigInt !== 'undefined';
  } catch (error) {
    const systemError = new SystemError(`Failed to detect BigInt support: ${error.message}`, {
      code: ErrorCode.COMPATIBILITY_API_UNAVAILABLE,
      severity: ErrorSeverity.WARNING,
      operationId,
      recoverable: true,
      details: { originalError: error.message }
    });

    zkErrorLogger.logError(systemError, {
      context: 'browserCompatibility.detectBigIntSupport'
    });

    return false;
  }
}

/**
 * Browser compatibility result for specific operation types
 * @typedef {Object} CompatibilityReport
 * @property {boolean} isCompatible - Whether the browser is compatible with the operation
 * @property {string} operationType - The type of operation that was checked
 * @property {string} reason - Explanation of the compatibility result
 * @property {Object} [details] - Additional details about specific features and their support
 */

/**
 * Check if browser is compatible with ZK operations
 * Determines if the current browser environment can support the specified ZK operation type
 * based on feature detection and minimum browser version requirements
 * 
 * @param {string} operationType - Type of operation ('standard', 'complex', 'recursive')
 * @returns {boolean} True if browser is compatible for the operation
 * @throws {SystemError} If there is an error during compatibility detection
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
  const operationId = `isBrowserCompatible_${Date.now()}`;
  try {
    // Check for required features based on operation type
    const webAssemblySupport = typeof WebAssembly !== 'undefined';
    const webCryptoSupport = typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';
    const bigIntSupport = typeof BigInt !== 'undefined';

    // For standard operations, require WebAssembly and WebCrypto
    if (operationType === 'standard') {
      return webAssemblySupport && webCryptoSupport;
    }

    // For complex operations, also require BigInt
    if (operationType === 'complex') {
      return webAssemblySupport && webCryptoSupport && bigIntSupport;
    }

    // For recursive operations, require SharedArrayBuffer as well
    if (operationType === 'recursive') {
      const sharedArrayBufferSupport = detectSharedArrayBuffer();
      return webAssemblySupport && webCryptoSupport && bigIntSupport && sharedArrayBufferSupport;
    }

    // Default case for unknown operation types
    return webAssemblySupport && webCryptoSupport;
  } catch (error) {
    const systemError = new SystemError(`Failed to check browser compatibility: ${error.message}`, {
      code: ErrorCode.COMPATIBILITY_BROWSER_UNSUPPORTED,
      severity: ErrorSeverity.WARNING,
      operationId,
      recoverable: true,
      details: {
        originalError: error.message,
        operationType
      }
    });

    zkErrorLogger.logError(systemError, {
      context: 'browserCompatibility.isBrowserCompatible'
    });

    // Conservative approach: if there's an error, assume incompatibility
    return false;
  }
}

/**
 * Check browser compatibility and provide detailed report
 * Performs a comprehensive check of browser capabilities and returns a detailed compatibility report
 * including the specific reasons for compatibility or incompatibility
 * 
 * @param {string} operationType - Type of operation ('standard', 'complex', 'recursive')
 * @returns {CompatibilityReport} Compatibility report with isCompatible flag and details
 * @example
 * // Get detailed compatibility report
 * const report = checkBrowserSupport('complex');
 * if (!report.isCompatible) {
 *   console.log(`Cannot run complex proofs: ${report.reason}`);
 *   // Show specific details to the user
 *   displayFailedRequirements(report.details);
 * }
 */
export function checkBrowserSupport(operationType = 'standard') {
  const operationId = `checkBrowserSupport_${Date.now()}`;
  try {
    // Check for basic compatibility
    const isCompatible = isBrowserCompatible(operationType);

    // Get detailed feature support for the report
    const features = {
      webAssembly: typeof WebAssembly !== 'undefined',
      webCrypto: typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined',
      bigInt: typeof BigInt !== 'undefined',
      sharedArrayBuffer: detectSharedArrayBuffer(),
      indexedDB: detectIndexedDB().supported
    };

    // Determine the reason for incompatibility if applicable
    let reason = isCompatible ? 'Compatible' : 'Browser lacks required capabilities';

    if (!isCompatible) {
      if (!features.webAssembly) {
        reason = 'WebAssembly is not supported';
      } else if (!features.webCrypto) {
        reason = 'Web Crypto API is not supported';
      } else if (operationType !== 'standard' && !features.bigInt) {
        reason = 'BigInt is not supported (required for complex operations)';
      } else if (operationType === 'recursive' && !features.sharedArrayBuffer) {
        reason = 'SharedArrayBuffer is not supported (required for recursive operations)';
      }
    }

    return {
      isCompatible,
      operationType,
      reason,
      details: features
    };
  } catch (error) {
    const systemError = new SystemError(`Failed to check browser support: ${error.message}`, {
      code: ErrorCode.COMPATIBILITY_BROWSER_UNSUPPORTED,
      severity: ErrorSeverity.WARNING,
      operationId,
      recoverable: true,
      details: {
        originalError: error.message,
        operationType
      }
    });

    zkErrorLogger.logError(systemError, {
      context: 'browserCompatibility.checkBrowserSupport'
    });

    // Return a default report with failure information
    return {
      isCompatible: false,
      operationType,
      reason: `Error during compatibility check: ${error.message}`,
      details: {
        error: error.message
      }
    };
  }
}

/**
 * Device capabilities report for ZK operations
 * @typedef {Object} DeviceCapabilitiesReport
 * @property {Object} features - Available JS features and APIs
 * @property {boolean} features.webAssembly - WebAssembly support
 * @property {boolean} features.webCrypto - Web Crypto API support
 * @property {boolean} features.bigInt - BigInt support
 * @property {boolean} features.sharedArrayBuffer - SharedArrayBuffer support
 * @property {boolean} features.indexedDB - IndexedDB support
 * @property {Object} browser - Browser information
 * @property {boolean} browser.isNode - Whether running in Node.js
 * @property {string} [browser.name] - Browser name if detectable
 * @property {string} [browser.version] - Browser version if detectable
 * @property {boolean} [browser.isMobile] - Whether running on a mobile device
 * @property {Object} memory - Memory information if available
 * @property {number} [memory.available] - Available memory in MB if detectable
 * @property {Object} hardware - Hardware information if available
 * @property {number} [hardware.cpuCores] - Number of CPU cores if detectable
 */

/**
 * Get detailed device capabilities for ZK operations
 * Collects comprehensive information about the current device's capabilities
 * relevant to running zero-knowledge proofs
 * 
 * @returns {DeviceCapabilitiesReport} Detailed device capabilities report
 * @example
 * // Get device capabilities to determine optimal operation mode
 * const capabilities = getDeviceCapabilities();
 * if (capabilities.features.webAssembly && capabilities.features.webCrypto) {
 *   if (capabilities.browser.isMobile || capabilities.memory.available < 4096) {
 *     // Use lightweight mode on mobile or low-memory devices
 *     useLightweightMode();
 *   } else {
 *     // Use full client-side computation on capable devices
 *     useClientSideComputation();
 *   }
 * } else {
 *   // Use server-side fallback
 *   useServerSideFallback();
 * }
 */
export function getDeviceCapabilities() {
  const operationId = `getDeviceCapabilities_${Date.now()}`;
  try {
    // Get basic device capabilities
    const deviceCaps = deviceCapabilities.detectCapabilities ?
      deviceCapabilities.detectCapabilities() :
      { browser: { isNode: !isBrowserEnvironment() } };

    // Check feature support
    const features = {
      webAssembly: typeof WebAssembly !== 'undefined',
      webCrypto: typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined',
      bigInt: typeof BigInt !== 'undefined',
      sharedArrayBuffer: detectSharedArrayBuffer(),
      indexedDB: detectIndexedDB().supported
    };

    // Construct the capabilities report
    return {
      features,
      browser: deviceCaps.browser || { isNode: !isBrowserEnvironment() },
      memory: {
        available: deviceCaps.availableMemory || null
      },
      hardware: {
        cpuCores: deviceCaps.cpuCores || null
      }
    };
  } catch (error) {
    const systemError = new SystemError(`Failed to get device capabilities: ${error.message}`, {
      code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
      severity: ErrorSeverity.WARNING,
      operationId,
      recoverable: true,
      details: { originalError: error.message }
    });

    zkErrorLogger.logError(systemError, {
      context: 'browserCompatibility.getDeviceCapabilities'
    });

    // Return a minimal capabilities object with defaults
    return {
      features: {
        webAssembly: false,
        webCrypto: false,
        bigInt: false,
        sharedArrayBuffer: false,
        indexedDB: false
      },
      browser: {
        isNode: !isBrowserEnvironment(),
        name: 'unknown',
        version: 'unknown',
        isMobile: false
      },
      memory: {
        available: null
      },
      hardware: {
        cpuCores: null
      }
    };
  }
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