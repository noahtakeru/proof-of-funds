/**
 * WebAssembly Loader for Zero-Knowledge Proof System
 * 
 * This module handles the loading and execution of WebAssembly modules
 * used by the zero-knowledge proof system. It provides detection of WebAssembly
 * support, fallback mechanisms, caching, and error handling.
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This module is responsible for loading the specialized code that makes our
 * privacy-protecting system run in web browsers. Think of it like an engine loader:
 * 
 * 1. COMPATIBILITY DETECTION: It first checks if the user's browser can run the
 *    high-performance code our system needs (similar to checking if a computer 
 *    meets the requirements for a modern video game).
 * 
 * 2. EFFICIENT LOADING: It loads these specialized components in the most efficient
 *    way possible, using caching to avoid unnecessary downloads (like saving game
 *    files locally so you don't have to download them again).
 * 
 * 3. FALLBACK OPTIONS: If the browser doesn't support the fastest method, it
 *    provides alternative ways to run the system (similar to how a game might
 *    switch to lower graphics settings on less powerful computers).
 * 
 * 4. BACKGROUND PROCESSING: For intensive calculations, it can move work to a
 *    separate process so the user interface stays responsive (like how video
 *    editing software might render a video in the background while you continue
 *    to use the program).
 * 
 * 5. ADAPTIVE PERFORMANCE: It analyzes the user's device capabilities and
 *    automatically chooses the best approach for their specific hardware
 *    (like how streaming services adjust video quality based on your connection).
 * 
 * Business value: Ensures our privacy features work across different browsers and
 * devices, providing the best possible performance while maintaining compatibility,
 * which enables wider user adoption and better overall experience.
 */

import { zkErrorLogger } from './zkErrorLogger.mjs';

// Cache for loaded WASM modules
const wasmCache = new Map();

// Constants for error types
const WasmLoadErrorType = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  COMPILATION_ERROR: 'COMPILATION_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  CLIENT_ERROR: 'CLIENT_ERROR',
  MEMORY_ERROR: 'MEMORY_ERROR',
  UNSUPPORTED_BROWSER: 'UNSUPPORTED_BROWSER',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

// Error messages mapped to error types
const WASM_LOAD_ERROR_MESSAGES = {
  [WasmLoadErrorType.NETWORK_ERROR]:
    "We couldn't connect to the server. Please check your internet connection and try again.",

  [WasmLoadErrorType.TIMEOUT_ERROR]:
    "The request is taking too long to complete. This might be due to a slow internet connection. Please try again.",

  [WasmLoadErrorType.COMPILATION_ERROR]:
    "Your browser had trouble processing the secure verification module. Try using a different browser or device.",

  [WasmLoadErrorType.SERVER_ERROR]:
    "We're experiencing technical difficulties with our servers. Please try again later.",

  [WasmLoadErrorType.CLIENT_ERROR]:
    "There was a problem with your request. Please refresh the page and try again.",

  [WasmLoadErrorType.MEMORY_ERROR]:
    "Your device doesn't have enough memory available to run this feature. Try closing other tabs or apps and try again.",

  [WasmLoadErrorType.UNSUPPORTED_BROWSER]:
    "Your browser doesn't support the advanced features needed to verify your funds. Please try using the latest version of Chrome, Firefox, Safari, or Edge.",

  [WasmLoadErrorType.UNKNOWN_ERROR]:
    "We encountered an unexpected error. Please refresh the page and try again."
};

// Browser compatibility information
const BROWSER_COMPATIBILITY_INFO = {
  chrome: "Chrome version 57 or later is fully supported.",
  firefox: "Firefox version 52 or later is fully supported.",
  safari: "Safari version 11 or later is supported, but may have some limitations.",
  edge: "Microsoft Edge version 79 or later is fully supported.",
  opera: "Opera version 44 or later is fully supported.",
  ie: "Internet Explorer is not supported. Please use a modern browser.",
  samsung: "Samsung Internet version 7.2 or later is supported.",
  mobile: "Most modern mobile browsers are supported, but performance may vary."
};

/**
 * Custom error class for WASM loading errors
 */
class WasmLoadError extends Error {
  constructor(message, type, url, attempt, httpStatus, cause) {
    super(message);
    this.name = 'WasmLoadError';
    this.type = type;
    this.url = url;
    this.attempt = attempt;
    this.httpStatus = httpStatus;
    this.cause = cause;
  }
}

/**
 * Detects WebAssembly support and available features
 * @returns {Promise<Object>} Object with WebAssembly support information
 */
