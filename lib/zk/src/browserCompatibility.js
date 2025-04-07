/**
 * browserCompatibility.js - Comprehensive browser compatibility system for ZK operations
 * 
 * This module provides advanced browser compatibility detection and scoring for running
 * zero-knowledge proofs in browser environments. It includes feature detection, capability
 * benchmarking, and fallback strategies based on the detected environment.
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This system acts as a sophisticated compatibility layer that ensures the ZK verification
 * process works seamlessly across different browsers and devices. Think of it like:
 * 
 * 1. UNIVERSAL TRANSLATOR: Similar to how a translator ensures communication between people
 *    speaking different languages, this system ensures our application can communicate with
 *    different browsers and adapt to their specific capabilities.
 * 
 * 2. SMART ADAPTIVE SYSTEM: Like how a modern car automatically adjusts its settings based
 *    on road conditions, this system adjusts how computations are performed based on the
 *    device's capabilities, ensuring optimal performance in all environments.
 * 
 * 3. SAFETY NET: Functions as a backup system that catches potential compatibility issues
 *    before they cause problems, similar to how a backup generator kicks in during a power outage.
 * 
 * 4. PERFORMANCE OPTIMIZER: Acts like a coach who understands each athlete's strengths and
 *    weaknesses, using this knowledge to assign tasks that match their abilities to achieve
 *    the best overall team performance.
 * 
 * Business value: Ensures consistent user experience across all supported browsers,
 * maximizes the number of users who can complete ZK operations successfully, reduces support
 * tickets related to browser compatibility issues, and increases user trust by providing
 * transparent feedback about device capabilities.
 * 
 * Version: 1.0.0
 */

import deviceCapabilities from './deviceCapabilities.js';

// Minimum required browser versions for full compatibility
const BROWSER_VERSION_REQUIREMENTS = {
  chrome: 67,
  firefox: 63,
  safari: 14,
  edge: 79,
  opera: 54,
  samsung: 9,
  ie: null // IE is not supported
};

