/**
 * @fileoverview Specialized Memory Pool for ZK Circuit Computations
 * 
 * Implements a specialized memory pooling system designed for the unique memory
 * usage patterns of zero-knowledge circuit execution. Optimizes witness creation,
 * constraint calculation, and proof generation memory allocation to reduce fragmentation
 * and GC pauses during critical operations.
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This component is like a specialized equipment rental service for complex
 * mathematical operations. Instead of buying new equipment (allocating memory)
 * for each job, it maintains a collection of specialized tools that can be
 * checked out when needed and returned when done. This saves both time and
 * resources compared to constantly buying and disposing of equipment.
 * 
 * The system is specifically tailored for privacy-focused calculations, understanding
 * the exact types and sizes of "equipment" needed at different stages of the process.
 */

import { 
  ErrorCode, 
  MemoryError,
  SystemError
} from '../zkErrorHandler';
import zkErrorLogger from '../zkErrorLogger';
import { secureMemoryWipe } from '../memoryManager';

// Memory region types for circuit operations
type MemoryRegionType = 
  | 'witness' 
  | 'constraint' 
  | 'proof' 
  | 'verification-key'
  | 'public-input' 
  | 'general';

// Size categories for efficient pooling
enum SizeCategory {
  TINY = 'tiny',      // < 1KB
  SMALL = 'small',    // 1KB - 64KB
  MEDIUM = 'medium',  // 64KB - 1MB
  LARGE = 'large',    // 1MB - 16MB
  HUGE = 'huge'       // > 16MB
}

interface MemoryRegion {
  buffer: ArrayBuffer;
  size: number;
  category: SizeCategory;
  type: MemoryRegionType;
  inUse: boolean;
  lastUsed: number;
}

interface PoolMetrics {
  totalSize: number;
  activeSize: number;
  freeSize: number;
  allocationCount: number;
  hitCount: number;
  missCount: number;
  utilizationRatio: number;
}

/**
 * Specialized memory pool for ZK circuit operations
 * Optimizes memory allocation patterns specific to ZK circuit execution
 */
export class CircuitMemoryPool {
  private regions: Map<string, MemoryRegion[]> = new Map();
  private activeRegions: Set<ArrayBuffer> = new Set();
  private metrics: Map<MemoryRegionType, PoolMetrics> = new Map();
  private totalSize: number = 0;
  private maxSize: number;
  private secureClearOnRelease: boolean;
  private initialized: boolean = false;

  /**
   * Create a new circuit memory pool
   * @param maxSize Maximum pool size in bytes
   * @param secureClearOnRelease Whether to securely clear memory on release
   */
  constructor(maxSize: number = 1024 * 1024 * 100, secureClearOnRelease: boolean = true) {
    this.maxSize = maxSize;
    this.secureClearOnRelease = secureClearOnRelease;
    this.initializeMetrics();
    this.initialized = true;
  }

  /**
   * Get a memory region of the specified size and type
   * @param size Size in bytes
   * @param type Memory region type
   * @returns ArrayBuffer for use in circuit operations
   */
  allocate(size: number, type: MemoryRegionType = 'general'): ArrayBuffer {
    if (!this.initialized) {
      throw new SystemError('Circuit memory pool not initialized', {
        code: ErrorCode.SYSTEM_NOT_INITIALIZED,
        recoverable: true
      });
    }

    if (size <= 0) {
      throw new MemoryError('Invalid memory region size', {
        code: ErrorCode.MEMORY_ALLOCATION_FAILED,
        recoverable: true,
        details: { requestedSize: size }
      });
    }

    const category = this.getSizeCategory(size);
    const poolKey = `${type}_${category}`;

    // Get or create pool for this type/category
    if (!this.regions.has(poolKey)) {
      this.regions.set(poolKey, []);
    }

    const regions = this.regions.get(poolKey)!;
    
    // Try to find a suitable region that fits the requested size
    for (let i = 0; i < regions.length; i++) {
      const region = regions[i];
      if (!region.inUse && region.size >= size) {
        // We found a usable region
        region.inUse = true;
        region.lastUsed = Date.now();
        this.activeRegions.add(region.buffer);
        
        // Update metrics
        this.updateMetricsForAllocation(type, region.size, true);
        
        return region.buffer;
      }
    }
    
    // No suitable region found, allocate a new one
    // Use a power-of-2 size that's at least as large as requested
    const allocSize = this.getOptimalSize(size, category);
    
    try {
      // Check if adding this region would exceed max pool size
      if (this.totalSize + allocSize > this.maxSize) {
        this.trimPool(allocSize);
      }
      
      // Allocate new region
      const buffer = new ArrayBuffer(allocSize);
      
      // Create region metadata
      const newRegion: MemoryRegion = {
        buffer,
        size: allocSize,
        category,
        type,
        inUse: true,
        lastUsed: Date.now()
      };
      
      // Add to pool and tracking
      regions.push(newRegion);
      this.activeRegions.add(buffer);
      
      // Update metrics
      this.totalSize += allocSize;
      this.updateMetricsForAllocation(type, allocSize, false);
      
      return buffer;
    } catch (error) {
      // Handle allocation failure
      throw new MemoryError(`Failed to allocate circuit memory: ${error.message}`, {
        code: ErrorCode.MEMORY_ALLOCATION_FAILED,
        recoverable: false,
        details: { 
          requestedSize: size, 
          attemptedSize: allocSize,
          originalError: error.message
        }
      });
    }
  }

