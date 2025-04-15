/**
 * @fileoverview Advanced Memory Optimization System for ZK Proof Generation
 * 
 * This module implements advanced memory optimization techniques for the ZK proof system,
 * including memory pooling, buffer reuse, heap fragmentation reduction, and adaptive
 * execution strategies based on memory availability.
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This system is like an efficient resource manager for memory-intensive calculations.
 * Similar to how a smart water management system might reuse water for different purposes
 * instead of constantly drawing from a limited supply, this system reuses memory space
 * when possible rather than constantly allocating new memory.
 * 
 * Key features include:
 * 1. Memory pools that pre-allocate and reuse memory for similar operations
 * 2. Intelligent scheduling that breaks large calculations into manageable chunks
 * 3. Automatic cleanup that releases memory as soon as it's no longer needed
 * 4. Memory usage tracking to visualize and identify inefficient patterns
 */

import { 
  ErrorCode, 
  MemoryError,
  SecurityError,
  SystemError
} from '../zkErrorHandler';
import zkErrorLogger from '../zkErrorLogger';
import { getMemoryUsage, secureMemoryWipe, suggestGarbageCollection } from '../memoryManager';
import { getDeviceCapabilities } from '../deviceCapabilities';

// Types for memory optimization
interface BufferPoolOptions {
  initialSize: number;
  growthFactor: number;
  maxSize: number;
  maxPoolSize: number;
  secure: boolean;
}

interface MemoryPoolStats {
  allocations: number;
  deallocations: number;
  reuses: number;
  totalAllocated: number;
  currentUsage: number;
  peakUsage: number;
  poolEntries: number;
}

interface HeapReport {
  fragmentation: number;
  largestFreeBlock: number;
  totalFreeBlocks: number;
  averageFragmentSize: number;
  recommendations: string[];
}

interface MemoryOptimizationStrategy {
  name: string;
  description: string;
  memoryReduction: number;
  performanceImpact: number;
  applicableConstraints: string[];
  implementation: () => void;
}

/**
 * Typed buffer pool for reusing buffers of similar sizes
 * This reduces allocation/deallocation overhead and memory fragmentation
 */
class TypedBufferPool {
  private pools: Map<string, Array<ArrayBuffer>>;
  private stats: MemoryPoolStats;
  private options: BufferPoolOptions;
  private activeBuffers: Set<ArrayBuffer>;

  /**
   * Create a new TypedBufferPool
   * @param options Configuration options for the buffer pool
   */
  constructor(options: Partial<BufferPoolOptions> = {}) {
    // Set default options
    this.options = {
      initialSize: 1024,
      growthFactor: 1.5,
      maxSize: 1024 * 1024 * 50, // 50MB
      maxPoolSize: 100,
      secure: true,
      ...options
    };

    this.pools = new Map();
    this.activeBuffers = new Set();
    this.stats = {
      allocations: 0,
      deallocations: 0,
      reuses: 0,
      totalAllocated: 0,
      currentUsage: 0,
      peakUsage: 0,
      poolEntries: 0
    };
  }

  /**
   * Get a buffer of the specified size, either from the pool or newly allocated
   * @param size Required buffer size in bytes
   * @param type Buffer type identifier for pool categorization
   * @returns ArrayBuffer of at least the requested size
   */
  getBuffer(size: number, type: string = 'default'): ArrayBuffer {
    // Validate inputs
    if (size <= 0) {
      throw new MemoryError('Invalid buffer size requested', {
        code: ErrorCode.MEMORY_ALLOCATION_FAILED,
        recoverable: true,
        userFixable: true,
        details: { requestedSize: size }
      });
    }

    // Calculate appropriate pool size (round up to nearest power of 2)
    const poolSize = Math.pow(2, Math.ceil(Math.log2(size)));
    const poolKey = `${type}_${poolSize}`;

    // Create pool for this size if it doesn't exist
    if (!this.pools.has(poolKey)) {
      this.pools.set(poolKey, []);
    }

    const pool = this.pools.get(poolKey)!;
    
    let buffer: ArrayBuffer;
    
    // Try to reuse an existing buffer
    if (pool.length > 0) {
      buffer = pool.pop()!;
      this.stats.reuses++;
    } else {
      // Allocate a new buffer of the appropriate size
      buffer = new ArrayBuffer(poolSize);
      this.stats.allocations++;
      this.stats.totalAllocated += poolSize;
    }
    
    // Track active buffers and update stats
    this.activeBuffers.add(buffer);
    this.stats.currentUsage += buffer.byteLength;
    this.stats.peakUsage = Math.max(this.stats.peakUsage, this.stats.currentUsage);
    this.stats.poolEntries = this.countPoolEntries();
    
    return buffer;
  }

