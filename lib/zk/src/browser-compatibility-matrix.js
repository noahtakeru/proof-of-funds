/**
 * Browser Compatibility Matrix
 * 
 * This module defines a comprehensive matrix of browsers, versions, platforms,
 * and features to test for compatibility with the ZK infrastructure.
 */

/**
 * Matrix of browsers to test
 * @constant {Object}
 */
export const BROWSER_MATRIX = {
  // Chrome
  chrome: {
    name: 'Google Chrome',
    versions: [
      { version: '91-100', priority: 'medium' },
      { version: '101-110', priority: 'high' },
      { version: '111-120', priority: 'critical' }
    ],
    platforms: ['Windows', 'macOS', 'Linux', 'Android', 'iOS'],
    notes: 'Primary target browser with full WebAssembly and Web Crypto support.'
  },
  
  // Firefox
  firefox: {
    name: 'Mozilla Firefox',
    versions: [
      { version: '90-100', priority: 'medium' },
      { version: '101-110', priority: 'high' },
      { version: '111-120', priority: 'critical' }
    ],
    platforms: ['Windows', 'macOS', 'Linux', 'Android', 'iOS'],
    notes: 'Good support for WebAssembly and Web Crypto.'
  },
  
  // Safari
  safari: {
    name: 'Apple Safari',
    versions: [
      { version: '14', priority: 'medium' },
      { version: '15', priority: 'high' },
      { version: '16-17', priority: 'critical' }
    ],
    platforms: ['macOS', 'iOS'],
    notes: 'Has some limitations with WebAssembly and IndexedDB. Important for Apple devices.'
  },
  
  // Edge
  edge: {
    name: 'Microsoft Edge',
    versions: [
      { version: '91-100', priority: 'medium' },
      { version: '101-110', priority: 'high' },
      { version: '111-120', priority: 'critical' }
    ],
    platforms: ['Windows', 'macOS'],
    notes: 'Chromium-based since Edge 79, should have similar compatibility to Chrome.'
  },
  
  // Brave
  brave: {
    name: 'Brave Browser',
    versions: [
      { version: 'latest', priority: 'high' }
    ],
    platforms: ['Windows', 'macOS', 'Linux', 'Android', 'iOS'],
    notes: 'Privacy-focused browser. Popular in crypto community.'
  },
  
  // Opera
  opera: {
    name: 'Opera',
    versions: [
      { version: 'latest', priority: 'medium' }
    ],
    platforms: ['Windows', 'macOS', 'Linux', 'Android', 'iOS'],
    notes: 'Chromium-based, should have similar compatibility to Chrome.'
  },
  
  // Samsung Internet
  samsung: {
    name: 'Samsung Internet',
    versions: [
      { version: 'latest', priority: 'medium' }
    ],
    platforms: ['Android'],
    notes: 'Important for Samsung Android devices. WebAssembly support may vary.'
  }
};

/**
 * Features to test across browsers
 * @constant {Object}
 */
