/**
 * AdapterFactory
 * 
 * Factory for creating deployment adapters based on the environment.
 * Provides a central point for adapter instantiation and management.
 * 
 * @module deployment/AdapterFactory
 */

import { BrowserAdapter } from './adapters/BrowserAdapter.js';
import { CloudAdapter } from './adapters/CloudAdapter.js';
import { NodeAdapter } from './adapters/NodeAdapter.js';
import { ConfigurationError, EnvironmentCompatibilityError } from './index.js';
import { zkErrorLogger } from '../zkErrorLogger.mjs';

/**
 * Factory class for creating and managing deployment adapters.
 * Provides environment detection and adapter instantiation.
 */
export class AdapterFactory {
    /**
     * Creates a new adapter factory
     */
    constructor() {
        this.adapterRegistry = new Map();
        this.defaultAdapters = {
            Browser: BrowserAdapter,
            Cloud: CloudAdapter,
            Node: NodeAdapter
        };

        // Register default adapters
        this._registerDefaultAdapters();
    }

    /**
     * Creates an adapter instance for the specified environment
     * 
     * @param {string} environment - The target environment (Browser, Cloud, Node)
     * @param {Object} options - Options for the adapter
     * @returns {DeploymentAdapter} The created adapter instance
     * @throws {EnvironmentCompatibilityError} If the environment is not supported
     */
    createAdapter(environment, options = {}) {
        try {
            const normalizedEnv = this._normalizeEnvironment(environment);

            // Auto-detect environment if not specified
            if (!normalizedEnv) {
                return this._createAdapterForCurrentEnvironment(options);
            }

            if (!this.adapterRegistry.has(normalizedEnv)) {
                throw new EnvironmentCompatibilityError(
                    `No adapter registered for environment: ${normalizedEnv}`,
                    {
                        details: {
                            requestedEnvironment: environment,
                            normalizedEnvironment: normalizedEnv,
                            availableEnvironments: this.listRegisteredAdapters()
                        }
                    }
                );
            }

            const AdapterClass = this.adapterRegistry.get(normalizedEnv);
            return new AdapterClass(options);
        } catch (error) {
            // If it's already our custom error type, just log and rethrow
            if (error instanceof EnvironmentCompatibilityError) {
                zkErrorLogger.logError(error, {
                    context: 'AdapterFactory.createAdapter',
                    environment,
                    options
                });
                throw error;
            }
            
            // Otherwise, wrap in our custom error
            const wrappedError = new EnvironmentCompatibilityError(
                `Failed to create adapter for environment '${environment}': ${error.message}`,
                {
                    details: {
                        originalError: error.message,
                        stack: error.stack,
                        environment,
                        options
                    }
                }
            );
            
            zkErrorLogger.logError(wrappedError, {
                context: 'AdapterFactory.createAdapter'
            });
            
            throw wrappedError;
        }
    }

    /**
     * Registers a custom adapter for an environment
     * 
     * @param {string} environment - The target environment
     * @param {class} AdapterClass - The adapter class to register
     * @returns {AdapterFactory} This factory instance for chaining
     * @throws {ConfigurationError} If the environment is not specified or invalid
     */
    registerAdapter(environment, AdapterClass) {
        try {
            const normalizedEnv = this._normalizeEnvironment(environment);

            if (!normalizedEnv) {
                throw new ConfigurationError(
                    'Environment name must be specified',
                    {
                        details: {
                            providedEnvironment: environment
                        }
                    }
                );
            }

            // Validate the adapter class
            if (!AdapterClass || typeof AdapterClass !== 'function') {
                throw new ConfigurationError(
                    'Invalid adapter class provided',
                    {
                        details: {
                            environment: normalizedEnv,
                            adapterType: typeof AdapterClass
                        }
                    }
                );
            }

            this.adapterRegistry.set(normalizedEnv, AdapterClass);
            return this;
        } catch (error) {
            // If it's already our custom error type, just log and rethrow
            if (error instanceof ConfigurationError) {
                zkErrorLogger.logError(error, {
                    context: 'AdapterFactory.registerAdapter',
                    environment,
                    adapterClass: AdapterClass?.name || 'Unknown'
                });
                throw error;
            }
            
            // Otherwise, wrap in our custom error
            const wrappedError = new ConfigurationError(
                `Failed to register adapter for '${environment}': ${error.message}`,
                {
                    details: {
                        originalError: error.message,
                        stack: error.stack,
                        environment,
                        adapterClass: AdapterClass?.name || 'Unknown'
                    }
                }
            );
            
            zkErrorLogger.logError(wrappedError, {
                context: 'AdapterFactory.registerAdapter'
            });
            
            throw wrappedError;
        }
    }

