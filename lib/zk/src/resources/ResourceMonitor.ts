/**
 * ResourceMonitor.ts - System resource monitoring
 * 
 * This module provides real-time monitoring of system resources
 * including CPU, memory, network, and storage utilization.
 * 
 * The ResourceMonitor is a critical component for dynamic resource allocation
 * in the ZK proof system. It enables the application to:
 * 
 * 1. Track resource availability in real-time
 * 2. Make intelligent decisions about proof generation
 * 3. Adapt computation strategies based on available resources
 * 4. Prevent performance degradation from resource exhaustion
 * 5. Monitor resource usage during ZK operations
 * 
 * This monitoring system works across both browser and Node.js environments,
 * with environment-specific implementations for each resource type.
 * 
 * @author ZK Infrastructure Team
 * @created June 2024
 * @last-modified July 2024
 * 
 * @example
 * // Basic usage
 * const monitor = new ResourceMonitor();
 * await monitor.startMonitoring();
 * const snapshot = await monitor.sampleResources();
 * console.log('Memory usage:', snapshot.resources.memory?.currentUsage);
 * 
 * // Monitor a specific operation
 * await monitor.markOperationStart('generateProof');
 * // ... perform operation
 * const result = await monitor.markOperationEnd('generateProof');
 * console.log('CPU delta:', result.resourceDeltas.cpu);
 * 
 * @module ResourceMonitor
 */

// Import error handling utilities
import { InputError, SystemError } from '../zkErrorHandler.mjs';
import zkErrorLoggerModule from '../zkErrorLogger.mjs';

// Get error logger
const { zkErrorLogger } = zkErrorLoggerModule;

/**
 * Types of resources that can be monitored
 * 
 * Each resource type represents a different system component that can be
 * monitored and managed by the application. The resource types are designed
 * to cover all potential constraints that might affect ZK proof generation.
 */
export enum ResourceType {
  /** CPU utilization */
  CPU = 'cpu',
  /** Memory usage */
  MEMORY = 'memory',
  /** Network bandwidth */
  NETWORK = 'network',
  /** Storage space */
  STORAGE = 'storage',
  /** Battery level (mobile only) */
  BATTERY = 'battery',
  /** GPU utilization (if available) */
  GPU = 'gpu'
}

/**
 * Sampling strategy for resource monitoring
 * 
 * Different monitoring scenarios require different sampling approaches.
 * These strategies allow for optimization of monitoring overhead based
 * on application needs and user context.
 */
export enum SamplingStrategy {
  /** Continuous sampling at regular intervals */
  CONTINUOUS = 'continuous',
  /** Sample on demand only */
  ON_DEMAND = 'on-demand',
  /** Sample at start and end of operations */
  OPERATION_BOUNDARY = 'operation-boundary',
  /** Adaptive sampling based on resource pressure */
  ADAPTIVE = 'adaptive'
}

/**
 * Resource usage statistics
 * 
 * Provides a comprehensive view of resource utilization with both
 * current and historical metrics. Includes constraint detection to
 * identify when resources are approaching critical thresholds.
 */
export interface ResourceStats {
  /** Current usage as a percentage (0-1) */
  currentUsage: number;
  /** Average usage over the monitoring period */
  averageUsage: number;
  /** Peak usage recorded */
  peakUsage: number;
  /** Whether this resource is constrained */
  isConstrained: boolean;
  /** Timestamp of last measurement */
  lastUpdated: number;
  /** Additional resource-specific metrics */
  metrics: Record<string, number>;
}

/**
 * Resource monitoring configuration
 * 
 * Comprehensive configuration options for the resource monitoring system.
 * Allows fine-tuning of monitoring behavior based on application requirements
 * and environmental constraints.
 */
export interface MonitoringConfig {
  /** Which resources to monitor */
  resources: ResourceType[];
  /** Sampling interval in milliseconds */
  samplingIntervalMs: number;
  /** Maximum history to keep (number of samples) */
  maxHistory: number;
  /** Sampling strategy to use */
  samplingStrategy: SamplingStrategy;
  /** Constraint thresholds as percentages (0-1) */
  constraintThresholds: Record<ResourceType, number>;
  /** Whether to enable detailed metrics */
  detailedMetrics: boolean;
  /** Callback when resource constraints are detected */
  onConstraintDetected?: (resource: ResourceType, stats: ResourceStats) => void;
}

