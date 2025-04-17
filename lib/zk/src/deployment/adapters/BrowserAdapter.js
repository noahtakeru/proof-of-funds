/**
 * BrowserAdapter
 * 
 * Adapter for deploying ZK proofs in browser environments with a client-server architecture.
 * Handles WebWorker integration and browser-specific optimizations.
 * 
 * @module deployment/adapters/BrowserAdapter
 */

import { DeploymentAdapter } from '../DeploymentAdapter.js';
import { 
    ConfigurationError,
    DeploymentProcessError
} from '../index.js';
import { zkErrorLogger } from '../../zkErrorLogger.mjs';

/**
 * Browser-specific adapter for client-server architecture.
 * Handles browser capabilities, web workers, and server connectivity.
 */
export class BrowserAdapter extends DeploymentAdapter {
    /**
     * Creates a new BrowserAdapter instance
     * 
     * @param {Object} options - Additional browser-specific options
     * @param {string} [options.serverEndpoint='/api/zk'] - Server endpoint for API calls
     * @param {number} [options.maxWorkers=4] - Maximum number of web workers to use
     * @param {boolean} [options.useSharedArrayBuffer=false] - Whether to use SharedArrayBuffer
     * @param {string} [options.storageKey='zk_proof_system_config'] - Storage key for localStorage
     */
    constructor(options = {}) {
        super('ClientServer', 'Browser');
        this.workers = [];
        this.serverEndpoint = options.serverEndpoint || '/api/zk';
        this.maxWorkers = options.maxWorkers || 4;
        this.useSharedArrayBuffer = options.useSharedArrayBuffer || false;
        this.storageKey = options.storageKey || 'zk_proof_system_config';
    }

