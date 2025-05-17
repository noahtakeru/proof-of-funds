/**
 * Deploy zkey files to Google Cloud Storage
 * For files too large for Secret Manager
 */

require('dotenv').config({ path: '.env.local' });
const ZKeyStorageManager = require('../packages/backend/utils/zkeyStorageManager');
const path = require('path');

// Set environment variables if not already set
process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || 'proof-of-funds-455506';
process.env.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS || './gcp-sa-key.json';

async function deployKeysToStorage() {
  console.log('=== Deploying ZK Keys to Google Cloud Storage ===');
  
  const storageManager = new ZKeyStorageManager();
  const circuits = ['standard', 'threshold', 'maximum'];
  
  // Check if we have a bucket name configured
  if (!process.env.GCP_STORAGE_BUCKET) {
    console.log('ℹ️  No GCP_STORAGE_BUCKET set, using default:', storageManager.bucketName);
  }
  
  for (const circuit of circuits) {
    try {
      const localPath = path.join(
        __dirname,
        '..',
        'circuits',
        circuit,
        `${circuit}Proof.zkey`
      );
      
      console.log(`\nUploading ${circuit} zkey...`);
      const result = await storageManager.uploadZKey(circuit, localPath);
      console.log(`✅ ${circuit} zkey uploaded to: ${result}`);
    } catch (error) {
      console.error(`❌ Failed to upload ${circuit} zkey:`, error.message);
    }
  }
  
  console.log('\n=== Deployment Complete ===');
  console.log('Your zkeys are now stored in Google Cloud Storage.');
  console.log('\nNext steps:');
  console.log('1. Update your API endpoints to use Cloud Storage');
  console.log('2. Remove local zkey files from public directories');
  console.log('3. Test the new storage implementation');
}

// Run if called directly
if (require.main === module) {
  deployKeysToStorage().catch(error => {
    console.error('Deployment failed:', error);
    process.exit(1);
  });
}

module.exports = deployKeysToStorage;