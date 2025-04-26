/**
 * Browser Compatibility Test Implementations
 * 
 * This module provides implementations of browser compatibility tests
 * defined in the browser compatibility matrix.
 */

/**
 * Helper method to measure execution time of a function
 * 
 * @param {Function} fn - Function to measure
 * @returns {Object} Result with execution time
 */
async function measureExecutionTime(fn) {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  return {
    ...result,
    duration: end - start
  };
}

/**
 * Core feature tests
 */

// Test WebAssembly support
export async function testWebAssemblySupport() {
  return measureExecutionTime(async () => {
    try {
      if (typeof WebAssembly !== 'object') {
        return {
          passed: false,
          message: 'WebAssembly not available',
          details: { webAssemblyExists: false }
        };
      }
      
      // Basic WebAssembly module to test instantiation
      const bytes = new Uint8Array([
        0x00, 0x61, 0x73, 0x6d, // wasm magic bytes
        0x01, 0x00, 0x00, 0x00, // wasm version 1
        0x01, 0x07, 0x01, 0x60, 0x02, 0x7f, 0x7f, 0x01, 0x7f, // Function type (i32, i32) -> i32
        0x03, 0x02, 0x01, 0x00, // Function declaration
        0x07, 0x07, 0x01, 0x03, 0x61, 0x64, 0x64, 0x00, 0x00, // Export: name="add", index=0
        0x0a, 0x09, 0x01, 0x07, 0x00, 0x20, 0x00, 0x20, 0x01, 0x6a, 0x0b // Code section
      ]);
      
      // Compile and instantiate the module
      const module = await WebAssembly.compile(bytes);
      const instance = await WebAssembly.instantiate(module);
      
      // Test the exported function
      const result = instance.exports.add(40, 2);
      
      return {
        passed: result === 42,
        message: result === 42 ? 'WebAssembly supported and functional' : 'WebAssembly function returned incorrect result',
        details: {
          webAssemblyExists: true,
          compilationSucceeded: true,
          instantiationSucceeded: true,
          executionSucceeded: result === 42
        }
      };
    } catch (error) {
      return {
        passed: false,
        message: `WebAssembly test failed: ${error.message}`,
        details: {
          webAssemblyExists: typeof WebAssembly === 'object',
          error: error.message
        }
      };
    }
  });
}

// Test WebAssembly streaming compilation
export async function testWebAssemblyStreaming() {
  return measureExecutionTime(async () => {
    try {
      if (typeof WebAssembly !== 'object' || 
          typeof WebAssembly.instantiateStreaming !== 'function') {
        return {
          passed: false,
          message: 'WebAssembly streaming compilation not supported',
          details: {
            webAssemblyExists: typeof WebAssembly === 'object',
            streamingExists: typeof WebAssembly.instantiateStreaming === 'function'
          }
        };
      }
      
      // Note: In a real implementation, we would fetch a WASM file
      // In this test implementation, we're just checking API availability
      
      return {
        passed: true,
        message: 'WebAssembly streaming compilation API available',
        details: {
          webAssemblyExists: true,
          streamingExists: true
        }
      };
    } catch (error) {
      return {
        passed: false,
        message: `WebAssembly streaming test failed: ${error.message}`,
        details: {
          webAssemblyExists: typeof WebAssembly === 'object',
          streamingExists: typeof WebAssembly.instantiateStreaming === 'function',
          error: error.message
        }
      };
    }
  });
}

// Test Web Crypto API
export async function testWebCryptoAPI() {
  return measureExecutionTime(async () => {
    try {
      if (typeof crypto !== 'object' || !crypto.subtle) {
        return {
          passed: false,
          message: 'Web Crypto API not available',
          details: {
            cryptoExists: typeof crypto === 'object',
            subtleExists: !!crypto.subtle
          }
        };
      }
      
      // Generate a random value
      const array = new Uint8Array(16);
      crypto.getRandomValues(array);
      
      // Test basic hashing
      const data = new TextEncoder().encode('test data');
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      return {
        passed: hashHex.length === 64,
        message: 'Web Crypto API supported and functional',
        details: {
          cryptoExists: true,
          subtleExists: true,
          randomGenerationWorks: array.some(value => value > 0),
          hashingWorks: hashHex.length === 64
        }
      };
    } catch (error) {
      return {
        passed: false,
        message: `Web Crypto API test failed: ${error.message}`,
        details: {
          cryptoExists: typeof crypto === 'object',
          subtleExists: !!crypto?.subtle,
          error: error.message
        }
      };
    }
  });
}

