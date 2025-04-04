/**
 * Test Vectors for ZK Proof Testing
 * 
 * This file provides pre-computed test vectors for ZK proof testing.
 * These test vectors allow for consistent, reproducible testing of
 * the ZK proof generation and verification process.
 */

// Test wallets with known details for reproducible tests
export const TEST_WALLETS = [
  {
    // This is a test wallet only - never use in production
    address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    privateKey: '0x0123456789012345678901234567890123456789012345678901234567890123',
    balance: '2000000000000000000' // 2 ETH
  },
  {
    // This is a test wallet only - never use in production
    address: '0x2E8f4f9E9982039eA2EEcbeDf9e0c16cc44Fcb0D',
    privateKey: '0x1111111111111111111111111111111111111111111111111111111111111111',
    balance: '500000000000000000' // 0.5 ETH
  },
  {
    // This is a test wallet only - never use in production
    address: '0x9A3DBE2C3Be118fc78A526F2C5182B272B192D0b',
    privateKey: '0x2222222222222222222222222222222222222222222222222222222222222222',
    balance: '10000000000000000000' // 10 ETH
  }
];

// Test data for standard proof
export const STANDARD_PROOF_VECTORS = [
  {
    // Valid standard proof - exact match of 1 ETH
    walletAddress: TEST_WALLETS[0].address,
    amount: '1000000000000000000', // 1 ETH
    expectedResult: true,
    description: 'Standard proof with exact amount match'
  },
  {
    // Wallet has sufficient balance but amount doesn't match
    walletAddress: TEST_WALLETS[0].address,
    amount: '1500000000000000000', // 1.5 ETH (wallet has 2 ETH)
    expectedResult: false,
    description: 'Standard proof with mismatched amount (valid wallet)'
  },
  {
    // Wallet doesn't have sufficient balance
    walletAddress: TEST_WALLETS[1].address, 
    amount: '1000000000000000000', // 1 ETH (wallet has only 0.5 ETH)
    expectedResult: false,
    description: 'Standard proof with insufficient balance'
  }
];

// Test data for threshold proof
export const THRESHOLD_PROOF_VECTORS = [
  {
    // Valid threshold proof - wallet has more than threshold
    walletAddress: TEST_WALLETS[0].address,
    amount: '1500000000000000000', // 1.5 ETH threshold (wallet has 2 ETH)
    actualBalance: '2000000000000000000', // 2 ETH
    expectedResult: true,
    description: 'Threshold proof with wallet having more than threshold'
  },
  {
    // Valid threshold proof - wallet has exactly threshold
    walletAddress: TEST_WALLETS[0].address,
    amount: '2000000000000000000', // 2 ETH threshold (wallet has 2 ETH)
    actualBalance: '2000000000000000000', // 2 ETH
    expectedResult: true,
    description: 'Threshold proof with wallet having exactly threshold'
  },
  {
    // Invalid threshold proof - wallet has less than threshold
    walletAddress: TEST_WALLETS[1].address,
    amount: '1000000000000000000', // 1 ETH threshold (wallet has 0.5 ETH)
    actualBalance: '500000000000000000', // 0.5 ETH
    expectedResult: false,
    description: 'Threshold proof with wallet having less than threshold'
  }
];

// Test data for maximum proof
export const MAXIMUM_PROOF_VECTORS = [
  {
    // Valid maximum proof - wallet has less than maximum
    walletAddress: TEST_WALLETS[1].address,
    amount: '1000000000000000000', // 1 ETH maximum (wallet has 0.5 ETH)
    actualBalance: '500000000000000000', // 0.5 ETH
    expectedResult: true,
    description: 'Maximum proof with wallet having less than maximum'
  },
  {
    // Valid maximum proof - wallet has exactly maximum
    walletAddress: TEST_WALLETS[0].address,
    amount: '2000000000000000000', // 2 ETH maximum (wallet has 2 ETH)
    actualBalance: '2000000000000000000', // 2 ETH
    expectedResult: true,
    description: 'Maximum proof with wallet having exactly maximum'
  },
  {
    // Invalid maximum proof - wallet has more than maximum
    walletAddress: TEST_WALLETS[2].address,
    amount: '5000000000000000000', // 5 ETH maximum (wallet has 10 ETH)
    actualBalance: '10000000000000000000', // 10 ETH
    expectedResult: false,
    description: 'Maximum proof with wallet having more than maximum'
  }
];

