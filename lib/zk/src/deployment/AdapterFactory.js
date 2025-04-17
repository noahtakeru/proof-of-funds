/**
 * AdapterFactory
 * 
 * Factory for creating deployment adapters based on the environment.
 * Provides a central point for adapter instantiation and management.
 */

import { BrowserAdapter } from './adapters/BrowserAdapter.js';
import { CloudAdapter } from './adapters/CloudAdapter.js';
import { NodeAdapter } from './adapters/NodeAdapter.js';

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
     * @throws {Error} If the environment is not supported
     */
    createAdapter(environment, options = {}) {
        const normalizedEnv = this._normalizeEnvironment(environment);

        // Auto-detect environment if not specified
        if (!normalizedEnv) {
            return this._createAdapterForCurrentEnvironment(options);
        }

        if (!this.adapterRegistry.has(normalizedEnv)) {
            throw new Error(`No adapter registered for environment: ${normalizedEnv}`);
        }

        const AdapterClass = this.adapterRegistry.get(normalizedEnv);
        return new AdapterClass(options);
    }

    /**
     * Registers a custom adapter for an environment
     * 
     * @param {string} environment - The target environment
     * @param {class} AdapterClass - The adapter class to register
     * @returns {AdapterFactory} This factory instance for chaining
     */
    registerAdapter(environment, AdapterClass) {
        const normalizedEnv = this._normalizeEnvironment(environment);

        if (!normalizedEnv) {
            throw new Error('Environment name must be specified');
        }

        this.adapterRegistry.set(normalizedEnv, AdapterClass);
        return this;
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
            return false;
        }

        return this.adapterRegistry.delete(normalizedEnv);
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
            this.registerAdapter(env, AdapterClass);
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
            return this.createAdapter('Node', options);
        }
    }
} 