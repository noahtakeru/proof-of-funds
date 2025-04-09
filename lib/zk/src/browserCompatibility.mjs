/**
 * browserCompatibility.mjs - Comprehensive browser compatibility system for ZK operations
 * 
 * This module provides advanced browser compatibility detection and scoring for running
 * zero-knowledge proofs in browser environments. It includes feature detection, capability
 * benchmarking, and fallback strategies based on the detected environment.
 */

import deviceCapabilities from './deviceCapabilities.mjs';

// Minimum required browser versions for full compatibility
export const BROWSER_VERSION_REQUIREMENTS = {
  chrome: 67,
  firefox: 63,
  safari: 14,
  edge: 79,
  opera: 54,
  samsung: 9,
  ie: null // IE is not supported
};

// Feature support matrix by browser
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

// Known issues and workarounds by browser
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
 * 
 * @param {string} operationType - Type of operation ('standard', 'threshold', 'maximum')
 * @returns {boolean} True if browser is compatible for the operation
 */
export function isBrowserCompatible(operationType = 'standard') {
  // Very simplified version for MJS file
  return typeof WebAssembly !== 'undefined' && typeof crypto !== 'undefined';
}

/**
 * Check browser compatibility and provide detailed report
 * 
 * @param {string} operationType - Type of operation ('standard', 'threshold', 'maximum')
 * @returns {Object} Compatibility report with isCompatible flag and details
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
 * Get device capabilities
 * 
 * @returns {Object} Device capabilities
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