// Feature support matrix by browser
const FEATURE_SUPPORT_MATRIX = {
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
const KNOWN_ISSUES = {
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
 * Enhanced capability result structure
 * @typedef {Object} BrowserCapabilities
 * @property {Object} features - Detailed feature support
 * @property {boolean} features.webAssembly - Whether WebAssembly is supported
 * @property {boolean} features.webAssemblyStreaming - Whether streaming compilation is supported
 * @property {boolean} features.webCrypto - Whether Web Crypto API is supported
 * @property {boolean} features.webCryptoSubtle - Whether advanced crypto operations are supported
 * @property {boolean} features.webWorkers - Whether Web Workers are supported
 * @property {boolean} features.sharedArrayBuffer - Whether SharedArrayBuffer is supported
 * @property {boolean} features.indexedDB - Whether IndexedDB is supported
 * @property {boolean} features.bigInt - Whether BigInt is supported
 * @property {Object} browser - Browser information
 * @property {string} browser.name - Browser name
 * @property {string} browser.version - Browser version
 * @property {boolean} browser.isMobile - Whether the browser is on a mobile device
 * @property {boolean} browser.isSupported - Whether the browser meets minimum requirements
 * @property {Object} performance - Performance metrics
 * @property {number} performance.memory - Memory score (0-100)
 * @property {number} performance.cpu - CPU score (0-100)
 * @property {number} performance.webAssembly - WebAssembly performance score (0-100)
 * @property {number} performance.overall - Overall performance score (0-100)
 * @property {Object} compatibility - Compatibility assessment
 * @property {string} compatibility.level - Compatibility level (full, high, medium, low, incompatible)
 * @property {string} compatibility.recommendedPath - Recommended execution path
 * @property {string[]} compatibility.issues - List of potential issues
 * @property {Object} degradationPath - Available execution strategies
 */

/**
 * Detect SharedArrayBuffer support
 * Checks if the browser supports SharedArrayBuffer for parallel processing
 * 
 * @returns {boolean} True if SharedArrayBuffer is supported
 */
function detectSharedArrayBuffer() {
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
function detectIndexedDB() {
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
function detectBigIntSupport() {
  return typeof BigInt !== 'undefined';
}

/**
 * Get current time in milliseconds
 * Works in both browser and Node.js environments
 * 
 * @returns {number} Current time in milliseconds
 */
function getCurrentTimeMs() {
  if (isBrowserEnvironment() && typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  
  // Node.js or fallback
  if (typeof process !== 'undefined' && process.hrtime) {
    const [seconds, nanoseconds] = process.hrtime();
    return seconds * 1000 + nanoseconds / 1000000;
  }
  
  // Final fallback
  return Date.now();
}

/**
 * Benchmark WebAssembly performance
 * Runs a simple WebAssembly benchmark to assess performance
 * 
 * @returns {Object} Benchmark results with score and execution time
 */
function benchmarkWebAssembly() {
  // Check if we're in a Node.js environment
  if (!isBrowserEnvironment()) {
    // Return a default score for Node.js
    return { 
      score: 50, 
      executionTime: 0, 
      supported: typeof WebAssembly !== 'undefined',
      isNode: true 
    };
  }
  
  // Check WebAssembly support
  if (typeof WebAssembly === 'undefined') {
    return { score: 0, executionTime: 0, supported: false };
  }
  
  try {
    // Simple Fibonacci benchmark - valid WebAssembly module
    const wasmCode = new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x07, 0x01, 0x60, 
      0x01, 0x7f, 0x01, 0x7f, 0x03, 0x02, 0x01, 0x00, 0x07, 0x07, 0x01, 0x03, 
      0x66, 0x69, 0x62, 0x00, 0x00, 0x0a, 0x1c, 0x01, 0x1a, 0x00, 0x20, 0x00, 
      0x41, 0x02, 0x49, 0x04, 0x40, 0x20, 0x00, 0x0f, 0x0b, 0x20, 0x00, 0x41, 
      0x01, 0x6b, 0x10, 0x00, 0x20, 0x00, 0x41, 0x02, 0x6b, 0x10, 0x00, 0x6a, 0x0f
    ]);
    
    // Measure execution time
    const startTime = getCurrentTimeMs();
    
    // Compile and instantiate
    const module = new WebAssembly.Module(wasmCode);
    const instance = new WebAssembly.Instance(module, {});
    
    // Run the fib function for n=10 (faster for testing)
    const result = instance.exports.fib(10);
    
    const endTime = getCurrentTimeMs();
    const executionTime = endTime - startTime;
    
    // Calculate score (normalized, lower is better)
    // Typical high-end device performs this in ~1-5ms
    const score = Math.min(100, Math.max(0, 100 - (executionTime - 1) * 5));
    
    return {
      score: score,
      executionTime: executionTime,
      result: result,
      supported: true
    };
  } catch (e) {
    console.warn('WebAssembly benchmark failed:', e);
    return { score: 0, executionTime: 0, supported: false, error: e.message };
  }
}

/**
 * Benchmark CPU performance
 * Runs a JavaScript benchmark to assess CPU performance
 * 
 * @returns {Object} Benchmark results with score and execution time
 */
function benchmarkCPU() {
  // Check if we're in a Node.js environment
  if (!isBrowserEnvironment()) {
    // Return a default score for Node.js
    return { 
      score: 50, 
      executionTime: 0, 
      supported: true,
      isNode: true 
    };
  }
  
  try {
    const startTime = getCurrentTimeMs();
    
    // Compute-intensive operation (matrix multiplication)
    // Use smaller size for better compatibility
    const size = 50;
    const matrixA = Array(size).fill().map(() => Array(size).fill().map(() => Math.random()));
    const matrixB = Array(size).fill().map(() => Array(size).fill().map(() => Math.random()));
    const result = Array(size).fill().map(() => Array(size).fill(0));
    
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        for (let k = 0; k < size; k++) {
          result[i][j] += matrixA[i][k] * matrixB[k][j];
        }
      }
    }
    
    const endTime = getCurrentTimeMs();
    const executionTime = endTime - startTime;
    
    // Calculate score (normalized, lower is better)
    // Typical high-end device performs this in ~100-500ms
    const score = Math.min(100, Math.max(0, 100 - (executionTime - 100) / 10));
    
    return {
      score: score,
      executionTime: executionTime,
      supported: true
    };
  } catch (e) {
    console.warn('CPU benchmark failed:', e);
    return { score: 0, executionTime: 0, supported: false, error: e.message };
  }
}

/**
 * Calculate memory availability score
 * Converts raw memory value to a normalized score
 * 
 * @param {number|null} availableMemory - Available memory in MB
 * @returns {number} Memory score (0-100)
 */
function calculateMemoryScore(availableMemory) {
  if (availableMemory === null) {
    // If memory detection failed, assume medium capability
    return 50;
  }
  
  // Score calculation:
  // - Below 4GB: score ranges from 0-40
  // - 4GB-8GB: score ranges from 40-70
  // - 8GB-16GB: score ranges from 70-90
  // - 16GB+: score ranges from 90-100
  
  if (availableMemory < 4 * 1024) {
    return Math.max(0, (availableMemory / (4 * 1024)) * 40);
  } else if (availableMemory < 8 * 1024) {
    return 40 + ((availableMemory - 4 * 1024) / (4 * 1024)) * 30;
  } else if (availableMemory < 16 * 1024) {
    return 70 + ((availableMemory - 8 * 1024) / (8 * 1024)) * 20;
  } else {
    return 90 + Math.min(10, ((availableMemory - 16 * 1024) / (16 * 1024)) * 10);
  }
}

/**
 * Checks if browser version meets minimum requirements
 * 
 * @param {string} browserName - Browser name
 * @param {string|number} version - Browser version
 * @returns {boolean} True if browser meets requirements
 */
function meetsMinimumBrowserRequirements(browserName, version) {
  // Convert version string to number
  const versionNum = parseFloat(version);
  if (isNaN(versionNum)) {
    return false;
  }
  
  // Check against requirements
  const minVersion = BROWSER_VERSION_REQUIREMENTS[browserName];
  
  // IE is not supported
  if (browserName === 'ie') {
    return false;
  }
  
  // If browser is not in our list, be conservative
  if (minVersion === undefined) {
    return false;
  }
  
  return versionNum >= minVersion;
}

/**
 * Get known issues for the current browser
 * 
 * @param {string} browserName - Browser name
 * @param {string|number} version - Browser version
 * @param {boolean} isMobile - Whether the browser is on a mobile device
 * @returns {Array} List of applicable known issues
 */
function getKnownIssues(browserName, version, isMobile) {
  const issues = [];
  const versionNum = parseFloat(version);
  
  // Check browser-specific issues
  const browserIssues = KNOWN_ISSUES[browserName];
  if (browserIssues) {
    browserIssues.forEach(issue => {
      // Check if the issue applies to this version
      if (issue.versions) {
        // Handle version ranges like "< 15.4"
        if (issue.versions.includes('<')) {
          const maxVersion = parseFloat(issue.versions.replace(/[^0-9.]/g, ''));
          if (versionNum < maxVersion) {
            issues.push(`${browserName} ${version}: ${issue.feature} - ${issue.issue}`);
          }
        }
        // Handle version ranges like "60-68"
        else if (issue.versions.includes('-')) {
          const [minVer, maxVer] = issue.versions.split('-').map(v => parseFloat(v));
          if (versionNum >= minVer && versionNum <= maxVer) {
            issues.push(`${browserName} ${version}: ${issue.feature} - ${issue.issue}`);
          }
        }
      } else {
        issues.push(`${browserName}: ${issue.feature} - ${issue.issue}`);
      }
    });
  }
  
  // Add mobile-specific issues
  if (isMobile) {
    KNOWN_ISSUES.mobile.forEach(issue => {
      issues.push(`Mobile: ${issue.feature} - ${issue.issue}`);
    });
  }
  
  return issues;
}

/**
 * Determine the appropriate degradation path based on capabilities
 * 
 * @param {Object} capabilities - Detected capabilities
 * @returns {Object} Recommended execution strategies
 */
function determineDegradationPath(capabilities) {
  // Extract key capability indicators
  const {
    features,
    performance,
    browser
  } = capabilities;
  
  // Initialize all paths as potentially available
  const paths = {
    clientSide: {
      available: features.webAssembly && features.webCrypto,
      recommended: false,
      description: 'Full client-side execution with all optimizations'
    },
    webWorker: {
      available: features.webWorkers && features.webAssembly && features.webCrypto,
      recommended: false,
      description: 'Offload heavy computation to Web Workers'
    },
    progressiveLoading: {
      available: true, // Always available as a strategy
      recommended: false,
      description: 'Load and process data in smaller chunks to accommodate memory constraints'
    },
    hybrid: {
      available: true, // Always available as a strategy
      recommended: false,
      description: 'Split computation between client and server based on complexity'
    },
    serverSide: {
      available: true, // Always available as a fallback
      recommended: false,
      description: 'Perform all computation on the server'
    }
  };
  
  // Determine recommended path based on performance and features
  const overallScore = performance.overall;
  
  if (overallScore >= 80 && paths.clientSide.available && features.sharedArrayBuffer) {
    // High-performance devices can use full client-side execution
    paths.clientSide.recommended = true;
    return {
      paths,
      recommended: 'clientSide',
      description: 'Full client-side execution is optimal for this device'
    };
  } else if (overallScore >= 60 && paths.webWorker.available) {
    // Good devices can offload to web workers
    paths.webWorker.recommended = true;
    return {
      paths,
      recommended: 'webWorker',
      description: 'Web Worker offloading is recommended for optimal performance'
    };
  } else if (overallScore >= 40 && performance.memory < 50) {
    // Medium devices with memory constraints should use progressive loading
    paths.progressiveLoading.recommended = true;
    return {
      paths,
      recommended: 'progressiveLoading',
      description: 'Progressive loading is recommended due to memory constraints'
    };
  } else if (overallScore >= 20) {
    // Lower-end devices should use a hybrid approach
    paths.hybrid.recommended = true;
    return {
      paths,
      recommended: 'hybrid',
      description: 'Hybrid client/server computation is recommended for this device'
    };
  } else {
    // Very low-end or incompatible devices should use server-side only
    paths.serverSide.recommended = true;
    return {
      paths,
      recommended: 'serverSide',
      description: 'Server-side computation is recommended due to device limitations'
    };
  }
}

/**
 * Detect compatibility level based on features and performance
 * 
 * @param {Object} features - Detected features
 * @param {Object} performance - Performance scores
 * @returns {string} Compatibility level (full, high, medium, low, incompatible)
 */
function detectCompatibilityLevel(features, performance) {
  // Essential features for any compatibility
  if (!features.webAssembly || !features.webCrypto) {
    return 'incompatible';
  }
  
  const overallScore = performance.overall;
  
  if (overallScore >= 80 && features.webWorkers && features.sharedArrayBuffer && features.bigInt) {
    return 'full';
  } else if (overallScore >= 60 && features.webWorkers) {
    return 'high';
  } else if (overallScore >= 40) {
    return 'medium';
  } else {
    return 'low';
  }
}

/**
 * Feature support storage for tracking
 * Used to store feature support data for future reference
 */
class FeatureSupportStore {
  constructor() {
    this.storageKey = 'zk-feature-support-data';
    this.data = this.load();
    this.isInBrowser = isBrowserEnvironment();
  }
  
  load() {
    // Default data structure
    const defaultData = {
      history: [],
      lastUpdated: null
    };
    
    // In Node.js, just return the default data
    if (!this.isInBrowser) {
      return defaultData;
    }
    
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : defaultData;
    } catch (e) {
      return defaultData;
    }
  }
  
  save() {
    // In Node.js, don't attempt to save
    if (!this.isInBrowser) {
      return false;
    }
    
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.data));
      return true;
    } catch (e) {
      console.warn('Could not save feature support data:', e);
      return false;
    }
  }
  
  addEntry(featureData) {
    // Keep max 10 historical entries
    if (this.data.history.length >= 10) {
      this.data.history.shift();
    }
    
    this.data.history.push({
      timestamp: Date.now(),
      data: featureData
    });
    
    this.data.lastUpdated = Date.now();
    return this.save();
  }
  
  getHistory() {
    return this.data.history;
  }
  
  getLastEntry() {
    if (this.data.history.length === 0) {
      return null;
    }
    return this.data.history[this.data.history.length - 1];
  }
  
  clear() {
    this.data = {
      history: [],
      lastUpdated: null
    };
    return this.save();
  }
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
 * Run comprehensive feature detection
 * Detects all features and benchmarks performance
 * 
 * @returns {BrowserCapabilities} Comprehensive feature and performance information
 */
