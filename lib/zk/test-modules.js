/**
 * Simple module system test
 * 
 * This file checks that our modules can be properly imported and accessed.
 */

import * as zkUtils from './src/zkUtils.mjs';
import { toFieldElement } from './src/zkUtils.mjs';
import zkUtilsDefault from './src/zkUtils.mjs';

// Test ESM imports
console.log('ESM Named exports: ', Object.keys(zkUtils).length > 0 ? 'PASS' : 'FAIL');
console.log('ESM Specific import: ', typeof toFieldElement === 'function' ? 'PASS' : 'FAIL');
console.log('ESM Default import: ', zkUtilsDefault && typeof zkUtilsDefault === 'object' ? 'PASS' : 'FAIL');

// Test constants
import * as constants from './src/constants.js';
console.log('Constants import: ', constants.ZK_PROOF_TYPES ? 'PASS' : 'FAIL');

// Check some specific modules
import * as zkSecureInputs from './src/zkSecureInputs.mjs';
import * as zkCircuitRegistry from './src/zkCircuitRegistry.mjs';

console.log('zkSecureInputs: ', zkSecureInputs.generateSecureInputs ? 'PASS' : 'FAIL');
console.log('zkCircuitRegistry: ', zkCircuitRegistry.registerCircuit ? 'PASS' : 'FAIL');

// All tests passed?
const allPassed = 
  Object.keys(zkUtils).length > 0 && 
  typeof toFieldElement === 'function' && 
  zkUtilsDefault && 
  constants.ZK_PROOF_TYPES &&
  zkSecureInputs.generateSecureInputs &&
  zkCircuitRegistry.registerCircuit;

console.log('\nOverall result: ', allPassed ? 'ALL TESTS PASSED\!' : 'SOME TESTS FAILED');
