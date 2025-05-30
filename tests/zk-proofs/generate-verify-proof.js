/**
 * Backward compatibility wrapper for generate-verify-proof.js
 * Use test-proof-basics.js instead for new code
 */

const { testSimpleDemo } = require('./test-proof-basics');

// Run the function with the same behavior as the original script
testSimpleDemo().then(result => {
  console.log('\n=== Result ===');
  console.log(result.success 
    ? `ZK proof system is working correctly! Verification result: ${result.success}` 
    : `ZK proof system error: ${result.error}`);
  process.exit(result.success ? 0 : 1);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
