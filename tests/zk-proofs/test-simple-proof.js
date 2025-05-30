/**
 * Backward compatibility wrapper for test-simple-proof.js
 * Use test-proof-basics.js instead for new code
 */

const { testSimpleValues } = require('./test-proof-basics');

// Run the function with the same behavior as the original script
testSimpleValues().then(result => {
  console.log('\n' + (result.success ? '✅ Simple test passed!' : '❌ Simple test failed'));
  process.exit(result.success ? 0 : 1);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
