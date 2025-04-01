/**
 * GCP Secret Manager Configuration
 * 
 * This file contains configuration for accessing secrets in Google Cloud Secret Manager.
 * It supports different environments (development, testing, production) and
 * provides proper error handling for missing environment variables.
 */

// Default project and location 
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || 'proof-of-funds-455506';
const GCP_LOCATION = process.env.GCP_LOCATION || 'global';

// Secret names by environment
const secretPaths = {
    development: {
        masterSeed: 'projects/proof-of-funds-455506/secrets/master-seed-dev/versions/latest',
        encryptionKeys: 'projects/proof-of-funds-455506/secrets/encryption-keys-dev/versions/latest',
        apiKeys: 'projects/proof-of-funds-455506/secrets/api-keys-dev/versions/latest',
    },
    test: {
        masterSeed: 'projects/proof-of-funds-455506/secrets/master-seed-test/versions/latest',
        encryptionKeys: 'projects/proof-of-funds-455506/secrets/encryption-keys-test/versions/latest',
        apiKeys: 'projects/proof-of-funds-455506/secrets/api-keys-test/versions/latest',
    },
    production: {
        masterSeed: 'projects/proof-of-funds-455506/secrets/master-seed/versions/latest',
        encryptionKeys: 'projects/proof-of-funds-455506/secrets/encryption-keys/versions/latest',
        apiKeys: 'projects/proof-of-funds-455506/secrets/api-keys/versions/latest',
    }
};

// Authentication settings
const authConfig = {
    // Use default credentials from environment if available (GCP runtime)
    useDefaultCredentials: process.env.USE_GCP_DEFAULT_CREDENTIALS === 'true',

    // For local development, use service account key
    serviceAccountKeyPath: process.env.GCP_SERVICE_ACCOUNT_KEY_PATH || './service-account-key.json',

    // Option to mock secrets for testing/development
    useMockSecrets: process.env.USE_MOCK_SECRETS === 'true'
};

// Mock secrets for development/testing (NEVER use these in production)
const mockSecrets = {
    // Random hex string (32 bytes) - ONLY FOR DEVELOPMENT
    masterSeed: '0x6d795f64756d6d795f6d61737465725f736565645f666f725f74657374696e67',

    // Sample encryption keys structure
    encryptionKeys: JSON.stringify({
        current: 'key1',
        keys: {
            key1: 'dummy_encryption_key_1_for_testing_only',
            key2: 'dummy_encryption_key_2_for_testing_only'
        }
    }),

    // Sample API keys
    apiKeys: JSON.stringify({
        polygon: {
            rpc: 'https://rpc-amoy.polygon.technology',
            apiKey: 'dummy_polygon_api_key'
        },
        etherscan: 'dummy_etherscan_api_key'
    })
};

// Get current environment
const getEnvironment = () => {
    const env = process.env.NODE_ENV || 'development';
    if (!secretPaths[env]) {
        console.warn(`Unknown environment: ${env}, falling back to development`);
        return 'development';
    }
    return env;
};

// Get secret path based on current environment and secret type
const getSecretPath = (secretType) => {
    const env = getEnvironment();
    const path = secretPaths[env][secretType];

    if (!path) {
        throw new Error(`Secret path not found for type: ${secretType} in environment: ${env}`);
    }

    return path;
};

// Config export
const gcpSecretConfig = {
    projectId: GCP_PROJECT_ID,
    location: GCP_LOCATION,
    getSecretPath,
    auth: authConfig,
    mockSecrets,
    isMockingEnabled: () => authConfig.useMockSecrets
};

export default gcpSecretConfig;