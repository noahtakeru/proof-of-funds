/**
 * ResourceMonitor.js - JavaScript implementation of resource monitoring
 * 
 * This module provides system resource monitoring functionality including
 * CPU, memory, network, and storage utilization tracking. It enables
 * applications to adapt to available resources and make intelligent
 * decisions about computation strategies.
 * 
 * @module resources/ResourceMonitor
 */

// Import Error System for proper error handling
import { SystemError, InputError, errorLogger } from '../ErrorSystem.js';

/**
 * ResourceType enum - Types of resources that can be monitored
 */
export const ResourceType = {
  CPU: 'cpu',
  MEMORY: 'memory',
  NETWORK: 'network',
  STORAGE: 'storage',
  BATTERY: 'battery',
  GPU: 'gpu'
};

/**
 * SamplingStrategy enum - Strategies for sampling resource usage
 */
export const SamplingStrategy = {
  CONTINUOUS: 'continuous',
  ON_DEMAND: 'on-demand',
  OPERATION_BOUNDARY: 'operation-boundary',
  ADAPTIVE: 'adaptive'
};

/**
 * Default monitoring configuration
 */
const DEFAULT_MONITORING_CONFIG = {
  resources: [
    ResourceType.CPU,
    ResourceType.MEMORY
  ],
  samplingIntervalMs: 5000, // 5 seconds
  maxHistory: 60, // Keep 5 minutes of history at default interval
  samplingStrategy: SamplingStrategy.ADAPTIVE,
  constraintThresholds: {
    [ResourceType.CPU]: 0.8, // 80% usage
    [ResourceType.MEMORY]: 0.85, // 85% usage
    [ResourceType.NETWORK]: 0.7, // 70% bandwidth usage
    [ResourceType.STORAGE]: 0.9, // 90% storage full
    [ResourceType.BATTERY]: 0.15, // 15% battery remaining
    [ResourceType.GPU]: 0.9 // 90% GPU usage
  },
  detailedMetrics: false
};

/**
 * ResourceMonitor class for tracking system resources
 */
export class ResourceMonitor {
  /**
   * Create a new resource monitor
   * 
   * @param {Object} config - Monitoring configuration
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_MONITORING_CONFIG, ...config };
    this.resourceStats = {};
    this.resourceHistory = {};
    this.monitoringInterval = null;
    this.callbacks = [];
    this.isMonitoring = false;
    this.startTime = 0;
    this.operationTimestamps = {};

    // Initialize resource stats
    for (const resource of this.config.resources) {
      this.resourceStats[resource] = this._createEmptyStats();
      this.resourceHistory[resource] = [];
    }
  }

  /**
   * Start resource monitoring
   * 
   * @returns {Promise<void>} Promise that resolves when monitoring is started
   */
  async startMonitoring() {
    if (this.isMonitoring) {
      return;
    }

    try {
      // Take initial measurements
      await this.sampleResources();

      this.isMonitoring = true;
      this.startTime = Date.now();

      // Set up interval for continuous monitoring if needed
      if (this.config.samplingStrategy === SamplingStrategy.CONTINUOUS ||
        this.config.samplingStrategy === SamplingStrategy.ADAPTIVE) {
        this.monitoringInterval = setInterval(
          () => this.sampleResources(),
          this.config.samplingIntervalMs
        );
      }
      
      errorLogger.info('Resource monitoring started', {
        resources: this.config.resources,
        strategy: this.config.samplingStrategy,
        context: 'ResourceMonitor.startMonitoring'
      });
    } catch (error) {
      errorLogger.error('Failed to start resource monitoring', {
        error,
        context: 'ResourceMonitor.startMonitoring'
      });

      throw new SystemError('Failed to start resource monitoring', {
        code: 5001, // SYSTEM_RESOURCE_ERROR
        recoverable: true,
        details: { originalError: error.message }
      });
    }
  }

  /**
   * Start continuous monitoring of resources
   * 
   * @returns {Promise<void>} Promise that resolves when monitoring is started
   */
  async startContinuousMonitoring() {
    // Save original strategy
    const originalStrategy = this.config.samplingStrategy;

    // Force continuous sampling strategy
    this.config.samplingStrategy = SamplingStrategy.CONTINUOUS;

    // Start monitoring
    await this.startMonitoring();

    // Restore original strategy if monitoring was not enabled
    if (!this.isMonitoring) {
      this.config.samplingStrategy = originalStrategy;
    }
  }

