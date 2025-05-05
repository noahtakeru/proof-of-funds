/**
 * Test script to verify that modules with previous circular dependencies can be imported.
 * This is a comprehensive test that checks all modules involved in Phase 1 of the
 * dependency resolution plan.
 */

// Set up an async function to allow top-level await
async function testModules() {
  const results = {
    success: true,
    modules: {},
    failedModules: []
  };
  
  // List of modules to test in the correct order
  const modulesToTest = [
    './lib/zk/src/zkErrorLogger.mjs',
    './lib/zk/src/zkErrorHandler.mjs',
    './lib/zk/src/secureStorage.mjs',
    './lib/zk/src/SecureKeyManager.js',
    './lib/zk/src/zkCircuitInputs.mjs',
    './lib/zk/src/zkCircuitRegistry.mjs',
    './lib/zk/src/zkCircuitParameterDerivation.mjs',
    './lib/zk/src/resources/ResourceMonitor.js',
    './lib/zk/src/resources/ResourceAllocator.js',
    './lib/zk/src/resources/AdaptiveComputation.js',
    './lib/zk/src/resources/ComputationStrategies.js',
    './lib/zk/config/real-zk-config.js',
    './lib/zk/src/zkUtils.mjs',
    './lib/zk/src/browserCompatibility.mjs'
  ];

  // Test each module
  for (const module of modulesToTest) {
    try {
      console.log(`\nTesting import of ${module}...`);
      const imported = await import(module);
      
      // Check if the import was successful
      if (imported) {
        // Store the keys of the module exports
        const keys = Object.keys(imported);
        results.modules[module] = {
          success: true,
          exports: keys.length,
          exportNames: keys.slice(0, 5) // Just show first 5 exports
        };
        console.log(`✅ Successfully imported ${module} with ${keys.length} exports`);
        if (keys.length > 0) {
          console.log(`   Sample exports: ${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''}`);
        }
      } else {
        results.modules[module] = {
          success: false,
          error: 'Import returned undefined'
        };
        results.success = false;
        results.failedModules.push(module);
        console.error(`❌ Failed to import ${module}: Import returned undefined`);
      }
    } catch (error) {
      results.modules[module] = {
        success: false,
        error: error.message
      };
      results.success = false;
      results.failedModules.push(module);
      console.error(`❌ Failed to import ${module}: ${error.message}`);
      if (error.stack) {
        console.error(error.stack.split('\n').slice(0, 3).join('\n'));
      }
    }
  }

  // Print summary
  console.log('\n===== IMPORT TEST SUMMARY =====');
  console.log(`Total modules tested: ${modulesToTest.length}`);
  console.log(`Successful imports: ${modulesToTest.length - results.failedModules.length}`);
  console.log(`Failed imports: ${results.failedModules.length}`);
  
  if (results.failedModules.length > 0) {
    console.log('\nFailed modules:');
    results.failedModules.forEach(module => {
      console.log(`- ${module}: ${results.modules[module].error}`);
    });
  }

  return results;
}

// Run the test
testModules().then(results => {
  if (results.success) {
    console.log('\n✅ ALL MODULES IMPORTED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('\n❌ SOME MODULES FAILED TO IMPORT');
    process.exit(1);
  }
});