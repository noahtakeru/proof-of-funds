/**
 * Arbitr Platform Constants
 * 
 * This file centralizes all constant values and configuration parameters used
 * throughout the Arbitr proof of funds application. It includes:
 * 
 * - Contract addresses and chain identifiers
 * - Enumeration values for proof types
 * - Time-related constants like expiry options
 * - Message templates for blockchain signatures
 * - Smart contract ABIs for blockchain interaction
 * 
 * Centralizing these values makes it easier to maintain configuration across
 * the application and simplifies the process of deploying to different environments
 * (testnet, mainnet, etc.).
 * 
 * When using values from this file, import only the specific constants needed
 * rather than the entire module to improve code maintainability.
 */

// Contract addresses - these should be set via environment variables in production
// Fallback values from deployment files for development/testing only
export const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0x19180Cc2d399257F2ea6212A2985eBEcA9EC9970';
export const ZK_VERIFIER_ADDRESS = process.env.ZK_VERIFIER_ADDRESS || '0x9E98DdFD14e47295a9e900a3dF332EcF6a9587B5';

// Export the dynamic contract registry functions (when needed for advanced usage)
export { 
  getContractAddress, 
  getCurrentContractAddress, 
  CONTRACT_TYPES, 
  CHAIN_IDS 
} from './contractRegistry.js';
export const POLYGON_AMOY_CHAIN_ID = 80002; // Polygon Amoy testnet chain ID

// Polygon Amoy Testnet RPC URL
export const POLYGON_AMOY_RPC_URL = 'https://polygon-amoy-rpc.publicnode.com';

// Add Hardhat local network configuration
export const HARDHAT_CHAIN_ID = 31337; // Hardhat local network chain ID

// Proof types enum values
export const PROOF_TYPES = {
    STANDARD: 0,
    THRESHOLD: 1,
    MAXIMUM: 2,
    ZERO_KNOWLEDGE: 3
};

// ZK Proof types enum values
export const ZK_PROOF_TYPES = {
    STANDARD: 0,
    THRESHOLD: 1,
    MAXIMUM: 2
};

