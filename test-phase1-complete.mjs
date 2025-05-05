/**
 * Comprehensive test for Phase 1 of the dependency resolution plan
 * This script tests that all circular dependencies have been resolved
 * and that typescript integration and module format issues are fixed.
 */

// Module to hold test results
const testResults = {
  phase1_1: {
    passed: 0,
    failed: 0,
    details: []
  },
  phase1_2: {
    passed: 0,
    failed: 0,
    details: []
  },
  phase1_3: {
    passed: 0,
    failed: 0,
    details: []
  }
};

// Helper function to record test results
function recordResult(phase, name, passed, message = '') {
  if (passed) {
    testResults[phase].passed++;
    testResults[phase].details.push(`✅ ${name}`);
  } else {
    testResults[phase].failed++;
    testResults[phase].details.push(`❌ ${name}: ${message}`);
  }
}

// Test Phase 1.1: Circular Dependencies
async function testPhase1_1() {
  console.log('\n--- Testing Phase 1.1: Circular Dependencies ---');
  
  try {
    // Test Error Handler and Logger
    console.log('Testing error handler and logger interaction...');
    const errorHandlerModule = await import('./lib/zk/src/zkErrorHandler.mjs');
    recordResult('phase1_1', 'Import zkErrorHandler.mjs', true);
    
    const errorLoggerModule = await import('./lib/zk/src/zkErrorLogger.mjs');
    recordResult('phase1_1', 'Import zkErrorLogger.mjs', true);
    
    // Initialize logger
    errorHandlerModule.initializeErrorLogger(errorLoggerModule.zkErrorLogger);
    const logger = errorHandlerModule.getErrorLogger();
    recordResult('phase1_1', 'Initialize and get error logger', !!logger);
    
    // Test SecureKeyManager
    console.log('Testing SecureKeyManager...');
    const { SecureKeyManager } = await import('./lib/zk/src/SecureKeyManager.js');
    recordResult('phase1_1', 'Import SecureKeyManager.js', !!SecureKeyManager);
    
    // Test secureStorage
    console.log('Testing secureStorage...');
    const secureStorage = await import('./lib/zk/src/secureStorage.mjs');
    recordResult('phase1_1', 'Import secureStorage.mjs', !!secureStorage.default);
    
    // Test zkRecoverySystem
    console.log('Testing zkRecoverySystem...');
    const recoverySystem = await import('./lib/zk/src/zkRecoverySystem.mjs');
    recordResult('phase1_1', 'Import zkRecoverySystem.mjs', !!recoverySystem.default);
    
  } catch (error) {
    console.error('Error testing Phase 1.1:', error);
    recordResult('phase1_1', 'Phase 1.1 overall test', false, error.message);
  }
}

// Test Phase 1.2: TypeScript Integration
async function testPhase1_2() {
  console.log('\n--- Testing Phase 1.2: TypeScript Integration ---');
  
  try {
    // Check if TypeScript definition files exist
    console.log('Checking TypeScript definition files...');
    
    const fs = await import('fs');
    
    // Check zkCircuitRegistry.d.ts
    const circuitRegistryDtsExists = fs.existsSync('./lib/zk/src/zkCircuitRegistry.d.ts');
    recordResult('phase1_2', 'zkCircuitRegistry.d.ts exists', circuitRegistryDtsExists);
    
    // Check deviceCapabilities.d.ts
    const deviceCapabilitiesDtsExists = fs.existsSync('./lib/zk/src/deviceCapabilities.d.ts');
    recordResult('phase1_2', 'deviceCapabilities.d.ts exists', deviceCapabilitiesDtsExists);
    
    // We can't directly test TypeScript compilation in a JS file,
    // but we can check if the files are properly formatted
    
    if (circuitRegistryDtsExists) {
      const circuitRegistryDtsContent = fs.readFileSync('./lib/zk/src/zkCircuitRegistry.d.ts', 'utf8');
      const hasProperInterface = circuitRegistryDtsContent.includes('export interface ZKCircuitRegistry');
      recordResult('phase1_2', 'zkCircuitRegistry.d.ts has proper interface', hasProperInterface);
    }
    
    if (deviceCapabilitiesDtsExists) {
      const deviceCapabilitiesDtsContent = fs.readFileSync('./lib/zk/src/deviceCapabilities.d.ts', 'utf8');
      const hasProperInterface = deviceCapabilitiesDtsContent.includes('export interface DeviceCapabilities');
      recordResult('phase1_2', 'deviceCapabilities.d.ts has proper interface', hasProperInterface);
    }
    
  } catch (error) {
    console.error('Error testing Phase 1.2:', error);
    recordResult('phase1_2', 'Phase 1.2 overall test', false, error.message);
  }
}

