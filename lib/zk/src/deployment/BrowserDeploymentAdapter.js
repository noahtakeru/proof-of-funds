/**
 * BrowserDeploymentAdapter
 * 
 * Deployment adapter implementation for web browser environments.
 * Handles deployment of ZK proofs in client-side web applications.
 */

import { BaseDeploymentAdapter } from './BaseDeploymentAdapter.js';

export class BrowserDeploymentAdapter extends BaseDeploymentAdapter {
    /**
     * Creates a new Browser deployment adapter
     * 
     * @param {Object} config - Configuration options
     */
    constructor(config = {}) {
        super(config);

        // Set default browser specific settings if not provided
        if (!this.config.get('environment')) {
            this.config.set('environment', 'browser');
        }

        this.deployments = [];
        this.storageKey = this.config.get('storageKey') || 'zkp-deployments';
        this.workerPath = this.config.get('workerPath') || null;
        this.worker = null;
    }

    /**
     * Initializes the adapter
     * 
     * @returns {Promise<void>} Promise that resolves when initialization is complete
     */
    async initialize() {
        // Load existing deployments
        try {
            const storedData = localStorage.getItem(this.storageKey);
            if (storedData) {
                this.deployments = JSON.parse(storedData);
            }
        } catch (error) {
            console.warn('Failed to load existing deployments:', error.message);
            this.deployments = [];
        }

        // Initialize web worker for computation if path provided
        if (this.workerPath) {
            try {
                this.worker = new Worker(this.workerPath);
            } catch (error) {
                console.warn('Failed to initialize web worker:', error.message);
            }
        }

        this.isInitialized = true;
        return Promise.resolve();
    }

    /**
     * Deploys a ZK proof in a browser environment
     * 
     * @param {Object} options - Deployment options
     * @returns {Promise<Object>} Promise that resolves with deployment results
     */
    async deploy(options = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        // Validate configuration
        const validation = this.validateConfig();
        if (!validation.isValid) {
            throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
        }

        // Create deployment object
        this.deployment = this._createDeploymentObject(options);

        try {
            // Trigger beforeDeploy hooks
            await this._triggerHooks('beforeDeploy', this.deployment);

            this._reportProgress({ status: 'preparing', message: 'Preparing circuit' });

            // Check if circuit data is provided
            const circuitData = this.config.get('circuitData');
            if (!circuitData) {
                throw new Error('Circuit data must be provided for browser deployment');
            }

            // Browser deployment decisions
            // 1. Use web worker for heavy computations if available
            // 2. Use IndexedDB for larger data storage if necessary
            // 3. Fall back to in-memory processing for simpler cases

            if (this.worker) {
                // Use web worker for computation-heavy tasks
                this._reportProgress({ status: 'delegating', message: 'Delegating computation to web worker' });

                // Set up a promise to handle the web worker response
                const workerPromise = new Promise((resolve, reject) => {
                    this.worker.onmessage = (event) => {
                        if (event.data.error) {
                            reject(new Error(event.data.error));
                        } else {
                            resolve(event.data);
                        }
                    };

                    this.worker.onerror = (error) => {
                        reject(new Error('Web worker error: ' + error.message));
                    };
                });

                // Send message to worker with deployment data
                this.worker.postMessage({
                    action: 'deploy',
                    circuit: circuitData,
                    config: this.config.toJSON(),
                    deployment: this.deployment
                });

                // Wait for worker response
                const workerResult = await workerPromise;
                this.deployment.result = workerResult;
            } else {
                // Process in the main thread if no worker is available
                this._reportProgress({ status: 'processing', message: 'Processing in main thread' });

                // These would be implemented using the appropriate ZK library
                // All these are mock implementations
                this._reportProgress({ status: 'compiling', message: 'Compiling circuit' });
                await this._simulateDelay(1000);

                this._reportProgress({ status: 'generating_keys', message: 'Generating proving and verification keys' });
                await this._simulateDelay(1000);

                // Mock deployment result for now
                this.deployment.result = {
                    provingKey: `proving_key_${this.deployment.id}`,
                    verificationKey: `verification_key_${this.deployment.id}`,
                    circuit: 'browser_circuit',
                    timestamp: new Date().toISOString()
                };
            }

            // Update deployment status
            this.deployment.status = 'completed';

            // Add to deployments list
            this.deployments.push(this.deployment);

            // Save updated deployments list
            this._saveDeployments();

            // Trigger afterDeploy hooks
            await this._triggerHooks('afterDeploy', this.deployment);

            return this.deployment;
        } catch (error) {
            this.deployment.status = 'failed';
            this.deployment.error = {
                message: error.message,
                stack: error.stack
            };

            // Add to deployments list even if failed
            this.deployments.push(this.deployment);
            this._saveDeployments();

            // Trigger onError hooks
            await this._triggerHooks('onError', {
                deployment: this.deployment,
                error
            });

            throw error;
        }
    }

