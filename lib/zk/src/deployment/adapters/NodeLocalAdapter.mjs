/**
 * NodeLocalAdapter
 * 
 * Adapter for deploying ZK proofs in a Node.js environment with FullLocal strategy.
 * Optimized for local proving and verification using Node.js threads.
 * 
 * @module deployment/adapters/NodeLocalAdapter
 */

import { DeploymentAdapter } from '../DeploymentAdapter.js';
import { cpus } from 'os';
import { 
    ConfigurationError,
    DeploymentProcessError
} from '../index.js';
import { zkErrorLogger } from '../../zkErrorLogger.mjs';

/**
 * Node.js adapter for full local deployment strategy.
 * Optimized for local proving and verification using Node.js worker threads.
 */
export class NodeLocalAdapter extends DeploymentAdapter {
    /**
     * Creates a new NodeLocalAdapter instance
     * 
     * @param {Object} [options={}] - Configuration options
     */
    constructor(options = {}) {
        super('FullLocal', 'Node');
        this.workers = [];
        this.availableThreads = Math.max(1, cpus().length - 1);
        this.options = options;
    }

    /**
     * Configures the adapter with node-specific optimizations
     * 
     * @param {PlatformConfigurator} configurator - The platform configurator
     * @returns {Object} The updated configuration
     * @throws {ConfigurationError} If configuration fails
     */
    async configure(configurator) {
        try {
            if (!configurator) {
                throw new ConfigurationError(
                    'Platform configurator is required',
                    {
                        details: {
                            environment: this.environment,
                            strategy: this.strategy
                        }
                    }
                );
            }
            
            const config = await super.configure(configurator);
            
            zkErrorLogger.info('Configuring Node.js local adapter with optimizations', {
                context: 'NodeLocalAdapter.configure',
                availableThreads: this.availableThreads
            });

            // Add node-specific optimizations
            config.optimizations.push('threadPooling');
            zkErrorLogger.debug('Added threadPooling optimization', {
                context: 'NodeLocalAdapter.configure'
            });
            
            config.optimizations.push('localCaching');
            zkErrorLogger.debug('Added localCaching optimization', {
                context: 'NodeLocalAdapter.configure'
            });
            
            config.availableThreads = this.availableThreads;

            zkErrorLogger.info('Node.js local adapter configuration completed successfully', {
                context: 'NodeLocalAdapter.configure',
                availableThreads: this.availableThreads
            });

            return config;
        } catch (error) {
            // If it's already our custom error type, just log and rethrow
            if (error instanceof ConfigurationError) {
                zkErrorLogger.logError(error, {
                    context: 'NodeLocalAdapter.configure'
                });
                throw error;
            }
            
            // Otherwise, wrap in our custom error
            const configError = new ConfigurationError(
                `Failed to configure Node.js local adapter: ${error.message}`,
                {
                    details: {
                        originalError: error.message,
                        stack: error.stack
                    }
                }
            );
            
            zkErrorLogger.logError(configError, {
                context: 'NodeLocalAdapter.configure'
            });
            
            throw configError;
        }
    }

