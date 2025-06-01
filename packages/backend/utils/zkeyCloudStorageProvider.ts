/**
 * ZKey Provider implementation using Google Cloud Storage
 * 
 * This module implements the ZKeyProvider interface for Google Cloud Storage.
 * It is used for storing and retrieving larger ZK proving keys.
 */

import { Storage } from '@google-cloud/storage';
import { BaseZKeyProvider } from './zkeyProvider';
import { promises as fs } from 'fs';
import { Readable } from 'stream';

/**
 * ZKey provider using Google Cloud Storage
 */
export class CloudStorageZKeyProvider extends BaseZKeyProvider {
  private storage: Storage;
  private projectId: string;
  private bucketName: string;
  
  /**
   * Initialize the Cloud Storage provider
   */
  constructor() {
    super();
    this.storage = new Storage();
    this.projectId = process.env.GCP_PROJECT_ID || '';
    this.bucketName = process.env.GCP_STORAGE_BUCKET || 
                      (this.projectId ? `${this.projectId}-zkeys` : 'zkeys');
    
    if (!this.projectId) {
      console.warn('GCP_PROJECT_ID is not set in environment variables');
    }
  }
  
  /**
   * Ensure the storage bucket exists
   */
  private async ensureBucket() {
    try {
      const [buckets] = await this.storage.getBuckets();
      const bucketExists = buckets.some(b => b.name === this.bucketName);
      
      if (!bucketExists) {
        console.log(`Creating bucket: ${this.bucketName}`);
        await this.storage.createBucket(this.bucketName, {
          location: 'US',
          storageClass: 'STANDARD',
          encryption: process.env.GCP_KMS_KEY_NAME ? {
            defaultKmsKeyName: process.env.GCP_KMS_KEY_NAME
          } : undefined
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
   * Upload a ZKey file to Google Cloud Storage
   * @param circuitName Name of the circuit
   * @param localPath Local path to the zkey file
   */
  async uploadZKey(circuitName: string, localPath: string): Promise<string> {
    try {
      const bucket = await this.ensureBucket();
      const fileName = `${circuitName}.zkey`;
      const file = bucket.file(fileName);
      
      console.log(`Uploading ${circuitName} zkey to Cloud Storage...`);
      
      // Create read stream
      const fileContent = await fs.readFile(localPath);
      const stream = Readable.from(fileContent);
      
      // Upload with metadata
      await new Promise<void>((resolve, reject) => {
        stream
          .pipe(file.createWriteStream({
            metadata: {
              contentType: 'application/octet-stream',
              metadata: {
                circuit: circuitName,
                uploaded: new Date().toISOString()
              }
            },
            gzip: true,
            resumable: false
          }))
          .on('error', reject)
          .on('finish', resolve);
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
   * Get ZKey from Google Cloud Storage
   * @param circuitName Name of the circuit
   */
  async getZKey(circuitName: string): Promise<Buffer> {
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
   * @param circuitName Name of the circuit
   * @param expirationMinutes URL expiration in minutes
   */
  async getSignedUrl(circuitName: string, expirationMinutes = 5): Promise<string> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const fileName = `${circuitName}.zkey`;
      const file = bucket.file(fileName);
      
      const [exists] = await file.exists();
      if (!exists) {
        throw new Error(`ZKey for ${circuitName} not found in cloud storage`);
      }
      
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

export default CloudStorageZKeyProvider;