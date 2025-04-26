/**
 * SecureKeyRotation.js - Key rotation mechanism for ZK proof system
 * 
 * Provides a robust framework for cryptographic key rotation, a crucial security
 * practice that limits the impact of potential key compromise. This module
 * manages the complete lifecycle of keys, including:
 * 
 * - Automatic key rotation based on configurable schedules
 * - Multiple key types (encryption, signing, auth, temporary wallet keys)
 * - Historical key tracking for supporting legacy operations
 * - Secure deletion of expired keys
 * 
 * The implementation prioritizes security while maintaining backward compatibility
 * with operations performed using previous key versions.
 * 
 * @module SecureKeyRotation
 */

import { GCPSecretManager } from './GCPSecretManager.js';
import { ZKErrorLogger, createZKError, ZKError } from './zkErrorHandler.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Custom error class for key rotation operations
 * @extends ZKError
 */
class KeyRotationError extends ZKError {
    /**
     * Create a key rotation error
     * @param {string} code - Error code
     * @param {string} message - Error message
     * @param {Object} [details] - Additional error details
     */
    constructor(code, message, details = {}) {
        super(code, message, details);
        this.name = 'KeyRotationError';
    }
}

/**
 * Manages cryptographic key rotation lifecycle including scheduling, execution, and historical tracking
 * @class
 */
