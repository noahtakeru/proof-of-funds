/**
 * Secrets management shim for Next.js Pages Router
 * This provides the same interface as @proof-of-funds/common/src/config/secrets
 * but is compatible with the Pages Router build process.
 */

// Secret cache to avoid repeated calls
const secretCache = new Map();

/**
 * Get a secret from environment or Secret Manager
 * @param {string} key - Secret key
 * @param {Object} options - Options for fetching
 * @returns {Promise<string>} - Secret value
 */
async function getSecret(key, options = {}) {
  const {
    required = false,
    cacheTime = 60 * 60 * 1000, // 1 hour cache
    fallback = null,
  } = options;
  
  // Format key to GCP-compatible format
  const gcpKey = key.toLowerCase().replace(/_/g, '-');
  
  // Return from cache if available and not expired
  const cached = secretCache.get(gcpKey);
  if (cached && cached.timestamp > Date.now() - cacheTime) {
    return cached.value;
  }
  
  // First check environment variable
  if (process.env[key]) {
    const value = process.env[key];
    // Cache the value
    secretCache.set(gcpKey, {
      value,
      timestamp: Date.now()
    });
    return value;
  }
  
  // In development, return fallback
  if (process.env.NODE_ENV !== 'production') {
    if (fallback !== null) {
      return fallback;
    }
    
    // If required, throw error
    if (required) {
      throw new Error(`Required secret ${key} not found in environment variables`);
    }
    
    return null;
  }
  
  // In API Routes, we can access GCP Secret Manager
  // For browser code, just return fallback since we can't access GCP
  if (typeof window !== 'undefined') {
    return fallback;
  }
  
  try {
    // Only attempt to load GCP Secret Manager in Node.js environment
    // This won't be bundled for browser since it's inside an isServer check
    const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
    const projectId = process.env.GCP_PROJECT_ID || 'proof-of-funds-455506';
    const client = new SecretManagerServiceClient();
    const secretPath = `projects/${projectId}/secrets/${gcpKey}/versions/latest`;
    
    // Access the secret version
    const [version] = await client.accessSecretVersion({ name: secretPath });
    const value = version.payload.data.toString('utf8');
    
    // Cache the value
    secretCache.set(gcpKey, {
      value,
      timestamp: Date.now()
    });
    
    return value;
  } catch (error) {
    console.error(`Error fetching secret ${key}:`, error);
    
    // If fallback provided, use it
    if (fallback !== null) {
      return fallback;
    }
    
    // If required, throw error
    if (required) {
      throw new Error(`Required secret ${key} not found in Secret Manager`);
    }
    
    return null;
  }
}

module.exports = {
  getSecret
};