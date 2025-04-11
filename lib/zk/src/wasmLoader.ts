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

import { WebAssemblySupport, PerformanceCapabilities } from './types';
import { createProgressReporter } from './progressTracker';

// Cache for loaded WASM modules
const wasmCache = new Map<string, WebAssembly.Module>();

// Add types for the retry options
export interface RetryOptions {
  maxRetries?: number;          // Maximum number of retry attempts
  initialDelayMs?: number;      // Initial delay before the first retry in milliseconds
  maxDelayMs?: number;          // Maximum delay between retries in milliseconds
  backoffFactor?: number;       // Factor by which the delay increases after each retry
  jitter?: boolean;             // Whether to add randomness to the delay
  retryStatusCodes?: number[];  // HTTP status codes that should trigger a retry
  retryNetworkErrors?: boolean; // Whether to retry on network errors
  timeout?: number;             // Timeout for each attempt in milliseconds
  onRetry?: (attempt: number, error: Error, delayMs: number) => void; // Called before each retry
  onProgress?: (percent: number) => void; // Progress reporting callback
}

// Add error types for better error categorization
export enum WasmLoadErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  COMPILATION_ERROR = 'COMPILATION_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  CLIENT_ERROR = 'CLIENT_ERROR',
  MEMORY_ERROR = 'MEMORY_ERROR',
  UNSUPPORTED_BROWSER = 'UNSUPPORTED_BROWSER',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export class WasmLoadError extends Error {
  readonly type: WasmLoadErrorType;
  readonly url: string;
  readonly attempt: number;
  readonly httpStatus?: number;
  readonly cause?: Error;

  constructor(
    message: string,
    type: WasmLoadErrorType,
    url: string,
    attempt: number,
    httpStatus?: number,
    cause?: Error
  ) {
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
 * Maps error types to user-friendly error messages
 */
export const WASM_LOAD_ERROR_MESSAGES: Record<WasmLoadErrorType, string> = {
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

/**
 * Provides browser compatibility information for common browsers
 */
export const BROWSER_COMPATIBILITY_INFO: Record<string, string> = {
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
 * Detects WebAssembly support and available features
 * @returns Object with WebAssembly support information
 */
export async function detectWasmSupport(): Promise<WebAssemblySupport> {
  const result: WebAssemblySupport = {
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
 * @param url URL to the WASM module
 * @param options Options for loading the WASM module
 * @returns Compiled WebAssembly.Module
 */
export async function loadWasmModule(
  url: string,
  options: {
    useCache?: boolean,
    timeout?: number,
    onProgress?: (percent: number) => void
  } = {}
): Promise<WebAssembly.Module> {
  const { useCache = true, timeout = 30000, onProgress } = options;

  // Check cache first if enabled
  if (useCache && wasmCache.has(url)) {
    console.log(`Using cached WASM module for ${url}`);
    return wasmCache.get(url)!;
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
      const chunks: Uint8Array[] = [];
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
  } catch (error: any) {
    // Handle specific error types
    if (error.name === 'AbortError') {
      throw new Error(`Loading WASM module timed out after ${timeout}ms`);
    }

    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error(`Network error while loading WASM module: ${error.message}`);
    }

    if (error instanceof WebAssembly.CompileError) {
      throw new Error(`WebAssembly compilation error: ${error.message}`);
    }

    // Re-throw other errors
    throw error;
  }
}

/**
 * Clears the WASM module cache
 * @param url Optional specific URL to clear from cache, or all if not specified
 */
export function clearWasmCache(url?: string): void {
  if (url) {
    wasmCache.delete(url);
  } else {
    wasmCache.clear();
  }
}

/**
 * The worker message types for WASM operations
 */
type WasmWorkerMessage = {
  type: 'load' | 'instantiate' | 'error' | 'progress' | 'result';
  url?: string;
  payload?: any;
  error?: string;
  progress?: number;
};

/**
 * Creates an inline worker for WASM operations
 * @returns Web Worker instance
 */
function createWasmWorker(): Worker {
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
 * @param url URL to the WASM module
 * @param options Options for loading
 * @returns Promise that resolves when the module is loaded
 */
export async function loadWasmModuleInWorker(
  url: string,
  options: {
    onProgress?: (percent: number) => void,
    timeout?: number
  } = {}
): Promise<void> {
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
      const data = e.data as WasmWorkerMessage;

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
 * @returns Performance capability information
 */
export async function checkPerformanceCapabilities(): Promise<PerformanceCapabilities> {
  // Get hardware concurrency and memory info
  const hardwareConcurrency = navigator.hardwareConcurrency || 2;
  const memory = (navigator as any).deviceMemory || 4; // deviceMemory not in all browsers

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
 * Main WASM Loader API
 * Provides a simplified interface for working with WASM modules
 */
class WasmLoader {
  private supportsWasm: boolean | null = null;
  private supportsWorkers: boolean | null = null;
  private capabilities: PerformanceCapabilities | null = null;

  /**
   * Initializes the WASM loader
   * @returns Promise resolving to true if initialization was successful
   */
  async initialize(): Promise<boolean> {
    try {
      // Create a progress reporter
      const progress = createProgressReporter('wasm-loader-init');

      // Check WASM support
      progress.reportProgress('detecting-wasm', 0, 'Detecting WebAssembly support');
      const wasmSupport = await detectWasmSupport();
      this.supportsWasm = wasmSupport.supported;
      progress.reportProgress('detecting-wasm', 100, 'WebAssembly detection complete');

      // Check performance capabilities if WASM is supported
      if (this.supportsWasm) {
        progress.reportProgress('checking-capabilities', 0, 'Checking device capabilities');
        this.capabilities = await checkPerformanceCapabilities();
        this.supportsWorkers = this.capabilities.supportsWorkers;
        progress.reportProgress('checking-capabilities', 100, 'Capability check complete');
      }

      progress.complete({ success: true });
      return true;
    } catch (error) {
      console.error('Failed to initialize WASM loader:', error);
      return false;
    }
  }

  /**
   * Checks if WebAssembly is supported
   * @returns True if WebAssembly is supported
   */
  isWasmSupported(): boolean {
    if (this.supportsWasm === null) {
      // Synchronous check if not initialized
      this.supportsWasm = typeof WebAssembly === 'object';
    }
    return this.supportsWasm;
  }

  /**
   * Checks if Web Workers are supported
   * @returns True if Web Workers are supported
   */
  areWorkersSupported(): boolean {
    if (this.supportsWorkers === null) {
      // Synchronous check if not initialized
      this.supportsWorkers = typeof Worker !== 'undefined';
    }
    return this.supportsWorkers;
  }

  /**
   * Gets device capabilities
   * @returns Device capabilities or null if not initialized
   */
  getCapabilities(): PerformanceCapabilities | null {
    return this.capabilities;
  }

  /**
   * Determines if client-side processing is recommended
   * @returns True if client-side processing is recommended
   */
  isClientSideRecommended(): boolean {
    if (!this.capabilities) return false;
    return this.capabilities.recommendedLocation === 'client';
  }

  /**
   * Loads a WASM module with automatic worker selection based on capabilities
   * @param url URL to the WASM module
   * @param options Options for loading
   * @returns Promise resolving to the compiled module or null if not supported
   */
  async loadModule(
    url: string,
    options: {
      useCache?: boolean,
      useWorker?: boolean,
      forceMainThread?: boolean,
      timeout?: number,
      onProgress?: (percent: number) => void
    } = {}
  ): Promise<WebAssembly.Module | null> {
    const {
      useCache = true,
      useWorker = true,
      forceMainThread = false,
      timeout = 30000,
      onProgress
    } = options;

    // Check if WebAssembly is supported
    if (!this.isWasmSupported()) {
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
      console.error('Error loading WASM module:', error);
      throw error;
    }
  }

  /**
   * Clears the WASM module cache
   * @param url Optional specific URL to clear, or all if not specified
   */
  clearCache(url?: string): void {
    clearWasmCache(url);
  }
}

// Export a singleton instance
export const wasmLoader = new WasmLoader();

// Default export for easier importing in CommonJS environments
export default {
  detectWasmSupport,
  loadWasmModule,
  clearWasmCache,
  loadWasmModuleInWorker,
  checkPerformanceCapabilities,
  wasmLoader
};

/**
 * Loads a WebAssembly module with automatic retries and exponential backoff
 * 
 * @param wasmUrl URL to the WASM module
 * @param options Retry options for controlling the retry behavior
 * @returns Compiled WebAssembly module
 * @throws WasmLoadError if all retry attempts fail
 */
export async function loadWasmWithRetry(
  wasmUrl: string,
  options: RetryOptions = {}
): Promise<WebAssembly.Module> {
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
  let lastError: WasmLoadError | null = null;

  // Function to calculate delay with exponential backoff and optional jitter
  const calculateDelay = (attemptNumber: number): number => {
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
  const progressTracker = (percent: number) => {
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
        let wasmBytes: ArrayBuffer;

        // Use streams API to report progress if content length is available
        if (contentLength > 0 && response.body && onProgress) {
          const reader = response.body.getReader();
          const chunks: Uint8Array[] = [];

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
        } catch (compileError: any) {
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
      } catch (fetchError: any) {
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
    } catch (error: any) {
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
 * @param error The error object
 * @param options Additional options for the error message
 * @returns A user-friendly error message
 */
export function getUserFriendlyWasmErrorMessage(
  error: WasmLoadError | Error,
  options: {
    includeAction?: boolean;
    includeBrowserInfo?: boolean;
    includeTechnicalDetails?: boolean;
  } = {}
): string {
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
function getBrowserCompatibilityInfo(): string {
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
function getSuggestedAction(errorType: WasmLoadErrorType, attempt: number): string {
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
 * Displays a user-friendly error message to the user
 * 
 * @param error The error that occurred
 * @param options Options for how to display the error
 * @returns An object with the formatted error message and details
 */
export function formatWasmErrorForDisplay(
  error: WasmLoadError | Error,
  options: {
    includeAction?: boolean;
    includeBrowserInfo?: boolean;
    includeTechnicalDetails?: boolean;
  } = {}
): { message: string; details?: any } {
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
 * Result of checking WebAssembly availability
 */
export interface AvailabilityResult {
  isAvailable: boolean;    // Whether WebAssembly is available at all
  isFullySupported: boolean; // Whether all required features are supported
  isFallbackPossible: boolean; // Whether a fallback path is possible
  details: {               // Detailed availability information
    wasmSupport: WebAssemblySupport;  // WebAssembly support details
    memoryAvailable: boolean;  // Whether enough memory is available
    workerSupport: boolean;    // Whether Web Workers are supported
    storageAvailable: boolean; // Whether local storage is available
    reason?: string;           // Reason for unavailability if not available
  };
}

/**
 * Configuration for the fallback system
 */
export interface FallbackConfig {
  serverEndpoint?: string;    // Endpoint for server-side calculation
  preferServerSide?: boolean; // Whether to prefer server-side calculation even if client-side is available
  useIframe?: boolean;        // Whether to use an iframe for fallback UI
  timeoutMs?: number;         // Timeout for fallback operations
  retryAttempts?: number;     // Number of retry attempts for fallbacks
  onFallbackInitiated?: (reason: string) => void; // Callback when fallback is initiated
}

/**
 * Checks if WebAssembly is available with the required capabilities
 * 
 * @returns Detailed availability result
 */
export async function checkWasmAvailability(): Promise<AvailabilityResult> {
  // Default result structure
  const result: AvailabilityResult = {
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
      null as any as ArrayBuffer;
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
 * @param config Configuration for the fallback system
 * @returns Whether the fallback was successfully initialized
 */
export async function initializeFallbackPath(config: FallbackConfig = {}): Promise<boolean> {
  // Default configuration
  const {
    serverEndpoint = 'https://api.yourdomain.com/zk-fallback',
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
        (window as any).__ZK_USE_SERVER_FALLBACK__ = true;
        (window as any).__ZK_SERVER_ENDPOINT__ = serverEndpoint;

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
      (window as any).__ZK_FALLBACK_IFRAME__ = iframe;

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
 * Execute an operation using the appropriate method (direct or fallback)
 * 
 * @param operation The operation to perform
 * @param args Arguments for the operation
 * @param fallbackConfig Fallback configuration if needed
 * @returns Result of the operation
 */
export async function executeWithFallback<T>(
  operation: string,
  args: any[],
  fallbackConfig: FallbackConfig = {}
): Promise<T> {
  // Check if the server fallback is already initialized
  const useServerFallback = (window as any).__ZK_USE_SERVER_FALLBACK__ === true;
  const serverEndpoint = (window as any).__ZK_SERVER_ENDPOINT__ as string;

  // Check if the iframe fallback is already initialized
  const iframeFallback = (window as any).__ZK_FALLBACK_IFRAME__ as HTMLIFrameElement;

  // If we have a server fallback, use it
  if (useServerFallback && serverEndpoint) {
    return executeServerFallback<T>(operation, args, serverEndpoint, fallbackConfig);
  }

  // If we have an iframe fallback, use it
  if (iframeFallback) {
    return executeIframeFallback<T>(operation, args, iframeFallback, fallbackConfig);
  }

  // Check if WebAssembly is available at all
  const availability = await checkWasmAvailability();

  if (!availability.isAvailable) {
    // No fallback has been initialized yet, try to initialize one
    const fallbackInitialized = await initializeFallbackPath(fallbackConfig);

    if (fallbackInitialized) {
      // Retry with the newly initialized fallback
      return executeWithFallback<T>(operation, args, fallbackConfig);
    }

    // If no fallback could be initialized, throw an error
    throw new WasmLoadError(
      'WebAssembly is not supported and no fallback could be initialized',
      WasmLoadErrorType.UNSUPPORTED_BROWSER,
      'none',
      0
    );
  }

  // WebAssembly is available but might not be fully supported
  // Try direct execution first
  try {
    // This would be implemented based on the operations needed
    // For now, throwing a not implemented error
    throw new Error('Direct WebAssembly execution not implemented');
  } catch (error) {
    // If direct execution fails and no fallback has been initialized yet,
    // try to initialize one
    const fallbackInitialized = await initializeFallbackPath(fallbackConfig);

    if (fallbackInitialized) {
      // Retry with the newly initialized fallback
      return executeWithFallback<T>(operation, args, fallbackConfig);
    }

    // Re-throw the original error
    throw error;
  }
}

/**
 * Execute an operation using the server fallback
 */
async function executeServerFallback<T>(
  operation: string,
  args: any[],
  serverEndpoint: string,
  config: FallbackConfig
): Promise<T> {
  const { timeoutMs = 30000, retryAttempts = 3 } = config;

  // Create a retry config for the fetch operation
  const retryOptions: RetryOptions = {
    maxRetries: retryAttempts,
    timeout: timeoutMs,
    retryNetworkErrors: true,
    retryStatusCodes: [408, 429, 500, 502, 503, 504]
  };

  try {
    // Make the API request to the server fallback
    const response = await fetch(`${serverEndpoint}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        operation,
        args
      })
    });

    if (!response.ok) {
      throw new Error(`Server fallback returned error: ${response.status} ${response.statusText}`);
    }

    // Parse the response
    const result = await response.json();

    // Check for errors in the response
    if (result.error) {
      throw new Error(`Server operation failed: ${result.error}`);
    }

    return result.data as T;
  } catch (error) {
    console.error('Error executing operation via server fallback:', error);
    throw error;
  }
}

/**
 * Execute an operation using the iframe fallback
 */
async function executeIframeFallback<T>(
  operation: string,
  args: any[],
  iframe: HTMLIFrameElement,
  config: FallbackConfig
): Promise<T> {
  const { timeoutMs = 30000 } = config;

  return new Promise<T>((resolve, reject) => {
    // Generate a unique operation ID
    const operationId = `iframe_op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Set up a timeout
    const timeoutId = setTimeout(() => {
      // Remove the message handler
      window.removeEventListener('message', messageHandler);
      reject(new Error(`Operation ${operation} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    // Message handler function
    const messageHandler = (event: MessageEvent) => {
      if (event.source === iframe.contentWindow && event.data.operationId === operationId) {
        // Clear the timeout
        clearTimeout(timeoutId);

        // Remove the message handler
        window.removeEventListener('message', messageHandler);

        // Check for errors
        if (event.data.error) {
          reject(new Error(`Iframe operation failed: ${event.data.error}`));
        } else {
          resolve(event.data.result as T);
        }
      }
    };

    // Add the message handler
    window.addEventListener('message', messageHandler);

    // Send the operation to the iframe
    iframe.contentWindow?.postMessage({
      type: 'EXECUTE_OPERATION',
      operationId,
      operation,
      args
    }, '*');
  });
}

/**
 * Context information about the WASM operation being performed
 */
export interface WasmContext {
  operation: string;       // The operation being performed (load, compile, instantiate)
  wasmUrl?: string;        // URL of the WASM file, if applicable
  browser: {               // Browser information
    name: string;          // Browser name (Chrome, Firefox, etc.)
    version: string;       // Browser version
    userAgent: string;     // Full user agent string (truncated for privacy)
    mobile: boolean;       // Whether the device is mobile
  };
  device: {                // Device information
    platform: string;      // Platform (iOS, Android, Windows, macOS, etc.)
    memory?: number;       // Memory limit in MB (if available)
    cores?: number;        // Number of CPU cores (if available)
  };
  runtime: {               // Runtime information
    timestamp: number;     // When the operation started
    duration?: number;     // Duration of the operation in ms
    succeeded: boolean;    // Whether the operation succeeded
    attempt: number;       // Attempt number (for retries)
  };
}

/**
 * Telemetry information for WASM failures
 */
export interface WasmFailureTelemetry {
  id: string;                // Unique identifier for this telemetry entry
  context: WasmContext;      // Context information about the failure
  error: {                   // Error information
    type: string;            // Error type
    message: string;         // Error message
    stack?: string;          // Stack trace (if available)
    code?: string;           // Error code (if available)
  };
  recurring: boolean;        // Whether this is a recurring issue
  timestamp: number;         // When the telemetry was recorded
}

// Cache for tracking recurring failures
const failureCache = new Map<string, {
  count: number;
  firstOccurrence: number;
  lastOccurrence: number;
}>();

// Maximum number of failures to cache
const MAX_FAILURE_CACHE = 50;

// Time window for identifying recurring failures (24 hours)
const RECURRING_WINDOW_MS = 24 * 60 * 60 * 1000;

// Threshold for considering an issue recurring
const RECURRING_THRESHOLD = 3;

/**
 * Logs a WASM failure for telemetry purposes
 * 
 * @param error Error that occurred
 * @param context Context information about the operation
 * @returns Telemetry entry that was logged
 */
export function logWasmFailure(
  error: Error | WasmLoadError,
  context: Partial<WasmContext>
): WasmFailureTelemetry {
  // Generate a unique ID for this telemetry entry
  const id = `wasm_failure_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Create complete context information
  const fullContext = buildWasmContext(context);

  // Format the error information
  const errorInfo = {
    type: error instanceof WasmLoadError ? error.type : error.name || 'Error',
    message: error.message || 'Unknown error',
    stack: error.stack?.substring(0, 500), // Truncate for privacy
    code: error instanceof WasmLoadError ? error.type : undefined
  };

  // Generate a fingerprint for this error to identify recurring issues
  const fingerprint = generateErrorFingerprint(errorInfo, fullContext);

  // Check if this is a recurring issue
  let recurring = false;
  const now = Date.now();

  // Update the failure cache
  if (failureCache.has(fingerprint)) {
    const entry = failureCache.get(fingerprint)!;

    // Update the entry
    entry.count++;
    entry.lastOccurrence = now;

    // Check if it's recurring (occurs 3+ times in window)
    recurring = entry.count >= RECURRING_THRESHOLD &&
      now - entry.firstOccurrence <= RECURRING_WINDOW_MS;
  } else {
    // Add a new entry
    failureCache.set(fingerprint, {
      count: 1,
      firstOccurrence: now,
      lastOccurrence: now
    });

    // Clean up old entries if cache is too large
    if (failureCache.size > MAX_FAILURE_CACHE) {
      // Get the oldest entry
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [key, entry] of failureCache.entries()) {
        if (entry.lastOccurrence < oldestTime) {
          oldestTime = entry.lastOccurrence;
          oldestKey = key;
        }
      }

      // Remove the oldest entry
      if (oldestKey) {
        failureCache.delete(oldestKey);
      }
    }
  }

  // Create the telemetry entry
  const telemetry: WasmFailureTelemetry = {
    id,
    context: fullContext,
    error: errorInfo,
    recurring,
    timestamp: now
  };

  // Log to console
  if (recurring) {
    console.warn('Recurring WASM failure detected:', telemetry);
  } else {
    console.error('WASM failure:', telemetry);
  }

  // Send to telemetry endpoint if available
  sendTelemetryData(telemetry).catch(e => {
    console.error('Failed to send telemetry data:', e);
  });

  // Trigger alert for recurring issues
  if (recurring) {
    triggerRecurringAlert(telemetry);
  }

  return telemetry;
}

/**
 * Builds a complete context object from partial information
 */
function buildWasmContext(partialContext: Partial<WasmContext> = {}): WasmContext {
  // Get browser information
  const userAgent = navigator.userAgent;
  const browserInfo = detectBrowser();

  // Get device information
  const platform = navigator.platform || 'unknown';
  const memory = (navigator as any).deviceMemory; // Available in Chrome
  const cores = navigator.hardwareConcurrency; // Available in most browsers

  return {
    operation: partialContext.operation || 'unknown',
    wasmUrl: partialContext.wasmUrl,
    browser: {
      name: browserInfo.name,
      version: browserInfo.version,
      userAgent: userAgent.substring(0, 100), // Truncate for privacy
      mobile: isMobileDevice()
    },
    device: {
      platform,
      memory: memory,
      cores: cores
    },
    runtime: {
      timestamp: Date.now(),
      duration: partialContext.runtime?.duration,
      succeeded: partialContext.runtime?.succeeded || false,
      attempt: partialContext.runtime?.attempt || 1
    }
  };
}

/**
 * Detects the current browser
 */
function detectBrowser(): { name: string; version: string } {
  const userAgent = navigator.userAgent;

  // Default values
  let name = 'unknown';
  let version = 'unknown';

  if (userAgent.indexOf('Firefox') > -1) {
    name = 'Firefox';
    const match = userAgent.match(/Firefox\/([0-9.]+)/);
    if (match && match[1]) {
      version = match[1];
    }
  } else if (userAgent.indexOf('Edge') > -1 || userAgent.indexOf('Edg/') > -1) {
    name = 'Edge';
    const edgeMatch = userAgent.match(/Edge\/([0-9.]+)/);
    const edgChromiumMatch = userAgent.match(/Edg\/([0-9.]+)/);
    if (edgeMatch && edgeMatch[1]) {
      version = edgeMatch[1];
    } else if (edgChromiumMatch && edgChromiumMatch[1]) {
      version = edgChromiumMatch[1];
    }
  } else if (userAgent.indexOf('Chrome') > -1) {
    name = 'Chrome';
    const match = userAgent.match(/Chrome\/([0-9.]+)/);
    if (match && match[1]) {
      version = match[1];
    }
  } else if (userAgent.indexOf('Safari') > -1) {
    name = 'Safari';
    const match = userAgent.match(/Version\/([0-9.]+)/);
    if (match && match[1]) {
      version = match[1];
    }
  } else if (userAgent.indexOf('MSIE') > -1 || userAgent.indexOf('Trident/') > -1) {
    name = 'Internet Explorer';
    const msieMatch = userAgent.match(/MSIE ([0-9.]+)/);
    const tridentMatch = userAgent.match(/rv:([0-9.]+)/);
    if (msieMatch && msieMatch[1]) {
      version = msieMatch[1];
    } else if (tridentMatch && tridentMatch[1]) {
      version = tridentMatch[1];
    }
  } else if (userAgent.indexOf('Opera') > -1 || userAgent.indexOf('OPR/') > -1) {
    name = 'Opera';
    const operaMatch = userAgent.match(/Opera\/([0-9.]+)/);
    const oprMatch = userAgent.match(/OPR\/([0-9.]+)/);
    if (operaMatch && operaMatch[1]) {
      version = operaMatch[1];
    } else if (oprMatch && oprMatch[1]) {
      version = oprMatch[1];
    }
  }

  return { name, version };
}

/**
 * Detects if the device is mobile
 */
function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Generates a fingerprint for an error to identify recurring issues
 */
function generateErrorFingerprint(
  error: { type: string; message: string; stack?: string; code?: string },
  context: WasmContext
): string {
  // Create a unique fingerprint based on error properties and relevant context
  const errorKey = `${error.type}:${error.code || 'no-code'}`;

  // Extract meaningful parts of the message (remove dynamic parts like timestamps)
  const cleanMessage = error.message
    .replace(/\b\d{10,}\b/g, '[TIMESTAMP]')  // Remove timestamps
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/ig, '[UUID]') // Remove UUIDs
    .replace(/\b[0-9a-f]{12,}\b/ig, '[HASH]'); // Remove hash-like strings

  // Include browser and operation information
  const contextKey = `${context.operation}:${context.browser.name}:${context.browser.mobile ? 'mobile' : 'desktop'}`;

  // Create final fingerprint
  return `${errorKey}:${contextKey}:${cleanMessage.substring(0, 100)}`;
}

/**
 * Sends telemetry data to the backend
 */
async function sendTelemetryData(telemetry: WasmFailureTelemetry): Promise<void> {
  // Check if we have a telemetry endpoint configured
  const telemetryEndpoint = (window as any).__ZK_TELEMETRY_ENDPOINT__;

  if (!telemetryEndpoint) {
    // No endpoint configured, do nothing
    return;
  }

  try {
    // Send the telemetry data
    await fetch(telemetryEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'wasm_failure',
        data: telemetry
      }),
      // Use keepalive to ensure data is sent even if page is unloading
      keepalive: true,
      // Use a short timeout to avoid blocking
      signal: AbortSignal.timeout(5000)
    });
  } catch (error) {
    // Log the error but don't throw
    console.error('Failed to send telemetry data:', error);
  }
}

/**
 * Triggers an alert for recurring issues
 */
function triggerRecurringAlert(telemetry: WasmFailureTelemetry): void {
  // Check if we have an alert handler configured
  const alertHandler = (window as any).__ZK_FAILURE_ALERT_HANDLER__;

  if (typeof alertHandler === 'function') {
    try {
      // Call the handler
      alertHandler(telemetry);
    } catch (error) {
      console.error('Error in failure alert handler:', error);
    }
  }

  // Log a serious warning to the console in any case
  console.warn(
    '%c⚠️ RECURRING WASM FAILURE DETECTED ⚠️',
    'background: #f8d7da; color: #721c24; font-size: 14px; font-weight: bold; padding: 5px;',
    telemetry
  );
}

/**
 * Sets the telemetry configuration
 * 
 * @param config Telemetry configuration
 */
export function configureTelemetry(config: {
  endpoint?: string;
  alertHandler?: (telemetry: WasmFailureTelemetry) => void;
}): void {
  if (config.endpoint) {
    (window as any).__ZK_TELEMETRY_ENDPOINT__ = config.endpoint;
  }

  if (config.alertHandler) {
    (window as any).__ZK_FAILURE_ALERT_HANDLER__ = config.alertHandler;
  }
}

/**
 * Gets the current telemetry statistics
 * 
 * @returns Statistics about tracked failures
 */
export function getTelemetryStats(): {
  totalFailures: number;
  recurringIssues: number;
  topIssues: Array<{ fingerprint: string; count: number; lastSeen: number }>;
} {
  let recurringIssues = 0;
  const now = Date.now();

  // Count recurring issues
  for (const [_, entry] of failureCache.entries()) {
    if (entry.count >= RECURRING_THRESHOLD && now - entry.firstOccurrence <= RECURRING_WINDOW_MS) {
      recurringIssues++;
    }
  }

  // Get top issues by count
  const topIssues = Array.from(failureCache.entries())
    .map(([fingerprint, entry]) => ({
      fingerprint,
      count: entry.count,
      lastSeen: entry.lastOccurrence
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalFailures: failureCache.size,
    recurringIssues,
    topIssues
  };
}