// Test secure random generation
export async function testSecureRandomGeneration() {
  return measureExecutionTime(async () => {
    try {
      if (typeof crypto !== 'object' || !crypto.getRandomValues) {
        return {
          passed: false,
          message: 'Secure random generation not available',
          details: {
            cryptoExists: typeof crypto === 'object',
            getRandomValuesExists: !!crypto?.getRandomValues
          }
        };
      }
      
      // Generate multiple random arrays to test entropy
      const arrays = [];
      for (let i = 0; i < 5; i++) {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        arrays.push(Array.from(array));
      }
      
      // Check if arrays are different (basic entropy check)
      let allDifferent = true;
      for (let i = 0; i < arrays.length - 1; i++) {
        for (let j = i + 1; j < arrays.length; j++) {
          const equal = arrays[i].every((value, index) => value === arrays[j][index]);
          if (equal) {
            allDifferent = false;
            break;
          }
        }
      }
      
      return {
        passed: allDifferent,
        message: allDifferent 
          ? 'Secure random generation is working properly' 
          : 'Random generation produced duplicate values',
        details: {
          cryptoExists: true,
          getRandomValuesExists: true,
          entropyCheck: allDifferent
        }
      };
    } catch (error) {
      return {
        passed: false,
        message: `Secure random generation test failed: ${error.message}`,
        details: {
          cryptoExists: typeof crypto === 'object',
          getRandomValuesExists: !!crypto?.getRandomValues,
          error: error.message
        }
      };
    }
  });
}

// Test BigInt support
export async function testBigIntSupport() {
  return measureExecutionTime(async () => {
    try {
      if (typeof BigInt !== 'function') {
        return {
          passed: false,
          message: 'BigInt not supported',
          details: {
            bigIntExists: false
          }
        };
      }
      
      // Test basic BigInt operations
      const a = BigInt('1234567890123456789012345678901234567890');
      const b = BigInt('9876543210987654321098765432109876543210');
      
      const sum = a + b;
      const product = a * b;
      const quotient = b / a;
      
      const expectedSum = BigInt('11111111101111111110111111111011111111100');
      const expectedProduct = BigInt('12193263111263526900219892151574541292989242896435121120253153146219490742900');
      const expectedQuotient = BigInt('8');
      
      const operationsCorrect = 
        sum === expectedSum && 
        product === expectedProduct && 
        quotient === expectedQuotient;
      
      return {
        passed: operationsCorrect,
        message: operationsCorrect 
          ? 'BigInt is fully supported' 
          : 'BigInt operations returned incorrect results',
        details: {
          bigIntExists: true,
          operationsCorrect,
          sum: sum.toString(),
          product: product.toString(),
          quotient: quotient.toString()
        }
      };
    } catch (error) {
      return {
        passed: false,
        message: `BigInt test failed: ${error.message}`,
        details: {
          bigIntExists: typeof BigInt === 'function',
          error: error.message
        }
      };
    }
  });
}

/**
 * Storage feature tests
 */

