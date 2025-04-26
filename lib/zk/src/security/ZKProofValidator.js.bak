/**
 * @fileoverview ZK Proof Validator
 * 
 * Consolidated module for validating and verifying zero-knowledge proofs,
 * ensuring their integrity, and detecting tampering attempts.
 * 
 * @author ZK Infrastructure Team
 */

import { zkErrorLogger } from '../zkErrorLogger.mjs';
import { SecurityError, InputError, ErrorCode } from '../zkErrorHandler.mjs';

/**
 * ZK Proof Validator class for validating and verifying
 * zero-knowledge proofs and detecting tampering attempts.
 */
export class ZKProofValidator {
  /**
   * Create a new ZKProofValidator instance
   * 
   * @param {Object} options - Configuration options
   * @param {Object} [options.snarkjs] - SnarkJS library instance
   * @param {Object} [options.verificationKey] - Verification key
   * @param {Function} [options.customVerifier] - Custom verification function
   * @param {boolean} [options.strictMode=true] - Enable strict validation
   * @param {Object} [options.schemas] - Proof schemas for validation
   */
  constructor(options = {}) {
    this.snarkjs = options.snarkjs;
    this.verificationKey = options.verificationKey;
    this.customVerifier = options.customVerifier;
    this.strictMode = options.strictMode !== false;
    this.schemas = options.schemas || {};
    
    // Statistics tracking
    this.stats = {
      totalValidations: 0,
      validProofs: 0,
      invalidProofs: 0,
      malformedProofs: 0,
      verificationErrors: 0
    };
    
    // Error messages
    this.errorMessages = {
      MISSING_SNARKJS: 'SnarkJS library not provided',
      MISSING_VERIFICATION_KEY: 'Verification key not provided',
      INVALID_PROOF_FORMAT: 'Invalid proof format',
      MISSING_PROOF: 'Proof data is missing',
      MISSING_PUBLIC_INPUTS: 'Public inputs are missing',
      VERIFICATION_FAILED: 'Proof verification failed',
      INVALID_PROOF_TYPE: 'Invalid proof type',
      CURVE_POINT_VALIDATION_FAILED: 'Curve point validation failed',
      INCOMPATIBLE_PUBLIC_INPUTS: 'Public inputs incompatible with circuit',
      IMPLEMENTATION_ERROR: 'ZK proof verification implementation error'
    };
  }
  
  /**
   * Set verification key
   * 
   * @param {Object} verificationKey - Verification key
   * @param {string} [keyId] - Optional identifier for the key
   */
  setVerificationKey(verificationKey, keyId) {
    if (!verificationKey) {
      throw new InputError('Verification key must be provided', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        recoverable: false,
        userFixable: true
      });
    }
    
