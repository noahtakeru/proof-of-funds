/**
 * BaseDeploymentAdapter
 * 
 * Abstract base class that all deployment adapters must extend.
 * Defines the interface and common functionality for deploying ZK proofs
 * across different environments.
 * 
 * @module deployment/BaseDeploymentAdapter
 */

import { DeploymentConfig } from './DeploymentConfig.js';
import { 
    DeploymentError, 
    ConfigurationError,
    EnvironmentCompatibilityError,
    DeploymentProcessError
} from './index.js';
import { zkErrorLogger } from '../zkErrorLogger.mjs';

/**
 * Abstract base class for deployment adapters.
 * Provides common functionality and enforces an interface for adapter implementations.
 * 
 * @abstract
 */
export class BaseDeploymentAdapter {
    /**
     * Creates a new deployment adapter
     * 
     * @param {Object|DeploymentConfig} config - Configuration options or DeploymentConfig instance
     * @throws {ConfigurationError} If instantiated directly
     */
    constructor(config = {}) {
        if (this.constructor === BaseDeploymentAdapter) {
            throw new ConfigurationError(
                'BaseDeploymentAdapter is an abstract class and cannot be instantiated directly',
                {
                    details: {
                        usedConstructor: this.constructor.name
                    }
                }
            );
        }

        // Convert plain config object to DeploymentConfig if needed
        this.config = config instanceof DeploymentConfig
            ? config
            : new DeploymentConfig(config);

        this.isInitialized = false;
        this.deployment = null;
        this._hooks = {
            beforeDeploy: [],
            afterDeploy: [],
            onError: [],
            onProgress: []
        };
    }

    /**
     * Initializes the adapter
     * Must be implemented by subclasses
     * 
     * @returns {Promise<void>} Promise that resolves when initialization is complete
     * @throws {DeploymentError} If not implemented by subclass
     */
    async initialize() {
        throw new DeploymentError(
            'Method initialize() must be implemented by subclass',
            {
                code: 'METHOD_NOT_IMPLEMENTED',
                details: {
                    method: 'initialize',
                    className: this.constructor.name
                }
            }
        );
    }

    /**
     * Deploys the ZK proof
     * Must be implemented by subclasses
     * 
     * @param {Object} options - Deployment options
     * @returns {Promise<Object>} Promise that resolves with deployment results
     * @throws {DeploymentError} If not implemented by subclass
     */
    async deploy(options = {}) {
        throw new DeploymentError(
            'Method deploy() must be implemented by subclass',
            {
                code: 'METHOD_NOT_IMPLEMENTED',
                details: {
                    method: 'deploy',
                    className: this.constructor.name,
                    options
                }
            }
        );
    }

    /**
     * Verifies a deployed proof
     * Must be implemented by subclasses
     * 
     * @param {Object} proof - The proof to verify
     * @param {Object} options - Verification options
     * @returns {Promise<boolean>} Promise that resolves with verification result
     * @throws {DeploymentError} If not implemented by subclass
     */
    async verify(proof, options = {}) {
        throw new DeploymentError(
            'Method verify() must be implemented by subclass',
            {
                code: 'METHOD_NOT_IMPLEMENTED',
                details: {
                    method: 'verify',
                    className: this.constructor.name,
                    proofId: proof?.id,
                    options
                }
            }
        );
    }

    /**
     * Validates the adapter configuration
     * 
     * @returns {Object} Validation result with isValid flag and optional errors array
     */
    validateConfig() {
        try {
            return this.config.validate();
        } catch (error) {
            zkErrorLogger.warn(`Configuration validation error: ${error.message}`, {
                context: 'BaseDeploymentAdapter.validateConfig',
                adapterClass: this.constructor.name
            });
            
            return {
                isValid: false,
                errors: [error.message]
            };
        }
    }

    /**
     * Gets the status of a deployment
     * Must be implemented by subclasses
     * 
     * @param {string} deploymentId - The deployment ID to check
     * @returns {Promise<Object>} Promise that resolves with deployment status
     * @throws {DeploymentError} If not implemented by subclass
     */
    async getDeploymentStatus(deploymentId) {
        throw new DeploymentError(
            'Method getDeploymentStatus() must be implemented by subclass',
            {
                code: 'METHOD_NOT_IMPLEMENTED',
                details: {
                    method: 'getDeploymentStatus',
                    className: this.constructor.name,
                    deploymentId
                }
            }
        );
    }

    /**
     * Lists all deployments
     * Must be implemented by subclasses
     * 
     * @param {Object} filters - Optional filters to apply
     * @returns {Promise<Array>} Promise that resolves with list of deployments
     * @throws {DeploymentError} If not implemented by subclass
     */
    async listDeployments(filters = {}) {
        throw new DeploymentError(
            'Method listDeployments() must be implemented by subclass',
            {
                code: 'METHOD_NOT_IMPLEMENTED',
                details: {
                    method: 'listDeployments',
                    className: this.constructor.name,
                    filters
                }
            }
        );
    }

    /**
     * Cleans up resources used by the adapter
     * Must be implemented by subclasses
     * 
     * @returns {Promise<void>} Promise that resolves when cleanup is complete
     * @throws {DeploymentError} If not implemented by subclass
     */
    async cleanup() {
        throw new DeploymentError(
            'Method cleanup() must be implemented by subclass',
            {
                code: 'METHOD_NOT_IMPLEMENTED',
                details: {
                    method: 'cleanup',
                    className: this.constructor.name
                }
            }
        );
    }