export const FEATURES_TO_TEST = {
  // Core ZK functionality
  core: [
    {
      name: 'WebAssembly Support',
      testFunction: 'testWebAssemblySupport',
      description: 'Test if the browser supports WebAssembly',
      critical: true
    },
    {
      name: 'WebAssembly Streaming',
      testFunction: 'testWebAssemblyStreaming',
      description: 'Test if the browser supports WebAssembly streaming compilation',
      critical: false
    },
    {
      name: 'Web Crypto API',
      testFunction: 'testWebCryptoAPI',
      description: 'Test if the browser supports the Web Crypto API',
      critical: true
    },
    {
      name: 'Secure Random Generation',
      testFunction: 'testSecureRandomGeneration',
      description: 'Test if the browser can generate cryptographically secure random numbers',
      critical: true
    },
    {
      name: 'BigInt Support',
      testFunction: 'testBigIntSupport',
      description: 'Test if the browser supports BigInt for large number operations',
      critical: true
    }
  ],
  
  // Storage and state management
  storage: [
    {
      name: 'IndexedDB Support',
      testFunction: 'testIndexedDBSupport',
      description: 'Test if the browser supports IndexedDB for client-side storage',
      critical: false
    },
    {
      name: 'LocalStorage Limits',
      testFunction: 'testLocalStorageLimits',
      description: 'Test browser LocalStorage size limits',
      critical: false
    },
    {
      name: 'SessionStorage Support',
      testFunction: 'testSessionStorageSupport',
      description: 'Test if the browser supports SessionStorage',
      critical: false
    },
    {
      name: 'Cache API Support',
      testFunction: 'testCacheAPISupport',
      description: 'Test if the browser supports the Cache API',
      critical: false
    }
  ],
  
  // Concurrency and workers
  concurrency: [
    {
      name: 'Web Workers Support',
      testFunction: 'testWebWorkersSupport',
      description: 'Test if the browser supports Web Workers for parallel computation',
      critical: false
    },
    {
      name: 'SharedArrayBuffer Support',
      testFunction: 'testSharedArrayBufferSupport',
      description: 'Test if the browser supports SharedArrayBuffer for shared memory',
      critical: false
    },
    {
      name: 'Atomics Support',
      testFunction: 'testAtomicsSupport',
      description: 'Test if the browser supports Atomics for thread synchronization',
      critical: false
    },
    {
      name: 'Worker Termination',
      testFunction: 'testWorkerTermination',
      description: 'Test if the browser properly terminates workers',
      critical: false
    }
  ],
  
  // Network and requests
  network: [
    {
      name: 'Fetch API Support',
      testFunction: 'testFetchAPISupport',
      description: 'Test if the browser supports the Fetch API',
      critical: true
    },
    {
      name: 'AbortController Support',
      testFunction: 'testAbortControllerSupport',
      description: 'Test if the browser supports AbortController for canceling requests',
      critical: false
    },
    {
      name: 'Streaming Response',
      testFunction: 'testStreamingResponse',
      description: 'Test if the browser supports streaming responses',
      critical: false
    },
    {
      name: 'CORS Support',
      testFunction: 'testCORSSupport',
      description: 'Test if the browser correctly implements CORS',
      critical: true
    }
  ],
  
  // Performance and memory
  performance: [
    {
      name: 'Memory Constraints',
      testFunction: 'testMemoryConstraints',
      description: 'Test how the browser handles memory-intensive operations',
      critical: true
    },
    {
      name: 'WebAssembly Performance',
      testFunction: 'testWebAssemblyPerformance',
      description: 'Benchmark WebAssembly execution speed',
      critical: true
    },
    {
      name: 'Crypto Operations Performance',
      testFunction: 'testCryptoPerformance',
      description: 'Benchmark cryptographic operations',
      critical: true
    },
    {
      name: 'Memory Leak Detection',
      testFunction: 'testMemoryLeakDetection',
      description: 'Test for memory leaks during repeated operations',
      critical: false
    }
  ],
  
  // Device integration
  device: [
    {
      name: 'Device Memory API',
      testFunction: 'testDeviceMemoryAPI',
      description: 'Test if the browser supports the Device Memory API',
      critical: false
    },
    {
      name: 'Hardware Concurrency',
      testFunction: 'testHardwareConcurrency',
      description: 'Test if the browser can detect CPU cores',
      critical: false
    },
    {
      name: 'Battery Status API',
      testFunction: 'testBatteryStatusAPI',
      description: 'Test if the browser supports the Battery Status API for power management',
      critical: false
    }
  ],
  
  // Security features
  security: [
    {
      name: 'Secure Context',
      testFunction: 'testSecureContext',
      description: 'Test if the browser correctly detects secure contexts',
      critical: true
    },
    {
      name: 'Content Security Policy',
      testFunction: 'testContentSecurityPolicy',
      description: 'Test if the browser correctly implements CSP',
      critical: false
    },
    {
      name: 'Permission API',
      testFunction: 'testPermissionAPI',
      description: 'Test if the browser supports the Permission API',
      critical: false
    },
    {
      name: 'HTTP Strict Transport Security',
      testFunction: 'testHSTS',
      description: 'Test if the browser correctly implements HSTS',
      critical: false
    }
  ]
};

/**
 * Test environments to validate
 * @constant {Object}
 */
