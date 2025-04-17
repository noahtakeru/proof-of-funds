/**
 * BaseDeploymentAdapter
 * 
 * Abstract base class that all deployment adapters must extend.
 * Defines the interface and common functionality for deploying ZK proofs
 * across different environments.
 */

import { DeploymentConfig } from './DeploymentConfig.js';

export class BaseDeploymentAdapter {
    /**
     * Creates a new deployment adapter
     * 
     * @param {Object|DeploymentConfig} config - Configuration options or DeploymentConfig instance
     */
    constructor(config = {}) {
        if (this.constructor === BaseDeploymentAdapter) {
            throw new Error('BaseDeploymentAdapter is an abstract class and cannot be instantiated directly');
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
     */
    async initialize() {
        throw new Error('Method initialize() must be implemented by subclass');
    }

    /**
     * Deploys the ZK proof
     * Must be implemented by subclasses
     * 
     * @param {Object} options - Deployment options
     * @returns {Promise<Object>} Promise that resolves with deployment results
     */
    async deploy(options = {}) {
        throw new Error('Method deploy() must be implemented by subclass');
    }

    /**
     * Verifies a deployed proof
     * Must be implemented by subclasses
     * 
     * @param {Object} proof - The proof to verify
     * @param {Object} options - Verification options
     * @returns {Promise<boolean>} Promise that resolves with verification result
     */
    async verify(proof, options = {}) {
        throw new Error('Method verify() must be implemented by subclass');
    }

    /**
     * Validates the adapter configuration
     * 
     * @returns {Object} Validation result
     */
    validateConfig() {
        return this.config.validate();
    }

    /**
     * Gets the status of a deployment
     * 
     * @param {string} deploymentId - The deployment ID to check
     * @returns {Promise<Object>} Promise that resolves with deployment status
     */
    async getDeploymentStatus(deploymentId) {
        throw new Error('Method getDeploymentStatus() must be implemented by subclass');
    }

    /**
     * Lists all deployments
     * 
     * @param {Object} filters - Optional filters to apply
     * @returns {Promise<Array>} Promise that resolves with list of deployments
     */
    async listDeployments(filters = {}) {
        throw new Error('Method listDeployments() must be implemented by subclass');
    }

    /**
     * Cleans up resources used by the adapter
     * 
     * @returns {Promise<void>} Promise that resolves when cleanup is complete
     */
    async cleanup() {
        throw new Error('Method cleanup() must be implemented by subclass');
    }

    /**
     * Registers a hook function to be called at a specific lifecycle point
     * 
     * @param {string} hookName - Name of the hook (beforeDeploy, afterDeploy, onError, onProgress)
     * @param {Function} callback - Function to call
     * @returns {BaseDeploymentAdapter} This adapter instance for chaining
     */
    registerHook(hookName, callback) {
        if (!this._hooks[hookName]) {
            throw new Error(`Hook '${hookName}' is not supported`);
        }

        if (typeof callback !== 'function') {
            throw new Error('Hook callback must be a function');
        }

        this._hooks[hookName].push(callback);
        return this;
    }

    /**
     * Removes a hook function
     * 
     * @param {string} hookName - Name of the hook
     * @param {Function} callback - Function to remove
     * @returns {BaseDeploymentAdapter} This adapter instance for chaining
     */
    unregisterHook(hookName, callback) {
        if (!this._hooks[hookName]) {
            throw new Error(`Hook '${hookName}' is not supported`);
        }

        this._hooks[hookName] = this._hooks[hookName].filter(cb => cb !== callback);
        return this;
    }

    /**
     * Triggers hook functions for a specific lifecycle point
     * 
     * @param {string} hookName - Name of the hook to trigger
     * @param {*} data - Data to pass to hook functions
     * @returns {Promise<void>} Promise that resolves when all hooks have executed
     */
    async _triggerHooks(hookName, data) {
        if (!this._hooks[hookName]) {
            return;
        }

        for (const callback of this._hooks[hookName]) {
            await callback(data, this);
        }
    }

    /**
     * Creates a deployment object with metadata
     * 
     * @param {Object} options - Options for the deployment
     * @returns {Object} Deployment object
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
     * @returns {string} Unique ID
     */
    _generateId() {
        return `deploy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Reports progress for a deployment
     * 
     * @param {Object} progressData - Progress information
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
     */
    static isCompatible() {
        return false;
    }
} 