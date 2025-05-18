/**
 * ZKey Storage Manager for Google Cloud Storage
 * Handles large zkey files that exceed Secret Manager limits
 * Uses secure service account management practices
 */

const { getAuthenticatedStorageClient } = require('./serviceAccountManager');

class ZKeyStorageManager {
  constructor() {
    // Only initialize Cloud Storage on server-side
    if (typeof window === 'undefined') {
      // Initialize properties that don't require async operations
      this.projectId = process.env.GCP_PROJECT_ID || 'proof-of-funds-455506';
      if (!this.projectId) {
        throw new Error('GCP_PROJECT_ID environment variable is not set');
      }
      
      this.bucketName = process.env.GCP_STORAGE_BUCKET || `${this.projectId}-zkeys`;
      
      // Storage client will be initialized on first use
      this.storagePromise = null;
    }
  }
  
  /**
   * Get or initialize the storage client
   * @returns {Promise<Object>} - Authenticated storage client
   */
  async getStorageClient() {
    // Initialize storage client on first use
    if (!this.storagePromise) {
      this.storagePromise = getAuthenticatedStorageClient();
    }
    
    try {
      // Wait for storage client initialization
      this.storage = await this.storagePromise;
      return this.storage;
    } catch (error) {
      console.error('Error initializing storage client:', error);
      throw new Error(`Failed to initialize GCP storage client: ${error.message}`);
    }
  }

  /**
   * Create storage bucket if it doesn't exist
   */
  async ensureBucket() {
    try {
      const storage = await this.getStorageClient();
      
      const [buckets] = await storage.getBuckets();
      const bucketExists = buckets.some(b => b.name === this.bucketName);
      
      if (!bucketExists) {
        await storage.createBucket(this.bucketName, {
          location: 'US',
          storageClass: 'STANDARD',
          // Enable encryption
          encryption: {
            defaultKmsKeyName: process.env.GCP_KMS_KEY_NAME
          }
        });
      }
      
      return storage.bucket(this.bucketName);
    } catch (error) {
      console.error('Error ensuring bucket:', error);
      throw error;
    }
  }

  /**
   * Download zkey file from Google Cloud Storage
   * @param {string} circuitName - Name of the circuit
   * @returns {Promise<Buffer>} - The zkey file data
   */
  async getZKey(circuitName) {
    try {
      const storage = await this.getStorageClient();
      
      const bucket = storage.bucket(this.bucketName);
      const fileName = `${circuitName}.zkey`;
      const file = bucket.file(fileName);

      const [exists] = await file.exists();
      if (!exists) {
        throw new Error(`ZKey file "${fileName}" not found in bucket "${this.bucketName}". Please run deployment script to upload zkey files.`);
      }

      const [data] = await file.download();

      return data;
    } catch (error) {
      if (error.code === 403) {
        throw new Error(`Permission denied accessing Cloud Storage. Check service account permissions.`);
      } else if (error.code === 404) {
        throw new Error(`Bucket "${this.bucketName}" not found. Ensure bucket exists and is accessible.`);
      }
      console.error(`Error downloading ${circuitName} zkey:`, error);
      throw error;
    }
  }

  /**
   * Generate a signed URL for temporary access
   * @param {string} circuitName - Name of the circuit
   * @param {number} expirationMinutes - URL expiration in minutes
   * @returns {Promise<string>} - Signed URL
   */
  async getSignedUrl(circuitName, expirationMinutes = 5) {
    try {
      const storage = await this.getStorageClient();
      
      const bucket = storage.bucket(this.bucketName);
      const fileName = `${circuitName}.zkey`;
      const file = bucket.file(fileName);
      
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + expirationMinutes * 60 * 1000
      });
      
      return signedUrl;
    } catch (error) {
      console.error(`Error generating signed URL for ${circuitName}:`, error);
      throw error;
    }
  }
}

module.exports = ZKeyStorageManager;