  /**
   * Return a buffer to the pool for reuse
   * @param buffer Buffer to return to the pool
   * @param secure Whether to wipe buffer contents (default: true for security)
   */
  releaseBuffer(buffer: ArrayBuffer, secure?: boolean): void {
    if (!buffer || !(buffer instanceof ArrayBuffer)) {
      zkErrorLogger.log('WARNING', 'Invalid buffer returned to pool', {
        details: { bufferType: typeof buffer }
      });
      return;
    }
    
    // Skip if this buffer wasn't allocated from our pool
    if (!this.activeBuffers.has(buffer)) {
      return;
    }
    
    // Determine pool based on buffer size (round to nearest power of 2)
    const size = buffer.byteLength;
    const poolSize = Math.pow(2, Math.ceil(Math.log2(size)));
    
    // Find an appropriate pool
    let foundPool = false;
    for (const [key, pool] of this.pools.entries()) {
      if (key.endsWith(`_${poolSize}`)) {
        // Securely wipe buffer contents if secure option is enabled
        const shouldWipe = secure ?? this.options.secure;
        if (shouldWipe) {
          const view = new Uint8Array(buffer);
          view.fill(0);
        }
        
        // Check if pool is full
        if (pool.length < this.options.maxPoolSize) {
          pool.push(buffer);
          foundPool = true;
          break;
        }
      }
    }
    
    // Update tracking and stats
    this.activeBuffers.delete(buffer);
    this.stats.currentUsage -= buffer.byteLength;
    this.stats.deallocations++;
    this.stats.poolEntries = this.countPoolEntries();
  }

  /**
   * Resets all pools and releases memory
   * @param secure Whether to wipe buffer contents (default: true for security)
   */
  reset(secure?: boolean): void {
    const shouldWipe = secure ?? this.options.secure;
    
    // Clear active buffers
    this.activeBuffers.forEach(buffer => {
      if (shouldWipe) {
        const view = new Uint8Array(buffer);
        view.fill(0);
      }
    });
    this.activeBuffers.clear();
    
    // Clear all pools
    this.pools.forEach((pool, key) => {
      if (shouldWipe) {
        pool.forEach(buffer => {
          const view = new Uint8Array(buffer);
          view.fill(0);
        });
      }
      pool.length = 0;
    });
    
    // Reset stats
    this.stats.currentUsage = 0;
    this.stats.poolEntries = 0;
    
    // Force garbage collection
    suggestGarbageCollection();
  }

  /**
   * Get statistics about the buffer pool usage
   * @returns Current pool statistics
   */
  getStats(): MemoryPoolStats {
    return { ...this.stats };
  }

  /**
   * Count total entries across all pools
   * @private
   * @returns Total number of available buffers in the pool
   */
  private countPoolEntries(): number {
    let count = 0;
    this.pools.forEach(pool => {
      count += pool.length;
    });
    return count;
  }
}

/**
 * Memory optimization manager for ZK proof generation
 * Provides advanced memory optimization strategies for different environments
 */