// Test IndexedDB support
export async function testIndexedDBSupport() {
  return measureExecutionTime(async () => {
    try {
      if (!window.indexedDB) {
        return {
          passed: false,
          message: 'IndexedDB not supported',
          details: {
            indexedDBExists: false
          }
        };
      }
      
      // Test DB name with timestamp to avoid conflicts
      const dbName = `compatibility-test-${Date.now()}`;
      
      // Open database 
      const openRequest = indexedDB.open(dbName, 1);
      
      // Wrap IndexedDB API in Promise
      const result = await new Promise((resolve, reject) => {
        openRequest.onerror = (event) => {
          reject(new Error(`IndexedDB open failed: ${event.target.errorCode}`));
        };
        
        openRequest.onupgradeneeded = (event) => {
          const db = event.target.result;
          const store = db.createObjectStore('testStore', { keyPath: 'id' });
        };
        
        openRequest.onsuccess = async (event) => {
          const db = event.target.result;
          
          // Test transaction
          const transaction = db.transaction('testStore', 'readwrite');
          
          transaction.onerror = (event) => {
            reject(new Error(`Transaction failed: ${event.target.errorCode}`));
          };
          
          const store = transaction.objectStore('testStore');
          
          // Add test data
          const testData = { id: 1, value: 'test', date: new Date() };
          const addRequest = store.add(testData);
          
          addRequest.onsuccess = () => {
            // Read test data
            const getRequest = store.get(1);
            
            getRequest.onsuccess = () => {
              const readData = getRequest.result;
              const dataMatches = 
                readData && 
                readData.id === testData.id && 
                readData.value === testData.value;
              
              // Close and delete the test database
              db.close();
              indexedDB.deleteDatabase(dbName);
              
              resolve({
                passed: dataMatches,
                message: dataMatches 
                  ? 'IndexedDB is fully supported' 
                  : 'IndexedDB read/write operation failed',
                details: {
                  indexedDBExists: true,
                  openSucceeded: true,
                  transactionSucceeded: true,
                  writeSucceeded: true,
                  readSucceeded: !!readData,
                  dataMatches
                }
              });
            };
            
            getRequest.onerror = (event) => {
              db.close();
              indexedDB.deleteDatabase(dbName);
              reject(new Error(`Get request failed: ${event.target.errorCode}`));
            };
          };
          
          addRequest.onerror = (event) => {
            db.close();
            indexedDB.deleteDatabase(dbName);
            reject(new Error(`Add request failed: ${event.target.errorCode}`));
          };
        };
      });
      
      return result;
    } catch (error) {
      return {
        passed: false,
        message: `IndexedDB test failed: ${error.message}`,
        details: {
          indexedDBExists: !!window.indexedDB,
          error: error.message
        }
      };
    }
  });
}

// Test LocalStorage limits
export async function testLocalStorageLimits() {
  return measureExecutionTime(async () => {
    try {
      if (!window.localStorage) {
        return {
          passed: false,
          message: 'LocalStorage not supported',
          details: {
            localStorageExists: false
          }
        };
      }
      
      // Save existing items to restore later
      const existingItems = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        existingItems[key] = localStorage.getItem(key);
      }
      
      // Test key with timestamp to avoid conflicts
      const testKey = `compatibility-test-${Date.now()}`;
      
      // Test basic functionality
      localStorage.setItem(testKey, 'test');
      const basicWorks = localStorage.getItem(testKey) === 'test';
      
      // Storage size test
      // Start with 1KB and increase exponentially until error
      let sizeKB = 1;
      let maxSizeKB = 0;
      const oneKB = 'A'.repeat(1024); // 1 kilobyte of data
      
      try {
        while (sizeKB <= 16384) { // Up to 16MB (most browsers limit at 5-10MB)
          const key = `${testKey}-${sizeKB}`;
          const value = oneKB.repeat(sizeKB);
          localStorage.setItem(key, value);
          maxSizeKB = sizeKB;
          
          // Verify the stored data
          const retrievedValue = localStorage.getItem(key);
          if (!retrievedValue || retrievedValue.length !== value.length) {
            break;
          }
          
          // Double the size for next iteration
          sizeKB *= 2;
        }
      } catch (e) {
        // Storage full error, which is expected
      }
      
      // Clean up test keys
      localStorage.removeItem(testKey);
      for (let size = 1; size <= maxSizeKB * 2; size *= 2) {
        localStorage.removeItem(`${testKey}-${size}`);
      }
      
      // Restore existing items
      for (const [key, value] of Object.entries(existingItems)) {
        localStorage.setItem(key, value);
      }
      
      return {
        passed: basicWorks && maxSizeKB > 0,
        message: basicWorks 
          ? `LocalStorage supported with ~${maxSizeKB}KB capacity` 
          : 'LocalStorage basic operations failed',
        details: {
          localStorageExists: true,
          basicOperationsWork: basicWorks,
          maxSizeKB,
          estimatedMaxSizeMB: (maxSizeKB / 1024).toFixed(2)
        }
      };
    } catch (error) {
      return {
        passed: false,
        message: `LocalStorage test failed: ${error.message}`,
        details: {
          localStorageExists: !!window.localStorage,
          error: error.message
        }
      };
    }
  });
}

/**
 * Network feature tests
 */

