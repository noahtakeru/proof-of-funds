/**
 * Simple module system test (CommonJS version)
 * 
 * This file checks that our CommonJS modules can be properly imported and accessed.
 */

const zkUtils = require('./cjs/zkUtils.cjs');
const { ZK_PROOF_TYPES } = require('./cjs/constants.cjs'); 
const zkSecureInputs = require('./cjs/zkSecureInputs.cjs');
const zkCircuitRegistry = require('./cjs/zkCircuitRegistry.cjs');

// Test CJS imports
console.log('CJS Module import: ', zkUtils && typeof zkUtils === 'object' ? 'PASS' : 'FAIL');
console.log('CJS toFieldElement: ', typeof zkUtils.toFieldElement === 'function' ? 'PASS' : 'FAIL');
console.log('CJS Constants: ', ZK_PROOF_TYPES ? 'PASS' : 'FAIL');
console.log('CJS zkSecureInputs: ', zkSecureInputs.generateSecureInputs ? 'PASS' : 'FAIL');
console.log('CJS zkCircuitRegistry: ', zkCircuitRegistry.registerCircuit ? 'PASS' : 'FAIL');

// All tests passed?
const allPassed = 
  zkUtils && 
  typeof zkUtils.toFieldElement === 'function' && 
  ZK_PROOF_TYPES &&
  zkSecureInputs.generateSecureInputs &&
  zkCircuitRegistry.registerCircuit;

console.log('\nOverall result: ', allPassed ? 'ALL TESTS PASSED\!' : 'SOME TESTS FAILED');
