/**
 * Test to verify js-sha3 imports using CommonJS require
 */

// Import js-sha3 using CommonJS require syntax
const jsSha3 = require('js-sha3');

describe('JS-SHA3 Import Test', () => {
    test('js-sha3 import works correctly', () => {
        // Check that we have the expected hash functions
        expect(jsSha3).toBeDefined();
        expect(typeof jsSha3.sha3_256).toBe('function');
        expect(typeof jsSha3.keccak256).toBe('function');

        // Verify hash outputs are as expected
        const testString = 'test';
        const sha3Hash = jsSha3.sha3_256(testString);
        const keccakHash = jsSha3.keccak256(testString);

        expect(sha3Hash).toBe('36f028580bb02cc8272a9a020f4200e346e276ae664e45ee80745574e2f5ab80');
        expect(keccakHash).toBe('9c22ff5f21f0b81b113e63f7db6da94fedef11b2119b4088b89664fb9a3cb658');
    });
}); 