  /**
   * Return a memory region to the pool for reuse
   * @param buffer Buffer to return
   * @param secure Whether to securely wipe the buffer
   */
  release(buffer: ArrayBuffer, secure?: boolean): void {
    if (!buffer || !(buffer instanceof ArrayBuffer)) {
      return;
    }
    
    if (!this.activeRegions.has(buffer)) {
      return; // Not from our pool
    }
    
    // Find the region
    for (const [poolKey, regions] of this.regions.entries()) {
      for (const region of regions) {
        if (region.buffer === buffer) {
          // Found the region
          region.inUse = false;
          region.lastUsed = Date.now();
          this.activeRegions.delete(buffer);
          
          // Update metrics for the region type
          this.updateMetricsForRelease(region.type, region.size);
          
          // Securely clear if requested or configured
          const shouldClear = secure !== undefined ? secure : this.secureClearOnRelease;
          if (shouldClear) {
            const view = new Uint8Array(buffer);
            view.fill(0);
          }
          
          return;
        }
      }
    }
  }

  /**
   * Pre-allocate memory regions for known circuit operations
   * @param circuitType Type of circuit ('standard', 'threshold', 'maximum')
   * @param inputCount Number of circuit inputs
   */
  prepareForCircuit(circuitType: string, inputCount: number): void {
    // Calculate appropriate sizes based on circuit type and input count
    const witnessSize = this.estimateWitnessSize(circuitType, inputCount);
    const constraintSize = this.estimateConstraintSize(circuitType);
    const proofSize = 1024 * 64; // 64KB is typical for proof data
    
    try {
      // Pre-allocate witness region
      const witnessBuffer = this.allocate(witnessSize, 'witness');
      this.release(witnessBuffer, false); // Don't need to wipe, it's a new allocation
      
      // Pre-allocate constraint region
      const constraintBuffer = this.allocate(constraintSize, 'constraint');
      this.release(constraintBuffer, false);
      
      // Pre-allocate proof region
      const proofBuffer = this.allocate(proofSize, 'proof');
      this.release(proofBuffer, false);
      
      // Pre-allocate public input region (usually small)
      const publicInputBuffer = this.allocate(inputCount * 32, 'public-input');
      this.release(publicInputBuffer, false);
      
      zkErrorLogger.log('INFO', 'Pre-allocated circuit memory regions', {
        details: {
          circuitType,
          inputCount,
          witnessSize,
          constraintSize,
          proofSize,
          publicInputSize: inputCount * 32
        }
      });
    } catch (error) {
      zkErrorLogger.logError(
        new SystemError(`Failed to pre-allocate circuit memory: ${error.message}`, {
          code: ErrorCode.MEMORY_ALLOCATION_FAILED,
          recoverable: true,
          details: { 
            circuitType,
            inputCount,
            originalError: error.message
          }
        }),
        { context: 'CircuitMemoryPool.prepareForCircuit' }
      );
    }
  }

  /**
   * Reset the memory pool, releasing all regions
   * @param secure Whether to securely wipe all memory
   */
  reset(secure: boolean = true): void {
    // Securely clear all regions if requested
    if (secure) {
      for (const [_, regions] of this.regions.entries()) {
        for (const region of regions) {
          const view = new Uint8Array(region.buffer);
          view.fill(0);
          region.inUse = false;
        }
      }
    }
    
    // Clear all tracking structures
    this.regions.clear();
    this.activeRegions.clear();
    this.totalSize = 0;
    
    // Reset metrics
    this.initializeMetrics();
    
    // Small allocations to help trigger garbage collection
    setTimeout(() => {
      try {
        // Create and immediately discard some objects
        const dummy1 = new Array(1000).fill(0);
        const dummy2 = new Uint8Array(1000);
        dummy1.length = 0;
        dummy2.fill(0);
      } catch (e) {
        // Ignore errors
      }
    }, 0);
  }

