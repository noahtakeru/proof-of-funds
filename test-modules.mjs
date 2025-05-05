/**
 * Focused test script for testing specific module imports.
 * Each function tests a specific import in isolation.
 */

async function testErrorLogger() {
  try {
    const { zkErrorLogger } = await import('./lib/zk/src/zkErrorLogger.mjs');
    console.log('✅ Successfully imported zkErrorLogger');
    return true;
  } catch (error) {
    console.error('❌ Failed to import zkErrorLogger:', error.message);
    return false;
  }
}

async function testErrorHandler() {
  try {
    const { getErrorLogger, initializeErrorLogger } = await import('./lib/zk/src/zkErrorHandler.mjs');
    console.log('✅ Successfully imported zkErrorHandler');
    return { getErrorLogger, initializeErrorLogger };
  } catch (error) {
    console.error('❌ Failed to import zkErrorHandler:', error.message);
    return false;
  }
}

async function testSecureKeyManager() {
  try {
    const { SecureKeyManager } = await import('./lib/zk/src/SecureKeyManager.js');
    console.log('✅ Successfully imported SecureKeyManager');
    return true;
  } catch (error) {
    console.error('❌ Failed to import SecureKeyManager:', error.message);
    return false;
  }
}

async function testSecureStorage() {
  try {
    const secureStorage = await import('./lib/zk/src/secureStorage.mjs');
    console.log('✅ Successfully imported secureStorage');
    return true;
  } catch (error) {
    console.error('❌ Failed to import secureStorage:', error.message);
    return false;
  }
}

async function testRecoverySystem() {
  try {
    const recoverySystem = await import('./lib/zk/src/zkRecoverySystem.mjs');
    console.log('✅ Successfully imported zkRecoverySystem');
    return true;
  } catch (error) {
    console.error('❌ Failed to import zkRecoverySystem:', error.message);
    return false;
  }
}

async function testCircuitInputs() {
  try {
    const circuitInputs = await import('./lib/zk/src/zkCircuitInputs.js');
    console.log('✅ Successfully imported zkCircuitInputs.js');
    return circuitInputs.addressToBytes !== undefined;
  } catch (error) {
    console.error('❌ Failed to import zkCircuitInputs.js:', error.message);
    return false;
  }
}

async function testCircuitParameterDerivation() {
  try {
    const derivation = await import('./lib/zk/src/zkCircuitParameterDerivation.mjs');
    console.log('✅ Successfully imported zkCircuitParameterDerivation');
    return derivation.default !== undefined;
  } catch (error) {
    console.error('❌ Failed to import zkCircuitParameterDerivation:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('Running module import tests...\n');
  
  // Test error logger and handler first
  const loggerSuccess = await testErrorLogger();
  const handlerResult = await testErrorHandler();
  
  // Test other modules
  await testSecureKeyManager();
  await testSecureStorage();
  await testRecoverySystem();
  await testCircuitInputs();
  await testCircuitParameterDerivation();
  
  console.log('\nTests completed.');
}

runTests();