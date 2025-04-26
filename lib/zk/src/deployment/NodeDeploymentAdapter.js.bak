/**
 * NodeDeploymentAdapter
 * 
 * Deployment adapter implementation for Node.js environments.
 * Handles deployment of ZK proofs in server-side Node.js applications.
 * 
 * @module deployment/NodeDeploymentAdapter
 */

import fs from 'fs';
import path from 'path';
import { BaseDeploymentAdapter } from './BaseDeploymentAdapter.js';
import { 
    DeploymentError, 
    ConfigurationError,
    DeploymentProcessError
} from './index.js';
import { zkErrorLogger } from '../zkErrorLogger.mjs';

/**
 * Node.js specific implementation of the deployment adapter.
 * Handles server-side operations in Node.js environments.
 */
export class NodeDeploymentAdapter extends BaseDeploymentAdapter {
    /**
     * Creates a new Node.js deployment adapter
     * 
     * @param {Object} config - Configuration options
     */
    constructor(config = {}) {
        super(config);

        // Set default Node.js specific settings if not provided
        if (!this.config.get('environment')) {
            this.config.set('environment', 'node');
        }

        this.deployments = [];
        this.outputDir = this.config.get('outputDir') || './zkp-deployments';
    }

    /**
     * Initializes the adapter
     * 
     * @returns {Promise<void>} Promise that resolves when initialization is complete
     * @throws {DeploymentProcessError} If initialization fails
     */
    async initialize() {
        try {
            // Ensure output directory exists
            if (!fs.existsSync(this.outputDir)) {
                fs.mkdirSync(this.outputDir, { recursive: true });
                zkErrorLogger.info(`Created output directory at ${this.outputDir}`, {
                    context: 'NodeDeploymentAdapter.initialize',
                    outputDir: this.outputDir
                });
            }

            // Load existing deployments
            try {
                const deploymentFilePath = path.join(this.outputDir, 'deployments.json');
                if (fs.existsSync(deploymentFilePath)) {
                    const data = fs.readFileSync(deploymentFilePath, 'utf8');
                    this.deployments = JSON.parse(data);
                    zkErrorLogger.info(`Loaded ${this.deployments.length} existing deployments`, {
                        context: 'NodeDeploymentAdapter.initialize',
                        deploymentFilePath
                    });
                }
            } catch (error) {
                zkErrorLogger.warn(`Failed to load existing deployments: ${error.message}`, {
                    context: 'NodeDeploymentAdapter.initialize',
                    outputDir: this.outputDir,
                    error: error.message
                });
                this.deployments = [];
            }

            this.isInitialized = true;
            return Promise.resolve();
        } catch (error) {
            const deploymentError = new DeploymentProcessError(
                `Failed to initialize Node.js adapter: ${error.message}`,
                {
                    details: {
                        originalError: error.message,
                        stack: error.stack,
                        outputDir: this.outputDir
                    }
                }
            );
            
            zkErrorLogger.logError(deploymentError, {
                context: 'NodeDeploymentAdapter.initialize'
            });
            
            throw deploymentError;
        }
    }

