/**
 * ResourceAllocator.js - JavaScript implementation of resource allocation
 * 
 * This module provides intelligent resource allocation based on system 
 * conditions and monitoring data. It optimizes ZK proof operations to work
 * within available system constraints.
 * 
 * @module resources/ResourceAllocator
 */

// Import dependencies
import { ResourceMonitor, ResourceType } from './ResourceMonitor.mjs';
import { SystemError, errorLogger } from '../ErrorSystem.js';

/**
 * Represents a request for resource allocation
 */
export class AllocationRequest {
  /**
   * Create a new allocation request
   * 
   * @param {Object} options - Request options
   * @param {string} options.operation - Name of the operation requiring resources
   * @param {number} options.cpuWeight - Relative CPU importance (0-1)
   * @param {number} options.memoryWeight - Relative memory importance (0-1)
   * @param {boolean} options.critical - Whether this is a critical operation
   * @param {number} options.minCpu - Minimum CPU allocation required
   * @param {number} options.minMemory - Minimum memory allocation required
   * @param {Function} options.onDenied - Callback when allocation is denied
   */
  constructor(options = {}) {
    this.operation = options.operation || 'unnamed-operation';
    this.cpuWeight = typeof options.cpuWeight === 'number' ? options.cpuWeight : 0.5;
    this.memoryWeight = typeof options.memoryWeight === 'number' ? options.memoryWeight : 0.5;
    this.critical = !!options.critical;
    this.minCpu = typeof options.minCpu === 'number' ? options.minCpu : 0.1;
    this.minMemory = typeof options.minMemory === 'number' ? options.minMemory : 0.1;
    this.onDenied = typeof options.onDenied === 'function' ? options.onDenied : null;
    this.timestamp = Date.now();
  }
}

/**
 * Represents a resource allocation granted by the system
 */
export class Allocation {
  /**
   * Create a new allocation
   * 
   * @param {string} id - Unique identifier for the allocation
   * @param {Object} resources - Allocated resource amounts
   * @param {number} resources.cpu - CPU allocation (0-1)
   * @param {number} resources.memory - Memory allocation (0-1)
   * @param {string} operation - Operation name
   * @param {Function} releaseCallback - Function to call to release resources
   */
  constructor(id, resources, operation, releaseCallback) {
    this.id = id;
    this.resources = resources;
    this.operation = operation;
    this.timestamp = Date.now();
    this.released = false;
    this.releaseCallback = releaseCallback;
  }

  /**
   * Release allocated resources
   */
  release() {
    if (!this.released && typeof this.releaseCallback === 'function') {
      this.released = true;
      this.releaseCallback(this);
    }
  }
}

/**
 * Resource allocation strategy
 */
export const AllocationStrategy = {
  FAIRSHARE: 'fairshare',  // Distribute resources based on weights
  PRIORITY: 'priority',    // Prioritize critical operations
  FIFO: 'fifo',            // First-come, first-served
  ADAPTIVE: 'adaptive'     // Adapt based on system load
};

/**
 * ResourceAllocator manages system resources for efficient ZK proof operations
 */
