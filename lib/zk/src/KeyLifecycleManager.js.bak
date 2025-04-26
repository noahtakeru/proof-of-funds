/**
 * KeyLifecycleManager.js - Key lifecycle management for ZK proof system
 * 
 * Provides comprehensive management of cryptographic keys throughout their
 * entire lifecycle, including:
 * 
 * - Key creation and initialization
 * - Secure key storage and retrieval
 * - Key rotation scheduling and coordination
 * - Key usage for encryption, decryption, signing, and verification
 * - Key deactivation and secure deletion
 * 
 * This module serves as the primary interface for all key-related operations
 * in the ZK proof system, abstracting the underlying storage and rotation mechanisms.
 * 
 * @module KeyLifecycleManager
 */

import { GCPSecretManager } from './GCPSecretManager.js';
import { SecureKeyRotation } from './SecureKeyRotation.js';
import { ZKErrorLogger, createZKError, ZKError } from './zkErrorHandler.js';
import crypto from 'crypto';

/**
 * Custom error class for key lifecycle operations
 * @extends ZKError
 */
class KeyLifecycleError extends ZKError {
    /**
     * Create a key lifecycle error
     * @param {string} code - Error code
     * @param {string} message - Error message
     * @param {Object} [details] - Additional error details
     */
    constructor(code, message, details = {}) {
        super(code, message, details);
        this.name = 'KeyLifecycleError';
    }
}

/**
 * Manages the entire lifecycle of cryptographic keys including creation, storage, rotation, and secure deletion
 * @class
 */
export class KeyLifecycleManager {
    /**
     * Create key lifecycle manager
     * @param {Object} config - Configuration options
     * @param {Object} config.secretManagerConfig - Secret manager configuration
     * @param {number} config.rotationIntervalDays - Days between rotations
     * @param {boolean} config.autoRotation - Whether to enable auto rotation
     * @param {string} config.environment - Environment name
     */
    constructor(config) {
        this.config = config;
        this.environment = config.environment || process.env.NODE_ENV || 'development';
        this.operationId = Date.now().toString(36) + Math.random().toString(36).substring(2);

        // Create secret manager and rotation manager
        this.secretManager = new GCPSecretManager(config.secretManagerConfig);
        this.keyRotation = new SecureKeyRotation({
            secretManager: this.secretManager,
            rotationIntervalDays: config.rotationIntervalDays || 30,
            autoRotation: config.autoRotation || false,
            keyPrefix: `zk-${this.environment}-`
        });

        this.isInitialized = false;
        this.keyCache = new Map();

        // Cache timeouts
        this.cacheTimeouts = new Map();
        this.defaultCacheDuration = 3600000; // 1 hour
    }

