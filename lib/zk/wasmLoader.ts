/**
 * WebAssembly Loader Module
 * 
 * This module is responsible for detecting WebAssembly support,
 * loading WASM modules, handling errors, and providing fallbacks.
 * 
 * It also implements caching of WASM modules to improve performance
 * and reduces bandwidth usage, with support for Web Workers to
 * prevent UI blocking during intensive operations.
 */

import { WebAssemblySupport, PerformanceCapabilities } from './types';
import { createProgressReporter } from './progressTracker';

// Cache for loaded WASM modules
const wasmCache = new Map<string, WebAssembly.Module>();

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