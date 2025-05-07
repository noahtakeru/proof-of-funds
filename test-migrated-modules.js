/**
 * Test script to verify that migrated modules can be imported.
 * This tests all modules migrated in Phase 3 of the dependency resolution plan.
 */

// Set up an async function to allow top-level await
async function testMigratedModules() {
  const results = {
    success: true,
    modules: {},
    failedModules: []
  };
  
  // List of modules to test in the correct order
  const modulesToTest = [
    './packages/common/src/error-handling/zkErrorLogger.mjs',
    './packages/common/src/error-handling/zkErrorHandler.mjs',
    './packages/common/src/system/secureStorage.mjs',
    './packages/common/src/system/SecureKeyManager.js',
    './packages/common/src/zk-core/zkCircuitInputs.mjs',
    './packages/common/src/zk-core/zkCircuitRegistry.mjs',
    './packages/common/src/utils/ethersUtils.js',
    './packages/common/src/config/real-zk-config.js',
    './packages/common/src/config/real-zk-config.mjs',
    './packages/common/src/zk-core/zkUtils.mjs',
    './packages/contracts/src/contracts/ContractInterface.ts'
  ];

  // Test each module
  for (const module of modulesToTest) {
    try {
      console.log(`\nTesting import of ${module}...`);
      
      // Skip TypeScript files as they can't be directly imported
      if (module.endsWith('.ts')) {
        console.log(`⚠️ Skipping TypeScript file ${module} as it needs to be compiled first`);
        continue;
      }
      
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
  console.log('\n===== MIGRATED MODULES IMPORT TEST SUMMARY =====');
  const testedCount = modulesToTest.filter(m => !m.endsWith('.ts')).length;
  console.log(`Total modules tested: ${testedCount}`);
  console.log(`Successful imports: ${testedCount - results.failedModules.length}`);
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
testMigratedModules().then(results => {
  if (results.success) {
    console.log('\n✅ ALL MIGRATED MODULES IMPORTED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('\n❌ SOME MIGRATED MODULES FAILED TO IMPORT');
    process.exit(1);
  }
});