export class ResourceAllocator {
  /**
   * Create a new ResourceAllocator
   * 
   * @param {ResourceMonitor} resourceMonitor - Resource monitor instance
   * @param {Object} options - Configuration options
   * @param {string} options.strategy - Allocation strategy to use
   * @param {number} options.maxCpuUtilization - Maximum CPU utilization (0-1)
   * @param {number} options.maxMemoryUtilization - Maximum memory utilization (0-1)
   * @param {number} options.reservedCpu - Reserved CPU capacity (0-1)
   * @param {number} options.reservedMemory - Reserved memory capacity (0-1)
   */
  constructor(resourceMonitor, options = {}) {
    if (!(resourceMonitor instanceof ResourceMonitor)) {
      throw new SystemError('ResourceAllocator requires a valid ResourceMonitor instance', {
        code: 5002, // SYSTEM_CONFIGURATION_ERROR
        recoverable: false,
        details: { providedMonitor: typeof resourceMonitor }
      });
    }

    this.resourceMonitor = resourceMonitor;
    this.strategy = options.strategy || AllocationStrategy.ADAPTIVE;
    this.maxCpuUtilization = typeof options.maxCpuUtilization === 'number' ? 
      options.maxCpuUtilization : 0.8;
    this.maxMemoryUtilization = typeof options.maxMemoryUtilization === 'number' ? 
      options.maxMemoryUtilization : 0.8;
    this.reservedCpu = typeof options.reservedCpu === 'number' ? 
      options.reservedCpu : 0.1;
    this.reservedMemory = typeof options.reservedMemory === 'number' ? 
      options.reservedMemory : 0.1;
    
    this.activeAllocations = new Map();
    this.pendingRequests = [];
    this.totalAllocatedCpu = 0;
    this.totalAllocatedMemory = 0;
    this.lastAllocationId = 0;
    
    // Register for resource change notifications
    this.resourceMonitor.onResourceChange(this._handleResourceChange.bind(this));
  }
  
  /**
   * Request resource allocation for an operation
   * 
   * @param {AllocationRequest|Object} request - Allocation request
   * @returns {Promise<Allocation>} Promise resolving to the allocation
   */
  async requestAllocation(request) {
    // Ensure request is an AllocationRequest instance
    const allocationRequest = request instanceof AllocationRequest ? 
      request : new AllocationRequest(request);
    
    try {
      // Check system resources
      const snapshot = await this.resourceMonitor.sampleResources();
      
      // Calculate available resources
      const cpuStats = snapshot.resources[ResourceType.CPU] || { currentUsage: 0 };
      const memoryStats = snapshot.resources[ResourceType.MEMORY] || { currentUsage: 0 };
      
      const availableCpu = Math.max(0, this.maxCpuUtilization - cpuStats.currentUsage) - this.reservedCpu;
      const availableMemory = Math.max(0, this.maxMemoryUtilization - memoryStats.currentUsage) - this.reservedMemory;
      
      // Check if minimum requirements can be met
      if (availableCpu < allocationRequest.minCpu || availableMemory < allocationRequest.minMemory) {
        // Resource constraints prevent allocation
        errorLogger.warn('Resource allocation denied', {
          context: 'ResourceAllocator.requestAllocation',
          operation: allocationRequest.operation,
          requiredCpu: allocationRequest.minCpu,
          requiredMemory: allocationRequest.minMemory,
          availableCpu,
          availableMemory
        });
        
        // Call onDenied callback if provided
        if (typeof allocationRequest.onDenied === 'function') {
          allocationRequest.onDenied({
            reason: 'insufficient_resources',
            available: { cpu: availableCpu, memory: availableMemory },
            requested: { cpu: allocationRequest.minCpu, memory: allocationRequest.minMemory }
          });
        }
        
        // Return null to indicate allocation failure
        return null;
      }
      
      // Determine allocation amounts based on strategy
      let allocatedCpu, allocatedMemory;
      
      switch (this.strategy) {
        case AllocationStrategy.PRIORITY:
          // Prioritize critical operations
          if (allocationRequest.critical) {
            allocatedCpu = Math.min(availableCpu, allocationRequest.cpuWeight);
            allocatedMemory = Math.min(availableMemory, allocationRequest.memoryWeight);
          } else {
            allocatedCpu = Math.min(availableCpu * 0.7, allocationRequest.cpuWeight);
            allocatedMemory = Math.min(availableMemory * 0.7, allocationRequest.memoryWeight);
          }
          break;
          
        case AllocationStrategy.FIFO:
          // First-come, first-served (simple allocation)
          allocatedCpu = Math.min(availableCpu, allocationRequest.cpuWeight);
          allocatedMemory = Math.min(availableMemory, allocationRequest.memoryWeight);
          break;
          
        case AllocationStrategy.ADAPTIVE:
          // Adapt based on system load
          const systemLoad = this.resourceMonitor.getSystemLoad();
          const adaptiveFactor = 1 - Math.min(systemLoad * 1.5, 0.8);
          
          allocatedCpu = Math.min(availableCpu * adaptiveFactor, allocationRequest.cpuWeight);
          allocatedMemory = Math.min(availableMemory * adaptiveFactor, allocationRequest.memoryWeight);
          break;
          
        case AllocationStrategy.FAIRSHARE:
        default:
          // Distribute fairly based on weights and availability
          const activeCount = this.activeAllocations.size + 1;
          const fairShareCpu = availableCpu / activeCount;
          const fairShareMemory = availableMemory / activeCount;
          
          allocatedCpu = Math.min(fairShareCpu * allocationRequest.cpuWeight, availableCpu);
          allocatedMemory = Math.min(fairShareMemory * allocationRequest.memoryWeight, availableMemory);
          break;
      }
      
      // Create the allocation
      const allocationId = `alloc_${Date.now()}_${++this.lastAllocationId}`;
      const allocation = new Allocation(
        allocationId,
        {
          cpu: Math.max(allocationRequest.minCpu, allocatedCpu),
          memory: Math.max(allocationRequest.minMemory, allocatedMemory)
        },
        allocationRequest.operation,
        this._releaseAllocation.bind(this)
      );
      
      // Update tracking
      this.activeAllocations.set(allocationId, allocation);
      this.totalAllocatedCpu += allocation.resources.cpu;
      this.totalAllocatedMemory += allocation.resources.memory;
      
      errorLogger.info('Resource allocation granted', {
        context: 'ResourceAllocator.requestAllocation',
        operation: allocationRequest.operation,
        allocationId,
        cpu: allocation.resources.cpu,
        memory: allocation.resources.memory
      });
      
      return allocation;
    } catch (error) {
      errorLogger.error('Failed to allocate resources', {
        context: 'ResourceAllocator.requestAllocation',
        operation: allocationRequest.operation,
        error
      });
      
      // Call onDenied callback if provided
      if (typeof allocationRequest.onDenied === 'function') {
        allocationRequest.onDenied({
          reason: 'allocation_error',
          error: error.message
        });
      }
      
      return null;
    }
  }
  
