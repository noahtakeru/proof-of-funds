/**
 * Consolidated Script to Deploy ZK Keys
 * Supports multiple storage backends (GCP Secret Manager and Cloud Storage)
 */

require('dotenv').config({ path: '.env.local' });
const path = require('path');
const fs = require('fs');

// Storage backends
const STORAGE_TYPES = {
  SECRET_MANAGER: 'secret-manager',
  CLOUD_STORAGE: 'cloud-storage',
  AUTO: 'auto' // Auto-detect based on file size
};

// Default environment variables
process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || 'proof-of-funds-455506';
process.env.GOOGLE_APPLICATION_CREDENTIALS = 
  process.env.GOOGLE_APPLICATION_CREDENTIALS || './gcp-sa-key.json';

/**
 * Deploy ZK keys to the specified storage backend
 * @param {string} storageType - Storage backend type
 * @param {Array<string>} circuits - Circuit types to deploy
 * @param {boolean} force - Force deployment even if file is large
 * @returns {Promise<void>}
 */
async function deployKeys(storageType = STORAGE_TYPES.AUTO, circuits = ['standard', 'threshold', 'maximum'], force = false) {
  console.log(`=== Deploying ZK Keys to ${storageType} ===`);
  
  // Load the appropriate manager based on storage type
  let secretManager, storageManager;
  
  try {
    if (storageType === STORAGE_TYPES.SECRET_MANAGER || storageType === STORAGE_TYPES.AUTO) {
      const ZKeyManager = require('../packages/backend/utils/zkeyManager');
      secretManager = new ZKeyManager();
    }
    
    if (storageType === STORAGE_TYPES.CLOUD_STORAGE || storageType === STORAGE_TYPES.AUTO) {
      const ZKeyStorageManager = require('../packages/backend/utils/zkeyStorageManager');
      storageManager = new ZKeyStorageManager();
      
      // Check if we have a bucket name configured
      if (!process.env.GCP_STORAGE_BUCKET) {
        console.log('ℹ️  No GCP_STORAGE_BUCKET set, using default:', storageManager.bucketName);
      }
    }
  } catch (error) {
    console.error('❌ Failed to initialize managers:', error.message);
    return;
  }
  
  // Process each circuit
  for (const circuit of circuits) {
    try {
      const localPath = path.join(
        __dirname,
        '..',
        'circuits',
        circuit,
        `${circuit}Proof.zkey`
      );
      
      // Check if file exists
      if (!fs.existsSync(localPath)) {
        console.error(`❌ File not found: ${localPath}`);
        continue;
      }
      
      // Get file size
      const stats = fs.statSync(localPath);
      const fileSizeKb = Math.round(stats.size / 1024);
      console.log(`\nProcessing ${circuit} zkey (${fileSizeKb} KB)...`);
      
      // Determine appropriate storage based on file size if AUTO
      if (storageType === STORAGE_TYPES.AUTO) {
        // Secret Manager has a 64KB limit
        if (stats.size <= 64 * 1024 || force) {
          console.log(`Using Secret Manager for ${circuit} zkey`);
          await secretManager.uploadZKey(circuit, localPath);
          console.log(`✅ ${circuit} zkey uploaded to Secret Manager`);
        } else {
          console.log(`Using Cloud Storage for ${circuit} zkey (exceeds Secret Manager size limit)`);
          const result = await storageManager.uploadZKey(circuit, localPath);
          console.log(`✅ ${circuit} zkey uploaded to Cloud Storage: ${result}`);
        }
      } 
      // Use specific storage type
      else if (storageType === STORAGE_TYPES.SECRET_MANAGER) {
        if (stats.size > 64 * 1024 && !force) {
          console.warn(`⚠️  Warning: ${circuit} zkey (${fileSizeKb} KB) exceeds Secret Manager limit (64 KB)`);
          console.warn('Use --force to upload anyway or --storage=cloud-storage to use Cloud Storage');
          continue;
        }
        await secretManager.uploadZKey(circuit, localPath);
        console.log(`✅ ${circuit} zkey uploaded to Secret Manager`);
      }
      else if (storageType === STORAGE_TYPES.CLOUD_STORAGE) {
        const result = await storageManager.uploadZKey(circuit, localPath);
        console.log(`✅ ${circuit} zkey uploaded to Cloud Storage: ${result}`);
      }
    } catch (error) {
      console.error(`❌ Failed to upload ${circuit} zkey:`, error.message);
    }
  }
  
  console.log('\n=== Deployment Complete ===');
  console.log('Next steps:');
  console.log('1. Update your API endpoints to use the appropriate storage');
  console.log('2. Remove local zkey files from public directories');
  console.log('3. Test the storage implementation');
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let storageType = STORAGE_TYPES.AUTO;
  let circuits = ['standard', 'threshold', 'maximum'];
  let force = false;
  
  for (const arg of args) {
    if (arg.startsWith('--storage=')) {
      const value = arg.split('=')[1];
      if (Object.values(STORAGE_TYPES).includes(value)) {
        storageType = value;
      } else {
        console.error(`Unknown storage type: ${value}`);
        console.error(`Available types: ${Object.values(STORAGE_TYPES).join(', ')}`);
        process.exit(1);
      }
    }
    else if (arg.startsWith('--circuits=')) {
      circuits = arg.split('=')[1].split(',');
    }
    else if (arg === '--force') {
      force = true;
    }
    else if (arg === '--help') {
      console.log('Usage: node deploy-keys.js [options]');
      console.log('Options:');
      console.log('  --storage=<type>    Storage type: secret-manager, cloud-storage, or auto (default: auto)');
      console.log('  --circuits=<list>   Comma-separated list of circuits (default: standard,threshold,maximum)');
      console.log('  --force             Force upload even if file exceeds size limits');
      console.log('  --help              Show this help message');
      process.exit(0);
    }
  }
  
  return { storageType, circuits, force };
}

// Run if called directly
if (require.main === module) {
  const { storageType, circuits, force } = parseArgs();
  deployKeys(storageType, circuits, force).catch(error => {
    console.error('Deployment failed:', error);
    process.exit(1);
  });
}

module.exports = deployKeys;