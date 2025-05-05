/**
 * @fileoverview Deployment strategy types and interfaces for cross-platform deployments
 * 
 * This module defines the strategy types and configuration interfaces used by
 * the DeploymentStrategySelector to optimize deployments across platforms.
 */

/**
 * Types of deployment strategies that can be selected
 */
export enum DeploymentStrategyType {
    /** Automatically determine the best strategy based on environment and capabilities */
    AUTOMATIC = 'automatic',

    /** Execute all operations locally without server assistance */
    FullLocal = 'full_local',

    /** Split operations between local and server execution */
    Hybrid = 'hybrid',

    /** Offload all operations to the server */
    ServerSide = 'server_side',

    /** Optimize for low-resource environments */
    LowResource = 'low_resource',

    /** Optimize for high-performance environments */
    HighPerformance = 'high_performance'
}

/**
 * Platform-specific optimizations that can be applied
 */
export interface PlatformOptimizations {
    /** Use shared memory when available */
    useSharedMemory?: boolean;

    /** Reduce quality of operations to improve performance */
    reduceQuality?: boolean;

    /** Minimize memory usage at the cost of performance */
    minimizeMemoryUsage?: boolean;

    /** Disable parallelism to reduce resource usage */
    disableParallelism?: boolean;

    /** Maximize parallelism for better performance */
    maximizeParallelism?: boolean;

    /** Precompute values to improve performance */
    precomputeValues?: boolean;

    /** Custom optimizations for specific platforms */
    [key: string]: any;
}

/**
 * Deployment strategy configuration
 */
export interface DeploymentStrategy {
    /** The type of strategy */
    type: DeploymentStrategyType;

    /** Whether to use worker threads for parallel processing */
    useWorkerThreads: boolean;

    /** Number of worker threads to use */
    workerThreadCount: number;

    /** Whether to use WebAssembly for improved performance */
    useWebAssembly: boolean;

    /** Whether to use local caching */
    useLocalCache: boolean;

    /** Whether to offload operations to the server */
    offloadToServer: boolean;

    /** Percentage of operations to offload to the server (0-100) */
    serverOffloadPercentage: number;

    /** Memory limit in MB */
    memoryLimitMB: number;

    /** Whether to enable compression for transfers */
    enableCompression: boolean;

    /** Whether to aggressively clean up resources */
    aggressiveCleanup: boolean;

    /** Platform-specific optimizations */
    platformOptimizations: PlatformOptimizations;
}

/**
 * Strategy factory for creating strategies with reasonable defaults
 */
export class StrategyFactory {
    /**
     * Create a strategy with default values
     * @param type The strategy type
     * @returns A default strategy of the specified type
     */
    public static createStrategy(type: DeploymentStrategyType): DeploymentStrategy {
        switch (type) {
            case DeploymentStrategyType.FullLocal:
                return {
                    type: DeploymentStrategyType.FullLocal,
                    useWorkerThreads: true,
                    workerThreadCount: 2,
                    useWebAssembly: true,
                    useLocalCache: true,
                    offloadToServer: false,
                    serverOffloadPercentage: 0,
                    memoryLimitMB: 1024,
                    enableCompression: true,
                    aggressiveCleanup: false,
                    platformOptimizations: {}
                };

            case DeploymentStrategyType.Hybrid:
                return {
                    type: DeploymentStrategyType.Hybrid,
                    useWorkerThreads: true,
                    workerThreadCount: 1,
                    useWebAssembly: true,
                    useLocalCache: true,
                    offloadToServer: true,
                    serverOffloadPercentage: 50,
                    memoryLimitMB: 512,
                    enableCompression: true,
                    aggressiveCleanup: false,
                    platformOptimizations: {}
                };

            case DeploymentStrategyType.ServerSide:
                return {
                    type: DeploymentStrategyType.ServerSide,
                    useWorkerThreads: false,
                    workerThreadCount: 0,
                    useWebAssembly: false,
                    useLocalCache: true,
                    offloadToServer: true,
                    serverOffloadPercentage: 100,
                    memoryLimitMB: 256,
                    enableCompression: true,
                    aggressiveCleanup: true,
                    platformOptimizations: {}
                };

            case DeploymentStrategyType.LowResource:
                return {
                    type: DeploymentStrategyType.LowResource,
                    useWorkerThreads: false,
                    workerThreadCount: 0,
                    useWebAssembly: true,
                    useLocalCache: false,
                    offloadToServer: true,
                    serverOffloadPercentage: 80,
                    memoryLimitMB: 256,
                    enableCompression: true,
                    aggressiveCleanup: true,
                    platformOptimizations: {
                        reduceQuality: true,
                        minimizeMemoryUsage: true,
                        disableParallelism: true
                    }
                };

            case DeploymentStrategyType.HighPerformance:
                return {
                    type: DeploymentStrategyType.HighPerformance,
                    useWorkerThreads: true,
                    workerThreadCount: 4,
                    useWebAssembly: true,
                    useLocalCache: true,
                    offloadToServer: false,
                    serverOffloadPercentage: 0,
                    memoryLimitMB: 2048,
                    enableCompression: false,
                    aggressiveCleanup: false,
                    platformOptimizations: {
                        useSharedMemory: true,
                        maximizeParallelism: true,
                        precomputeValues: true
                    }
                };

            case DeploymentStrategyType.AUTOMATIC:
            default:
                return {
                    type: DeploymentStrategyType.AUTOMATIC,
                    useWorkerThreads: true,
                    workerThreadCount: 2,
                    useWebAssembly: true,
                    useLocalCache: true,
                    offloadToServer: true,
                    serverOffloadPercentage: 30,
                    memoryLimitMB: 512,
                    enableCompression: true,
                    aggressiveCleanup: false,
                    platformOptimizations: {}
                };
        }
    }
} 