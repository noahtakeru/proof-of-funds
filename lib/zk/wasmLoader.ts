/**
 * WebAssembly Loader Module
 * 
 * This module is responsible for detecting WebAssembly support,
 * loading WASM modules, handling errors, and providing fallbacks.
 * 
 * It also implements caching of WASM modules to improve performance
 * and reduce bandwidth usage.
 */

import { WebAssemblySupport, PerformanceCapabilities } from './types';

// Cache for loaded WASM modules
const wasmCache = new Map<string, WebAssembly.Module>();

/**
 * Detects WebAssembly support and available features
 * @returns Object with WebAssembly support information
 */
export async function detectWebAssemblySupport(): Promise<WebAssemblySupport> {
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
 * Checks the device's performance capabilities to determine
 * if it can handle ZK proof generation on the client-side
 * @returns Performance capability information
 */
export async function checkPerformanceCapabilities(): Promise<PerformanceCapabilities> {
  // Get hardware concurrency and memory info
  const hardwareConcurrency = navigator.hardwareConcurrency || 2;
  const memory = (navigator as any).deviceMemory || 4; // deviceMemory not in all browsers
  
  // Check WebAssembly support
  const wasmSupport = await detectWebAssemblySupport();
  
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