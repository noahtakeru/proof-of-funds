/**
 * DEPRECATED: Backward compatibility wrapper for test-fixed-circuit.js
 * 
 * ⚠️ DO NOT ADD NEW CODE HERE ⚠️
 * This file is maintained only for backward compatibility.
 * For all new tests and modifications, use test-proof-basics.js instead.
 * 
 * This wrapper will be removed in a future update.
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