/**
 * Default monitoring configuration
 * 
 * These defaults are carefully tuned to balance monitoring accuracy with
 * minimal performance impact. The thresholds are based on empirical testing
 * across different device types and operating conditions.
 */
const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
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
 * Snapshot of all resource usage
 * 
 * Provides a point-in-time view of system resource utilization.
 * Used for decision-making about resource allocation and computation strategies.
 */
export interface SystemResourceSnapshot {
  /** Timestamp when the snapshot was taken */
  timestamp: number;
  /** Stats for each monitored resource */
  resources: Partial<Record<ResourceType, ResourceStats>>;
  /** Overall system constraint level (0-1) */
  constraintLevel: number;
  /** Most constrained resource */
  mostConstrainedResource?: ResourceType;
}

/**
 * Event emitted when resource usage changes
 * 
 * Used by the publish-subscribe system to notify subscribers about
 * significant changes in resource availability. Enables reactive
 * adaptation to changing system conditions.
 */
export interface ResourceChangeEvent {
  /** Resource that changed */
  resource: ResourceType;
  /** Previous usage statistics */
  previousStats?: ResourceStats;
  /** Current usage statistics */
  currentStats: ResourceStats;
  /** Whether this change indicates a new constraint */
  constraintChanged: boolean;
}

/**
 * CPU usage details
 * 
 * Detailed metrics about CPU utilization, including per-core information
 * and hardware characteristics. Used for fine-grained resource allocation
 * decisions and performance optimization.
 */
export interface CpuDetails {
  /** CPU cores available */
  cores: number;
  /** Usage per core as a percentage (0-1) */
  coreUsage: number[];
  /** Clock speed in MHz */
  clockSpeed?: number;
  /** CPU temperature if available */
  temperature?: number;
}

/**
 * Memory usage details
 * 
 * Comprehensive memory metrics including both system and application-specific
 * usage. Critical for preventing out-of-memory errors during proof generation
 * and optimizing memory-intensive operations.
 */
export interface MemoryDetails {
  /** Total memory in MB */
  totalMemory: number;
  /** Free memory in MB */
  freeMemory: number;
  /** Memory used by the current process in MB */
  processMemory: number;
  /** JavaScript heap size in MB */
  jsHeapSize?: number;
  /** Available JavaScript heap size in MB */
  jsHeapLimit?: number;
}

/**
 * Network usage details
 * 
 * Network performance and connectivity metrics. Important for optimizing
 * remote proof generation, fetching verification keys, and transmitting
 * proof data.
 */
export interface NetworkDetails {
  /** Download speed in KB/s */
  downloadSpeed?: number;
  /** Upload speed in KB/s */
  uploadSpeed?: number;
  /** Network latency in ms */
  latency?: number;
  /** Whether the connection is metered */
  metered?: boolean;
  /** Connection type if available */
  connectionType?: string;
}

/**
 * Storage usage details
 * 
 * Storage capacity and availability metrics. Used for managing cached
 * verification keys, proof artifacts, and persistent data.
 */
export interface StorageDetails {
  /** Total storage in MB */
  totalStorage?: number;
  /** Free storage in MB */
  freeStorage?: number;
  /** Storage quota for the application in MB */
  quota?: number;
  /** Storage usage by the application in MB */
  usage?: number;
  /** Whether persistent storage is available */
  persistentStorageAvailable?: boolean;
}

/**
 * Resource monitor callback type
 * 
 * Function signature for callbacks that react to resource changes.
 * Used by the observer pattern implementation to notify subscribers.
 */
export type ResourceCallback = (event: ResourceChangeEvent) => void;

/**
 * Resource monitor for tracking system resources
 */
export class ResourceMonitor {
  private config: MonitoringConfig;
  private resourceStats: Partial<Record<ResourceType, ResourceStats>> = {};
  private resourceHistory: Partial<Record<ResourceType, ResourceStats[]>> = {};
  private monitoringInterval: any = null;
  private callbacks: ResourceCallback[] = [];
  private isMonitoring: boolean = false;
  private startTime: number = 0;
  private operationTimestamps: Record<string, { start: number, end?: number }> = {};

