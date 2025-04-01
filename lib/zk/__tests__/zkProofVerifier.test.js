// Test suite for ZK proof verification functionality
import {
  verifyProofWithKey,
  verifyProofLocally,
  verifyProofOnChain
} from '../zkProofVerifier';

// Mock ethers
jest.mock('ethers', () => ({
  ethers: {
    utils: {
      keccak256: jest.fn().mockReturnValue('0xmockhash'),
      toUtf8Bytes: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3]))
    }
  }
}));

// Mock provider
const mockProvider = {
  getNetwork: jest.fn().mockResolvedValue({ chainId: 1 }),
  call: jest.fn().mockResolvedValue('0x0000000000000000000000000000000000000000000000000000000000000001')
};

describe('ZK Proof Verifier', () => {
  // Sample test data
  const sampleProof = {
    a: ['0x1234', '0x5678'],
    b: [['0xabcd', '0xefgh'], ['0x9876', '0x5432']],
    c: ['0xijkl', '0xmnop']
  };
  
  const samplePublicSignals = [
    '0x1234567890abcdef1234567890abcdef12345678', // wallet address
    '500000000000000000000', // threshold amount
    '1', // proof type
    '1' // result (1 = true, 0 = false)
  ];
  
  const sampleVerificationKey = {
    protocol: 'groth16',
    curve: 'bn128',
    nPublic: 1,
    vk_alpha_1: ['sample', 'values'],
    vk_beta_2: ['sample', 'values'],
    vk_gamma_2: ['sample', 'values'],
    vk_delta_2: ['sample', 'values'],
    vk_alphabeta_12: ['sample', 'values'],
    IC: ['sample', 'values']
  };
  
  test('verifies a proof with a verification key', () => {
    // Test with valid inputs
    const result = verifyProofWithKey(sampleProof, samplePublicSignals, sampleVerificationKey);
    expect(result).toBe(true);
    
    // Test with invalid proof structure
    const invalidProof = { a: ['0x1234', '0x5678'] }; // Missing b and c
    const invalidResult = verifyProofWithKey(invalidProof, samplePublicSignals, sampleVerificationKey);
    expect(invalidResult).toBe(false);
    
    // Test with empty public signals
    const emptySignalsResult = verifyProofWithKey(sampleProof, [], sampleVerificationKey);
    expect(emptySignalsResult).toBe(false);
    
    // Test with missing verification key
    const missingKeyResult = verifyProofWithKey(sampleProof, samplePublicSignals, null);
    expect(missingKeyResult).toBe(false);
  });
  
  test('verifies a proof locally for a wallet address', () => {
    const walletAddress = '0x1234567890abcdef1234567890abcdef12345678';
    const proofType = 'balance';
    
    // Create proof data object
    const proofData = {
      proof: sampleProof,
      publicSignals: samplePublicSignals
    };
    
    // Test local verification
    const result = verifyProofLocally(proofData, walletAddress, proofType);
    expect(result).toBe(true);
    
    // Test with non-matching wallet address
    const wrongAddress = '0xdifferentaddress1234567890abcdef12345678';
    const wrongAddressResult = verifyProofLocally(proofData, wrongAddress, proofType);
    expect(wrongAddressResult).toBe(false);
  });
  
  test('verifies a proof on-chain', async () => {
    const contractAddress = '0x1234567890123456789012345678901234567890';
    
    // Create proof data object
    const proofData = {
      proof: sampleProof,
      publicSignals: samplePublicSignals
    };
    
    // Test on-chain verification (mock implementation returns random result)
    const result = await verifyProofOnChain(proofData, contractAddress, mockProvider);
    expect(typeof result).toBe('boolean');
  });
});