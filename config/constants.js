/**
 * Application Constants
 * 
 * This module centralizes all configuration values and constants used throughout the
 * Proof of Funds application. Centralizing these values makes it easier to maintain
 * the application and deploy to different environments (development, testing, production).
 * 
 * Key Categories:
 * - Contract Addresses: Blockchain contract addresses for different networks
 * - Chain IDs: Blockchain network identifiers
 * - Enumeration Values: Named constants for proof types and other categorizations
 * - Expiry Options: Duration settings for proof validity periods
 * - Signature Messages: Template strings for blockchain signatures
 * - ABIs: Smart contract interface definitions (Application Binary Interfaces)
 * 
 * Usage:
 * Import specific constants or groups of constants where needed:
 * import { PROOF_OF_FUNDS_ADDRESS, PROOF_TYPES } from '../config/constants';
 * 
 * Note: For deployment to production environments, you should replace the 
 * placeholder addresses with actual deployed contract addresses.
 */

// Polygon Amoy Testnet Contract Address
export const PROOF_OF_FUNDS_ADDRESS = "0xD6bd1eFCE3A2c4737856724f96F39037a3564890";

// Test-only address for local development
export const TEST_CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

// Polygon Amoy Testnet Chain ID
export const POLYGON_AMOY_CHAIN_ID = 80002;

/**
 * Proof types supported by the contracts
 * These values correspond to enum values in the smart contracts
 * 
 * STANDARD: Basic proof of having at least X funds
 * THRESHOLD: Proof of having funds within a specific range
 * MAXIMUM: Proof of having at most X funds
 * ZK: Zero-knowledge proof that maintains additional privacy
 */
export const PROOF_TYPES = {
    STANDARD: 0,
    THRESHOLD: 1,
    MAXIMUM: 2,
    ZK: 3
};

/**
 * Expiry options for proofs
 * Keys represent the option ID, values represent human-readable labels
 */
export const EXPIRY_OPTIONS = {
    one_day: "1 Day",
    one_week: "1 Week",
    one_month: "1 Month",
    three_months: "3 Months",
    six_months: "6 Months",
    one_year: "1 Year"
};

/**
 * Signature message templates for different verification scenarios
 * These messages are shown to users when signing with their wallets
 */
export const SIGNATURE_MESSAGES = {
    STANDARD: "I confirm that I have at least {amount} in my wallet for verification purposes.",
    THRESHOLD: "I confirm that I have at least {amount} in my wallet for verification purposes.",
    MAXIMUM: "I confirm that I have at most {amount} in my wallet for verification purposes.",
    ZK: "I am verifying my funds using a zero-knowledge proof. No specific amount will be shared.",
};

/**
 * ABI (Application Binary Interface) for the ProofOfFunds smart contract
 * Defines the functions, events, and their parameters for interacting with the contract
 */
export const PROOF_OF_FUNDS_ABI = [
    {
        "inputs": [],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "uint256",
                "name": "proofId",
                "type": "uint256"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "user",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "enum ProofOfFunds.ProofType",
                "name": "proofType",
                "type": "uint8"
            },
            {
                "indexed": false,
                "internalType": "bytes32",
                "name": "proofHash",
                "type": "bytes32"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "expiryTime",
                "type": "uint256"
            }
        ],
        "name": "ProofSubmitted",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "uint256",
                "name": "proofId",
                "type": "uint256"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "user",
                "type": "address"
            }
        ],
        "name": "ProofRevoked",
        "type": "event"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_proofId",
                "type": "uint256"
            }
        ],
        "name": "getProof",
        "outputs": [
            {
                "internalType": "enum ProofOfFunds.ProofType",
                "name": "",
                "type": "uint8"
            },
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            },
            {
                "internalType": "bytes32",
                "name": "",
                "type": "bytes32"
            },
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            },
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            },
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_user",
                "type": "address"
            }
        ],
        "name": "getUserProofs",
        "outputs": [
            {
                "internalType": "uint256[]",
                "name": "",
                "type": "uint256[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_proofId",
                "type": "uint256"
            }
        ],
        "name": "isProofValid",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_proofId",
                "type": "uint256"
            }
        ],
        "name": "revokeProof",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "enum ProofOfFunds.ProofType",
                "name": "_proofType",
                "type": "uint8"
            },
            {
                "internalType": "bytes32",
                "name": "_proofHash",
                "type": "bytes32"
            },
            {
                "internalType": "uint256",
                "name": "_expiryTime",
                "type": "uint256"
            },
            {
                "internalType": "string",
                "name": "_signatureMessage",
                "type": "string"
            }
        ],
        "name": "submitProof",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