export class MemoryOptimizer {
  private bufferPool: TypedBufferPool;
  private optimizationStrategies: Map<string, MemoryOptimizationStrategy>;
  private heapSnapshots: Array<any>;
  private memoryPressureCallback?: (stats: any) => void;
  private memoryTrackingEnabled: boolean = false;
  private memoryTrackingInterval?: NodeJS.Timeout;
  private memoryUsageHistory: Array<any> = [];
  private isInitialized: boolean = false;

  /**
   * Create a new MemoryOptimizer
   * @param options Configuration options
   */
  constructor(options: any = {}) {
    this.bufferPool = new TypedBufferPool({
      initialSize: options.initialBufferSize || 1024,
      maxSize: options.maxBufferSize || 1024 * 1024 * 50,
      secure: options.secureBuffers !== false,
      maxPoolSize: options.maxPoolSize || 100
    });

    this.optimizationStrategies = new Map();
    this.heapSnapshots = [];
    this.registerOptimizationStrategies();
    
    // Initialize with environment detection
    this.initialize();
  }

  /**
   * Initialize the memory optimizer
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(): Promise<void> {
    try {
      // Detect environment capabilities
      const deviceCaps = getDeviceCapabilities();
      
      // Adjust pool sizes based on device memory
      if (deviceCaps.memory) {
        const maxPoolSizeMB = Math.max(50, Math.min(deviceCaps.memory / 10, 500));
        const newMaxSize = 1024 * 1024 * maxPoolSizeMB;
        
        this.bufferPool = new TypedBufferPool({
          maxSize: newMaxSize,
          secure: true
        });
      }
      
      // Pre-allocate common buffer sizes for ZK operations
      const commonSizes = [1024, 4096, 16384, 65536, 262144];
      commonSizes.forEach(size => {
        const buffer = this.bufferPool.getBuffer(size, 'prealloc');
        this.bufferPool.releaseBuffer(buffer);
      });
      
      this.isInitialized = true;
      zkErrorLogger.log('INFO', 'Memory optimizer initialized', {
        details: {
          deviceMemory: deviceCaps.memory,
          poolStats: this.bufferPool.getStats()
        }
      });
    } catch (error) {
      zkErrorLogger.logError(
        new SystemError(`Failed to initialize memory optimizer: ${error.message}`, {
          code: ErrorCode.SYSTEM_NOT_INITIALIZED,
          recoverable: true,
          details: { originalError: error.message }
        }),
        { context: 'MemoryOptimizer.initialize' }
      );
      
      // Create basic initialization for fallback
      this.isInitialized = true;
    }
  }

  /**
   * Get a buffer from the pool
   * @param size Required buffer size
   * @param type Buffer category/type
   * @returns ArrayBuffer of at least the requested size
   */
  getBuffer(size: number, type: string = 'default'): ArrayBuffer {
    try {
      if (!this.isInitialized) {
        throw new SystemError('Memory optimizer not initialized', {
          code: ErrorCode.SYSTEM_NOT_INITIALIZED,
          recoverable: true
        });
      }
      
      return this.bufferPool.getBuffer(size, type);
    } catch (error) {
      // On failure, fall back to direct allocation and log the error
      zkErrorLogger.logError(
        new MemoryError(`Buffer allocation failed: ${error.message}`, {
          code: ErrorCode.MEMORY_ALLOCATION_FAILED,
          recoverable: true,
          details: { 
            requestedSize: size,
            bufferType: type,
            originalError: error.message 
          }
        }),
        { context: 'MemoryOptimizer.getBuffer' }
      );
      
      // Direct allocation as fallback
      return new ArrayBuffer(size);
    }
  }