  /**
   * Get total allocated resources
   * 
   * @returns {Object} Total allocated resources
   */
  getTotalAllocatedResources() {
    return {
      cpu: this.totalAllocatedCpu,
      memory: this.totalAllocatedMemory,
      allocations: this.activeAllocations.size
    };
  }
  
  /**
   * Get available resources for allocation
   * 
   * @returns {Promise<Object>} Available resources
   */
  async getAvailableResources() {
    try {
      const snapshot = await this.resourceMonitor.sampleResources();
      
      const cpuStats = snapshot.resources[ResourceType.CPU] || { currentUsage: 0 };
      const memoryStats = snapshot.resources[ResourceType.MEMORY] || { currentUsage: 0 };
      
      const availableCpu = Math.max(0, this.maxCpuUtilization - cpuStats.currentUsage - this.totalAllocatedCpu);
      const availableMemory = Math.max(0, this.maxMemoryUtilization - memoryStats.currentUsage - this.totalAllocatedMemory);
      
      return {
        cpu: Math.max(0, availableCpu - this.reservedCpu),
        memory: Math.max(0, availableMemory - this.reservedMemory),
        systemCpu: cpuStats.currentUsage,
        systemMemory: memoryStats.currentUsage
      };
    } catch (error) {
      errorLogger.error('Failed to get available resources', {
        context: 'ResourceAllocator.getAvailableResources',
        error
      });
      
      // Return conservative estimate
      return {
        cpu: 0.1,
        memory: 0.1,
        systemCpu: 0.5,
        systemMemory: 0.5
      };
    }
  }
  
  /**
   * Change the allocation strategy
   * 
   * @param {string} strategy - New allocation strategy
   */
  setAllocationStrategy(strategy) {
    if (Object.values(AllocationStrategy).includes(strategy)) {
      this.strategy = strategy;
      
      errorLogger.info('Changed allocation strategy', {
        context: 'ResourceAllocator.setAllocationStrategy',
        strategy
      });
    } else {
      errorLogger.warn('Invalid allocation strategy', {
        context: 'ResourceAllocator.setAllocationStrategy',
        requestedStrategy: strategy,
        availableStrategies: Object.values(AllocationStrategy)
      });
    }
  }
  