/**
 * Array of supported blockchain networks
 * Each entry contains information about the network name and chain ID
 */
export const SUPPORTED_CHAINS = [
    {
        id: 'ethereum',
        name: 'Ethereum',
        chainId: 1
    },
    {
        id: 'polygon',
        name: 'Polygon',
        chainId: 137
    },
    {
        id: 'polygon_amoy',
        name: 'Polygon Amoy',
        chainId: POLYGON_AMOY_CHAIN_ID
    },
    {
        id: 'bnb',
        name: 'BNB Chain',
        chainId: 56
    },
    {
        id: 'solana',
        name: 'Solana',
        chainId: null
    }
];

// Use the address from the deployment script (see deployments directory)
// This was previously incorrectly set to a wallet address
// The contract should be deployed on Polygon Amoy testnet (ChainID: 80002)
// IMPORTANT: This is a placeholder address - replace with your actual deployed contract address
export const CONTRACT_ADDRESS = '0xD6bd1eFCE3A2c4737856724f96F39037a3564890';
export const ZK_VERIFIER_ADDRESS = '0x0000000000000000000000000000000000000456'; // Placeholder address for testing

// Polygon Amoy Testnet RPC URL
export const POLYGON_AMOY_RPC_URL = 'https://polygon-amoy-rpc.publicnode.com';

// Add Hardhat local network configuration
export const HARDHAT_CHAIN_ID = 31337; // Hardhat local network chain ID

// ZK Proof types enum values
export const ZK_PROOF_TYPES = {
    STANDARD: 0,
    THRESHOLD: 1,
    MAXIMUM: 2
};

// Legacy expiry options - will be removed in future
export const EXPIRY_TIME_OPTIONS = {
    ONE_DAY: 86400,
    ONE_WEEK: 604800,
    ONE_MONTH: 2592000,
    THREE_MONTHS: 7776000,
    SIX_MONTHS: 15552000,
    ONE_YEAR: 31536000
};

// Signature message templates
export const SIGNATURE_MESSAGE_TEMPLATES = [
    {
        id: 'fund_verification',
        name: 'Fund Verification',
        template: 'I confirm that I have at least {amount} {token_symbol} in my wallet for verification purposes. This verification was created on {date}.',
    },
    {
        id: 'loan_application',
        name: 'Loan Application',
        template: 'I confirm that I have the required funds for loan application #{reference_number} with {institution_name}.',
    },
    {
        id: 'investment_qualification',
        name: 'Investment Qualification',
        template: 'I confirm that I meet the financial requirements to participate in the {project_name} investment opportunity.',
    },
    {
        id: 'membership_verification',
        name: 'Membership Verification',
        template: 'I confirm that I meet the financial requirements for membership in {organization_name}.',
    },
];

