# Browser Compatibility Guide

## Overview

This document provides comprehensive guidance on browser compatibility for the ZK infrastructure. It includes:

1. **Browser Support Matrix**: Supported browsers, versions, and platforms
2. **Feature Requirements**: Required browser features for ZK operations
3. **Graceful Degradation**: Handling browsers with limited capabilities
4. **Testing Procedures**: How to verify browser compatibility
5. **Troubleshooting Guide**: Resolving common browser-specific issues

## Browser Support Matrix

The ZK infrastructure supports the following browsers and platforms:

| Browser | Versions | Desktop | Mobile | Notes |
|---------|----------|---------|--------|-------|
| Chrome | 91+ | ✅ Full | ✅ Full | Primary target with full support |
| Firefox | 90+ | ✅ Full | ✅ Full | Strong WebAssembly and Crypto API support |
| Safari | 14+ | ⚠️ Partial | ⚠️ Partial | Limited WebAssembly streaming, may require server fallback |
| Edge | 91+ | ✅ Full | ✅ Full | Based on Chromium, similar to Chrome |
| Brave | Latest | ✅ Full | ✅ Full | Popular in crypto community |
| Opera | Latest | ✅ Full | ✅ Full | Based on Chromium |
| Samsung Internet | Latest | N/A | ⚠️ Partial | Limited WebAssembly performance |

### Support Levels:

- **Full**: All features work as expected with client-side operations
- **Partial**: Core features work, but may use server-side fallbacks for some operations
- **Limited**: Basic functionality with heavy reliance on server-side operations
- **Unsupported**: Not compatible with the ZK infrastructure

## Required Browser Features

The following browser features are required for optimal ZK functionality:

### Critical Features (Must Have)

| Feature | Description | Used For | Fallback |
|---------|-------------|----------|----------|
| WebAssembly | Core WebAssembly support | Proof generation and verification | Server-side execution |
| Web Crypto API | Standard cryptographic operations | Random generation, hashing | Server-side crypto |
| Fetch API | Network requests | API communication | XMLHttpRequest |
| BigInt | Large integer operations | Cryptographic calculations | Server-side math |
| Secure Context | HTTPS security guarantees | Crypto API access | Limited functionality |

### Important Features (Should Have)

| Feature | Description | Used For | Fallback |
|---------|-------------|----------|----------|
| IndexedDB | Client-side database | Proof storage | LocalStorage or server storage |
| Web Workers | Parallel processing | Background calculations | Main thread execution |
| SharedArrayBuffer | Shared memory | Efficient large data processing | Separate memory copies |
| WebAssembly Streaming | Streaming compilation | Faster loading | Regular WebAssembly loading |
| AbortController | Request cancellation | Timeout management | Manual timeout handling |

### Optional Features (Nice to Have)

| Feature | Description | Used For | Fallback |
|---------|-------------|----------|----------|
| Cache API | Resource caching | Circuit caching | Network requests |
| Storage Estimation | Storage limit detection | Resource management | Conservative limits |
| Performance API | Performance measurement | Optimization | Basic timing |
| DeviceMemory API | Memory detection | Resource allocation | Conservative allocation |
| Web Locks API | Resource locking | Concurrency control | In-memory locks |

## Memory and Performance Requirements

Different operations require varying levels of memory and computational resources:

| Operation | Memory Required | CPU Intensity | Network | Fallback Threshold |
|-----------|----------------|--------------|---------|-------------------|
| Standard Proof Generation | 50-100MB | High | Medium | <4GB RAM or slow CPU |
| Threshold Proof Generation | 100-200MB | High | Medium | <8GB RAM or slow CPU |
| Maximum Proof Generation | 200-500MB | Very High | High | Always consider server |
| Proof Verification | 10-50MB | Medium | Low | <2GB RAM |
| Key Generation | 5-20MB | Medium | Minimal | <1GB RAM |

## Execution Modes

The ZK infrastructure supports multiple execution modes to accommodate different browser capabilities:

### Client-Side Execution

- **Requirements**: Full WebAssembly and Web Crypto support, sufficient memory
- **Benefits**: Privacy (data stays local), reduced server load, no network latency
- **Best For**: Modern desktop browsers on capable hardware

### Server-Side Execution

- **Requirements**: Basic fetch support, network connectivity
- **Benefits**: Works on all browsers, consistent performance, reduced client resource usage
- **Best For**: Mobile browsers, older browsers, low-power devices

### Hybrid Execution

