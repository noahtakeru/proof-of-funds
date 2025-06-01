"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockBlockchainService = exports.MockWalletService = exports.MockZkProofService = void 0;
/**
 * Mock Services for Testing
 *
 * Provides mock implementations of external services for testing
 */
const uuid_1 = require("uuid");
/**
 * Mock ZK Proof Service for testing
 */
class MockZkProofService {
    /**
     * Generate a mock ZK proof
     *
     * @param proofType Type of proof to generate
     * @param input Input data for proof
     */
    async generateProof(proofType, input) {
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
    async verifyProof(proofType, proof, publicSignals) {
        // Always return true for mock verification
        return true;
    }
}
exports.MockZkProofService = MockZkProofService;
/**
 * Mock Wallet Service for testing
 */
class MockWalletService {
    /**
     * Create a temporary wallet
     */
    async createTemporaryWallet() {
        return {
            address: `0x${(0, uuid_1.v4)().replace(/-/g, '')}`,
            privateKey: `0x${(0, uuid_1.v4)().replace(/-/g, '')}${(0, uuid_1.v4)().replace(/-/g, '')}`,
        };
    }
    /**
     * Get wallet balance
     */
    async getBalance(address) {
        return "2000000000000000000"; // 2 ETH in wei
    }
}
exports.MockWalletService = MockWalletService;
/**
 * Mock Blockchain Service for testing
 */
class MockBlockchainService {
    /**
     * Get current block number
     */
    async getCurrentBlockNumber() {
        return 12345678;
    }
    /**
     * Submit transaction to blockchain
     */
    async submitTransaction(tx) {
        return `0x${(0, uuid_1.v4)().replace(/-/g, '')}`;
    }
}
exports.MockBlockchainService = MockBlockchainService;
