/**
 * Focused test for Phase 1.3 of the dependency resolution plan
 * This script tests the modules that were fixed for module format inconsistencies.
 */

// Test results
const results = {
  passed: 0,
  failed: 0,
  details: []
};

// Record test result
function recordResult(name, passed, message = '') {
  if (passed) {
    results.passed++;
    results.details.push(`✅ ${name}`);
  } else {
    results.failed++;
    results.details.push(`❌ ${name}: ${message}`);
  }
}

// Test zkCircuitInputs.js bridge
async function testCircuitInputsBridge() {
  try {
    const { addressToBytes } = await import('./lib/zk/src/zkCircuitInputs.js');
    recordResult('zkCircuitInputs.js bridge', typeof addressToBytes === 'function');
    
    // Test functionality
    if (typeof addressToBytes === 'function') {
      try {
        const bytes = addressToBytes("0x1234567890123456789012345678901234567890");
        recordResult('addressToBytes functionality', bytes.length === 20);
      } catch (error) {
        recordResult('addressToBytes functionality', false, error.message);
      }
    }
  } catch (error) {
    recordResult('zkCircuitInputs.js bridge', false, error.message);
  }
}

// Test zkCircuitRegistry.js bridge
async function testCircuitRegistryBridge() {
  try {
    const { getCircuitMemoryRequirements } = await import('./lib/zk/src/zkCircuitRegistry.js');
    recordResult('zkCircuitRegistry.js bridge', typeof getCircuitMemoryRequirements === 'function');
    
    // Test functionality
    if (typeof getCircuitMemoryRequirements === 'function') {
      try {
        const requirements = getCircuitMemoryRequirements('standard');
        recordResult('getCircuitMemoryRequirements functionality', 
          typeof requirements === 'object' && requirements.proving > 0);
      } catch (error) {
        recordResult('getCircuitMemoryRequirements functionality', false, error.message);
      }
    }
  } catch (error) {
    recordResult('zkCircuitRegistry.js bridge', false, error.message);
  }
}

// Test zkCircuitParameterDerivation.mjs
async function testCircuitParameterDerivation() {
  try {
    const module = await import('./lib/zk/src/zkCircuitParameterDerivation.mjs');
    recordResult('zkCircuitParameterDerivation.mjs', !!module.default);
  } catch (error) {
    recordResult('zkCircuitParameterDerivation.mjs', false, error.message);
  }
}

// Test zkUtils.mjs
async function testZkUtils() {
  try {
    const module = await import('./lib/zk/src/zkUtils.mjs');
    recordResult('zkUtils.mjs', !!module.default);
  } catch (error) {
    recordResult('zkUtils.mjs', false, error.message);
  }
}

// Test browserCompatibility.mjs
async function testBrowserCompatibility() {
  try {
    const module = await import('./lib/zk/src/browserCompatibility.mjs');
    recordResult('browserCompatibility.mjs', !!module.default);
  } catch (error) {
    recordResult('browserCompatibility.mjs', false, error.message);
  }
}

// Run all tests sequentially
async function runAllTests() {
  console.log('Testing Phase 1.3: Module Format Inconsistencies...\n');
  
  await testCircuitInputsBridge();
  await testCircuitRegistryBridge();
  await testCircuitParameterDerivation();
  await testZkUtils();
  await testBrowserCompatibility();
  
  // Print results
  console.log('--- TEST RESULTS ---');
  console.log(`Passed: ${results.passed}, Failed: ${results.failed}`);
  results.details.forEach(detail => console.log(detail));
  
  if (results.failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Phase 1.3 is complete.');
  } else {
    console.log(`\n❌ ${results.failed} tests failed. Phase 1.3 is not yet complete.`);
  }
}

// Run the tests
runAllTests().catch(error => {
  console.error('Fatal error running tests:', error);
});