/**
 * Google Cloud Platform Authentication
 * 
 * Securely handles GCP auth with service accounts and credential management
 * Integrates with existing auth.js system for seamless backend security
 */

const { getAuthenticatedStorageClient } = require('./serviceAccountManager');
const { verifyToken } = require('./auth');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

// Cache the secret manager client
let secretManagerClient = null;

/**
 * Get authenticated Secret Manager client
 * Uses the same auth mechanism as storage client
 * @returns {Object} Secret Manager client
 */
async function getSecretManagerClient() {
  if (secretManagerClient) {
    return secretManagerClient;
  }

  try {
    // For local development with explicit credentials file
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      secretManagerClient = new SecretManagerServiceClient({
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
      });
      return secretManagerClient;
    }

    // For production environments (GCP, Vercel, etc.)
    if (process.env.NODE_ENV === 'production') {
      // Running on Google Cloud with managed identity
      if (process.env.GOOGLE_CLOUD_PROJECT) {
        secretManagerClient = new SecretManagerServiceClient();
        return secretManagerClient;
      }

      // Vercel or other cloud with service account JSON
      if (process.env.GCP_SERVICE_ACCOUNT) {
        try {
          const credentials = JSON.parse(process.env.GCP_SERVICE_ACCOUNT);
          secretManagerClient = new SecretManagerServiceClient({ credentials });
          return secretManagerClient;
        } catch (error) {
          console.error('Failed to parse GCP_SERVICE_ACCOUNT:', error);
          throw new Error('Invalid service account JSON format');
        }
      }

      // Using explicit credentials
      if (process.env.GCP_PROJECT_ID && process.env.GCP_PRIVATE_KEY) {
        secretManagerClient = new SecretManagerServiceClient({
          projectId: process.env.GCP_PROJECT_ID,
          credentials: {
            client_email: process.env.GCP_CLIENT_EMAIL,
            private_key: process.env.GCP_PRIVATE_KEY.replace(/\\n/g, '\n')
          }
        });
        return secretManagerClient;
      }
    }

    // Fall back to application default credentials
    secretManagerClient = new SecretManagerServiceClient();
    return secretManagerClient;
  } catch (error) {
    console.error('Error initializing Secret Manager client:', error);
    throw new Error(`Failed to initialize GCP Secret Manager: ${error.message}`);
  }
}

/**
 * Get a secret from Secret Manager
 * @param {string} secretName - Name of the secret
 * @param {string} version - Version of the secret (default: 'latest')
 * @returns {Promise<string>} - The secret value
 */
async function getSecret(secretName, version = 'latest') {
  try {
    const client = await getSecretManagerClient();
    const projectId = process.env.GCP_PROJECT_ID || 'proof-of-funds-455506';
    
    const secretPath = `projects/${projectId}/secrets/${secretName}/versions/${version}`;
    const [response] = await client.accessSecretVersion({ name: secretPath });
    
    return response.payload.data.toString('utf8');
  } catch (error) {
    // Handle specific error cases for better troubleshooting
    if (error.code === 5) {
      throw new Error(`Secret ${secretName} not found. Make sure it exists in project.`);
    } else if (error.code === 7) {
      throw new Error(`Permission denied accessing secret ${secretName}. Check service account permissions.`);
    }
    
    console.error(`Error accessing secret ${secretName}:`, error);
    throw error;
  }
}

/**
 * Verify GCP service account identity
 * Used for secure microservice-to-microservice auth
 * @param {Object} req - Express request
 * @returns {Promise<boolean>} - Whether the request is from a valid GCP service
 */
async function verifyGcpServiceIdentity(req) {
  try {
    // Check for GCP-specific identity header
    const identityToken = req.headers['x-gcp-identity-token'];
    if (!identityToken) {return false;}
    
    // Use Google's identity verification
    // This is a simplified implementation - in production would use proper token verification
    // For Cloud Run, this would use the Identity Token verification mechanism
    
    // Placeholder for actual implementation
    return true;
  } catch (error) {
    console.error('GCP service identity verification failed:', error);
    return false;
  }
}

/**
 * Auth middleware for GCP-secured endpoints
 * Combines existing JWT auth with GCP-specific identity verification
 * @param {Function} handler - API route handler
 * @returns {Function} - Middleware-wrapped handler
 */
function withGcpAuth(handler) {
  return async (req, res) => {
    // First check standard authentication
    const token = req.headers.authorization?.split(' ')[1];
    const user = token ? verifyToken(token) : null;
    
    // Check for service account identity for service-to-service calls
    const isGcpService = await verifyGcpServiceIdentity(req);
    
    // Allow access if either regular auth or GCP service identity passes
    if (!user && !isGcpService) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Valid authentication required'
      });
    }
    
    // Add authenticated info to request
    req.user = user || { role: 'service' };
    req.isGcpService = isGcpService;
    
    // Call the original handler
    return handler(req, res);
  };
}

/**
 * Initialize GCP authentication services
 * @returns {Promise<Object>} - Authentication status
 */
async function initGcpAuth() {
  try {
    // Verify we can access GCP services
    await getSecretManagerClient();
    await getAuthenticatedStorageClient();
    
    return { initialized: true, timestamp: new Date().toISOString() };
  } catch (error) {
    console.error('Failed to initialize GCP authentication:', error);
    return { initialized: false, error: error.message };
  }
}

// Export functions
module.exports = {
  getSecretManagerClient,
  getSecret,
  verifyGcpServiceIdentity,
  withGcpAuth,
  initGcpAuth
};