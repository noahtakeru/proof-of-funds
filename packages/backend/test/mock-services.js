/**
 * Mock Services for Testing
 * 
 * This module provides mock implementations of external services
 * to facilitate testing without external dependencies.
 */

/**
 * Mock ZK Proof Service
 * 
 * This mock service simulates the generation and verification
 * of zero-knowledge proofs for testing.
 */
class MockZkProofService {
  /**
   * Generate a mock zero-knowledge proof
   * @param {string} proofType Type of proof to generate
   * @param {Object} input Input for the proof
   * @returns {Promise<Object>} Generated proof and public signals
   */
  async generateProof(proofType, input) {
    // Generate a deterministic but realistic-looking mock proof
    return {
      proof: {
        a: [
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321'
        ],
        b: [
          [
            '0x2345678901abcdef2345678901abcdef2345678901abcdef2345678901abcdef',
            '0x3456789012abcdef3456789012abcdef3456789012abcdef3456789012abcdef'
          ],
          [
            '0x4567890123abcdef4567890123abcdef4567890123abcdef4567890123abcdef',
            '0x5678901234abcdef5678901234abcdef5678901234abcdef5678901234abcdef'
          ]
        ],
        c: [
          '0x6789012345abcdef6789012345abcdef6789012345abcdef6789012345abcdef',
          '0x7890123456abcdef7890123456abcdef7890123456abcdef7890123456abcdef'
        ]
      },
      publicSignals: [
        '1', // Valid signal (1 = true)
        `0x${input.userAddress.slice(2)}` // User address as public signal
      ]
    };
  }
  
  /**
   * Verify a mock zero-knowledge proof
   * @param {string} proofType Type of proof to verify
   * @param {Object} proof Proof to verify
   * @param {Array} publicSignals Public signals from proof generation
   * @returns {Promise<boolean>} True if proof is valid
   */
  async verifyProof(proofType, proof, publicSignals) {
    // In mock service, we assume the proof is valid if the first public signal is "1"
    return publicSignals[0] === '1';
  }
}

/**
 * Mock Wallet Service
 * 
 * This mock service simulates wallet operations for testing.
 */
class MockWalletService {
  /**
   * Generate a random wallet
   * @returns {Promise<Object>} Generated wallet
   */
  async generateWallet() {
    const id = Math.random().toString(36).substring(2, 15);
    return {
      address: `0x${id.padEnd(40, '0')}`,
      privateKey: `0x${id.padEnd(64, '1')}`
    };
  }
  
  /**
   * Verify a wallet signature
   * @param {string} message Message that was signed
   * @param {string} signature Signature to verify
   * @param {string} address Expected address
   * @returns {Promise<boolean>} True if signature is valid
   */
  async verifySignature(message, signature, address) {
    // In mock service, we assume the signature is valid if it's not empty
    return Boolean(signature && signature.length > 0);
  }
}

/**
 * Mock Encryption Service
 * 
 * This mock service simulates encryption operations for testing.
 */
class MockEncryptionService {
  constructor() {
    this.storedKeys = {};
    this.storedSecrets = {};
  }
  
  /**
   * Generate an encryption key
   * @returns {Promise<Buffer>} Generated key
   */
  async generateKey() {
    return Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');
  }
  
  /**
   * Encrypt data
   * @param {any} data Data to encrypt
   * @param {Buffer} key Encryption key
   * @returns {Promise<string>} Encrypted data
   */
  async encrypt(data, key) {
    // Convert data to string for mock encryption
    const dataString = typeof data === 'object' ? JSON.stringify(data) : String(data);
    
    // Simple mock encryption (Base64 encoding + key ID)
    return `MOCK_ENCRYPTED:${Buffer.from(dataString).toString('base64')}`;
  }
  
  /**
   * Decrypt data
   * @param {string} encryptedData Encrypted data
   * @param {Buffer} key Decryption key
   * @returns {Promise<any>} Decrypted data
   */
  async decrypt(encryptedData, key) {
    // Only handle mock-encrypted data
    if (!encryptedData.startsWith('MOCK_ENCRYPTED:')) {
      throw new Error('Invalid encrypted data format');
    }
    
    // Extract base64 data
    const base64Data = encryptedData.replace('MOCK_ENCRYPTED:', '');
    
    // Decode and parse
    const decoded = Buffer.from(base64Data, 'base64').toString('utf8');
    
    try {
      return JSON.parse(decoded);
    } catch (e) {
      return decoded;
    }
  }
  
  /**
   * Store a key in the mock secret manager
   * @param {string} keyId Key ID
   * @param {Buffer} key Key to store
   */
  async storeKey(keyId, key) {
    this.storedKeys[keyId] = key;
  }
  
  /**
   * Retrieve a key from the mock secret manager
   * @param {string} keyId Key ID
   * @returns {Promise<Buffer>} Retrieved key
   */
  async getKey(keyId) {
    const key = this.storedKeys[keyId];
    
    if (!key) {
      throw new Error(`Key ${keyId} not found`);
    }
    
    return key;
  }
}

// Export mock services
module.exports = {
  MockZkProofService,
  MockWalletService,
  MockEncryptionService
};