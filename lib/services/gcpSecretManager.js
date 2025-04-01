/**
 * GCP Secret Manager Utility
 * 
 * This module provides secure access to secrets stored in Google Cloud Secret Manager.
 * It includes features for:
 * - Secure secret retrieval with proper authentication
 * - In-memory caching to reduce API calls and improve performance
 * - Error handling and graceful fallbacks
 * - Logging of secret access events (without exposing secret values)
 * - Optional mock secrets for local development
 */

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import gcpSecretConfig from '../config/gcp-secrets';

// In-memory cache for secrets to reduce API calls
const secretCache = new Map();

// Track secret access for security auditing
const secretAccessLog = [];

/**
 * Initializes the Secret Manager client with proper authentication
 * @returns {SecretManagerServiceClient} Authenticated Secret Manager client
 */
const getSecretManagerClient = () => {
    try {
        const options = {};

        // Use default credentials if specified (for GCP runtime environments)
        if (gcpSecretConfig.auth.useDefaultCredentials) {
            return new SecretManagerServiceClient();
        }

        // Otherwise use service account key file for local development
        options.keyFilename = gcpSecretConfig.auth.serviceAccountKeyPath;
        return new SecretManagerServiceClient(options);
    } catch (error) {
        console.error('Error initializing Secret Manager client:', error);
        throw new Error('Failed to initialize GCP Secret Manager client');
    }
};

/**
 * Retrieves a secret from GCP Secret Manager
 * @param {string} secretType - Type of secret to retrieve (masterSeed, encryptionKeys, etc.)
 * @param {boolean} useCache - Whether to use cached value if available
 * @returns {Promise<string>} Secret value
 */
export const getSecret = async (secretType, useCache = true) => {
    try {
        // Check if we should use mock secrets for development/testing
        if (gcpSecretConfig.isMockingEnabled()) {
            const mockValue = gcpSecretConfig.mockSecrets[secretType];

            if (!mockValue) {
                throw new Error(`Mock secret not found for type: ${secretType}`);
            }

            // Log access to mock secret
            logSecretAccess(secretType, 'mock', true);

            return mockValue;
        }

        // Check cache first if enabled
        if (useCache && secretCache.has(secretType)) {
            // Log access to cached secret
            logSecretAccess(secretType, 'cache', true);

            return secretCache.get(secretType);
        }

        // Get secret path
        const secretPath = gcpSecretConfig.getSecretPath(secretType);

        // Initialize client
        const client = getSecretManagerClient();

        // Retrieve secret
        const [version] = await client.accessSecretVersion({
            name: secretPath
        });

        // Get payload data as string
        const secretValue = version.payload.data.toString();

        // Cache the result
        secretCache.set(secretType, secretValue);

        // Log successful retrieval
        logSecretAccess(secretType, 'gcp', true);

        return secretValue;
    } catch (error) {
        // Log failed access attempt
        logSecretAccess(secretType, 'gcp', false, error.message);

        console.error(`Error retrieving secret ${secretType}:`, error);
        throw new Error(`Failed to retrieve secret: ${secretType}`);
    }
};

/**
 * Retrieves the master seed from GCP Secret Manager
 * @param {boolean} useCache - Whether to use cached value if available
 * @returns {Promise<string>} Master seed hex string
 */
export const getMasterSeed = async (useCache = true) => {
    try {
        const masterSeed = await getSecret('masterSeed', useCache);
        return masterSeed.startsWith('0x') ? masterSeed : `0x${masterSeed}`;
    } catch (error) {
        console.error('Error retrieving master seed:', error);
        throw new Error('Failed to retrieve master seed for wallet generation');
    }
};

/**
 * Retrieves encryption keys from GCP Secret Manager
 * @param {boolean} useCache - Whether to use cached value if available
 * @returns {Promise<Object>} Encryption keys object with current key ID and key mapping
 */
export const getEncryptionKeys = async (useCache = true) => {
    try {
        const encryptionKeysJson = await getSecret('encryptionKeys', useCache);
        return JSON.parse(encryptionKeysJson);
    } catch (error) {
        console.error('Error retrieving encryption keys:', error);
        throw new Error('Failed to retrieve encryption keys');
    }
};

/**
 * Retrieves API keys from GCP Secret Manager
 * @param {boolean} useCache - Whether to use cached value if available
 * @returns {Promise<Object>} API keys object
 */
export const getApiKeys = async (useCache = true) => {
    try {
        const apiKeysJson = await getSecret('apiKeys', useCache);
        return JSON.parse(apiKeysJson);
    } catch (error) {
        console.error('Error retrieving API keys:', error);
        throw new Error('Failed to retrieve API keys');
    }
};

/**
 * Clears the secret cache
 * @returns {void}
 */
export const clearSecretCache = () => {
    secretCache.clear();
    console.log('Secret cache cleared');
};

/**
 * Logs a secret access event
 * @param {string} secretType - Type of secret accessed
 * @param {string} source - Source of the secret (gcp, cache, mock)
 * @param {boolean} success - Whether the access was successful
 * @param {string} errorMessage - Error message if access failed
 * @returns {void}
 */
const logSecretAccess = (secretType, source, success, errorMessage = null) => {
    secretAccessLog.push({
        timestamp: new Date().toISOString(),
        secretType,
        source,
        success,
        error: errorMessage,
        // Add request metadata if needed (IP, user agent, etc.)
    });

    // Limit log size
    if (secretAccessLog.length > 1000) {
        secretAccessLog.shift();
    }
};

/**
 * Retrieves the secret access log
 * @returns {Array} Array of access log entries
 */
export const getSecretAccessLog = () => {
    // Return a copy of the log to prevent modification
    return [...secretAccessLog].map(entry => ({
        ...entry,
        // Replace secretType with a masked version for security
        secretType: entry.secretType ? `${entry.secretType.substring(0, 2)}***` : null
    }));
};

// Export default object with all functions
export default {
    getSecret,
    getMasterSeed,
    getEncryptionKeys,
    getApiKeys,
    clearSecretCache,
    getSecretAccessLog
}; 