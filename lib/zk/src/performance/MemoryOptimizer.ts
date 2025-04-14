/**
 * @fileoverview Memory optimization utilities for ZK operations
 * 
 * This module provides tools for optimizing memory usage during
 * memory-intensive zero-knowledge proof operations.
 */

// Import device capabilities for memory detection
import { getDeviceCapabilities } from '../deviceCapabilities';

/**
 * Memory allocation strategy
 */
export enum MemoryStrategy {
  /** Optimize for performance, use more memory */
  Performance = 'performance',
  /** Balance between performance and memory usage */
  Balanced = 'balanced',
  /** Optimize for minimal memory usage */
  Conservative = 'conservative',
  /** For extremely memory-constrained environments */
  Minimal = 'minimal'
}

/**
 * Configuration for memory optimization
 */
export interface MemoryConfig {
  /** Maximum memory to use in MB */
  maxMemoryMB: number;
  /** Memory allocation strategy */
  strategy: MemoryStrategy;
  /** Whether to enable garbage collection hints */
  enableGCHints: boolean;
  /** Buffer size for proof generation in bytes */
  proofBufferSize: number;
  /** Whether to use incremental processing for large datasets */
  useIncrementalProcessing: boolean;
  /** Size of chunks for incremental processing */
  chunkSize: number;
  /** Whether to enable memory usage tracking */
  trackMemoryUsage: boolean;
  /** Threshold (in MB) for triggering garbage collection hints */
  gcThresholdMB: number;
}

/**
 * Memory usage statistics
 */
export interface MemoryStats {
  /** Current heap usage in bytes */
  heapUsed: number;
  /** Total heap size in bytes */
  heapTotal: number;
  /** Total memory available in bytes (if available) */
  totalMemory?: number;
  /** Free memory in bytes (if available) */
  freeMemory?: number;
  /** Peak memory usage observed during tracking in bytes */
  peakMemory: number;
  /** Timestamp when stats were collected */
  timestamp: number;
}

/**
 * Memory optimizer for ZK operations
 */
export class MemoryOptimizer {
  private config: MemoryConfig;
  private memoryUsage: MemoryStats[] = [];
  private peakMemory = 0;
  private lastGCTime = 0;
  private memoryTrackingInterval: NodeJS.Timeout | null = null;
  
  /**
   * Create a new memory optimizer
   */
  constructor(config?: Partial<MemoryConfig>) {
    // Get device capabilities for memory detection
    const deviceCaps = getDeviceCapabilities();
    const availableMemoryMB = deviceCaps.memory || 1024; // Default to 1GB if detection fails
    
    // Default configuration based on available memory
    this.config = {
      maxMemoryMB: Math.min(availableMemoryMB * 0.7, 2048), // 70% of available memory or 2GB max
      strategy: this.determineDefaultStrategy(availableMemoryMB),
      enableGCHints: true,
      proofBufferSize: this.calculateProofBufferSize(availableMemoryMB),
      useIncrementalProcessing: availableMemoryMB < 2048, // Use incremental processing for < 2GB
      chunkSize: this.calculateChunkSize(availableMemoryMB),
      trackMemoryUsage: true,
      gcThresholdMB: Math.max(100, availableMemoryMB * 0.3) // 30% of available memory or 100MB min
    };
    
    // Apply custom configuration
    if (config) {
      this.config = {
        ...this.config,
        ...config
      };
    }
    
    // Start memory tracking if enabled
    if (this.config.trackMemoryUsage) {
      this.startMemoryTracking();
    }
  }
  
  /**
   * Get the current memory configuration
   */
  public getConfig(): MemoryConfig {
    return { ...this.config };
  }
  
  /**
   * Update memory configuration
   */
  public updateConfig(config: Partial<MemoryConfig>): void {
    const oldTrackingEnabled = this.config.trackMemoryUsage;
    
    this.config = {
      ...this.config,
      ...config
    };
    
    // Update memory tracking based on new config
    if (!oldTrackingEnabled && this.config.trackMemoryUsage) {
      this.startMemoryTracking();
    } else if (oldTrackingEnabled && !this.config.trackMemoryUsage) {
      this.stopMemoryTracking();
    }
  }
  
  /**
   * Get the current memory usage
   */
  public getCurrentMemoryUsage(): MemoryStats {
    const stats = this.getMemoryStats();
    
    // Update peak memory if current usage is higher
    if (stats.heapUsed > this.peakMemory) {
      this.peakMemory = stats.heapUsed;
    }
    
    // Add to memory usage history
    if (this.config.trackMemoryUsage) {
      this.memoryUsage.push(stats);
      
      // Limit history size
      if (this.memoryUsage.length > 1000) {
        this.memoryUsage = this.memoryUsage.slice(-1000);
      }
    }
    
    return stats;
  }
  
  /**
   * Get memory usage history
   */
  public getMemoryUsageHistory(): MemoryStats[] {
    return [...this.memoryUsage];
  }
  
  /**
   * Clear memory usage history
   */
  public clearMemoryUsageHistory(): void {
    this.memoryUsage = [];
    this.peakMemory = 0;
  }
  