export const TEST_ENVIRONMENTS = {
  // Regular desktop environments
  desktop: {
    name: 'Desktop Browsers',
    importance: 'critical',
    description: 'Standard desktop environments with typical resources',
    memoryConstraints: 'high', // 8GB+ RAM
    networkConstraints: 'high', // Fast, stable connections
    priorityBrowsers: ['chrome', 'firefox', 'safari', 'edge']
  },
  
  // Mobile environments
  mobile: {
    name: 'Mobile Browsers',
    importance: 'high',
    description: 'Mobile devices with varying resources and network conditions',
    memoryConstraints: 'medium', // 2-4GB RAM
    networkConstraints: 'medium', // Variable connection quality
    priorityBrowsers: ['chrome', 'safari', 'samsung']
  },
  
  // Low-resource environments
  lowResource: {
    name: 'Low-Resource Devices',
    importance: 'medium',
    description: 'Devices with limited memory and processing power',
    memoryConstraints: 'low', // <2GB RAM
    networkConstraints: 'low', // Slow, potentially unstable connections
    priorityBrowsers: ['chrome', 'safari', 'samsung']
  },
  
  // Progressive Web App context
  pwa: {
    name: 'Progressive Web App',
    importance: 'medium',
    description: 'When running as an installed PWA',
    memoryConstraints: 'variable',
    networkConstraints: 'variable', // Including offline scenarios
    priorityBrowsers: ['chrome', 'safari', 'edge']
  },
  
  // WebView environments
  webview: {
    name: 'WebView Contexts',
    importance: 'low',
    description: 'When running inside native app WebViews',
    memoryConstraints: 'medium',
    networkConstraints: 'medium',
    priorityBrowsers: ['chrome', 'safari']
  }
};

/**
 * Test result status categories
 * @constant {Object}
 */
export const TEST_STATUS = {
  PASS: 'pass',
  FAIL: 'fail',
  PARTIAL: 'partial',
  UNTESTED: 'untested'
};

/**
 * Generate a test ID from browser, version, platform, and feature
 * 
 * @param {string} browser - Browser identifier
 * @param {string} version - Browser version
 * @param {string} platform - Platform identifier
 * @param {string} feature - Feature identifier
 * @returns {string} Test ID
 */
export function generateTestId(browser, version, platform, feature) {
  return `${browser}_${version.replace(/[-\s.]/g, '_')}_${platform}_${feature}`;
}

/**
 * Generate all test combinations from the matrix
 * 
 * @returns {Array<Object>} Array of test combinations
 */
export function generateTestCombinations() {
  const combinations = [];
  
  // Iterate through browsers
  for (const [browserId, browser] of Object.entries(BROWSER_MATRIX)) {
    // Iterate through versions
    for (const versionInfo of browser.versions) {
      // Iterate through platforms
      for (const platform of browser.platforms) {
        // Iterate through feature categories
        for (const [categoryId, features] of Object.entries(FEATURES_TO_TEST)) {
          // Iterate through features
          for (const feature of features) {
            combinations.push({
              browserId,
              browserName: browser.name,
              versionInfo,
              platform,
              categoryId,
              feature,
              testId: generateTestId(browserId, versionInfo.version, platform, feature.name.replace(/\s+/g, '_'))
            });
          }
        }
      }
    }
  }
  
  return combinations;
}

/**
 * Filter test combinations by priority
 * 
 * @param {Array<Object>} combinations - All test combinations
 * @param {string} priority - Priority level ('critical', 'high', 'medium', 'low')
 * @returns {Array<Object>} Filtered test combinations
 */
export function filterByPriority(combinations, priority) {
  const priorityLevels = {
    critical: 3,
    high: 2,
    medium: 1,
    low: 0
  };
  
  const minPriorityLevel = priorityLevels[priority] || 0;
  
  return combinations.filter(combo => {
    const browserPriority = priorityLevels[combo.versionInfo.priority] || 0;
    const featurePriority = combo.feature.critical ? 3 : 1;
    
    // Consider both browser and feature priority
    return (browserPriority + featurePriority) / 2 >= minPriorityLevel;
  });
}

export default {
  BROWSER_MATRIX,
  FEATURES_TO_TEST,
  TEST_ENVIRONMENTS,
  TEST_STATUS,
  generateTestId,
  generateTestCombinations,
  filterByPriority
};