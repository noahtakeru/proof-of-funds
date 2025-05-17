/**
 * Secure Environment Variables Management
 * 
 * This module provides a unified way to access sensitive environment variables
 * and secrets, with support for:
 * 1. Local environment variables
 * 2. GCP Secret Manager integration for production
 * 3. Caching for performance optimization
 * 4. Fallback values for development environments
 */

const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

// Secret cache to avoid repeated calls
const secretCache = new Map();

/**
 * Get a secret from environment or Secret Manager
 * 
 * @param {string} key - Secret key
 * @param {Object} options - Options for fetching
 * @returns {Promise<string>} - Secret value
 */
async function getSecret(key, options = {}) {
  const {
    required = false,
    cacheTime = 60 * 60 * 1000, // 1 hour cache
    fallback = null,
    projectId = process.env.GCP_PROJECT_ID || 'proof-of-funds-455506',
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
  
  // In production, try Secret Manager
  try {
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