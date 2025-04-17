/**
 * @fileoverview Deployment strategy types and interfaces
 * 
 * This module defines the deployment strategy types and interfaces used 
 * by the deployment system to configure and select appropriate strategies.
 */

/**
 * Deployment strategy types
 */
export enum DeploymentStrategyType {
    /** Automatic strategy selection based on environment detection */
    AUTOMATIC = 'automatic',
    /** Full local execution */
    FullLocal = 'full-local',
    /** Hybrid approach with local and server components */
    Hybrid = 'hybrid',
    /** Offload computation to server */
    ServerSide = 'server-side',
    /** Minimal resource usage approach */
    LowResource = 'low-resource',
    /** Maximum performance approach */
    HighPerformance = 'high-performance'
}

/**
 * Deployment strategy configuration
 */
export interface DeploymentStrategy {
    /** Strategy type */
    type: DeploymentStrategyType;
    /** Whether to use worker threads */
    useWorkerThreads: boolean;
    /** Number of worker threads to use (0 = disabled) */
    workerThreadCount: number;
    /** Whether to use WebAssembly */
    useWebAssembly: boolean;
    /** Whether to use local storage/caching */
    useLocalCache: boolean;
    /** Whether to offload computation to server */
    offloadToServer: boolean;
    /** Percentage of work to offload to server (0-100) */
    serverOffloadPercentage: number;
    /** Memory limit in MB (0 = unlimited) */
    memoryLimitMB: number;
    /** Whether to enable compression */
    enableCompression: boolean;
    /** Whether to enable aggressive resource cleanup */
    aggressiveCleanup: boolean;
    /** Platform-specific optimizations */
    platformOptimizations: Record<string, boolean>;
} 