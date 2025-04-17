/**
 * NodeLocalAdapter
 * 
 * Adapter for deploying ZK proofs in a Node.js environment with FullLocal strategy.
 * Optimized for local proving and verification using Node.js threads.
 */

import { DeploymentAdapter } from '../DeploymentAdapter.js';
import { cpus } from 'os';

export class NodeLocalAdapter extends DeploymentAdapter {
    /**
     * Creates a new NodeLocalAdapter instance
     */
    constructor() {
        super('FullLocal', 'Node');
        this.workers = [];
        this.availableThreads = Math.max(1, cpus().length - 1);
    }

    /**
     * Configures the adapter with node-specific optimizations
     * 
     * @param {PlatformConfigurator} configurator - The platform configurator
     * @returns {Object} The updated configuration
     */
    async configure(configurator) {
        const config = await super.configure(configurator);

        // Add node-specific optimizations
        config.optimizations.push('threadPooling');
        config.optimizations.push('localCaching');
        config.availableThreads = this.availableThreads;

        return config;
    }

    /**
     * Deploys the ZK proof system using Node.js specific implementation
     * 
     * @param {Object} options - Deployment options
     * @returns {Object} Deployment result
     */
    async deploy(options = {}) {
        if (!this.config.initialized) {
            throw new Error('Adapter must be configured before deployment');
        }

        console.log(`Deploying with NodeLocalAdapter using ${this.availableThreads} threads`);

        // Initialize thread pool if needed
        if (options.useThreads !== false) {
            await this._initializeThreadPool();
        }

        // Perform local setup
        const setupResult = await this._performLocalSetup(options);

        return {
            success: true,
            environment: this.environment,
            strategy: this.strategy,
            threadCount: this.workers.length,
            setupDetails: setupResult
        };
    }

    /**
     * Validates that the Node.js environment meets requirements
     * 
     * @returns {Object} Validation result
     */
    async validateEnvironment() {
        const issues = [];

        // Check Node.js version
        const nodeVersion = process.version;
        const minVersion = 'v14.0.0';

        if (this._compareVersions(nodeVersion, minVersion) < 0) {
            issues.push(`Node version ${nodeVersion} is below minimum required version ${minVersion}`);
        }

        // Check available memory
        const memoryLimit = process.memoryUsage().heapTotal / (1024 * 1024);
        if (memoryLimit < 512) {
            issues.push(`Available memory (${Math.round(memoryLimit)}MB) is below recommended 512MB`);
        }

        return {
            valid: issues.length === 0,
            environment: this.environment,
            strategy: this.strategy,
            nodeVersion,
            availableThreads: this.availableThreads,
            memoryLimit: `${Math.round(memoryLimit)}MB`,
            issues
        };
    }

    /**
     * Cleanup resources used by the adapter
     */
    async cleanup() {
        // Terminate any worker threads
        for (const worker of this.workers) {
            if (worker && worker.terminate) {
                await worker.terminate();
            }
        }

        this.workers = [];
        await super.cleanup();
    }

    /**
     * Initialize the thread pool for parallel proving
     * @private
     */
    async _initializeThreadPool() {
        // This is a simplified implementation
        // In a real implementation, this would create Worker threads
        console.log(`Initializing thread pool with ${this.availableThreads} workers`);
        this.workers = Array(this.availableThreads).fill({ active: false });

        return this.workers.length;
    }

    /**
     * Perform local setup for ZK proving
     * @private
     */
    async _performLocalSetup(options) {
        // Simplified implementation - in a real adapter, this would set up
        // the necessary structures for ZK proving locally
        return {
            localSetupComplete: true,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Compare semantic versions
     * @private
     */
    _compareVersions(v1, v2) {
        const parseVersion = v => v.replace('v', '').split('.').map(Number);
        const parts1 = parseVersion(v1);
        const parts2 = parseVersion(v2);

        for (let i = 0; i < 3; i++) {
            if (parts1[i] > parts2[i]) return 1;
            if (parts1[i] < parts2[i]) return -1;
        }

        return 0;
    }
} 