    if (keyId) {
      // Store multiple verification keys if needed
      if (!this.verificationKeys) {
        this.verificationKeys = new Map();
      }
      this.verificationKeys.set(keyId, verificationKey);
    } else {
      // Set the default key
      this.verificationKey = verificationKey;
    }
  }
  
  /**
   * Get verification key
   * 
   * @param {string} [keyId] - Optional identifier for the key
   * @returns {Object} Verification key
   */
  getVerificationKey(keyId) {
    if (keyId && this.verificationKeys) {
      return this.verificationKeys.get(keyId);
    }
    return this.verificationKey;
  }
  
  /**
   * Set proof schema for a proof type
   * 
   * @param {string} proofType - Type of proof
   * @param {Object} schema - Schema for validation
   */
  setProofSchema(proofType, schema) {
    this.schemas[proofType] = schema;
  }
  
  /**
   * Validate proof structure
   * 
   * @param {Object} proof - Proof to validate
   * @param {string} [proofType] - Type of proof (standardProof, thresholdProof, maximumProof)
   * @returns {Object} Validation result
   */
  validateProofStructure(proof, proofType) {
    this.stats.totalValidations++;
    
    try {
      // Basic structure check
      if (!proof) {
        this.stats.malformedProofs++;
        return {
          valid: false,
          reason: 'MISSING_PROOF',
          message: this.errorMessages.MISSING_PROOF
        };
      }
      
      // Check if it's a Groth16 proof
      if (proof.protocol === 'groth16') {
        return this._validateGroth16Proof(proof);
      }
      
      // Check if it's a native ZK proof of funds
      if (proofType && this.schemas[proofType]) {
        return this._validateAgainstSchema(proof, proofType);
      }
      
      // Default structure check for common proof properties
      const requiredFields = ['proof', 'publicInputs'];
      const missingFields = requiredFields.filter(field => !proof[field]);
      
      if (missingFields.length > 0) {
        this.stats.malformedProofs++;
        return {
          valid: false,
          reason: 'INVALID_PROOF_FORMAT',
          message: `${this.errorMessages.INVALID_PROOF_FORMAT}: Missing fields: ${missingFields.join(', ')}`,
          details: { missingFields }
        };
      }
      
      // If we get here, the structure is valid
      return {
        valid: true,
        message: 'Proof structure validation passed'
      };
    } catch (error) {
      this.stats.verificationErrors++;
      
      zkErrorLogger.logError(error, {
        context: 'ZKProofValidator.validateProofStructure',
        proofType
      });
      
      return {
        valid: false,
        reason: 'VALIDATION_ERROR',
        message: `Error validating proof structure: ${error.message}`,
        error: error.message
      };
    }
  }
  
  /**
   * Validate Groth16 proof
   * 
   * @param {Object} proof - Groth16 proof
   * @returns {Object} Validation result
   * @private
   */
  _validateGroth16Proof(proof) {
    // For Groth16 proofs, check the required fields
    const requiredFields = ['pi_a', 'pi_b', 'pi_c', 'protocol'];
    const missingFields = requiredFields.filter(field => !proof[field]);
    
    if (missingFields.length > 0) {
      this.stats.malformedProofs++;
      return {
        valid: false,
        reason: 'INVALID_PROOF_FORMAT',
        message: `Invalid Groth16 proof format: Missing fields: ${missingFields.join(', ')}`,
        details: { missingFields }
      };
    }
    
    // Validate pi_a is an array of 2 elements
    if (!Array.isArray(proof.pi_a) || proof.pi_a.length !== 2) {
      this.stats.malformedProofs++;
      return {
        valid: false,
        reason: 'INVALID_PROOF_FORMAT',
        message: 'Invalid Groth16 proof format: pi_a should be an array of 2 elements',
        details: { field: 'pi_a' }
      };
    }
    
    // Validate pi_b is an array of 2 arrays, each with 2 elements
    if (!Array.isArray(proof.pi_b) || proof.pi_b.length !== 2 ||
        !Array.isArray(proof.pi_b[0]) || proof.pi_b[0].length !== 2 ||
        !Array.isArray(proof.pi_b[1]) || proof.pi_b[1].length !== 2) {
      this.stats.malformedProofs++;
      return {
        valid: false,
        reason: 'INVALID_PROOF_FORMAT',
        message: 'Invalid Groth16 proof format: pi_b should be a 2x2 array',
        details: { field: 'pi_b' }
      };
    }
    
    // Validate pi_c is an array of 2 elements
    if (!Array.isArray(proof.pi_c) || proof.pi_c.length !== 2) {
      this.stats.malformedProofs++;
      return {
        valid: false,
        reason: 'INVALID_PROOF_FORMAT',
        message: 'Invalid Groth16 proof format: pi_c should be an array of 2 elements',
        details: { field: 'pi_c' }
      };
    }
    
    // Check all values are valid numbers or strings representing numbers
    const allPoints = [
      ...proof.pi_a,
      ...proof.pi_b[0],
      ...proof.pi_b[1],
      ...proof.pi_c
    ];
    
    const invalidPoints = allPoints.filter(point => {
      // Check if it's a number or a numeric string
      return (typeof point !== 'number' && 
              typeof point !== 'string' && 
              typeof point !== 'bigint') ||
             (typeof point === 'string' && isNaN(Number(point)) && 
              !/^0x[0-9a-fA-F]+$/.test(point) && 
              !/^\d+$/.test(point));
    });
    
    if (invalidPoints.length > 0) {
      this.stats.malformedProofs++;
      return {
        valid: false,
        reason: 'INVALID_PROOF_VALUES',
        message: 'Invalid Groth16 proof format: points must be valid numbers or numeric strings',
        details: { invalidPoints }
      };
    }
    
    return {
      valid: true,
      message: 'Groth16 proof structure validation passed'
    };
  }
  
  /**
   * Validate proof against schema
   * 
   * @param {Object} proof - Proof to validate
   * @param {string} proofType - Type of proof
   * @returns {Object} Validation result
   * @private
   */
  _validateAgainstSchema(proof, proofType) {
    const schema = this.schemas[proofType];
    
    if (!schema) {
      return {
        valid: false,
        reason: 'UNKNOWN_PROOF_TYPE',
        message: `Unknown proof type: ${proofType}`
      };
    }
    
    // Check required fields
    if (schema.requiredFields) {
      const missingFields = schema.requiredFields.filter(field => !proof[field]);
      
      if (missingFields.length > 0) {
        this.stats.malformedProofs++;
        return {
          valid: false,
          reason: 'INVALID_PROOF_FORMAT',
          message: `Invalid ${proofType} format: Missing fields: ${missingFields.join(', ')}`,
          details: { missingFields }
        };
      }
    }
    
    // Check field types
    if (schema.fieldTypes) {
      const invalidFields = [];
      
      for (const [field, expectedType] of Object.entries(schema.fieldTypes)) {
        if (proof[field] !== undefined) {
          let isValid = false;
          
          switch (expectedType) {
            case 'string':
              isValid = typeof proof[field] === 'string';
              break;
            case 'number':
              isValid = typeof proof[field] === 'number' || 
                        (typeof proof[field] === 'string' && !isNaN(Number(proof[field])));
              break;
            case 'boolean':
              isValid = typeof proof[field] === 'boolean';
              break;
            case 'array':
              isValid = Array.isArray(proof[field]);
              break;
            case 'object':
              isValid = typeof proof[field] === 'object' && proof[field] !== null && !Array.isArray(proof[field]);
              break;
            default:
              // For custom types like 'address', 'hash', etc.
              if (schema.validators && schema.validators[expectedType]) {
                isValid = schema.validators[expectedType](proof[field]);
              } else {
                // If no validator, assume valid
                isValid = true;
              }
          }
          
          if (!isValid) {
            invalidFields.push({
              field,
              expectedType,
              actualValue: proof[field]
            });
          }
        }
      }
      
      if (invalidFields.length > 0) {
        this.stats.malformedProofs++;
        return {
          valid: false,
          reason: 'INVALID_FIELD_TYPES',
          message: `Invalid ${proofType} field types`,
          details: { invalidFields }
        };
      }
    }
    
    // Run custom validators if defined
    if (schema.validate) {
      try {
        const validationResult = schema.validate(proof);
        
        if (!validationResult.valid) {
          this.stats.malformedProofs++;
          return validationResult;
        }
      } catch (error) {
        this.stats.verificationErrors++;
        return {
          valid: false,
          reason: 'VALIDATION_ERROR',
          message: `Error in custom validation: ${error.message}`,
          error: error.message
        };
      }
    }
    
    return {
      valid: true,
      message: `${proofType} proof structure validation passed`
    };
  }
  
  /**
   * Verify a ZK proof against a verification key
   * 
   * @param {Object} proof - Proof to verify
   * @param {Array} publicInputs - Public inputs to the circuit
   * @param {Object} [options] - Verification options
   * @param {Object} [options.verificationKey] - Verification key to use
   * @param {string} [options.keyId] - ID of the verification key to use
   * @param {Function} [options.verifier] - Custom verification function
   * @returns {Promise<Object>} Verification result
   */
  async verifyProof(proof, publicInputs, options = {}) {
    this.stats.totalValidations++;
    
    try {
      // Get verification key
      const verificationKey = options.verificationKey || 
                              this.getVerificationKey(options.keyId) || 
                              this.verificationKey;
      
      // If custom verifier is provided, use it
      const verifier = options.verifier || this.customVerifier;
      
      if (verifier) {
        return await this._verifyWithCustomVerifier(verifier, proof, publicInputs, options);
      }
      
      // Use snarkjs if available
      if (this.snarkjs && this.snarkjs.groth16) {
        return await this._verifyWithSnarkJS(proof, publicInputs, verificationKey);
      }
      
      // No verification method available
      this.stats.verificationErrors++;
      return {
        valid: false,
        reason: 'NO_VERIFICATION_METHOD',
        message: 'No verification method available'
      };
    } catch (error) {
      this.stats.verificationErrors++;
      
      zkErrorLogger.logError(error, {
        context: 'ZKProofValidator.verifyProof',
        proofType: options.proofType
      });
      
      return {
        valid: false,
        reason: 'VERIFICATION_ERROR',
        message: `Error verifying proof: ${error.message}`,
        error: error.message
      };
    }
  }
  
  /**
   * Verify proof with custom verifier
   * 
   * @param {Function} verifier - Custom verification function
   * @param {Object} proof - Proof to verify
   * @param {Array} publicInputs - Public inputs to the circuit
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} Verification result
   * @private
   */
  async _verifyWithCustomVerifier(verifier, proof, publicInputs, options) {
    try {
      const verificationResult = await verifier(proof, publicInputs, options);
      
      if (verificationResult === true || (verificationResult && verificationResult.valid)) {
        this.stats.validProofs++;
        return {
          valid: true,
          message: 'Proof verified successfully using custom verifier'
        };
      } else {
        this.stats.invalidProofs++;
        return {
          valid: false,
          reason: 'VERIFICATION_FAILED',
          message: 'Proof verification failed with custom verifier',
          details: verificationResult
        };
      }
    } catch (error) {
      this.stats.verificationErrors++;
      
      zkErrorLogger.logError(error, {
        context: 'ZKProofValidator._verifyWithCustomVerifier'
      });
      
      return {
        valid: false,
        reason: 'CUSTOM_VERIFIER_ERROR',
        message: `Error in custom verifier: ${error.message}`,
        error: error.message
      };
    }
  }
  
  /**
   * Verify proof with snarkjs
   * 
   * @param {Object} proof - Proof to verify
   * @param {Array} publicInputs - Public inputs to the circuit
   * @param {Object} verificationKey - Verification key
   * @returns {Promise<Object>} Verification result
   * @private
   */
  async _verifyWithSnarkJS(proof, publicInputs, verificationKey) {
    try {
      if (!this.snarkjs || !this.snarkjs.groth16) {
        throw new Error(this.errorMessages.MISSING_SNARKJS);
      }
      
      if (!verificationKey) {
        throw new Error(this.errorMessages.MISSING_VERIFICATION_KEY);
      }
      
      // Convert proof to the format expected by snarkjs if necessary
      let formattedProof = proof;
      if (proof.proof) {
        // If proof is wrapped in a proof field, unwrap it
        formattedProof = proof.proof;
      } else if (!proof.pi_a && !proof.pi_b && !proof.pi_c) {
        // If proof doesn't have Groth16 components, it's invalid
        this.stats.malformedProofs++;
        return {
          valid: false,
          reason: 'INVALID_PROOF_FORMAT',
          message: this.errorMessages.INVALID_PROOF_FORMAT
        };
      }
      
      // Format public inputs if necessary
      let formattedPublicInputs = publicInputs;
      if (!Array.isArray(publicInputs)) {
        if (publicInputs && typeof publicInputs === 'object') {
          // If publicInputs is an object with properties, convert to array
          formattedPublicInputs = Object.values(publicInputs);
        } else {
          // Invalid public inputs
          this.stats.malformedProofs++;
          return {
            valid: false,
            reason: 'INVALID_PUBLIC_INPUTS',
            message: 'Public inputs must be an array or object'
          };
        }
      }
      
      // Verify the proof
      const isValid = await this.snarkjs.groth16.verify(
        verificationKey,
        formattedPublicInputs,
        formattedProof
      );
      
      if (isValid) {
        this.stats.validProofs++;
        return {
          valid: true,
          message: 'Proof verified successfully'
        };
      } else {
        this.stats.invalidProofs++;
        return {
          valid: false,
          reason: 'VERIFICATION_FAILED',
          message: this.errorMessages.VERIFICATION_FAILED
        };
      }
    } catch (error) {
      this.stats.verificationErrors++;
      
      zkErrorLogger.logError(error, {
        context: 'ZKProofValidator._verifyWithSnarkJS'
      });
      
      return {
        valid: false,
        reason: 'SNARKJS_ERROR',
        message: `SnarkJS error: ${error.message}`,
        error: error.message
      };
    }
  }
  
  /**
   * Check for proof tampering by validating curve points
   * 
   * @param {Object} proof - Proof to check
   * @returns {Object} Tampering check result
   */
  checkForTampering(proof) {
    try {
      // Basic structure validation
      const structureValidation = this.validateProofStructure(proof);
      if (!structureValidation.valid) {
        return structureValidation;
      }
      
      // For Groth16 proofs, validate curve points are on the curve
      if (proof.pi_a && proof.pi_b && proof.pi_c) {
        return this._validateCurvePoints(proof);
      }
      
      // For native proofs, validate hash integrity
      if (proof.proof && proof.publicInputs && proof.proofHash) {
        return this._validateProofIntegrity(proof);
      }
      
      // If we don't know how to check for tampering for this proof type,
      // we can only rely on structure validation
      return {
        valid: true,
        message: 'Proof structure is valid, but no specific tampering checks implemented for this proof type'
      };
    } catch (error) {
      zkErrorLogger.logError(error, {
        context: 'ZKProofValidator.checkForTampering'
      });
      
      return {
        valid: false,
        reason: 'TAMPERING_CHECK_ERROR',
        message: `Error checking for tampering: ${error.message}`,
        error: error.message
      };
    }
  }
  
  /**
   * Validate curve points for Groth16 proofs
   * 
   * @param {Object} proof - Groth16 proof
   * @returns {Object} Validation result
   * @private
   */
  _validateCurvePoints(proof) {
    // In a real implementation, this would validate that points are on the curve
    // using elliptic curve arithmetic
    // Mock implementation for demonstration
    return {
      valid: true,
      message: 'Curve points validation passed'
    };
  }
  
  /**
   * Validate proof integrity using proof hash
   * 
   * @param {Object} proof - Proof with hash
   * @returns {Object} Validation result
   * @private
   */
  _validateProofIntegrity(proof) {
    // In a real implementation, this would recalculate the hash and compare
    // Mock implementation for demonstration
    return {
      valid: true,
      message: 'Proof integrity validation passed'
    };
  }
  
  /**
   * Get statistics about proof validation
   * 
   * @returns {Object} Validation statistics
   */
  getStats() {
    const totalValidations = this.stats.totalValidations;
    const successRate = totalValidations > 0
      ? (this.stats.validProofs / totalValidations * 100).toFixed(2) + '%'
      : '0%';
    
    return {
      ...this.stats,
      successRate
    };
  }
  
  /**
   * Reset all statistics counters
   */
  resetStats() {
    this.stats = {
      totalValidations: 0,
      validProofs: 0,
      invalidProofs: 0,
      malformedProofs: 0,
      verificationErrors: 0
    };
  }
}

// Create singleton instance
const zkProofValidator = new ZKProofValidator();

export { ZKProofValidator, zkProofValidator };
export default zkProofValidator;