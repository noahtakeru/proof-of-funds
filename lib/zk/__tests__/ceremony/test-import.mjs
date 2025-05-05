/**
 * Test script for checking js-sha3 imports
 */

// Import js-sha3 for ESM - we need to use default import for CommonJS modules
import pkg from 'js-sha3';
const { sha3_256, keccak256 } = pkg;

// Log the module and its keys
console.log("Module keys:", Object.keys({ sha3_256, keccak256 }));

// Test sha3_256
if (sha3_256) {
    console.log("sha3_256 hash of 'test':", sha3_256('test'));
} else {
    console.log("sha3_256 not available");
}

// Test keccak256
if (keccak256) {
    console.log("keccak256 hash of 'test':", keccak256('test'));
} else {
    console.log("keccak256 not available");
}