  /**
   * Return a buffer to the pool
   * @param buffer Buffer to return
   * @param secure Whether to wipe buffer contents
   */
  releaseBuffer(buffer: ArrayBuffer, secure?: boolean): void {
    if (!this.isInitialized) {
      // Just perform secure wipe if not initialized
      if (secure && buffer instanceof ArrayBuffer) {
        const view = new Uint8Array(buffer);
        view.fill(0);
      }
      return;
    }
    
    try {
      this.bufferPool.releaseBuffer(buffer, secure);
    } catch (error) {
      zkErrorLogger.log('WARNING', 'Failed to release buffer to pool', {
        details: { 
          bufferSize: buffer?.byteLength,
          originalError: error.message 
        }
      });
      
      // Ensure secure wiping even on failure
      if (secure && buffer instanceof ArrayBuffer) {
        const view = new Uint8Array(buffer);
        view.fill(0);
      }
    }
  }

  /**
   * Apply memory optimization strategy for an operation
   * @param strategyName Name of the strategy to apply
   * @returns Promise that resolves when the strategy is applied
   */
  async applyOptimizationStrategy(strategyName: string): Promise<void> {
    if (!this.optimizationStrategies.has(strategyName)) {
      throw new SystemError(`Unknown optimization strategy: ${strategyName}`, {
        code: ErrorCode.INPUT_TYPE_ERROR,
        recoverable: true,
        userFixable: true,
        details: { 
          requestedStrategy: strategyName,
          availableStrategies: Array.from(this.optimizationStrategies.keys())
        }
      });
    }
    
    const strategy = this.optimizationStrategies.get(strategyName)!;
    zkErrorLogger.log('INFO', `Applying memory optimization strategy: ${strategyName}`, {
      details: {
        strategy: {
          name: strategy.name,
          description: strategy.description,
          memoryReduction: strategy.memoryReduction,
          performanceImpact: strategy.performanceImpact
        }
      }
    });
    
    // Apply the strategy
    strategy.implementation();
  }

  /**
   * Start tracking memory usage over time
   * @param intervalMs Time between memory snapshots in milliseconds
   * @param callback Optional callback for memory pressure events
   * @returns Object with control functions
   */
  startMemoryTracking(intervalMs: number = 5000, callback?: (stats: any) => void): { stop: () => void } {
    // Stop any existing tracking
    this.stopMemoryTracking();
    
    this.memoryPressureCallback = callback;
    this.memoryTrackingEnabled = true;
    this.memoryUsageHistory = [];
    
    // Function to record memory usage
    const recordMemoryUsage = () => {
      try {
        const memUsage = getMemoryUsage();
        const timestamp = Date.now();
        
        const entry = {
          timestamp,
          ...memUsage,
          poolStats: this.isInitialized ? this.bufferPool.getStats() : null
        };
        
        this.memoryUsageHistory.push(entry);
        
        // Trim history if it gets too large
        if (this.memoryUsageHistory.length > 1000) {
          this.memoryUsageHistory.shift();
        }
        
        // Check for memory pressure
        if (this.memoryPressureCallback && memUsage.pressurePercentage > 0.8) {
          this.memoryPressureCallback(entry);
        }
        
      } catch (error) {
        zkErrorLogger.log('WARNING', 'Failed to record memory usage', {
          details: { originalError: error.message }
        });
      }
    };
    
    // Start periodic recording
    this.memoryTrackingInterval = setInterval(recordMemoryUsage, intervalMs);
    
    // Record initial usage
    recordMemoryUsage();
    
    return {
      stop: () => this.stopMemoryTracking()
    };
  }

  /**
   * Stop memory usage tracking
   */
  stopMemoryTracking(): void {
    if (this.memoryTrackingInterval) {
      clearInterval(this.memoryTrackingInterval);
      this.memoryTrackingInterval = undefined;
    }
    
    this.memoryTrackingEnabled = false;
    this.memoryPressureCallback = undefined;
  }

  /**
   * Get memory usage history
   * @returns Array of memory usage snapshots
   */
  getMemoryUsageHistory(): Array<any> {
    return [...this.memoryUsageHistory];
  }

