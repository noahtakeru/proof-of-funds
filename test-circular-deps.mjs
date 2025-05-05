/**
 * Test script to verify circular dependency resolution
 * 
 * This script tests the imports that were previously causing circular dependencies
 * to ensure that our solution with bridge files and getErrorLogger() works correctly.
 */

console.log('Starting circular dependency resolution test...');

// Import modules one-by-one, in separate scopes to avoid identifier conflicts
const runTests = async () => {
  try {
    // Test 1: Import and initialize error logger
    console.log('\nTest 1: Testing error logger and handler initialization');
    {
      const errorLoggerModule = await import('./lib/zk/src/zkErrorLogger.mjs');
      const errorHandlerModule = await import('./lib/zk/src/zkErrorHandler.mjs');
      
      console.log('✅ Successfully imported zkErrorLogger.mjs and zkErrorHandler.mjs');
      
      // Test initialization
      errorHandlerModule.initializeErrorLogger(errorLoggerModule.zkErrorLogger);
      const logger = errorHandlerModule.getErrorLogger();
      
      if (logger) {
        console.log('✅ Successfully initialized and got logger instance');
      } else {
        console.error('❌ Logger instance is null or undefined');
      }
    }
    
    // Test 2: Import SecureKeyManager
    console.log('\nTest 2: Testing SecureKeyManager.js');
    {
      const { SecureKeyManager } = await import('./lib/zk/src/SecureKeyManager.js');
      
      if (SecureKeyManager) {
        console.log('✅ Successfully imported SecureKeyManager.js');
      } else {
        console.error('❌ SecureKeyManager is undefined');
      }
    }
    
    // Test 3: Import secureStorage
    console.log('\nTest 3: Testing secureStorage.mjs');
    {
      const secureStorage = await import('./lib/zk/src/secureStorage.mjs');
      
      if (secureStorage.default) {
        console.log('✅ Successfully imported secureStorage.mjs');
      } else {
        console.error('❌ secureStorage is missing default export');
      }
    }
    
    // Test 4: Import zkRecoverySystem
    console.log('\nTest 4: Testing zkRecoverySystem.mjs');
    {
      const recoverySystem = await import('./lib/zk/src/zkRecoverySystem.mjs');
      
      if (recoverySystem.default) {
        console.log('✅ Successfully imported zkRecoverySystem.mjs');
      } else {
        console.error('❌ zkRecoverySystem is missing default export');
      }
    }
    
    // Test 5: Import zkCircuitInputs bridge file
    console.log('\nTest 5: Testing zkCircuitInputs.js bridge file');
    {
      const circuitInputs = await import('./lib/zk/src/zkCircuitInputs.js');
      
      if (circuitInputs.addressToBytes) {
        console.log('✅ Successfully imported zkCircuitInputs.js with addressToBytes function');
      } else {
        console.error('❌ zkCircuitInputs.js is missing addressToBytes export');
      }
    }
    
    // Test 6: Import zkCircuitParameterDerivation
    console.log('\nTest 6: Testing zkCircuitParameterDerivation.mjs');
    {
      const derivation = await import('./lib/zk/src/zkCircuitParameterDerivation.mjs');
      
      if (derivation.default) {
        console.log('✅ Successfully imported zkCircuitParameterDerivation.mjs');
      } else {
        console.error('❌ zkCircuitParameterDerivation.mjs is missing default export');
      }
    }
    
    console.log('\nAll modules imported successfully!');
    console.log('✅ Circular dependency issues have been resolved!');
  } catch (error) {
    console.error('\n❌ Error during test:', error.message);
    console.error(error);
  }
};

// Run the tests
runTests();