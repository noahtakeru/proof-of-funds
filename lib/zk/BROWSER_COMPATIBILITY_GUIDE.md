# Browser Compatibility System Guide

This guide explains how to use the Browser Compatibility System to ensure optimal performance and compatibility across different browser environments when working with zero-knowledge proofs.

## Table of Contents

1. [Overview](#overview)
2. [Feature Detection](#feature-detection)
3. [Performance Benchmarking](#performance-benchmarking)
4. [Compatibility Levels](#compatibility-levels)
5. [Adaptive Execution Paths](#adaptive-execution-paths)
6. [Usage Guide](#usage-guide)
7. [Known Issues & Workarounds](#known-issues--workarounds)
8. [Browser Requirements](#browser-requirements)
9. [Performance Monitoring](#performance-monitoring)
10. [API Reference](#api-reference)

## Overview

The Browser Compatibility System provides sophisticated feature detection, performance benchmarking, and adaptive execution strategies for zero-knowledge proof operations. It ensures that your application can run efficiently across a wide range of devices and browsers by automatically adapting to the available capabilities.

Key components:
- **Feature Detection**: Detects support for WebAssembly, Web Crypto, Web Workers, SharedArrayBuffer, IndexedDB, and more
- **Performance Benchmarking**: Evaluates CPU performance, memory availability, and WebAssembly execution speed
- **Capability Scoring**: Assigns normalized scores to various performance metrics
- **Adaptive Execution**: Recommends optimal execution strategies based on detected capabilities
- **Compatibility Database**: Provides information about browser version requirements and known issues

## Feature Detection

The system detects the following features:

| Feature | Description | Critical? |
|---------|-------------|-----------|
| WebAssembly | For efficient proof generation and verification | Yes |
| Web Crypto API | For cryptographic operations | Yes |
| Web Workers | For offloading heavy computations | No |
| SharedArrayBuffer | For parallel processing | No |
| IndexedDB | For large data storage | No |
| BigInt | For handling large integers | No |

Example usage:

```javascript
import browserCompatibility from './lib/zk/browserCompatibility.js';

// Check if a specific feature is supported
const hasSharedArrayBuffer = browserCompatibility.isFeatureSupported('sharedArrayBuffer');
console.log(`SharedArrayBuffer support: ${hasSharedArrayBuffer ? 'Yes' : 'No'}`);

// Get detailed feature support information
const capabilities = browserCompatibility.detectFeatures();
console.log('Feature support:', capabilities.features);
```

## Performance Benchmarking

The system includes benchmarks for:

1. **Memory Availability**: Detects available device memory and assigns a normalized score
2. **CPU Performance**: Runs a JavaScript benchmark to evaluate processing power
3. **WebAssembly Performance**: Measures WebAssembly instantiation and execution speed

Each metric receives a score from 0-100, with higher scores indicating better performance.

Example usage:

```javascript
import browserCompatibility from './lib/zk/browserCompatibility.js';

// Run the WebAssembly benchmark
const wasmBenchmark = browserCompatibility.benchmarkWebAssembly();
console.log(`WebAssembly execution time: ${wasmBenchmark.executionTime}ms`);
console.log(`WebAssembly performance score: ${wasmBenchmark.score}/100`);

// Get all performance scores
const capabilities = browserCompatibility.detectFeatures();
console.log('Memory score:', capabilities.performance.memory);
console.log('CPU score:', capabilities.performance.cpu);
console.log('Overall performance score:', capabilities.performance.overall);
```

## Compatibility Levels

The system classifies device compatibility into these levels:

| Level | Description | Requirements |
|-------|-------------|--------------|
| Full | Complete support for all features | WebAssembly, Web Crypto, Web Workers, SharedArrayBuffer, 80+ performance score |
| High | Good support with some limitations | WebAssembly, Web Crypto, Web Workers, 60+ performance score |
| Medium | Basic support for essential features | WebAssembly, Web Crypto, 40+ performance score |
| Low | Minimal support with significant limitations | WebAssembly, Web Crypto, <40 performance score |
| Incompatible | Missing critical features | Missing WebAssembly or Web Crypto |

Example usage:

```javascript
import browserCompatibility from './lib/zk/browserCompatibility.js';

const capabilities = browserCompatibility.detectFeatures();
console.log(`Compatibility level: ${capabilities.compatibility.level}`);

// Check if browser meets minimum requirements
console.log(`Supported browser: ${capabilities.browser.isSupported ? 'Yes' : 'No'}`);
```

## Adaptive Execution Paths

Based on the detected capabilities, the system recommends one of these execution paths:

1. **Full Client-Side Execution** (ideal): All operations run on the client with full optimizations
2. **Web Worker Offloading**: Heavy computations run in parallel Web Workers
3. **Progressive Loading**: Circuit data loaded and processed in smaller chunks
4. **Hybrid Approach**: Complex operations offloaded to server, simple ones on client
5. **Server-Side Fallback** (minimal capability): All operations run on the server

Example usage:

```javascript
import browserCompatibility from './lib/zk/browserCompatibility.js';

const capabilities = browserCompatibility.detectFeatures();
const recommendedPath = capabilities.compatibility.recommendedPath;
console.log(`Recommended execution path: ${recommendedPath}`);

// Check which paths are available
const paths = capabilities.degradationPath;
console.log('Available paths:', Object.keys(paths).filter(path => paths[path].available));
```

## Usage Guide

### Basic Integration

To integrate the browser compatibility system into your application:

1. Import the module:

```javascript
import browserCompatibility from './lib/zk/browserCompatibility.js';
```

2. Detect capabilities at application startup:

```javascript
// Run the full capability detection
const capabilities = browserCompatibility.detectFeatures();

// Store the result for use throughout the application
window.zkCapabilities = capabilities;
```

3. Adapt your application behavior based on the recommended execution path:

```javascript
function runZkOperation(inputData) {
  const capabilities = window.zkCapabilities;
  
  switch (capabilities.compatibility.recommendedPath) {
    case 'clientSide':
      return runFullClientSideMode(inputData);
    case 'webWorker':
      return runWebWorkerMode(inputData);
    case 'progressiveLoading':
      return runProgressiveLoadingMode(inputData);
    case 'hybrid':
      return runHybridMode(inputData);
    case 'serverSide':
    default:
      return runServerSideMode(inputData);
  }
}
```

### Advanced Usage

For more granular control, you can examine specific features and performance metrics:

```javascript
const capabilities = browserCompatibility.detectFeatures();

// Check for SharedArrayBuffer support for parallel processing
if (capabilities.features.sharedArrayBuffer) {
  // Enable parallel processing features
  enableParallelProcessing();
}

// Adjust circuit complexity based on memory score
if (capabilities.performance.memory >= 70) {
  // Use high-complexity circuits for better privacy
  useHighComplexityCircuits();
} else if (capabilities.performance.memory >= 40) {
  // Use medium-complexity circuits
  useMediumComplexityCircuits();
} else {
  // Use simple circuits or server-side processing
  useSimpleCircuits();
}

// Handle known browser issues
if (capabilities.browser.name === 'safari' && parseFloat(capabilities.browser.version) < 14) {
  // Apply Safari-specific workarounds
  applySafariWorkarounds();
}
```

## Known Issues & Workarounds

The system maintains a database of known browser issues and provides workarounds:

```javascript
import browserCompatibility from './lib/zk/browserCompatibility.js';

// Get known issues for the current browser
const specialHandling = browserCompatibility.getSpecialHandlingRequirements();

if (specialHandling.hasSpecialRequirements) {
  console.log('This browser needs special handling:');
  specialHandling.issues.forEach(issue => console.log(` - ${issue}`));
  console.log('Recommended handling:', specialHandling.recommendedHandling);
}
```

Key issues include:

1. **SharedArrayBuffer Requirements**:
   - Requires cross-origin isolation in Chrome 87+, Firefox 79+, Safari 15+
   - Workaround: Set required headers or use alternative synchronization methods

2. **Safari IndexedDB Issues**:
   - Unreliable in private browsing mode
   - Workaround: Fall back to server-side computation when in private browsing

3. **Mobile Memory Limitations**:
   - Limited available memory on mobile devices
   - Workaround: Use progressive loading and smaller circuit chunks

4. **Safari WebAssembly Limitations**:
   - Limited memory for WebAssembly in older versions
   - Workaround: Use smaller circuit chunks and process sequentially

## Browser Requirements

The minimum browser versions for full compatibility are:

| Browser | Minimum Version |
|---------|----------------|
| Chrome | 67+ |
| Firefox | 63+ |
| Safari | 14+ |
| Edge (Chromium) | 79+ |
| Opera | 54+ |
| Samsung Internet | 9+ |
| Internet Explorer | Not Supported |

To get specific browser requirements:

```javascript
import browserCompatibility from './lib/zk/browserCompatibility.js';

// Get browser version requirements
const requirements = browserCompatibility.getBrowserRequirements();
console.log('Minimum Chrome version:', requirements.minimumVersions.chrome);

// Check if a feature is supported in a specific browser version
const minVersionForWebAssembly = browserCompatibility.getMinimumBrowserVersion('webAssembly', 'chrome');
console.log(`Chrome needs version ${minVersionForWebAssembly}+ for WebAssembly support`);
```

## Performance Monitoring

The system can track performance over time to identify trends and issues:

```javascript
import browserCompatibility from './lib/zk/browserCompatibility.js';

// Get historical performance data
const performanceHistory = browserCompatibility.getPerformanceHistory();

if (performanceHistory && performanceHistory.length > 0) {
  console.log(`Found ${performanceHistory.length} historical performance entries`);
  
  // Analyze performance trends
  const latestScore = performanceHistory[performanceHistory.length - 1].data.performance.overall;
  const earliestScore = performanceHistory[0].data.performance.overall;
  
  console.log(`Performance trend: ${latestScore > earliestScore ? 'Improving' : 'Declining'}`);
}
```

## API Reference

### Main Functions

| Function | Description | Parameters | Return Value |
|----------|-------------|------------|--------------|
| `detectFeatures()` | Runs comprehensive feature detection | None | BrowserCapabilities object |
| `isFeatureSupported(featureName)` | Checks if a specific feature is supported | featureName: string | boolean |
| `getMinimumBrowserVersion(featureName, browserName)` | Gets minimum version for feature support | featureName: string, browserName: string | number or null |
| `getBrowserRequirements()` | Gets browser version requirements | None | Requirements object |
| `getPerformanceHistory()` | Gets historical performance data | None | Array or null |
| `getSpecialHandlingRequirements()` | Gets browser-specific handling recommendations | None | Object with issues and recommendations |
| `benchmarkWebAssembly()` | Runs WebAssembly performance benchmark | None | Benchmark results object |
| `benchmarkCPU()` | Runs CPU performance benchmark | None | Benchmark results object |

### Constants

| Constant | Description |
|----------|-------------|
| `BROWSER_VERSION_REQUIREMENTS` | Minimum browser versions for full compatibility |
| `FEATURE_SUPPORT_MATRIX` | Feature support information by browser and version |
| `KNOWN_ISSUES` | Known browser issues and workarounds |

### Feature Detection

```javascript
// Run all feature detection
const capabilities = browserCompatibility.detectFeatures();

// Output structure:
{
  features: {
    webAssembly: true,
    webAssemblyStreaming: true,
    webCrypto: true,
    webCryptoSubtle: true,
    webWorkers: true,
    sharedArrayBuffer: false,
    indexedDB: true,
    bigInt: true
  },
  browser: {
    name: "chrome",
    version: "109.0.0.0",
    isMobile: false,
    isSupported: true
  },
  performance: {
    memory: 85,
    cpu: 78,
    webAssembly: 92,
    overall: 84.55
  },
  compatibility: {
    level: "high",
    recommendedPath: "webWorker",
    issues: []
  },
  degradationPath: {
    clientSide: { available: true, recommended: false, ... },
    webWorker: { available: true, recommended: true, ... },
    progressiveLoading: { available: true, recommended: false, ... },
    hybrid: { available: true, recommended: false, ... },
    serverSide: { available: true, recommended: false, ... }
  }
}
```

For more detailed examples, see the test script at `/lib/zk/__tests__/browser-compatibility-test.js`.