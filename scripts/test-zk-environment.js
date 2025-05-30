/**
 * Backward compatibility wrapper for test-zk-environment.js
 * Use zk-utilities.js instead for new code
 */

const { testZkEnvironment } = require('./zk-utilities');

// Run the function with the same behavior as the original script
testZkEnvironment().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
