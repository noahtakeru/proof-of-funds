/**
 * Test Cloud Storage implementation
 */

require('dotenv').config();
const ZKeyStorageManager = require('../packages/backend/utils/zkeyStorageManager');

async function testCloudStorage() {
  console.log('===== Testing Cloud Storage Implementation =====\n');
  
  const storageManager = new ZKeyStorageManager();
  const circuits = ['standard', 'threshold', 'maximum'];
  
  for (const circuit of circuits) {
    try {
      console.log(`Testing ${circuit} zkey...`);
      
      // Try to download the zkey
      const zkeyData = await storageManager.getZKey(circuit);
      console.log(`✅ Successfully downloaded ${circuit} zkey (${zkeyData.length} bytes)`);
      
      // Generate a signed URL
      const signedUrl = await storageManager.getSignedUrl(circuit);
      console.log(`✅ Generated signed URL for ${circuit}`);
      console.log(`   URL: ${signedUrl.substring(0, 50)}...`);
      
    } catch (error) {
      console.error(`❌ Error testing ${circuit}:`, error.message);
    }
  }
  
  console.log('\n===== Test Complete =====');
}

testCloudStorage().catch(console.error);