export const CONTRACT_ABI = [
    {
        "inputs": [
            { "internalType": "enum ProofOfFunds.ProofType", "name": "_proofType", "type": "uint8" },
            { "internalType": "bytes32", "name": "_proofHash", "type": "bytes32" },
            { "internalType": "uint256", "name": "_expiryTime", "type": "uint256" },
            { "internalType": "uint256", "name": "_thresholdAmount", "type": "uint256" },
            { "internalType": "string", "name": "_signatureMessage", "type": "string" },
            { "internalType": "bytes", "name": "_signature", "type": "bytes" }
        ],
        "name": "submitProof",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "_user", "type": "address" }],
        "name": "getProof",
        "outputs": [
            { "internalType": "address", "name": "user", "type": "address" },
            { "internalType": "uint256", "name": "timestamp", "type": "uint256" },
            { "internalType": "uint256", "name": "expiryTime", "type": "uint256" },
            { "internalType": "bytes32", "name": "proofHash", "type": "bytes32" },
            { "internalType": "enum ProofOfFunds.ProofType", "name": "proofType", "type": "uint8" },
            { "internalType": "uint256", "name": "thresholdAmount", "type": "uint256" },
            { "internalType": "bool", "name": "isRevoked", "type": "bool" },
            { "internalType": "string", "name": "signatureMessage", "type": "string" },
            { "internalType": "bytes", "name": "signature", "type": "bytes" }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "_user", "type": "address" },
            { "internalType": "uint256", "name": "_claimedAmount", "type": "uint256" }
        ],
        "name": "verifyStandardProof",
        "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "_user", "type": "address" },
            { "internalType": "uint256", "name": "_minimumAmount", "type": "uint256" }
        ],
        "name": "verifyThresholdProof",
        "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "_user", "type": "address" },
            { "internalType": "uint256", "name": "_maximumAmount", "type": "uint256" }
        ],
        "name": "verifyMaximumProof",
        "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "_user", "type": "address" },
            { "internalType": "uint256", "name": "_amount", "type": "uint256" },
            { "internalType": "enum ProofOfFunds.ProofType", "name": "_proofType", "type": "uint8" }
        ],
        "name": "generateProofHash",
        "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }],
        "stateMutability": "pure",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "string", "name": "_reason", "type": "string" }],
        "name": "revokeProof",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "_user", "type": "address" }],
        "name": "isProofValid",
        "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "_user", "type": "address" },
            { "internalType": "string", "name": "_message", "type": "string" }
        ],
        "name": "verifySignature",
        "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
        "stateMutability": "view",
        "type": "function"
    }
];

export const ZK_VERIFIER_ABI = [
    {
        "inputs": [
            { "internalType": "bytes", "name": "_proof", "type": "bytes" },
            { "internalType": "bytes", "name": "_publicSignals", "type": "bytes" },
            { "internalType": "uint256", "name": "_expiryTime", "type": "uint256" },
            { "internalType": "enum ZKVerifier.ZKProofType", "name": "_proofType", "type": "uint8" },
            { "internalType": "string", "name": "_signatureMessage", "type": "string" },
            { "internalType": "bytes", "name": "_signature", "type": "bytes" }
        ],
        "name": "submitZKProof",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "_user", "type": "address" }],
        "name": "getZKProof",
        "outputs": [
            { "internalType": "address", "name": "user", "type": "address" },
            { "internalType": "uint256", "name": "timestamp", "type": "uint256" },
            { "internalType": "uint256", "name": "expiryTime", "type": "uint256" },
            { "internalType": "bytes", "name": "publicSignals", "type": "bytes" },
            { "internalType": "bytes", "name": "proof", "type": "bytes" },
            { "internalType": "enum ZKVerifier.ZKProofType", "name": "proofType", "type": "uint8" },
            { "internalType": "bool", "name": "isRevoked", "type": "bool" },
            { "internalType": "string", "name": "signatureMessage", "type": "string" },
            { "internalType": "bytes", "name": "signature", "type": "bytes" }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "_user", "type": "address" }],
        "name": "verifyZKProof",
        "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "string", "name": "_reason", "type": "string" }],
        "name": "revokeZKProof",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "string", "name": "_message", "type": "string" },
            { "internalType": "bytes", "name": "_signature", "type": "bytes" }
        ],
        "name": "addZKSignatureMessage",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "_user", "type": "address" },
            { "internalType": "string", "name": "_message", "type": "string" }
        ],
        "name": "verifyZKSignature",
        "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
        "stateMutability": "view",
        "type": "function"
    }
];

// We now use the modern implementation of signature templates defined at the top of this file
// export const SIGNATURE_MESSAGE_TEMPLATES = [
//    "Loan application for {institution} - Reference #{reference}",
//    "Investment verification for {project} - Amount: {amount}",
//    "Membership qualification for {organization} - {date}",
//    "Regulatory compliance verification - {regulation}",
//    "Custom verification"
// ]; 

// Price API endpoints
export const PRICE_API = {
    COINGECKO: 'https://api.coingecko.com/api/v3/simple/price',
    COINMARKETCAP: 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest'
};

// Multi-chain proof data structure version
export const PROOF_DATA_VERSION = '1.0.0'; 