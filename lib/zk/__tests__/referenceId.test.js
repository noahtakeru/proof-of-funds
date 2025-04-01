// Test suite for reference ID functionality
import {
    generateReferenceId,
    formatReferenceId,
    validateReferenceId,
    parseReferenceId,
    referenceIdExists
} from '../referenceId';

describe('Reference ID Utilities', () => {
    test('generates unique IDs for different inputs', () => {
        const id1 = generateReferenceId('0x123456789abcdef0', 'balance');
        const id2 = generateReferenceId('0x123456789abcdef0', 'threshold');
        const id3 = generateReferenceId('0xabcdef0123456789', 'balance');

        expect(id1).not.toEqual(id2);
        expect(id1).not.toEqual(id3);
        expect(id2).not.toEqual(id3);

        expect(id1.length).toBe(8);
        expect(id2.length).toBe(8);
        expect(id3.length).toBe(8);
    });

    test('formats reference IDs correctly', () => {
        // Test formatting a raw ID
        const id = 'ABCD1234';
        const formatted = formatReferenceId(id);
        expect(formatted).toBe('ABCD-1234');

        // Test formatting an already formatted ID
        const formattedAgain = formatReferenceId(formatted);
        expect(formattedAgain).toBe('ABCD-1234');

        // Test formatting lowercase
        const lowercaseId = 'abcd1234';
        const formattedLowercase = formatReferenceId(lowercaseId);
        expect(formattedLowercase).toBe('ABCD-1234');
    });

    test('validates reference IDs correctly', () => {
        // Valid IDs
        expect(validateReferenceId('ABCD1234')).toBe(true);
        expect(validateReferenceId('abcd1234')).toBe(true);
        expect(validateReferenceId('ABCD-1234')).toBe(true);
        expect(validateReferenceId('A1B2C3D4')).toBe(true);

        // Invalid IDs
        expect(validateReferenceId('123456')).toBe(false); // Too short
        expect(validateReferenceId('12345678901')).toBe(false); // Too long
        expect(validateReferenceId('ABCD-12X$')).toBe(false); // Invalid characters
        expect(validateReferenceId('')).toBe(false); // Empty string
    });

    test('parses reference IDs correctly', () => {
        expect(parseReferenceId('ABCD-1234')).toBe('ABCD1234');
        expect(parseReferenceId('abcd-1234')).toBe('ABCD1234');
        expect(parseReferenceId('ABCD1234')).toBe('ABCD1234');
    });

    test('checks if reference IDs exist', async () => {
        // Mock IDs defined in the function
        expect(await referenceIdExists('ABCD1234')).toBe(true);
        expect(await referenceIdExists('EFGH5678')).toBe(true);
        expect(await referenceIdExists('ABCD-1234')).toBe(true);

        // Non-existing IDs
        expect(await referenceIdExists('XXXX9999')).toBe(false);
        expect(await referenceIdExists('YYYY-8888')).toBe(false);
    });
}); 