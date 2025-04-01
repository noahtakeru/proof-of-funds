/**
 * End-to-End Test for ZK Proof Workflow
 * 
 * This test verifies the complete workflow of creating, sharing, and verifying a ZK proof.
 * It tests the integration between all ZK modules.
 */

// Import functions from all ZK modules
const { generateReferenceId, formatReferenceId, validateReferenceId } = require('../referenceId');
const { generateAccessKey, encryptProof, decryptProof, hashAccessKey } = require('../proofEncryption');
const { verifyProofLocally } = require('../zkProofVerifier');

// Mock crypto for Node.js environment
global.crypto = {
    getRandomValues: function (arr) {
        for (let i = 0; i < arr.length; i++) {
            arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
    }
};

// Jest setup
beforeEach(() => {
    jest.clearAllMocks();
});

describe('ZK Proof Workflow', () => {
    // Test data for a user with a wallet
    const testWallet = {
        address: '0x7c5bCf47eC0f243eE60afF7c21a2D2D7124D7c71',
        balance: '5000000000000000000' // 5 ETH in wei
    };

    // Test proof data
    let proofData;
    let referenceId;
    let accessKey;
    let hashedKey;
    let encryptedProof;

    test('1. Create a proof with a unique reference ID', () => {
        // Generate a reference ID for the proof
        referenceId = generateReferenceId(testWallet.address, 'balance');

        // Validate the reference ID format
        expect(validateReferenceId(referenceId)).toBe(true);
        expect(referenceId.length).toBe(8);

        // Format the reference ID
        const formattedId = formatReferenceId(referenceId);
        expect(formattedId.includes('-')).toBe(true);

        // Create a proof for the wallet
        proofData = {
            proofData: {
                proof: { a: [1, 2], b: [[3, 4], [5, 6]], c: [7, 8] },
                publicSignals: [testWallet.address]
            },
            walletAddress: testWallet.address,
            proofType: 'balance',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            amount: '5',
            threshold: null
        };

        expect(proofData).toBeDefined();
        expect(proofData.walletAddress).toBe(testWallet.address);
    });

    test('2. Encrypt the proof with an access key', () => {
        // Generate an access key
        accessKey = generateAccessKey(16);
        expect(accessKey.length).toBe(16);

        // Hash the access key for storage
        hashedKey = hashAccessKey(accessKey);
        expect(hashedKey).not.toBe(accessKey);

        // Encrypt the proof
        encryptedProof = encryptProof(proofData, accessKey);
        expect(encryptedProof).toBeDefined();
        expect(typeof encryptedProof).toBe('string');

        // The encrypted proof should not contain the original data in plaintext
        expect(encryptedProof).not.toContain(testWallet.address);
    });

    test('3. Store proof metadata in a database', () => {
        // In a real app, we would store:
        // 1. Reference ID
        // 2. Hashed access key (not the actual key)
        // 3. Encrypted proof data
        // 4. Creation timestamp
        // 5. Expiry timestamp

        // Here we'll simulate storing in a mock database
        const mockDatabase = new Map();

        mockDatabase.set(referenceId, {
            hashedAccessKey: hashedKey,
            encryptedProof: encryptedProof,
            createdAt: proofData.createdAt,
            expiresAt: proofData.expiresAt,
            isRevoked: false
        });

        // Verify the data was "stored" correctly
        expect(mockDatabase.has(referenceId)).toBe(true);
        expect(mockDatabase.get(referenceId).hashedAccessKey).toBe(hashedKey);
    });

    test('4. Share and verify the proof', () => {
        // A user receives a reference ID and access key
        const sharedReferenceId = referenceId;
        const sharedAccessKey = accessKey;

        // In a real app, they would fetch the encrypted proof from a database
        // Here we'll use the encrypted proof from the previous step
        const fetchedEncryptedProof = encryptedProof;

        // Decrypt the proof using the shared access key
        const decryptedProof = decryptProof(fetchedEncryptedProof, sharedAccessKey);

        // Verify the decrypted proof is valid
        expect(decryptedProof).toBeDefined();
        expect(decryptedProof.walletAddress).toBe(testWallet.address);

        // Verify the proof cryptographically
        const isValid = verifyProofLocally(
            decryptedProof.proofData,
            decryptedProof.walletAddress,
            decryptedProof.proofType
        );

        expect(isValid).toBe(true);
    });

    test('5. Attempt verification with incorrect access key', () => {
        // A user tries to verify with an incorrect access key
        const wrongAccessKey = generateAccessKey(16);

        // Attempt to decrypt the proof using the wrong access key
        const decryptedProof = decryptProof(encryptedProof, wrongAccessKey);

        // The decryption should fail
        expect(decryptedProof).toBeNull();
    });

    test('6. Check if a proof has expired', () => {
        // Create a proof that has already expired
        const expiredProofData = {
            ...proofData,
            expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // 1 day ago
        };

        // Check if the proof has expired
        const now = new Date();
        const expiryDate = new Date(expiredProofData.expiresAt);

        const isExpired = now > expiryDate;
        expect(isExpired).toBe(true);
    });
}); 