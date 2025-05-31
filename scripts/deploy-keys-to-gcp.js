/**
 * Backward compatibility wrapper for deploy-keys-to-gcp.js
 * Use deploy-keys.js instead for new code
 */

const deployKeys = require('./deploy-keys');

async function deployKeysToGCP() {
  console.log('Note: This script is a wrapper for deploy-keys.js');
  await deployKeys('secret-manager');
}

// Run if called directly
if (require.main === module) {
  deployKeysToGCP().catch(console.error);
}

module.exports = deployKeysToGCP;