    /**
     * Verifies a deployed proof in the browser
     * 
     * @param {Object} proof - The proof to verify
     * @param {Object} options - Verification options
     * @returns {Promise<boolean>} Promise that resolves with verification result
     */
    async verify(proof, options = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        // Get deployment ID from options or proof
        const deploymentId = options.deploymentId || proof.deploymentId;
        if (!deploymentId) {
            throw new Error('Deployment ID must be provided in proof or options');
        }

        // Find deployment
        const deployment = await this.getDeploymentStatus(deploymentId);
        if (!deployment) {
            throw new Error(`Deployment not found: ${deploymentId}`);
        }

        if (deployment.status !== 'completed') {
            throw new Error(`Cannot verify proof for deployment with status: ${deployment.status}`);
        }

        // Verify in web worker if available
        if (this.worker) {
            const workerPromise = new Promise((resolve, reject) => {
                this.worker.onmessage = (event) => {
                    if (event.data.error) {
                        reject(new Error(event.data.error));
                    } else {
                        resolve(event.data.verified);
                    }
                };

                this.worker.onerror = (error) => {
                    reject(new Error('Web worker error: ' + error.message));
                };
            });

            this.worker.postMessage({
                action: 'verify',
                proof,
                deployment
            });

            return workerPromise;
        }

        // Mock verification for now (actual implementation would depend on ZK library)
        return Promise.resolve(true);
    }

    /**
     * Gets the status of a deployment
     * 
     * @param {string} deploymentId - The deployment ID to check
     * @returns {Promise<Object>} Promise that resolves with deployment status
     */
    async getDeploymentStatus(deploymentId) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const deployment = this.deployments.find(d => d.id === deploymentId);
        return Promise.resolve(deployment || null);
    }

    /**
     * Lists all deployments
     * 
     * @param {Object} filters - Optional filters to apply
     * @returns {Promise<Array>} Promise that resolves with list of deployments
     */
    async listDeployments(filters = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        let filtered = [...this.deployments];

        // Apply status filter
        if (filters.status) {
            filtered = filtered.filter(d => d.status === filters.status);
        }

        // Apply date range filter
        if (filters.from || filters.to) {
            filtered = filtered.filter(d => {
                const timestamp = new Date(d.timestamp).getTime();
                if (filters.from && timestamp < new Date(filters.from).getTime()) {
                    return false;
                }
                if (filters.to && timestamp > new Date(filters.to).getTime()) {
                    return false;
                }
                return true;
            });
        }

        return Promise.resolve(filtered);
    }

    /**
     * Cleans up resources used by the adapter
     * 
     * @returns {Promise<void>} Promise that resolves when cleanup is complete
     */
    async cleanup() {
        // Terminate worker if it exists
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }

        return Promise.resolve();
    }

    /**
     * Saves the deployments list to localStorage
     * 
     * @private
     */
    _saveDeployments() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.deployments));
        } catch (error) {
            console.warn('Failed to save deployments to localStorage:', error.message);
        }
    }

    /**
     * Utility method to simulate delay for async operations
     * 
     * @private
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise<void>} Promise that resolves after the delay
     */
    _simulateDelay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Gets whether the adapter is compatible with the current environment
     * 
     * @returns {boolean} True if running in a browser, false otherwise
     */
    static isCompatible() {
        return typeof window !== 'undefined' &&
            typeof document !== 'undefined' &&
            typeof localStorage !== 'undefined';
    }
} 