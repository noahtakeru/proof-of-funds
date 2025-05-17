/**
 * Alternative: Use Firebase Storage for zkey files
 * Simpler than setting up Cloud Storage permissions
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

class FirebaseStorageManager {
  constructor() {
    // Initialize Firebase Admin if not already done
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    this.bucket = admin.storage().bucket();
  }

  /**
   * Upload zkey file to Firebase Storage
   * @param {string} circuitName - Name of the circuit (standard, threshold, maximum)
   * @param {string} localPath - Local path to the zkey file
   */
  async uploadZKey(circuitName, localPath) {
    try {
      const fileName = `zkeys/${circuitName}.zkey`;
      const file = this.bucket.file(fileName);
      
      console.log(`Uploading ${circuitName} zkey to Firebase Storage...`);
      
      // Upload the file
      await this.bucket.upload(localPath, {
        destination: fileName,
        metadata: {
          contentType: 'application/octet-stream',
          metadata: {
            circuit: circuitName,
            uploaded: new Date().toISOString()
          }
        },
        gzip: true
      });
      
      console.log(`✅ ${circuitName} zkey uploaded successfully`);
      return `gs://${this.bucket.name}/${fileName}`;
    } catch (error) {
      console.error(`Error uploading ${circuitName} zkey:`, error);
      throw error;
    }
  }

  /**
   * Download zkey file from Firebase Storage
   * @param {string} circuitName - Name of the circuit
   * @returns {Promise<Buffer>} - The zkey file data
   */
  async getZKey(circuitName) {
    try {
      const fileName = `zkeys/${circuitName}.zkey`;
      const file = this.bucket.file(fileName);
      
      const [exists] = await file.exists();
      if (!exists) {
        throw new Error(`ZKey for ${circuitName} not found in Firebase storage`);
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
      const fileName = `zkeys/${circuitName}.zkey`;
      const file = this.bucket.file(fileName);
      
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

module.exports = FirebaseStorageManager;