/**
 * GCP Secret Manager integration for secure key storage
 * 
 * Provides a wrapper around the Google Cloud Secret Manager service
 * with support for local fallback in development environments.
 * 
 * Features:
 * - Secure storage of cryptographic keys and secrets
 * - Local fallback for development and testing
 * - Comprehensive error handling with detailed logging
 * - Version management for secrets
 */

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { ZKErrorLogger, createZKError } from './zkErrorHandler.js';
import fs from 'fs';
import path from 'path';

export class GCPSecretManager {
    /**
     * Create GCP Secret Manager client
     * @param {Object} config - Configuration options
     * @param {string} config.projectId - GCP project ID
     * @param {string} config.location - GCP location/region
     * @param {boolean} config.fallbackToLocal - Whether to use local fallback if GCP unavailable
     * @param {string} config.localFallbackDir - Directory for local fallback storage
     * @param {Object} config.keyFileJson - Service account key file (JSON object)
     */
    constructor(config) {
        this.config = config;
        this.projectId = config.projectId;
        this.location = config.location || 'global';
        this.fallbackToLocal = config.fallbackToLocal || false;
        this.localFallbackDir = config.localFallbackDir || path.join(process.cwd(), '.secret-fallback');
        this.isInitialized = false;
        this.client = null;
        this.operationId = Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    /**
     * Initialize the Secret Manager client
     * @returns {Promise<boolean>} Success status
     */
    async initialize() {
        try {
            // Create client with proper authentication
            const clientConfig = {};

            if (this.config.keyFileJson) {
                clientConfig.credentials = this.config.keyFileJson;
            }

            this.client = new SecretManagerServiceClient(clientConfig);

            // Verify we can access the API
            await this.client.listSecrets({
                parent: `projects/${this.projectId}`
            });

            this.isInitialized = true;
            return true;
        } catch (error) {
            // Handle initialization error
            ZKErrorLogger.logError(createZKError(
                'SEC-GCP-001',
                `Failed to initialize GCP Secret Manager: ${error.message}`,
                {
                    severity: 'ERROR',
                    details: {
                        error: error.message,
                        projectId: this.projectId,
                        operationId: this.operationId
                    }
                }
            ));

            // Set up local fallback if enabled
            if (this.fallbackToLocal) {
                this.setupLocalFallback();
            }

            return false;
        }
    }

    /**
     * Set up local fallback storage
     */
    setupLocalFallback() {
        try {
            if (!fs.existsSync(this.localFallbackDir)) {
                fs.mkdirSync(this.localFallbackDir, { recursive: true });
            }

            // Add .gitignore to prevent accidental commit of secrets
            const gitignorePath = path.join(this.localFallbackDir, '.gitignore');
            if (!fs.existsSync(gitignorePath)) {
                fs.writeFileSync(gitignorePath, '*\n!.gitignore\n');
            }

            // Create a README to warn users
            const readmePath = path.join(this.localFallbackDir, 'README.md');
            if (!fs.existsSync(readmePath)) {
                fs.writeFileSync(readmePath, '# Secret Fallback Storage\n\nWARNING: This directory contains sensitive data. Do not commit to version control.\n');
            }
        } catch (error) {
            ZKErrorLogger.logError(createZKError(
                'SEC-GCP-002',
                `Failed to set up local fallback: ${error.message}`,
                {
                    severity: 'ERROR',
                    details: { error: error.message, operationId: this.operationId }
                }
            ));
        }
    }

    /**
     * Create a new secret
     * @param {Object} params - Secret parameters
     * @param {string} params.secretId - Secret ID
     * @param {string} params.payload - Secret payload
     * @param {Object} params.labels - Labels for the secret
     * @returns {Promise<Object>} Secret details
     */
    async createSecret(params) {
        await this.ensureInitialized();

        try {
            // Create the secret
            const [secret] = await this.client.createSecret({
                parent: `projects/${this.projectId}`,
                secretId: params.secretId,
                secret: {
                    labels: {
                        created_by: 'zk-proof-system',
                        environment: process.env.NODE_ENV || 'development',
                        ...params.labels
                    },
                    replication: {
                        automatic: {}
                    }
                }
            });

            // Add the initial version of the secret
            const [version] = await this.client.addSecretVersion({
                parent: secret.name,
                payload: {
                    data: Buffer.from(params.payload)
                }
            });

            return {
                name: secret.name,
                version: version.name,
                createdAt: new Date().toISOString()
            };
        } catch (error) {
            // Handle error
            ZKErrorLogger.logError(createZKError(
                'SEC-GCP-003',
                `Failed to create secret ${params.secretId}: ${error.message}`,
                {
                    severity: 'ERROR',
                    details: {
                        error: error.message,
                        secretId: params.secretId,
                        operationId: this.operationId
                    }
                }
            ));

            // Use local fallback if enabled
            if (this.fallbackToLocal) {
                return this.createLocalSecret(params);
            }

            throw error;
        }
    }

    /**
     * Get a secret value
     * @param {Object} params - Secret parameters
     * @param {string} params.secretId - Secret ID
     * @param {string} params.version - Optional version (defaults to 'latest')
     * @returns {Promise<string>} Secret value
     */
    async getSecret(params) {
        await this.ensureInitialized();

        try {
            const version = params.version || 'latest';
            const name = `projects/${this.projectId}/secrets/${params.secretId}/versions/${version}`;

            const [response] = await this.client.accessSecretVersion({ name });

            return response.payload.data.toString('utf8');
        } catch (error) {
            // Handle error
            ZKErrorLogger.logError(createZKError(
                'SEC-GCP-004',
                `Failed to access secret ${params.secretId}: ${error.message}`,
                {
                    severity: 'ERROR',
                    details: {
                        error: error.message,
                        secretId: params.secretId,
                        operationId: this.operationId
                    }
                }
            ));

            // Use local fallback if enabled
            if (this.fallbackToLocal) {
                return this.getLocalSecret(params);
            }

            throw error;
        }
    }

    /**
     * Add a new version to an existing secret
     * @param {Object} params - Secret parameters
     * @param {string} params.secretId - Secret ID
     * @param {string} params.payload - Secret payload
     * @returns {Promise<Object>} Secret version details
     */
    async addSecretVersion(params) {
        await this.ensureInitialized();

        try {
            const parent = `projects/${this.projectId}/secrets/${params.secretId}`;

            const [version] = await this.client.addSecretVersion({
                parent,
                payload: {
                    data: Buffer.from(params.payload)
                }
            });

            return {
                name: version.name,
                version: version.name.split('/').pop(),
                createdAt: new Date().toISOString()
            };
        } catch (error) {
            // Handle error
            ZKErrorLogger.logError(createZKError(
                'SEC-GCP-005',
                `Failed to add secret version for ${params.secretId}: ${error.message}`,
                {
                    severity: 'ERROR',
                    details: {
                        error: error.message,
                        secretId: params.secretId,
                        operationId: this.operationId
                    }
                }
            ));

            // Use local fallback if enabled
            if (this.fallbackToLocal) {
                return this.addLocalSecretVersion(params);
            }

            throw error;
        }
    }

    /**
     * Delete a secret (all versions)
     * @param {Object} params - Secret parameters
     * @param {string} params.secretId - Secret ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteSecret(params) {
        await this.ensureInitialized();

        try {
            const name = `projects/${this.projectId}/secrets/${params.secretId}`;

            await this.client.deleteSecret({ name });

            return true;
        } catch (error) {
            // Handle error
            ZKErrorLogger.logError(createZKError(
                'SEC-GCP-006',
                `Failed to delete secret ${params.secretId}: ${error.message}`,
                {
                    severity: 'ERROR',
                    details: {
                        error: error.message,
                        secretId: params.secretId,
                        operationId: this.operationId
                    }
                }
            ));

            // Use local fallback if enabled
            if (this.fallbackToLocal) {
                return this.deleteLocalSecret(params);
            }

            throw error;
        }
    }

    /**
     * List all secrets
     * @param {Object} params - Optional listing parameters
     * @param {Object} params.filter - Filter string
     * @returns {Promise<Array>} List of secrets
     */
    async listSecrets(params = {}) {
        await this.ensureInitialized();

        try {
            const listParams = {
                parent: `projects/${this.projectId}`,
            };

            if (params.filter) {
                listParams.filter = params.filter;
            }

            const [secrets] = await this.client.listSecrets(listParams);

            return secrets.map(secret => ({
                name: secret.name,
                id: secret.name.split('/').pop(),
                createTime: secret.createTime,
                labels: secret.labels
            }));
        } catch (error) {
            // Handle error
            ZKErrorLogger.logError(createZKError(
                'SEC-GCP-007',
                `Failed to list secrets: ${error.message}`,
                {
                    severity: 'ERROR',
                    details: {
                        error: error.message,
                        operationId: this.operationId
                    }
                }
            ));

            // Use local fallback if enabled
            if (this.fallbackToLocal) {
                return this.listLocalSecrets();
            }

            throw error;
        }
    }

    /**
     * Create a secret in local fallback storage
     * @param {Object} params - Secret parameters
     * @returns {Promise<Object>} Secret details
     */
    async createLocalSecret(params) {
        try {
            // Ensure fallback is enabled
            if (!this.fallbackToLocal) {
                throw new Error('Local fallback not enabled');
            }

            // Create a directory for the secret
            const secretDir = path.join(this.localFallbackDir, params.secretId);
            if (!fs.existsSync(secretDir)) {
                fs.mkdirSync(secretDir, { recursive: true });
            }

            // Create metadata file
            const metadataPath = path.join(secretDir, 'metadata.json');
            const metadata = {
                id: params.secretId,
                createdAt: new Date().toISOString(),
                labels: {
                    created_by: 'zk-proof-system',
                    environment: process.env.NODE_ENV || 'development',
                    storage: 'local-fallback',
                    ...params.labels
                },
                versions: []
            };

            fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

            // Create initial version
            const versionId = '1';
            const versionPath = path.join(secretDir, `${versionId}.json`);
            const versionData = {
                id: versionId,
                createdAt: new Date().toISOString(),
                payload: params.payload
            };

            fs.writeFileSync(versionPath, JSON.stringify(versionData, null, 2));

            // Update metadata with version
            metadata.versions.push({
                id: versionId,
                createdAt: versionData.createdAt
            });

            fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

            return {
                name: `local/${params.secretId}`,
                version: versionId,
                createdAt: versionData.createdAt
            };
        } catch (error) {
            ZKErrorLogger.logError(createZKError(
                'SEC-GCP-008',
                `Failed to create local secret ${params.secretId}: ${error.message}`,
                {
                    severity: 'ERROR',
                    details: {
                        error: error.message,
                        secretId: params.secretId,
                        operationId: this.operationId
                    }
                }
            ));

            throw error;
        }
    }

    /**
     * Get a secret from local fallback storage
     * @param {Object} params - Secret parameters
     * @returns {Promise<string>} Secret value
     */
    async getLocalSecret(params) {
        try {
            // Ensure fallback is enabled
            if (!this.fallbackToLocal) {
                throw new Error('Local fallback not enabled');
            }

            const secretDir = path.join(this.localFallbackDir, params.secretId);
            if (!fs.existsSync(secretDir)) {
                throw new Error(`Secret ${params.secretId} not found`);
            }

            const metadataPath = path.join(secretDir, 'metadata.json');
            if (!fs.existsSync(metadataPath)) {
                throw new Error(`Secret ${params.secretId} metadata not found`);
            }

            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

            let versionId = params.version;
            if (!versionId || versionId === 'latest') {
                versionId = metadata.versions.sort((a, b) => {
                    return new Date(b.createdAt) - new Date(a.createdAt);
                })[0].id;
            }

            const versionPath = path.join(secretDir, `${versionId}.json`);
            if (!fs.existsSync(versionPath)) {
                throw new Error(`Secret ${params.secretId} version ${versionId} not found`);
            }

            const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));

            return versionData.payload;
        } catch (error) {
            ZKErrorLogger.logError(createZKError(
                'SEC-GCP-009',
                `Failed to get local secret ${params.secretId}: ${error.message}`,
                {
                    severity: 'ERROR',
                    details: {
                        error: error.message,
                        secretId: params.secretId,
                        operationId: this.operationId
                    }
                }
            ));

            throw error;
        }
    }

    /**
     * Add a version to a secret in local fallback storage
     * @param {Object} params - Secret parameters
     * @returns {Promise<Object>} Secret version details
     */
    async addLocalSecretVersion(params) {
        try {
            // Ensure fallback is enabled
            if (!this.fallbackToLocal) {
                throw new Error('Local fallback not enabled');
            }

            const secretDir = path.join(this.localFallbackDir, params.secretId);
            if (!fs.existsSync(secretDir)) {
                throw new Error(`Secret ${params.secretId} not found`);
            }

            const metadataPath = path.join(secretDir, 'metadata.json');
            if (!fs.existsSync(metadataPath)) {
                throw new Error(`Secret ${params.secretId} metadata not found`);
            }

            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

            // Create new version
            const versionId = (metadata.versions.length + 1).toString();
            const versionPath = path.join(secretDir, `${versionId}.json`);
            const versionData = {
                id: versionId,
                createdAt: new Date().toISOString(),
                payload: params.payload
            };

            fs.writeFileSync(versionPath, JSON.stringify(versionData, null, 2));

            // Update metadata with version
            metadata.versions.push({
                id: versionId,
                createdAt: versionData.createdAt
            });

            fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

            return {
                name: `local/${params.secretId}/${versionId}`,
                version: versionId,
                createdAt: versionData.createdAt
            };
        } catch (error) {
            ZKErrorLogger.logError(createZKError(
                'SEC-GCP-010',
                `Failed to add local secret version for ${params.secretId}: ${error.message}`,
                {
                    severity: 'ERROR',
                    details: {
                        error: error.message,
                        secretId: params.secretId,
                        operationId: this.operationId
                    }
                }
            ));

            throw error;
        }
    }

    /**
     * Delete a secret from local fallback storage
     * @param {Object} params - Secret parameters
     * @returns {Promise<boolean>} Success status
     */
    async deleteLocalSecret(params) {
        try {
            // Ensure fallback is enabled
            if (!this.fallbackToLocal) {
                throw new Error('Local fallback not enabled');
            }

            const secretDir = path.join(this.localFallbackDir, params.secretId);
            if (!fs.existsSync(secretDir)) {
                return true; // Already deleted
            }

            // Delete all files in the directory
            const files = fs.readdirSync(secretDir);
            for (const file of files) {
                fs.unlinkSync(path.join(secretDir, file));
            }

            // Delete the directory
            fs.rmdirSync(secretDir);

            return true;
        } catch (error) {
            ZKErrorLogger.logError(createZKError(
                'SEC-GCP-011',
                `Failed to delete local secret ${params.secretId}: ${error.message}`,
                {
                    severity: 'ERROR',
                    details: {
                        error: error.message,
                        secretId: params.secretId,
                        operationId: this.operationId
                    }
                }
            ));

            throw error;
        }
    }

    /**
     * List secrets in local fallback storage
     * @returns {Promise<Array>} List of secrets
     */
    async listLocalSecrets() {
        try {
            // Ensure fallback is enabled
            if (!this.fallbackToLocal) {
                throw new Error('Local fallback not enabled');
            }

            if (!fs.existsSync(this.localFallbackDir)) {
                return [];
            }

            const entries = fs.readdirSync(this.localFallbackDir, { withFileTypes: true });
            const directories = entries.filter(entry => entry.isDirectory() && !entry.name.startsWith('.'));

            const secrets = [];

            for (const dir of directories) {
                const metadataPath = path.join(this.localFallbackDir, dir.name, 'metadata.json');
                if (fs.existsSync(metadataPath)) {
                    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
                    secrets.push({
                        name: `local/${dir.name}`,
                        id: dir.name,
                        createTime: metadata.createdAt,
                        labels: metadata.labels
                    });
                }
            }

            return secrets;
        } catch (error) {
            ZKErrorLogger.logError(createZKError(
                'SEC-GCP-012',
                `Failed to list local secrets: ${error.message}`,
                {
                    severity: 'ERROR',
                    details: {
                        error: error.message,
                        operationId: this.operationId
                    }
                }
            ));

            throw error;
        }
    }

    /**
     * Ensure the client is initialized before operations
     */
    async ensureInitialized() {
        if (!this.isInitialized) {
            const success = await this.initialize();
            if (!success && !this.fallbackToLocal) {
                throw new Error('GCP Secret Manager initialization failed and local fallback is disabled');
            }
        }
    }
} 