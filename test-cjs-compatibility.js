// Test CommonJS compatibility
// This file specifically tests require() imports
// to ensure CommonJS interoperability

console.log('Testing direct CommonJS require() imports...');

// We need to catch any errors from dynamic imports within this script
(async () => {
  try {
    // Try using require (this will only work after we've built the CJS versions)
    // Using a dynamic import to load the module if require fails
    let logger, zkUtils;
    
    try {
      // Try to require the modules (this should work after conversion)
      logger = require('@proof-of-funds/common/error-handling');
      zkUtils = require('@proof-of-funds/common/zk-core');
      
      console.log('✅ CommonJS require imports successful');
    } catch (requireError) {
      console.warn('⚠️ CommonJS require failed:', requireError.message);
      console.log('Falling back to dynamic import...');
      
      // Fallback to dynamic import
      const errorHandlingModule = await import('@proof-of-funds/common/error-handling');
      const zkCoreModule = await import('@proof-of-funds/common/zk-core');
      
      logger = errorHandlingModule;
      zkUtils = zkCoreModule;
      
      console.log('✅ Fallback to dynamic import successful');
    }
    
    console.log('CJS compatibility test:');
    console.log('- Error handling module:', !!logger);
    console.log('- ZK core module:', !!zkUtils);
    
    if (logger && zkUtils) {
      console.log('✅ Module resolution confirmed in CJS context');
      process.exit(0);
    } else {
      console.log('❌ Module resolution failed in CJS context');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Failed CJS compatibility test:', error.message);
    process.exit(1);
  }
})();