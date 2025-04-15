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
import { WebWorkerPool } from './WebWorkerPool';
import { deviceCapabilities } from '../deviceCapabilities';
import zkErrorLoggerModule from '../zkErrorLogger.mjs';
// Get error logger
const { zkErrorLogger } = zkErrorLoggerModule;
/**
 * Workload distribution strategy
 */
export var DistributionStrategy;
(function (DistributionStrategy) {
    /** Single-threaded execution */
    DistributionStrategy["SINGLE_THREADED"] = "single-threaded";
    /** Multi-threaded with fixed worker count */
    DistributionStrategy["FIXED_WORKERS"] = "fixed-workers";
    /** Multi-threaded with dynamic worker adjustment */
    DistributionStrategy["DYNAMIC_WORKERS"] = "dynamic-workers";
    /** Server-side fallback for intensive operations */
    DistributionStrategy["SERVER_FALLBACK"] = "server-fallback";
    /** Hybrid approach combining client and server */
    DistributionStrategy["HYBRID"] = "hybrid";
})(DistributionStrategy || (DistributionStrategy = {}));
/**
 * Load balancing algorithm
 */
export var LoadBalancingAlgorithm;
(function (LoadBalancingAlgorithm) {
    /** Round-robin distribution */
    LoadBalancingAlgorithm["ROUND_ROBIN"] = "round-robin";
    /** Weighted distribution based on worker capabilities */
    LoadBalancingAlgorithm["WEIGHTED"] = "weighted";
    /** Assign to least busy worker */
    LoadBalancingAlgorithm["LEAST_BUSY"] = "least-busy";
    /** Assign to worker with most similar tasks */
    LoadBalancingAlgorithm["TASK_AFFINITY"] = "task-affinity";
})(LoadBalancingAlgorithm || (LoadBalancingAlgorithm = {}));
/**
 * System responsible for dynamic load distribution
 */