async function detectWasmSupport() {
  const result = {
    supported: typeof WebAssembly === 'object',
    features: {
      bulkMemory: false,
      exceptions: false,
      simd: false,
      threads: false
    },
    version: 'unknown'
  };

  // If WebAssembly is not supported, return early
  if (!result.supported) {
    console.warn('WebAssembly is not supported in this browser');
    return result;
  }

  // Test for WebAssembly 1.0 support
  try {
    // Simple test module (empty function)
    const bytes = new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, // Magic bytes for WASM
      0x01, 0x00, 0x00, 0x00  // Version 1.0
    ]);

    const module = await WebAssembly.compile(bytes);
    result.version = '1.0';
  } catch (e) {
    console.error('Failed to compile basic WebAssembly module:', e);
    result.supported = false;
    return result;
  }

  // Detect SIMD support
  try {
    // This will throw if SIMD is not supported
    await WebAssembly.validate(new Uint8Array([
      0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3,
      2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11
    ]));
    result.features.simd = true;
  } catch (e) {
    // SIMD not supported
    result.features.simd = false;
  }

  // Detect threads support (shared memory)
  result.features.threads = typeof SharedArrayBuffer === 'function';

  // Detect bulk memory operations support
  try {
    await WebAssembly.validate(new Uint8Array([
      0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2,
      1, 0, 5, 3, 1, 0, 1, 10, 14, 1, 12, 0, 65, 0, 65, 0,
      65, 0, 252, 10, 0, 0, 11
    ]));
    result.features.bulkMemory = true;
  } catch (e) {
    // Bulk memory operations not supported
    result.features.bulkMemory = false;
  }

  // Detect exception handling support
  try {
    await WebAssembly.validate(new Uint8Array([
      0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2,
      1, 0, 10, 8, 1, 6, 0, 6, 64, 25, 11, 11
    ]));
    result.features.exceptions = true;
  } catch (e) {
    // Exception handling not supported
    result.features.exceptions = false;
  }

  return result;
}

/**
 * Loads a WASM module from the given URL with caching
 * @param {string} url URL to the WASM module
 * @param {Object} options Options for loading the WASM module
 * @returns {Promise<WebAssembly.Module>} Compiled WebAssembly.Module
 */