function detectFeatures() {
  // Check if we're in a browser environment
  const isInBrowser = isBrowserEnvironment();
  
  if (!isInBrowser) {
    // We're in Node.js or another non-browser environment
    const nodeInfo = getNodeEnvironmentInfo();
    
    // Create a simplified capabilities object for Node.js
    return {
      features: {
        webAssembly: typeof WebAssembly !== 'undefined',
        webAssemblyStreaming: false,
        webCrypto: typeof crypto !== 'undefined',
        webCryptoSubtle: false,
        webWorkers: false,
        sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
        indexedDB: false,
        indexedDBPrivateBrowsing: false,
        bigInt: typeof BigInt !== 'undefined'
      },
      browser: {
        name: nodeInfo ? nodeInfo.name : 'unknown',
        version: nodeInfo ? nodeInfo.version : 'unknown',
        isMobile: false,
        isSupported: false,
        isNode: true
      },
      performance: {
        memory: 50, // Default medium score
        cpu: 50,
        webAssembly: typeof WebAssembly !== 'undefined' ? 50 : 0,
        overall: 50
      },
      compatibility: {
        level: 'node',
        recommendedPath: 'serverSide',
        issues: ['Running in Node.js environment, browser features not available']
      },
      degradationPath: {
        clientSide: { available: false, recommended: false, description: 'Not available in Node.js' },
        webWorker: { available: false, recommended: false, description: 'Not available in Node.js' },
        progressiveLoading: { available: false, recommended: false, description: 'Not available in Node.js' },
        hybrid: { available: false, recommended: false, description: 'Not available in Node.js' },
        serverSide: { available: true, recommended: true, description: 'Server-side execution is the only option in Node.js' }
      },
      isNode: true
    };
  }
  
  // We're in a browser environment, proceed with full detection
  // Use existing device capability detection
  const baseCapabilities = deviceCapabilities.detectCapabilities();
  const browserInfo = baseCapabilities.browser;
  
  // Enhanced feature detection
  const features = {
    webAssembly: baseCapabilities.supportsWebAssembly,
    webAssemblyStreaming: typeof WebAssembly.instantiateStreaming === 'function',
    webCrypto: baseCapabilities.supportsWebCrypto,
    webCryptoSubtle: baseCapabilities.supportsWebCrypto && typeof window?.crypto?.subtle?.digest === 'function',
    webWorkers: baseCapabilities.supportsWebWorkers,
    sharedArrayBuffer: detectSharedArrayBuffer(),
    indexedDB: detectIndexedDB().supported,
    indexedDBPrivateBrowsing: detectIndexedDB().privateBrowsing,
    bigInt: detectBigIntSupport()
  };
  
  // Run benchmarks
  const wasmBenchmark = benchmarkWebAssembly();
  const cpuBenchmark = benchmarkCPU();
  const memoryScore = calculateMemoryScore(baseCapabilities.availableMemory);
  
  // Calculate overall performance score (weighted average)
  const overallScore = (
    memoryScore * 0.35 +
    cpuBenchmark.score * 0.35 +
    wasmBenchmark.score * 0.3
  );
  
  // Determine browser compatibility
  const browserCompatibility = {
    name: browserInfo.name,
    version: browserInfo.version,
    isMobile: browserInfo.isMobile,
    isSupported: meetsMinimumBrowserRequirements(browserInfo.name, browserInfo.version)
  };
  
  // Get applicable known issues
  const issues = getKnownIssues(
    browserInfo.name,
    browserInfo.version,
    browserInfo.isMobile
  );
  
  // Performance scores
  const performanceScores = {
    memory: memoryScore,
    cpu: cpuBenchmark.score,
    webAssembly: wasmBenchmark.score,
    overall: overallScore
  };
  
  // Determine compatibility level
  const compatibilityLevel = detectCompatibilityLevel(features, performanceScores);
  
  // Determine appropriate degradation path
  const degradationPath = determineDegradationPath({
    features,
    performance: performanceScores,
    browser: browserCompatibility
  });
  
  // Build comprehensive capability object
  const capabilities = {
    features,
    browser: browserCompatibility,
    performance: performanceScores,
    compatibility: {
      level: compatibilityLevel,
      recommendedPath: degradationPath.recommended,
      issues
    },
    degradationPath: degradationPath.paths,
    rawData: {
      wasmBenchmark,
      cpuBenchmark,
      baseCapabilities
    }
  };
  
  // Store capabilities for historical tracking if localStorage is available
  try {
    const featureStore = new FeatureSupportStore();
    featureStore.addEntry({
      features,
      performance: performanceScores,
      browser: browserCompatibility,
      compatibility: {
        level: compatibilityLevel
      }
    });
  } catch (e) {
    // Ignore storage errors
  }
  
  return capabilities;
}