    /**
     * Unregisters an adapter for an environment
     * 
     * @param {string} environment - The environment to unregister
     * @returns {boolean} True if the adapter was unregistered, false otherwise
     */
    unregisterAdapter(environment) {
        const normalizedEnv = this._normalizeEnvironment(environment);

        if (!normalizedEnv) {
            zkErrorLogger.warn(`Cannot unregister adapter for invalid environment: ${environment}`, {
                context: 'AdapterFactory.unregisterAdapter'
            });
            return false;
        }

        const result = this.adapterRegistry.delete(normalizedEnv);
        
        if (!result) {
            zkErrorLogger.warn(`No adapter found to unregister for environment: ${normalizedEnv}`, {
                context: 'AdapterFactory.unregisterAdapter'
            });
        }
        
        return result;
    }

    /**
     * Lists all registered adapters
     * 
     * @returns {Array<string>} List of registered environment names
     */
    listRegisteredAdapters() {
        return Array.from(this.adapterRegistry.keys());
    }

    /**
     * Registers the default adapters
     * @private
     */
    _registerDefaultAdapters() {
        for (const [env, AdapterClass] of Object.entries(this.defaultAdapters)) {
            try {
                this.registerAdapter(env, AdapterClass);
            } catch (error) {
                zkErrorLogger.warn(`Failed to register default adapter for ${env}: ${error.message}`, {
                    context: 'AdapterFactory._registerDefaultAdapters',
                    environment: env,
                    adapterClass: AdapterClass?.name || 'Unknown'
                });
            }
        }
    }

    /**
     * Normalizes the environment name
     * 
     * @param {string} environment - The environment name to normalize
     * @returns {string|null} The normalized environment name
     * @private
     */
    _normalizeEnvironment(environment) {
        if (!environment) {
            return null;
        }

        const envStr = String(environment).toLowerCase();

        // Map common environment names to normalized names
        const envMap = {
            'browser': 'Browser',
            'web': 'Browser',
            'client': 'Browser',
            'cloud': 'Cloud',
            'server': 'Cloud',
            'serverless': 'Cloud',
            'node': 'Node',
            'nodejs': 'Node',
            'server-local': 'Node'
        };

        return envMap[envStr] ||
            Object.keys(this.defaultAdapters).find(key => key.toLowerCase() === envStr) ||
            null;
    }

    /**
     * Creates an adapter for the current detected environment
     * 
     * @param {Object} options - Options for the adapter
     * @returns {DeploymentAdapter} The created adapter
     * @private
     */
    _createAdapterForCurrentEnvironment(options) {
        try {
            // Detect current environment
            if (typeof window !== 'undefined' && typeof document !== 'undefined') {
                return this.createAdapter('Browser', options);
            } else if (typeof process !== 'undefined' && process.versions && process.versions.node) {
                // Check if we're in a serverless environment
                if (process.env.AWS_LAMBDA_FUNCTION_NAME ||
                    process.env.FUNCTION_NAME ||
                    process.env.AZURE_FUNCTIONS_ENVIRONMENT) {
                    return this.createAdapter('Cloud', options);
                }
                return this.createAdapter('Node', options);
            } else {
                // Default to Node adapter if environment cannot be determined
                zkErrorLogger.warn('Could not definitively determine environment, defaulting to Node', {
                    context: 'AdapterFactory._createAdapterForCurrentEnvironment'
                });
                return this.createAdapter('Node', options);
            }
        } catch (error) {
            const wrappedError = new EnvironmentCompatibilityError(
                `Failed to auto-detect environment: ${error.message}`,
                {
                    details: {
                        originalError: error.message,
                        stack: error.stack,
                        environmentInfo: {
                            hasWindow: typeof window !== 'undefined',
                            hasDocument: typeof document !== 'undefined',
                            hasProcess: typeof process !== 'undefined',
                            hasNodeVersions: typeof process !== 'undefined' && !!process.versions
                        }
                    }
                }
            );
            
            zkErrorLogger.logError(wrappedError, {
                context: 'AdapterFactory._createAdapterForCurrentEnvironment'
            });
            
            throw wrappedError;
        }
    }
} 