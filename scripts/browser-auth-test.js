/**
 * Browser Authentication Test
 * Use this after setting up authentication through the browser
 */

const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

async function testBrowserAuth() {
  console.log('===== Testing GCP Authentication =====\n');
  
  console.log('Please complete these steps first:');
  console.log('1. Go to: https://console.cloud.google.com/apis/credentials');
  console.log('2. Click "CREATE CREDENTIALS" > "Service account"');
  console.log('3. Name: proof-of-funds-zk-sa');
  console.log('4. Grant role: Secret Manager Admin');
  console.log('5. Download the JSON key file');
  console.log('6. Set environment variable:');
  console.log('   export GOOGLE_APPLICATION_CREDENTIALS="path/to/downloaded-key.json"\n');
  
  const hasCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  
  if (!hasCredentials) {
    console.error('❌ GOOGLE_APPLICATION_CREDENTIALS not set');
    console.error('Please set the environment variable to your downloaded JSON key file');
    return;
  }
  
  console.log(`✅ Credentials file: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
  
  try {
    const client = new SecretManagerServiceClient();
    const projectId = process.env.GCP_PROJECT_ID;
    
    // Try to list secrets
    const [secrets] = await client.listSecrets({
      parent: `projects/${projectId}`,
      pageSize: 1
    });
    
    console.log('✅ Authentication successful!');
    console.log('You can now run: node scripts/deploy-keys-to-gcp.js');
  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    console.error('Check that your JSON key file exists and has the correct permissions');
  }
}

testBrowserAuth();