// Expiry options in seconds
export const EXPIRY_OPTIONS = [
    { id: 'one_day', label: '1 Day', seconds: 86400 },
    { id: 'seven_days', label: '7 Days', seconds: 604800 },
    { id: 'thirty_days', label: '30 Days', seconds: 2592000 },
    { id: 'ninety_days', label: '90 Days', seconds: 7776000 }
];

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
        'inputs': [
            { 'internalType': 'enum ProofOfFunds.ProofType', 'name': '_proofType', 'type': 'uint8' },
            { 'internalType': 'bytes32', 'name': '_proofHash', 'type': 'bytes32' },
            { 'internalType': 'uint256', 'name': '_expiryTime', 'type': 'uint256' },
            { 'internalType': 'uint256', 'name': '_thresholdAmount', 'type': 'uint256' },
            { 'internalType': 'string', 'name': '_signatureMessage', 'type': 'string' },
            { 'internalType': 'bytes', 'name': '_signature', 'type': 'bytes' }
        ],
        'name': 'submitProof',
        'outputs': [],
        'stateMutability': 'nonpayable',
        'type': 'function'
    },
    {
        'inputs': [{ 'internalType': 'address', 'name': '_user', 'type': 'address' }],
        'name': 'getProof',
        'outputs': [
            { 'internalType': 'address', 'name': 'user', 'type': 'address' },
            { 'internalType': 'uint256', 'name': 'timestamp', 'type': 'uint256' },
            { 'internalType': 'uint256', 'name': 'expiryTime', 'type': 'uint256' },
            { 'internalType': 'bytes32', 'name': 'proofHash', 'type': 'bytes32' },
            { 'internalType': 'enum ProofOfFunds.ProofType', 'name': 'proofType', 'type': 'uint8' },
            { 'internalType': 'uint256', 'name': 'thresholdAmount', 'type': 'uint256' },
            { 'internalType': 'bool', 'name': 'isRevoked', 'type': 'bool' },
            { 'internalType': 'string', 'name': 'signatureMessage', 'type': 'string' },
            { 'internalType': 'bytes', 'name': 'signature', 'type': 'bytes' }
        ],
        'stateMutability': 'view',
        'type': 'function'
    },
    {
        'inputs': [
            { 'internalType': 'address', 'name': '_user', 'type': 'address' },
            { 'internalType': 'uint256', 'name': '_claimedAmount', 'type': 'uint256' }
        ],
        'name': 'verifyStandardProof',
        'outputs': [{ 'internalType': 'bool', 'name': '', 'type': 'bool' }],
        'stateMutability': 'view',
        'type': 'function'
    },
    {
        'inputs': [
            { 'internalType': 'address', 'name': '_user', 'type': 'address' },
            { 'internalType': 'uint256', 'name': '_minimumAmount', 'type': 'uint256' }
        ],
        'name': 'verifyThresholdProof',
        'outputs': [{ 'internalType': 'bool', 'name': '', 'type': 'bool' }],
        'stateMutability': 'view',
        'type': 'function'
    },
    {
        'inputs': [
            { 'internalType': 'address', 'name': '_user', 'type': 'address' },
            { 'internalType': 'uint256', 'name': '_maximumAmount', 'type': 'uint256' }
        ],
        'name': 'verifyMaximumProof',
        'outputs': [{ 'internalType': 'bool', 'name': '', 'type': 'bool' }],
        'stateMutability': 'view',
        'type': 'function'
    },
    {
        'inputs': [
            { 'internalType': 'address', 'name': '_user', 'type': 'address' },
            { 'internalType': 'uint256', 'name': '_amount', 'type': 'uint256' },
            { 'internalType': 'enum ProofOfFunds.ProofType', 'name': '_proofType', 'type': 'uint8' }
        ],
        'name': 'generateProofHash',
        'outputs': [{ 'internalType': 'bytes32', 'name': '', 'type': 'bytes32' }],
        'stateMutability': 'pure',
        'type': 'function'
    },
    {
        'inputs': [{ 'internalType': 'string', 'name': '_reason', 'type': 'string' }],
        'name': 'revokeProof',
        'outputs': [],
        'stateMutability': 'nonpayable',
        'type': 'function'
    },
    {
        'inputs': [{ 'internalType': 'address', 'name': '_user', 'type': 'address' }],
        'name': 'isProofValid',
        'outputs': [{ 'internalType': 'bool', 'name': '', 'type': 'bool' }],
        'stateMutability': 'view',
        'type': 'function'
    },
    {
        'inputs': [
            { 'internalType': 'address', 'name': '_user', 'type': 'address' },
            { 'internalType': 'string', 'name': '_message', 'type': 'string' }
        ],
        'name': 'verifySignature',
        'outputs': [{ 'internalType': 'bool', 'name': '', 'type': 'bool' }],
        'stateMutability': 'view',
        'type': 'function'
    }
];