  /**
   * Handle resource changes reported by the resource monitor
   * 
   * @param {Object} event - Resource change event
   * @private
   */
  _handleResourceChange(event) {
    // If resource is constrained, adjust allocations
    if (event.constraintChanged && event.currentStats.isConstrained) {
      this._adjustAllocationsForConstraint(event.resource);
    }
  }
  
  /**
   * Adjust active allocations in response to resource constraints
   * 
   * @param {string} constrainedResource - The constrained resource type
   * @private
   */
  _adjustAllocationsForConstraint(constrainedResource) {
    // Skip if no active allocations
    if (this.activeAllocations.size === 0) {
      return;
    }
    
    errorLogger.warn('Adjusting allocations due to resource constraint', {
      context: 'ResourceAllocator._adjustAllocationsForConstraint',
      constrainedResource,
      activeAllocations: this.activeAllocations.size
    });
    
    // Sort allocations by priority (critical first, then by age)
    const sortedAllocations = Array.from(this.activeAllocations.values())
      .sort((a, b) => {
        // Critical operations first
        if (a.critical && !b.critical) return -1;
        if (!a.critical && b.critical) return 1;
        
        // Older allocations have higher priority
        return a.timestamp - b.timestamp;
      });
    
    // Reduce allocations by 20% across the board
    let reductionFactor = 0.8;
    
    for (const allocation of sortedAllocations) {
      // Skip already released allocations
      if (allocation.released) continue;
      
      if (constrainedResource === ResourceType.CPU) {
        // Reduce CPU allocation
        const newCpu = allocation.resources.cpu * reductionFactor;
        this.totalAllocatedCpu -= (allocation.resources.cpu - newCpu);
        allocation.resources.cpu = newCpu;
      } else if (constrainedResource === ResourceType.MEMORY) {
        // Reduce memory allocation
        const newMemory = allocation.resources.memory * reductionFactor;
        this.totalAllocatedMemory -= (allocation.resources.memory - newMemory);
        allocation.resources.memory = newMemory;
      }
    }
  }
  
  /**
   * Release an allocation and update tracking
   * 
   * @param {Allocation} allocation - The allocation to release
   * @private
   */
  _releaseAllocation(allocation) {
    if (!allocation || !this.activeAllocations.has(allocation.id)) {
      return;
    }
    
    // Update total allocated resources
    this.totalAllocatedCpu -= allocation.resources.cpu;
    this.totalAllocatedMemory -= allocation.resources.memory;
    
    // Remove from active allocations
    this.activeAllocations.delete(allocation.id);
    
    errorLogger.info('Released resource allocation', {
      context: 'ResourceAllocator._releaseAllocation',
      operation: allocation.operation,
      allocationId: allocation.id
    });
    
    // Process any pending requests
    this._processPendingRequests();
  }
  
  /**
   * Process any pending allocation requests
   * 
   * @private
   */
  async _processPendingRequests() {
    if (this.pendingRequests.length === 0) {
      return;
    }
    
    // Get current available resources
    const available = await this.getAvailableResources();
    
    // Process requests that can be fulfilled
    const remainingRequests = [];
    
    for (const request of this.pendingRequests) {
      if (available.cpu >= request.minCpu && available.memory >= request.minMemory) {
        // Request can be fulfilled
        this.requestAllocation(request).catch(error => {
          errorLogger.error('Failed to process pending allocation request', {
            context: 'ResourceAllocator._processPendingRequests',
            operation: request.operation,
            error
          });
        });
        
        // Update available resources
        available.cpu -= request.minCpu;
        available.memory -= request.minMemory;
      } else {
        // Request cannot be fulfilled yet
        remainingRequests.push(request);
      }
    }
    
    // Update pending requests
    this.pendingRequests = remainingRequests;
  }
}

export default ResourceAllocator;