/**
 * DEPRECATED: Backward compatibility wrapper for test-production-proof.js
 * 
 * ⚠️ DO NOT ADD NEW CODE HERE ⚠️
 * This file is maintained only for backward compatibility.
 * For all new tests and modifications, use test-proof-basics.js instead.
 * 
 * This wrapper will be removed in a future update.
 */

const { testProductionValues } = require('./test-proof-basics');

// Run the function with the same behavior as the original script
testProductionValues().then(result => {
  if (result.success) {
    console.log('\n✅ Production ZK proof system is working correctly!');
  } else {
    console.log('\n❌ ZK proof system test failed');
    if (result.error) {
      console.log('Error:', result.error);
    }
  }
  process.exit(result.success ? 0 : 1);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