/**
 * Check if a specific feature is supported
 * 
 * @param {string} featureName - Name of the feature to check
 * @returns {boolean} Whether the feature is supported
 */
function isFeatureSupported(featureName) {
  const features = {
    webAssembly: deviceCapabilities.detectWebAssembly(),
    webCrypto: deviceCapabilities.detectWebCrypto(),
    webWorkers: deviceCapabilities.detectWebWorkers(),
    sharedArrayBuffer: detectSharedArrayBuffer(),
    indexedDB: detectIndexedDB().supported,
    bigInt: detectBigIntSupport()
  };
  
  return features[featureName] || false;
}

/**
 * Get minimum browser version for a specific feature
 * 
 * @param {string} featureName - Name of the feature
 * @param {string} browserName - Name of the browser
 * @returns {number|null} Minimum version or null if not supported
 */
function getMinimumBrowserVersion(featureName, browserName) {
  const feature = FEATURE_SUPPORT_MATRIX[featureName];
  if (!feature) {
    return null;
  }
  
  return feature[browserName] || null;
}

/**
 * Get browser version requirements table
 * 
 * @returns {Object} Browser version requirements
 */
function getBrowserRequirements() {
  return {
    minimumVersions: BROWSER_VERSION_REQUIREMENTS,
    featureSupport: FEATURE_SUPPORT_MATRIX,
    knownIssues: KNOWN_ISSUES
  };
}

