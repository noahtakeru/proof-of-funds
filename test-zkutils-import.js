/**
 * Test script to verify that zkUtils.mjs can be imported properly
 */

// Set up an async function to allow top-level await
async function testImport() {
  try {
    console.log('Attempting to import zkUtils.mjs...');
    const zkUtils = await import('./lib/zk/src/zkUtils.mjs');
    console.log('Import successful!');
    console.log('Available functions:', Object.keys(zkUtils));
    return { success: true, message: 'zkUtils.mjs imported successfully' };
  } catch (error) {
    console.error('Import failed:', error);
    return { success: false, message: `Import failed: ${error.message}`, error };
  }
}

// Run the test
testImport().then(result => {
  if (result.success) {
    console.log('✅ TEST PASSED:', result.message);
    process.exit(0);
  } else {
    console.error('❌ TEST FAILED:', result.message);
    if (result.error && result.error.stack) {
      console.error(result.error.stack);
    }
    process.exit(1);
  }
});