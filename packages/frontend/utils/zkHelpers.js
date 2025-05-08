/**
 * Utility functions for working with ZK proofs in the frontend
 */
import { startMeasurement, endMeasurement } from './performance';
import { isFeatureEnabled } from './featureFlags';
import { 
  zkSecureInputs, 
  zkProofSerializer,
  zkProofGenerator,
  deviceCapabilities
} from '@proof-of-funds/common/zk';

/**
 * Generate a ZK proof for wallet balance verification
 * @param {Object} walletData - Wallet data including address and balances
 * @param {Object} options - Options for proof generation
 * @returns {Promise<Object>} The generated proof
 */
export async function generateWalletProof(walletData, options = {}) {
  startMeasurement('generateWalletProof');
  
  try {
    // Prepare secure inputs
    const secureInputs = zkSecureInputs.prepareWalletInputs(walletData);
    
    // Determine if we should use optimized path
    const useOptimizedPath = isFeatureEnabled('ENABLE_ZK_OPTIMIZATIONS') && 
                             deviceCapabilities.canUseOptimizedProving();
    
    // Generate the proof with the appropriate circuit
    const circuitType = options.threshold ? 'thresholdProof' : 'standardProof';
    const proof = await zkProofGenerator.generate(secureInputs, {
      circuit: circuitType,
      optimized: useOptimizedPath,
      ...options
    });
    
    // Serialize the proof for transport
    const serializedProof = zkProofSerializer.serialize(proof);
    
    return {
      proof: serializedProof,
      walletAddress: walletData.address,
      timestamp: Date.now()
    };
  } finally {
    endMeasurement('generateWalletProof', { 
      walletAddress: walletData.address,
      optimized: isFeatureEnabled('ENABLE_ZK_OPTIMIZATIONS')
    });
  }
}

/**
 * Verify a ZK proof on the client side before sending to server
 * @param {Object} proofData - The proof data to verify
 * @returns {Promise<boolean>} Whether the proof is valid
 */
export async function verifyProof(proofData) {
  startMeasurement('verifyProof');
  
  try {
    // Deserialize the proof
    const proof = zkProofSerializer.deserialize(proofData.proof);
    
    // Determine if we should use optimized verification
    const useOptimizedVerification = isFeatureEnabled('ENABLE_ZK_OPTIMIZATIONS') &&
                                     deviceCapabilities.canUseOptimizedVerification();
    
    // Verify the proof locally
    const isValid = await zkProofGenerator.verify(proof, {
      optimized: useOptimizedVerification
    });
    
    return isValid;
  } finally {
    endMeasurement('verifyProof');
  }
}

/**
 * Retrieve the appropriate circuit based on wallet capacity and features
 * @param {Object} walletData - Wallet data
 * @returns {string} Circuit type to use
 */
export function determineCircuitType(walletData) {
  // Use maximum proof for high-value wallets and when available
  if (isFeatureEnabled('USE_ENHANCED_VERIFICATION') && 
      walletData.totalValue > 1000000) {
    return 'maximumProof';
  }
  
  // Use threshold proof when specific thresholds need to be proven
  if (walletData.thresholds && walletData.thresholds.length > 0) {
    return 'thresholdProof';
  }
  
  // Default to standard proof
  return 'standardProof';
}