/**
 * Get performance history
 * Returns historical performance data if available
 * 
 * @returns {Array|null} Historical performance data or null if not available
 */
function getPerformanceHistory() {
  try {
    const featureStore = new FeatureSupportStore();
    return featureStore.getHistory();
  } catch (e) {
    return null;
  }
}

/**
 * Determine if the current browser needs special handling
 * 
 * @returns {Object} Special handling requirements
 */
function getSpecialHandlingRequirements() {
  const baseCapabilities = deviceCapabilities.detectCapabilities();
  const browserInfo = baseCapabilities.browser;
  const issues = getKnownIssues(
    browserInfo.name,
    browserInfo.version,
    browserInfo.isMobile
  );
  
  return {
    hasSpecialRequirements: issues.length > 0,
    issues,
    recommendedHandling: issues.length > 0 ? 
      'Follow the workarounds for the identified issues' : 
      'No special handling required'
  };
}

/**
 * Detect browser features
 * Alias for detectFeatures for test compatibility
 *
 * @returns {BrowserCapabilities} Comprehensive feature and performance information
 */
function detectBrowserFeatures() {
  return detectFeatures();
}

/**
 * Check if browser is compatible with ZK operations
 * 
 * @param {string} operationType - Type of operation ('standard', 'threshold', 'maximum')
 * @returns {boolean} True if browser is compatible for the operation
 */
