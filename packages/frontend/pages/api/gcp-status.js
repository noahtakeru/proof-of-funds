/**
 * GCP Status Endpoint
 * 
 * Tests GCP integration and returns current status
 * This is a protected endpoint that requires authentication
 */

const { withAuth } = require('../../utils/auth');
const { initGcpAuth, getSecret } = require('../../utils/gcpAuth');
const { getAuthenticatedStorageClient } = require('../../utils/serviceAccountManager');

async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Test GCP authentication components
    const authStatus = await initGcpAuth();
    let storageStatus = { initialized: false };
    let secretStatus = { initialized: false };
    
    try {
      // Test storage client
      const storage = await getAuthenticatedStorageClient();
      const projectId = process.env.GCP_PROJECT_ID || 'proof-of-funds-455506';
      const bucketName = process.env.GCP_STORAGE_BUCKET || `${projectId}-zkeys`;
      
      // Check if bucket exists (without exceptions)
      const [exists] = await storage.bucket(bucketName).exists();
      
      storageStatus = {
        initialized: true,
        bucketExists: exists,
        bucketName,
        timestamp: new Date().toISOString()
      };
    } catch (storageError) {
      storageStatus = {
        initialized: false,
        error: storageError.message,
        timestamp: new Date().toISOString()
      };
    }
    
    // Only attempt secret operations if user is admin
    if (req.user && req.user.role === 'admin') {
      try {
        // Test a simple secret operation with a test secret
        // Don't expose any real secrets here
        const secretExists = await checkTestSecret();
        
        secretStatus = {
          initialized: true,
          testSecretExists: secretExists,
          timestamp: new Date().toISOString()
        };
      } catch (secretError) {
        secretStatus = {
          initialized: false,
          error: secretError.message,
          timestamp: new Date().toISOString()
        };
      }
    } else {
      secretStatus = {
        initialized: false,
        error: 'Admin privileges required for secret operations',
        timestamp: new Date().toISOString()
      };
    }
    
    // Return combined status
    return res.status(200).json({
      gcp: {
        projectId: process.env.GCP_PROJECT_ID || 'proof-of-funds-455506',
        environment: process.env.NODE_ENV,
        authentication: authStatus,
        storage: storageStatus,
        secretManager: secretStatus
      }
    });
  } catch (error) {
    console.error('GCP status check failed:', error);
    return res.status(500).json({
      error: 'Failed to check GCP status',
      message: error.message
    });
  }
}

/**
 * Check if test secret exists
 * Only used for connectivity verification
 */
async function checkTestSecret() {
  try {
    await getSecret('test-secret');
    return true;
  } catch (error) {
    if (error.message.includes('not found')) {
      return false;
    }
    throw error;
  }
}

// Export with authentication middleware
module.exports = withAuth(handler, { requireAdmin: true });