// Test Fetch API support
export async function testFetchAPISupport() {
  return measureExecutionTime(async () => {
    try {
      if (typeof fetch !== 'function') {
        return {
          passed: false,
          message: 'Fetch API not supported',
          details: {
            fetchExists: false
          }
        };
      }
      
      // Test with a reliable endpoint
      const response = await fetch('https://httpbin.org/get');
      const json = await response.json();
      
      return {
        passed: response.ok && !!json,
        message: response.ok 
          ? 'Fetch API is fully supported' 
          : `Fetch API request failed: ${response.status} ${response.statusText}`,
        details: {
          fetchExists: true,
          responseOk: response.ok,
          responseStatus: response.status,
          responseHasData: !!json
        }
      };
    } catch (error) {
      return {
        passed: false,
        message: `Fetch API test failed: ${error.message}`,
        details: {
          fetchExists: typeof fetch === 'function',
          error: error.message
        }
      };
    }
  });
}

// Test AbortController support
export async function testAbortControllerSupport() {
  return measureExecutionTime(async () => {
    try {
      if (typeof AbortController !== 'function') {
        return {
          passed: false,
          message: 'AbortController not supported',
          details: {
            abortControllerExists: false
          }
        };
      }
      
      // Create controller and signal
      const controller = new AbortController();
      const signal = controller.signal;
      
      // Start fetch and abort it immediately
      const fetchPromise = fetch('https://httpbin.org/delay/3', { signal });
      
      // Abort the request after a small delay
      setTimeout(() => controller.abort(), 50);
      
      let abortedSuccessfully = false;
      try {
        await fetchPromise;
      } catch (error) {
        // DOMException with name "AbortError" is expected
        abortedSuccessfully = error.name === 'AbortError';
      }
      
      return {
        passed: abortedSuccessfully,
        message: abortedSuccessfully 
          ? 'AbortController is fully supported' 
          : 'AbortController did not properly abort the request',
        details: {
          abortControllerExists: true,
          abortedSuccessfully
        }
      };
    } catch (error) {
      return {
        passed: false,
        message: `AbortController test failed: ${error.message}`,
        details: {
          abortControllerExists: typeof AbortController === 'function',
          error: error.message
        }
      };
    }
  });
}

/**
 * Performance feature tests
 */

// Test memory constraints
export async function testMemoryConstraints() {
  return measureExecutionTime(async () => {
    try {
      // Use performance.memory if available (Chrome only)
      const performanceMemory = performance.memory 
        ? {
            jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / (1024 * 1024)),
            totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / (1024 * 1024)),
            usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / (1024 * 1024))
          } 
        : null;
      
      // Try to allocate increasingly large arrays to test memory limits
      // Start with 1MB and increase until error or 512MB
      let maxArraySizeMB = 0;
      let currentSizeMB = 1;
      let bigArray = null;
      
      while (currentSizeMB <= 512) {
        try {
          // Clean up previous array to avoid accumulating
          bigArray = null;
          
          // Force garbage collection if possible (only works in dev tools)
          if (global.gc) {
            global.gc();
          }
          
          // Allocate array (1MB = 1024 * 1024 / 8 = 131072 elements for Float64Array)
          const elements = currentSizeMB * 131072;
          bigArray = new Float64Array(elements);
          
          // Write to array to ensure it's actually allocated
          for (let i = 0; i < elements; i += elements / 100) {
            bigArray[i] = i;
          }
          
          maxArraySizeMB = currentSizeMB;
          currentSizeMB *= 2; // Double the size for next iteration
        } catch (e) {
          // Memory allocation error, which is expected at some point
          break;
        }
      }
      
      // Clean up
      bigArray = null;
      
      // Rough estimate of available memory
      // Conservative - most browsers can allocate more than this test shows
      const estimatedMemoryMB = maxArraySizeMB * 2;
      
      return {
        passed: maxArraySizeMB >= 16, // At least 16MB should be allocatable for ZK operations
        message: `Browser can allocate ~${maxArraySizeMB}MB arrays (estimated ${estimatedMemoryMB}MB+ available)`,
        details: {
          maxArraySizeMB,
          estimatedMemoryMB,
          performanceMemory,
          deviceMemory: navigator.deviceMemory || 'unknown'
        }
      };
    } catch (error) {
      return {
        passed: false,
        message: `Memory constraints test failed: ${error.message}`,
        details: {
          error: error.message,
          performanceMemory: performance.memory 
            ? {
                jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / (1024 * 1024)),
                totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / (1024 * 1024)),
                usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / (1024 * 1024))
              } 
            : null,
          deviceMemory: navigator.deviceMemory || 'unknown'
        }
      };
    }
  });
}

