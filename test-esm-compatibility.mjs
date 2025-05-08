// Test ESM imports from common package
try {
  // Import package from ESM
  const commonModule = await import('@proof-of-funds/common');
  const zkCoreModule = await import('@proof-of-funds/common/zk-core');
  
  console.log('ESM import test:');
  console.log('- Common package:', !!commonModule);
  console.log('- ZK core subpath:', !!zkCoreModule);
  
  if (commonModule && zkCoreModule) {
    console.log('✅ ESM imports working');
    process.exit(0);
  } else {
    console.log('❌ ESM imports failed - modules undefined');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Failed ESM imports:', error.message);
  process.exit(1);
}