- **Requirements**: Partial WebAssembly support, limited memory
- **Benefits**: Balances privacy and performance, adapts to resource availability
- **Best For**: Mid-range mobile devices, browsers with partial WebAssembly support

### Auto Mode (Default)

- Automatically selects the best execution mode based on browser capabilities
- Performs runtime feature detection and resource assessment
- Falls back gracefully if initial mode selection fails
- Remembers successful modes for future operations

## Graceful Degradation Path

The system follows this degradation path when encountering limitations:

1. **Full Client-Side**: All operations performed in-browser
2. **Optimized Client-Side**: Use memory-optimized algorithms with slightly lower performance
3. **Hybrid Mode**: Split computation between client and server
4. **Progressive Loading**: Stream and process data incrementally
5. **Worker Offloading**: Move intense operations to web workers
6. **Server Assistance**: Get partial help from server for complex steps
7. **Full Server-Side**: Delegate all operations to the server
8. **Simplified Operations**: Offer reduced functionality if all else fails

## Feature Detection and Testing

### Testing Procedure

1. Access the compatibility test page at `/lib/zk/html/browser-compatibility-test.html`
2. Run comprehensive tests to evaluate all features
3. Review test results to identify potential issues
4. Check performance metrics for resource-intensive operations
5. Verify graceful degradation if critical features are missing

### Programmatic Feature Detection

The `browserCompatibility.js` module provides methods to detect features programmatically:

```javascript
import { detectFeatures } from './browserCompatibility';

// Get detailed capability report
const capabilities = detectFeatures();

console.log(capabilities.features.webAssembly); // true/false
console.log(capabilities.performance.memory); // available memory estimate
console.log(capabilities.compatibility.level); // "full", "partial", "limited" or "unsupported"
console.log(capabilities.compatibility.recommendedPath); // recommended execution mode
```

## Troubleshooting Common Issues

### Safari Issues

**Problem**: WebAssembly memory limitations on Safari iOS
**Solution**: Enable server-side fallback by setting `preferServerSide: true`

**Problem**: IndexedDB reliability issues in private browsing
**Solution**: Check for errors and fall back to in-memory storage

### Firefox Issues

**Problem**: SharedArrayBuffer restrictions
**Solution**: Use the fallback implementation with separate memory

### Mobile Browser Issues

**Problem**: Limited memory crashes proof generation
**Solution**: Use the `zkProxyClient.setExecutionMode(EXECUTION_MODES.SERVER_SIDE)` method

### General Performance Issues

**Problem**: Slow proof generation
**Solution**: 
1. Reduce other browser activity
2. Close unused tabs to free memory
3. Use `maxMemoryUsage` option to limit resource usage
4. Fall back to server-side execution

## Integration Guidelines

When integrating the ZK infrastructure into applications:

1. **Early Feature Detection**: Test for critical features during application initialization
2. **Configurable Fallbacks**: Allow users to choose execution mode based on their preferences
3. **Progressive Enhancement**: Enhance the experience on more capable browsers
4. **Memory Management**: Monitor and manage memory usage during intensive operations
5. **Telemetry**: Collect anonymous usage data to identify browser-specific issues

## Browser-Specific Optimizations

### Chrome/Edge/Brave

- Leverage full WebAssembly capabilities
- Use Web Workers for parallel processing
- Utilize SharedArrayBuffer for efficient memory management

### Firefox

- Implement separate memory fallbacks for SharedArrayBuffer limitations
- Use optimized WebAssembly compilation

### Safari

- Implement memory-conservative algorithms
- Add additional error handling for WebAssembly
- Ensure proper cleanup of resources

### Mobile Browsers

- Implement progressive loading for large circuits
- Use server-side pre-processing for complex operations
- Optimize UI for operation progress visibility

## Conclusion

The ZK infrastructure is designed to work across a wide range of browsers with varying capabilities. Through feature detection, graceful degradation, and flexible execution modes, it ensures that users can access ZK functionality regardless of their browser environment.

For optimal performance and security, Chrome 91+ or Firefox 90+ on desktop platforms are recommended. However, the system will adapt to provide the best possible experience on all supported browsers.

## Testing Resources

- [Browser Compatibility Test Page](/lib/zk/html/browser-compatibility-test.html)
- [Feature Detection Module](/lib/zk/src/browserCompatibility.js)
- [Compatibility Test Runner](/lib/zk/src/CompatibilityTestRunner.js)
- [Browser Tests Implementation](/lib/zk/src/browser-compatibility-tests.js)