// Test WebAssembly performance
export async function testWebAssemblyPerformance() {
  return measureExecutionTime(async () => {
    try {
      if (typeof WebAssembly !== 'object') {
        return {
          passed: false,
          message: 'WebAssembly not available',
          details: { webAssemblyExists: false }
        };
      }
      
      // Basic WebAssembly module with a compute-intensive function
      // Calculates factorial iteratively
      const bytes = new Uint8Array([
        0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x06, 0x01, 0x60, 
        0x01, 0x7f, 0x01, 0x7f, 0x03, 0x02, 0x01, 0x00, 0x07, 0x0a, 0x01, 0x06, 
        0x66, 0x61, 0x63, 0x74, 0x6f, 0x72, 0x00, 0x00, 0x0a, 0x15, 0x01, 0x13, 
        0x00, 0x41, 0x01, 0x21, 0x01, 0x03, 0x40, 0x20, 0x00, 0x20, 0x01, 0x7e, 
        0x21, 0x01, 0x20, 0x00, 0x41, 0x7f, 0x6a, 0x22, 0x00, 0x0d, 0x00, 0x0b, 
        0x20, 0x01, 0x0b
      ]);
      
      // Compile and instantiate the module
      const module = await WebAssembly.compile(bytes);
      const instance = await WebAssembly.instantiate(module);
      
      // Run performance test
      const factorial = instance.exports.factor;
      const startTime = performance.now();
      
      // Calculate factorial of numbers 1 to 20 repeatedly
      const iterations = 10000;
      let results = [];
      
      for (let i = 0; i < iterations; i++) {
        const n = (i % 20) + 1; // 1 to 20
        results.push(factorial(n));
      }
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      // Calculate operations per second
      const opsPerSecond = Math.round(iterations / (executionTime / 1000));
      
      // For comparison, run the same test in JavaScript
      const jsFactorial = (n) => {
        let result = 1;
        while (n > 0) {
          result *= n--;
        }
        return result;
      };
      
      const jsStartTime = performance.now();
      let jsResults = [];
      
      for (let i = 0; i < iterations; i++) {
        const n = (i % 20) + 1; // 1 to 20
        jsResults.push(jsFactorial(n));
      }
      
      const jsEndTime = performance.now();
      const jsExecutionTime = jsEndTime - jsStartTime;
      
      // Calculate JavaScript operations per second
      const jsOpsPerSecond = Math.round(iterations / (jsExecutionTime / 1000));
      
      // Calculate WebAssembly speedup over JavaScript
      const speedup = jsExecutionTime > 0 ? (jsExecutionTime / executionTime) : 0;
      
      return {
        passed: opsPerSecond > 50000, // At least 50K operations per second expected
        message: `WebAssembly performance: ${opsPerSecond.toLocaleString()} ops/sec, ${speedup.toFixed(2)}x JavaScript speed`,
        details: {
          webAssemblyExists: true,
          wasmOpsPerSecond: opsPerSecond,
          jsOpsPerSecond,
          wasmExecutionTimeMs: executionTime,
          jsExecutionTimeMs: jsExecutionTime,
          speedupRatio: speedup,
          iterations
        }
      };
    } catch (error) {
      return {
        passed: false,
        message: `WebAssembly performance test failed: ${error.message}`,
        details: {
          webAssemblyExists: typeof WebAssembly === 'object',
          error: error.message
        }
      };
    }
  });
}

/**
 * Security feature tests
 */

// Test if browser reports secure context
export async function testSecureContext() {
  return measureExecutionTime(async () => {
    try {
      const isSecure = window.isSecureContext === true;
      
      return {
        passed: isSecure,
        message: isSecure 
          ? 'Browser correctly reports secure context' 
          : 'Not running in a secure context',
        details: {
          isSecureContext: isSecure,
          protocol: window.location.protocol,
          host: window.location.host
        }
      };
    } catch (error) {
      return {
        passed: false,
        message: `Secure context test failed: ${error.message}`,
        details: {
          error: error.message
        }
      };
    }
  });
}

/**
 * Create test implementation map
 */
export const testImplementations = {
  // Core tests
  testWebAssemblySupport,
  testWebAssemblyStreaming,
  testWebCryptoAPI,
  testSecureRandomGeneration,
  testBigIntSupport,
  
  // Storage tests
  testIndexedDBSupport,
  testLocalStorageLimits,
  
  // Network tests
  testFetchAPISupport,
  testAbortControllerSupport,
  
  // Performance tests
  testMemoryConstraints,
  testWebAssemblyPerformance,
  
  // Security tests
  testSecureContext
};

export default testImplementations;