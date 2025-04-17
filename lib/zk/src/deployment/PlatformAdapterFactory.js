/**
 * @fileoverview Factory for creating deployment adapters
 * 
 * Factory class that creates appropriate DeploymentAdapter instances
 * based on deployment strategy and environment.
 * 
 * @module deployment/PlatformAdapterFactory
 */

import { DeploymentStrategyType, EnvironmentType } from './index.js';
import { DeploymentAdapter, DeploymentAdapterError } from './DeploymentAdapter.js';
import { zkErrorLogger } from '../zkErrorLogger.js';

/**
 * Factory for creating platform-specific DeploymentAdapter instances
 * 
 * The PlatformAdapterFactory creates appropriate adapter instances based on
 * the deployment environment and strategy. It provides a registry of adapters
 * and handles fallback to default implementations when needed.
 * 
 * @class
 * @exports PlatformAdapterFactory
 */
export class PlatformAdapterFactory {
    /**
     * Creates a new PlatformAdapterFactory instance
     */
    constructor() {
        this.adapters = new Map();
        this._registerDefaultAdapters();
    }

    /**
     * Registers the default adapters
     * 
     * @private
     */
    _registerDefaultAdapters() {
        // Default adapter implementation
        this.registerAdapter(
            DeploymentStrategyType.FullLocal,
            EnvironmentType.Node,
            class NodeLocalAdapter extends DeploymentAdapter {
                async configure(configurator) {
                    await super.configure(configurator);
                    this.config.useThreads = true;
                    this.config.localProving = true;
                    return this.config;
                }

                async deploy(options) {
                    console.log('Deploying with Node Local Adapter');
                    return {
                        success: true,
                        environment: options.environment,
                        strategy: DeploymentStrategyType.FullLocal,
                        optimizations: ['threading', 'local-proving']
                    };
                }
            }
        );

        // Browser adapter with hybrid strategy
        this.registerAdapter(
            DeploymentStrategyType.Hybrid,
            EnvironmentType.Browser,
            class BrowserHybridAdapter extends DeploymentAdapter {
                async configure(configurator) {
                    await super.configure(configurator);
                    this.config.useWebWorkers = true;
                    this.config.useServiceWorkers = true;
                    this.config.offloadComputation = true;
                    return this.config;
                }

                async deploy(options) {
                    console.log('Deploying with Browser Hybrid Adapter');
                    return {
                        success: true,
                        environment: options.environment,
                        strategy: DeploymentStrategyType.Hybrid,
                        optimizations: ['web-workers', 'service-workers', 'computation-offloading']
                    };
                }
            }
        );

        // Web Worker adapter with high performance strategy
        this.registerAdapter(
            DeploymentStrategyType.HighPerformance,
            EnvironmentType.Worker,
            class WorkerHighPerfAdapter extends DeploymentAdapter {
                async configure(configurator) {
                    await super.configure(configurator);
                    this.config.optimizeForThroughput = true;
                    this.config.cacheResults = true;
                    return this.config;
                }

                async deploy(options) {
                    console.log('Deploying with Worker High Performance Adapter');
                    return {
                        success: true,
                        environment: options.environment,
                        strategy: DeploymentStrategyType.HighPerformance,
                        optimizations: ['throughput-optimization', 'result-caching']
                    };
                }
            }
        );

        // Mobile adapter with low resource strategy
        this.registerAdapter(
            DeploymentStrategyType.LowResource,
            EnvironmentType.Mobile,
            class MobileLowResourceAdapter extends DeploymentAdapter {
                async configure(configurator) {
                    await super.configure(configurator);
                    this.config.minimizeMemoryUsage = true;
                    this.config.batchProcessing = true;
                    return this.config;
                }

                async deploy(options) {
                    console.log('Deploying with Mobile Low Resource Adapter');
                    return {
                        success: true,
                        environment: options.environment,
                        strategy: DeploymentStrategyType.LowResource,
                        optimizations: ['memory-optimization', 'batch-processing']
                    };
                }
            }
        );
    }

    /**
     * Registers a new adapter
     * 
     * @param {string} strategy - The deployment strategy
     * @param {string} environment - The environment type
     * @param {Class} adapterClass - The adapter class
     */
    registerAdapter(strategy, environment, adapterClass) {
        const key = `${strategy}:${environment}`;
        this.adapters.set(key, adapterClass);
    }

    /**
     * Creates an adapter for the given strategy and environment
     * 
     * @param {string} strategy - The deployment strategy
     * @param {string} environment - The environment type
     * @returns {DeploymentAdapter} The created adapter
     */
    createAdapter(strategy, environment) {
        const key = `${strategy}:${environment}`;
        let AdapterClass = this.adapters.get(key);

        if (!AdapterClass) {
            console.warn(`No adapter found for ${strategy}:${environment}, using default`);
            AdapterClass = DeploymentAdapter;
        }

        return new AdapterClass(strategy, environment);
    }
} 