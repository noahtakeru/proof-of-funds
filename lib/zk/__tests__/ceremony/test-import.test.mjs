/**
 * Test script to verify ESM imports of js-sha3 work correctly with Jest
 */

// Import js-sha3 as a default import and then extract the functions
import jssha3 from 'js-sha3';
const { sha3_256, keccak256 } = jssha3;

describe('js-sha3 module (ESM)', () => {
    test('module should be imported correctly', () => {
        console.log('Module imported (ESM):', jssha3);
        expect(jssha3).toBeDefined();
    });

    test('sha3_256 function should be available', () => {
        console.log('sha3_256 function (ESM):', sha3_256);
        expect(sha3_256).toBeDefined();
        expect(typeof sha3_256).toBe('function');
    });

    test('keccak256 function should be available', () => {
        console.log('keccak256 function (ESM):', keccak256);
        expect(keccak256).toBeDefined();
        expect(typeof keccak256).toBe('function');
    });

    test('sha3_256 should generate correct hash', () => {
        const testData = 'test data';
        const hash = sha3_256(testData);
        console.log('SHA3-256 hash (ESM):', hash);

        const expectedHash = 'fc88e0ac33ff105e376f4ece95fb06925d5ab20080dbe3aede7dd47e45dfd931';
        expect(hash).toBe(expectedHash);
    });

    test('keccak256 should generate correct hash', () => {
        const testData = 'test data';
        const hash = keccak256(testData);
        console.log('Keccak256 hash (ESM):', hash);

        const expectedHash = '7d92c840d5f0ac4f83543201db6005d78414059c778169efa3760f67a451e7ef';
        expect(hash).toBe(expectedHash);
    });
}); 