  /**
   * Get memory pool metrics
   * @returns Complete metrics for the memory pool
   */
  getMetrics(): Record<string, PoolMetrics> {
    const result: Record<string, PoolMetrics> = {};
    
    for (const [type, metrics] of this.metrics.entries()) {
      result[type] = { ...metrics };
    }
    
    // Add overall metrics
    result['overall'] = {
      totalSize: this.totalSize,
      activeSize: Array.from(this.metrics.values()).reduce((sum, m) => sum + m.activeSize, 0),
      freeSize: Array.from(this.metrics.values()).reduce((sum, m) => sum + m.freeSize, 0),
      allocationCount: Array.from(this.metrics.values()).reduce((sum, m) => sum + m.allocationCount, 0),
      hitCount: Array.from(this.metrics.values()).reduce((sum, m) => sum + m.hitCount, 0),
      missCount: Array.from(this.metrics.values()).reduce((sum, m) => sum + m.missCount, 0),
      utilizationRatio: this.totalSize ? 
        Array.from(this.metrics.values()).reduce((sum, m) => sum + m.activeSize, 0) / this.totalSize : 0
    };
    
    return result;
  }

  /**
   * Determine the size category for a requested size
   * @param size Size in bytes
   * @returns Size category
   * @private
   */
  private getSizeCategory(size: number): SizeCategory {
    if (size < 1024) {
      return SizeCategory.TINY;
    } else if (size < 64 * 1024) {
      return SizeCategory.SMALL;
    } else if (size < 1024 * 1024) {
      return SizeCategory.MEDIUM;
    } else if (size < 16 * 1024 * 1024) {
      return SizeCategory.LARGE;
    } else {
      return SizeCategory.HUGE;
    }
  }

  /**
   * Calculate the optimal allocation size based on requested size
   * @param requestedSize Requested size in bytes
   * @param category Size category
   * @returns Optimal allocation size
   * @private
   */
  private getOptimalSize(requestedSize: number, category: SizeCategory): number {
    // Round up to power of 2, but with some size-dependent adjustments
    let size: number;
    
    switch (category) {
      case SizeCategory.TINY:
        // For tiny allocations, round to nearest 256 bytes
        size = Math.ceil(requestedSize / 256) * 256;
        break;
        
      case SizeCategory.SMALL:
        // For small allocations, round to nearest 4KB
        size = Math.ceil(requestedSize / 4096) * 4096;
        break;
        
      case SizeCategory.MEDIUM:
        // For medium allocations, round to nearest 64KB
        size = Math.ceil(requestedSize / (64 * 1024)) * (64 * 1024);
        break;
        
      case SizeCategory.LARGE:
        // For large allocations, round to nearest 1MB
        size = Math.ceil(requestedSize / (1024 * 1024)) * (1024 * 1024);
        break;
        
      case SizeCategory.HUGE:
        // For huge allocations, round to nearest 4MB
        size = Math.ceil(requestedSize / (4 * 1024 * 1024)) * (4 * 1024 * 1024);
        break;
        
      default:
        // Fallback to power of 2 ceiling
        size = Math.pow(2, Math.ceil(Math.log2(requestedSize)));
    }
    
    return size;
  }

  /**
   * Trim the memory pool to make room for new allocations
   * @param neededSize Size needed for new allocation
   * @private
   */
  private trimPool(neededSize: number): void {
    // If we need more than 80% of max size, reset everything
    if (neededSize > this.maxSize * 0.8) {
      this.reset(this.secureClearOnRelease);
      return;
    }
    
    // Sort all unused regions by last used time (oldest first)
    const allUnusedRegions: Array<{ key: string, region: MemoryRegion }> = [];
    
    for (const [key, regions] of this.regions.entries()) {
      for (const region of regions) {
        if (!region.inUse) {
          allUnusedRegions.push({ key, region });
        }
      }
    }
    
    // Sort by last used (oldest first)
    allUnusedRegions.sort((a, b) => a.region.lastUsed - b.region.lastUsed);
    
    // Remove regions until we have enough space
    let freedSize = 0;
    const regionsToRemove: Array<{ key: string, region: MemoryRegion }> = [];
    
    for (const item of allUnusedRegions) {
      regionsToRemove.push(item);
      freedSize += item.region.size;
      
      if (this.totalSize - freedSize + neededSize <= this.maxSize) {
        break;
      }
    }
    
    // Now actually remove the regions
    for (const { key, region } of regionsToRemove) {
      // Secure wipe if configured
      if (this.secureClearOnRelease) {
        const view = new Uint8Array(region.buffer);
        view.fill(0);
      }
      
      // Remove from pool
      const regions = this.regions.get(key)!;
      const index = regions.findIndex(r => r === region);
      if (index !== -1) {
        regions.splice(index, 1);
        this.totalSize -= region.size;
        
        // Update metrics
        this.updateMetricsForTrimming(region.type, region.size);
      }
    }
    
    // If we removed any regions, compact the remaining ones
    if (regionsToRemove.length > 0) {
      zkErrorLogger.log('INFO', 'Memory pool trimmed', {
        details: {
          removedRegions: regionsToRemove.length,
          freedBytes: freedSize,
          remainingBytes: this.totalSize
        }
      });
    }
  }