  /**
   * Get memory usage statistics
   */
  public getMemoryStats(): MemoryStats {
    let heapUsed = 0;
    let heapTotal = 0;
    let totalMemory: number | undefined;
    let freeMemory: number | undefined;
    
    // Node.js environment
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memoryUsage = process.memoryUsage();
      heapUsed = memoryUsage.heapUsed;
      heapTotal = memoryUsage.heapTotal;
      
      // Try to get total system memory in Node.js
      try {
        const os = require('os');
        totalMemory = os.totalmem();
        freeMemory = os.freemem();
      } catch (e) {
        // Ignore if os module is not available
      }
    } 
    // Browser environment with memory API
    else if (typeof performance !== 'undefined' && 
             performance.memory && 
             // @ts-ignore - Not standard but available in some browsers
             performance.memory.usedJSHeapSize) {
      // @ts-ignore - Not standard but available in some browsers
      heapUsed = performance.memory.usedJSHeapSize;
      // @ts-ignore - Not standard but available in some browsers
      heapTotal = performance.memory.totalJSHeapSize;
      // @ts-ignore - Not standard but available in some browsers
      totalMemory = performance.memory.jsHeapSizeLimit;
    }
    // No memory API available - use rough estimate
    else {
      // Rough estimation based on device capabilities
      const deviceCaps = getDeviceCapabilities();
      heapUsed = (deviceCaps.memory || 1024) * 1024 * 1024 * 0.3; // Assume 30% usage
      heapTotal = (deviceCaps.memory || 1024) * 1024 * 1024 * 0.5; // Assume 50% allocation
      totalMemory = (deviceCaps.memory || 1024) * 1024 * 1024;
    }
    