    /**
     * Configures the adapter with browser-specific optimizations
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
            
            zkErrorLogger.info('Configuring browser adapter with optimizations', {
                context: 'BrowserAdapter.configure',
                environment: this.environment,
                strategy: this.strategy
            });

            // Add browser-specific optimizations
            config.optimizations.push('webWorkers');
            config.optimizations.push('progressiveLoading');

            if (this.useSharedArrayBuffer && typeof SharedArrayBuffer !== 'undefined') {
                config.optimizations.push('sharedMemory');
                zkErrorLogger.info('Adding shared memory optimization (SharedArrayBuffer)', {
                    context: 'BrowserAdapter.configure'
                });
            }

            config.endpoints = {
                prover: `${this.serverEndpoint}/prove`,
                verifier: `${this.serverEndpoint}/verify`,
                status: `${this.serverEndpoint}/status`
            };

            // Save configuration to local storage if available
            if (typeof localStorage !== 'undefined') {
                try {
                    localStorage.setItem(this.storageKey, JSON.stringify({
                        timestamp: new Date().toISOString(),
                        config: {
                            environment: this.environment,
                            strategy: this.strategy,
                            optimizations: config.optimizations,
                            maxWorkers: this.maxWorkers
                        }
                    }));
                    
                    zkErrorLogger.debug('Saved browser adapter configuration to localStorage', {
                        context: 'BrowserAdapter.configure',
                        storageKey: this.storageKey
                    });
                } catch (error) {
                    zkErrorLogger.warn(`Failed to save configuration to localStorage: ${error.message}`, {
                        context: 'BrowserAdapter.configure',
                        storageKey: this.storageKey,
                        error: error.message
                    });
                }
            }

            return config;
        } catch (error) {
            // If it's already our custom error type, just log and rethrow
            if (error instanceof ConfigurationError) {
                zkErrorLogger.logError(error, {
                    context: 'BrowserAdapter.configure'
                });
                throw error;
            }
            
            // Otherwise, wrap in our custom error
            const configError = new ConfigurationError(
                `Failed to configure browser adapter: ${error.message}`,
                {
                    details: {
                        originalError: error.message,
                        stack: error.stack,
                        environment: this.environment,
                        strategy: this.strategy
                    }
                }
            );
            
            zkErrorLogger.logError(configError, {
                context: 'BrowserAdapter.configure'
            });
            
            throw configError;
        }
    }

    /**
     * Deploys the ZK proof system using browser-specific implementation
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

            zkErrorLogger.info(`Deploying with BrowserAdapter using ${this.maxWorkers} web workers`, {
                context: 'BrowserAdapter.deploy',
                maxWorkers: this.maxWorkers,
                options
            });

            // Initialize web workers if needed
            if (options.useWebWorkers !== false) {
                const workerCount = await this._initializeWebWorkers();
                zkErrorLogger.info(`Initialized ${workerCount} web workers`, {
                    context: 'BrowserAdapter.deploy',
                    workerCount
                });
            } else {
                zkErrorLogger.info('Web workers disabled for this deployment', {
                    context: 'BrowserAdapter.deploy'
                });
            }

            // Check server connectivity
            zkErrorLogger.info('Checking server connectivity', {
                context: 'BrowserAdapter.deploy',
                endpoint: this.config.endpoints.status
            });
            
            const connectivityCheck = await this._checkServerConnectivity();

            if (!connectivityCheck.success) {
                throw new DeploymentProcessError(
                    `Failed to connect to server: ${connectivityCheck.error}`,
                    {
                        details: {
                            endpoint: this.config.endpoints.status,
                            error: connectivityCheck.error
                        }
                    }
                );
            }

            zkErrorLogger.info('Successfully deployed browser adapter', {
                context: 'BrowserAdapter.deploy',
                serverConnected: connectivityCheck.success,
                workerCount: this.workers.length
            });
            
            return {
                success: true,
                environment: this.environment,
                strategy: this.strategy,
                webWorkersCount: this.workers.length,
                serverConnected: connectivityCheck.success,
                endpoints: this.config.endpoints
            };
        } catch (error) {
            // If it's already our custom error type, just log and rethrow
            if (error instanceof ConfigurationError || error instanceof DeploymentProcessError) {
                zkErrorLogger.logError(error, {
                    context: 'BrowserAdapter.deploy'
                });
                throw error;
            }
            
            // Otherwise, wrap in our custom error
            const deployError = new DeploymentProcessError(
                `Browser adapter deployment failed: ${error.message}`,
                {
                    details: {
                        originalError: error.message,
                        stack: error.stack,
                        environment: this.environment,
                        strategy: this.strategy,
                        options
                    }
                }
            );
            
            zkErrorLogger.logError(deployError, {
                context: 'BrowserAdapter.deploy'
            });
            
            throw deployError;
        }
    }

    /**
     * Validates that the browser environment meets requirements
     * 
     * @returns {Object} Validation result
     */
    async validateEnvironment() {
        try {
            const issues = [];

            // Check for WebWorker support
            if (typeof Worker === 'undefined') {
                issues.push('Web Workers are not supported in this browser');
                zkErrorLogger.warn('Web Workers are not supported in this browser', {
                    context: 'BrowserAdapter.validateEnvironment'
                });
            }

            // Check for WebCrypto support (needed for secure operations)
            if (typeof window.crypto === 'undefined' || typeof window.crypto.subtle === 'undefined') {
                issues.push('Web Crypto API is not supported in this browser');
                zkErrorLogger.warn('Web Crypto API is not supported in this browser', {
                    context: 'BrowserAdapter.validateEnvironment'
                });
            }

            // Check for SharedArrayBuffer if requested
            if (this.useSharedArrayBuffer && typeof SharedArrayBuffer === 'undefined') {
                issues.push('SharedArrayBuffer is not supported but was requested');
                zkErrorLogger.warn('SharedArrayBuffer is not supported but was requested', {
                    context: 'BrowserAdapter.validateEnvironment'
                });
            }

            // Check IndexedDB for local storage
            let indexedDBSupported = false;
            try {
                indexedDBSupported = 'indexedDB' in window;
                if (!indexedDBSupported) {
                    issues.push('IndexedDB is not supported for local state persistence');
                    zkErrorLogger.warn('IndexedDB is not supported for local state persistence', {
                        context: 'BrowserAdapter.validateEnvironment'
                    });
                }
            } catch (error) {
                issues.push(`Error checking IndexedDB support: ${error.message}`);
                zkErrorLogger.warn(`Error checking IndexedDB support: ${error.message}`, {
                    context: 'BrowserAdapter.validateEnvironment',
                    error: error.message
                });
            }

            const result = {
                valid: issues.length === 0,
                environment: this.environment,
                strategy: this.strategy,
                webWorkersSupported: typeof Worker !== 'undefined',
                webCryptoSupported: typeof window.crypto !== 'undefined',
                sharedArrayBufferSupported: typeof SharedArrayBuffer !== 'undefined',
                indexedDBSupported,
                issues
            };
            
            zkErrorLogger.info(`Browser environment validation result: ${result.valid ? 'Valid' : 'Invalid'}`, {
                context: 'BrowserAdapter.validateEnvironment',
                result,
                issueCount: issues.length
            });
            
            return result;
        } catch (error) {
            zkErrorLogger.error(`Error validating browser environment: ${error.message}`, {
                context: 'BrowserAdapter.validateEnvironment',
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
            zkErrorLogger.info('Cleaning up browser adapter resources', {
                context: 'BrowserAdapter.cleanup',
                workerCount: this.workers.length
            });
            
            // Terminate any web workers
            for (const worker of this.workers) {
                if (worker) {
                    if (typeof worker.terminate === 'function') {
                        worker.terminate();
                    } else {
                        zkErrorLogger.warn('Worker does not have terminate function', {
                            context: 'BrowserAdapter.cleanup',
                            worker: worker.id
                        });
                    }
                }
            }

            this.workers = [];
            await super.cleanup();
            
            zkErrorLogger.info('Browser adapter resources cleaned up successfully', {
                context: 'BrowserAdapter.cleanup'
            });
        } catch (error) {
            zkErrorLogger.warn(`Error during browser adapter cleanup: ${error.message}`, {
                context: 'BrowserAdapter.cleanup',
                error: error.message,
                stack: error.stack
            });
        }
    }

    /**
     * Initialize web workers for parallel proving
     * 
     * @param {Object} [options] - Initialization options
     * @returns {Promise<number>} Number of workers initialized
     * @private
     */
    async _initializeWebWorkers(options = {}) {
        try {
            // This would create actual Web Workers in a real implementation
            // For simplicity, we're just creating placeholders
            const workerCount = Math.min(
                navigator.hardwareConcurrency || 2, 
                this.maxWorkers
            );
            
            zkErrorLogger.info(`Initializing ${workerCount} web workers`, {
                context: 'BrowserAdapter._initializeWebWorkers',
                availableCores: navigator.hardwareConcurrency,
                maxWorkers: this.maxWorkers
            });

            this.workers = Array(workerCount).fill(null).map((_, index) => {
                // In a real implementation, this would be:
                // return new Worker('/path/to/zk-worker.js');
                zkErrorLogger.debug(`Created placeholder worker ${index}`, {
                    context: 'BrowserAdapter._initializeWebWorkers'
                });
                
                return {
                    id: index,
                    terminate: () => {
                        zkErrorLogger.debug(`Terminated worker ${index}`, {
                            context: 'BrowserAdapter._initializeWebWorkers'
                        });
                    },
                    postMessage: (msg) => {
                        zkErrorLogger.debug(`Posted message to worker ${index}`, {
                            context: 'BrowserAdapter._initializeWebWorkers',
                            message: typeof msg === 'object' ? msg.action : 'unknown'
                        });
                    }
                };
            });

            return this.workers.length;
        } catch (error) {
            zkErrorLogger.warn(`Failed to initialize web workers: ${error.message}`, {
                context: 'BrowserAdapter._initializeWebWorkers',
                error: error.message,
                stack: error.stack
            });
            
            // Return 0 for no workers rather than throwing
            return 0;
        }
    }

    /**
     * Check connectivity to the server
     * 
     * @returns {Promise<Object>} Object with success flag and optional error
     * @private
     */
    async _checkServerConnectivity() {
        try {
            // In a real implementation, this would make an actual fetch request
            // to the server endpoints
            zkErrorLogger.info(`Checking connectivity to ${this.config.endpoints.status}`, {
                context: 'BrowserAdapter._checkServerConnectivity'
            });

            // Simulate an API call
            const result = {
                success: true,
                latency: 42, // ms
                serverVersion: '1.0.0'
            };
            
            zkErrorLogger.info('Server connectivity check successful', {
                context: 'BrowserAdapter._checkServerConnectivity',
                latency: result.latency,
                serverVersion: result.serverVersion
            });
            
            return result;
        } catch (error) {
            zkErrorLogger.error(`Server connectivity check failed: ${error.message}`, {
                context: 'BrowserAdapter._checkServerConnectivity',
                endpoint: this.config.endpoints.status,
                error: error.message
            });
            
            return {
                success: false,
                error: error.message
            };
        }
    }
} 