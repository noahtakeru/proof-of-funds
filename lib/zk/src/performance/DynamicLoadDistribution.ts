/**
 * @fileoverview Dynamic Load Distribution System
 * 
 * This module provides intelligent load distribution capabilities that adapt
 * to device capabilities and available resources, optimizing performance across
 * different environments and workloads.
 * 
 * Features:
 * - Device capability detection
 * - Adaptive resource allocation based on hardware
 * - Dynamic workload distribution
 * - Load balancing algorithms
 * - Performance monitoring and adjustment
 * 
 * @author ZK Infrastructure Team
 * @created July 2024
 */

import { ResourceMonitor, ResourceType } from '../resources/ResourceMonitor';
import { ResourceAllocator } from '../resources/ResourceAllocator';
import { WebWorkerPool } from './WebWorkerPool';
import deviceCapabilitiesModule from '../deviceCapabilities.js';
import { MemoryOptimizer } from './MemoryOptimizer';
import { ZKErrorLogger } from '../zkErrorLogger.js';

// Create logger instance for load distribution
const logger = new ZKErrorLogger({
    logLevel: 'info',
    privacyLevel: 'internal',
    destinations: ['console']
});

/**
 * Workload distribution strategy
 */
export enum DistributionStrategy {
    /** Single-threaded execution */
    SINGLE_THREADED = 'single-threaded',

    /** Multi-threaded with fixed worker count */
    FIXED_WORKERS = 'fixed-workers',

    /** Multi-threaded with dynamic worker adjustment */
    DYNAMIC_WORKERS = 'dynamic-workers',

    /** Server-side fallback for intensive operations */
    SERVER_FALLBACK = 'server-fallback',

    /** Hybrid approach combining client and server */
    HYBRID = 'hybrid'
}

/**
 * Load balancing algorithm
 */
export enum LoadBalancingAlgorithm {
    /** Round-robin distribution */
    ROUND_ROBIN = 'round-robin',

    /** Weighted distribution based on worker capabilities */
    WEIGHTED = 'weighted',

    /** Assign to least busy worker */
    LEAST_BUSY = 'least-busy',

    /** Assign to worker with most similar tasks */
    TASK_AFFINITY = 'task-affinity'
}

/**
 * Load distribution configuration
 */
export interface LoadDistributionConfig {
    /** Default distribution strategy */
    defaultStrategy?: DistributionStrategy;

    /** Load balancing algorithm to use */
    loadBalancingAlgorithm?: LoadBalancingAlgorithm;

    /** Minimum number of worker threads */
    minWorkers?: number;

    /** Maximum number of worker threads */
    maxWorkers?: number;

    /** Maximum CPU usage percentage before scaling (0-100) */
    maxCpuUsage?: number;

    /** Maximum memory usage percentage before fallback (0-100) */
    maxMemoryUsage?: number;

    /** Server fallback endpoint URL */
    serverFallbackUrl?: string;

    /** Whether to enable server fallback */
    enableServerFallback?: boolean;

    /** Whether to monitor performance and adapt */
    adaptiveMode?: boolean;

    /** Resource monitor instance */
    resourceMonitor?: ResourceMonitor | null;

    /** Resource allocator instance */
    resourceAllocator?: ResourceAllocator | null;

    /** Memory optimizer instance */
    memoryOptimizer?: MemoryOptimizer | null;
}

/**
 * Distribution metrics for performance analysis
 */
export interface DistributionMetrics {
    /** Current distribution strategy */
    currentStrategy: DistributionStrategy;

    /** Number of active workers */
    activeWorkers: number;

    /** Average task execution time (ms) */
    avgExecutionTimeMs: number;

    /** Total tasks processed */
    totalTasks: number;

    /** Tasks offloaded to server */
    serverOffloadedTasks: number;

    /** Current CPU usage (%) */
    cpuUsage: number;

    /** Current memory usage (%) */
    memoryUsage: number;

    /** Time spent waiting for resources (ms) */
    resourceWaitTimeMs: number;

    /** Whether the system is currently resource-constrained */
    resourceConstrained: boolean;

    /** Resource constraint that's limiting performance */
    limitingResource?: ResourceType;
}

/**
 * Task distribution result
 */
export interface DistributionResult<T> {
    /** Result of task execution */
    result: T;

