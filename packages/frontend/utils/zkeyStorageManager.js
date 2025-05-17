/**
 * ZKey Storage Manager for Google Cloud Storage
 * Handles large zkey files that exceed Secret Manager limits
 */

class ZKeyStorageManager {
  constructor() {
    // Only initialize Cloud Storage on server-side
    if (typeof window === 'undefined') {
      const { Storage } = require('@google-cloud/storage');
      
      // Check for required environment variables with fallback
      const projectId = process.env.GCP_PROJECT_ID || 'proof-of-funds-455506';
      if (!projectId) {
        throw new Error('GCP_PROJECT_ID environment variable is not set');
      }
      
      if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        console.warn('GOOGLE_APPLICATION_CREDENTIALS not set, using default authentication');
      }
      
      // Resolve the path to the key file
      const path = require('path');
      const fs = require('fs');
      
      // Try environment variable first
      let keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      
      // If no env var, try to find the key file in several locations
      if (!keyFilePath) {
        // Check common locations in Next.js projects
        const possiblePaths = [
          path.join(process.cwd(), 'gcp-sa-key.json'),
          path.join(process.cwd(), '..', '..', 'gcp-sa-key.json'),  // From packages/frontend
          path.join(__dirname, '..', '..', '..', 'gcp-sa-key.json'), // From utils directory
          '/Users/karpel/Desktop/GitHub/proof-of-funds/gcp-sa-key.json' // Absolute path fallback
        ];
        
        for (const testPath of possiblePaths) {
          if (fs.existsSync(testPath)) {
            keyFilePath = testPath;

            break;
          }
        }
        
        if (!keyFilePath) {
          console.error('GCP key file not found. Searched paths:');
          possiblePaths.forEach(p => console.error(`  - ${p}`));
          console.error('Current working directory:', process.cwd());
          console.error('__dirname:', __dirname);
          throw new Error('Cannot find gcp-sa-key.json');
        }
      }
      
      // Verify the file exists at the resolved path
      if (!fs.existsSync(keyFilePath)) {
        throw new Error(`GCP key file not found at resolved path: ${keyFilePath}`);
      }

      this.storage = new Storage({
        projectId: projectId,
        keyFilename: keyFilePath
      });
      
      this.projectId = projectId;
      this.bucketName = process.env.GCP_STORAGE_BUCKET || `${this.projectId}-zkeys`;

    }
  }

  /**
   * Create storage bucket if it doesn't exist
   */
  async ensureBucket() {
    try {
      const [buckets] = await this.storage.getBuckets();
      const bucketExists = buckets.some(b => b.name === this.bucketName);
      
      if (!bucketExists) {

        await this.storage.createBucket(this.bucketName, {
          location: 'US',
          storageClass: 'STANDARD',
          // Enable encryption
          encryption: {
            defaultKmsKeyName: process.env.GCP_KMS_KEY_NAME
          }
        });

      }
      
      return this.storage.bucket(this.bucketName);
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
      if (!this.storage) {
        throw new Error('Cloud Storage not initialized - missing environment variables');
      }
      
      const bucket = this.storage.bucket(this.bucketName);
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
      const bucket = this.storage.bucket(this.bucketName);
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