  /**
   * Stop resource monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    // Clear monitoring interval
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.isMonitoring = false;
    
    errorLogger.info('Resource monitoring stopped', {
      duration: Date.now() - this.startTime,
      context: 'ResourceMonitor.stopMonitoring'
    });
  }

  /**
   * Stop continuous monitoring of resources
   */
  stopContinuousMonitoring() {
    this.stopMonitoring();
  }

  /**
   * Take an immediate sample of resource usage
   * 
   * @returns {Promise<Object>} Promise that resolves to resource usage snapshot
   */
  async sampleResources() {
    try {
      let mostConstrainedResource;
      let highestConstraintLevel = 0;

      // Sample each resource
      for (const resource of this.config.resources) {
        const previousStats = this.resourceStats[resource];
        const newStats = await this._measureResource(resource);

        // Update stats
        this.resourceStats[resource] = newStats;

        // Update history
        if (this.resourceHistory[resource]) {
          this.resourceHistory[resource].push(newStats);

          // Trim history if needed
          if (this.resourceHistory[resource].length > this.config.maxHistory) {
            this.resourceHistory[resource].shift();
          }
        }

        // Check for constraints
        const constraintThreshold = this.config.constraintThresholds[resource];
        const isConstrained = newStats.currentUsage >= constraintThreshold;
        newStats.isConstrained = isConstrained;

        // Track most constrained resource
        const constraintLevel = newStats.currentUsage / constraintThreshold;
        if (isConstrained && constraintLevel > highestConstraintLevel) {
          highestConstraintLevel = constraintLevel;
          mostConstrainedResource = resource;
        }

        // Notify callbacks if resource state changed
        const constraintChanged = previousStats?.isConstrained !== isConstrained;
        if (constraintChanged ||
          Math.abs((previousStats?.currentUsage || 0) - newStats.currentUsage) > 0.1) {
          this._notifyResourceChanged(resource, previousStats, newStats, constraintChanged);
        }
      }

      // Create snapshot
      const snapshot = {
        timestamp: Date.now(),
        resources: { ...this.resourceStats },
        constraintLevel: highestConstraintLevel > 1 ? highestConstraintLevel : 0,
        mostConstrainedResource
      };

      return snapshot;
    } catch (error) {
      errorLogger.error('Failed to sample resources', {
        error,
        context: 'ResourceMonitor.sampleResources'
      });

      throw new SystemError('Failed to sample resources', {
        code: 5001, // SYSTEM_RESOURCE_ERROR
        recoverable: true,
        details: { originalError: error.message }
      });
    }
  }

  /**
   * Get current resource statistics
   * 
   * @param {string} resource - Resource type to get stats for, or undefined for all
   * @returns {Object} Current resource statistics
   */
  getResourceStats(resource) {
    if (resource) {
      return this.resourceStats[resource] || this._createEmptyStats();
    }

    return { ...this.resourceStats };
  }

  /**
   * Get system load information
   * 
   * @returns {number} System load as a number between 0-1
   */
  getSystemLoad() {
    // Get CPU stats as the primary indicator of system load
    const cpuStats = this.resourceStats[ResourceType.CPU];

    if (cpuStats) {
      return cpuStats.currentUsage;
    }

    // If CPU stats are not available, use the most constrained resource
    let maxUsage = 0;

    for (const resource of Object.values(ResourceType)) {
      const stats = this.resourceStats[resource];
      if (stats && stats.currentUsage > maxUsage) {
        maxUsage = stats.currentUsage;
      }
    }

    return maxUsage;
  }

  /**
   * Get battery level
   * 
   * @returns {number} Battery level as a number between 0-1, where 1 is full and 0 is empty
   */
  getBatteryLevel() {
    const batteryStats = this.resourceStats[ResourceType.BATTERY];

    if (batteryStats) {
      // Our battery usage is inverted (0 = full, 1 = empty)
      // Convert to standard battery level (1 = full, 0 = empty)
      return 1 - batteryStats.currentUsage;
    }

    // Default to full battery if not available
    return 1.0;
  }

