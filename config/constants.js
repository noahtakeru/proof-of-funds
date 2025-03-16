export const CONTRACT_ADDRESS = '0xD6bd1eFCE3A2c4737856724f96F39037a3564890'; // Testing wallet address
export const ZK_VERIFIER_ADDRESS = '0x0000000000000000000000000000000000000456'; // Placeholder address for testing
export const POLYGON_AMOY_CHAIN_ID = 80002; // Polygon Amoy testnet chain ID

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
export const EXPIRY_OPTIONS = {
    ONE_DAY: 86400,
    SEVEN_DAYS: 604800,
    THIRTY_DAYS: 2592000,
    NINETY_DAYS: 7776000
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
        template: 'I confirm that I have at least {amount} MATIC in my wallet for verification purposes on {date}.',
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
            { "internalType": "bytes32", "name": "_proofHash", "type": "bytes32" },
            { "internalType": "uint256", "name": "_expiryTime", "type": "uint256" },
            { "internalType": "enum ProofOfFunds.ProofType", "name": "_proofType", "type": "uint8" },
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
        "name": "verifyProof",
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
        "inputs": [{ "internalType": "string", "name": "_reason", "type": "string" }],
        "name": "revokeProof",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "_user", "type": "address" },
            { "internalType": "string", "name": "_message", "type": "string" }
        ],
        "name": "addSignatureMessage",
        "outputs": [],
        "stateMutability": "nonpayable",
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
    },
    {
        "inputs": [{ "internalType": "address", "name": "_user", "type": "address" }],
        "name": "isProofValid",
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