/**
 * Deploy zkey files to Google Cloud Secret Manager
 * Run this after generating keys to upload them securely
 */

const ZKeyManager = require('../packages/backend/utils/zkeyManager');
const path = require('path');

async function deployKeysToGCP() {
  console.log('=== Deploying ZK Keys to Google Cloud Secret Manager ===');
  
  const zkeyManager = new ZKeyManager();
  const circuits = ['standard', 'threshold', 'maximum'];
  
  for (const circuit of circuits) {
    try {
      const localPath = path.join(
        __dirname,
        '..',
        'circuits',
        circuit,
        `${circuit}Proof.zkey`
      );
      
      console.log(`Uploading ${circuit} zkey...`);
      await zkeyManager.uploadZKey(circuit, localPath);
      console.log(`✅ ${circuit} zkey uploaded successfully`);
    } catch (error) {
      console.error(`❌ Failed to upload ${circuit} zkey:`, error);
    }
  }
  
  console.log('\n=== Deployment Complete ===');
  console.log('Remember to:');
  console.log('1. Remove local zkey files from public directories');
  console.log('2. Update API endpoints to use ZKeyManager');
  console.log('3. Set GCP_PROJECT_ID environment variable');
}

// Run if called directly
if (require.main === module) {
  deployKeysToGCP().catch(console.error);
}

module.exports = deployKeysToGCP;