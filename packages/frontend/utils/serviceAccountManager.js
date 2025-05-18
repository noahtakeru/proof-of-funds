/**
 * Service Account Manager
 * 
 * Secure Google Cloud authentication that integrates with the existing setup.
 * Implements the recommended practices from PRODUCTION-SECURITY.md.
 * Uses secure secret management for sensitive credentials.
 */

// Use our filesystem shim for better browser compatibility
const { fs, path } = require('./shims/fs');
// Use local shim for better compatibility with Pages Router
const { getSecret } = require('./shims/config/secrets');

// Check if running in browser or server environment
const isServer = typeof window === 'undefined';

// Cache the storage client once initialized
let storageClient = null;

/**
 * Get the Google Cloud credentials securely
 * @returns {Promise<Object>} Credentials object or file path
 */
async function getGoogleCloudCredentials() {
  // Browser environment should not use real credentials
  if (!isServer) {
    return { useDefault: true };
  }
  
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
      
      try {
        if (credentialsPath && fs.existsSync(credentialsPath)) {
          return { keyFilename: credentialsPath };
        }
      } catch (error) {
        console.warn(`Error checking credentials file existence: ${error.message}`);
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
      try {
        // Check if file exists
        if (fs.existsSync(credentialsPath)) {
          return { keyFilename: credentialsPath };
        } else {
          console.warn(`Warning: Credentials file not found at ${credentialsPath}`);
        }
      } catch (error) {
        console.warn(`Error checking credentials file existence: ${error.message}`);
      }
    }
    
    // Look for credentials file in common locations
    const possibleKeyPaths = [
      path.join(process.cwd(), 'gcp-sa-key.json'),
      path.join(process.cwd(), '..', '..', 'gcp-sa-key.json'),
      path.join(__dirname, '..', '..', '..', 'gcp-sa-key.json')
    ];
    
    for (const testPath of possibleKeyPaths) {
      try {
        if (fs.existsSync(testPath)) {
          return { keyFilename: testPath };
        }
      } catch (error) {
        // Continue trying other paths
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
  // Browser environment should not initialize storage client
  if (!isServer) {
    throw new Error('Google Cloud Storage client cannot be used in browser environment');
  }
  
  // If we already have a client, return it
  if (storageClient) {
    return storageClient;
  }
  
  // Dynamically import Storage to avoid bundling in browser
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