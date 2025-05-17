#!/usr/bin/env node

/**
 * GCP Setup Script
 * 
 * Automates the setup of Google Cloud Platform resources
 * for the Proof of Funds application.
 * 
 * This script:
 * 1. Creates or verifies the GCP project
 * 2. Enables necessary APIs
 * 3. Creates a service account with proper permissions
 * 4. Sets up storage buckets for zkey files
 * 5. Configures environment variables
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Default configuration
const DEFAULT_PROJECT_ID = 'proof-of-funds-455506';
const REQUIRED_APIS = [
  'secretmanager.googleapis.com',
  'storage.googleapis.com',
  'cloudkms.googleapis.com',
  'iam.googleapis.com'
];

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Check if gcloud is installed
 */
function checkGcloudInstalled() {
  try {
    execSync('gcloud --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    console.error('Error: gcloud CLI is not installed or not in PATH');
    console.log('Please install Google Cloud SDK from: https://cloud.google.com/sdk/docs/install');
    return false;
  }
}

/**
 * Get or create GCP project
 * @param {string} projectId - The project ID to use
 */
async function setupProject(projectId) {
  console.log(`\n== Setting up GCP project: ${projectId} ==`);
  
  try {
    // Check if project exists
    try {
      execSync(`gcloud projects describe ${projectId}`, { stdio: 'ignore' });
      console.log(`✅ Project ${projectId} already exists`);
    } catch (error) {
      // Project doesn't exist, create it
      console.log(`Creating new project: ${projectId}`);
      execSync(`gcloud projects create ${projectId} --name="Proof of Funds"`, { stdio: 'inherit' });
      console.log(`✅ Project ${projectId} created successfully`);
    }
    
    // Set as default project
    execSync(`gcloud config set project ${projectId}`, { stdio: 'inherit' });
    console.log(`✅ Set ${projectId} as default project`);
    
    return true;
  } catch (error) {
    console.error('❌ Error setting up project:', error.message);
    return false;
  }
}

/**
 * Enable required GCP APIs
 */
async function enableApis() {
  console.log('\n== Enabling required GCP APIs ==');
  
  try {
    for (const api of REQUIRED_APIS) {
      console.log(`Enabling API: ${api}`);
      execSync(`gcloud services enable ${api}`, { stdio: 'inherit' });
    }
    console.log('✅ All required APIs enabled');
    return true;
  } catch (error) {
    console.error('❌ Error enabling APIs:', error.message);
    return false;
  }
}

/**
 * Create service account and download credentials
 * @param {string} projectId - The GCP project ID
 */
async function createServiceAccount(projectId) {
  console.log('\n== Creating service account ==');
  
  const serviceAccountId = 'proof-of-funds-sa';
  const serviceAccountEmail = `${serviceAccountId}@${projectId}.iam.gserviceaccount.com`;
  const credentialsPath = path.join(process.cwd(), 'gcp-sa-key.json');
  
  try {
    // Check if service account exists
    try {
      execSync(`gcloud iam service-accounts describe ${serviceAccountEmail}`, { stdio: 'ignore' });
      console.log(`✅ Service account ${serviceAccountEmail} already exists`);
    } catch (error) {
      // Service account doesn't exist, create it
      console.log(`Creating service account: ${serviceAccountId}`);
      execSync(
        `gcloud iam service-accounts create ${serviceAccountId} --display-name="Proof of Funds Service Account"`,
        { stdio: 'inherit' }
      );
      console.log(`✅ Service account created: ${serviceAccountEmail}`);
    }
    
    // Grant necessary permissions
    console.log('Granting permissions to service account...');
    const roles = [
      'roles/secretmanager.secretAccessor',
      'roles/storage.admin'
    ];
    
    for (const role of roles) {
      execSync(
        `gcloud projects add-iam-policy-binding ${projectId} --member="serviceAccount:${serviceAccountEmail}" --role="${role}"`,
        { stdio: 'inherit' }
      );
    }
    
    // Create and download key
    console.log(`Creating and downloading service account key to: ${credentialsPath}`);
    execSync(
      `gcloud iam service-accounts keys create ${credentialsPath} --iam-account=${serviceAccountEmail}`,
      { stdio: 'inherit' }
    );
    
    console.log(`✅ Service account key saved to: ${credentialsPath}`);
    return { success: true, credentialsPath };
  } catch (error) {
    console.error('❌ Error creating service account:', error.message);
    return { success: false };
  }
}

/**
 * Create storage bucket for proof files
 * @param {string} projectId - The GCP project ID
 */
async function createStorageBucket(projectId) {
  console.log('\n== Setting up storage bucket ==');
  
  const bucketName = `${projectId}-zkeys`;
  
  try {
    // Check if bucket exists
    try {
      execSync(`gsutil ls gs://${bucketName}`, { stdio: 'ignore' });
      console.log(`✅ Bucket ${bucketName} already exists`);
    } catch (error) {
      // Bucket doesn't exist, create it
      console.log(`Creating storage bucket: ${bucketName}`);
      execSync(`gsutil mb -l us-central1 gs://${bucketName}`, { stdio: 'inherit' });
      
      // Set bucket permissions
      execSync(`gsutil iam ch serviceAccount:${projectId}-sa@${projectId}.iam.gserviceaccount.com:objectAdmin gs://${bucketName}`, 
        { stdio: 'inherit' });
        
      console.log(`✅ Bucket ${bucketName} created and configured`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error setting up storage bucket:', error.message);
    return false;
  }
}

/**
 * Update environment variables
 * @param {string} projectId - The GCP project ID
 * @param {string} credentialsPath - Path to the credentials file
 */
async function updateEnvironment(projectId, credentialsPath) {
  console.log('\n== Updating environment configuration ==');
  
  try {
    // Create .env file if it doesn't exist
    const envPath = path.join(process.cwd(), '.env.local');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Add GCP configuration
    const envVars = [
      `GCP_PROJECT_ID=${projectId}`,
      `GOOGLE_APPLICATION_CREDENTIALS=${credentialsPath}`,
      `GCP_STORAGE_BUCKET=${projectId}-zkeys`
    ];
    
    // Update .env file
    for (const envVar of envVars) {
      const [key] = envVar.split('=');
      
      // Check if key already exists
      if (envContent.includes(`${key}=`)) {
        // Replace existing line
        const regex = new RegExp(`${key}=.*`, 'g');
        envContent = envContent.replace(regex, envVar);
      } else {
        // Add new line
        envContent += `\n${envVar}`;
      }
    }
    
    // Write updated content
    fs.writeFileSync(envPath, envContent.trim() + '\n');
    console.log(`✅ Environment variables updated in ${envPath}`);
    
    return true;
  } catch (error) {
    console.error('❌ Error updating environment variables:', error.message);
    return false;
  }
}

/**
 * Main setup function
 */
async function main() {
  console.log('🚀 Starting GCP setup for Proof of Funds...');
  
  // Check if gcloud is installed
  if (!checkGcloudInstalled()) {
    process.exit(1);
  }
  
  // Prompt for project ID
  rl.question(`Enter GCP project ID [${DEFAULT_PROJECT_ID}]: `, async (inputProjectId) => {
    const projectId = inputProjectId || DEFAULT_PROJECT_ID;
    
    // Run setup steps
    const projectSetup = await setupProject(projectId);
    if (!projectSetup) {
      console.error('❌ Project setup failed, exiting');
      rl.close();
      process.exit(1);
    }
    
    const apisEnabled = await enableApis();
    if (!apisEnabled) {
      console.error('❌ API setup failed, exiting');
      rl.close();
      process.exit(1);
    }
    
    const serviceAccount = await createServiceAccount(projectId);
    if (!serviceAccount.success) {
      console.error('❌ Service account setup failed, exiting');
      rl.close();
      process.exit(1);
    }
    
    const bucketCreated = await createStorageBucket(projectId);
    if (!bucketCreated) {
      console.error('❌ Storage bucket setup failed, exiting');
      rl.close();
      process.exit(1);
    }
    
    const envUpdated = await updateEnvironment(projectId, serviceAccount.credentialsPath);
    if (!envUpdated) {
      console.error('❌ Environment update failed, exiting');
      rl.close();
      process.exit(1);
    }
    
    console.log('\n✅ GCP setup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Run `npm run dev` to start the development server');
    console.log('2. Access your GCP project at: https://console.cloud.google.com/');
    
    rl.close();
  });
}

// Run the setup
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});