/**
 * DeploymentManager
 * 
 * Manages the deployment of ZK proof systems across different platforms and environments.
 * Handles optimization strategies, environment detection, and platform-specific configurations.
 */

import { EnvironmentType, DeploymentStrategyType } from './index.js';
import { PlatformAdapterFactory } from './PlatformAdapterFactory.js';
import { PlatformConfigurator } from './PlatformConfigurator.js';

export class DeploymentManager {
    /**
     * Creates a new DeploymentManager instance
     * 
     * @param {Object} options - Configuration options
     * @param {boolean} [options.autoDetect=true] - Whether to automatically detect environment
     * @param {string} [options.preferredStrategy] - Preferred deployment strategy
     * @param {Object} [options.configuratorOptions] - Options for the platform configurator
     */
    constructor(options = {}) {
        this.initialized = false;
        this.options = {
            autoDetect: true,
            ...options
        };

        this.environment = null;
        this.strategy = options.preferredStrategy || null;
        this.adapter = null;
        this.configurator = new PlatformConfigurator(options.configuratorOptions);
        this.adapterFactory = new PlatformAdapterFactory();
    }

    /**
     * Initializes the deployment manager
     * 
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.initialized) return;

        if (this.options.autoDetect) {
            this.environment = await this._detectEnvironment();
        }

        if (!this.strategy) {
            this.strategy = this._selectOptimalStrategy();
        }

        this.adapter = this.adapterFactory.createAdapter(this.strategy, this.environment);
        await this.adapter.configure(this.configurator);

        this.initialized = true;
    }

    /**
     * Detects the current environment
     * 
     * @returns {Promise<string>} The detected environment type
     * @private
     */
    async _detectEnvironment() {
        // Simple environment detection logic
        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
            return EnvironmentType.Browser;
        } else if (typeof process !== 'undefined' && process.versions && process.versions.node) {
            return EnvironmentType.Node;
        } else if (typeof self !== 'undefined' && self.WorkerGlobalScope) {
            return EnvironmentType.Worker;
        } else {
            // Default to Node environment if unable to determine
            return EnvironmentType.Node;
        }
    }

    /**
     * Selects the optimal deployment strategy based on environment
     * 
     * @returns {string} The selected deployment strategy
     * @private
     */
    _selectOptimalStrategy() {
        switch (this.environment) {
            case EnvironmentType.Browser:
                return DeploymentStrategyType.Hybrid;
            case EnvironmentType.Node:
                return DeploymentStrategyType.FullLocal;
            case EnvironmentType.Worker:
                return DeploymentStrategyType.HighPerformance;
            case EnvironmentType.Mobile:
                return DeploymentStrategyType.LowResource;
            default:
                return DeploymentStrategyType.Hybrid;
        }
    }

    /**
     * Deploys the ZK proof system with the current configuration
     * 
     * @param {Object} options - Deployment options
     * @returns {Promise<Object>} Deployment result
     */
    async deploy(options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        return this.adapter.deploy({
            environment: this.environment,
            ...options
        });
    }

    /**
     * Gets the current environment type
     * 
     * @returns {string} The current environment
     */
    getEnvironment() {
        return this.environment;
    }

    /**
     * Gets the current deployment strategy
     * 
     * @returns {string} The current strategy
     */
    getStrategy() {
        return this.strategy;
    }
} 