  /**
   * Initialize metrics tracking for all region types
   * @private
   */
  private initializeMetrics(): void {
    const regionTypes: MemoryRegionType[] = [
      'witness',
      'constraint',
      'proof',
      'verification-key',
      'public-input',
      'general'
    ];
    
    for (const type of regionTypes) {
      this.metrics.set(type, {
        totalSize: 0,
        activeSize: 0,
        freeSize: 0,
        allocationCount: 0,
        hitCount: 0,
        missCount: 0,
        utilizationRatio: 0
      });
    }
  }

  /**
   * Update metrics when allocating a memory region
   * @param type Region type
   * @param size Region size
   * @param isHit Whether this was a cache hit
   * @private
   */
  private updateMetricsForAllocation(type: MemoryRegionType, size: number, isHit: boolean): void {
    const metrics = this.metrics.get(type) || this.metrics.get('general')!;
    
    // Update allocation metrics
    metrics.allocationCount++;
    metrics.activeSize += size;
    metrics.totalSize += isHit ? 0 : size; // Only add to total if it's a new allocation
    metrics.freeSize -= isHit ? size : 0;  // Only subtract from free if it's a hit
    
    if (isHit) {
      metrics.hitCount++;
    } else {
      metrics.missCount++;
    }
    
    // Update utilization ratio
    metrics.utilizationRatio = metrics.totalSize > 0 ? metrics.activeSize / metrics.totalSize : 0;
  }

  /**
   * Update metrics when releasing a memory region
   * @param type Region type
   * @param size Region size
   * @private
   */
  private updateMetricsForRelease(type: MemoryRegionType, size: number): void {
    const metrics = this.metrics.get(type) || this.metrics.get('general')!;
    
    // Update release metrics
    metrics.activeSize -= size;
    metrics.freeSize += size;
    
    // Update utilization ratio
    metrics.utilizationRatio = metrics.totalSize > 0 ? metrics.activeSize / metrics.totalSize : 0;
  }

  /**
   * Update metrics when trimming a memory region
   * @param type Region type
   * @param size Region size
   * @private
   */
  private updateMetricsForTrimming(type: MemoryRegionType, size: number): void {
    const metrics = this.metrics.get(type) || this.metrics.get('general')!;
    
    // Update metrics for trimming
    metrics.totalSize -= size;
    metrics.freeSize -= size;
    
    // Update utilization ratio
    metrics.utilizationRatio = metrics.totalSize > 0 ? metrics.activeSize / metrics.totalSize : 0;
  }

  /**
   * Estimate the witness size for a circuit
   * @param circuitType Circuit type
   * @param inputCount Number of inputs
   * @returns Estimated witness size in bytes
   * @private
   */
  private estimateWitnessSize(circuitType: string, inputCount: number): number {
    // These are empirically determined sizes - in a real implementation
    // they would be based on formal analysis of circuit structure
    switch (circuitType) {
      case 'standard':
        return 1024 * 1024 + inputCount * 1024; // 1MB base + 1KB per input
        
      case 'threshold':
        return 2 * 1024 * 1024 + inputCount * 2048; // 2MB base + 2KB per input
        
      case 'maximum':
        return 2 * 1024 * 1024 + inputCount * 2048; // 2MB base + 2KB per input
        
      default:
        return 4 * 1024 * 1024; // 4MB default
    }
  }

  /**
   * Estimate the constraint size for a circuit
   * @param circuitType Circuit type
   * @returns Estimated constraint size in bytes
   * @private
   */
  private estimateConstraintSize(circuitType: string): number {
    // These are empirically determined sizes
    switch (circuitType) {
      case 'standard':
        return 512 * 1024; // 512KB
        
      case 'threshold':
        return 768 * 1024; // 768KB
        
      case 'maximum':
        return 896 * 1024; // 896KB
        
      default:
        return 1024 * 1024; // 1MB default
    }
  }
}

// Create singleton instance for global use
const circuitMemoryPool = new CircuitMemoryPool();
export default circuitMemoryPool;