  /**
   * Create a new resource monitor
   * 
   * @param config - Monitoring configuration
   */
  constructor(config?: Partial<MonitoringConfig>) {
    this.config = { ...DEFAULT_MONITORING_CONFIG, ...config };

    // Initialize resource stats
    for (const resource of this.config.resources) {
      this.resourceStats[resource] = this.createEmptyStats();
      this.resourceHistory[resource] = [];
    }
  }

  /**
   * Start resource monitoring
   * 
   * @returns Promise that resolves when monitoring is started
   */
  public async startMonitoring(): Promise<void> {
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

      zkErrorLogger.log('INFO', 'Resource monitoring started', {
        resources: this.config.resources,
        strategy: this.config.samplingStrategy
      });
    } catch (error) {
      zkErrorLogger.logError(error, {
        operation: 'startMonitoring',
        context: { config: this.config }
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
   * Alias for startMonitoring for regression test compatibility
   * 
   * @returns Promise that resolves when monitoring is started
   */
  public async startContinuousMonitoring(): Promise<void> {
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
  public stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    // Clear monitoring interval
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.isMonitoring = false;

    zkErrorLogger.log('INFO', 'Resource monitoring stopped', {
      duration: Date.now() - this.startTime
    });
  }

  /**
   * Stop continuous monitoring of resources
   * Alias for stopMonitoring for regression test compatibility
   */
  public stopContinuousMonitoring(): void {
    this.stopMonitoring();
  }

  /**
   * Take an immediate sample of resource usage
   * 
   * @returns Promise that resolves to resource usage snapshot
   */
  public async sampleResources(): Promise<SystemResourceSnapshot> {
    try {
      let mostConstrainedResource: ResourceType | undefined;
      let highestConstraintLevel = 0;

      // Sample each resource
      for (const resource of this.config.resources) {
        const previousStats = this.resourceStats[resource];
        const newStats = await this.measureResource(resource);

        // Update stats
        this.resourceStats[resource] = newStats;

        // Update history
        if (this.resourceHistory[resource]) {
          this.resourceHistory[resource]!.push(newStats);

          // Trim history if needed
          if (this.resourceHistory[resource]!.length > this.config.maxHistory) {
            this.resourceHistory[resource]!.shift();
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
          this.notifyResourceChanged(resource, previousStats, newStats, constraintChanged);
        }
      }

      // Create snapshot
      const snapshot: SystemResourceSnapshot = {
        timestamp: Date.now(),
        resources: { ...this.resourceStats },
        constraintLevel: highestConstraintLevel > 1 ? highestConstraintLevel : 0,
        mostConstrainedResource
      };

      return snapshot;
    } catch (error) {
      zkErrorLogger.logError(error, {
        operation: 'sampleResources',
        context: {
          resources: this.config.resources,
          isMonitoring: this.isMonitoring
        }
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
   * @param resource - Resource type to get stats for, or undefined for all
   * @returns Current resource statistics
   */
  public getResourceStats(resource?: ResourceType):
    Partial<Record<ResourceType, ResourceStats>> | ResourceStats {
    if (resource) {
      return this.resourceStats[resource] || this.createEmptyStats();
    }

    return { ...this.resourceStats };
  }

  /**
   * Get system load information
   * 
   * @returns System load as a number between 0-1
   */
  public getSystemLoad(): number {
    // Get CPU stats as the primary indicator of system load
    const cpuStats = this.resourceStats[ResourceType.CPU];

    if (cpuStats) {
      return cpuStats.currentUsage;
    }

    // If CPU stats are not available, use the most constrained resource
    let maxUsage = 0;

    for (const resource of Object.values(ResourceType)) {
      const stats = this.resourceStats[resource as ResourceType];
      if (stats && stats.currentUsage > maxUsage) {
        maxUsage = stats.currentUsage;
      }
    }

    return maxUsage;
  }

  /**
   * Get battery level
   * 
   * @returns Battery level as a number between 0-1, where 1 is full and 0 is empty
   */
  public getBatteryLevel(): number {
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
   * Get detailed metrics for a specific resource
   * 
   * @param resource - Resource type to get details for
   * @returns Detailed resource metrics
   */
  public async getDetailedMetrics(resource: ResourceType): Promise<
    CpuDetails | MemoryDetails | NetworkDetails | StorageDetails | null
  > {
    try {
      switch (resource) {
        case ResourceType.CPU:
          return await this.getCpuDetails();
        case ResourceType.MEMORY:
          return await this.getMemoryDetails();
        case ResourceType.NETWORK:
          return await this.getNetworkDetails();
        case ResourceType.STORAGE:
          return await this.getStorageDetails();
        default:
          return null;
      }
    } catch (error) {
      zkErrorLogger.logError(error, {
        operation: 'getDetailedMetrics',
        context: { resource }
      });

      return null;
    }
  }

  /**
   * Register a callback for resource change events
   * 
   * @param callback - Function to call when resource usage changes
   * @returns Function to unregister the callback
   */
  public onResourceChange(callback: ResourceCallback): () => void {
    this.callbacks.push(callback);

    // Return function to remove this callback
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Register a callback for resource change events
   * Alias for onResourceChange for compatibility with regression tests
   * 
   * @param callback - Function to call when resource usage changes
   * @returns The registered callback for later removal
   */
  public registerCallback(callback: ResourceCallback): ResourceCallback {
    this.callbacks.push(callback);
    return callback;
  }

  /**
   * Unregister a previously registered callback
   * 
   * @param callback - The callback to remove
   */
  public unregisterCallback(callback: ResourceCallback): void {
    this.callbacks = this.callbacks.filter(cb => cb !== callback);
  }

  /**
   * Mark the start of an operation for monitoring
   * 
   * @param operationId - Unique identifier for the operation
   * @returns Current resource snapshot
   */
  public async markOperationStart(operationId: string): Promise<SystemResourceSnapshot> {
    // Take a snapshot if we're not continuously monitoring
    let snapshot: SystemResourceSnapshot;
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
   * @param operationId - Unique identifier for the operation
   * @returns Resource usage during the operation
   */
  public async markOperationEnd(operationId: string): Promise<{
    duration: number;
    startSnapshot?: SystemResourceSnapshot;
    endSnapshot: SystemResourceSnapshot;
    resourceDeltas: Partial<Record<ResourceType, number>>;
  }> {
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
    const resourceDeltas: Partial<Record<ResourceType, number>> = {};

    for (const resource of this.config.resources) {
      // Get resource history during this operation
      const history = this.resourceHistory[resource];
      if (history && history.length > 0) {
        // Find samples during this operation
        const operationSamples = history.filter(
          sample => sample.lastUpdated >= operationInfo.start &&
            sample.lastUpdated <= operationInfo.end
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
   * @param resource - Resource type to check
   * @returns True if the resource is constrained
   */
  public isResourceConstrained(resource: ResourceType): boolean {
    const stats = this.resourceStats[resource];
    return stats ? stats.isConstrained : false;
  }

  /**
   * Get a snapshot of all resource usage history
   * 
   * @returns Historical resource usage data
   */
  public getResourceHistory(): Partial<Record<ResourceType, ResourceStats[]>> {
    return JSON.parse(JSON.stringify(this.resourceHistory));
  }

  /**
   * Update the monitoring configuration
   * 
   * @param config - New configuration options
   */
  public updateConfig(config: Partial<MonitoringConfig>): void {
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
          this.resourceStats[resource] = this.createEmptyStats();
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

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  /**
   * Create empty resource statistics
   * 
   * @returns Empty resource stats object
   * @private
   */
  private createEmptyStats(): ResourceStats {
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
   * @param resource - Resource type to measure
   * @returns Current resource statistics
   * @private
   */
  private async measureResource(resource: ResourceType): Promise<ResourceStats> {
    try {
      // Get previous stats for this resource
      const previous = this.resourceStats[resource] || this.createEmptyStats();
      const history = this.resourceHistory[resource] || [];

      // Default new stats based on previous
      const stats: ResourceStats = {
        currentUsage: 0,
        averageUsage: previous.averageUsage,
        peakUsage: previous.peakUsage,
        isConstrained: previous.isConstrained,
        lastUpdated: Date.now(),
        metrics: { ...previous.metrics }
      };

      // Measure resource-specific usage
      switch (resource) {
        case ResourceType.CPU:
          stats.currentUsage = await this.measureCpuUsage();

          // Add detailed metrics if enabled
          if (this.config.detailedMetrics) {
            const cpuDetails = await this.getCpuDetails();
            if (cpuDetails) {
              stats.metrics.cores = cpuDetails.cores;
              stats.metrics.temperature = cpuDetails.temperature || 0;
            }
          }
          break;

        case ResourceType.MEMORY:
          stats.currentUsage = await this.measureMemoryUsage();

          // Add detailed metrics if enabled
          if (this.config.detailedMetrics) {
            const memDetails = await this.getMemoryDetails();
            if (memDetails) {
              stats.metrics.totalMemory = memDetails.totalMemory;
              stats.metrics.freeMemory = memDetails.freeMemory;
              stats.metrics.processMemory = memDetails.processMemory;
            }
          }
          break;

        case ResourceType.NETWORK:
          stats.currentUsage = await this.measureNetworkUsage();
          break;

        case ResourceType.STORAGE:
          stats.currentUsage = await this.measureStorageUsage();
          break;

        case ResourceType.BATTERY:
          stats.currentUsage = await this.measureBatteryUsage();
          break;

        case ResourceType.GPU:
          stats.currentUsage = await this.measureGpuUsage();
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
      zkErrorLogger.logError(error, {
        operation: 'measureResource',
        context: { resource }
      });

      // Return previous stats or empty stats
      return this.resourceStats[resource] || this.createEmptyStats();
    }
  }

  /**
   * Notify all registered callbacks of a resource change
   * 
   * @param resource - Resource that changed
   * @param previousStats - Previous resource statistics
   * @param currentStats - Current resource statistics
   * @param constraintChanged - Whether constraint status changed
   * @private
   */
  private notifyResourceChanged(
    resource: ResourceType,
    previousStats: ResourceStats | undefined,
    currentStats: ResourceStats,
    constraintChanged: boolean
  ): void {
    // Call the constraint detected callback if configured
    if (constraintChanged && currentStats.isConstrained && this.config.onConstraintDetected) {
      this.config.onConstraintDetected(resource, currentStats);
    }

    // Notify all callbacks
    const event: ResourceChangeEvent = {
      resource,
      previousStats,
      currentStats,
      constraintChanged
    };

    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch (error) {
        zkErrorLogger.logError(error, {
          operation: 'resourceChangeCallback',
          context: { resource }
        });
      }
    }
  }

  /**
   * Notify listeners of resource changes
   * Public version of notifyResourceChanged for compatibility with regression tests
   * 
   * @param event - Resource change event
   */
  public notifyListeners(event: ResourceChangeEvent): void {
    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch (error) {
        zkErrorLogger.logError(error, {
          operation: 'notifyListeners',
          context: { resource: event.resource }
        });
      }
    }
  }

  /**
   * Measure CPU usage as a percentage (0-1)
   * 
   * @returns CPU usage percentage
   * @private
   */
  private async measureCpuUsage(): Promise<number> {
    // This is a simplified implementation for demonstration
    // In a real implementation, this would use platform-specific APIs

    if (typeof window !== 'undefined') {
      // Browser environment
      // There's no direct way to measure CPU usage in browsers,
      // so we'll use a performance-based estimation
      return this.estimateCpuUsage();
    } else if (typeof process !== 'undefined') {
      // Node.js environment
      try {
        const os = require('os');

        // Calculate CPU usage based on the load average
        const loadAvg = os.loadavg()[0]; // 1-minute load average
        const cpuCount = os.cpus().length;

        // Normalize by number of CPUs (value between 0-1)
        return Math.min(loadAvg / cpuCount, 1);
      } catch {
        // Fallback to estimation if os module not available
        return this.estimateCpuUsage();
      }
    }

    // Fallback for unknown environments
    return this.estimateCpuUsage();
  }

  /**
   * Estimate CPU usage using performance measurements
   * 
   * @returns Estimated CPU usage percentage
   * @private
   */
  private estimateCpuUsage(): number {
    // This is a very simplified estimation
    // A real implementation would use more sophisticated heuristics

    // Use random value between 0.2-0.6 as placeholder
    // In a real implementation, this would be based on actual measurements
    return 0.2 + Math.random() * 0.4;
  }

  /**
   * Measure memory usage as a percentage (0-1)
   * 
   * @returns Memory usage percentage
   * @private
   */
  private async measureMemoryUsage(): Promise<number> {
    if (typeof window !== 'undefined') {
      // Browser environment
      if (window.performance && 'memory' in window.performance) {
        // Chrome-specific memory info
        const memory = (window.performance as any).memory;

        if (memory.jsHeapSizeLimit && memory.usedJSHeapSize) {
          return memory.usedJSHeapSize / memory.jsHeapSizeLimit;
        }
      }

      // Fallback for browsers without memory API
      return this.estimateMemoryUsage();
    } else if (typeof process !== 'undefined') {
      // Node.js environment
      try {
        const memoryUsage = process.memoryUsage();

        // Use resident set size as a percentage of total memory
        const os = require('os');
        const totalMemory = os.totalmem();

        return memoryUsage.rss / totalMemory;
      } catch {
        // Fallback to estimation
        return this.estimateMemoryUsage();
      }
    }

    // Fallback for unknown environments
    return this.estimateMemoryUsage();
  }

  /**
   * Estimate memory usage using available indicators
   * 
   * @returns Estimated memory usage percentage
   * @private
   */
  private estimateMemoryUsage(): number {
    // This is a very simplified estimation
    // A real implementation would use more sophisticated heuristics

    // Use random value between 0.3-0.7 as placeholder
    // In a real implementation, this would be based on actual measurements
    return 0.3 + Math.random() * 0.4;
  }

  /**
   * Measure network usage as a percentage (0-1)
   * 
   * @returns Network usage percentage
   * @private
   */
  private async measureNetworkUsage(): Promise<number> {
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      // Browser environment with Network Information API
      const connection = (navigator as any).connection;

      if (connection) {
        // Estimate based on connection type
        if (connection.effectiveType) {
          switch (connection.effectiveType) {
            case 'slow-2g':
              return 0.9; // Very constrained
            case '2g':
              return 0.7;
            case '3g':
              return 0.4;
            case '4g':
              return 0.2;
            default:
              return 0.3;
          }
        }

        // If downlink information is available
        if (connection.downlink) {
          // Estimate based on available bandwidth
          // Assume anything below 1 Mbps is highly constrained
          return Math.max(0, 1 - (connection.downlink / 10));
        }
      }
    }

    // Fallback for environments without network API
    return 0.3; // Moderate usage assumption
  }

  /**
   * Measure storage usage as a percentage (0-1)
   * 
   * @returns Storage usage percentage
   * @private
   */
  private async measureStorageUsage(): Promise<number> {
    if (typeof navigator !== 'undefined' && 'storage' in navigator) {
      // Browser environment with Storage API
      try {
        const estimate = await (navigator.storage as any).estimate();

        if (estimate && estimate.quota && estimate.usage) {
          return estimate.usage / estimate.quota;
        }
      } catch {
        // Storage API failed, use fallback
      }
    } else if (typeof process !== 'undefined') {
      // Node.js environment
      try {
        const fs = require('fs');
        const os = require('os');

        // Get disk usage info for the current directory
        const stats = fs.statfsSync(process.cwd());

        // Calculate percentage used
        if (stats.blocks && stats.bfree) {
          const used = stats.blocks - stats.bfree;
          return used / stats.blocks;
        }
      } catch {
        // File system API failed, use fallback
      }
    }

    // Default to a moderate usage assumption
    return 0.5;
  }

  /**
   * Measure battery level as a percentage (0-1)
   * For battery, 0 means full and 1 means empty (to align with constraint concept)
   * 
   * @returns Battery usage percentage
   * @private
   */
  private async measureBatteryUsage(): Promise<number> {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      // Browser environment with Battery API
      try {
        const battery = await (navigator as any).getBattery();

        if (battery) {
          // Convert level (1 = full, 0 = empty) to usage (0 = full, 1 = empty)
          return 1 - battery.level;
        }
      } catch {
        // Battery API failed, use fallback
      }
    }

    // Default to assuming device is plugged in
    return 0.1;
  }

  /**
   * Measure GPU usage as a percentage (0-1)
   * 
   * @returns GPU usage percentage
   * @private
   */
  private async measureGpuUsage(): Promise<number> {
    // There's no standard API for GPU usage in browsers or Node.js
    // This would require platform-specific implementations

    // Default to a moderate usage assumption
    return 0.3;
  }

  /**
   * Get detailed CPU metrics
   * 
   * @returns CPU details
   * @private
   */
  private async getCpuDetails(): Promise<CpuDetails> {
    if (typeof process !== 'undefined') {
      // Node.js environment
      try {
        const os = require('os');
        const cpus = os.cpus();
        const coreCount = cpus.length;

        // Calculate usage per core
        const coreUsage = cpus.map(cpu => {
          const total = Object.values(cpu.times).reduce((sum, time) => sum + time, 0);
          const idle = cpu.times.idle;
          return (total - idle) / total;
        });

        // Get average clock speed
        const clockSpeed = cpus.reduce((sum, cpu) => sum + cpu.speed, 0) / coreCount;

        return {
          cores: coreCount,
          coreUsage,
          clockSpeed
        };
      } catch {
        // Fallback if os module not available
      }
    }

    // Default for environments without CPU info
    return {
      cores: navigator?.hardwareConcurrency || 2,
      coreUsage: [0.3, 0.3] // Default to moderate usage
    };
  }

  /**
   * Get detailed memory metrics
   * 
   * @returns Memory details
   * @private
   */
  private async getMemoryDetails(): Promise<MemoryDetails> {
    if (typeof window !== 'undefined') {
      // Browser environment
      let jsHeapSize = undefined;
      let jsHeapLimit = undefined;

      if (window.performance && 'memory' in window.performance) {
        // Chrome-specific memory info
        const memory = (window.performance as any).memory;
        jsHeapSize = memory.usedJSHeapSize / (1024 * 1024);
        jsHeapLimit = memory.jsHeapSizeLimit / (1024 * 1024);
      }

      return {
        // Estimate total memory based on navigator.deviceMemory if available
        totalMemory: (navigator as any).deviceMemory ? (navigator as any).deviceMemory * 1024 : 4096,
        freeMemory: 1024, // Cannot accurately determine in browser
        processMemory: jsHeapSize || 256,
        jsHeapSize,
        jsHeapLimit
      };
    } else if (typeof process !== 'undefined') {
      // Node.js environment
      try {
        const os = require('os');
        const memoryUsage = process.memoryUsage();

        return {
          totalMemory: os.totalmem() / (1024 * 1024),
          freeMemory: os.freemem() / (1024 * 1024),
          processMemory: memoryUsage.rss / (1024 * 1024),
          jsHeapSize: memoryUsage.heapUsed / (1024 * 1024),
          jsHeapLimit: memoryUsage.heapTotal / (1024 * 1024)
        };
      } catch {
        // Fallback if os module not available
      }
    }

    // Default for environments without memory info
    return {
      totalMemory: 4096, // Assume 4GB
      freeMemory: 2048,  // Assume 2GB free
      processMemory: 256 // Assume 256MB process
    };
  }

  /**
   * Get detailed network metrics
   * 
   * @returns Network details
   * @private
   */
  private async getNetworkDetails(): Promise<NetworkDetails> {
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      // Browser environment with Network Information API
      const connection = (navigator as any).connection;

      if (connection) {
        return {
          downloadSpeed: connection.downlink ? connection.downlink * 125 : undefined, // Convert Mbps to KB/s
          latency: connection.rtt,
          metered: connection.saveData === true,
          connectionType: connection.type
        };
      }
    }

    // Default for environments without network info
    return {};
  }

  /**
   * Get detailed storage metrics
   * 
   * @returns Storage details
   * @private
   */
  private async getStorageDetails(): Promise<StorageDetails> {
    if (typeof navigator !== 'undefined' && 'storage' in navigator) {
      // Browser environment with Storage API
      try {
        const estimate = await (navigator.storage as any).estimate();
        const persistent = await (navigator.storage as any).persisted();

        return {
          totalStorage: estimate.quota ? estimate.quota / (1024 * 1024) : undefined,
          usage: estimate.usage ? estimate.usage / (1024 * 1024) : undefined,
          quota: estimate.quota ? estimate.quota / (1024 * 1024) : undefined,
          persistentStorageAvailable: persistent
        };
      } catch {
        // Storage API failed, use fallback
      }
    } else if (typeof process !== 'undefined') {
      // Node.js environment
      try {
        const fs = require('fs');
        const os = require('os');

        // Get disk usage info for the current directory
        const stats = fs.statfsSync(process.cwd());

        return {
          totalStorage: (stats.blocks * stats.bsize) / (1024 * 1024),
          freeStorage: (stats.bfree * stats.bsize) / (1024 * 1024),
          persistentStorageAvailable: true
        };
      } catch {
        // File system API failed, use fallback
      }
    }

    // Default for environments without storage info
    return {
      persistentStorageAvailable: true
    };
  }
}