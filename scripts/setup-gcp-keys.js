/**
 * GCP Service Account Keys Setup Script
 * 
 * This script copies the appropriate GCP service account key file
 * based on the environment and sets it up for the application.
 * 
 * Usage:
 * - Development: node scripts/setup-gcp-keys.js development
 * - Test: node scripts/setup-gcp-keys.js test
 * - Production: node scripts/setup-gcp-keys.js production
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Service account key files by purpose
const SERVICE_ACCOUNT_FILES = {
    // Backend service account (default)
    backend: path.resolve(process.env.BACKEND_SA_PATH || '/Users/karpel/Downloads/proof-of-funds-455506-0dc7c58e9505.json'),

    // Encryption service account (for handling sensitive keys)
    encryption: path.resolve(process.env.ENCRYPTION_SA_PATH || '/Users/karpel/Downloads/proof-of-funds-455506-bb339d021951.json'),

    // Monitoring service account (for metrics and logging)
    monitoring: path.resolve(process.env.MONITORING_SA_PATH || '/Users/karpel/Downloads/proof-of-funds-455506-7e55ac472b8d.json')
};

// Destination file in project root
const SERVICE_ACCOUNT_KEY_DEST = path.resolve(path.join(__dirname, '..', 'service-account-key.json'));

// Get environment and key type from command line arguments
const env = process.argv[2] || 'development';
const keyType = process.argv[3] || 'backend';

// Determine which key file to use
let keyFilePath;

switch (keyType) {
    case 'encryption':
        keyFilePath = SERVICE_ACCOUNT_FILES.encryption;
        break;
    case 'monitoring':
        keyFilePath = SERVICE_ACCOUNT_FILES.monitoring;
        break;
    case 'backend':
    default:
        keyFilePath = SERVICE_ACCOUNT_FILES.backend;
        break;
}

// Ensure the source file exists
if (!fs.existsSync(keyFilePath)) {
    console.error(`Error: Service account key file does not exist at path: ${keyFilePath}`);
    process.exit(1);
}

// Create a backup of the existing key file if it exists
if (fs.existsSync(SERVICE_ACCOUNT_KEY_DEST)) {
    const backupPath = `${SERVICE_ACCOUNT_KEY_DEST}.backup`;
    try {
        fs.copyFileSync(SERVICE_ACCOUNT_KEY_DEST, backupPath);
        console.log(`Backup of existing key file created at: ${backupPath}`);
    } catch (error) {
        console.warn(`Warning: Could not create backup of existing key file: ${error.message}`);
    }
}

// Copy the selected key file to the destination
try {
    fs.copyFileSync(keyFilePath, SERVICE_ACCOUNT_KEY_DEST);
    console.log(`Service account key file (${keyType}) set up for ${env} environment at: ${SERVICE_ACCOUNT_KEY_DEST}`);
} catch (error) {
    console.error(`Error: Failed to copy service account key file: ${error.message}`);
    process.exit(1);
}

// Create or update .env.local with the appropriate settings
const envPath = path.resolve(path.join(__dirname, '..', '.env.local'));
const envSettings = {
    GCP_PROJECT_ID: 'proof-of-funds-455506',
    GCP_SERVICE_ACCOUNT_KEY_PATH: './service-account-key.json',
    USE_GCP_DEFAULT_CREDENTIALS: 'false',
    USE_MOCK_SECRETS: env === 'development' ? 'true' : 'false'
};

let envContent = '';

// Read existing .env.local if it exists
if (fs.existsSync(envPath)) {
    const existingContent = fs.readFileSync(envPath, 'utf8');
    const existingLines = existingContent.split('\n');

    // Keep lines that don't set our managed variables
    envContent = existingLines
        .filter(line => {
            const key = line.split('=')[0].trim();
            return !Object.keys(envSettings).includes(key) && line.trim() !== '';
        })
        .join('\n');

    // Add a newline if there's content
    if (envContent.length > 0 && !envContent.endsWith('\n')) {
        envContent += '\n';
    }
}

// Add our environment variables
envContent += '\n# GCP Secret Manager Configuration - Auto-generated\n';
Object.entries(envSettings).forEach(([key, value]) => {
    envContent += `${key}=${value}\n`;
});

// Write the updated .env.local file
try {
    fs.writeFileSync(envPath, envContent);
    console.log(`Environment settings updated in: ${envPath}`);
} catch (error) {
    console.error(`Error: Failed to update environment settings: ${error.message}`);
    process.exit(1);
}

console.log(`
Setup complete for ${env} environment with ${keyType} service account key.

Next steps:
1. If running in development, you can use mock secrets (USE_MOCK_SECRETS=true)
2. If running in test/production, make sure the GCP Secret Manager secrets exist:
   - master-seed-${env}
   - encryption-keys-${env}
   - api-keys-${env}
3. Start your application
`); 