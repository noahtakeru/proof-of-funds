/**
 * Backward compatibility wrapper for prepare-zk-files.js
 * Use zk-utilities.js instead for new code
 */

const { prepareZkFiles } = require('./zk-utilities');

// Run the function with the same behavior as the original script
prepareZkFiles().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