    return {
      heapUsed,
      heapTotal,
      totalMemory,
      freeMemory,
      peakMemory: this.peakMemory,
      timestamp: Date.now()
    };
  }
  
  /**
   * Suggest optimal chunk size for processing data incrementally
   * based on current memory usage and configuration
   */
  public suggestChunkSize(dataSize: number): number {
    const { maxMemoryMB, strategy, chunkSize } = this.config;
    const maxMemoryBytes = maxMemoryMB * 1024 * 1024;
    
    // Get current memory stats
    const stats = this.getCurrentMemoryUsage();
    const availableMemory = maxMemoryBytes - stats.heapUsed;
    
    // If available memory is less than 20% of max, use minimum chunk size
    if (availableMemory < maxMemoryBytes * 0.2) {
      return Math.min(chunkSize, 1024 * 1024); // 1MB or configured value, whichever is smaller
    }
    
    // Adjust chunk size based on strategy
    switch (strategy) {
      case MemoryStrategy.Performance:
        // Use larger chunks for performance
        return Math.min(dataSize, chunkSize * 2);
        
      case MemoryStrategy.Balanced:
        // Use configured chunk size
        return chunkSize;
        
      case MemoryStrategy.Conservative:
        // Use smaller chunks to conserve memory
        return Math.min(chunkSize, 2 * 1024 * 1024); // 2MB or configured value, whichever is smaller
        
      case MemoryStrategy.Minimal:
        // Use minimum chunk size
        return Math.min(chunkSize, 1024 * 1024); // 1MB or configured value, whichever is smaller
        
      default:
        return chunkSize;
    }
  }
  
  /**
   * Optimize memory before a memory-intensive operation
   */
  public async optimizeBeforeOperation(): Promise<void> {
    // Hint garbage collection if enabled and threshold exceeded
    if (this.config.enableGCHints) {
      this.hintGarbageCollection();
    }
    
    // Optional: Pre-allocate buffer for large operations if in performance mode
    if (this.config.strategy === MemoryStrategy.Performance) {
      await this.preallocateBuffer();
    }
  }
  
  /**
   * Optimize memory after a memory-intensive operation
   */
  public async optimizeAfterOperation(): Promise<void> {
    // Hint garbage collection if enabled
    if (this.config.enableGCHints) {
      this.hintGarbageCollection(true); // Force GC hint
    }
    
    // Update peak memory
    const stats = this.getCurrentMemoryUsage();
    if (stats.heapUsed > this.peakMemory) {
      this.peakMemory = stats.heapUsed;
    }
  }
  
  /**
   * Check if the current memory usage is within limits
   */
  public isMemoryWithinLimits(): boolean {
    const stats = this.getCurrentMemoryUsage();
    const maxMemoryBytes = this.config.maxMemoryMB * 1024 * 1024;
    
    return stats.heapUsed < maxMemoryBytes;
  }
  
  /**
   * Process data in chunks to avoid memory issues
   * 
   * @param data Array of items to process
   * @param processFn Function to process each chunk
   * @param onProgress Optional progress callback
   */
  public async processInChunks<T, R>(
    data: T[],
    processFn: (chunk: T[]) => Promise<R[]>,
    onProgress?: (processed: number, total: number) => void
  ): Promise<R[]> {
    // If incremental processing is disabled, process all at once
    if (!this.config.useIncrementalProcessing) {
      const result = await processFn(data);
      if (onProgress) {
        onProgress(data.length, data.length);
      }
      return result;
    }
    
    // Determine chunk size based on data size and memory constraints
    const chunkSize = this.suggestChunkSize(data.length * 100); // Rough estimate of item size
    const itemsPerChunk = Math.max(1, Math.floor(chunkSize / 100)); // Convert bytes to items
    
    const results: R[] = [];
    let processed = 0;
    
    for (let i = 0; i < data.length; i += itemsPerChunk) {
      // Before processing chunk, optimize memory
      await this.optimizeBeforeOperation();
      
      // Get current chunk
      const chunk = data.slice(i, i + itemsPerChunk);
      
      // Process chunk
      const chunkResults = await processFn(chunk);
      results.push(...chunkResults);
      
      // After processing chunk, optimize memory
      await this.optimizeAfterOperation();
      
      // Update progress
      processed += chunk.length;
      if (onProgress) {
        onProgress(processed, data.length);
      }
    }
    
    return results;
  }
  
  /**
   * Clean up resources
   */
  public dispose(): void {
    this.stopMemoryTracking();
  }
  
  /**
   * Start tracking memory usage
   */
  private startMemoryTracking(): void {
    if (this.memoryTrackingInterval === null) {
      // Track memory usage every 5 seconds
      this.memoryTrackingInterval = setInterval(() => {
        this.getCurrentMemoryUsage();
      }, 5000);
    }
  }
  
  /**
   * Stop tracking memory usage
   */
  private stopMemoryTracking(): void {
    if (this.memoryTrackingInterval !== null) {
      clearInterval(this.memoryTrackingInterval);
      this.memoryTrackingInterval = null;
    }
  }
  
  /**
   * Hint to the JavaScript engine to perform garbage collection
   */
  private hintGarbageCollection(force: boolean = false): void {
    const currentTime = Date.now();
    const stats = this.getCurrentMemoryUsage();
    const gcThresholdBytes = this.config.gcThresholdMB * 1024 * 1024;
    
    // Only trigger if forced, threshold exceeded, or it's been a while since last GC
    if (force || 
        stats.heapUsed > gcThresholdBytes || 
        currentTime - this.lastGCTime > 60000) { // At least 1 minute since last GC
      
      // Try different GC hint techniques
      
      // 1. Try global.gc() if available (Node.js with --expose-gc)
      try {
        if (typeof global !== 'undefined' && 'gc' in global) {
          // @ts-ignore - gc may not be defined in all environments
          global.gc();
          this.lastGCTime = currentTime;
          return;
        }
      } catch (e) {
        // Ignore if global.gc is not available
      }
      
      // 2. Try allocation-based GC triggering
      try {
        // Create and release large arrays to encourage GC
        const arrays = [];
        for (let i = 0; i < 10; i++) {
          arrays.push(new Array(1000000).fill(0));
        }
        // Clear references to allow GC
        while (arrays.length) {
          arrays.pop();
        }
        
        this.lastGCTime = currentTime;
      } catch (e) {
        // Ignore allocation errors
      }
    }
  }
  
  /**
   * Pre-allocate buffer for large operations
   */
  private async preallocateBuffer(): Promise<void> {
    if (this.config.strategy !== MemoryStrategy.Performance) {
      return;
    }
    
    try {
      // Create a temporary buffer to encourage memory allocation
      const bufferSize = this.config.proofBufferSize;
      const buffer = new Uint8Array(bufferSize);
      
      // Fill with some data to prevent optimization
      for (let i = 0; i < bufferSize; i += 1024) {
        buffer[i] = i % 256;
      }
      
      // Hold buffer briefly to ensure allocation
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Release buffer
      // @ts-ignore - Clear reference to allow GC
      buffer = null;
    } catch (e) {
      // Ignore allocation errors
    }
  }
  
  /**
   * Determine default memory strategy based on available memory
   */
  private determineDefaultStrategy(memoryMB: number): MemoryStrategy {
    if (memoryMB >= 8192) {
      return MemoryStrategy.Performance;
    } else if (memoryMB >= 4096) {
      return MemoryStrategy.Balanced;
    } else if (memoryMB >= 1024) {
      return MemoryStrategy.Conservative;
    } else {
      return MemoryStrategy.Minimal;
    }
  }
  
  /**
   * Calculate proof buffer size based on available memory
   */
  private calculateProofBufferSize(memoryMB: number): number {
    // Allocate up to 25% of memory for proof buffer
    return Math.min(memoryMB * 1024 * 1024 * 0.25, 256 * 1024 * 1024);
  }
  
  /**
   * Calculate chunk size for incremental processing
   */
  private calculateChunkSize(memoryMB: number): number {
    // Larger chunks for more memory
    if (memoryMB >= 8192) {
      return 50 * 1024 * 1024; // 50MB chunks
    } else if (memoryMB >= 4096) {
      return 20 * 1024 * 1024; // 20MB chunks
    } else if (memoryMB >= 1024) {
      return 5 * 1024 * 1024; // 5MB chunks
    } else {
      return 1 * 1024 * 1024; // 1MB chunks
    }
  }
}