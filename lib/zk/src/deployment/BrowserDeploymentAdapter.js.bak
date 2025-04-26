/**
 * BrowserDeploymentAdapter
 * 
 * Deployment adapter implementation for web browser environments.
 * Handles deployment of ZK proofs in client-side web applications.
 * 
 * @module deployment/BrowserDeploymentAdapter
 */

import { BaseDeploymentAdapter } from './BaseDeploymentAdapter.js';
import { 
    DeploymentError, 
    ConfigurationError,
    DeploymentProcessError
} from './index.js';
import { zkErrorLogger } from '../zkErrorLogger.mjs';

/**
 * Browser-specific implementation of the deployment adapter.
 * Handles client-side operations in web browser environments.
 */
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
                zkErrorLogger.info(`Loaded ${this.deployments.length} existing deployments`, {
                    context: 'BrowserDeploymentAdapter.initialize',
                    storageKey: this.storageKey
                });
            }
        } catch (error) {
            zkErrorLogger.warn(`Failed to load existing deployments: ${error.message}`, {
                context: 'BrowserDeploymentAdapter.initialize',
                storageKey: this.storageKey,
                error: error.message
            });
            this.deployments = [];
        }

        // Initialize web worker for computation if path provided
        if (this.workerPath) {
            try {
                this.worker = new Worker(this.workerPath);
                zkErrorLogger.info(`Initialized web worker from ${this.workerPath}`, {
                    context: 'BrowserDeploymentAdapter.initialize'
                });
            } catch (error) {
                zkErrorLogger.warn(`Failed to initialize web worker: ${error.message}`, {
                    context: 'BrowserDeploymentAdapter.initialize',
                    workerPath: this.workerPath,
                    error: error.message
                });
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
     * @throws {ConfigurationError} If the configuration is invalid
     * @throws {DeploymentProcessError} If deployment fails
     */
    async deploy(options = {}) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            // Validate configuration
            const validation = this.validateConfig();
            if (!validation.isValid) {
                throw new ConfigurationError(
                    `Invalid configuration: ${validation.errors.join(', ')}`,
                    {
                        details: {
                            errors: validation.errors,
                            config: this.config.toJSON()
                        }
                    }
                );
            }

            // Create deployment object
            this.deployment = this._createDeploymentObject(options);
            
            zkErrorLogger.info(`Starting browser deployment ${this.deployment.id}`, {
                context: 'BrowserDeploymentAdapter.deploy',
                deploymentId: this.deployment.id,
                options
            });

            // Trigger beforeDeploy hooks
            await this._triggerHooks('beforeDeploy', this.deployment);

            this._reportProgress({ status: 'preparing', message: 'Preparing circuit' });

            // Check if circuit data is provided
            const circuitData = this.config.get('circuitData');
            if (!circuitData) {
                throw new ConfigurationError(
                    'Circuit data must be provided for browser deployment',
                    {
                        details: {
                            deploymentId: this.deployment.id,
                            missingField: 'circuitData'
                        }
                    }
                );
            }

            // Browser deployment decisions
            // 1. Use web worker for heavy computations if available
            // 2. Use IndexedDB for larger data storage if necessary
            // 3. Fall back to in-memory processing for simpler cases

            if (this.worker) {
                // Use web worker for computation-heavy tasks
                this._reportProgress({ status: 'delegating', message: 'Delegating computation to web worker' });
                zkErrorLogger.info(`Using web worker for deployment ${this.deployment.id}`, {
                    context: 'BrowserDeploymentAdapter.deploy',
                    deploymentId: this.deployment.id
                });

                // Set up a promise to handle the web worker response
                const workerPromise = new Promise((resolve, reject) => {
                    this.worker.onmessage = (event) => {
                        if (event.data.error) {
                            reject(new DeploymentProcessError(
                                `Worker error: ${event.data.error}`,
                                {
                                    details: {
                                        workerError: event.data.error,
                                        deploymentId: this.deployment.id
                                    }
                                }
                            ));
                        } else {
                            resolve(event.data);
                        }
                    };

                    this.worker.onerror = (error) => {
                        reject(new DeploymentProcessError(
                            `Web worker error: ${error.message || 'Unknown worker error'}`,
                            {
                                details: {
                                    workerError: error.message,
                                    deploymentId: this.deployment.id,
                                    lineno: error.lineno,
                                    filename: error.filename
                                }
                            }
                        ));
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
                zkErrorLogger.info(`Worker successfully completed deployment ${this.deployment.id}`, {
                    context: 'BrowserDeploymentAdapter.deploy',
                    deploymentId: this.deployment.id
                });
            } else {
                // Process in the main thread if no worker is available
                this._reportProgress({ status: 'processing', message: 'Processing in main thread' });
                zkErrorLogger.info(`Processing deployment ${this.deployment.id} in main thread`, {
                    context: 'BrowserDeploymentAdapter.deploy',
                    deploymentId: this.deployment.id
                });

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
            
            zkErrorLogger.info(`Deployment ${this.deployment.id} completed successfully`, {
                context: 'BrowserDeploymentAdapter.deploy',
                deploymentId: this.deployment.id,
                result: {
                    status: this.deployment.status,
                    timestamp: this.deployment.result.timestamp
                }
            });

            // Trigger afterDeploy hooks
            await this._triggerHooks('afterDeploy', this.deployment);

            return this.deployment;
        } catch (error) {
            // Handle deployment failure
            if (this.deployment) {
                this.deployment.status = 'failed';
                this.deployment.error = {
                    message: error.message,
                    code: error.code || 'UNKNOWN_ERROR',
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
                
                // Log the error
                zkErrorLogger.logError(
                    error instanceof DeploymentError ? error : new DeploymentProcessError(
                        `Browser deployment failed: ${error.message}`,
                        {
                            details: {
                                originalError: error.message,
                                stack: error.stack,
                                deploymentId: this.deployment.id,
                                options
                            }
                        }
                    ),
                    {
                        context: 'BrowserDeploymentAdapter.deploy',
                        deploymentId: this.deployment?.id
                    }
                );
            } else {
                zkErrorLogger.error(`Browser deployment failed before initialization: ${error.message}`, {
                    context: 'BrowserDeploymentAdapter.deploy',
                    error: error.message,
                    stack: error.stack,
                    options
                });
            }

            // Rethrow the error (already transformed to DeploymentError if needed)
            throw error instanceof DeploymentError ? error : new DeploymentProcessError(
                `Deployment failed: ${error.message}`,
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
     * Verifies a deployed proof in the browser
     * 
     * @param {Object} proof - The proof to verify
     * @param {Object} options - Verification options
     * @returns {Promise<boolean>} Promise that resolves with verification result
     * @throws {ConfigurationError} If required parameters are missing
     * @throws {DeploymentProcessError} If verification fails
     */
    async verify(proof, options = {}) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            // Get deployment ID from options or proof
            const deploymentId = options.deploymentId || proof.deploymentId;
            if (!deploymentId) {
                throw new ConfigurationError(
                    'Deployment ID must be provided in proof or options',
                    {
                        details: {
                            proof,
                            options
                        }
                    }
                );
            }

            zkErrorLogger.info(`Verifying proof for deployment ${deploymentId}`, {
                context: 'BrowserDeploymentAdapter.verify',
                deploymentId,
                proofId: proof.id,
                options
            });

            // Find deployment
            const deployment = await this.getDeploymentStatus(deploymentId);
            if (!deployment) {
                throw new ConfigurationError(
                    `Deployment not found: ${deploymentId}`,
                    {
                        details: {
                            deploymentId,
                            availableDeployments: this.deployments.map(d => d.id)
                        }
                    }
                );
            }

            if (deployment.status !== 'completed') {
                throw new ConfigurationError(
                    `Cannot verify proof for deployment with status: ${deployment.status}`,
                    {
                        details: {
                            deploymentId,
                            status: deployment.status,
                            expectedStatus: 'completed'
                        }
                    }
                );
            }

            // Verify in web worker if available
            if (this.worker) {
                zkErrorLogger.info(`Using web worker for verification of proof ${proof.id}`, {
                    context: 'BrowserDeploymentAdapter.verify',
                    deploymentId,
                    proofId: proof.id
                });
                
                const workerPromise = new Promise((resolve, reject) => {
                    this.worker.onmessage = (event) => {
                        if (event.data.error) {
                            reject(new DeploymentProcessError(
                                `Worker verification error: ${event.data.error}`,
                                {
                                    details: {
                                        workerError: event.data.error,
                                        deploymentId,
                                        proofId: proof.id
                                    }
                                }
                            ));
                        } else {
                            resolve(event.data.verified);
                        }
                    };

                    this.worker.onerror = (error) => {
                        reject(new DeploymentProcessError(
                            `Web worker error during verification: ${error.message || 'Unknown worker error'}`,
                            {
                                details: {
                                    workerError: error.message,
                                    deploymentId,
                                    proofId: proof.id,
                                    lineno: error.lineno,
                                    filename: error.filename
                                }
                            }
                        ));
                    };
                });

                this.worker.postMessage({
                    action: 'verify',
                    proof,
                    deployment
                });

                const result = await workerPromise;
                zkErrorLogger.info(`Verification result for proof ${proof.id}: ${result}`, {
                    context: 'BrowserDeploymentAdapter.verify',
                    deploymentId,
                    proofId: proof.id,
                    verified: result
                });
                return result;
            }

            // Mock verification for now (actual implementation would depend on ZK library)
            // For simulation, we'll consider all proofs valid
            zkErrorLogger.info(`Using main thread for verification of proof ${proof.id}`, {
                context: 'BrowserDeploymentAdapter.verify',
                deploymentId,
                proofId: proof.id
            });
            
            // Simulate verification delay
            await this._simulateDelay(500);
            
            zkErrorLogger.info(`Verification successful for proof ${proof.id}`, {
                context: 'BrowserDeploymentAdapter.verify',
                deploymentId,
                proofId: proof.id
            });
            return true;
        } catch (error) {
            // Log the error
            zkErrorLogger.logError(
                error instanceof DeploymentError ? error : new DeploymentProcessError(
                    `Verification failed: ${error.message}`,
                    {
                        details: {
                            originalError: error.message,
                            stack: error.stack,
                            proofId: proof.id,
                            deploymentId: options.deploymentId || proof.deploymentId,
                            options
                        }
                    }
                ),
                {
                    context: 'BrowserDeploymentAdapter.verify',
                    proofId: proof.id
                }
            );

            // Rethrow the error
            throw error instanceof DeploymentError ? error : new DeploymentProcessError(
                `Verification failed: ${error.message}`,
                {
                    details: {
                        originalError: error.message,
                        stack: error.stack,
                        proofId: proof.id,
                        options
                    }
                }
            );
        }
    }

    /**
     * Gets the status of a deployment
     * 
     * @param {string} deploymentId - The deployment ID to check
     * @returns {Promise<Object>} Promise that resolves with deployment status
     */
    async getDeploymentStatus(deploymentId) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            const deployment = this.deployments.find(d => d.id === deploymentId);
            
            if (!deployment) {
                zkErrorLogger.info(`No deployment found with ID ${deploymentId}`, {
                    context: 'BrowserDeploymentAdapter.getDeploymentStatus',
                    deploymentId,
                    availableDeployments: this.deployments.length
                });
            } else {
                zkErrorLogger.debug(`Retrieved deployment ${deploymentId}`, {
                    context: 'BrowserDeploymentAdapter.getDeploymentStatus',
                    deploymentId,
                    status: deployment.status
                });
            }
            
            return Promise.resolve(deployment || null);
        } catch (error) {
            zkErrorLogger.warn(`Error retrieving deployment status: ${error.message}`, {
                context: 'BrowserDeploymentAdapter.getDeploymentStatus',
                deploymentId,
                error: error.message
            });
            return Promise.resolve(null);
        }
    }

    /**
     * Lists all deployments
     * 
     * @param {Object} filters - Optional filters to apply
     * @returns {Promise<Array>} Promise that resolves with list of deployments
     */
    async listDeployments(filters = {}) {
        try {
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

            zkErrorLogger.debug(`Listed ${filtered.length} deployments of ${this.deployments.length} total`, {
                context: 'BrowserDeploymentAdapter.listDeployments',
                totalDeployments: this.deployments.length,
                filteredDeployments: filtered.length,
                filters
            });
            
            return Promise.resolve(filtered);
        } catch (error) {
            zkErrorLogger.warn(`Error listing deployments: ${error.message}`, {
                context: 'BrowserDeploymentAdapter.listDeployments',
                error: error.message,
                filters
            });
            return Promise.resolve([]);
        }
    }

    /**
     * Cleans up resources used by the adapter
     * 
     * @returns {Promise<void>} Promise that resolves when cleanup is complete
     */
    async cleanup() {
        try {
            // Terminate worker if it exists
            if (this.worker) {
                this.worker.terminate();
                this.worker = null;
                zkErrorLogger.info('Web worker terminated', {
                    context: 'BrowserDeploymentAdapter.cleanup'
                });
            }

            zkErrorLogger.info('Browser deployment adapter cleaned up', {
                context: 'BrowserDeploymentAdapter.cleanup'
            });
            
            return Promise.resolve();
        } catch (error) {
            zkErrorLogger.warn(`Error during cleanup: ${error.message}`, {
                context: 'BrowserDeploymentAdapter.cleanup',
                error: error.message
            });
            return Promise.resolve();
        }
    }

    /**
     * Saves the deployments list to localStorage
     * 
     * @private
     */
    _saveDeployments() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.deployments));
            zkErrorLogger.debug(`Saved ${this.deployments.length} deployments to localStorage`, {
                context: 'BrowserDeploymentAdapter._saveDeployments',
                storageKey: this.storageKey
            });
        } catch (error) {
            zkErrorLogger.warn(`Failed to save deployments to localStorage: ${error.message}`, {
                context: 'BrowserDeploymentAdapter._saveDeployments',
                storageKey: this.storageKey,
                deploymentCount: this.deployments.length,
                error: error.message
            });
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
     * @static
     */
    static isCompatible() {
        return typeof window !== 'undefined' &&
            typeof document !== 'undefined' &&
            typeof localStorage !== 'undefined';
    }
} 