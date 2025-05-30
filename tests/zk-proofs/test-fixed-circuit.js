/**
 * Backward compatibility wrapper for test-fixed-circuit.js
 * Use test-proof-basics.js instead for new code
 */

const { testFieldElements } = require('./test-proof-basics');

// Run the function with the same behavior as the original script
testFieldElements().then(result => {
  console.log('\n' + (result.success ? '✅ Test passed!' : '❌ Test failed'));
  process.exit(result.success ? 0 : 1);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
