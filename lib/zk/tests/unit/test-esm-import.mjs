/**
 * Test ESM Imports
 * 
 * This file validates that our ESM versions of files can be properly imported and used.
 */

// Import ESM versions of utility modules
import zkUtils from './zkUtils.mjs';
import ethersUtils from '../ethersUtils.mjs';
import zkConfig from './real-zk-config.mjs';

console.log('=== Testing ESM Imports ===');

// Check zkUtils
console.log('\nzkUtils functions:');
console.log(Object.keys(zkUtils));
console.log('zkUtils loaded successfully:', Object.keys(zkUtils).length > 0 ? 'PASS' : 'FAIL');

// Check ethersUtils
console.log('\nethersUtils functions:');
console.log(Object.keys(ethersUtils));
console.log('ethersUtils loaded successfully:', Object.keys(ethersUtils).length > 0 ? 'PASS' : 'FAIL');

// Check zkConfig
console.log('\nzkConfig properties:');
console.log(Object.keys(zkConfig));
console.log('zkConfig loaded successfully:', Object.keys(zkConfig).length > 0 ? 'PASS' : 'FAIL');

console.log('\n=== All ESM imports tested ===');