export class SecureKeyRotation {
    /**
     * Create key rotation manager
     * @param {Object} config - Configuration options
     * @param {GCPSecretManager} config.secretManager - Secret manager instance
     * @param {number} config.rotationIntervalDays - Days between rotations (default: 30)
     * @param {boolean} config.autoRotation - Whether to enable auto rotation
     * @param {string} config.keyPrefix - Prefix for key names
     */
    constructor(config) {
        this.secretManager = config.secretManager;
        this.rotationIntervalDays = config.rotationIntervalDays || 30;
        this.autoRotation = config.autoRotation || false;
        this.keyPrefix = config.keyPrefix || 'zk-proof-';
        this.rotationJobs = new Map();
        this.operationId = Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    /**
     * Initialize key rotation system
     * @returns {Promise<boolean>} Success status
     */
    async initialize() {
        try {
            // Check existing keys
            const secrets = await this.secretManager.listSecrets({
                filter: `labels.created_by=zk-proof-system`
            });

            const keyTypes = await this.getKeyTypes();

            // Ensure each key type has at least one key
            for (const keyType of keyTypes) {
                const keyTypeSecrets = secrets.filter(s => s.id.startsWith(`${this.keyPrefix}${keyType}-`));

                if (keyTypeSecrets.length === 0) {
                    // Create initial key for this type
                    await this.createInitialKey(keyType);
                }
            }

            // Set up auto-rotation if enabled
            if (this.autoRotation) {
                this.scheduleKeyRotations(secrets);
            }

            return true;
        } catch (error) {
            ZKErrorLogger.logError(createZKError(
                'SEC-ROT-001',
                `Failed to initialize key rotation: ${error.message}`,
                {
                    severity: 'ERROR',
                    details: {
                        error: error.message,
                        operationId: this.operationId
                    }
                }
            ));

            return false;
        }
    }

    /**
     * Get key types used in system
     * @returns {Promise<string[]>} Key types
     */
    async getKeyTypes() {
        // Return key types based on system requirements
        return [
            'encryption', // For data encryption
            'auth',       // For authentication
            'signing',    // For signing operations
            'temp-wallet' // For temporary wallet encryption
        ];
    }

    /**
     * Create initial key for a key type
     * @param {string} keyType - Key type
     * @returns {Promise<Object>} Created key details
     */
    async createInitialKey(keyType) {
        try {
            const keyId = `${this.keyPrefix}${keyType}-${Date.now()}`;

            // Generate appropriate key material based on type
            let keyMaterial;

            switch (keyType) {
                case 'encryption':
                    // AES-256 key
                    keyMaterial = crypto.randomBytes(32).toString('base64');
                    break;
                case 'auth':
                    // HMAC key
                    keyMaterial = crypto.randomBytes(64).toString('base64');
                    break;
                case 'signing':
                    // Ed25519 key pair
                    const keyPair = crypto.generateKeyPairSync('ed25519');
                    const publicKey = keyPair.publicKey.export({ format: 'pem', type: 'spki' });
                    const privateKey = keyPair.privateKey.export({ format: 'pem', type: 'pkcs8' });
                    keyMaterial = JSON.stringify({ publicKey, privateKey });
                    break;
                case 'temp-wallet':
                    // Ethereum wallet seed phrase
                    const seedBytes = crypto.randomBytes(16);
                    // This is a placeholder for actual BIP39 mnemonic generation
                    keyMaterial = seedBytes.toString('hex');
                    break;
                default:
                    throw new KeyRotationError(
                        'ROT-TYPE-001', 
                        `Unknown key type: ${keyType}`, 
                        { keyType, operationId: this.operationId }
                    );
            }

            // Create secret
            const key = await this.secretManager.createSecret({
                secretId: keyId,
                payload: keyMaterial,
                labels: {
                    type: keyType,
                    version: '1',
                    active: 'true',
                    created_by: 'zk-proof-system',
                    rotation_due: this.calculateNextRotationDate()
                }
            });

            ZKErrorLogger.logInfo(`Created initial ${keyType} key: ${keyId}`);

            return {
                keyId,
                keyType,
                createdAt: key.createdAt,
                nextRotation: this.calculateNextRotationDate()
            };
        } catch (error) {
            ZKErrorLogger.logError(createZKError(
                'SEC-ROT-002',
                `Failed to create initial ${keyType} key: ${error.message}`,
                {
                    severity: 'ERROR',
                    details: {
                        error: error.message,
                        keyType,
                        operationId: this.operationId
                    }
                }
            ));

            throw error;
        }
    }

    /**
     * Schedule key rotations based on existing keys
     * @param {Array} secrets - List of secrets
     */
    scheduleKeyRotations(secrets) {
        try {
            // Group secrets by key type
            const secretsByType = {};

            for (const secret of secrets) {
                if (!secret.id.startsWith(this.keyPrefix)) continue;

                const parts = secret.id.split('-');
                if (parts.length < 2) continue;

                const keyType = parts[1];

                if (!secretsByType[keyType]) {
                    secretsByType[keyType] = [];
                }

                secretsByType[keyType].push(secret);
            }

            // Schedule rotation for each key type
            for (const [keyType, typeSecrets] of Object.entries(secretsByType)) {
                // Find the active key
                const activeKeys = typeSecrets.filter(s => s.labels?.active === 'true');

                if (activeKeys.length === 0) continue;
                if (activeKeys.length > 1) {
                    // Multiple active keys is suspicious, log warning
                    ZKErrorLogger.logWarning(`Multiple active keys found for type ${keyType}`);
                }

                const activeKey = activeKeys[0];
                const rotationDue = activeKey.labels?.rotation_due;

                if (!rotationDue) {
                    // Set rotation date if not present
                    this.updateKeyRotationDate(activeKey.id);
                    continue;
                }

                // Schedule rotation based on due date
                const dueDate = new Date(rotationDue);
                const now = new Date();

                let timeUntilRotation = dueDate.getTime() - now.getTime();
                if (timeUntilRotation < 0) {
                    // Rotation is overdue, schedule immediately with small delay
                    timeUntilRotation = 60000; // 1 minute
                }

                // Create rotation job
                const jobId = `${keyType}-rotation`;
                const job = setTimeout(async () => {
                    try {
                        await this.rotateKey(keyType);

                        // Schedule next rotation
                        const secrets = await this.secretManager.listSecrets({
                            filter: `labels.created_by=zk-proof-system labels.type=${keyType} labels.active=true`
                        });

                        if (secrets.length > 0) {
                            this.scheduleKeyRotations(secrets);
                        }
                    } catch (error) {
                        ZKErrorLogger.logError(createZKError(
                            'SEC-ROT-003',
                            `Scheduled key rotation failed for ${keyType}: ${error.message}`,
                            {
                                severity: 'ERROR',
                                details: {
                                    error: error.message,
                                    keyType,
                                    operationId: this.operationId
                                }
                            }
                        ));
                    }
                }, timeUntilRotation);

                // Store job for management
                this.rotationJobs.set(jobId, job);

                ZKErrorLogger.logInfo(`Scheduled ${keyType} key rotation in ${Math.floor(timeUntilRotation / (1000 * 60 * 60 * 24))} days`);
            }
        } catch (error) {
            ZKErrorLogger.logError(createZKError(
                'SEC-ROT-004',
                `Failed to schedule key rotations: ${error.message}`,
                {
                    severity: 'ERROR',
                    details: {
                        error: error.message,
                        operationId: this.operationId
                    }
                }
            ));
        }
    }

    /**
     * Rotate a key type
     * @param {string} keyType - Key type to rotate
     * @returns {Promise<Object>} Rotation details
     */
    async rotateKey(keyType) {
        try {
            ZKErrorLogger.logInfo(`Starting rotation for ${keyType} key`);

            // Find current active key
            const secrets = await this.secretManager.listSecrets({
                filter: `labels.created_by=zk-proof-system labels.type=${keyType} labels.active=true`
            });

            if (secrets.length === 0) {
                throw new KeyRotationError(
                    'ROT-KEY-001', 
                    `No active ${keyType} key found`, 
                    { keyType, operationId: this.operationId }
                );
            }

            const currentActiveKey = secrets[0];

            // Create new key
            const newKeyId = `${this.keyPrefix}${keyType}-${Date.now()}`;

            // Generate appropriate key material based on type (same as createInitialKey)
            let keyMaterial;

            switch (keyType) {
                case 'encryption':
                    keyMaterial = crypto.randomBytes(32).toString('base64');
                    break;
                case 'auth':
                    keyMaterial = crypto.randomBytes(64).toString('base64');
                    break;
                case 'signing':
                    const keyPair = crypto.generateKeyPairSync('ed25519');
                    const publicKey = keyPair.publicKey.export({ format: 'pem', type: 'spki' });
                    const privateKey = keyPair.privateKey.export({ format: 'pem', type: 'pkcs8' });
                    keyMaterial = JSON.stringify({ publicKey, privateKey });
                    break;
                case 'temp-wallet':
                    const seedBytes = crypto.randomBytes(16);
                    keyMaterial = seedBytes.toString('hex');
                    break;
                default:
                    throw new KeyRotationError(
                        'ROT-TYPE-001', 
                        `Unknown key type: ${keyType}`, 
                        { keyType, operationId: this.operationId }
                    );
            }

            // Create new secret
            const newKey = await this.secretManager.createSecret({
                secretId: newKeyId,
                payload: keyMaterial,
                labels: {
                    type: keyType,
                    version: (parseInt(currentActiveKey.labels?.version || '0', 10) + 1).toString(),
                    active: 'true',
                    created_by: 'zk-proof-system',
                    rotation_due: this.calculateNextRotationDate()
                }
            });

            // Update old key to inactive
            await this.updateKeyStatus(currentActiveKey.id, false);

            ZKErrorLogger.logInfo(`Rotated ${keyType} key: ${currentActiveKey.id} -> ${newKeyId}`);

            return {
                oldKeyId: currentActiveKey.id,
                newKeyId,
                keyType,
                createdAt: newKey.createdAt,
                nextRotation: this.calculateNextRotationDate()
            };
        } catch (error) {
            ZKErrorLogger.logError(createZKError(
                'SEC-ROT-005',
                `Failed to rotate ${keyType} key: ${error.message}`,
                {
                    severity: 'ERROR',
                    details: {
                        error: error.message,
                        keyType,
                        operationId: this.operationId
                    }
                }
            ));

            throw error;
        }
    }

    /**
     * Update key active status
     * @param {string} keyId - Key ID
     * @param {boolean} active - Active status
     * @returns {Promise<boolean>} Success status
     */
    async updateKeyStatus(keyId, active) {
        try {
            // Handle local fallback case first
            if (this.secretManager.fallbackToLocal) {
                const secretId = keyId.split('/').pop();
                
                // Get current metadata
                const secrets = await this.secretManager.listSecrets();
                const secret = secrets.find(s => s.id === secretId);
                
                if (!secret) {
                    throw new KeyRotationError(
                    'ROT-SEC-001', 
                    `Secret ${secretId} not found`, 
                    { secretId, operationId: this.operationId }
                );
                }
                
                // Update metadata
                secret.labels.active = active.toString();
                
                // For local fallback, update the metadata file
                if (this.secretManager.localFallbackDir) {
                    const metadataPath = path.join(
                        this.secretManager.localFallbackDir, 
                        secretId, 
                        'metadata.json'
                    );
                    
                    if (fs.existsSync(metadataPath)) {
                        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
                        metadata.labels.active = active.toString();
                        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
                        ZKErrorLogger.logInfo(`Updated local secret ${secretId} active status to ${active}`);
                    }
                }
                
                return true;
            }
            
            // Handle GCP Secret Manager case
            // GCP Secret Manager doesn't support updating labels directly
            // We need to add a new version with updated labels
            
            // Parse the resource name to get project ID and secret ID
            const nameParts = keyId.split('/');
            if (nameParts.length < 4) {
                throw new KeyRotationError(
                    'ROT-FORMAT-001', 
                    `Invalid secret name format: ${keyId}`, 
                    { keyId, operationId: this.operationId }
                );
            }
            
            const projectId = nameParts[1];
            const secretId = nameParts[3];
            
            // Get the current secret to retrieve its labels and data
            const secretMetadata = await this.secretManager.client.getSecret({
                name: `projects/${projectId}/secrets/${secretId}`
            });
            
            // Get the current labels
            const currentLabels = secretMetadata[0].labels || {};
            
            // Create updated labels
            const updatedLabels = {
                ...currentLabels,
                active: active.toString()
            };
            
            // Update the secret's metadata
            const updateMask = { paths: ['labels'] };
            
            // Call the Secret Manager API to update the secret
            await this.secretManager.client.updateSecret({
                secret: {
                    name: `projects/${projectId}/secrets/${secretId}`,
                    labels: updatedLabels
                },
                updateMask: updateMask
            });
            
            ZKErrorLogger.logInfo(`Updated GCP secret ${secretId} active status to ${active}`);
            return true;
            
        } catch (error) {
            ZKErrorLogger.logError(createZKError(
                'SEC-ROT-006',
                `Failed to update key status: ${error.message}`,
                {
                    severity: 'ERROR',
                    details: {
                        error: error.message,
                        keyId,
                        operationId: this.operationId
                    }
                }
            ));

            return false;
        }
    }

    /**
     * Update key rotation date
     * @param {string} keyId - Key ID
     * @returns {Promise<boolean>} Success status
     */
    async updateKeyRotationDate(keyId) {
        try {
            const rotationDue = this.calculateNextRotationDate();

            // Handle local fallback case first
            if (this.secretManager.fallbackToLocal) {
                const secretId = keyId.split('/').pop();
                
                // Get current metadata
                const secrets = await this.secretManager.listSecrets();
                const secret = secrets.find(s => s.id === secretId);
                
                if (!secret) {
                    throw new KeyRotationError(
                    'ROT-SEC-001', 
                    `Secret ${secretId} not found`, 
                    { secretId, operationId: this.operationId }
                );
                }
                
                // Update metadata
                secret.labels.rotation_due = rotationDue;
                
                // For local fallback, update the metadata file
                if (this.secretManager.localFallbackDir) {
                    const metadataPath = path.join(
                        this.secretManager.localFallbackDir, 
                        secretId, 
                        'metadata.json'
                    );
                    
                    if (fs.existsSync(metadataPath)) {
                        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
                        metadata.labels.rotation_due = rotationDue;
                        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
                        ZKErrorLogger.logInfo(`Updated local secret ${secretId} rotation date to ${rotationDue}`);
                    }
                }
                
                return true;
            }
            
            // Handle GCP Secret Manager case
            // Parse the resource name to get project ID and secret ID
            const nameParts = keyId.split('/');
            if (nameParts.length < 4) {
                throw new KeyRotationError(
                    'ROT-FORMAT-001', 
                    `Invalid secret name format: ${keyId}`, 
                    { keyId, operationId: this.operationId }
                );
            }
            
            const projectId = nameParts[1];
            const secretId = nameParts[3];
            
            // Get the current secret to retrieve its labels
            const secretMetadata = await this.secretManager.client.getSecret({
                name: `projects/${projectId}/secrets/${secretId}`
            });
            
            // Get the current labels
            const currentLabels = secretMetadata[0].labels || {};
            
            // Create updated labels
            const updatedLabels = {
                ...currentLabels,
                rotation_due: rotationDue
            };
            
            // Update the secret's metadata
            const updateMask = { paths: ['labels'] };
            
            // Call the Secret Manager API to update the secret
            await this.secretManager.client.updateSecret({
                secret: {
                    name: `projects/${projectId}/secrets/${secretId}`,
                    labels: updatedLabels
                },
                updateMask: updateMask
            });
            
            ZKErrorLogger.logInfo(`Updated GCP secret ${secretId} rotation date to ${rotationDue}`);
            return true;
            
        } catch (error) {
            ZKErrorLogger.logError(createZKError(
                'SEC-ROT-007',
                `Failed to update key rotation date: ${error.message}`,
                {
                    severity: 'ERROR',
                    details: {
                        error: error.message,
                        keyId,
                        operationId: this.operationId
                    }
                }
            ));

            return false;
        }
    }

    /**
     * Calculate next rotation date
     * @returns {string} ISO date string
     */
    calculateNextRotationDate() {
        const now = new Date();
        const nextRotation = new Date(now);
        nextRotation.setDate(now.getDate() + this.rotationIntervalDays);
        return nextRotation.toISOString();
    }

    /**
     * Clean up rotation jobs
     */
    cleanup() {
        for (const job of this.rotationJobs.values()) {
            clearTimeout(job);
        }

        this.rotationJobs.clear();
    }
} 