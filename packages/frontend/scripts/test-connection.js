#!/usr/bin/env node

/**
 * GCP Connection Test
 * 
 * Tests connection to the existing GCP project for Proof of Funds
 * Verifies that all required GCP services are accessible
 */

const fs = require('fs');
const path = require('path');
const { getAuthenticatedStorageClient } = require('../utils/serviceAccountManager');
const { getSecretManagerClient } = require('../utils/gcpAuth');

// Default project settings - matches the existing project
const PROJECT_ID = 'proof-of-funds-455506';
const DEFAULT_BUCKET = `${PROJECT_ID}-zkeys`;
const SA_KEY_PATH = path.join(process.cwd(), '..', '..', 'gcp-sa-key.json');

// Configure environment for the test
process.env.GCP_PROJECT_ID = PROJECT_ID;
if (fs.existsSync(SA_KEY_PATH)) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = SA_KEY_PATH;
  console.log(`Using service account key at: ${SA_KEY_PATH}`);
} else {
  console.log('Service account key not found at expected location.');
  console.log('Will attempt to use application default credentials.');
}

/**
 * Main test function
 */
async function main() {
  console.log('🔍 Testing connection to GCP project:', PROJECT_ID);
  console.log('=======================================');
  
  let storageClient;
  let secretManagerClient;
  
  // Test Storage client
  try {
    console.log('\n== Testing Google Cloud Storage ==');
    storageClient = await getAuthenticatedStorageClient();
    console.log('✅ Successfully authenticated with Google Cloud Storage');
    
    // Check if zkeys bucket exists
    console.log(`\nChecking for bucket: ${DEFAULT_BUCKET}`);
    const bucket = storageClient.bucket(DEFAULT_BUCKET);
    const [exists] = await bucket.exists();
    
    if (exists) {
      console.log(`✅ Bucket '${DEFAULT_BUCKET}' exists`);
      
      // List some files in the bucket
      console.log('\nListing files in bucket:');
      const [files] = await bucket.getFiles({ maxResults: 5 });
      
      if (files.length === 0) {
        console.log('No files found in bucket.');
      } else {
        files.forEach(file => {
          console.log(`- ${file.name}`);
        });
        if (files.length === 5) {
          console.log('(Showing first 5 files only)');
        }
      }
    } else {
      console.warn(`⚠️ Bucket '${DEFAULT_BUCKET}' does not exist`);
      console.log('You may need to create it with:');
      console.log(`gsutil mb -l us-central1 gs://${DEFAULT_BUCKET}`);
    }
  } catch (error) {
    console.error('❌ Storage connection test failed:', error.message);
  }
  
  // Test Secret Manager client
  try {
    console.log('\n== Testing Google Secret Manager ==');
    secretManagerClient = await getSecretManagerClient();
    console.log('✅ Successfully authenticated with Google Secret Manager');
    
    // List available secrets
    console.log('\nListing available secrets:');
    const [secrets] = await secretManagerClient.listSecrets({
      parent: `projects/${PROJECT_ID}`
    });
    
    if (secrets.length === 0) {
      console.log('No secrets found in project.');
    } else {
      secrets.forEach(secret => {
        // Extract just the secret name from the full path
        const name = secret.name.split('/').pop();
        console.log(`- ${name}`);
      });
    }
  } catch (error) {
    console.error('❌ Secret Manager connection test failed:', error.message);
  }
  
  console.log('\n== Summary ==');
  
  if (storageClient) {
    console.log('✅ Google Cloud Storage: Connected');
  } else {
    console.log('❌ Google Cloud Storage: Failed');
  }
  
  if (secretManagerClient) {
    console.log('✅ Google Secret Manager: Connected');
  } else {
    console.log('❌ Google Secret Manager: Failed');
  }
  
  console.log('\nNext steps:');
  if (storageClient && secretManagerClient) {
    console.log('- All services are working correctly');
    console.log('- You can now use the GCP integration in your application');
  } else {
    console.log('- Check service account permissions');
    console.log('- Ensure all required APIs are enabled');
    console.log('- Verify the service account key is valid');
  }
}

// Run the test
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});