export class DynamicLoadDistribution {
    /**
     * Create a new dynamic load distribution system
     * @param config Configuration options
     */
    constructor(config = {}) {
        /** Whether the system is initialized */
        this.isInitialized = false;
        /** Performance metrics */
        this.metrics = {
            totalTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
            serverOffloadedTasks: 0,
            totalExecutionTimeMs: 0,
            resourceWaitTimeMs: 0
        };
        /** Server fallback state */
        this.serverFallback = {
            available: false,
            lastCheck: 0,
            errorCount: 0
        };
        // Initialize with device capabilities
        const deviceCaps = deviceCapabilities();
        const cpuCores = deviceCaps.cores || 4;
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
            resourceMonitor: undefined,
            resourceAllocator: undefined,
            memoryOptimizer: undefined,
            ...config
        };
        // Create/use resource monitor
        if (config.resourceMonitor) {
            this.resourceMonitor = config.resourceMonitor;
        }
        else {
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
            resourceAllocator: this.resourceAllocator
        });
    }
    /**
     * Initialize the load distribution system
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        try {
            // Initialize resource monitor
            if (!this.resourceMonitor.isMonitoring()) {
                await this.resourceMonitor.startMonitoring();
            }
            // Check server fallback availability
            if (this.config.enableServerFallback) {
                this.serverFallback.available = await this.checkServerFallbackAvailability();
            }
            // Analyze device capabilities
            await this.analyzeDeviceCapabilities();
            // Initialize worker pool (preloads workers)
            // Already initialized in constructor
            this.isInitialized = true;
        }
        catch (error) {
            zkErrorLogger.logError(error, {
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
    async executeTask(taskFn, data, options = {}) {
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
                await this.determineOptimalStrategy(resourceSnapshot, options.maxMemoryMB);
            // Override based on flags
            let effectiveStrategy = strategy;
            if (options.forceLocal) {
                effectiveStrategy = this.config.maxWorkers > 1
                    ? DistributionStrategy.DYNAMIC_WORKERS
                    : DistributionStrategy.SINGLE_THREADED;
            }
            else if (options.forceServer && this.serverFallback.available) {
                effectiveStrategy = DistributionStrategy.SERVER_FALLBACK;
            }
            // Log task execution
            this.metrics.totalTasks++;
            // Execute based on strategy
            let result;
            let executedLocally = true;
            const phaseTimings = {};
            // Mark resource usage before execution
            const beforeCpuUsage = resourceSnapshot.resources.CPU?.currentUsage || 0;
            const beforeMemoryUsage = resourceSnapshot.resources.MEMORY?.currentUsage || 0;
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
                    result = await this.executeOnServer(taskFn, data, options);
                    executedLocally = false;
                    this.metrics.serverOffloadedTasks++;
                    phaseTimings.server = performance.now() - executionStartTime;
                    break;
                case DistributionStrategy.HYBRID:
                    // Start both local and server, use whichever completes first
                    result = await this.executeHybrid(taskFn, data, options);
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
            const afterCpuUsage = afterSnapshot.resources.CPU?.currentUsage || 0;
            const afterMemoryUsage = afterSnapshot.resources.MEMORY?.currentUsage || 0;
            // Update metrics
            this.metrics.completedTasks++;
            this.metrics.totalExecutionTimeMs += executionTime;
            // Create result object
            const distributionResult = {
                result,
                executionTimeMs: executionTime,
                strategy: effectiveStrategy,
                executedLocally,
                resourceUsage: {
                    cpuPercentage: (afterCpuUsage + beforeCpuUsage) / 2 * 100,
                    memoryBytes: afterSnapshot.resources.MEMORY?.metrics?.usedBytes,
                    peakMemoryBytes: afterSnapshot.resources.MEMORY?.metrics?.peakBytes
                },
                phases: phaseTimings
            };
            return distributionResult;
        }
        catch (error) {
            zkErrorLogger.logError(error, {
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
    getMetrics() {
        // Calculate averages
        const avgExecutionTime = this.metrics.completedTasks > 0
            ? this.metrics.totalExecutionTimeMs / this.metrics.completedTasks
            : 0;
        return {
            currentStrategy: this.currentStrategy,
            activeWorkers: this.workerPool.getActiveWorkerCount(),
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
    resetMetrics() {
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
    setStrategy(strategy) {
        this.currentStrategy = strategy;
    }
    /**
     * Clean up resources
     */
    dispose() {
        // Shutdown worker pool
        this.workerPool.shutdown();
        // Stop resource monitoring
        if (this.resourceMonitor.isMonitoring()) {
            this.resourceMonitor.stopMonitoring();
        }
        this.isInitialized = false;
    }
    /**
     * Determine initial distribution strategy based on device capabilities
     * @returns Appropriate distribution strategy
     */
    determineInitialStrategy() {
        const device = deviceCapabilities();
        // Check if device is very limited
        if (device.tier === 'low' || (device.memory && device.memory < 1024)) {
            // Low-end device, use server fallback if available
            return this.config.enableServerFallback
                ? DistributionStrategy.SERVER_FALLBACK
                : DistributionStrategy.SINGLE_THREADED;
        }
        // Check if device has limited CPU
        if (device.cores && device.cores < 2) {
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
    async determineOptimalStrategy(resourceSnapshot, maxMemoryMB) {
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
        const device = deviceCapabilities();
        if (device.cores && device.cores >= 4) {
            return DistributionStrategy.DYNAMIC_WORKERS;
        }
        else if (device.cores && device.cores >= 2) {
            return DistributionStrategy.FIXED_WORKERS;
        }
        else {
            return DistributionStrategy.SINGLE_THREADED;
        }
    }
    /**
     * Execute a task in the main thread
     * @param taskFn Function to execute
     * @param data Input data for the task
     * @returns Task result
     */
    async executeLocal(taskFn, data) {
        try {
            // Convert function string to executable if needed
            const executableFn = typeof taskFn === 'string'
                ? new Function('return ' + taskFn)()
                : taskFn;
            // Execute the function
            return await executableFn(data);
        }
        catch (error) {
            zkErrorLogger.logError(error, {
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
    async executeInWorker(taskFn, data, options) {
        try {
            // Forward to worker pool
            return await this.workerPool.executeTask('standard', // Task type
            taskFn, data, {
                priority: options.priority,
                timeoutMs: options.timeout
            });
        }
        catch (error) {
            zkErrorLogger.logError(error, {
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
    async executeOnServer(taskFn, data, options) {
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
        }
        catch (error) {
            zkErrorLogger.logError(error, {
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
    async executeHybrid(taskFn, data, options) {
        // Execute both locally and on server, race for result
        try {
            // Start local execution
            const localPromise = this.executeInWorker(taskFn, data, options)
                .then(result => ({ source: 'local', result }));
            // Start server execution if available
            let serverPromise;
            if (this.serverFallback.available) {
                serverPromise = this.executeOnServer(taskFn, data, options)
                    .then(result => ({ source: 'server', result }));
            }
            else {
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
        }
        catch (error) {
            zkErrorLogger.logError(error, {
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
    async checkServerFallbackAvailability() {
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
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Analyze device capabilities in detail
     */
    async analyzeDeviceCapabilities() {
        try {
            const device = deviceCapabilities();
            // Perform more detailed analysis if needed
            // This could include:
            // - Testing computation speed for different operations
            // - Checking available storage
            // - Testing network bandwidth and latency
            // - Checking battery level and charging status
            // Update worker pool settings based on analysis
            const optimalWorkers = this.calculateOptimalWorkerCount(device);
            if (optimalWorkers !== this.config.maxWorkers) {
                this.workerPool.setMaxWorkers(optimalWorkers);
            }
        }
        catch (error) {
            zkErrorLogger.logError(error, {
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
    calculateOptimalWorkerCount(device) {
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
    getResourceUsagePercentage(resourceType, snapshot) {
        try {
            const resources = snapshot?.resources ||
                this.resourceMonitor.getLatestSnapshot()?.resources;
            if (!resources || !resources[resourceType]) {
                return 0;
            }
            return resources[resourceType].currentUsage * 100;
        }
        catch (error) {
            return 0;
        }
    }
    /**
     * Get available memory in MB
     * @param snapshot Optional resource snapshot
     * @returns Available memory in MB
     */
    getAvailableMemoryMB(snapshot) {
        try {
            const resources = snapshot?.resources ||
                this.resourceMonitor.getLatestSnapshot()?.resources;
            if (!resources || !resources[ResourceType.MEMORY]) {
                return 1024; // Default to 1GB if unknown
            }
            const memory = resources[ResourceType.MEMORY];
            const totalMB = memory.metrics?.totalBytes
                ? Math.floor(memory.metrics.totalBytes / (1024 * 1024))
                : deviceCapabilities().memory || 1024;
            const usedPercentage = memory.currentUsage;
            const availableMB = totalMB * (1 - usedPercentage);
            return Math.floor(availableMB);
        }
        catch (error) {
            return 1024; // Default to 1GB if error
        }
    }
    /**
     * Check if system is resource constrained
     * @returns Whether system is resource constrained
     */
    isResourceConstrained() {
        const cpuUsage = this.getResourceUsagePercentage(ResourceType.CPU);
        const memoryUsage = this.getResourceUsagePercentage(ResourceType.MEMORY);
        return cpuUsage > this.config.maxCpuUsage ||
            memoryUsage > this.config.maxMemoryUsage;
    }
    /**
     * Get the most limiting resource
     * @returns Limiting resource type or undefined if not constrained
     */
    getLimitingResource() {
        const cpuUsage = this.getResourceUsagePercentage(ResourceType.CPU);
        const memoryUsage = this.getResourceUsagePercentage(ResourceType.MEMORY);
        if (cpuUsage > this.config.maxCpuUsage && cpuUsage > memoryUsage) {
            return ResourceType.CPU;
        }
        else if (memoryUsage > this.config.maxMemoryUsage) {
            return ResourceType.MEMORY;
        }
        return undefined;
    }
}