// Test Phase 1.3: Module Format Inconsistencies
async function testPhase1_3() {
  console.log('\n--- Testing Phase 1.3: Module Format Inconsistencies ---');
  
  try {
    // Test bridge files
    console.log('Testing bridge files...');
    
    // Test zkCircuitInputs.js bridge
    const circuitInputs = await import('./lib/zk/src/zkCircuitInputs.js');
    const hasAddressToBytes = typeof circuitInputs.addressToBytes === 'function';
    recordResult('phase1_3', 'zkCircuitInputs.js bridge exports addressToBytes', hasAddressToBytes);
    
    // Test zkCircuitRegistry.js bridge
    const circuitRegistry = await import('./lib/zk/src/zkCircuitRegistry.js');
    const hasMemoryRequirements = typeof circuitRegistry.getCircuitMemoryRequirements === 'function';
    recordResult('phase1_3', 'zkCircuitRegistry.js bridge exports getCircuitMemoryRequirements', hasMemoryRequirements);
    
    // Test zkCircuitParameterDerivation.mjs
    console.log('Testing zkCircuitParameterDerivation.mjs...');
    const derivation = await import('./lib/zk/src/zkCircuitParameterDerivation.mjs');
    recordResult('phase1_3', 'Import zkCircuitParameterDerivation.mjs', !!derivation.default);
    
    // Test zkUtils.mjs
    console.log('Testing zkUtils.mjs...');
    const utils = await import('./lib/zk/src/zkUtils.mjs');
    recordResult('phase1_3', 'Import zkUtils.mjs', !!utils.default);
    
    // Test browserCompatibility.mjs
    console.log('Testing browserCompatibility.mjs...');
    const browserCompat = await import('./lib/zk/src/browserCompatibility.mjs');
    recordResult('phase1_3', 'Import browserCompatibility.mjs', !!browserCompat.default);
    
  } catch (error) {
    console.error('Error testing Phase 1.3:', error);
    recordResult('phase1_3', 'Phase 1.3 overall test', false, error.message);
  }
}

// Run all tests
async function runAllTests() {
  console.log('Starting comprehensive test for Phase 1 completion...');
  
  await testPhase1_1();
  await testPhase1_2();
  await testPhase1_3();
  
  // Print test results
  console.log('\n--- PHASE 1 TEST RESULTS ---');
  console.log('\nPhase 1.1: Circular Dependencies');
  console.log(`Passed: ${testResults.phase1_1.passed}, Failed: ${testResults.phase1_1.failed}`);
  testResults.phase1_1.details.forEach(detail => console.log(detail));
  
  console.log('\nPhase 1.2: TypeScript Integration');
  console.log(`Passed: ${testResults.phase1_2.passed}, Failed: ${testResults.phase1_2.failed}`);
  testResults.phase1_2.details.forEach(detail => console.log(detail));
  
  console.log('\nPhase 1.3: Module Format Inconsistencies');
  console.log(`Passed: ${testResults.phase1_3.passed}, Failed: ${testResults.phase1_3.failed}`);
  testResults.phase1_3.details.forEach(detail => console.log(detail));
  
  // Overall result
  const totalPassed = testResults.phase1_1.passed + testResults.phase1_2.passed + testResults.phase1_3.passed;
  const totalFailed = testResults.phase1_1.failed + testResults.phase1_2.failed + testResults.phase1_3.failed;
  const totalTests = totalPassed + totalFailed;
  
  console.log('\n--- SUMMARY ---');
  console.log(`Total: ${totalTests}, Passed: ${totalPassed}, Failed: ${totalFailed}`);
  
  if (totalFailed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Phase 1 is complete.');
  } else {
    console.log(`\n❌ ${totalFailed} tests failed. Phase 1 is not yet complete.`);
  }
}

// Execute tests
runAllTests().catch(error => {
  console.error('Fatal error running tests:', error);
});