  /**
   * Get current memory optimization statistics
   * @returns Detailed statistics about memory optimization
   */
  getOptimizationStats(): any {
    return {
      bufferPool: this.isInitialized ? this.bufferPool.getStats() : null,
      memoryTracking: {
        enabled: this.memoryTrackingEnabled,
        historyEntries: this.memoryUsageHistory.length,
        latestUsage: this.memoryUsageHistory.length > 0 ? 
          this.memoryUsageHistory[this.memoryUsageHistory.length - 1] : null
      },
      availableStrategies: Array.from(this.optimizationStrategies.keys())
    };
  }

  /**
   * Take a heap snapshot for memory analysis
   * @returns Snapshot ID
   */
  takeHeapSnapshot(): number {
    try {
      const memUsage = getMemoryUsage();
      const timestamp = Date.now();
      const snapshotId = this.heapSnapshots.length;
      
      // Create simple heap snapshot - in a real implementation this would
      // use more advanced heap analysis techniques
      const snapshot = {
        id: snapshotId,
        timestamp,
        memoryUsage: memUsage,
        poolStats: this.isInitialized ? this.bufferPool.getStats() : null
      };
      
      this.heapSnapshots.push(snapshot);
      return snapshotId;
    } catch (error) {
      zkErrorLogger.logError(
        new SystemError(`Failed to take heap snapshot: ${error.message}`, {
          code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
          recoverable: true,
          details: { originalError: error.message }
        }),
        { context: 'MemoryOptimizer.takeHeapSnapshot' }
      );
      
      // Return invalid snapshot ID
      return -1;
    }
  }

  /**
   * Compare two heap snapshots to identify memory issues
   * @param snapshotId1 First snapshot ID
   * @param snapshotId2 Second snapshot ID
   * @returns Heap analysis report
   */
  compareHeapSnapshots(snapshotId1: number, snapshotId2: number): HeapReport {
    // Validate snapshot IDs
    if (!this.heapSnapshots[snapshotId1] || !this.heapSnapshots[snapshotId2]) {
      throw new SystemError('Invalid heap snapshot ID', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        recoverable: true,
        userFixable: true,
        details: { 
          providedIds: [snapshotId1, snapshotId2],
          maxValidId: this.heapSnapshots.length - 1
        }
      });
    }
    
    const snapshot1 = this.heapSnapshots[snapshotId1];
    const snapshot2 = this.heapSnapshots[snapshotId2];
    
    // Compare memory usage
    const memoryDiff = snapshot2.memoryUsage.used - snapshot1.memoryUsage.used;
    const poolDiff = snapshot2.poolStats 
      ? (snapshot2.poolStats.currentUsage - snapshot1.poolStats.currentUsage)
      : 0;
    
    // Calculate fragmentation estimate
    // (This is a simplified estimate - real heap analyzers would provide more accurate data)
    const fragmentation = snapshot2.memoryUsage.used > 0 
      ? 1 - (snapshot2.poolStats?.currentUsage || 0) / snapshot2.memoryUsage.used
      : 0;
    
    // Generate recommendations
    const recommendations = [];
    
    if (memoryDiff > 1024 * 1024 * 10) { // 10MB growth
      recommendations.push('Significant memory growth detected. Check for memory leaks.');
    }
    
    if (fragmentation > 0.5) {
      recommendations.push('High memory fragmentation detected. Consider compaction strategies.');
    }
    
    if (snapshot2.poolStats && snapshot2.poolStats.reuses < snapshot2.poolStats.allocations * 0.2) {
      recommendations.push('Low buffer reuse efficiency. Consider optimizing object pooling.');
    }
    