function isBrowserCompatible(operationType = 'standard') {
  const capabilities = detectFeatures();
  
  // Basic compatibility requirements
  if (!capabilities.features.webAssembly || !capabilities.features.webCrypto) {
    return false;
  }
  
  // Advanced operations require more capabilities
  if (operationType === 'threshold' || operationType === 'maximum') {
    // For complex operations, require higher compatibility level
    return ['full', 'high'].includes(capabilities.compatibility.level);
  }
  
  // For standard operations, medium compatibility is sufficient
  return ['full', 'high', 'medium'].includes(capabilities.compatibility.level);
}

/**
 * Check browser compatibility and provide detailed report
 * 
 * @param {string} operationType - Type of operation ('standard', 'threshold', 'maximum')
 * @returns {Object} Compatibility report with isCompatible flag and details
 */
function checkCompatibility(operationType = 'standard') {
  const capabilities = detectFeatures();
  const isCompatible = isBrowserCompatible(operationType);
  
  return {
    isCompatible,
    capabilities,
    operationType,
    reason: isCompatible ? 'Compatible' : 'Browser lacks required capabilities',
    alternativePath: isCompatible ? null : capabilities.compatibility.recommendedPath
  };
}

export {
  detectFeatures,
  detectBrowserFeatures, // Alias for test compatibility
  isFeatureSupported,
  getMinimumBrowserVersion,
  getBrowserRequirements,
  getPerformanceHistory,
  getSpecialHandlingRequirements,
  detectSharedArrayBuffer,
  detectIndexedDB,
  detectBigIntSupport,
  benchmarkWebAssembly,
  benchmarkCPU,
  isBrowserCompatible, // Added for test compatibility
  checkCompatibility, // Added for test compatibility
  BROWSER_VERSION_REQUIREMENTS,
  FEATURE_SUPPORT_MATRIX,
  KNOWN_ISSUES
};

export default {
  detectFeatures,
  detectBrowserFeatures, // Alias for test compatibility
  isFeatureSupported,
  getMinimumBrowserVersion,
  getBrowserRequirements,
  getPerformanceHistory,
  getSpecialHandlingRequirements,
  detectSharedArrayBuffer,
  detectIndexedDB,
  detectBigIntSupport,
  benchmarkWebAssembly,
  benchmarkCPU,
  isBrowserCompatible, // Added for test compatibility
  checkCompatibility, // Added for test compatibility
  BROWSER_VERSION_REQUIREMENTS,
  FEATURE_SUPPORT_MATRIX,
  KNOWN_ISSUES
};