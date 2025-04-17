/**
 * NodeDeploymentAdapter
 * 
 * Deployment adapter implementation for Node.js environments.
 * Handles deployment of ZK proofs in server-side Node.js applications.
 */

import fs from 'fs';
import path from 'path';
import { BaseDeploymentAdapter } from './BaseDeploymentAdapter.js';

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
     */
    async initialize() {
        // Ensure output directory exists
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }

        // Load existing deployments
        try {
            const deploymentFilePath = path.join(this.outputDir, 'deployments.json');
            if (fs.existsSync(deploymentFilePath)) {
                const data = fs.readFileSync(deploymentFilePath, 'utf8');
                this.deployments = JSON.parse(data);
            }
        } catch (error) {
            console.warn('Failed to load existing deployments:', error.message);
            this.deployments = [];
        }

        this.isInitialized = true;
        return Promise.resolve();
    }

    /**
     * Deploys a ZK proof in a Node.js environment
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

            // Prepare circuit
            this._reportProgress({ status: 'preparing', message: 'Preparing circuit files' });

            const circuitPath = this.config.get('circuitPath');
            if (!circuitPath || !fs.existsSync(circuitPath)) {
                throw new Error(`Circuit path not found: ${circuitPath}`);
            }

            // Load circuit
            this._reportProgress({ status: 'loading', message: 'Loading circuit' });

            // Compile circuit (implementation would depend on specific ZK library)
            this._reportProgress({ status: 'compiling', message: 'Compiling circuit' });

            // Generate keys
            this._reportProgress({ status: 'generating_keys', message: 'Generating proving and verification keys' });

            // Mock deployment result for now (actual implementation would depend on ZK library)
            const deploymentResult = {
                provingKey: `proving_key_${this.deployment.id}`,
                verificationKey: `verification_key_${this.deployment.id}`,
                circuit: path.basename(circuitPath),
                timestamp: new Date().toISOString()
            };

            // Save deployment artifacts
            this._reportProgress({ status: 'saving', message: 'Saving deployment artifacts' });

            // Mock saving of files
            const deploymentDir = path.join(this.outputDir, this.deployment.id);
            fs.mkdirSync(deploymentDir, { recursive: true });

            // Save metadata
            const metadataPath = path.join(deploymentDir, 'metadata.json');
            fs.writeFileSync(metadataPath, JSON.stringify({
                config: this.config.toJSON(),
                deployment: this.deployment,
                result: deploymentResult
            }, null, 2));

            // Update deployment status
            this.deployment.status = 'completed';
            this.deployment.result = deploymentResult;

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
     * Verifies a deployed proof
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
        // No cleanup needed for basic Node.js adapter
        return Promise.resolve();
    }

    /**
     * Saves the deployments list to disk
     * 
     * @private
     */
    _saveDeployments() {
        const deploymentFilePath = path.join(this.outputDir, 'deployments.json');
        fs.writeFileSync(deploymentFilePath, JSON.stringify(this.deployments, null, 2));
    }

    /**
     * Gets whether the adapter is compatible with the current environment
     * 
     * @returns {boolean} True if running in Node.js, false otherwise
     */
    static isCompatible() {
        return typeof process !== 'undefined' &&
            process.versions &&
            process.versions.node;
    }
} 