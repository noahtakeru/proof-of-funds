/**
 * Test script to verify ESM imports of js-sha3 work correctly
 */

// Import js-sha3 as a default import and then extract the functions
import jssha3 from 'js-sha3';
const { sha3_256, keccak256 } = jssha3;

console.log('Module imported:', jssha3);
console.log('Functions extracted:', { sha3_256, keccak256 });

// Test the hash functions
if (sha3_256) {
    const testData = 'test data';
    const hash = sha3_256(testData);
    console.log('SHA3-256 hash:', hash);

    // Verify hash is correct
    const expectedHash = 'fc88e0ac33ff105e376f4ece95fb06925d5ab20080dbe3aede7dd47e45dfd931';
    console.log('Hash matches expected:', hash === expectedHash);
} else {
    console.log('sha3_256 function not available');
}

if (keccak256) {
    const testData = 'test data';
    const hash = keccak256(testData);
    console.log('Keccak256 hash:', hash);

    // Verify hash is correct
    const expectedHash = '7d92c840d5f0ac4f83543201db6005d78414059c778169efa3760f67a451e7ef';
    console.log('Hash matches expected:', hash === expectedHash);
} else {
    console.log('keccak256 function not available');
} 