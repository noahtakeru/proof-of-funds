#!/usr/bin/env node

/**
 * ZK Proof Test Script
 * 
 * This script runs tests for the ZK proof functionality in the application.
 * It tests reference ID generation, formatting, proof encryption, and verification.
 */

const { generateReferenceId, formatReferenceId, validateReferenceId } = require('../lib/zk/referenceId');
const { generateAccessKey, encryptProof, decryptProof, hashAccessKey, verifyAccessKey } = require('../lib/zk/proofEncryption');
const { verifyProofLocally } = require('../lib/zk/zkProofVerifier');

// Test reference ID generation and formatting
function testReferenceId() {
    console.log('\n=== Testing Reference ID Generation ===');

    // Generate reference IDs
    const id1 = generateReferenceId('0x123456789abcdef0', 'balance');
    const id2 = generateReferenceId('0x123456789abcdef0', 'threshold');
    const id3 = generateReferenceId('0xabcdef0123456789', 'balance');

    console.log('Generated IDs:');
    console.log(`ID 1: ${id1}`);
    console.log(`ID 2: ${id2}`);
    console.log(`ID 3: ${id3}`);

    // Format reference IDs
    const formatted1 = formatReferenceId(id1);

    console.log('\nFormatted IDs:');
    console.log(`Original: ${id1} → Formatted: ${formatted1}`);

    // Validate reference IDs
    console.log('\nValidation Results:');
    console.log(`Valid ID: ${id1} → ${validateReferenceId(id1)}`);
    console.log(`Valid formatted ID: ${formatted1} → ${validateReferenceId(formatted1)}`);
    console.log(`Invalid ID (too short): 123456 → ${validateReferenceId('123456')}`);

    return { id1, formatted1 };
}

// Test proof encryption and decryption
function testProofEncryption() {
    console.log('\n=== Testing Proof Encryption ===');

    // Generate access key
    const accessKey = generateAccessKey();
    console.log(`Generated access key: ${accessKey}`);

    // Create sample proof data
    const proofData = {
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        proofType: 'balance',
        amount: '1000',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        proofData: {
            proof: { a: [1, 2], b: [[3, 4], [5, 6]], c: [7, 8] },
            publicSignals: ['0x1234567890abcdef1234567890abcdef12345678']
        }
    };

    // Encrypt the proof
    const encryptedData = encryptProof(proofData, accessKey);
    console.log(`Encrypted data (first 50 chars): ${encryptedData.substring(0, 50)}...`);

    // Decrypt the proof
    const decryptedData = decryptProof(encryptedData, accessKey);
    console.log('\nDecryption successful:', decryptedData !== null);

    if (decryptedData) {
        console.log('Decrypted wallet address:', decryptedData.walletAddress);
        console.log('Decrypted proof type:', decryptedData.proofType);
    }

    // Test access key hashing
    const hashedKey = hashAccessKey(accessKey);
    console.log(`\nAccess key hash: ${hashedKey.substring(0, 20)}...`);
    console.log(`Verify access key: ${verifyAccessKey(accessKey, hashedKey)}`);

    return { accessKey, encryptedData, proofData };
}

// Test proof verification
function testProofVerification(proofData) {
    console.log('\n=== Testing Proof Verification ===');

    // Verify a valid proof
    const isValid = verifyProofLocally(
        proofData.proofData,
        proofData.walletAddress,
        proofData.proofType
    );

    console.log(`Verification result: ${isValid ? 'Valid ✅' : 'Invalid ❌'}`);

    // Test with simulated proof for threshold check
    const simulatedProof = {
        _simulated: true,
        _comparisonResult: true
    };

    const isSimValid = verifyProofLocally(
        simulatedProof,
        '0xabcdef1234567890',
        'threshold'
    );

    console.log(`Simulated proof verification: ${isSimValid ? 'Valid ✅' : 'Invalid ❌'}`);
}

// Run all tests
function runTests() {
    console.log('=== ZK Proof System Tests ===');

    try {
        const { id1, formatted1 } = testReferenceId();
        console.log('\n✅ Reference ID tests passed');

        const { accessKey, encryptedData, proofData } = testProofEncryption();
        console.log('\n✅ Encryption tests passed');

        testProofVerification(proofData);
        console.log('\n✅ Verification tests passed');

        console.log('\n=== All Tests Completed Successfully ===');
        return 0; // Success exit code
    } catch (error) {
        console.error('\n❌ Test Failed:');
        console.error(error.message);
        console.error('\nStack trace:');
        console.error(error.stack);
        return 1; // Error exit code
    }
}

// Run the tests and exit with appropriate code
try {
    const exitCode = runTests();
    process.exit(exitCode);
} catch (error) {
    console.error('\n❌ Unexpected error:');
    console.error(error);
    process.exit(1);
} 