async function loadWasmModule(url, options = {}) {
  const { useCache = true, timeout = 30000, onProgress } = options;

  // Check cache first if enabled
  if (useCache && wasmCache.has(url)) {
    console.log(`Using cached WASM module for ${url}`);
    return wasmCache.get(url);
  }

  try {
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Fetch the WASM module with progress reporting
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Failed to fetch WASM module: ${response.statusText}`);
    }

    // Get content length for progress calculation
    const contentLength = Number(response.headers.get('Content-Length') || '0');

    // Use streams API to report progress if a callback is provided
    if (onProgress && contentLength > 0 && response.body) {
      const reader = response.body.getReader();
      const chunks = [];
      let receivedLength = 0;

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        chunks.push(value);
        receivedLength += value.length;

        // Report progress
        onProgress(Math.min(100, Math.round((receivedLength / contentLength) * 100)));
      }

      // Concatenate chunks
      const wasmBytes = new Uint8Array(receivedLength);
      let position = 0;
      for (const chunk of chunks) {
        wasmBytes.set(chunk, position);
        position += chunk.length;
      }

      // Compile the WASM module
      const module = await WebAssembly.compile(wasmBytes);

      // Cache the module if caching is enabled
      if (useCache) {
        wasmCache.set(url, module);
      }

      clearTimeout(timeoutId);
      return module;
    } else {
      // Simpler approach when not reporting progress
      const wasmBytes = await response.arrayBuffer();
      const module = await WebAssembly.compile(wasmBytes);

      // Cache the module if caching is enabled
      if (useCache) {
        wasmCache.set(url, module);
      }

      clearTimeout(timeoutId);
      return module;
    }
  } catch (error) {
    // Handle specific error types
    if (error.name === 'AbortError') {
      const timeoutError = new Error(`Loading WASM module timed out after ${timeout}ms`);
      zkErrorLogger.logError(timeoutError, {
        category: 'WASM_LOADING',
        code: 'WASM_TIMEOUT',
        details: { url, timeout }
      });
      throw timeoutError;
    }

    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      const networkError = new Error(`Network error while loading WASM module: ${error.message}`);
      zkErrorLogger.logError(networkError, {
        category: 'WASM_LOADING',
        code: 'WASM_NETWORK_ERROR',
        details: { url, message: error.message }
      });
      throw networkError;
    }

    if (error instanceof WebAssembly.CompileError) {
      const compileError = new Error(`WebAssembly compilation error: ${error.message}`);
      zkErrorLogger.logError(compileError, {
        category: 'WASM_LOADING',
        code: 'WASM_COMPILE_ERROR',
        details: { url, message: error.message }
      });
      throw compileError;
    }

    // Log and re-throw other errors
    zkErrorLogger.logError(error, {
      category: 'WASM_LOADING',
      code: 'WASM_UNKNOWN_ERROR',
      details: { url }
    });
    throw error;
  }
}

/**
 * Clears the WASM module cache
 * @param {string} url Optional specific URL to clear from cache, or all if not specified
 */
function clearWasmCache(url) {
  if (url) {
    wasmCache.delete(url);
  } else {
    wasmCache.clear();
  }
}

/**
 * Creates an inline worker for WASM operations
 * @returns {Worker} Web Worker instance
 */
function createWasmWorker() {
  // Define the worker script as a string
  const workerScript = `
    let wasmCache = new Map();
    
    // Listen for messages from the main thread
    self.onmessage = async function(e) {
      const { type, url, payload } = e.data;
      
      try {
        if (type === 'load') {
          // Load a WASM module
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error('Failed to fetch WASM module: ' + response.statusText);
          }
          
          // Get content length for progress calculation
          const contentLength = Number(response.headers.get('Content-Length') || '0');
          const reader = response.body.getReader();
          const chunks = [];
          let receivedLength = 0;
          
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              break;
            }
            
            chunks.push(value);
            receivedLength += value.length;
            
            // Report progress
            if (contentLength > 0) {
              self.postMessage({
                type: 'progress',
                progress: Math.min(100, Math.round((receivedLength / contentLength) * 100))
              });
            }
          }
          
          // Concatenate chunks
          const wasmBytes = new Uint8Array(receivedLength);
          let position = 0;
          for (const chunk of chunks) {
            wasmBytes.set(chunk, position);
            position += chunk.length;
          }
          
          // Compile the WASM module
          const module = await WebAssembly.compile(wasmBytes);
          
          // Cache the module
          wasmCache.set(url, module);
          
          // Return the module
          self.postMessage({
            type: 'result',
            payload: { status: 'compiled' }
          });
        }
        else if (type === 'instantiate') {
          // Instantiate a WASM module with the provided imports
          const module = wasmCache.get(url);
          
          if (!module) {
            throw new Error('WASM module not found in cache: ' + url);
          }
          
          const instance = await WebAssembly.instantiate(module, payload.imports || {});
          
          // Return the module exports
          self.postMessage({
            type: 'result',
            payload: {
              exports: Object.getOwnPropertyNames(instance.exports)
            }
          });
        }
      } catch (error) {
        self.postMessage({
          type: 'error',
          error: error.message || 'Unknown error in WASM worker'
        });
      }
    };
  `;

  // Create a blob from the worker script
  const blob = new Blob([workerScript], { type: 'application/javascript' });
  const workerUrl = URL.createObjectURL(blob);

  // Create and return the worker
  const worker = new Worker(workerUrl);

  // Clean up the URL when the worker is terminated
  worker.addEventListener('error', () => {
    URL.revokeObjectURL(workerUrl);
  });

  return worker;
}

/**
 * Loads a WASM module in a Web Worker to prevent UI blocking
 * @param {string} url URL to the WASM module
 * @param {Object} options Options for loading
 * @returns {Promise<void>} Promise that resolves when the module is loaded
 */
async function loadWasmModuleInWorker(url, options = {}) {
  const { onProgress, timeout = 30000 } = options;

  // Check if Workers are supported
  if (typeof Worker === 'undefined') {
    throw new Error('Web Workers are not supported in this environment');
  }

  return new Promise((resolve, reject) => {
    // Create worker
    const worker = createWasmWorker();

    // Set up timeout
    const timeoutId = setTimeout(() => {
      worker.terminate();
      reject(new Error(`Loading WASM module in worker timed out after ${timeout}ms`));
    }, timeout);

    // Listen for messages from the worker
    worker.onmessage = (e) => {
      const data = e.data;

      if (data.type === 'progress' && onProgress) {
        onProgress(data.progress || 0);
      }
      else if (data.type === 'result') {
        clearTimeout(timeoutId);
        resolve();
      }
      else if (data.type === 'error') {
        clearTimeout(timeoutId);
        worker.terminate();
        reject(new Error(data.error || 'Unknown error in WASM worker'));
      }
    };

    // Handle worker errors
    worker.onerror = (err) => {
      clearTimeout(timeoutId);
      worker.terminate();
      reject(new Error(`Worker error: ${err.message}`));
    };

    // Start loading the WASM module
    worker.postMessage({
      type: 'load',
      url
    });
  });
}

/**
 * Checks the device's performance capabilities to determine
 * if it can handle ZK proof generation on the client-side
 * @returns {Promise<Object>} Performance capability information
 */
async function checkPerformanceCapabilities() {
  // Get hardware concurrency and memory info
  const hardwareConcurrency = navigator.hardwareConcurrency || 2;
  const memory = navigator.deviceMemory || 4; // deviceMemory not in all browsers

  // Check WebAssembly support
  const wasmSupport = await detectWasmSupport();

  // Check Web Workers support
  const supportsWorkers = typeof Worker !== 'undefined';

  // Determine if this is a low-powered device
  const isLowPoweredDevice = hardwareConcurrency < 2 || memory < 4;

  // Determine if device has limited memory
  const limitedMemory = memory < 8;

  // Recommend server-side processing for low-powered devices
  // or devices with limited WASM support
  const recommendedLocation = (
    isLowPoweredDevice ||
    !wasmSupport.supported ||
    limitedMemory
  ) ? 'server' : 'client';

  // Determine maximum input size based on available memory
  // This is a conservative estimate to avoid browser crashes
  const maxInputSize = memory < 4 ? 1024 :
    memory < 8 ? 10240 :
      102400;

  return {
    isLowPoweredDevice,
    limitedMemory,
    supportsWorkers,
    recommendedLocation,
    maxInputSize
  };
}

/**
 * Loads a WebAssembly module with automatic retries and exponential backoff
 * 
 * @param {string} wasmUrl URL to the WASM module
 * @param {Object} options Retry options for controlling the retry behavior
 * @returns {Promise<WebAssembly.Module>} Compiled WebAssembly module
 * @throws {WasmLoadError} if all retry attempts fail
 */
async function loadWasmWithRetry(wasmUrl, options = {}) {
  // Default retry options
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffFactor = 2,
    jitter = true,
    retryStatusCodes = [408, 429, 500, 502, 503, 504],
    retryNetworkErrors = true,
    timeout = 30000,
    onRetry,
    onProgress
  } = options;

  let attempt = 0;
  let lastError = null;

  // Function to calculate delay with exponential backoff and optional jitter
  const calculateDelay = (attemptNumber) => {
    // Calculate basic exponential backoff
    const exponentialDelay = initialDelayMs * Math.pow(backoffFactor, attemptNumber);

    // Apply maximum delay constraint
    const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

    // Add jitter if enabled (±20% randomness)
    if (jitter) {
      const jitterFactor = 0.8 + (Math.random() * 0.4); // Random between 0.8 and 1.2
      return Math.floor(cappedDelay * jitterFactor);
    }

    return cappedDelay;
  };

  // Progress tracking across retries
  const progressTracker = (percent) => {
    if (onProgress) {
      // Adjust progress to account for multiple attempts
      // Each attempt counts for an equal portion of the total progress
      const adjustedPercent = ((attempt * 100) + percent) / (maxRetries + 1);
      onProgress(Math.min(99, adjustedPercent)); // Cap at 99% until complete
    }
  };

  // Try loading with retries
  while (attempt <= maxRetries) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        // Fetch the WASM module
        const response = await fetch(wasmUrl, {
          signal: controller.signal,
          // Add cache-busting query parameter on retries to avoid cached error responses
          ...(attempt > 0 && { cache: 'reload' })
        });

        clearTimeout(timeoutId);

        // Handle HTTP errors
        if (!response.ok) {
          const status = response.status;

          // Determine if this status code should trigger a retry
          const shouldRetry = retryStatusCodes.includes(status) && attempt < maxRetries;

          if (shouldRetry) {
            const errorType = status >= 500
              ? WasmLoadErrorType.SERVER_ERROR
              : WasmLoadErrorType.CLIENT_ERROR;

            lastError = new WasmLoadError(
              `HTTP error ${status}: ${response.statusText}`,
              errorType,
              wasmUrl,
              attempt,
              status
            );

            // Wait before retrying
            const delayMs = calculateDelay(attempt);

            if (onRetry) {
              onRetry(attempt, lastError, delayMs);
            }

            await new Promise(resolve => setTimeout(resolve, delayMs));
            attempt++;
            continue;
          }

          // If we shouldn't retry, throw an error
          throw new WasmLoadError(
            `HTTP error ${status}: ${response.statusText}`,
            status >= 500 ? WasmLoadErrorType.SERVER_ERROR : WasmLoadErrorType.CLIENT_ERROR,
            wasmUrl,
            attempt,
            status
          );
        }

        // Get content length for progress calculation
        const contentLength = Number(response.headers.get('Content-Length') || '0');
        let receivedLength = 0;
        let wasmBytes;

        // Use streams API to report progress if content length is available
        if (contentLength > 0 && response.body && onProgress) {
          const reader = response.body.getReader();
          const chunks = [];

          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              break;
            }

            chunks.push(value);
            receivedLength += value.length;

            // Report progress
            progressTracker(Math.min(100, Math.round((receivedLength / contentLength) * 100)));
          }

          // Concatenate chunks
          const allBytes = new Uint8Array(receivedLength);
          let position = 0;
          for (const chunk of chunks) {
            allBytes.set(chunk, position);
            position += chunk.length;
          }

          wasmBytes = allBytes.buffer;
        } else {
          // Simpler approach when not reporting progress
          wasmBytes = await response.arrayBuffer();

          // Report 100% progress for this attempt
          if (onProgress) {
            progressTracker(100);
          }
        }

        try {
          // Compile the WASM module
          const module = await WebAssembly.compile(wasmBytes);

          // If we get here, compilation succeeded - report 100% overall progress
          if (onProgress) {
            onProgress(100);
          }

          // Cache the module
          wasmCache.set(wasmUrl, module);

          return module;
        } catch (compileError) {
          // Handle WebAssembly compilation errors
          const errorMessage = compileError.message || 'Unknown WebAssembly compilation error';

          // Memory errors are a special case that might be resolved with retries
          // (e.g., if the device had temporary memory pressure)
          const isMemoryError = errorMessage.includes('memory') ||
            errorMessage.includes('allocation') ||
            errorMessage.includes('out of bounds');

          const errorType = isMemoryError
            ? WasmLoadErrorType.MEMORY_ERROR
            : WasmLoadErrorType.COMPILATION_ERROR;

          // Only retry memory errors, compilation errors are likely permanent
          if (isMemoryError && attempt < maxRetries) {
            lastError = new WasmLoadError(
              `WebAssembly compilation error: ${errorMessage}`,
              errorType,
              wasmUrl,
              attempt,
              undefined,
              compileError
            );

            // Wait before retrying
            const delayMs = calculateDelay(attempt);

            if (onRetry) {
              onRetry(attempt, lastError, delayMs);
            }

            await new Promise(resolve => setTimeout(resolve, delayMs));
            attempt++;
            continue;
          }

          // For non-retryable errors, throw
          throw new WasmLoadError(
            `WebAssembly compilation error: ${errorMessage}`,
            errorType,
            wasmUrl,
            attempt,
            undefined,
            compileError
          );
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);

        // Handle specific fetch errors
        if (fetchError instanceof WasmLoadError) {
          // Rethrow WasmLoadError instances
          throw fetchError;
        }

        if (fetchError.name === 'AbortError') {
          if (attempt < maxRetries) {
            lastError = new WasmLoadError(
              `Request timed out after ${timeout}ms`,
              WasmLoadErrorType.TIMEOUT_ERROR,
              wasmUrl,
              attempt,
              undefined,
              fetchError
            );

            // Wait before retrying
            const delayMs = calculateDelay(attempt);

            if (onRetry) {
              onRetry(attempt, lastError, delayMs);
            }

            await new Promise(resolve => setTimeout(resolve, delayMs));
            attempt++;
            continue;
          }

          throw new WasmLoadError(
            `Request timed out after ${timeout}ms`,
            WasmLoadErrorType.TIMEOUT_ERROR,
            wasmUrl,
            attempt,
            undefined,
            fetchError
          );
        }

        // Handle network errors
        if (retryNetworkErrors && attempt < maxRetries &&
          (fetchError instanceof TypeError || fetchError.message?.includes('network'))) {
          lastError = new WasmLoadError(
            `Network error: ${fetchError.message}`,
            WasmLoadErrorType.NETWORK_ERROR,
            wasmUrl,
            attempt,
            undefined,
            fetchError
          );

          // Wait before retrying
          const delayMs = calculateDelay(attempt);

          if (onRetry) {
            onRetry(attempt, lastError, delayMs);
          }

          await new Promise(resolve => setTimeout(resolve, delayMs));
          attempt++;
          continue;
        }

        // Rethrow other errors
        throw new WasmLoadError(
          fetchError.message || 'Unknown error loading WebAssembly module',
          WasmLoadErrorType.UNKNOWN_ERROR,
          wasmUrl,
          attempt,
          undefined,
          fetchError
        );
      }
    } catch (error) {
      if (error instanceof WasmLoadError) {
        // If this is the last attempt, or we shouldn't retry this error, rethrow
        if (attempt >= maxRetries) {
          throw error;
        }

        // Otherwise, record the error and continue to the next attempt
        lastError = error;
      } else {
        // Wrap unknown errors
        lastError = new WasmLoadError(
          error.message || 'Unknown error loading WebAssembly module',
          WasmLoadErrorType.UNKNOWN_ERROR,
          wasmUrl,
          attempt,
          undefined,
          error
        );

        // If this is the last attempt, throw
        if (attempt >= maxRetries) {
          throw lastError;
        }
      }

      // Wait before retrying
      const delayMs = calculateDelay(attempt);

      if (onRetry) {
        onRetry(attempt, lastError, delayMs);
      }

      await new Promise(resolve => setTimeout(resolve, delayMs));
      attempt++;
    }
  }

  // This should never happen (we should either return a module or throw an error)
  // But TypeScript requires a return statement
  throw lastError || new WasmLoadError(
    'Failed to load WebAssembly module after all retry attempts',
    WasmLoadErrorType.UNKNOWN_ERROR,
    wasmUrl,
    attempt
  );
}

/**
 * Gets a user-friendly error message for a WASM loading error
 * 
 * @param {WasmLoadError|Error} error The error object
 * @param {Object} options Additional options for the error message
 * @returns {string} A user-friendly error message
 */
function getUserFriendlyWasmErrorMessage(error, options = {}) {
  const {
    includeAction = true,
    includeBrowserInfo = true,
    includeTechnicalDetails = false
  } = options;

  // Default message if the error is not a WasmLoadError
  if (!(error instanceof WasmLoadError)) {
    return "There was a problem loading the necessary components. Please refresh the page and try again.";
  }

  // Get the base message for this error type
  let message = WASM_LOAD_ERROR_MESSAGES[error.type];

  // Add specific information based on the error type
  if (error.type === WasmLoadErrorType.SERVER_ERROR && error.httpStatus) {
    if (error.httpStatus === 503) {
      message = "Our service is temporarily unavailable due to maintenance or high traffic. Please try again later.";
    } else if (error.httpStatus === 429) {
      message = "You've made too many requests. Please wait a few minutes and try again.";
    }
  }

  // Add browser compatibility information if applicable
  if (includeBrowserInfo && error.type === WasmLoadErrorType.UNSUPPORTED_BROWSER) {
    message += " " + getBrowserCompatibilityInfo();
  }

  // Add suggested actions if requested
  if (includeAction) {
    message += " " + getSuggestedAction(error.type, error.attempt);
  }

  // Add technical details if requested
  if (includeTechnicalDetails) {
    message += ` (Technical details: ${error.message})`;
  }

  return message;
}

/**
 * Gets browser compatibility information based on the current browser
 */
function getBrowserCompatibilityInfo() {
  // Try to detect browser
  const userAgent = navigator.userAgent.toLowerCase();
  let browserInfo = "";

  if (userAgent.includes("chrome") && !userAgent.includes("edg")) {
    browserInfo = BROWSER_COMPATIBILITY_INFO.chrome;
  } else if (userAgent.includes("firefox")) {
    browserInfo = BROWSER_COMPATIBILITY_INFO.firefox;
  } else if (userAgent.includes("safari") && !userAgent.includes("chrome")) {
    browserInfo = BROWSER_COMPATIBILITY_INFO.safari;
  } else if (userAgent.includes("edg")) {
    browserInfo = BROWSER_COMPATIBILITY_INFO.edge;
  } else if (userAgent.includes("op")) {
    browserInfo = BROWSER_COMPATIBILITY_INFO.opera;
  } else if (userAgent.includes("msie") || userAgent.includes("trident")) {
    browserInfo = BROWSER_COMPATIBILITY_INFO.ie;
  } else if (userAgent.includes("samsung")) {
    browserInfo = BROWSER_COMPATIBILITY_INFO.samsung;
  } else {
    browserInfo = BROWSER_COMPATIBILITY_INFO.mobile;
  }

  return browserInfo;
}

/**
 * Gets a suggested action based on the error type and attempt number
 */
function getSuggestedAction(errorType, attempt) {
  // For network errors, suggest checking connection
  if (errorType === WasmLoadErrorType.NETWORK_ERROR) {
    return attempt > 2
      ? "If this problem persists, it might be an issue with your network. Try connecting to a different network."
      : "Please check your connection and try again.";
  }

  // For timeout errors, suggest waiting or using a faster connection
  if (errorType === WasmLoadErrorType.TIMEOUT_ERROR) {
    return attempt > 2
      ? "If this problem persists, try using a faster internet connection."
      : "Please try again when your connection is more stable.";
  }

  // For memory errors, suggest freeing up resources
  if (errorType === WasmLoadErrorType.MEMORY_ERROR) {
    return "Try closing other tabs or applications to free up memory.";
  }

  // For compilation errors, suggest using a different browser
  if (errorType === WasmLoadErrorType.COMPILATION_ERROR) {
    return "Try using a different browser, such as the latest version of Chrome or Firefox.";
  }

  // For server errors, suggest waiting
  if (errorType === WasmLoadErrorType.SERVER_ERROR) {
    return "Please try again in a few minutes.";
  }

  // For client errors, suggest refreshing
  if (errorType === WasmLoadErrorType.CLIENT_ERROR) {
    return "Refreshing the page may help resolve this issue.";
  }

  // Default action
  return "If this problem persists, please contact our support team.";
}

/**
 * Check if WebAssembly is available with the required capabilities
 * 
 * @returns {Promise<Object>} Detailed availability result
 */
async function checkWasmAvailability() {
  // Default result structure
  const result = {
    isAvailable: false,
    isFullySupported: false,
    isFallbackPossible: false,
    details: {
      wasmSupport: {
        supported: false,
        features: {
          bulkMemory: false,
          exceptions: false,
          simd: false,
          threads: false
        },
        version: 'unknown'
      },
      memoryAvailable: false,
      workerSupport: false,
      storageAvailable: false
    }
  };

  try {
    // Check if WebAssembly is supported at all
    if (typeof WebAssembly !== 'object') {
      result.details.reason = 'WebAssembly is not supported in this browser';
      return result;
    }

    // Basic WebAssembly is available
    result.isAvailable = true;

    // Get detailed WebAssembly support information
    result.details.wasmSupport = await detectWasmSupport();

    // Check if workers are supported
    result.details.workerSupport = typeof Worker === 'function';

    // Check if local storage is available
    try {
      localStorage.setItem('__wasm_test__', '1');
      localStorage.removeItem('__wasm_test__');
      result.details.storageAvailable = true;
    } catch (e) {
      result.details.storageAvailable = false;
    }

    // Check memory availability (ensure at least 50MB is available)
    try {
      // Try to allocate 50MB (50 * 1024 * 1024 bytes)
      const testBuffer = new ArrayBuffer(50 * 1024 * 1024);
      result.details.memoryAvailable = true;
      // Free the memory
      null;
    } catch (e) {
      result.details.memoryAvailable = false;
      result.details.reason = 'Not enough memory available';
    }

    // Determine if fallback is possible
    // Fallback requires either:
    // - XHR to make server requests
    // - or a way to persist state (localStorage or indexedDB)
    result.isFallbackPossible = (
      typeof XMLHttpRequest === 'function' ||
      result.details.storageAvailable ||
      typeof indexedDB !== 'undefined'
    );

    // Check if WebAssembly is fully supported for our needs
    // We require basic WebAssembly support and enough memory
    result.isFullySupported = (
      result.isAvailable &&
      result.details.memoryAvailable &&
      // SIMD is nice to have but not required
      (result.details.wasmSupport.supported || result.isFallbackPossible)
    );
  } catch (error) {
    console.error('Error checking WebAssembly availability:', error);
    result.details.reason = `Error during availability check: ${error instanceof Error ? error.message : String(error)}`;
  }

  return result;
}

/**
 * Initialize the fallback path for when WebAssembly isn't available
 * 
 * @param {Object} config Configuration for the fallback system
 * @returns {Promise<boolean>} Whether the fallback was successfully initialized
 */
async function initializeFallbackPath(config = {}) {
  // Default configuration
  const {
    serverEndpoint = 'https://api.example.com/zk-fallback',
    preferServerSide = false,
    useIframe = false,
    timeoutMs = 30000,
    retryAttempts = 3,
    onFallbackInitiated
  } = config;

  // Get current availability
  const availability = await checkWasmAvailability();

  // If WebAssembly is fully supported and we don't prefer server-side, no fallback needed
  if (availability.isFullySupported && !preferServerSide) {
    return true;
  }

  // Log the initiation of fallback
  console.log('Initializing WebAssembly fallback path', {
    reason: availability.details.reason || 'Fallback explicitly requested',
    serverEndpoint,
    useIframe
  });

  // Notify the application that we're switching to fallback
  if (onFallbackInitiated) {
    onFallbackInitiated(availability.details.reason || 'Fallback explicitly requested');
  }

  // If server-side calculation is preferred or required
  if (preferServerSide || !availability.isAvailable) {
    try {
      // Set up controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(`${serverEndpoint}/ping`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.error('Server fallback endpoint is not available:', response.statusText);
          return false;
        }

        // The server endpoint is available, set up the global fallback flag
        window.__ZK_USE_SERVER_FALLBACK__ = true;
        window.__ZK_SERVER_ENDPOINT__ = serverEndpoint;

        console.log('Server-side fallback successfully initialized');
        return true;
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('Failed to initialize server-side fallback:', error);
        return false;
      }
    } catch (error) {
      console.error('Failed to initialize server-side fallback:', error);
      return false;
    }
  }
  // Use iframe fallback if specified and we have some WebAssembly support
  else if (useIframe && availability.isAvailable) {
    try {
      // Create a sandboxed iframe for WebAssembly execution
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.sandbox.add('allow-scripts');
      iframe.src = 'about:blank';

      // Add the iframe to the document
      document.body.appendChild(iframe);

      // Set up communication channel
      window.addEventListener('message', (event) => {
        if (event.source === iframe.contentWindow) {
          // Handle messages from the iframe
          console.log('Received message from WebAssembly iframe:', event.data);

          // Process the message - would implement appropriate handlers here
        }
      });

      // Initialize the iframe with the necessary code
      iframe.contentWindow?.postMessage({
        type: 'INIT_WASM_FALLBACK',
        config: {
          timeoutMs,
          retryAttempts
        }
      }, '*');

      // Store the iframe reference
      window.__ZK_FALLBACK_IFRAME__ = iframe;

      console.log('Iframe fallback successfully initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize iframe fallback:', error);
      return false;
    }
  }

  // If we get here, no fallback method was successful
  console.warn('No fallback method was available');
  return false;
}

/**
 * Main WASM Loader API
 * Provides a simplified interface for working with WASM modules
 */
class WasmLoader {
  constructor() {
    this.supportsWasm = null;
    this.supportsWorkers = null;
    this.capabilities = null;
  }

  /**
   * Initializes the WASM loader
   * @returns {Promise<boolean>} Promise resolving to true if initialization was successful
   */
  async initialize() {
    try {
      // Check WASM support
      const wasmSupport = await detectWasmSupport();
      this.supportsWasm = wasmSupport.supported;

      // Check performance capabilities if WASM is supported
      if (this.supportsWasm) {
        this.capabilities = await checkPerformanceCapabilities();
        this.supportsWorkers = this.capabilities.supportsWorkers;
      }

      return true;
    } catch (error) {
      zkErrorLogger.logError(error, {
        category: 'WASM_INITIALIZATION',
        code: 'WASM_INIT_FAILED',
        details: {
          wasmSupported: this.supportsWasm,
          workersSupported: this.supportsWorkers
        }
      });
      console.error('Failed to initialize WASM loader:', error);
      return false;
    }
  }

  /**
   * Checks if WebAssembly is supported
   * @returns {boolean} True if WebAssembly is supported
   */
  isWasmSupported() {
    if (this.supportsWasm === null) {
      // Synchronous check if not initialized
      this.supportsWasm = typeof WebAssembly === 'object';
    }
    return this.supportsWasm;
  }

  /**
   * Checks if Web Workers are supported
   * @returns {boolean} True if Web Workers are supported
   */
  areWorkersSupported() {
    if (this.supportsWorkers === null) {
      // Synchronous check if not initialized
      this.supportsWorkers = typeof Worker !== 'undefined';
    }
    return this.supportsWorkers;
  }

  /**
   * Gets device capabilities
   * @returns {Object|null} Device capabilities or null if not initialized
   */
  getCapabilities() {
    return this.capabilities;
  }

  /**
   * Determines if client-side processing is recommended
   * @returns {boolean} True if client-side processing is recommended
   */
  isClientSideRecommended() {
    if (!this.capabilities) return false;
    return this.capabilities.recommendedLocation === 'client';
  }

  /**
   * Loads a WASM module with automatic worker selection based on capabilities
   * @param {string} url URL to the WASM module
   * @param {Object} options Options for loading
   * @returns {Promise<WebAssembly.Module|null>} Promise resolving to the compiled module or null if not supported
   */
  async loadModule(url, options = {}) {
    const {
      useCache = true,
      useWorker = true,
      forceMainThread = false,
      timeout = 30000,
      onProgress
    } = options;

    // Check if WebAssembly is supported
    if (!this.isWasmSupported()) {
      const error = new Error('WebAssembly is not supported in this environment');
      zkErrorLogger.logError(error, {
        category: 'WASM_LOADING',
        code: 'WASM_NOT_SUPPORTED',
        details: { url }
      });
      console.warn('WebAssembly is not supported in this environment');
      return null;
    }

    // Determine if we should use a worker
    const shouldUseWorker =
      useWorker &&
      this.areWorkersSupported() &&
      !forceMainThread;

    try {
      if (shouldUseWorker) {
        // Load in a worker
        await loadWasmModuleInWorker(url, { onProgress, timeout });

        // We need to load again in the main thread to get the module
        // But the worker has already cached the fetch result
        return await loadWasmModule(url, {
          useCache,
          timeout,
          onProgress: undefined // Worker already reported progress
        });
      } else {
        // Load in the main thread
        return await loadWasmModule(url, { useCache, timeout, onProgress });
      }
    } catch (error) {
      zkErrorLogger.logError(error, {
        category: 'WASM_LOADING',
        code: 'WASM_LOAD_FAILED',
        details: { 
          url,
          useWorker: shouldUseWorker,
          errorMessage: error.message
        }
      });
      console.error('Error loading WASM module:', error);
      throw error;
    }
  }

  /**
   * Clears the WASM module cache
   * @param {string} url Optional specific URL to clear, or all if not specified
   */
  clearCache(url) {
    clearWasmCache(url);
  }
}

// Create a singleton instance
const wasmLoader = new WasmLoader();

/**
 * Display a user-friendly error message to the user
 * 
 * @param {Error} error The error that occurred
 * @param {Object} options Options for how to display the error
 * @returns {Object} An object with the formatted error message and details
 */
function formatWasmErrorForDisplay(error, options = {}) {
  const message = getUserFriendlyWasmErrorMessage(error, options);

  // Only include details if it's a WasmLoadError
  if (error instanceof WasmLoadError) {
    return {
      message,
      details: {
        errorType: error.type,
        attempt: error.attempt,
        url: error.url,
        httpStatus: error.httpStatus,
        technicalMessage: error.message
      }
    };
  }

  return { message };
}

/**
 * Configure telemetry collection for WASM operations
 * 
 * @param {Object} config Telemetry configuration
 */
function configureTelemetry(config = {}) {
  if (config.endpoint) {
    window.__ZK_TELEMETRY_ENDPOINT__ = config.endpoint;
  }

  if (config.alertHandler) {
    window.__ZK_FAILURE_ALERT_HANDLER__ = config.alertHandler;
  }
}

// Export individually
export {
  detectWasmSupport,
  loadWasmModule,
  clearWasmCache,
  loadWasmModuleInWorker,
  checkPerformanceCapabilities,
  wasmLoader,
  WasmLoadError,
  WasmLoadErrorType,
  loadWasmWithRetry,
  getUserFriendlyWasmErrorMessage,
  checkWasmAvailability,
  initializeFallbackPath,
  formatWasmErrorForDisplay,
  configureTelemetry
};

// Default export
export default {
  detectWasmSupport,
  loadWasmModule,
  clearWasmCache,
  loadWasmModuleInWorker,
  checkPerformanceCapabilities,
  wasmLoader,
  WasmLoadError,
  WasmLoadErrorType,
  loadWasmWithRetry,
  getUserFriendlyWasmErrorMessage,
  checkWasmAvailability,
  initializeFallbackPath,
  formatWasmErrorForDisplay,
  configureTelemetry
};