    /** Execution time in milliseconds */
    executionTimeMs: number;

    /** Distribution strategy used */
    strategy: DistributionStrategy;

    /** Whether task was executed locally or on server */
    executedLocally: boolean;

    /** Resource metrics during execution */
    resourceUsage: {
        cpuPercentage?: number;
        memoryBytes?: number;
        peakMemoryBytes?: number;
    };

    /** Time spent in different phases */
    phases?: Record<string, number>;
}

/**
 * System responsible for dynamic load distribution
 */
export class DynamicLoadDistribution {
    /** Configuration settings */
    private config: Required<LoadDistributionConfig>;

    /** Web worker pool for multithreading */
    private workerPool: WebWorkerPool;

    /** Resource monitor */
    private resourceMonitor!: ResourceMonitor;

    /** Resource allocator */
    private resourceAllocator?: ResourceAllocator | null;

    /** Memory optimizer */
    private memoryOptimizer?: MemoryOptimizer | null;

    /** Whether the system is initialized */
    private isInitialized: boolean = false;

    /** Current distribution strategy */
    private currentStrategy: DistributionStrategy;

    /** Performance metrics */
    private metrics = {
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        serverOffloadedTasks: 0,
        totalExecutionTimeMs: 0,
        resourceWaitTimeMs: 0
    };

    /** Server fallback state */
    private serverFallback = {
        available: false,
        lastCheck: 0,
        errorCount: 0
    };

    /**
     * Create a new dynamic load distribution system
     * @param config Configuration options
     */
    constructor(config: LoadDistributionConfig = {}) {
        // Initialize with device capabilities
        const deviceCaps = deviceCapabilitiesModule.detectCapabilities();
        const cpuCores = deviceCaps.cpuCores || 4;

        // Default configuration
        this.config = {
            defaultStrategy: DistributionStrategy.DYNAMIC_WORKERS,
            loadBalancingAlgorithm: LoadBalancingAlgorithm.WEIGHTED,
            minWorkers: 1,
            maxWorkers: Math.max(1, cpuCores - 1), // Leave one core for UI
            maxCpuUsage: 80,
            maxMemoryUsage: 75,
            serverFallbackUrl: '/api/zkproof/fallback',
            enableServerFallback: true,
            adaptiveMode: true,
            resourceMonitor: null,
            resourceAllocator: null,
            memoryOptimizer: null,
            ...config
        };

        // Create/use resource monitor
        if (config.resourceMonitor) {
            this.resourceMonitor = config.resourceMonitor;
        } else {
            this.resourceMonitor = new ResourceMonitor();
        }

        // Setup allocator if provided
        this.resourceAllocator = config.resourceAllocator;

        // Setup memory optimizer if provided
        this.memoryOptimizer = config.memoryOptimizer;

        // Set initial strategy based on device capabilities
        this.currentStrategy = this.determineInitialStrategy();

        // Create worker pool
        this.workerPool = new WebWorkerPool({
            minWorkers: this.config.minWorkers,
            maxWorkers: this.config.maxWorkers,
            resourceMonitor: this.resourceMonitor,
            resourceAllocator: this.resourceAllocator === null ? undefined : this.resourceAllocator
        });
    }

    /**
     * Initialize the load distribution system
     */
    public async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            // Initialize resource monitor
            await this.resourceMonitor.startMonitoring();

            // Check server fallback availability
            if (this.config.enableServerFallback) {
                this.serverFallback.available = await this.checkServerFallbackAvailability();
            }

            // Analyze device capabilities
            await this.analyzeDeviceCapabilities();

            // Initialize worker pool (preloads workers)
            // Already initialized in constructor

