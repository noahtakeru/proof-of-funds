/**
 * Backward compatibility wrapper for deploy-keys-to-storage.js
 * Use deploy-keys.js instead for new code
 */

const deployKeys = require('./deploy-keys');

async function deployKeysToStorage() {
  console.log('Note: This script is a wrapper for deploy-keys.js');
  await deployKeys('cloud-storage');
}

// Run if called directly
if (require.main === module) {
  deployKeysToStorage().catch(error => {
    console.error('Deployment failed:', error);
    process.exit(1);
  });
}

module.exports = deployKeysToStorage;