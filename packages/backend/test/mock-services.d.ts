/**
 * Mock ZK Proof Service for testing
 */
export declare class MockZkProofService {
    /**
     * Generate a mock ZK proof
     *
     * @param proofType Type of proof to generate
     * @param input Input data for proof
     */
    generateProof(proofType: string, input: any): Promise<any>;
    /**
     * Verify a mock ZK proof
     *
     * @param proofType Type of proof to verify
     * @param proof Proof to verify
     * @param publicSignals Public signals for verification
     */
    verifyProof(proofType: string, proof: any, publicSignals: any): Promise<boolean>;
}
/**
 * Mock Wallet Service for testing
 */
export declare class MockWalletService {
    /**
     * Create a temporary wallet
     */
    createTemporaryWallet(): Promise<any>;
    /**
     * Get wallet balance
     */
    getBalance(address: string): Promise<string>;
}
/**
 * Mock Blockchain Service for testing
 */
export declare class MockBlockchainService {
    /**
     * Get current block number
     */
    getCurrentBlockNumber(): Promise<number>;
    /**
     * Submit transaction to blockchain
     */
    submitTransaction(tx: any): Promise<string>;
}
