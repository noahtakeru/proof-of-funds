// Test importing from common package
console.log('Testing CommonJS module resolution...');

// Use dynamic import instead of require since the package may be ESM
// This allows us to test both ESM and CommonJS imports in their respective files
async function testModuleResolution() {
  try {
    // Import using dynamic import which works in both ESM and CommonJS
    const commonModule = await import('@proof-of-funds/common');
    console.log('✅ Common package imported successfully');
    
    // Test importing from specific subpath
    try {
      const zkCoreModule = await import('@proof-of-funds/common/zk-core');
      console.log('✅ ZK core subpath imported successfully');
      
      console.log('Module resolution test:');
      console.log('- Common package:', !!commonModule);
      console.log('- ZK core subpath:', !!zkCoreModule);
      
      if (commonModule && zkCoreModule) {
        console.log('✅ All modules resolved successfully');
        process.exit(0);
      } else {
        console.log('❌ Module resolution failed - modules undefined');
        process.exit(1);
      }
    } catch (subpathError) {
      console.error('❌ Failed to import ZK core subpath:', subpathError.message);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Failed to import common package:', error.message);
    process.exit(1);
  }
}

testModuleResolution();
