/**
 * Test script to verify CommonJS imports of js-sha3 work correctly
 */

const jssha3 = require('js-sha3');
const { sha3_256, keccak256 } = jssha3;

describe('js-sha3 module', () => {
    test('module should be imported correctly', () => {
        console.log('Module imported:', jssha3);
        expect(jssha3).toBeDefined();
    });

    test('sha3_256 function should be available', () => {
        console.log('sha3_256 function:', sha3_256);
        expect(sha3_256).toBeDefined();
        expect(typeof sha3_256).toBe('function');
    });

    test('keccak256 function should be available', () => {
        console.log('keccak256 function:', keccak256);
        expect(keccak256).toBeDefined();
        expect(typeof keccak256).toBe('function');
    });

    test('sha3_256 should generate correct hash', () => {
        const testData = 'test data';
        const hash = sha3_256(testData);
        console.log('SHA3-256 hash:', hash);

        const expectedHash = 'fc88e0ac33ff105e376f4ece95fb06925d5ab20080dbe3aede7dd47e45dfd931';
        expect(hash).toBe(expectedHash);
    });

    test('keccak256 should generate correct hash', () => {
        const testData = 'test data';
        const hash = keccak256(testData);
        console.log('Keccak256 hash:', hash);

        const expectedHash = '7d92c840d5f0ac4f83543201db6005d78414059c778169efa3760f67a451e7ef';
        expect(hash).toBe(expectedHash);
    });
}); 