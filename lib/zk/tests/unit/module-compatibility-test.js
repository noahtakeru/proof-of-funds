/**
 * Module System Compatibility Test
 * 
 * This test demonstrates compatibility between ESM and CommonJS modules.
 */

// Import the module loader helper
const moduleLoader = require('../../cjs/moduleLoader.cjs');
const { isCommonJS, loadModule } = moduleLoader;

/**
 * Test ESM and CommonJS compatibility
 */
async function testModuleCompatibility() {
  console.log('=== Module System Compatibility Test ===');
  console.log(`Running in ${isCommonJS ? 'CommonJS' : 'ESM'} environment\n`);

  try {
    // Load zkUtils from both formats
    console.log('Testing zkUtils compatibility...');
    const cjsUtils = require('../../cjs/zkUtils.cjs');
    const esmUtils = await import('../../src/zkUtils.mjs').then(m => m.default || m);
    
    // Check API compatibility
    const cjsKeys = Object.keys(cjsUtils).sort();
    const esmKeys = Object.keys(esmUtils).sort();
    
    // Compare function signatures
    const apiMatch = cjsKeys.every(key => esmKeys.includes(key));
    
    if (apiMatch) {
      console.log('✅ API compatibility: PASS');
    } else {
      console.log('❌ API compatibility: FAIL');
      console.log('  CJS Keys:', cjsKeys);
      console.log('  ESM Keys:', esmKeys);
      process.exit(1);
    }
    
    // Test serialization functions
    console.log('\nTesting zkProofSerializer compatibility...');
    const cjsSerializer = require('../../cjs/zkProofSerializer.cjs');
    const esmSerializer = await import('../../src/zkProofSerializer.mjs').then(m => m.default || m);
    
    // Check function existence
    const serializerFuncs = [
      'serializeProof', 
      'deserializeProof', 
      'extractProofForVerification',
      'isValidProof',
      'getProofMetadata'
    ];
    
    let allFuncsPresent = true;
    
    for (const func of serializerFuncs) {
      if (typeof cjsSerializer[func] !== 'function') {
        console.log(`❌ Missing CJS function: ${func}`);
        allFuncsPresent = false;
      }
      
      if (typeof esmSerializer[func] !== 'function') {
        console.log(`❌ Missing ESM function: ${func}`);
        allFuncsPresent = false;
      }
    }
    
    if (allFuncsPresent) {
      console.log('✅ Function availability: PASS');
    } else {
      console.log('❌ Function availability: FAIL');
      process.exit(1);
    }
    
    // Test browser compatibility module
    console.log('\nTesting browser compatibility module...');
    const cjsBrowserCompat = require('../../cjs/browserCompatibility.cjs');
    const esmBrowserCompat = await import('../../src/browserCompatibility.mjs');
    
    if (cjsBrowserCompat.checkBrowserSupport && esmBrowserCompat.checkBrowserSupport) {
      console.log('✅ Browser compatibility module: PASS');
    } else {
      console.log('❌ Browser compatibility module: FAIL');
      process.exit(1);
    }
    
    // Test main package export
    console.log('\nTesting main package exports...');
    const cjsPackage = require('../../cjs/index.cjs');
    
    if (cjsPackage && typeof cjsPackage === 'object') {
      console.log('✅ CJS package export: PASS');
    } else {
      console.log('❌ CJS package export: FAIL');
      process.exit(1);  
    }
    
    // Import ESM package (need to use dynamic import)
    try {
      const esmPackage = await import('../../src/index.mjs');
      
      if (esmPackage && (esmPackage.default || Object.keys(esmPackage).length > 0)) {
        console.log('✅ ESM package export: PASS');
      } else {
        console.log('❌ ESM package export: FAIL');
        process.exit(1);
      }
    } catch (error) {
      console.log(`❌ ESM package export: FAIL (${error.message})`);
      process.exit(1);
    }
    
    console.log('\n=== All compatibility tests PASSED ===');
    process.exit(0);
  } catch (error) {
    console.error('Error during compatibility test:', error);
    process.exit(1);
  }
}

// Run the test
testModuleCompatibility().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});