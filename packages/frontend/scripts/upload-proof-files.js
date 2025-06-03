#!/usr/bin/env node

/**
 * Upload Proof Files to Google Cloud Storage
 * 
 * This script uploads the zkey and other proof-related files
 * to Google Cloud Storage for secure access by the application.
 */

const fs = require('fs');
const path = require('path');
const { Storage } = require('@google-cloud/storage');
const { getAuthenticatedStorageClient } = require('../utils/serviceAccountManager');

// Configuration
const CIRCUIT_TYPES = ['standard', 'threshold', 'maximum'];
const SOURCE_DIR = path.join(__dirname, '..', '..', '..', 'circuits');

/**
 * Upload a file to Google Cloud Storage
 * @param {Object} storage - Authenticated storage client
 * @param {string} bucketName - Name of the bucket
 * @param {string} sourceFile - Path to local file
 * @param {string} destinationFile - Name in cloud storage
 * @returns {Promise<boolean>} - Whether upload succeeded
 */
async function uploadFile(storage, bucketName, sourceFile, destinationFile) {
  try {
    console.log(`Uploading ${sourceFile} to gs://${bucketName}/${destinationFile}...`);
    
    // Check if source file exists
    if (!fs.existsSync(sourceFile)) {
      console.error(`❌ Source file not found: ${sourceFile}`);
      return false;
    }
    
    // Get bucket reference
    const bucket = storage.bucket(bucketName);
    
    // Upload file
    await bucket.upload(sourceFile, {
      destination: destinationFile,
      // Set metadata for the object
      metadata: {
        contentType: 'application/octet-stream',
        cacheControl: 'private, max-age=0'
      }
    });
    
    console.log(`✅ Uploaded ${destinationFile}`);
    return true;
  } catch (error) {
    console.error(`❌ Error uploading ${destinationFile}:`, error.message);
    return false;
  }
}

/**
 * Ensure the bucket exists
 * @param {Object} storage - Authenticated storage client
 * @param {string} bucketName - Name of the bucket
 * @returns {Promise<boolean>} - Whether bucket exists/created
 */
async function ensureBucket(storage, bucketName) {
  try {
    // Check if bucket exists
    const [buckets] = await storage.getBuckets();
    const bucketExists = buckets.some(bucket => bucket.name === bucketName);
    
    if (bucketExists) {
      console.log(`✅ Bucket ${bucketName} already exists`);
      return true;
    }
    
    // Create bucket if it doesn't exist
    console.log(`Creating bucket: ${bucketName}`);
    await storage.createBucket(bucketName, {
      location: 'us-central1',
      storageClass: 'STANDARD'
    });
    
    console.log(`✅ Created bucket: ${bucketName}`);
    return true;
  } catch (error) {
    console.error('❌ Error managing bucket:', error.message);
    return false;
  }
}

/**
 * Upload all proof files for a circuit type
 * @param {Object} storage - Authenticated storage client
 * @param {string} bucketName - Name of the bucket
 * @param {string} circuitType - Type of circuit (standard, threshold, etc.)
 * @returns {Promise<boolean>} - Whether all uploads succeeded
 */
async function uploadCircuitFiles(storage, bucketName, circuitType) {
  console.log(`\n== Processing ${circuitType} proof files ==`);
  
  try {
    // zkey file
    const zkeySource = path.join(SOURCE_DIR, circuitType, `${circuitType}Proof_js`, `${circuitType}Proof_final.zkey`);
    const zkeyDest = `${circuitType}.zkey`;
    const zkeyUploaded = await uploadFile(storage, bucketName, zkeySource, zkeyDest);
    if (!zkeyUploaded) {return false;}
    
    // wasm file - verify it exists locally
    const wasmSource = path.join(SOURCE_DIR, circuitType, `${circuitType}Proof_js`, `${circuitType}Proof.wasm`);
    if (!fs.existsSync(wasmSource)) {
      console.warn(`⚠️ WASM file not found at ${wasmSource}`);
    }
    
    // vkey file - verify it exists locally
    const vkeySource = path.join(SOURCE_DIR, circuitType, `${circuitType}Proof.vkey.json`);
    if (!fs.existsSync(vkeySource)) {
      console.warn(`⚠️ Verification key not found at ${vkeySource}`);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Error processing ${circuitType} files:`, error.message);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting proof file upload to Google Cloud Storage...');
  
  try {
    // Get authenticated storage client
    console.log('Authenticating with GCP...');
    const storage = await getAuthenticatedStorageClient();
    
    // Get bucket name from environment or use default
    const projectId = process.env.GCP_PROJECT_ID || 'proof-of-funds-455506';
    const bucketName = process.env.GCP_STORAGE_BUCKET || `${projectId}-zkeys`;
    
    console.log(`Using bucket: ${bucketName}`);
    
    // Ensure bucket exists
    const bucketReady = await ensureBucket(storage, bucketName);
    if (!bucketReady) {
      console.error('❌ Failed to set up bucket, exiting');
      process.exit(1);
    }
    
    // Upload each circuit type
    let allSucceeded = true;
    for (const circuitType of CIRCUIT_TYPES) {
      const success = await uploadCircuitFiles(storage, bucketName, circuitType);
      if (!success) {
        allSucceeded = false;
        console.error(`❌ Failed to upload ${circuitType} files`);
      }
    }
    
    if (allSucceeded) {
      console.log('\n✅ All proof files uploaded successfully!');
    } else {
      console.error('\n⚠️ Some files failed to upload. See errors above.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Unhandled error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();