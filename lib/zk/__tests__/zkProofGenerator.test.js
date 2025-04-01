// Mock external dependencies first
jest.mock('circomlibjs', () => ({
  buildPoseidon: jest.fn().mockResolvedValue(() => 'mocked-poseidon-hash')
}), { virtual: true });

jest.mock('snarkjs', () => ({
  groth16: {
    fullProve: jest.fn().mockRejectedValue(new Error('Circuit not available')),
    verify: jest.fn().mockResolvedValue(true)
  }
}), { virtual: true });

jest.mock('../walletHelpers', () => ({
  fetchPricesForSymbols: jest.fn().mockResolvedValue([{ symbol: 'ETH', price: 3000 }])
}), { virtual: true });

jest.mock('../proofEncryption', () => ({
  generateAccessKey: jest.fn().mockReturnValue('mocked-access-key'),
  encryptProof: jest.fn().mockImplementation((data, key) => 
    Promise.resolve(`encrypted:${JSON.stringify(data)}:${key}`))
}), { virtual: true });

jest.mock('ethers', () => {
  const mockedBigNumber = (val) => ({
    toBigInt: () => BigInt(val),
    eq: (other) => BigInt(val) === BigInt(other.toString()),
    gte: (other) => BigInt(val) >= BigInt(other.toString()),
    lte: (other) => BigInt(val) <= BigInt(other.toString()),
    toString: () => val.toString()
  });
  
  return {
    ethers: {
      BigNumber: {
        from: jest.fn().mockImplementation(val => mockedBigNumber(val))
      },
      utils: {
        keccak256: jest.fn().mockReturnValue('0xmockhash'),
        toUtf8Bytes: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
        defaultAbiCoder: {
          encode: jest.fn().mockReturnValue('0xencoded')
        },
        parseUnits: jest.fn().mockImplementation((val, units) => 
          val + '0'.repeat(Number(units))),
        formatUnits: jest.fn().mockImplementation((val, units) => 
          val.toString().slice(0, -Number(units))),
        parseEther: jest.fn().mockImplementation(val => val + '000000000000000000'),
        formatEther: jest.fn().mockImplementation(val => val.toString().replace('000000000000000000', ''))
      }
    }
  };
});

// Now import the module to test
import {
  generateZKProof,
  serializeProof,
  deserializeProof,
  createProofPackage
} from '../zkProofGenerator';

describe('ZK Proof Generator', () => {
  // Sample test data
  const testWalletAddress = '0x1234567890abcdef1234567890abcdef12345678';
  const testBalance = '10000000000000000000'; // 10 ETH
  const testThreshold = '5000000000000000000'; // 5 ETH
  
  test('generates simulated proof when circuit is not available', async () => {
    // Since we mocked snarkjs to throw an error, it should use the simulation
    const proofResult = await generateZKProof(
      testWalletAddress,
      testBalance,
      testThreshold,
      1, // THRESHOLD proof type
      'ethereum'
    );
    
    // Verify the structure of the proof
    expect(proofResult).toHaveProperty('proof');
    expect(proofResult).toHaveProperty('publicSignals');
    expect(proofResult).toHaveProperty('solidity');
    expect(proofResult).toHaveProperty('originalInput');
    expect(proofResult).toHaveProperty('_simulated', true);
    
    // Check that public signals contain expected elements
    expect(Array.isArray(proofResult.publicSignals)).toBe(true);
  });
  
  test('serializes and deserializes proofs correctly', () => {
    // Create a sample proof with BigInt-like values
    const sampleProof = {
      proof: {
        pi_a: ['0x123', '0x456'],
        pi_b: [['0x789', '0xabc'], ['0xdef', '0x123']],
        pi_c: ['0x456', '0x789']
      },
      publicSignals: ['123456789012345678901234567890', '9876543210987654321098765432'],
      originalInput: {
        walletAddress: testWalletAddress,
        balance: testBalance,
        threshold: testThreshold,
        proofType: 1
      }
    };
    
    // Serialize the proof
    const serialized = serializeProof(sampleProof);
    expect(typeof serialized).toBe('string');
    
    // Deserialize the proof
    const deserialized = deserializeProof(serialized);
    
    // Check that the structure is maintained
    expect(deserialized).toHaveProperty('proof.pi_a');
    expect(deserialized).toHaveProperty('proof.pi_b');
    expect(deserialized).toHaveProperty('proof.pi_c');
    expect(deserialized).toHaveProperty('publicSignals');
    expect(deserialized).toHaveProperty('originalInput');
    
    // Verify values are correctly preserved
    expect(deserialized.proof.pi_a).toEqual(sampleProof.proof.pi_a);
    expect(deserialized.publicSignals).toEqual(sampleProof.publicSignals);
    expect(deserialized.originalInput.walletAddress).toBe(testWalletAddress);
  });
  
  test('creates a complete proof package', async () => {
    // Mock implementation for encryptProof
    const mockEncryptProof = require('../proofEncryption').encryptProof;
    mockEncryptProof.mockResolvedValue({
      encryptedData: 'mockedEncryptedData',
      accessKeyHash: 'mockedAccessKeyHash',
      timestamp: Date.now(),
      metadata: { proofType: 0, walletAddress: testWalletAddress }
    });
    
    // First generate a proof
    const proof = await generateZKProof(
      testWalletAddress,
      testBalance,
      testThreshold,
      0, // STANDARD proof type
      'ethereum'
    );
    
    // Create a proof package
    const expiryTime = Date.now() + 86400000; // 1 day from now
    const proofPackage = await createProofPackage(
      proof,
      testWalletAddress,
      testBalance,
      0, // STANDARD proof type
      expiryTime
    );
    
    // Verify package structure
    expect(proofPackage).toHaveProperty('referenceId');
    expect(proofPackage).toHaveProperty('encryptedProof');
    expect(proofPackage).toHaveProperty('accessKey');
    expect(proofPackage).toHaveProperty('walletAddress', testWalletAddress);
    expect(proofPackage).toHaveProperty('amount', testBalance);
    expect(proofPackage).toHaveProperty('proofType', 0);
    expect(proofPackage).toHaveProperty('expiryTime', expiryTime);
    expect(proofPackage).toHaveProperty('createdAt');
    
    // Reference ID should be a string of the expected format
    expect(typeof proofPackage.referenceId).toBe('string');
    expect(proofPackage.referenceId.length).toBeGreaterThan(0);
  });
});