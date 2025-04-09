/**
 * Browser Compatibility Detection (CommonJS Version)
 * 
 * This module provides functionality to detect browser compatibility with ZK features.
 */

// Browser compatibility check functions for CommonJS
const REQUIRED_FEATURES = {
  WASM: { name: 'WebAssembly Support', critical: true },
  BIGINT: { name: 'BigInt Support', critical: true },
  LOCAL_STORAGE: { name: 'Local Storage', critical: false },
  WEB_CRYPTO: { name: 'Web Cryptography API', critical: true },
  SECURE_CONTEXT: { name: 'Secure Context', critical: false },
  SERVICE_WORKER: { name: 'Service Worker Support', critical: false },
  BROADBAND: { name: 'Broadband Connection', critical: false }
};

/**
 * Check if the browser supports all critical ZK features
 * @returns {Object} Compatibility status
 */
function checkBrowserSupport() {
  // In a Node.js environment, we can safely assume WASM and BigInt support
  // but we have to mock browser-specific APIs
  
  const results = {
    supported: true,
    features: {
      WASM: typeof WebAssembly !== 'undefined',
      BIGINT: typeof BigInt !== 'undefined',
      LOCAL_STORAGE: typeof localStorage !== 'undefined',
      WEB_CRYPTO: typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined',
      SECURE_CONTEXT: true, // Assume true for Node.js
      SERVICE_WORKER: false, // Not applicable for Node.js
      BROADBAND: true // Assume true for Node.js
    },
    missingCritical: [],
    missingOptional: []
  };
  
  // Check for missing features
  for (const [key, feature] of Object.entries(REQUIRED_FEATURES)) {
    if (!results.features[key]) {
      if (feature.critical) {
        results.supported = false;
        results.missingCritical.push(key);
      } else {
        results.missingOptional.push(key);
      }
    }
  }
  
  return results;
}

/**
 * Get detailed device capabilities
 * @returns {Object} Device capabilities
 */
function getDeviceCapabilities() {
  return {
    // Basic device info
    platform: 'node',
    isNode: true,
    isBrowser: false,
    wasm: typeof WebAssembly !== 'undefined',
    
    // Performance capabilities
    memory: {
      totalJSHeapSize: process.memoryUsage().heapTotal,
      usedJSHeapSize: process.memoryUsage().heapUsed,
      jsHeapSizeLimit: process.memoryUsage().rss
    },
    
    // Feature compatibility (simplified for Node.js)
    features: {
      wasm: typeof WebAssembly !== 'undefined',
      bigint: typeof BigInt !== 'undefined',
      webCrypto: typeof crypto !== 'undefined',
      workers: false
    }
  };
}

// Export functions for CommonJS
module.exports = {
  checkBrowserSupport,
  getDeviceCapabilities,
  REQUIRED_FEATURES
};