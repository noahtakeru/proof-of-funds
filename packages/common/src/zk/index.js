/**
 * ZK Module
 * 
 * Exports Zero-Knowledge proof functionality by re-exporting from zk-core
 */

// Import all ZK core functions and types from zk-core
import {
  ZK_PROOF_TYPES,
  generateZKProof as generateZKProofCore,
  verifyZKProof,
  serializeZKProof,
  deserializeZKProof,
  generateZKProofHash,
  getVerificationKey,
  stringifyBigInts,
  parseBigInts,
  SNARK_FIELD_SIZE,
  getErrorLogger
} from '../zk-core/index.js';

// Create a frontend-friendly wrapper for generateZKProof that adapts the interface
export async function generateZKProof(inputObj, providedProofType, options = {}) {
  const logger = getErrorLogger();
  logger.debug('ZK Proof Generation - Inputs', {
    inputType: typeof inputObj === 'object' ? 'Object' : typeof inputObj,
    providedProofType: providedProofType,
    hasOptions: !!options
  });

  try {
    // Handle case where all params are in a single object (frontend usage)
    if (typeof inputObj === 'object' && inputObj !== null && inputObj.proofType !== undefined && providedProofType === undefined) {
      // Extract proofType from the input object
      const { proofType, ...restInputs } = inputObj;
      
      // For numeric proofType, convert to string label
      let proofTypeStr = proofType;
      if (typeof proofType === 'number') {
        // Map numeric type to string type
        if (proofType === ZK_PROOF_TYPES.STANDARD) proofTypeStr = 'standard';
        else if (proofType === ZK_PROOF_TYPES.THRESHOLD) proofTypeStr = 'threshold';
        else if (proofType === ZK_PROOF_TYPES.MAXIMUM) proofTypeStr = 'maximum';
      }
      
      logger.debug('ZK Proof Generation - Parameter extraction', {
        extractedProofType: proofTypeStr,
        inputsFormat: Object.keys(restInputs).join(',')
      });
      
      // Call the core implementation
      return await generateZKProofCore(restInputs, proofTypeStr, options);
    }
    
    // Otherwise, pass through to the core implementation
    return await generateZKProofCore(inputObj, providedProofType, options);
  } catch (error) {
    // Log the error using our safe logger
    logger.logError(error, {
      context: 'zk/index.js:generateZKProof',
      parameters: {
        inputType: typeof inputObj,
        proofType: providedProofType
      }
    });
    
    // Re-throw the error for handling by caller
    throw error;
  }
}

// Re-export all other ZK functions and types
export {
  ZK_PROOF_TYPES,
  verifyZKProof,
  serializeZKProof,
  deserializeZKProof,
  generateZKProofHash,
  getVerificationKey,
  stringifyBigInts,
  parseBigInts,
  SNARK_FIELD_SIZE
};

// Export default object for compatibility with both named and default imports
const zkApi = {
  ZK_PROOF_TYPES,
  generateZKProof,
  verifyZKProof,
  serializeZKProof,
  deserializeZKProof,
  generateZKProofHash,
  getVerificationKey,
  stringifyBigInts,
  parseBigInts,
  SNARK_FIELD_SIZE
};

export default zkApi;