    /**
     * Registers a hook function to be called at a specific lifecycle point
     * 
     * @param {string} hookName - Name of the hook (beforeDeploy, afterDeploy, onError, onProgress)
     * @param {Function} callback - Function to call
     * @returns {BaseDeploymentAdapter} This adapter instance for chaining
     * @throws {ConfigurationError} If hook name is invalid or callback is not a function
     */
    registerHook(hookName, callback) {
        try {
            if (!this._hooks[hookName]) {
                throw new ConfigurationError(`Hook '${hookName}' is not supported`, {
                    details: {
                        hookName,
                        supportedHooks: Object.keys(this._hooks)
                    }
                });
            }

            if (typeof callback !== 'function') {
                throw new ConfigurationError('Hook callback must be a function', {
                    details: {
                        hookName,
                        callbackType: typeof callback
                    }
                });
            }

            this._hooks[hookName].push(callback);
            return this;
        } catch (error) {
            // If it's already our custom error type, just log and rethrow
            if (error instanceof ConfigurationError) {
                zkErrorLogger.logError(error, {
                    context: 'BaseDeploymentAdapter.registerHook',
                    adapterClass: this.constructor.name,
                    hookName
                });
                throw error;
            }
            
            // Otherwise, wrap in our custom error
            const wrappedError = new ConfigurationError(
                `Failed to register hook '${hookName}': ${error.message}`,
                {
                    details: {
                        originalError: error.message,
                        stack: error.stack,
                        hookName,
                        callback: callback?.name || 'anonymous'
                    }
                }
            );
            
            zkErrorLogger.logError(wrappedError, {
                context: 'BaseDeploymentAdapter.registerHook'
            });
            
            throw wrappedError;
        }
    }

    /**
     * Removes a hook function
     * 
     * @param {string} hookName - Name of the hook
     * @param {Function} callback - Function to remove
     * @returns {BaseDeploymentAdapter} This adapter instance for chaining
     * @throws {ConfigurationError} If hook name is invalid
     */
    unregisterHook(hookName, callback) {
        try {
            if (!this._hooks[hookName]) {
                throw new ConfigurationError(`Hook '${hookName}' is not supported`, {
                    details: {
                        hookName,
                        supportedHooks: Object.keys(this._hooks)
                    }
                });
            }

            this._hooks[hookName] = this._hooks[hookName].filter(cb => cb !== callback);
            return this;
        } catch (error) {
            // If it's already our custom error type, just log and rethrow
            if (error instanceof ConfigurationError) {
                zkErrorLogger.logError(error, {
                    context: 'BaseDeploymentAdapter.unregisterHook',
                    adapterClass: this.constructor.name,
                    hookName
                });
                throw error;
            }
            
            // Otherwise, wrap in our custom error
            const wrappedError = new ConfigurationError(
                `Failed to unregister hook '${hookName}': ${error.message}`,
                {
                    details: {
                        originalError: error.message,
                        stack: error.stack,
                        hookName,
                        callback: callback?.name || 'anonymous'
                    }
                }
            );
            
            zkErrorLogger.logError(wrappedError, {
                context: 'BaseDeploymentAdapter.unregisterHook'
            });
            
            throw wrappedError;
        }
    }

    /**
     * Triggers hook functions for a specific lifecycle point
     * 
     * @param {string} hookName - Name of the hook to trigger
     * @param {*} data - Data to pass to hook functions
     * @returns {Promise<void>} Promise that resolves when all hooks have executed
     * @private
     */
    async _triggerHooks(hookName, data) {
        if (!this._hooks[hookName]) {
            zkErrorLogger.warn(`Attempted to trigger unknown hook: ${hookName}`, {
                context: 'BaseDeploymentAdapter._triggerHooks',
                adapterClass: this.constructor.name
            });
            return;
        }

        try {
            for (const callback of this._hooks[hookName]) {
                await callback(data, this);
            }
        } catch (error) {
            zkErrorLogger.error(`Error in ${hookName} hook: ${error.message}`, {
                context: 'BaseDeploymentAdapter._triggerHooks',
                adapterClass: this.constructor.name,
                hookName,
                error: error.message,
                errorStack: error.stack
            });
            
            // Don't throw the error to avoid disrupting the deployment process
            // but make sure it's properly logged
        }
    }

    /**
     * Creates a deployment object with metadata
     * 
     * @param {Object} options - Options for the deployment
     * @returns {Object} Deployment object with id, timestamp, status and other metadata
     * @private
     */
    _createDeploymentObject(options) {
        return {
            id: this._generateId(),
            timestamp: new Date().toISOString(),
            status: 'pending',
            environment: this.config.get('environment'),
            options: { ...options },
            metadata: {},
            result: null,
            error: null
        };
    }

    /**
     * Generates a unique deployment ID
     * 
     * @returns {string} Unique ID in the format deploy_[timestamp]_[random]
     * @private
     */
    _generateId() {
        return `deploy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Reports progress for a deployment
     * 
     * @param {Object} progressData - Progress information including status and message
     * @private
     */
    _reportProgress(progressData) {
        const data = {
            timestamp: new Date().toISOString(),
            deploymentId: this.deployment?.id,
            ...progressData
        };

        this._triggerHooks('onProgress', data);
    }

    /**
     * Gets whether the adapter is compatible with the current environment
     * Should be implemented by subclasses
     * 
     * @returns {boolean} True if compatible, false otherwise
     * @static
     */
    static isCompatible() {
        return false;
    }
} 