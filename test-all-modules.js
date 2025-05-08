/**
 * Comprehensive module compatibility test script
 * Tests all module formats and package imports
 */

console.log('Running comprehensive module compatibility tests...');
console.log('=================================================');

const testResults = {
  esm: null,
  commonjs: null,
  cjs: null
};

async function runTests() {
  // Test 1: ESM imports (.mjs)
  console.log('\n1. Testing ESM imports (test-esm-compatibility.mjs)...');
  try {
    const { execSync } = require('child_process');
    const esmOutput = execSync('node test-esm-compatibility.mjs', { encoding: 'utf8' });
    console.log(esmOutput);
    testResults.esm = true;
  } catch (error) {
    console.error('❌ ESM test failed:', error.message);
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.error(error.stderr);
    testResults.esm = false;
  }

  // Test 2: CommonJS with dynamic imports (.js)
  console.log('\n2. Testing CommonJS with dynamic imports (test-module-resolution.js)...');
  try {
    const { execSync } = require('child_process');
    const cjsOutput = execSync('node test-module-resolution.js', { encoding: 'utf8' });
    console.log(cjsOutput);
    testResults.commonjs = true;
  } catch (error) {
    console.error('❌ CommonJS test failed:', error.message);
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.error(error.stderr);
    testResults.commonjs = false;
  }

  // Test 3: Direct CommonJS require() compatibility (.js)
  console.log('\n3. Testing direct CommonJS require compatibility (test-cjs-compatibility.js)...');
  try {
    const { execSync } = require('child_process');
    const requireOutput = execSync('node test-cjs-compatibility.js', { encoding: 'utf8' });
    console.log(requireOutput);
    testResults.cjs = true;
  } catch (error) {
    console.error('❌ Direct CJS require test failed:', error.message);
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.error(error.stderr);
    testResults.cjs = false;
  }

  // Summary
  console.log('\n=================================================');
  console.log('Module Compatibility Test Summary:');
  console.log('=================================================');
  console.log(`ESM imports (.mjs): ${testResults.esm ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`CommonJS dynamic imports (.js): ${testResults.commonjs ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Direct CommonJS require (.js): ${testResults.cjs ? '✅ PASSED' : '❌ FAILED'}`);
  
  const overallResult = Object.values(testResults).every(result => result === true);
  
  console.log('=================================================');
  console.log(`Overall Result: ${overallResult ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  console.log('=================================================');
  
  // Exit with appropriate code
  process.exit(overallResult ? 0 : 1);
}

runTests().catch(error => {
  console.error('Test runner encountered an error:', error);
  process.exit(1);
});