    /**
     * Deploys a ZK proof in a Node.js environment
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
            
            zkErrorLogger.info(`Starting Node.js deployment ${this.deployment.id}`, {
                context: 'NodeDeploymentAdapter.deploy',
                deploymentId: this.deployment.id,
                options
            });

            // Trigger beforeDeploy hooks
            await this._triggerHooks('beforeDeploy', this.deployment);

            // Prepare circuit
            this._reportProgress({ status: 'preparing', message: 'Preparing circuit files' });

            const circuitPath = this.config.get('circuitPath');
            if (!circuitPath || !fs.existsSync(circuitPath)) {
                throw new ConfigurationError(
                    `Circuit path not found: ${circuitPath}`,
                    {
                        details: {
                            circuitPath,
                            cwd: process.cwd(),
                            deploymentId: this.deployment.id
                        }
                    }
                );
            }

            // Load circuit
            this._reportProgress({ status: 'loading', message: 'Loading circuit' });
            zkErrorLogger.info(`Loading circuit from ${circuitPath}`, {
                context: 'NodeDeploymentAdapter.deploy',
                deploymentId: this.deployment.id,
                circuitPath
            });

            // Compile circuit (implementation would depend on specific ZK library)
            this._reportProgress({ status: 'compiling', message: 'Compiling circuit' });
            zkErrorLogger.info(`Compiling circuit for deployment ${this.deployment.id}`, {
                context: 'NodeDeploymentAdapter.deploy',
                deploymentId: this.deployment.id
            });

            // Generate keys
            this._reportProgress({ status: 'generating_keys', message: 'Generating proving and verification keys' });
            zkErrorLogger.info(`Generating keys for deployment ${this.deployment.id}`, {
                context: 'NodeDeploymentAdapter.deploy',
                deploymentId: this.deployment.id
            });

            // Mock deployment result for now (actual implementation would depend on ZK library)
            const deploymentResult = {
                provingKey: `proving_key_${this.deployment.id}`,
                verificationKey: `verification_key_${this.deployment.id}`,
                circuit: path.basename(circuitPath),
                timestamp: new Date().toISOString()
            };

            // Save deployment artifacts
            this._reportProgress({ status: 'saving', message: 'Saving deployment artifacts' });
            zkErrorLogger.info(`Saving deployment artifacts for ${this.deployment.id}`, {
                context: 'NodeDeploymentAdapter.deploy',
                deploymentId: this.deployment.id
            });

            try {
                // Create deployment directory
                const deploymentDir = path.join(this.outputDir, this.deployment.id);
                fs.mkdirSync(deploymentDir, { recursive: true });

                // Save metadata
                const metadataPath = path.join(deploymentDir, 'metadata.json');
                fs.writeFileSync(metadataPath, JSON.stringify({
                    config: this.config.toJSON(),
                    deployment: this.deployment,
                    result: deploymentResult
                }, null, 2));
                
                zkErrorLogger.info(`Saved deployment metadata to ${metadataPath}`, {
                    context: 'NodeDeploymentAdapter.deploy',
                    deploymentId: this.deployment.id
                });
            } catch (fsError) {
                throw new DeploymentProcessError(
                    `Failed to save deployment artifacts: ${fsError.message}`,
                    {
                        details: {
                            originalError: fsError.message,
                            stack: fsError.stack,
                            deploymentId: this.deployment.id,
                            outputDir: this.outputDir
                        }
                    }
                );
            }

            // Update deployment status
            this.deployment.status = 'completed';
            this.deployment.result = deploymentResult;

            // Add to deployments list
            this.deployments.push(this.deployment);

            // Save updated deployments list
            this._saveDeployments();
            
            zkErrorLogger.info(`Deployment ${this.deployment.id} completed successfully`, {
                context: 'NodeDeploymentAdapter.deploy',
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
                        `Node.js deployment failed: ${error.message}`,
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
                        context: 'NodeDeploymentAdapter.deploy',
                        deploymentId: this.deployment?.id
                    }
                );
            } else {
                zkErrorLogger.error(`Node.js deployment failed before initialization: ${error.message}`, {
                    context: 'NodeDeploymentAdapter.deploy',
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
     * Verifies a deployed proof
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
                context: 'NodeDeploymentAdapter.verify',
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

            // Mock verification for now (actual implementation would depend on ZK library)
            zkErrorLogger.info(`Performing verification for proof ${proof.id}`, {
                context: 'NodeDeploymentAdapter.verify',
                deploymentId,
                proofId: proof.id
            });
            
            // For the purpose of this implementation, we'll simulate a successful verification
            zkErrorLogger.info(`Verification successful for proof ${proof.id}`, {
                context: 'NodeDeploymentAdapter.verify',
                deploymentId,
                proofId: proof.id
            });
            
            return Promise.resolve(true);
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
                    context: 'NodeDeploymentAdapter.verify',
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
                    context: 'NodeDeploymentAdapter.getDeploymentStatus',
                    deploymentId,
                    availableDeployments: this.deployments.length
                });
            } else {
                zkErrorLogger.debug(`Retrieved deployment ${deploymentId}`, {
                    context: 'NodeDeploymentAdapter.getDeploymentStatus',
                    deploymentId,
                    status: deployment.status
                });
            }
            
            return Promise.resolve(deployment || null);
        } catch (error) {
            zkErrorLogger.warn(`Error retrieving deployment status: ${error.message}`, {
                context: 'NodeDeploymentAdapter.getDeploymentStatus',
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
                context: 'NodeDeploymentAdapter.listDeployments',
                totalDeployments: this.deployments.length,
                filteredDeployments: filtered.length,
                filters
            });
            
            return Promise.resolve(filtered);
        } catch (error) {
            zkErrorLogger.warn(`Error listing deployments: ${error.message}`, {
                context: 'NodeDeploymentAdapter.listDeployments',
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
            // For a more comprehensive implementation, we might clean up temp files
            // or release other resources here
            
            zkErrorLogger.info('Node.js deployment adapter cleaned up', {
                context: 'NodeDeploymentAdapter.cleanup'
            });
            
            return Promise.resolve();
        } catch (error) {
            zkErrorLogger.warn(`Error during cleanup: ${error.message}`, {
                context: 'NodeDeploymentAdapter.cleanup',
                error: error.message
            });
            return Promise.resolve();
        }
    }

    /**
     * Saves the deployments list to disk
     * 
     * @private
     */
    _saveDeployments() {
        try {
            const deploymentFilePath = path.join(this.outputDir, 'deployments.json');
            fs.writeFileSync(deploymentFilePath, JSON.stringify(this.deployments, null, 2));
            zkErrorLogger.debug(`Saved ${this.deployments.length} deployments to ${deploymentFilePath}`, {
                context: 'NodeDeploymentAdapter._saveDeployments',
                deploymentFilePath
            });
        } catch (error) {
            zkErrorLogger.warn(`Failed to save deployments to disk: ${error.message}`, {
                context: 'NodeDeploymentAdapter._saveDeployments',
                outputDir: this.outputDir,
                error: error.message
            });
        }
    }

    /**
     * Gets whether the adapter is compatible with the current environment
     * 
     * @returns {boolean} True if running in Node.js, false otherwise
     * @static
     */
    static isCompatible() {
        return typeof process !== 'undefined' &&
            process.versions &&
            process.versions.node;
    }
} 