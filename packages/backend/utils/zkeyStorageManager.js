/**
 * ZKey Storage Manager for Google Cloud Storage
 * Handles large zkey files that exceed Secret Manager limits
 */

const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

class ZKeyStorageManager {
  constructor() {
    this.storage = new Storage();
    this.projectId = process.env.GCP_PROJECT_ID;
    this.bucketName = process.env.GCP_STORAGE_BUCKET || `${this.projectId}-zkeys`;
  }

  /**
   * Create storage bucket if it doesn't exist
   */
  async ensureBucket() {
    try {
      const [buckets] = await this.storage.getBuckets();
      const bucketExists = buckets.some(b => b.name === this.bucketName);
      
      if (!bucketExists) {
        console.log(`Creating bucket: ${this.bucketName}`);
        await this.storage.createBucket(this.bucketName, {
          location: 'US',
          storageClass: 'STANDARD',
          // Enable encryption
          encryption: {
            defaultKmsKeyName: process.env.GCP_KMS_KEY_NAME
          }
        });
        console.log(`✅ Bucket created: ${this.bucketName}`);
      }
      
      return this.storage.bucket(this.bucketName);
    } catch (error) {
      console.error('Error ensuring bucket:', error);
      throw error;
    }
  }

  /**
   * Upload zkey file to Google Cloud Storage
   * @param {string} circuitName - Name of the circuit (standard, threshold, maximum)
   * @param {string} localPath - Local path to the zkey file
   */
  async uploadZKey(circuitName, localPath) {
    try {
      const bucket = await this.ensureBucket();
      const fileName = `${circuitName}.zkey`;
      const file = bucket.file(fileName);
      
      console.log(`Uploading ${circuitName} zkey to Cloud Storage...`);
      
      // Create read stream
      const stream = fs.createReadStream(localPath);
      
      // Upload with metadata
      await file.save(stream, {
        metadata: {
          contentType: 'application/octet-stream',
          metadata: {
            circuit: circuitName,
            uploaded: new Date().toISOString()
          }
        },
        gzip: true,
        validation: 'md5'
      });
      
      // Set access control
      await file.makePrivate();
      
      console.log(`✅ ${circuitName} zkey uploaded successfully`);
      return `gs://${this.bucketName}/${fileName}`;
    } catch (error) {
      console.error(`Error uploading ${circuitName} zkey:`, error);
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
      const bucket = this.storage.bucket(this.bucketName);
      const fileName = `${circuitName}.zkey`;
      const file = bucket.file(fileName);
      
      const [exists] = await file.exists();
      if (!exists) {
        throw new Error(`ZKey for ${circuitName} not found in cloud storage`);
      }
      
      const [data] = await file.download();
      return data;
    } catch (error) {
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