/**
 * Backward compatibility wrapper for test-production-proof.js
 * Use test-proof-basics.js instead for new code
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
