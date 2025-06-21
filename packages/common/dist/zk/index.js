/**
 * ZK Module
 *
 * Exports Zero-Knowledge proof functionality by re-exporting from zk-core
 */
// Import all ZK core functions and types from zk-core
import { generateZKProofCore, verifyZKProof, serializeZKProof, deserializeZKProof, generateZKProofHash, getVerificationKey, stringifyBigInts, parseBigInts, SNARK_FIELD_SIZE, getErrorLogger } from '../zk-core/index.js';
// Import ZK_PROOF_TYPES from config to avoid duplication
import { ZK_PROOF_TYPES } from '../config/constants.js';
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
            let proofTypeStr;
            // Debug logging to understand the proofType
            logger.debug('ZK Module - proofType details (before conversion)', {
                proofTypeValue: proofType,
                proofTypeType: typeof proofType,
                isProofTypeNumber: typeof proofType === 'number',
                isProofTypeString: typeof proofType === 'string',
                proofTypeAsNumber: Number(proofType),
                isProofTypeNaN: isNaN(Number(proofType)),
                valueAsJSON: JSON.stringify(proofType)
            });
            if (typeof proofType === 'number' || !isNaN(Number(proofType))) {
                // Convert to number for comparison if it's a numeric string
                const proofTypeNum = typeof proofType === 'number' ? proofType : Number(proofType);
                // Map numeric type to string type
                if (proofTypeNum === ZK_PROOF_TYPES.STANDARD || proofTypeNum === 0) {
                    proofTypeStr = 'standard';
                }
                else if (proofTypeNum === ZK_PROOF_TYPES.THRESHOLD || proofTypeNum === 1) {
                    proofTypeStr = 'threshold';
                }
                else if (proofTypeNum === ZK_PROOF_TYPES.MAXIMUM || proofTypeNum === 2) {
                    proofTypeStr = 'maximum';
                }
                else {
                    proofTypeStr = 'standard';
                } // Default fallback
                logger.debug(`Converted numeric proof type ${proofType} to string: ${proofTypeStr}`);
            }
            else if (typeof proofType === 'string') {
                proofTypeStr = proofType.toLowerCase();
                logger.debug(`Using string proof type: ${proofTypeStr}`);
            }
            else {
                // Default fallback for undefined or other types
                proofTypeStr = 'standard';
                logger.debug(`Using default proof type: ${proofTypeStr}`);
            }
            // Debug logging after conversion
            logger.debug('ZK Module - proofType details (after conversion)', {
                originalProofType: proofType,
                convertedProofType: proofTypeStr,
                convertedType: typeof proofTypeStr,
                isConvertedString: typeof proofTypeStr === 'string'
            });
            logger.debug('ZK Proof Generation - Parameter extraction', {
                extractedProofType: proofTypeStr,
                inputsFormat: Object.keys(restInputs).join(',')
            });
            // Call the core implementation
            return await generateZKProofCore(restInputs, proofTypeStr, options);
        }
        // Otherwise, pass through to the core implementation
        return await generateZKProofCore(inputObj, providedProofType, options);
    }
    catch (error) {
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
export { ZK_PROOF_TYPES, verifyZKProof, serializeZKProof, deserializeZKProof, generateZKProofHash, getVerificationKey, stringifyBigInts, parseBigInts, SNARK_FIELD_SIZE };
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
