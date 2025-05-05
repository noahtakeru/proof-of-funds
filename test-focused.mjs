/**
 * Test focused specifically on the bridge file and parameter derivation issues
 */

async function testCircuitInputsBridge() {
  console.log('Testing zkCircuitInputs.js bridge file...');
  try {
    const { addressToBytes } = await import('./lib/zk/src/zkCircuitInputs.js');
    console.log('✅ Successfully imported addressToBytes from zkCircuitInputs.js');
    return true;
  } catch (error) {
    console.error('❌ Failed to import from zkCircuitInputs.js:', error.message);
    return false;
  }
}

async function testParameterDerivation() {
  console.log('Testing zkCircuitParameterDerivation.mjs...');
  try {
    const derivation = await import('./lib/zk/src/zkCircuitParameterDerivation.mjs');
    console.log('✅ Successfully imported zkCircuitParameterDerivation.mjs');
    return true;
  } catch (error) {
    console.error('❌ Failed to import zkCircuitParameterDerivation.mjs:', error.message);
    return false;
  }
}

// Run the tests
(async () => {
  await testCircuitInputsBridge();
  await testParameterDerivation();
})();