/**
 * Service Account Manager
 * 
 * Secure Google Cloud authentication that integrates with the existing setup.
 * Implements the recommended practices from PRODUCTION-SECURITY.md.
 */

const fs = require('fs');
const path = require('path');

// Cache the storage client once initialized
let storageClient = null;

/**
 * Initialize the Google Cloud Storage client with appropriate authentication
 * Prioritizes secure authentication methods based on deployment environment
 * @returns {Object} Authenticated storage client
 */
async function getAuthenticatedStorageClient() {
  // If we already have a client, return it
  if (storageClient) {
    return storageClient;
  }
  
  const { Storage } = require('@google-cloud/storage');
  
  try {
    // Create storage client based on environment
    if (process.env.NODE_ENV === 'production') {
      // Production environments
      if (process.env.GOOGLE_CLOUD_PROJECT) {
        // Running on Google Cloud (Cloud Run, App Engine, etc)
        // Use built-in service identity - most secure option
        console.log('Using Google Cloud built-in authentication');
        storageClient = new Storage();
      } else if (process.env.VERCEL) {
        // Vercel deployment - use environment variables
        console.log('Using Vercel environment authentication');
        
        // Check if we have service account JSON
        if (process.env.GCP_SERVICE_ACCOUNT) {
          try {
            const credentials = JSON.parse(process.env.GCP_SERVICE_ACCOUNT);
            storageClient = new Storage({ credentials });
          } catch (error) {
            console.error('Error parsing GCP_SERVICE_ACCOUNT:', error);
            throw new Error('Invalid service account JSON in environment variables');
          }
        } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
          // Fall back to credentials file if specified
          storageClient = new Storage({ 
            keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS 
          });
        } else {
          throw new Error('No GCP credentials found in Vercel environment');
        }
      } else {
        // Other production environment - use environment variables
        console.log('Using generic production authentication');
        
        // Try all possible credential sources
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
          // Use credentials file
          storageClient = new Storage({ 
            keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS 
          });
        } else if (process.env.GCP_PROJECT_ID && process.env.GCP_PRIVATE_KEY) {
          // Use explicit credentials from environment variables
          storageClient = new Storage({
            projectId: process.env.GCP_PROJECT_ID,
            credentials: {
              client_email: process.env.GCP_CLIENT_EMAIL,
              private_key: process.env.GCP_PRIVATE_KEY.replace(/\\n/g, '\n')
            }
          });
        } else {
          // Last resort - try application default credentials
          storageClient = new Storage();
        }
      }
    } else {
      // Development environment - use existing gcp-sa-key.json or env vars
      console.log('Using development authentication');
      
      // Try environment variable first
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        console.log(`Using credentials from GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
        
        // Check if file exists
        if (!fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
          console.warn(`Warning: Credentials file not found at ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
        }
        
        storageClient = new Storage({ 
          keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS 
        });
      } else {
        // Look for credentials file in common locations
        const possibleKeyPaths = [
          path.join(process.cwd(), 'gcp-sa-key.json'),
          path.join(process.cwd(), '..', '..', 'gcp-sa-key.json'),
          path.join(__dirname, '..', '..', '..', 'gcp-sa-key.json')
        ];
        
        let keyFilePath = null;
        for (const testPath of possibleKeyPaths) {
          if (fs.existsSync(testPath)) {
            keyFilePath = testPath;
            break;
          }
        }
        
        if (keyFilePath) {
          console.log(`Using credentials file at ${keyFilePath}`);
          storageClient = new Storage({ keyFilename: keyFilePath });
        } else {
          console.warn('No GCP credentials file found, falling back to application default credentials');
          storageClient = new Storage();
        }
      }
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