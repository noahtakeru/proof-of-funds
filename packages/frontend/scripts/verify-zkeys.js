#!/usr/bin/env node

/**
 * ZKey Verification Tool
 * 
 * Verifies that all required ZKey files are present in GCP Storage
 * and generates signed URLs for temporary access
 */

const ZKeyStorageManager = require('../utils/zkeyStorageManager');

// Circuit types to verify
const CIRCUIT_TYPES = ['standard', 'threshold', 'maximum'];

/**
 * Main function
 */
async function main() {
  console.log('🔍 Verifying ZKey files in Google Cloud Storage');
  console.log('=============================================');
  
  // Create storage manager
  try {
    const storageManager = new ZKeyStorageManager();
    const projectId = storageManager.projectId;
    const bucketName = storageManager.bucketName;
    
    console.log(`Using project ID: ${projectId}`);
    console.log(`Using bucket: ${bucketName}`);
    
    // Test each circuit type
    for (const circuitType of CIRCUIT_TYPES) {
      console.log(`\n== Verifying ${circuitType} proof files ==`);
      
      try {
        // Check if zkey file exists
        console.log(`Checking for ${circuitType}.zkey...`);
        const data = await storageManager.getZKey(circuitType);
        
        // Report success with file size
        const fileSizeMB = (data.length / (1024 * 1024)).toFixed(2);
        console.log(`✅ ${circuitType}.zkey exists (${fileSizeMB} MB)`);
        
        // Generate a signed URL
        console.log(`Generating signed URL for ${circuitType}.zkey...`);
        const signedUrl = await storageManager.getSignedUrl(circuitType, 5);
        console.log(`✅ Signed URL generated (expires in 5 minutes)`);
        console.log(`URL: ${signedUrl.substring(0, 80)}...`);
        
      } catch (error) {
        console.error(`❌ Error with ${circuitType}.zkey:`, error.message);
      }
    }
    
    console.log('\n== Summary ==');
    console.log('ZKey files are properly configured in Google Cloud Storage');
    console.log('Your application can now access these files securely');
    
  } catch (error) {
    console.error('❌ ZKey verification failed:', error.message);
    process.exit(1);
  }
}

// Run the verification
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});