/**
 * Logger initialization test
 * 
 * This file tests the error logging system to ensure it properly initializes
 * without the "Logger not initialized" error.
 */

// Import from error handling
import { safeLogger } from './packages/common/src/error-handling/initializeErrorLogger.js';

// Import from zk
import { generateZKProof, ZK_PROOF_TYPES } from './packages/common/src/zk/index.js';

console.log('=====================================');
console.log('Error Logger Initialization Test');
console.log('=====================================');

console.log('1. Testing direct logger usage:');
try {
  // Log a test message using the safe logger
  safeLogger.info('Test info message from safeLogger', {
    context: 'test-logger.mjs',
    testProperty: 'safe-logger-test'
  });
  console.log('✅ Direct logger usage successful');
} catch (error) {
  console.error('❌ Direct logger usage failed:', error);
}

console.log('\n2. Testing error handling:');
try {
  // Deliberately cause an error
  throw new Error('Test error for logging system');
} catch (error) {
  try {
    // Log the error using safeLogger
    safeLogger.logError(error, {
      context: 'test-logger.mjs:error-test',
      testProperty: 'deliberate-error'
    });
    console.log('✅ Error logging successful');
  } catch (loggingError) {
    console.error('❌ Error logging failed:', loggingError);
  }
}

console.log('\n3. Testing ZK functionality:');
try {
  // Prepare input for ZK proof generation
  const zkInput = {
    proofType: ZK_PROOF_TYPES.STANDARD,
    amount: 1000000,
    address: '0x123456789abcdef'
  };
  
  // This would normally generate a ZK proof (will likely fail if real implementation isn't available)
  console.log('Attempting to generate ZK proof...');
  const result = await generateZKProof(zkInput);
  
  console.log('✅ ZK functionality accessed without logger initialization error');
  console.log('Result:', result ? 'Obtained result' : 'No result');
} catch (error) {
  // The actual ZK proof generation might fail, but we're testing that it doesn't fail with
  // "Logger not initialized" error specifically
  if (error.message.includes('Logger not initialized')) {
    console.error('❌ ZK functionality failed with logger initialization error:', error.message);
  } else {
    console.log('⚠️ ZK functionality failed, but with expected implementation error:', error.message);
    console.log('✅ Logger initialization worked correctly');
  }
}

console.log('\n=====================================');
console.log('Test Complete');
console.log('=====================================');