  /**
   * Register a callback for resource change events
   * 
   * @param {Function} callback - Function to call when resource usage changes
   * @returns {Function} Function to unregister the callback
   */
  onResourceChange(callback) {
    this.callbacks.push(callback);

    // Return function to remove this callback
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Register a callback for resource change events
   * 
   * @param {Function} callback - Function to call when resource usage changes
   * @returns {Function} The registered callback for later removal
   */
  registerCallback(callback) {
    this.callbacks.push(callback);
    return callback;
  }

  /**
   * Unregister a previously registered callback
   * 
   * @param {Function} callback - The callback to remove
   */
  unregisterCallback(callback) {
    this.callbacks = this.callbacks.filter(cb => cb !== callback);
  }

  /**
   * Mark the start of an operation for monitoring
   * 
   * @param {string} operationId - Unique identifier for the operation
   * @returns {Promise<Object>} Current resource snapshot
   */
  async markOperationStart(operationId) {
    // Take a snapshot if we're not continuously monitoring
    let snapshot;
    if (this.config.samplingStrategy === SamplingStrategy.OPERATION_BOUNDARY ||
      !this.isMonitoring) {
      snapshot = await this.sampleResources();
    } else {
      snapshot = {
        timestamp: Date.now(),
        resources: { ...this.resourceStats },
        constraintLevel: 0
      };
    }

    // Record operation start
    this.operationTimestamps[operationId] = {
      start: Date.now()
    };

    return snapshot;
  }

  /**
   * Mark the end of an operation and get resource usage during the operation
   * 
   * @param {string} operationId - Unique identifier for the operation
   * @returns {Promise<Object>} Resource usage during the operation
   */
  async markOperationEnd(operationId) {
    const operationInfo = this.operationTimestamps[operationId];
    if (!operationInfo) {
      throw new InputError(`Unknown operation ID: ${operationId}`, {
        code: 7001, // INPUT_VALIDATION_ERROR
        recoverable: true,
        details: { operationId }
      });
    }

    // Take a snapshot
    const endSnapshot = await this.sampleResources();

    // Record operation end
    operationInfo.end = Date.now();
    const duration = operationInfo.end - operationInfo.start;

    // Calculate resource usage deltas
    const resourceDeltas = {};

    for (const resource of this.config.resources) {
      // Get resource history during this operation
      const history = this.resourceHistory[resource];
      if (history && history.length > 0) {
        // Find samples during this operation
        const operationSamples = history.filter(
          sample => sample.lastUpdated >= operationInfo.start &&
            (operationInfo.end ? sample.lastUpdated <= operationInfo.end : true)
        );

        if (operationSamples.length > 0) {
          // Calculate average usage during operation
          const totalUsage = operationSamples.reduce(
            (sum, sample) => sum + sample.currentUsage,
            0
          );
          resourceDeltas[resource] = totalUsage / operationSamples.length;
        }
      }
    }

    // Clean up
    delete this.operationTimestamps[operationId];

    return {
      duration,
      endSnapshot,
      resourceDeltas
    };
  }

  /**
   * Check if a specific resource is currently constrained
   * 
   * @param {string} resource - Resource type to check
   * @returns {boolean} True if the resource is constrained
   */
  isResourceConstrained(resource) {
    const stats = this.resourceStats[resource];
    return stats ? stats.isConstrained : false;
  }

  /**
   * Get a snapshot of all resource usage history
   * 
   * @returns {Object} Historical resource usage data
   */
  getResourceHistory() {
    return JSON.parse(JSON.stringify(this.resourceHistory));
  }

  /**
   * Update the monitoring configuration
   * 
   * @param {Object} config - New configuration options
   */
  updateConfig(config) {
    const wasMonitoring = this.isMonitoring;
    const oldInterval = this.config.samplingIntervalMs;
    const oldStrategy = this.config.samplingStrategy;

    // Stop monitoring if active
    if (wasMonitoring) {
      this.stopMonitoring();
    }

    // Update configuration
    this.config = { ...this.config, ...config };

    // Add new resources to track if needed
    if (config.resources) {
      for (const resource of this.config.resources) {
        if (!this.resourceStats[resource]) {
          this.resourceStats[resource] = this._createEmptyStats();
          this.resourceHistory[resource] = [];
        }
      }
    }

    // Restart monitoring if it was active and configuration changed significantly
    if (wasMonitoring &&
      (oldInterval !== this.config.samplingIntervalMs ||
        oldStrategy !== this.config.samplingStrategy)) {
      this.startMonitoring();
    }
  }

  /**
   * Notify listeners of resource changes
   * Public version of notifyResourceChanged
   * 
   * @param {Object} event - Resource change event
   */
  notifyListeners(event) {
    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch (error) {
        errorLogger.error(`Error notifying listeners for ${event.resource}`, {
          error,
          context: 'ResourceMonitor.notifyListeners'
        });
      }
    }
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  /**
   * Create empty resource statistics
   * 
   * @returns {Object} Empty resource stats object
   * @private
   */
  _createEmptyStats() {
    return {
      currentUsage: 0,
      averageUsage: 0,
      peakUsage: 0,
      isConstrained: false,
      lastUpdated: Date.now(),
      metrics: {}
    };
  }

  /**
   * Measure resource usage for a specific resource
   * 
   * @param {string} resource - Resource type to measure
   * @returns {Promise<Object>} Current resource statistics
   * @private
   */
  async _measureResource(resource) {
    try {
      // Get previous stats for this resource
      const previous = this.resourceStats[resource] || this._createEmptyStats();
      const history = this.resourceHistory[resource] || [];

      // Default new stats based on previous
      const stats = {
        currentUsage: 0,
        averageUsage: previous.averageUsage,
        peakUsage: previous.peakUsage,
        isConstrained: previous.isConstrained,
        lastUpdated: Date.now(),
        metrics: { ...previous.metrics }
      };

      // Measure resource-specific usage (simplified implementation)
      // In a real implementation, this would use more sophisticated methods
      switch (resource) {
        case ResourceType.CPU:
          stats.currentUsage = 0.2 + Math.random() * 0.4; // Simplified estimation
          break;
        case ResourceType.MEMORY:
          stats.currentUsage = 0.3 + Math.random() * 0.4; // Simplified estimation
          break;
        case ResourceType.NETWORK:
          stats.currentUsage = 0.3; // Simplified estimation
          break;
        case ResourceType.STORAGE:
          stats.currentUsage = 0.5; // Simplified estimation
          break;
        case ResourceType.BATTERY:
          stats.currentUsage = 0.1; // Simplified estimation
          break;
        case ResourceType.GPU:
          stats.currentUsage = 0.3; // Simplified estimation
          break;
      }

      // Update peak usage
      stats.peakUsage = Math.max(previous.peakUsage, stats.currentUsage);

      // Update average usage
      if (history.length > 0) {
        const totalUsage = history.reduce((sum, s) => sum + s.currentUsage, 0) + stats.currentUsage;
        stats.averageUsage = totalUsage / (history.length + 1);
      } else {
        stats.averageUsage = stats.currentUsage;
      }

      return stats;
    } catch (error) {
      errorLogger.error(`Failed to measure resource ${resource}`, {
        error,
        context: 'ResourceMonitor._measureResource'
      });

      // Return previous stats or empty stats
      return this.resourceStats[resource] || this._createEmptyStats();
    }
  }

  /**
   * Notify all registered callbacks of a resource change
   * 
   * @param {string} resource - Resource that changed
   * @param {Object} previousStats - Previous resource statistics
   * @param {Object} currentStats - Current resource statistics
   * @param {boolean} constraintChanged - Whether constraint status changed
   * @private
   */
  _notifyResourceChanged(resource, previousStats, currentStats, constraintChanged) {
    // Call the constraint detected callback if configured
    if (constraintChanged && currentStats.isConstrained && this.config.onConstraintDetected) {
      this.config.onConstraintDetected(resource, currentStats);
    }

    // Notify all callbacks
    const event = {
      resource,
      previousStats,
      currentStats,
      constraintChanged
    };

    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch (error) {
        errorLogger.error(`Error in resource change callback for ${resource}`, {
          error,
          context: 'ResourceMonitor._notifyResourceChanged'
        });
      }
    }
  }
}

// Export default object for ESM default import
export default ResourceMonitor;