/**
 * Mock Services for Testing
 * 
 * Provides mock implementations of external services for testing
 */
import { v4 as uuidv4 } from 'uuid';

/**
 * Mock ZK Proof Service for testing
 */
export class MockZkProofService {
  /**
   * Generate a mock ZK proof
   * 
   * @param proofType Type of proof to generate
   * @param input Input data for proof
   */
  async generateProof(proofType: string, input: any): Promise<any> {
    return {
      proof: {
        pi_a: [
          "12345678901234567890123456789012345678901234567890123456789012345678901234567890",
          "12345678901234567890123456789012345678901234567890123456789012345678901234567890"
        ],
        pi_b: [
          [
            "12345678901234567890123456789012345678901234567890123456789012345678901234567890",
            "12345678901234567890123456789012345678901234567890123456789012345678901234567890"
          ],
          [
            "12345678901234567890123456789012345678901234567890123456789012345678901234567890",
            "12345678901234567890123456789012345678901234567890123456789012345678901234567890"
          ]
        ],
        pi_c: [
          "12345678901234567890123456789012345678901234567890123456789012345678901234567890",
          "12345678901234567890123456789012345678901234567890123456789012345678901234567890"
        ],
        protocol: "groth16"
      },
      publicSignals: [
        input.threshold || "1000000000000000000",
        input.balance || "2000000000000000000",
        "1"
      ]
    };
  }

  /**
   * Verify a mock ZK proof
   * 
   * @param proofType Type of proof to verify
   * @param proof Proof to verify
   * @param publicSignals Public signals for verification
   */
  async verifyProof(proofType: string, proof: any, publicSignals: any): Promise<boolean> {
    // Always return true for mock verification
    return true;
  }
}

/**
 * Mock Wallet Service for testing
 */
export class MockWalletService {
  /**
   * Create a temporary wallet
   */
  async createTemporaryWallet(): Promise<any> {
    return {
      address: `0x${uuidv4().replace(/-/g, '')}`,
      privateKey: `0x${uuidv4().replace(/-/g, '')}${uuidv4().replace(/-/g, '')}`,
    };
  }

  /**
   * Get wallet balance
   */
  async getBalance(address: string): Promise<string> {
    return "2000000000000000000"; // 2 ETH in wei
  }
}

/**
 * Mock Blockchain Service for testing
 */
export class MockBlockchainService {
  /**
   * Get current block number
   */
  async getCurrentBlockNumber(): Promise<number> {
    return 12345678;
  }

  /**
   * Submit transaction to blockchain
   */
  async submitTransaction(tx: any): Promise<string> {
    return `0x${uuidv4().replace(/-/g, '')}`;
  }
}