            this.isInitialized = true;
        } catch (error) {
            logger.logError(error as Error, {
                context: 'DynamicLoadDistribution.initialize',
                message: 'Failed to initialize load distribution system'
            });
            throw error;
        }
    }

    /**
     * Execute a task with intelligent load distribution
     * @param taskFn Function to execute
     * @param data Input data for the task
     * @param options Execution options
     * @returns Task result with distribution metadata
     */
    public async executeTask<T, R>(
        taskFn: Function | string,
        data: T,
        options: {
            strategy?: DistributionStrategy;
            forceLocal?: boolean;
            forceServer?: boolean;
            timeout?: number;
            priority?: string;
            maxMemoryMB?: number;
        } = {}
    ): Promise<DistributionResult<R>> {
        // Ensure system is initialized
        if (!this.isInitialized) {
            await this.initialize();
        }

        // Get start timestamp for metrics
        const startTime = performance.now();

        try {
            // Sample current resource state
            const resourceSnapshot = await this.resourceMonitor.sampleResources();

            // Determine execution strategy
            const strategy = options.strategy ||
                await this.determineOptimalStrategy(
                    resourceSnapshot,
                    options.maxMemoryMB
                );

            // Override based on flags
            let effectiveStrategy = strategy;
            if (options.forceLocal) {
                effectiveStrategy = this.config.maxWorkers > 1
                    ? DistributionStrategy.DYNAMIC_WORKERS
                    : DistributionStrategy.SINGLE_THREADED;
            } else if (options.forceServer && this.serverFallback.available) {
                effectiveStrategy = DistributionStrategy.SERVER_FALLBACK;
            }

            // Log task execution
            this.metrics.totalTasks++;

            // Execute based on strategy
            let result: R;
            let executedLocally = true;
            const phaseTimings: Record<string, number> = {};

            // Mark resource usage before execution
            const beforeCpuUsage = resourceSnapshot.resources['cpu']?.currentUsage || 0;
            const beforeMemoryUsage = resourceSnapshot.resources['memory']?.currentUsage || 0;

            // Execute with the determined strategy
            const executionStartTime = performance.now();

            switch (effectiveStrategy) {
                case DistributionStrategy.SINGLE_THREADED:
                    // Execute in main thread
                    result = await this.executeLocal(taskFn, data);
                    phaseTimings.local = performance.now() - executionStartTime;
                    break;

                case DistributionStrategy.FIXED_WORKERS:
                case DistributionStrategy.DYNAMIC_WORKERS:
                    // Execute in worker pool
                    result = await this.executeInWorker(taskFn, data, options);
                    phaseTimings.worker = performance.now() - executionStartTime;
                    break;

                case DistributionStrategy.SERVER_FALLBACK:
                    // Execute on server
                    result = await this.executeOnServer<T, R>(taskFn, data, options);
                    executedLocally = false;
                    this.metrics.serverOffloadedTasks++;
                    phaseTimings.server = performance.now() - executionStartTime;
                    break;

                case DistributionStrategy.HYBRID:
                    // Start both local and server, use whichever completes first
                    result = await this.executeHybrid<T, R>(taskFn, data, options);
                    // executedLocally is set by executeHybrid
                    executedLocally = phaseTimings.local !== undefined;
                    break;

                default:
                    throw new Error(`Unknown distribution strategy: ${effectiveStrategy}`);
            }

            // Get end timestamp for metrics
            const endTime = performance.now();
            const executionTime = endTime - startTime;

            // Sample resource usage after execution
            const afterSnapshot = await this.resourceMonitor.sampleResources();
            const afterCpuUsage = afterSnapshot.resources['cpu']?.currentUsage || 0;
            const afterMemoryUsage = afterSnapshot.resources['memory']?.currentUsage || 0;

            // Update metrics
            this.metrics.completedTasks++;
            this.metrics.totalExecutionTimeMs += executionTime;

            // Create result object
            const distributionResult: DistributionResult<R> = {
                result,
                executionTimeMs: executionTime,
                strategy: effectiveStrategy,
                executedLocally,
                resourceUsage: {
                    cpuPercentage: (afterCpuUsage + beforeCpuUsage) / 2 * 100,
                    memoryBytes: afterSnapshot.resources['memory']?.metrics?.usedBytes,
                    peakMemoryBytes: afterSnapshot.resources['memory']?.metrics?.peakBytes
                },
                phases: phaseTimings
            };

            return distributionResult;
        } catch (error) {
            logger.logError(error as Error, {
                context: 'DynamicLoadDistribution.executeTask',
                message: 'Task execution failed'
            });

            this.metrics.failedTasks++;
            throw error;
        }
    }

    /**
     * Get current distribution metrics
     * @returns Distribution metrics
     */
    public getMetrics(): DistributionMetrics {
        // Calculate averages
        const avgExecutionTime = this.metrics.completedTasks > 0
            ? this.metrics.totalExecutionTimeMs / this.metrics.completedTasks
            : 0;

        return {
            currentStrategy: this.currentStrategy,
            activeWorkers: this.workerPool.getStatus().activeWorkers,
            avgExecutionTimeMs: avgExecutionTime,
            totalTasks: this.metrics.totalTasks,
            serverOffloadedTasks: this.metrics.serverOffloadedTasks,
            cpuUsage: this.getResourceUsagePercentage(ResourceType.CPU),
            memoryUsage: this.getResourceUsagePercentage(ResourceType.MEMORY),
            resourceWaitTimeMs: this.metrics.resourceWaitTimeMs,
            resourceConstrained: this.isResourceConstrained(),
            limitingResource: this.getLimitingResource()
        };
    }

    /**
     * Reset metrics
     */
    public resetMetrics(): void {
        this.metrics = {
            totalTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
            serverOffloadedTasks: 0,
            totalExecutionTimeMs: 0,
            resourceWaitTimeMs: 0
        };
    }

    /**
     * Set distribution strategy
     * @param strategy New strategy
     */
    public setStrategy(strategy: DistributionStrategy): void {
        this.currentStrategy = strategy;
    }

    /**
     * Clean up resources
     */
    public dispose(): void {
        // Shutdown worker pool
        this.workerPool.shutdown();

        // Stop resource monitoring
        if (this.isInitialized) {
            this.resourceMonitor.stopMonitoring();
        }

        this.isInitialized = false;
    }

    /**
     * Determine initial distribution strategy based on device capabilities
     * @returns Appropriate distribution strategy
     */
    private determineInitialStrategy(): DistributionStrategy {
        const device = deviceCapabilitiesModule.detectCapabilities();

        // Check if device is very limited
        if (device.deviceClass === 'low' || (device.availableMemory && device.availableMemory < 1024)) {
            // Low-end device, use server fallback if available
            return this.config.enableServerFallback
                ? DistributionStrategy.SERVER_FALLBACK
                : DistributionStrategy.SINGLE_THREADED;
        }

        // Check if device has limited CPU
        if (device.cpuCores && device.cpuCores < 2) {
            return DistributionStrategy.SINGLE_THREADED;
        }

        // Default to dynamic workers for capable devices
        return DistributionStrategy.DYNAMIC_WORKERS;
    }

    /**
     * Determine optimal distribution strategy for current conditions
     * @param resourceSnapshot Current resource state
     * @param maxMemoryMB Maximum memory requirement
     * @returns Optimal distribution strategy
     */
    private async determineOptimalStrategy(
        resourceSnapshot: any,
        maxMemoryMB?: number
    ): Promise<DistributionStrategy> {
        // Check if resources are constrained
        const cpuUsage = this.getResourceUsagePercentage(ResourceType.CPU, resourceSnapshot);
        const memoryUsage = this.getResourceUsagePercentage(ResourceType.MEMORY, resourceSnapshot);

        // Check memory requirements against available memory
        if (maxMemoryMB) {
            const availableMemoryMB = this.getAvailableMemoryMB(resourceSnapshot);
            if (availableMemoryMB < maxMemoryMB) {
                // Not enough memory, use server fallback if available
                return this.serverFallback.available
                    ? DistributionStrategy.SERVER_FALLBACK
                    : DistributionStrategy.SINGLE_THREADED; // Fallback to single-threaded
            }
        }

        // Check resource constraints
        if (cpuUsage > this.config.maxCpuUsage) {
            // CPU constrained, use server fallback if available
            return this.serverFallback.available
                ? DistributionStrategy.SERVER_FALLBACK
                : DistributionStrategy.FIXED_WORKERS; // Limit worker count
        }

        if (memoryUsage > this.config.maxMemoryUsage) {
            // Memory constrained, use server fallback if available
            return this.serverFallback.available
                ? DistributionStrategy.SERVER_FALLBACK
                : DistributionStrategy.SINGLE_THREADED; // Limit memory usage
        }

        // No constraints, use optimal strategy
        const device = deviceCapabilitiesModule.detectCapabilities();

        if (device.cpuCores && device.cpuCores >= 4) {
            return DistributionStrategy.DYNAMIC_WORKERS;
        } else if (device.cpuCores && device.cpuCores >= 2) {
            return DistributionStrategy.FIXED_WORKERS;
        } else {
            return DistributionStrategy.SINGLE_THREADED;
        }
    }

    /**
     * Execute a task in the main thread
     * @param taskFn Function to execute
     * @param data Input data for the task
     * @returns Task result
     */
    private async executeLocal<T, R>(taskFn: Function | string, data: T): Promise<R> {
        try {
            // Convert function string to executable if needed
            const executableFn = typeof taskFn === 'string'
                ? new Function('return ' + taskFn)()
                : taskFn;

            // Execute the function
            return await executableFn(data);
        } catch (error) {
            logger.logError(error as Error, {
                context: 'DynamicLoadDistribution.executeLocal',
                message: 'Error in local task execution'
            });
            throw error;
        }
    }

    /**
     * Execute a task in a worker thread
     * @param taskFn Function to execute
     * @param data Input data for the task
     * @param options Execution options
     * @returns Task result
     */
    private async executeInWorker<T, R>(
        taskFn: Function | string,
        data: T,
        options: any
    ): Promise<R> {
        try {
            // Forward to worker pool
            return await this.workerPool.executeTask(
                'standard', // Task type
                taskFn,
                data,
                {
                    priority: options.priority,
                    timeoutMs: options.timeout
                }
            );
        } catch (error) {
            logger.logError(error as Error, {
                context: 'DynamicLoadDistribution.executeInWorker',
                message: 'Error in worker task execution'
            });

            // Fallback to local execution if worker failed
            return this.executeLocal(taskFn, data);
        }
    }

    /**
     * Execute a task on the server
     * @param taskFn Function to execute
     * @param data Input data for the task
     * @param options Execution options
     * @returns Task result
     */
    private async executeOnServer<T, R>(
        taskFn: Function | string,
        data: T,
        options: any
    ): Promise<R> {
        try {
            // Prepare function string
            const fnString = typeof taskFn === 'function'
                ? taskFn.toString()
                : taskFn;

            // Make request to server fallback endpoint
            const response = await fetch(this.config.serverFallbackUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    functionString: fnString,
                    data,
                    options: {
                        timeout: options.timeout,
                        priority: options.priority
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Server fallback failed with status: ${response.status}`);
            }

            const result = await response.json();

            // Check for errors in response
            if (result.error) {
                throw new Error(result.error);
            }

            return result.data;
        } catch (error) {
            logger.logError(error as Error, {
                context: 'DynamicLoadDistribution.executeOnServer',
                message: 'Error in server task execution'
            });

            // Update server fallback state
            this.serverFallback.errorCount++;
            if (this.serverFallback.errorCount > 3) {
                this.serverFallback.available = false;
            }

            // Fallback to local execution
            return this.executeLocal(taskFn, data);
        }
    }

    /**
     * Execute a task using hybrid approach (both local and server)
     * @param taskFn Function to execute
     * @param data Input data for the task
     * @param options Execution options
     * @returns Task result from whichever completes first
     */
    private async executeHybrid<T, R>(
        taskFn: Function | string,
        data: T,
        options: any
    ): Promise<R> {
        // Execute both locally and on server, race for result
        try {
            // Start local execution
            const localPromise = this.executeInWorker<T, R>(taskFn, data, options)
                .then(result => ({ source: 'local', result }));

            // Start server execution if available
            let serverPromise;
            if (this.serverFallback.available) {
                serverPromise = this.executeOnServer<T, R>(taskFn, data, options)
                    .then(result => ({ source: 'server', result }));
            } else {
                // No server fallback, just use local
                return (await localPromise).result;
            }

            // Race the promises
            const { source, result } = await Promise.race([
                localPromise,
                serverPromise
            ]);

            // Return result with metadata about source
            return result;
        } catch (error) {
            logger.logError(error as Error, {
                context: 'DynamicLoadDistribution.executeHybrid',
                message: 'Error in hybrid task execution'
            });

            // Last resort, try simple local execution
            return this.executeLocal(taskFn, data);
        }
    }

    /**
     * Check server fallback availability
     * @returns Whether server fallback is available
     */
    private async checkServerFallbackAvailability(): Promise<boolean> {
        if (!this.config.enableServerFallback) {
            return false;
        }

        try {
            // Simple ping to check availability
            const response = await fetch(`${this.config.serverFallbackUrl}/ping`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            return response.ok;
        } catch (error) {
            return false;
        }
    }

    /**
     * Analyze device capabilities in detail
     */
    private async analyzeDeviceCapabilities(): Promise<void> {
        try {
            const device = deviceCapabilitiesModule.detectCapabilities();

            // Perform more detailed analysis if needed
            // This could include:
            // - Testing computation speed for different operations
            // - Checking available storage
            // - Testing network bandwidth and latency
            // - Checking battery level and charging status

            // Update worker pool settings based on analysis
            const optimalWorkers = this.calculateOptimalWorkerCount(device);

            // Instead of directly setting workers, update the config which will be used
            // in future worker pool operations
            if (optimalWorkers !== this.config.maxWorkers) {
                this.config.maxWorkers = optimalWorkers;
            }
        } catch (error) {
            logger.logError(error as Error, {
                context: 'DynamicLoadDistribution.analyzeDeviceCapabilities',
                message: 'Error analyzing device capabilities'
            });
        }
    }

    /**
     * Calculate optimal worker count based on device
     * @param device Device capabilities
     * @returns Optimal worker count
     */
    private calculateOptimalWorkerCount(device: any): number {
        const cores = device.cores || 4;

        // Leave at least one core for UI
        const workerCount = Math.max(1, cores - 1);

        // Limit based on memory
        if (device.memory) {
            // Estimate 200MB per worker
            const memoryBasedLimit = Math.floor(device.memory / 200);
            return Math.min(workerCount, memoryBasedLimit);
        }

        return workerCount;
    }

    /**
     * Get resource usage as percentage
     * @param resourceType Resource type to check
     * @param snapshot Optional resource snapshot (uses latest if not provided)
     * @returns Usage percentage (0-100)
     */
    private getResourceUsagePercentage(
        resourceType: ResourceType,
        snapshot?: any
    ): number {
        try {
            const resources = snapshot?.resources ||
                this.resourceMonitor.sampleResources().then(s => s.resources);

            if (!resources || !resources[resourceType]) {
                return 0;
            }

            return resources[resourceType].currentUsage * 100;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Get available memory in MB
     * @param snapshot Optional resource snapshot
     * @returns Available memory in MB
     */
    private getAvailableMemoryMB(snapshot?: any): number {
        try {
            const resources = snapshot?.resources || {};

            if (!resources[ResourceType.MEMORY]) {
                // If resource monitor doesn't have memory info, use device capabilities
                const deviceCapabilities = deviceCapabilitiesModule.detectCapabilities();
                const memoryMB = deviceCapabilities.availableMemory || 1024;
                return memoryMB;
            }

            const memory = resources[ResourceType.MEMORY];
            const totalMB = memory.metrics?.totalBytes
                ? Math.floor(memory.metrics.totalBytes / (1024 * 1024))
                : 1024; // Default to 1GB if unknown

            const usedPercentage = memory.currentUsage;
            const availableMB = totalMB * (1 - usedPercentage);

            return Math.floor(availableMB);
        } catch (error) {
            return 1024; // Default to 1GB if error
        }
    }

    /**
     * Check if system is resource constrained
     * @returns Whether system is resource constrained
     */
    private isResourceConstrained(): boolean {
        const cpuUsage = this.getResourceUsagePercentage(ResourceType.CPU);
        const memoryUsage = this.getResourceUsagePercentage(ResourceType.MEMORY);

        return cpuUsage > this.config.maxCpuUsage ||
            memoryUsage > this.config.maxMemoryUsage;
    }

    /**
     * Get the most limiting resource
     * @returns Limiting resource type or undefined if not constrained
     */
    private getLimitingResource(): ResourceType | undefined {
        const cpuUsage = this.getResourceUsagePercentage(ResourceType.CPU);
        const memoryUsage = this.getResourceUsagePercentage(ResourceType.MEMORY);

        if (cpuUsage > this.config.maxCpuUsage && cpuUsage > memoryUsage) {
            return ResourceType.CPU;
        } else if (memoryUsage > this.config.maxMemoryUsage) {
            return ResourceType.MEMORY;
        }

        return undefined;
    }
} 