/**
 * Parameter validation module for ZK proofs
 * 
 * This module provides functions to validate parameters used in ZK proofs,
 * ensuring they meet required formats and constraints before processing.
 */

/**
 * Validates parameters for a ZK proof operation
 * @param {Object} params - Parameters to validate
 * @param {string} params.proofType - Type of proof (standard, threshold, maximum) 
 * @param {Object} params.publicInputs - Public inputs for the proof
 * @param {Object} params.privateInputs - Private inputs for the proof
 * @param {Object} [options] - Validation options
 * @returns {Promise<Object>} Validation result object
 */
async function validateParameters(params, options = {}) {
    const validationId = `validation_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // Default result with success
    const result = {
        isValid: true,
        validationId,
        errors: [],
        warnings: []
    };

    try {
        // Check if params is an object
        if (!params || typeof params !== 'object') {
            result.isValid = false;
            result.errors.push({
                field: 'params',
                message: 'Parameters must be an object'
            });
            return result;
        }

        // Validate proof type
        if (!params.proofType) {
            result.isValid = false;
            result.errors.push({
                field: 'proofType',
                message: 'Proof type is required'
            });
        } else if (!['standard', 'threshold', 'maximum'].includes(params.proofType.toLowerCase())) {
            result.isValid = false;
            result.errors.push({
                field: 'proofType',
                message: 'Invalid proof type. Must be "standard", "threshold", or "maximum"'
            });
        }

        // Validate public inputs
        if (!params.publicInputs || typeof params.publicInputs !== 'object') {
            result.isValid = false;
            result.errors.push({
                field: 'publicInputs',
                message: 'Public inputs must be an object'
            });
        } else {
            // Validate based on proof type
            switch (params.proofType?.toLowerCase()) {
                case 'standard':
                    if (params.publicInputs.address === undefined) {
                        result.isValid = false;
                        result.errors.push({
                            field: 'publicInputs.address',
                            message: 'Address is required for standard proof'
                        });
                    }
                    if (params.publicInputs.amount === undefined) {
                        result.isValid = false;
                        result.errors.push({
                            field: 'publicInputs.amount',
                            message: 'Amount is required for standard proof'
                        });
                    }
                    break;

                case 'threshold':
                    if (params.publicInputs.address === undefined) {
                        result.isValid = false;
                        result.errors.push({
                            field: 'publicInputs.address',
                            message: 'Address is required for threshold proof'
                        });
                    }
                    if (params.publicInputs.threshold === undefined) {
                        result.isValid = false;
                        result.errors.push({
                            field: 'publicInputs.threshold',
                            message: 'Threshold is required for threshold proof'
                        });
                    }
                    break;

                case 'maximum':
                    if (params.publicInputs.address === undefined) {
                        result.isValid = false;
                        result.errors.push({
                            field: 'publicInputs.address',
                            message: 'Address is required for maximum proof'
                        });
                    }
                    if (params.publicInputs.maximum === undefined) {
                        result.isValid = false;
                        result.errors.push({
                            field: 'publicInputs.maximum',
                            message: 'Maximum is required for maximum proof'
                        });
                    }
                    break;
            }
        }

        // Validate private inputs
        if (!params.privateInputs || typeof params.privateInputs !== 'object') {
            result.isValid = false;
            result.errors.push({
                field: 'privateInputs',
                message: 'Private inputs must be an object'
            });
        } else {
            // Common private input validations
            if (params.privateInputs.nonce === undefined) {
                result.isValid = false;
                result.errors.push({
                    field: 'privateInputs.nonce',
                    message: 'Nonce is required for all proof types'
                });
            }

            if (params.privateInputs.signature === undefined) {
                result.isValid = false;
                result.errors.push({
                    field: 'privateInputs.signature',
                    message: 'Signature is required for all proof types'
                });
            } else if (!Array.isArray(params.privateInputs.signature)) {
                result.isValid = false;
                result.errors.push({
                    field: 'privateInputs.signature',
                    message: 'Signature must be an array'
                });
            }

            // Check for actual balance in all proof types
            if (params.privateInputs.actualBalance === undefined) {
                result.isValid = false;
                result.errors.push({
                    field: 'privateInputs.actualBalance',
                    message: 'Actual balance is required for all proof types'
                });
            }
        }

        // Add any custom validation from options
        if (options.customValidation && typeof options.customValidation === 'function') {
            const customResult = await options.customValidation(params);
            if (customResult && !customResult.isValid) {
                result.isValid = false;
                if (customResult.errors && Array.isArray(customResult.errors)) {
                    result.errors.push(...customResult.errors);
                }
                if (customResult.warnings && Array.isArray(customResult.warnings)) {
                    result.warnings.push(...customResult.warnings);
                }
            }
        }

    } catch (error) {
        // If any error occurs during validation, mark as invalid
        result.isValid = false;
        result.errors.push({
            field: 'general',
            message: `Validation error: ${error.message || 'Unknown error'}`,
            error
        });
    }

    return result;
}

module.exports = {
    validateParameters
}; 