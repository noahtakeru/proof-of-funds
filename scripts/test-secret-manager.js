/**
 * Quick test to check if Secret Manager API is enabled
 * and authentication is working
 */

require('dotenv').config();

async function testSecretManager() {
  console.log('===== Testing Secret Manager Configuration =====\n');
  
  // Check environment
  const projectId = process.env.GCP_PROJECT_ID;
  console.log(`Project ID: ${projectId || 'NOT SET'}`);
  
  if (!projectId) {
    console.error('❌ GCP_PROJECT_ID is not set in .env file');
    return;
  }
  
  try {
    const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
    const client = new SecretManagerServiceClient();
    
    console.log('\nTesting API access...');
    
    // Try to list secrets (won't fail if none exist)
    const parent = `projects/${projectId}`;
    const [secrets] = await client.listSecrets({
      parent,
      pageSize: 1
    });
    
    console.log('✅ Secret Manager API is enabled and accessible!');
    console.log(`Found ${secrets.length} existing secrets`);
    
    return true;
  } catch (error) {
    console.error('❌ Error accessing Secret Manager:', error.message);
    
    if (error.message.includes('Secret Manager API has not been used')) {
      console.error('\n⚠️  The Secret Manager API is not enabled.');
      console.error('Enable it here:');
      console.error(`https://console.cloud.google.com/flows/enableapi?apiid=secretmanager.googleapis.com&project=${projectId}`);
    } else if (error.message.includes('Could not load the default credentials')) {
      console.error('\n⚠️  Authentication not configured.');
      console.error('Run: gcloud auth application-default login');
      console.error('Or set GOOGLE_APPLICATION_CREDENTIALS to your service account key');
    } else if (error.message.includes('Permission denied')) {
      console.error('\n⚠️  Your account lacks the necessary permissions.');
      console.error('Ensure your account has the Secret Manager Admin role');
    }
    
    return false;
  }
}

// Run test
testSecretManager().then(success => {
  if (success) {
    console.log('\n🎉 Ready to deploy zkeys to Google Cloud!');
    console.log('Next step: node scripts/deploy-keys-to-gcp.js');
  } else {
    console.log('\n❌ Fix the issues above before proceeding');
  }
});