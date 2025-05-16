/**
 * Verify GCP deployment is working correctly
 */

const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

async function verifyDeployment() {
  console.log('===== Verifying GCP Deployment =====');
  
  const projectId = process.env.GCP_PROJECT_ID;
  if (!projectId) {
    console.error('❌ GCP_PROJECT_ID not set in environment');
    process.exit(1);
  }
  
  console.log(`Project ID: ${projectId}`);
  
  const client = new SecretManagerServiceClient();
  
  try {
    // Test creating a secret
    const parent = `projects/${projectId}`;
    const secretId = 'test-deployment-secret';
    
    console.log('Creating test secret...');
    await client.createSecret({
      parent,
      secretId,
      secret: {
        replication: {
          automatic: {},
        },
      },
    });
    
    // Add a version
    console.log('Adding secret version...');
    await client.addSecretVersion({
      parent: `${parent}/secrets/${secretId}`,
      payload: {
        data: Buffer.from('test-value'),
      },
    });
    
    // Read it back
    console.log('Reading secret...');
    const [version] = await client.accessSecretVersion({
      name: `${parent}/secrets/${secretId}/versions/latest`,
    });
    
    const payload = version.payload.data.toString();
    console.log(`Secret value: ${payload}`);
    
    // Clean up
    console.log('Cleaning up test secret...');
    await client.deleteSecret({
      name: `${parent}/secrets/${secretId}`,
    });
    
    console.log('✅ GCP deployment verified successfully!');
  } catch (error) {
    console.error('❌ Deployment verification failed:', error.message);
    console.error('\nMake sure to:');
    console.error('1. Enable the Secret Manager API');
    console.error('2. Set up authentication');
    console.error('3. Check the setup instructions in gcp-setup-instructions.md');
  }
}

verifyDeployment().catch(console.error);
