/**
 * Simple test for realZkUtils module
 */

import * as realZkUtils from './src/realZkUtils.mjs';
import { toFieldElement } from './src/realZkUtils.mjs';
import realZkUtilsDefault from './src/realZkUtils.mjs';

// Test ESM imports 
console.log('realZkUtils named import: ', Object.keys(realZkUtils).length > 0 ? 'PASS' : 'FAIL');
console.log('realZkUtils specific import: ', typeof toFieldElement === 'function' ? 'PASS' : 'FAIL');
console.log('realZkUtils default import: ', realZkUtilsDefault && typeof realZkUtilsDefault === 'object' ? 'PASS' : 'FAIL');

// All tests passed?
const allPassed = 
  Object.keys(realZkUtils).length > 0 && 
  typeof toFieldElement === 'function' && 
  realZkUtilsDefault;

console.log('\nOverall result: ', allPassed ? 'ALL TESTS PASSED!' : 'SOME TESTS FAILED');