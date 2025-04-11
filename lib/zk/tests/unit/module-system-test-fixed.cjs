/**
 * Module System Standardization Test
 * 
 * This test verifies that both ESM and CommonJS module formats work correctly
 * with the Proof of Funds ZK infrastructure. It ensures that modules can be
 * imported with both require() and import() statements.
 */

// Test CommonJS imports
const testCJSImports = () => {
  console.log('Testing CommonJS imports...');
  
  // Test main package entry point
  try {
    const zkPackage = require('../../cjs/index.cjs');
    if (!zkPackage || typeof zkPackage !== 'object') {
      console.error('❌ CJS main package import failed: not an object');
      return false;
    }
    
    // Access utilities for quick verification
    const zkUtils = zkPackage.zkUtils;
    if (!zkUtils || typeof zkUtils !== 'object') {
      console.error('❌ CJS zkUtils not properly exported');
      return false;
    }
    
    console.log('✅ CJS main package import successful');
  } catch (error) {
    console.error(`❌ CJS main package import failed with error: ${error.message}`);
    return false;
  }
  
  // Test individual module imports
  try {
    const zkErrorHandler = require('../../cjs/zkErrorHandler.cjs');
    const zkCircuitRegistry = require('../../cjs/zkCircuitRegistry.cjs');
    const zkSecureInputs = require('../../cjs/zkSecureInputs.cjs');
    const zkUtils = require('../../cjs/zkUtils.cjs');
    const constants = require('../../cjs/constants.cjs');
    
    if (!zkErrorHandler || !zkCircuitRegistry || !zkSecureInputs || !zkUtils || !constants) {
      console.error('❌ CJS individual module imports failed: got undefined');
      return false;
    }
    
    console.log('✅ CJS individual module imports successful');
  } catch (error) {
    console.error(`❌ CJS individual module imports failed with error: ${error.message}`);
    return false;
  }
  
  return true;
};

// Test dynamic ESM imports async (we can't use static import in a CJS file)
const testESMImports = async () => {
  console.log('Testing ESM imports (dynamically)...');
  
  // Test main package entry point
  try {
    const zkPackage = await import('../../src/index.mjs');
    if (!zkPackage || typeof zkPackage !== 'object') {
      console.error('❌ ESM main package import failed: not an object');
      return false;
    }
    
    // Check for default export
    if (!zkPackage.default || typeof zkPackage.default !== 'object') {
      console.error('❌ ESM default export missing or not an object');
      return false;
    }
    
    console.log('✅ ESM main package import successful');
  } catch (error) {
    console.error(`❌ ESM main package import failed with error: ${error.message}`);
    return false;
  }
  
  // Test individual module imports
  try {
    const zkErrorHandler = await import('../../src/zkErrorHandler.mjs');
    const zkCircuitRegistry = await import('../../src/zkCircuitRegistry.mjs');
    const zkSecureInputs = await import('../../src/zkSecureInputs.mjs');
    const zkUtils = await import('../../src/zkUtils.mjs');
    const browserCompat = await import('../../src/browserCompatibility.mjs');
    
    if (!zkErrorHandler || !zkCircuitRegistry || !zkSecureInputs || !zkUtils || !browserCompat) {
      console.error('❌ ESM individual module imports failed: got undefined');
      return false;
    }
    
    // Verify browserCompat has expected exports
    if (!browserCompat.checkBrowserSupport || !browserCompat.getDeviceCapabilities) {
      console.error('❌ browserCompat module missing expected exports');
      return false;
    }
    
    console.log('✅ ESM individual module imports successful');
  } catch (error) {
    console.error(`❌ ESM individual module imports failed with error: ${error.message}`);
    return false;
  }
  
  return true;
};

// Test dual-format compatibility
const testDualFormatCompatibility = async () => {
  console.log('Testing dual-format compatibility...');
  
  try {
    // Import a CJS module
    const cjsUtils = require('../../cjs/zkUtils.cjs');
    
    // Import an ESM module
    const esmUtils = await import('../../src/zkUtils.mjs');
    
    // Verify they have the same API
    const cjsKeys = Object.keys(cjsUtils).sort();
    
    // Get both named exports and default export from ESM
    const esmNamedKeys = Object.keys(esmUtils).filter(k => k !== 'default').sort();
    const esmDefaultKeys = esmUtils.default ? Object.keys(esmUtils.default).sort() : [];
    
    // Check if either export format matches
    const namedMatch = cjsKeys.every(key => esmNamedKeys.includes(key));
    const defaultMatch = cjsKeys.every(key => esmDefaultKeys.includes(key));
    
    if (!namedMatch && !defaultMatch) {
      console.error('❌ API mismatch between ESM and CJS modules');
      console.error('CJS keys:', cjsKeys);
      console.error('ESM named keys:', esmNamedKeys);
      console.error('ESM default keys:', esmDefaultKeys);
      return false;
    }
    
    console.log('✅ API keys match between ESM and CJS modules');
    return true;
  } catch (error) {
    console.error(`❌ Dual-format compatibility test failed with error: ${error.message}`);
    console.error(error.stack);
    return false;
  }
};

// Create a sample test input to verify functionality
const testFunctionalCompatibility = async () => {
  console.log('Testing functional compatibility...');
  
  try {
    // Import zkUtils from both formats
    const cjsUtils = require('../../cjs/zkUtils.cjs');
    const esmUtils = await import('../../src/zkUtils.mjs');
    
    // Get functions from both formats
    const cjsStringify = cjsUtils.stringifyBigInts;
    const esmStringify = esmUtils.default.stringifyBigInts || esmUtils.stringifyBigInts;
    
    // Test data
    const testData = {
      number: 123,
      bigint: BigInt(9007199254740991),
      nested: {
        value: BigInt(123456789)
      }
    };
    
    // Run both functions on the same input
    const cjsResult = cjsStringify(testData);
    const esmResult = esmStringify(testData);
    
    // Compare outputs
    const cjsJSON = JSON.stringify(cjsResult);
    const esmJSON = JSON.stringify(esmResult);
    
    if (cjsJSON !== esmJSON) {
      console.error('❌ Function outputs differ between ESM and CJS');
      console.error('CJS output:', cjsJSON);
      console.error('ESM output:', esmJSON);
      return false;
    }
    
    console.log('✅ Function outputs match between ESM and CJS');
    return true;
  } catch (error) {
    console.error(`❌ Functional compatibility test failed with error: ${error.message}`);
    return false;
  }
};

// Run all tests
const runTests = async () => {
  console.log('=== Module System Standardization Tests (Fixed) ===');
  
  let allPassed = true;
  
  // Test CJS imports
  const cjsResult = testCJSImports();
  allPassed = allPassed && cjsResult;
  
  // Test ESM imports
  const esmResult = await testESMImports();
  allPassed = allPassed && esmResult;
  
  // Test dual-format compatibility
  const dualFormatResult = await testDualFormatCompatibility();
  allPassed = allPassed && dualFormatResult;
  
  // Test functional compatibility
  const functionalResult = await testFunctionalCompatibility();
  allPassed = allPassed && functionalResult;
  
  console.log('\n=== Test Results ===');
  console.log(`CommonJS imports: ${cjsResult ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`ESM imports: ${esmResult ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Dual-format compatibility: ${dualFormatResult ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Functional compatibility: ${functionalResult ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Overall: ${allPassed ? '✅ PASS' : '❌ FAIL'}`);
  
  // Exit with appropriate code
  process.exit(allPassed ? 0 : 1);
};

// Run tests
runTests().catch(error => {
  console.error(`Unexpected error in test runner: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});