    /**
     * Deploys the ZK proof system using Node.js specific implementation
     * 
     * @param {Object} options - Deployment options
     * @returns {Object} Deployment result
     * @throws {ConfigurationError} If the adapter is not configured
     * @throws {DeploymentProcessError} If deployment fails
     */
    async deploy(options = {}) {
        try {
            if (!this.config.initialized) {
                throw new ConfigurationError(
                    'Adapter must be configured before deployment',
                    {
                        details: {
                            environment: this.environment,
                            strategy: this.strategy,
                            initialized: this.config.initialized
                        }
                    }
                );
            }

            zkErrorLogger.info(`Deploying with NodeLocalAdapter using ${this.availableThreads} threads`, {
                context: 'NodeLocalAdapter.deploy',
                availableThreads: this.availableThreads,
                options
            });

            // Initialize thread pool if needed
            let workerCount = 0;
            if (options.useThreads !== false) {
                workerCount = await this._initializeThreadPool();
                zkErrorLogger.info(`Initialized thread pool with ${workerCount} workers`, {
                    context: 'NodeLocalAdapter.deploy'
                });
            } else {
                zkErrorLogger.info('Thread pool disabled for this deployment', {
                    context: 'NodeLocalAdapter.deploy'
                });
            }

            // Perform local setup
            zkErrorLogger.info('Performing local setup for ZK proving', {
                context: 'NodeLocalAdapter.deploy'
            });
            
            const setupResult = await this._performLocalSetup(options);
            
            zkErrorLogger.info('Local setup completed successfully', {
                context: 'NodeLocalAdapter.deploy',
                setupResult
            });

            return {
                success: true,
                environment: this.environment,
                strategy: this.strategy,
                threadCount: this.workers.length,
                setupDetails: setupResult
            };
        } catch (error) {
            // If it's already our custom error type, just log and rethrow
            if (error instanceof ConfigurationError || error instanceof DeploymentProcessError) {
                zkErrorLogger.logError(error, {
                    context: 'NodeLocalAdapter.deploy'
                });
                throw error;
            }
            
            // Otherwise, wrap in our custom error
            const deployError = new DeploymentProcessError(
                `Node.js local adapter deployment failed: ${error.message}`,
                {
                    details: {
                        originalError: error.message,
                        stack: error.stack,
                        options
                    }
                }
            );
            
            zkErrorLogger.logError(deployError, {
                context: 'NodeLocalAdapter.deploy'
            });
            
            throw deployError;
        }
    }

    /**
     * Validates that the Node.js environment meets requirements
     * 
     * @returns {Object} Validation result
     */
    async validateEnvironment() {
        try {
            const issues = [];

            // Check Node.js version
            const nodeVersion = process.version;
            const minVersion = 'v14.0.0';

            if (this._compareVersions(nodeVersion, minVersion) < 0) {
                issues.push(`Node version ${nodeVersion} is below minimum required version ${minVersion}`);
                zkErrorLogger.warn(`Node version ${nodeVersion} is below minimum required version ${minVersion}`, {
                    context: 'NodeLocalAdapter.validateEnvironment'
                });
            }

            // Check available memory
            const memoryLimit = process.memoryUsage().heapTotal / (1024 * 1024);
            if (memoryLimit < 512) {
                issues.push(`Available memory (${Math.round(memoryLimit)}MB) is below recommended 512MB`);
                zkErrorLogger.warn(`Available memory (${Math.round(memoryLimit)}MB) is below recommended 512MB`, {
                    context: 'NodeLocalAdapter.validateEnvironment'
                });
            }

            const result = {
                valid: issues.length === 0,
                environment: this.environment,
                strategy: this.strategy,
                nodeVersion,
                availableThreads: this.availableThreads,
                memoryLimit: `${Math.round(memoryLimit)}MB`,
                issues
            };
            
            zkErrorLogger.info(`Node.js environment validation result: ${result.valid ? 'Valid' : 'Invalid'}`, {
                context: 'NodeLocalAdapter.validateEnvironment',
                result,
                issueCount: issues.length
            });
            
            return result;
        } catch (error) {
            zkErrorLogger.error(`Error validating Node.js environment: ${error.message}`, {
                context: 'NodeLocalAdapter.validateEnvironment',
                error: error.message,
                stack: error.stack
            });
            
            return {
                valid: false,
                environment: this.environment,
                strategy: this.strategy,
                issues: [`Validation error: ${error.message}`]
            };
        }
    }