    /**
     * Initialize key lifecycle manager
     * @returns {Promise<boolean>} Success status
     */
    async initialize() {
        try {
            // Initialize secret manager
            await this.secretManager.initialize();

            // Initialize key rotation
            await this.keyRotation.initialize();

            this.isInitialized = true;
            return true;
        } catch (error) {
            ZKErrorLogger.logError(createZKError(
                'SEC-KLM-001',
                `Failed to initialize key lifecycle manager: ${error.message}`,
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
     * Get active key for a specific purpose
     * @param {string} keyType - Key type
     * @param {boolean} useCache - Whether to use cache
     * @returns {Promise<Object>} Key details
     */
    async getActiveKey(keyType, useCache = true) {
        await this.ensureInitialized();

        try {
            const cacheKey = `active-${keyType}`;

            // Check cache first if enabled
            if (useCache && this.keyCache.has(cacheKey)) {
                return this.keyCache.get(cacheKey);
            }

            // Find active key in Secret Manager
            const filter = `labels.created_by=zk-proof-system labels.type=${keyType} labels.active=true`;
            const secrets = await this.secretManager.listSecrets({ filter });

            if (secrets.length === 0) {
                throw new KeyLifecycleError(
                    'KLM-KEY-001', 
                    `No active ${keyType} key found`, 
                    { keyType, operationId: this.operationId }
                );
            }

            if (secrets.length > 1) {
                ZKErrorLogger.logWarning(`Multiple active keys found for type ${keyType}, using most recent`);
            }

            // Sort by creation time, newest first
            const sortedSecrets = secrets.sort((a, b) => {
                return new Date(b.createTime) - new Date(a.createTime);
            });

            const activeSecret = sortedSecrets[0];

            // Get the key material
            const keyMaterial = await this.secretManager.getSecret({
                secretId: activeSecret.id
            });

            // Prepare result
            const result = {
                keyId: activeSecret.id,
                keyType,
                keyMaterial,
                version: activeSecret.labels?.version || '1',
                createdAt: activeSecret.createTime
            };

            // Cache result if enabled
            if (useCache) {
                this.setCachedKey(cacheKey, result);
            }

            return result;
        } catch (error) {
            ZKErrorLogger.logError(createZKError(
                'SEC-KLM-002',
                `Failed to get active ${keyType} key: ${error.message}`,
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
     * Get all keys of a specific type
     * @param {string} keyType - Key type
     * @param {boolean} includeInactive - Whether to include inactive keys
     * @returns {Promise<Array>} List of keys
     */
    async getAllKeys(keyType, includeInactive = false) {
        await this.ensureInitialized();

        try {
            let filter = `labels.created_by=zk-proof-system labels.type=${keyType}`;

            if (!includeInactive) {
                filter += ' labels.active=true';
            }

            const secrets = await this.secretManager.listSecrets({ filter });

            // Sort by creation time, newest first
            return secrets.sort((a, b) => {
                return new Date(b.createTime) - new Date(a.createTime);
            });
        } catch (error) {
            ZKErrorLogger.logError(createZKError(
                'SEC-KLM-003',
                `Failed to get ${keyType} keys: ${error.message}`,
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
     * Generate a new key for a specific purpose
     * @param {string} keyType - Key type
     * @param {boolean} setActive - Whether to set as active
     * @returns {Promise<Object>} Key details
     */
    async generateNewKey(keyType, setActive = true) {
        await this.ensureInitialized();

        try {
            // Generate key material based on type
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
                    throw new KeyLifecycleError(
                        'KLM-KEY-002', 
                        `Unknown key type: ${keyType}`, 
                        { keyType, operationId: this.operationId }
                    );
            }

            // Find current active key to determine version
            let version = '1';

            if (setActive) {
                const activeKeys = await this.getAllKeys(keyType, false);
                if (activeKeys.length > 0) {
                    const currentVersion = parseInt(activeKeys[0].labels?.version || '0', 10);
                    version = (currentVersion + 1).toString();
                }
            }

            // Create secret
            const keyId = `zk-${this.environment}-${keyType}-${Date.now()}`;

            const newKey = await this.secretManager.createSecret({
                secretId: keyId,
                payload: keyMaterial,
                labels: {
                    type: keyType,
                    version,
                    active: setActive.toString(),
                    created_by: 'zk-proof-system',
                    environment: this.environment,
                    rotation_due: this.keyRotation.calculateNextRotationDate()
                }
            });

            // If setting as active, deactivate old keys
            if (setActive) {
                const activeKeys = await this.getAllKeys(keyType, false);

                for (const key of activeKeys) {
                    if (key.id !== keyId) {
                        await this.keyRotation.updateKeyStatus(key.name, false);
                    }
                }

                // Clear cache
                this.keyCache.delete(`active-${keyType}`);
            }

            ZKErrorLogger.logInfo(`Generated new ${keyType} key: ${keyId}`);

            return {
                keyId,
                keyType,
                keyMaterial,
                version,
                createdAt: newKey.createdAt
            };
        } catch (error) {
            ZKErrorLogger.logError(createZKError(
                'SEC-KLM-004',
                `Failed to generate new ${keyType} key: ${error.message}`,
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
     * Encrypt data using the active encryption key
     * @param {string|Object} data - Data to encrypt
     * @returns {Promise<Object>} Encrypted data details
     */
    async encryptData(data) {
        await this.ensureInitialized();

        try {
            // Get active encryption key
            const key = await this.getActiveKey('encryption');

            // Generate initialization vector
            const iv = crypto.randomBytes(16);

            // Serialize data if object
            const dataToEncrypt = typeof data === 'object' ? JSON.stringify(data) : data;

            // Create cipher
            const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key.keyMaterial, 'base64'), iv);

            // Encrypt data
            let encrypted = cipher.update(dataToEncrypt, 'utf8', 'base64');
            encrypted += cipher.final('base64');

            // Get auth tag
            const authTag = cipher.getAuthTag().toString('base64');

            return {
                encrypted,
                iv: iv.toString('base64'),
                authTag,
                keyId: key.keyId,
                keyVersion: key.version,
                algorithm: 'aes-256-gcm'
            };
        } catch (error) {
            ZKErrorLogger.logError(createZKError(
                'SEC-KLM-005',
                `Failed to encrypt data: ${error.message}`,
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
     * Decrypt data using the specified key
     * @param {Object} encryptedData - Encrypted data details
     * @returns {Promise<string|Object>} Decrypted data
     */
    async decryptData(encryptedData) {
        await this.ensureInitialized();

        try {
            // Get key material (either from active key or specific key)
            let keyMaterial;

            if (encryptedData.keyId) {
                // Get specific key
                const secretId = encryptedData.keyId.split('/').pop();
                keyMaterial = await this.secretManager.getSecret({ secretId });
            } else {
                // Get active key
                const key = await this.getActiveKey('encryption');
                keyMaterial = key.keyMaterial;
            }

            // Create decipher
            const decipher = crypto.createDecipheriv(
                encryptedData.algorithm || 'aes-256-gcm',
                Buffer.from(keyMaterial, 'base64'),
                Buffer.from(encryptedData.iv, 'base64')
            );

            // Set auth tag
            decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'base64'));

            // Decrypt data
            let decrypted = decipher.update(encryptedData.encrypted, 'base64', 'utf8');
            decrypted += decipher.final('utf8');

            // Try to parse as JSON if it looks like JSON
            if (decrypted.startsWith('{') || decrypted.startsWith('[')) {
                try {
                    return JSON.parse(decrypted);
                } catch (e) {
                    // Not valid JSON, return as string
                    return decrypted;
                }
            }

            return decrypted;
        } catch (error) {
            ZKErrorLogger.logError(createZKError(
                'SEC-KLM-006',
                `Failed to decrypt data: ${error.message}`,
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
     * Sign data using the active signing key
     * @param {string|Object} data - Data to sign
     * @returns {Promise<Object>} Signature details
     */
    async signData(data) {
        await this.ensureInitialized();

        try {
            // Get active signing key
            const key = await this.getActiveKey('signing');

            // Parse key material
            const keyMaterial = JSON.parse(key.keyMaterial);

            // Create private key object
            const privateKey = crypto.createPrivateKey(keyMaterial.privateKey);

            // Serialize data if object
            const dataToSign = typeof data === 'object' ? JSON.stringify(data) : data;

            // Sign data
            const signature = crypto.sign(null, Buffer.from(dataToSign), privateKey);

            return {
                signature: signature.toString('base64'),
                keyId: key.keyId,
                keyVersion: key.version,
                algorithm: 'ed25519'
            };
        } catch (error) {
            ZKErrorLogger.logError(createZKError(
                'SEC-KLM-007',
                `Failed to sign data: ${error.message}`,
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
     * Verify signature
     * @param {string|Object} data - Original data
     * @param {Object} signatureData - Signature details
     * @returns {Promise<boolean>} Verification result
     */
    async verifySignature(data, signatureData) {
        await this.ensureInitialized();

        try {
            // Get key material
            let keyMaterial;

            if (signatureData.keyId) {
                // Get specific key
                const secretId = signatureData.keyId.split('/').pop();
                const keyContent = await this.secretManager.getSecret({ secretId });
                keyMaterial = JSON.parse(keyContent);
            } else {
                // Get active key
                const key = await this.getActiveKey('signing');
                keyMaterial = JSON.parse(key.keyMaterial);
            }

            // Create public key object
            const publicKey = crypto.createPublicKey(keyMaterial.publicKey);

            // Serialize data if object
            const dataToVerify = typeof data === 'object' ? JSON.stringify(data) : data;

            // Verify signature
            return crypto.verify(
                null,
                Buffer.from(dataToVerify),
                publicKey,
                Buffer.from(signatureData.signature, 'base64')
            );
        } catch (error) {
            ZKErrorLogger.logError(createZKError(
                'SEC-KLM-008',
                `Failed to verify signature: ${error.message}`,
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
     * Set cached key with timeout
     * @param {string} cacheKey - Cache key
     * @param {Object} value - Value to cache
     * @param {number} duration - Cache duration in ms
     */
    setCachedKey(cacheKey, value, duration = this.defaultCacheDuration) {
        // Clear existing timeout if any
        if (this.cacheTimeouts.has(cacheKey)) {
            clearTimeout(this.cacheTimeouts.get(cacheKey));
        }

        // Set value in cache
        this.keyCache.set(cacheKey, value);

        // Set timeout to clear cache
        const timeout = setTimeout(() => {
            this.keyCache.delete(cacheKey);
            this.cacheTimeouts.delete(cacheKey);
        }, duration);

        this.cacheTimeouts.set(cacheKey, timeout);
    }

    /**
     * Clear all cached keys
     */
    clearCache() {
        // Clear all timeouts
        for (const timeout of this.cacheTimeouts.values()) {
            clearTimeout(timeout);
        }

        // Clear maps
        this.keyCache.clear();
        this.cacheTimeouts.clear();
    }

    /**
     * Ensure manager is initialized
     */
    async ensureInitialized() {
        if (!this.isInitialized) {
            await this.initialize();
        }
    }

    /**
     * Clean up resources
     */
    cleanup() {
        this.clearCache();
        this.keyRotation.cleanup();
    }
} 