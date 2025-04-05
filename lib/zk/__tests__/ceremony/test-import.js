/**
 * Test script to check js-sha3 imports
 */

import jsSha3 from 'js-sha3';

console.log('js-sha3 module:', jsSha3);
console.log('Object keys:', Object.keys(jsSha3));

// Test the hash functions
const testString = 'test';
if (typeof jsSha3.sha256 === 'function') {
    console.log('SHA256 hash of "test":', jsSha3.sha256(testString));
} else {
    console.log('sha256 is not a function!');
}

if (typeof jsSha3.keccak256 === 'function') {
    console.log('Keccak256 hash of "test":', jsSha3.keccak256(testString));
} else {
    console.log('keccak256 is not a function!');
}