    /**
     * Cleanup resources used by the adapter
     * 
     * @returns {Promise<void>} Promise that resolves when cleanup is complete
     */
    async cleanup() {
        try {
            zkErrorLogger.info('Cleaning up Node.js local adapter resources', {
                context: 'NodeLocalAdapter.cleanup',
                workerCount: this.workers.length
            });
            
            // Terminate any worker threads
            for (const worker of this.workers) {
                if (worker && worker.terminate) {
                    try {
                        await worker.terminate();
                        zkErrorLogger.debug('Worker thread terminated successfully', {
                            context: 'NodeLocalAdapter.cleanup'
                        });
                    } catch (terminationError) {
                        zkErrorLogger.warn(`Error terminating worker: ${terminationError.message}`, {
                            context: 'NodeLocalAdapter.cleanup',
                            error: terminationError.message
                        });
                    }
                }
            }

            this.workers = [];
            await super.cleanup();
            
            zkErrorLogger.info('Node.js local adapter resources cleaned up successfully', {
                context: 'NodeLocalAdapter.cleanup'
            });
        } catch (error) {
            zkErrorLogger.warn(`Error during Node.js local adapter cleanup: ${error.message}`, {
                context: 'NodeLocalAdapter.cleanup',
                error: error.message,
                stack: error.stack
            });
        }
    }

    /**
     * Initialize the thread pool for parallel proving
     * 
     * @param {Object} [options={}] - Thread pool options
     * @returns {Promise<number>} Number of workers initialized
     * @private
     */
    async _initializeThreadPool(options = {}) {
        try {
            // This is a simplified implementation
            // In a real implementation, this would create Worker threads
            zkErrorLogger.info(`Initializing thread pool with ${this.availableThreads} workers`, {
                context: 'NodeLocalAdapter._initializeThreadPool'
            });
            
            // Create mock workers (in a real implementation, we would use worker_threads)
            this.workers = Array(this.availableThreads).fill(null).map((_, index) => {
                return {
                    id: index,
                    active: false,
                    terminate: async () => {
                        zkErrorLogger.debug(`Terminated worker ${index}`, {
                            context: 'NodeLocalAdapter._initializeThreadPool'
                        });
                        return Promise.resolve();
                    }
                };
            });
            
            zkErrorLogger.info(`Thread pool initialized with ${this.workers.length} workers`, {
                context: 'NodeLocalAdapter._initializeThreadPool'
            });

            return this.workers.length;
        } catch (error) {
            zkErrorLogger.warn(`Failed to initialize thread pool: ${error.message}`, {
                context: 'NodeLocalAdapter._initializeThreadPool',
                error: error.message,
                stack: error.stack
            });
            
            // Return 0 for no workers rather than throwing
            return 0;
        }
    }

    /**
     * Perform local setup for ZK proving
     * 
     * @param {Object} options - Setup options
     * @returns {Promise<Object>} Setup result
     * @private
     */
    async _performLocalSetup(options) {
        try {
            // Simplified implementation - in a real adapter, this would set up
            // the necessary structures for ZK proving locally
            zkErrorLogger.info('Performing local setup for ZK proving', {
                context: 'NodeLocalAdapter._performLocalSetup'
            });
            
            // Simulate setup process
            const setupResult = {
                localSetupComplete: true,
                timestamp: new Date().toISOString()
            };
            
            zkErrorLogger.info('Local setup completed successfully', {
                context: 'NodeLocalAdapter._performLocalSetup',
                timestamp: setupResult.timestamp
            });
            
            return setupResult;
        } catch (error) {
            zkErrorLogger.error(`Failed to perform local setup: ${error.message}`, {
                context: 'NodeLocalAdapter._performLocalSetup',
                error: error.message,
                stack: error.stack
            });
            
            throw new DeploymentProcessError(
                `Local setup failed: ${error.message}`,
                {
                    details: {
                        originalError: error.message,
                        stack: error.stack,
                        options
                    }
                }
            );
        }
    }

    /**
     * Compare semantic versions
     * 
     * @param {string} v1 - First version string
     * @param {string} v2 - Second version string
     * @returns {number} 1 if v1 > v2, -1 if v1 < v2, 0 if equal
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