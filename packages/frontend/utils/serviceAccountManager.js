/**
 * Service Account Manager
 * 
 * Secure Google Cloud authentication that integrates with the existing setup.
 * Implements the recommended practices from PRODUCTION-SECURITY.md.
 * Uses secure secret management for sensitive credentials.
 */

const fs = require('fs');
const path = require('path');
const { getSecret } = require('@proof-of-funds/common/src/config/secrets');

// Cache the storage client once initialized
let storageClient = null;

/**
 * Get the Google Cloud credentials securely
 * @returns {Promise<Object>} Credentials object or file path
 */
async function getGoogleCloudCredentials() {
  // In production, retrieve credentials securely
  if (process.env.NODE_ENV === 'production') {
    // Priority 1: Running on Google Cloud - use built-in identity
    if (process.env.GOOGLE_CLOUD_PROJECT) {
      return { useDefault: true };
    }
    
    // Priority 2: Service account JSON from Secret Manager
    try {
      const serviceAccountJson = await getSecret('GCP_SERVICE_ACCOUNT', {
        required: false,
        fallback: process.env.GCP_SERVICE_ACCOUNT
      });
      
      if (serviceAccountJson) {
        const credentials = JSON.parse(serviceAccountJson);
        return { credentials };
      }
    } catch (error) {
      console.warn('Failed to retrieve service account JSON from Secret Manager:', error.message);
      // Continue to try other methods
    }
    
    // Priority 3: Individual credential parts from Secret Manager
    try {
      const projectId = await getSecret('GCP_PROJECT_ID', {
        required: false,
        fallback: process.env.GCP_PROJECT_ID
      });
      
      const clientEmail = await getSecret('GCP_CLIENT_EMAIL', {
        required: false,
        fallback: process.env.GCP_CLIENT_EMAIL
      });
      
      const privateKey = await getSecret('GCP_PRIVATE_KEY', {
        required: false,
        fallback: process.env.GCP_PRIVATE_KEY
      });
      
      if (projectId && clientEmail && privateKey) {
        return {
          projectId,
          credentials: {
            client_email: clientEmail,
            private_key: privateKey.replace(/\\n/g, '\n')
          }
        };
      }
    } catch (error) {
      console.warn('Failed to retrieve individual GCP credentials from Secret Manager:', error.message);
      // Continue to try other methods
    }
    
    // Priority 4: Credentials file path from Secret Manager
    try {
      const credentialsPath = await getSecret('GOOGLE_APPLICATION_CREDENTIALS', {
        required: false,
        fallback: process.env.GOOGLE_APPLICATION_CREDENTIALS
      });
      
      if (credentialsPath && fs.existsSync(credentialsPath)) {
        return { keyFilename: credentialsPath };
      }
    } catch (error) {
      console.warn('Failed to retrieve credentials file path from Secret Manager:', error.message);
      // Continue to try other methods
    }
    
    // Last resort: Default credentials
    return { useDefault: true };
  } else {
    // Development environment - use existing gcp-sa-key.json or env vars
    // Try environment variable first
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (credentialsPath) {
      // Check if file exists
      if (fs.existsSync(credentialsPath)) {
        return { keyFilename: credentialsPath };
      } else {
        console.warn(`Warning: Credentials file not found at ${credentialsPath}`);
      }
    }
    
    // Look for credentials file in common locations
    const possibleKeyPaths = [
      path.join(process.cwd(), 'gcp-sa-key.json'),
      path.join(process.cwd(), '..', '..', 'gcp-sa-key.json'),
      path.join(__dirname, '..', '..', '..', 'gcp-sa-key.json')
    ];
    
    for (const testPath of possibleKeyPaths) {
      if (fs.existsSync(testPath)) {
        return { keyFilename: testPath };
      }
    }
    
    // Last resort: Default credentials
    return { useDefault: true };
  }
}

/**
 * Initialize the Google Cloud Storage client with appropriate authentication
 * Prioritizes secure authentication methods based on deployment environment
 * @returns {Promise<Object>} Authenticated storage client
 */
async function getAuthenticatedStorageClient() {
  // If we already have a client, return it
  if (storageClient) {
    return storageClient;
  }
  
  const { Storage } = require('@google-cloud/storage');
  
  try {
    // Get credentials securely
    const credentials = await getGoogleCloudCredentials();
    
    // Log authentication method for debugging (without exposing sensitive details)
    if (credentials.useDefault) {
      console.log('Using application default credentials');
      storageClient = new Storage();
    } else if (credentials.keyFilename) {
      console.log(`Using credentials file at ${credentials.keyFilename}`);
      storageClient = new Storage({ keyFilename: credentials.keyFilename });
    } else if (credentials.credentials) {
      console.log('Using explicit credentials from secure storage');
      storageClient = new Storage({
        projectId: credentials.projectId,
        credentials: credentials.credentials
      });
    } else {
      // Fallback to default credentials
      console.warn('No GCP credentials found, falling back to application default credentials');
      storageClient = new Storage();
    }
    
    return storageClient;
  } catch (error) {
    console.error('GCP authentication error:', error);
    throw new Error(`Failed to authenticate with Google Cloud: ${error.message}`);
  }
}

module.exports = {
  getAuthenticatedStorageClient
};