/**
 * Memory Pool Management for Zero-Knowledge Circuit Operations
 * 
 * This module provides optimized memory allocation and management for ZK circuit operations,
 * focusing on efficient memory usage and secure cleanup for private data.
 * 
 * Features:
 * - Typed memory regions for different circuit components
 * - Pre-allocation of memory pools to reduce fragmentation
 * - Automatic secure wiping of memory containing sensitive data
 * - Memory usage tracking and optimization
 */

// Memory region types for circuit operations
type MemoryRegionType = 
  | 'witness' 
  | 'constraint' 
  | 'proof' 
  | 'verification-key'
  | 'public-input' 
  | 'general';

// Pool statistics for monitoring
interface MemoryPoolStats {
  totalAllocated: number;
  totalUsed: number;
  fragmentationRatio: number;
  allocationCount: number;
  releaseCount: number;
  poolCount: Record<MemoryRegionType, number>;
}

/**
 * Securely wipes data from memory
 */
function secureWipe(data: ArrayBuffer | Uint8Array): void {
  try {
    const view = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
    view.fill(0);
  } catch (error) {
    console.error('Error during secure wipe:', error);
  }
}

/**
 * Class for managing memory allocation for circuit operations
 */
export class CircuitMemoryPool {
  private pools: Map<MemoryRegionType, ArrayBuffer[]> = new Map();
  private activeBuffers: Map<number, { buffer: ArrayBuffer, type: MemoryRegionType }> = new Map();
  private nextBufferId: number = 1;
  private totalAllocated: number = 0;
  private totalUsed: number = 0;
  private initialized: boolean = false;
  private maxPoolSizeMB: number = 0;
  private typicalSizes: Record<MemoryRegionType, number> = {
    'witness': 1024 * 1024, // 1MB
    'constraint': 2 * 1024 * 1024, // 2MB
    'proof': 512 * 1024, // 512KB
    'verification-key': 256 * 1024, // 256KB
    'public-input': 128 * 1024, // 128KB
    'general': 1024 * 1024 // 1MB default
  };
  
  /**
   * Initialize the memory pool system
   * @param maxPoolSizeMB Maximum pool size in megabytes
   */
  async initialize(maxPoolSizeMB: number = 50): Promise<boolean> {
    if (this.initialized) {
      console.warn('Memory pool already initialized');
      return true;
    }
    
    this.maxPoolSizeMB = maxPoolSizeMB;
    
    // Initialize empty pools for each type
    for (const type of Object.keys(this.typicalSizes) as MemoryRegionType[]) {
      this.pools.set(type, []);
    }
    
    this.initialized = true;
    return true;
  }
  
  /**
   * Allocate a buffer from the pool
   * @param size Size in bytes
   * @param type Memory region type
   * @returns ArrayBuffer
   */
  allocate(size: number, type: MemoryRegionType = 'general'): ArrayBuffer {
    if (!this.initialized) {
      throw new Error('Circuit memory pool not initialized');
    }
    
    // Check if we have a suitable buffer in the pool
    const pool = this.pools.get(type) || [];
    let buffer: ArrayBuffer | null = null;
    
    // Find best-fit buffer in the pool
    for (let i = 0; i < pool.length; i++) {
      if (pool[i].byteLength >= size) {
        buffer = pool[i];
        pool.splice(i, 1); // Remove from pool
        break;
      }
    }
    
    // If no suitable buffer found, create new one
    if (!buffer) {
      // Align size to typical size for this type if smaller
      const alignedSize = Math.max(size, this.typicalSizes[type] || 0);
      buffer = new ArrayBuffer(alignedSize);
      
      this.totalAllocated += alignedSize;
      
      // Check if we're exceeding maximum pool size
      if (this.totalAllocated > this.maxPoolSizeMB * 1024 * 1024) {
        console.warn(`Memory pool exceeding maximum size: ${this.totalAllocated} bytes`);
      }
    }
    
    // Register the active buffer
    const bufferId = this.nextBufferId++;
    this.activeBuffers.set(bufferId, { buffer, type });
    this.totalUsed += buffer.byteLength;
    
    return buffer;
  }
  
  /**
   * Release a buffer back to the pool
   * @param buffer Buffer to release
   * @param secureWipe Whether to securely wipe the buffer
   * @returns Success status
   */
  release(buffer: ArrayBuffer, shouldSecureWipe: boolean = true): boolean {
    if (!this.initialized) {
      console.warn('Cannot release buffer: pool not initialized');
      return false;
    }
    
    // Find the buffer ID from the activeBuffers map
    let bufferId: number = -1;
    let bufferInfo: { buffer: ArrayBuffer, type: MemoryRegionType } | undefined;
    
    for (const [id, info] of this.activeBuffers.entries()) {
      if (info.buffer === buffer) {
        bufferId = id;
        bufferInfo = info;
        break;
      }
    }
    
    if (bufferId === -1 || !bufferInfo) {
      console.warn('Cannot release buffer: not allocated from this pool');
      return false;
    }
    
    // Wipe the buffer if requested (for sensitive data)
    if (shouldSecureWipe) {
      secureWipe(buffer);
    }
    
    // Return to appropriate pool
    const type = bufferInfo.type;
    const pool = this.pools.get(type) || [];
    
    pool.push(buffer);
    this.pools.set(type, pool);
    
    // Update tracking
    this.activeBuffers.delete(bufferId);
    this.totalUsed -= buffer.byteLength;
    
    return true;
  }
  
  /**
   * Get current memory pool statistics
   * @returns Pool statistics
   */
  getStats(): MemoryPoolStats {
    const poolCount: Record<MemoryRegionType, number> = {
      'witness': 0,
      'constraint': 0,
      'proof': 0,
      'verification-key': 0,
      'public-input': 0,
      'general': 0
    };
    
    for (const [type, pool] of this.pools.entries()) {
      poolCount[type] = pool.length;
    }
    
    return {
      totalAllocated: this.totalAllocated,
      totalUsed: this.totalUsed,
      fragmentationRatio: this.totalAllocated > 0 ? 1 - (this.totalUsed / this.totalAllocated) : 0,
      allocationCount: this.nextBufferId - 1,
      releaseCount: (this.nextBufferId - 1) - this.activeBuffers.size,
      poolCount
    };
  }
  
  /**
   * Clean up any resources
   */
  cleanup(): void {
    if (!this.initialized) {
      return;
    }
    
    // Release all active buffers
    for (const [id, info] of this.activeBuffers.entries()) {
      this.release(info.buffer, true);
    }
    
    // Clear pools
    for (const type of Object.keys(this.typicalSizes) as MemoryRegionType[]) {
      this.pools.set(type, []);
    }
    
    this.activeBuffers.clear();
    this.totalAllocated = 0;
    this.totalUsed = 0;
    this.initialized = false;
  }
}