/**
 * Simple test for realZkUtils module (CommonJS version)
 */

const realZkUtils = require('./cjs/realZkUtils.cjs');

// Test CJS imports
console.log('realZkUtils import: ', realZkUtils && typeof realZkUtils === 'object' ? 'PASS' : 'FAIL');
console.log('toFieldElement function: ', typeof realZkUtils.toFieldElement === 'function' ? 'PASS' : 'FAIL');
console.log('padArray function: ', typeof realZkUtils.padArray === 'function' ? 'PASS' : 'FAIL');
console.log('generateZKProof function: ', typeof realZkUtils.generateZKProof === 'function' ? 'PASS' : 'FAIL');
console.log('verifyZKProof function: ', typeof realZkUtils.verifyZKProof === 'function' ? 'PASS' : 'FAIL');

// All tests passed?
const allPassed = 
  realZkUtils && 
  typeof realZkUtils.toFieldElement === 'function' &&
  typeof realZkUtils.padArray === 'function' &&
  typeof realZkUtils.generateZKProof === 'function' &&
  typeof realZkUtils.verifyZKProof === 'function';

console.log('\nOverall result: ', allPassed ? 'ALL TESTS PASSED!' : 'SOME TESTS FAILED');