export const ZK_VERIFIER_ABI = [
    {
        'inputs': [
            { 'internalType': 'bytes', 'name': '_proof', 'type': 'bytes' },
            { 'internalType': 'bytes', 'name': '_publicSignals', 'type': 'bytes' },
            { 'internalType': 'uint256', 'name': '_expiryTime', 'type': 'uint256' },
            { 'internalType': 'enum ZKVerifier.ZKProofType', 'name': '_proofType', 'type': 'uint8' },
            { 'internalType': 'string', 'name': '_signatureMessage', 'type': 'string' },
            { 'internalType': 'bytes', 'name': '_signature', 'type': 'bytes' }
        ],
        'name': 'submitZKProof',
        'outputs': [],
        'stateMutability': 'nonpayable',
        'type': 'function'
    },
    {
        'inputs': [{ 'internalType': 'address', 'name': '_user', 'type': 'address' }],
        'name': 'getZKProof',
        'outputs': [
            { 'internalType': 'address', 'name': 'user', 'type': 'address' },
            { 'internalType': 'uint256', 'name': 'timestamp', 'type': 'uint256' },
            { 'internalType': 'uint256', 'name': 'expiryTime', 'type': 'uint256' },
            { 'internalType': 'bytes', 'name': 'publicSignals', 'type': 'bytes' },
            { 'internalType': 'bytes', 'name': 'proof', 'type': 'bytes' },
            { 'internalType': 'enum ZKVerifier.ZKProofType', 'name': 'proofType', 'type': 'uint8' },
            { 'internalType': 'bool', 'name': 'isRevoked', 'type': 'bool' },
            { 'internalType': 'string', 'name': 'signatureMessage', 'type': 'string' },
            { 'internalType': 'bytes', 'name': 'signature', 'type': 'bytes' }
        ],
        'stateMutability': 'view',
        'type': 'function'
    },
    {
        'inputs': [{ 'internalType': 'address', 'name': '_user', 'type': 'address' }],
        'name': 'verifyZKProof',
        'outputs': [{ 'internalType': 'bool', 'name': '', 'type': 'bool' }],
        'stateMutability': 'view',
        'type': 'function'
    },
    {
        'inputs': [{ 'internalType': 'string', 'name': '_reason', 'type': 'string' }],
        'name': 'revokeZKProof',
        'outputs': [],
        'stateMutability': 'nonpayable',
        'type': 'function'
    },
    {
        'inputs': [
            { 'internalType': 'string', 'name': '_message', 'type': 'string' },
            { 'internalType': 'bytes', 'name': '_signature', 'type': 'bytes' }
        ],
        'name': 'addZKSignatureMessage',
        'outputs': [],
        'stateMutability': 'nonpayable',
        'type': 'function'
    },
    {
        'inputs': [
            { 'internalType': 'address', 'name': '_user', 'type': 'address' },
            { 'internalType': 'string', 'name': '_message', 'type': 'string' }
        ],
        'name': 'verifyZKSignature',
        'outputs': [{ 'internalType': 'bool', 'name': '', 'type': 'bool' }],
        'stateMutability': 'view',
        'type': 'function'
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

// Supported blockchain networks
export const SUPPORTED_CHAINS = {
    ETHEREUM: {
        name: 'Ethereum',
        chainId: 1,
        testnetChainId: 5, // Goerli
        nativeSymbol: 'ETH',
        decimals: 18,
        blockExplorer: 'https://etherscan.io',
        testnetBlockExplorer: 'https://goerli.etherscan.io',
        rpcUrl: 'https://mainnet.infura.io/v3/your-infura-key',
        testnetRpcUrl: 'https://goerli.infura.io/v3/your-infura-key'
    },
    POLYGON: {
        name: 'Polygon',
        chainId: 137,
        testnetChainId: 80001, // Mumbai
        nativeSymbol: 'MATIC',
        decimals: 18,
        blockExplorer: 'https://polygonscan.com',
        testnetBlockExplorer: 'https://mumbai.polygonscan.com',
        rpcUrl: 'https://polygon-rpc.com',
        testnetRpcUrl: 'https://rpc-mumbai.maticvigil.com'
    },
    BINANCE: {
        name: 'BNB Chain',
        chainId: 56,
        testnetChainId: 97,
        nativeSymbol: 'BNB',
        decimals: 18,
        blockExplorer: 'https://bscscan.com',
        testnetBlockExplorer: 'https://testnet.bscscan.com',
        rpcUrl: 'https://bsc-dataseed.binance.org',
        testnetRpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545'
    },
    SOLANA: {
        name: 'Solana',
        clusterId: 'mainnet-beta',
        testnetClusterId: 'devnet',
        nativeSymbol: 'SOL',
        decimals: 9,
        blockExplorer: 'https://explorer.solana.com',
        testnetBlockExplorer: 'https://explorer.solana.com/?cluster=devnet',
        rpcUrl: 'https://api.mainnet-beta.solana.com',
        testnetRpcUrl: 'https://api.devnet.solana.com'
    },
    HARDHAT: {
        name: 'Hardhat Local',
        chainId: 31337,
        testnetChainId: 31337,
        nativeSymbol: 'ETH',
        decimals: 18,
        blockExplorer: '',
        testnetBlockExplorer: '',
        rpcUrl: 'http://127.0.0.1:8545/',
        testnetRpcUrl: 'http://127.0.0.1:8545/'
    }
};

// Price API endpoints
export const PRICE_API = {
    COINGECKO: 'https://api.coingecko.com/api/v3/simple/price',
    COINMARKETCAP: 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest'
};

// Multi-chain proof data structure version
export const PROOF_DATA_VERSION = '1.0.0'; 

// Polygon Mainnet contract address
export const POLYGON_MAINNET_CONTRACT_ADDRESS = '0xD6bd1eFCE3A2c4737856724f96F39037a3564891'; // Placeholder address for mainnet, replace with actual address
export const POLYGON_MAINNET_CHAIN_ID = 137; // Polygon Mainnet chain ID
export const POLYGON_MAINNET_RPC_URL = 'https://polygon-rpc.com';