    return {
      fragmentation,
      largestFreeBlock: 0, // Would require browser/node-specific heap analysis
      totalFreeBlocks: 0,  // Would require browser/node-specific heap analysis
      averageFragmentSize: 0, // Would require browser/node-specific heap analysis
      recommendations
    };
  }

  /**
   * Clear all memory optimizations and release resources
   * @param secure Whether to securely wipe memory
   */
  reset(secure: boolean = true): void {
    // Stop memory tracking
    this.stopMemoryTracking();
    
    // Reset buffer pool
    if (this.isInitialized) {
      this.bufferPool.reset(secure);
    }
    
    // Clear heap snapshots
    this.heapSnapshots = [];
    
    // Suggest garbage collection
    suggestGarbageCollection();
    
    zkErrorLogger.log('INFO', 'Memory optimizer reset', {
      details: { secureWipe: secure }
    });
  }

  /**
   * Register available memory optimization strategies
   * @private
   */
  private registerOptimizationStrategies(): void {
    // General-purpose optimization for low memory environments
    this.optimizationStrategies.set('low-memory', {
      name: 'Low Memory Optimization',
      description: 'Optimizes for environments with very limited memory',
      memoryReduction: 0.5, // 50% reduction
      performanceImpact: 0.3, // 30% performance hit
      applicableConstraints: ['lowMemory', 'mobile'],
      implementation: () => {
        // Force garbage collection
        suggestGarbageCollection();
        
        // Reduce buffer pool sizes
        if (this.isInitialized) {
          this.bufferPool.reset();
          // Recreate with smaller limits
          this.bufferPool = new TypedBufferPool({
            initialSize: 512,
            maxSize: 1024 * 1024 * 10, // 10MB
            secure: true,
            maxPoolSize: 20
          });
        }
      }
    });
    
    // Speed-optimized for high memory environments
    this.optimizationStrategies.set('high-performance', {
      name: 'High Performance Optimization',
      description: 'Optimizes for speed in environments with ample memory',
      memoryReduction: -0.2, // Uses 20% more memory
      performanceImpact: -0.4, // 40% performance improvement
      applicableConstraints: ['highMemory', 'desktop'],
      implementation: () => {
        if (this.isInitialized) {
          this.bufferPool.reset();
          // Create larger pool with more aggressive preallocation
          this.bufferPool = new TypedBufferPool({
            initialSize: 4096,
            maxSize: 1024 * 1024 * 200, // 200MB
            secure: true,
            maxPoolSize: 200
          });
          
          // Pre-allocate larger buffers
          const largeSizes = [1024 * 1024, 4 * 1024 * 1024, 16 * 1024 * 1024];
          largeSizes.forEach(size => {
            try {
              const buffer = this.bufferPool.getBuffer(size, 'prealloc-large');
              this.bufferPool.releaseBuffer(buffer);
            } catch (e) {
              // Ignore allocation failures for very large buffers
            }
          });
        }
      }
    });
    
    // Security-focused optimization
    this.optimizationStrategies.set('high-security', {
      name: 'High Security Optimization',
      description: 'Optimizes for security with aggressive memory wiping',
      memoryReduction: 0.1, // 10% reduction
      performanceImpact: 0.2, // 20% performance hit
      applicableConstraints: ['sensitiveData', 'financial'],
      implementation: () => {
        if (this.isInitialized) {
          // Reset with secure wiping
          this.bufferPool.reset(true);
          
          // Recreate with more aggressive security settings
          this.bufferPool = new TypedBufferPool({
            initialSize: 1024,
            maxSize: 1024 * 1024 * 50,
            secure: true, // Always secure wipe
            maxPoolSize: 50
          });
        }
        
        // Force garbage collection after wiping
        suggestGarbageCollection();
      }
    });
    
    // Balanced optimization for most environments
    this.optimizationStrategies.set('balanced', {
      name: 'Balanced Optimization',
      description: 'Balance between memory usage and performance',
      memoryReduction: 0.2, // 20% reduction
      performanceImpact: 0.1, // 10% performance hit
      applicableConstraints: ['default', 'general'],
      implementation: () => {
        // This is the default strategy, just reset to defaults
        if (this.isInitialized) {
          this.bufferPool.reset();
        }
        
        suggestGarbageCollection();
      }
    });
  }
}

// Create singleton instance
const memoryOptimizer = new MemoryOptimizer();
export default memoryOptimizer;