// Mock proof data for testing serialization/deserialization
export const MOCK_PROOF_DATA = {
  // Standard form of snarkjs proof output
  proof: {
    pi_a: ['12345', '67890', '54321'],
    pi_b: [['11111', '22222'], ['33333', '44444'], ['55555', '66666']],
    pi_c: ['77777', '88888', '99999']
  },
  publicSignals: ['10000', '20000', '30000'],
  // Metadata for test
  meta: {
    proofType: 'standard',
    walletAddress: TEST_WALLETS[0].address,
    timestamp: 1680000000000
  }
};

// Performance targets for different operations
export const PERFORMANCE_TARGETS = {
  // Desktop high-performance targets (in milliseconds)
  desktop: {
    standardProofGeneration: 5000,  // 5 seconds
    thresholdProofGeneration: 6000, // 6 seconds
    maximumProofGeneration: 6000,   // 6 seconds
    proofVerification: 1000,        // 1 second
    circuitLoading: 2000            // 2 seconds
  },
  
  // Mobile/low-power targets (in milliseconds)
  mobile: {
    standardProofGeneration: 15000,  // 15 seconds
    thresholdProofGeneration: 18000, // 18 seconds
    maximumProofGeneration: 18000,   // 18 seconds
    proofVerification: 3000,         // 3 seconds
    circuitLoading: 5000             // 5 seconds
  },
  
  // Server-side performance targets (in milliseconds)
  server: {
    standardProofGeneration: 2000,   // 2 seconds
    thresholdProofGeneration: 3000,  // 3 seconds
    maximumProofGeneration: 3000,    // 3 seconds
    proofVerification: 500,          // 0.5 seconds
    circuitLoading: 1000             // 1 second
  }
};

// Memory budget for different operations (in MB)
export const MEMORY_BUDGETS = {
  // Desktop memory budgets
  desktop: {
    standardProofGeneration: 500,  // 500 MB
    thresholdProofGeneration: 750, // 750 MB
    maximumProofGeneration: 750,   // 750 MB
    proofVerification: 250,        // 250 MB
    circuitLoading: 150            // 150 MB
  },
  
  // Mobile/low-power memory budgets
  mobile: {
    standardProofGeneration: 350,  // 350 MB
    thresholdProofGeneration: 500, // 500 MB
    maximumProofGeneration: 500,   // 500 MB
    proofVerification: 200,        // 200 MB
    circuitLoading: 100            // 100 MB
  }
};

// Device classes for testing
export const DEVICE_CLASSES = {
  // High-end device (8GB+ RAM, 4+ cores)
  high: {
    memory: 8192,        // 8 GB
    cores: 8,
    supportsWebAssembly: true,
    supportsWebCrypto: true,
    supportsWebWorkers: true,
    description: 'High-end desktop/laptop'
  },
  
  // Medium device (4-8GB RAM, 2-4 cores)
  medium: {
    memory: 4096,        // 4 GB
    cores: 4,
    supportsWebAssembly: true,
    supportsWebCrypto: true,
    supportsWebWorkers: true,
    description: 'Medium-tier laptop or high-end mobile'
  },
  
  // Low-end device (2-4GB RAM, 1-2 cores)
  low: {
    memory: 2048,        // 2 GB
    cores: 2,
    supportsWebAssembly: true,
    supportsWebCrypto: true,
    supportsWebWorkers: false,
    description: 'Low-end laptop or average mobile'
  },
  
  // Minimal device (<2GB RAM)
  minimal: {
    memory: 1024,        // 1 GB
    cores: 1,
    supportsWebAssembly: true,
    supportsWebCrypto: true,
    supportsWebWorkers: false,
    description: 'Low-end mobile device'
  },
  
  // Incompatible device (missing core features)
  incompatible: {
    memory: 2048,        // 2 GB
    cores: 2,
    supportsWebAssembly: false,  // No WebAssembly support
    supportsWebCrypto: true,
    supportsWebWorkers: false,
    description: 'Older browser or device'
  }
};

export default {
  TEST_WALLETS,
  STANDARD_PROOF_VECTORS,
  THRESHOLD_PROOF_VECTORS,
  MAXIMUM_PROOF_VECTORS,
  MOCK_PROOF_DATA,
  PERFORMANCE_TARGETS,
  MEMORY_BUDGETS,
  DEVICE_CLASSES
};