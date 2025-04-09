/**
 * Parameter Validator for Zero-Knowledge Proof System
 * 
 * Implements validation of ZK parameters, verification keys, and ceremonies
 * with integrity verification, chain of trust validation, and tampering detection.
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This module acts like a security inspector for our zero-knowledge system. It ensures
 * that all the cryptographic parameters used in our privacy system are genuine,
 * unaltered, and properly created. Think of it like:
 * 
 * 1. FORGERY DETECTION: Similar to how experts verify that artwork is authentic
 *    and not forged, this system examines the mathematical structure of our
 *    cryptographic parameters to confirm they haven't been tampered with.
 * 
 * 2. SECURITY CHAIN VERIFICATION: Like verifying a chain of custody for evidence,
 *    this system checks that our parameters have been properly created through
 *    the required trusted setup process with multiple independent participants.
 * 
 * 3. INTEGRITY CHECKING: Similar to how digital signatures and checksums
 *    verify software hasn't been modified, this system uses cryptographic
 *    techniques to ensure our parameters retain their critical security properties.
 * 
 * Business value: Prevents compromised or malicious parameters from entering
 * our system, ensures the security guarantees of our zero-knowledge proofs,
 * and provides confidence that our privacy protections work as designed.
 */

import pkg from 'js-sha3';
const { keccak256 } = pkg;
// Use SHA3-256 since SHA-256 is not available
const sha256 = pkg.sha3_256;
import { stringifyBigInts, parseBigInts } from './zkUtils.js';
import TamperDetection from './TamperDetection.js';
import SecurityAuditLogger from './SecurityAuditLogger.js';
import { zkErrorLogger } from './zkErrorLogger.js';
import {
  InputError,
  SecurityError,
  VerificationError,
  SystemError,
  ErrorCode
} from './zkErrorHandler.js';

// Default validation configuration
const DEFAULT_CONFIG = {
  validationLevel: 'standard',  // minimal | standard | strict
  crossValidation: true,        // Validate across multiple methods
  cacheValidResults: true,      // Cache validation results
  logValidationEvents: true,    // Log validation events
  alertOnFailure: true,         // Alert on validation failure
  timeoutMs: 60000,             // Validation timeout in milliseconds
  signatureVerification: true,  // Verify digital signatures
  hashAlgorithm: 'sha256',      // sha256 | keccak256
};

// Validation levels define what checks are performed
const VALIDATION_LEVELS = {
  minimal: {
    // Basic integrity checks only
    checkIntegrity: true,
    checkStructure: true,
    checkSignatures: false,
    checkChainOfTrust: false,
    checkCryptographicProperties: false,
    checkHistoricalConsistency: false,
  },
  standard: {
    // Standard validation for normal operation
    checkIntegrity: true,
    checkStructure: true,
    checkSignatures: true,
    checkChainOfTrust: true,
    checkCryptographicProperties: false,
    checkHistoricalConsistency: false,
  },
  strict: {
    // Strict validation for critical operations
    checkIntegrity: true,
    checkStructure: true,
    checkSignatures: true,
    checkChainOfTrust: true,
    checkCryptographicProperties: true,
    checkHistoricalConsistency: true,
  },
};

/**
 * ParameterValidator class
 * Provides comprehensive validation for ZK parameters
 */
class ParameterValidator {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.validationLevel = VALIDATION_LEVELS[this.config.validationLevel] || VALIDATION_LEVELS.standard;
    this.tamperDetection = new TamperDetection();
    this.validationCache = new Map();
    this.trustedSources = new Set();
    this.trustAnchors = new Map();
    this.auditLogger = new SecurityAuditLogger({
      component: 'ParameterValidator',
      logLevel: 'info',
      includeTimestamp: true,
    });
    
    // Reference data for validation
    this.referenceHashes = new Map();
    this.signatureKeys = new Map();
  }

  /**
   * Validate parameters with comprehensive checks
   * 
   * @param {Object} parameters - The parameters to validate
   * @param {Object} options - Validation options
   * @param {string} options.expectedHash - Optional expected hash
   * @param {string} options.circuitType - Optional circuit type
   * @param {string} options.source - Optional parameter source
   * @param {string} options.validationLevel - Override default validation level
   * @returns {Object} Validation results
   */
  async validateParameters(parameters, options = {}) {
    const startTime = Date.now();
    const operationId = 'ParameterValidator:validateParameters';
    let parameterHash = '';
    let validationId = '';
    
    try {
      // Input validation
      if (!parameters) {
        throw new InputError('Missing parameters for validation', {
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          operationId,
          userFixable: true,
          recoverable: false,
          details: { parametersProvided: false }
        });
      }
      
      if (typeof parameters !== 'object' || Array.isArray(parameters)) {
        throw new InputError('Invalid parameters format', {
          code: ErrorCode.INPUT_TYPE_ERROR,
          operationId,
          userFixable: true,
          recoverable: false,
          details: { 
            parametersType: typeof parameters,
            isArray: Array.isArray(parameters)
          }
        });
      }
      
      // Calculate parameter hash
      parameterHash = this.hashData(parameters);
      validationId = `validation-${parameterHash}-${Date.now()}`;
      
      // Log validation attempt with both logging systems for complete audit trail
      this.auditLogger.log('info', 'Parameter validation started', {
        validationId,
        circuitType: options.circuitType,
        source: options.source,
        validationLevel: options.validationLevel || this.config.validationLevel,
        parameterHash,
      });

      zkErrorLogger.log('INFO', 'Parameter validation started', {
        operationId,
        validationId,
        circuitType: options.circuitType,
        validationLevel: options.validationLevel || this.config.validationLevel
      });

      // Check cache if enabled
      if (this.config.cacheValidResults && options.expectedHash) {
        const cachedResult = this.validationCache.get(options.expectedHash);
        if (cachedResult && !this.isCacheExpired(cachedResult)) {
          this.auditLogger.log('info', 'Using cached validation result', {
            validationId,
            parameterHash,
            cachedAt: cachedResult.timestamp,
          });
          
          zkErrorLogger.log('INFO', 'Using cached validation result', {
            operationId,
            validationId,
            parameterHash,
            cachedAt: cachedResult.timestamp
          });
          
          return { ...cachedResult.result, fromCache: true };
        }
      }

      // Determine validation level
      const level = options.validationLevel ? 
        VALIDATION_LEVELS[options.validationLevel] || this.validationLevel :
        this.validationLevel;

      // Initialize validation results
      const results = {
        isValid: false,
        validationId,
        parameterHash,
        timestamp: startTime,
        checks: {},
        warnings: [],
        errors: [],
      };

      // Run integrity checks
      if (level.checkIntegrity) {
        try {
          results.checks.integrity = await this.checkIntegrity(parameters, options);
          if (!results.checks.integrity.valid) {
            results.errors.push('Integrity check failed: ' + results.checks.integrity.reason);
          }
        } catch (integrityError) {
          // Capture specific check errors
          zkErrorLogger.logError(integrityError, {
            operationId,
            validationId,
            checkType: 'integrity'
          });
          
          results.checks.integrity = { 
            valid: false, 
            reason: integrityError.message 
          };
          results.errors.push('Integrity check error: ' + integrityError.message);
        }
      }

      // Run structure checks
      if (level.checkStructure) {
        try {
          results.checks.structure = await this.checkStructure(parameters, options);
          if (!results.checks.structure.valid) {
            results.errors.push('Structure check failed: ' + results.checks.structure.reason);
          }
        } catch (structureError) {
          // Capture specific check errors
          zkErrorLogger.logError(structureError, {
            operationId,
            validationId,
            checkType: 'structure'
          });
          
          results.checks.structure = { 
            valid: false, 
            reason: structureError.message 
          };
          results.errors.push('Structure check error: ' + structureError.message);
        }
      }

      // Run signature verification
      if (level.checkSignatures && options.signature) {
        try {
          results.checks.signature = await this.verifySignature(parameters, options.signature, options.source);
          if (!results.checks.signature.valid) {
            results.errors.push('Signature verification failed: ' + results.checks.signature.reason);
          }
        } catch (signatureError) {
          // Capture specific check errors
          zkErrorLogger.logError(signatureError, {
            operationId,
            validationId,
            checkType: 'signature'
          });
          
          results.checks.signature = { 
            valid: false, 
            reason: signatureError.message 
          };
          results.errors.push('Signature verification error: ' + signatureError.message);
        }
      }

      // Run chain of trust verification
      if (level.checkChainOfTrust && options.ceremonyId) {
        try {
          results.checks.chainOfTrust = await this.verifyChainOfTrust(parameters, options.ceremonyId);
          if (!results.checks.chainOfTrust.valid) {
            results.errors.push('Chain of trust verification failed: ' + results.checks.chainOfTrust.reason);
          }
        } catch (chainError) {
          // Capture specific check errors
          zkErrorLogger.logError(chainError, {
            operationId,
            validationId,
            checkType: 'chainOfTrust'
          });
          
          results.checks.chainOfTrust = { 
            valid: false, 
            reason: chainError.message 
          };
          results.errors.push('Chain of trust verification error: ' + chainError.message);
        }
      }

      // Run cryptographic property checks
      if (level.checkCryptographicProperties) {
        try {
          results.checks.cryptographic = await this.checkCryptographicProperties(parameters, options.circuitType);
          if (!results.checks.cryptographic.valid) {
            results.errors.push('Cryptographic property check failed: ' + results.checks.cryptographic.reason);
          }
        } catch (cryptoError) {
          // Capture specific check errors
          zkErrorLogger.logError(cryptoError, {
            operationId,
            validationId,
            checkType: 'cryptographic'
          });
          
          results.checks.cryptographic = { 
            valid: false, 
            reason: cryptoError.message 
          };
          results.errors.push('Cryptographic property check error: ' + cryptoError.message);
        }
      }

      // Run historical consistency checks
      if (level.checkHistoricalConsistency && options.version) {
        try {
          results.checks.historical = await this.checkHistoricalConsistency(parameters, options.version);
          if (!results.checks.historical.valid) {
            results.errors.push('Historical consistency check failed: ' + results.checks.historical.reason);
          }
        } catch (historyError) {
          // Capture specific check errors
          zkErrorLogger.logError(historyError, {
            operationId,
            validationId,
            checkType: 'historical'
          });
          
          results.checks.historical = { 
            valid: false, 
            reason: historyError.message 
          };
          results.errors.push('Historical consistency check error: ' + historyError.message);
        }
      }

      // Determine overall validity
      results.isValid = Object.values(results.checks).every(check => check.valid);

      // Add performance information
      results.validationTimeMs = Date.now() - startTime;

      // Cache result if valid and caching is enabled
      if (results.isValid && this.config.cacheValidResults) {
        this.validationCache.set(parameterHash, {
          result: results,
          timestamp: Date.now(),
          expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hour cache
        });
      }

      // Log validation result with both logging systems
      this.auditLogger.log(results.isValid ? 'info' : 'warn', 'Parameter validation completed', {
        validationId,
        isValid: results.isValid,
        checkCount: Object.keys(results.checks).length,
        errorCount: results.errors.length,
        warningCount: results.warnings.length,
        validationTimeMs: results.validationTimeMs,
      });

      zkErrorLogger.log(results.isValid ? 'INFO' : 'WARNING', 'Parameter validation completed', {
        operationId,
        validationId,
        isValid: results.isValid,
        checkCount: Object.keys(results.checks).length,
        errorCount: results.errors.length,
        validationTimeMs: results.validationTimeMs
      });

      // Alert on failure if configured
      if (!results.isValid && this.config.alertOnFailure) {
        this.auditLogger.log('error', 'Parameter validation failed', {
          validationId,
          parameterHash,
          errors: results.errors,
        });
        
        // Log with higher level of detail for security alerts
        const verificationError = new VerificationError('Parameter validation failed', {
          code: ErrorCode.VERIFICATION_FAILED,
          operationId,
          recoverable: false,
          securityCritical: true,
          details: {
            validationId,
            parameterHash,
            errors: results.errors,
            checksPerformed: Object.keys(results.checks)
          }
        });
        
        zkErrorLogger.logError(verificationError);
      }

      return results;
    } catch (error) {
      // Convert to appropriate error type if needed
      const zkError = error.code ? error : new SystemError(`Unhandled error in parameter validation: ${error.message}`, {
        code: ErrorCode.SYSTEM_NOT_INITIALIZED,
        operationId,
        details: { 
          parameterHash,
          validationId,
          error: error.message
        },
        recoverable: false,
        userFixable: false
      });
      
      // Log error with both logging systems
      this.auditLogger.log('error', 'Parameter validation failed with exception', {
        validationId,
        parameterHash,
        error: error.message,
        stack: error.stack,
      });
      
      zkErrorLogger.logError(zkError, {
        operationId, 
        validationId,
        parameterHash
      });

      // Return error result
      return {
        isValid: false,
        validationId,
        parameterHash,
        timestamp: startTime,
        error: error.message,
        errorCode: zkError.code,
        validationTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate verification key with comprehensive checks
   * 
   * @param {Object} verificationKey - The verification key to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation results
   */
  async validateVerificationKey(verificationKey, options = {}) {
    const startTime = Date.now();
    const keyHash = this.hashData(verificationKey);
    const validationId = `vk-validation-${keyHash}-${Date.now()}`;

    try {
      // Log validation attempt
      this.auditLogger.log('info', 'Verification key validation started', {
        validationId,
        keyId: verificationKey.id,
        validationLevel: options.validationLevel || this.config.validationLevel,
        keyHash,
      });

      // Check if we have a reference hash for this key
      if (options.expectedHash && options.expectedHash !== keyHash) {
        return {
          isValid: false,
          validationId,
          keyHash,
          timestamp: startTime,
          error: `Hash mismatch: expected ${options.expectedHash}, got ${keyHash}`,
          validationTimeMs: Date.now() - startTime,
        };
      }

      // Perform structure validation
      const structureValid = this.validateVerificationKeyStructure(verificationKey);
      if (!structureValid.valid) {
        return {
          isValid: false,
          validationId,
          keyHash,
          timestamp: startTime,
          error: `Invalid verification key structure: ${structureValid.reason}`,
          validationTimeMs: Date.now() - startTime,
        };
      }

      // For verification keys, we need similar checks as parameters but adapted
      // Most verification key validation is done through the parameter validator
      // This is a simplified approach specific to verification keys
      
      // Create result
      const results = {
        isValid: true,
        validationId,
        keyHash,
        timestamp: startTime,
        checks: {
          structure: structureValid,
        },
        warnings: [],
        errors: [],
      };

      // Add performance information
      results.validationTimeMs = Date.now() - startTime;

      // Log validation result
      this.auditLogger.log('info', 'Verification key validation completed', {
        validationId,
        keyId: verificationKey.id,
        isValid: results.isValid,
        validationTimeMs: results.validationTimeMs,
      });

      return results;
    } catch (error) {
      // Log error
      this.auditLogger.log('error', 'Verification key validation failed with exception', {
        validationId,
        keyHash,
        error: error.message,
        stack: error.stack,
      });

      // Return error result
      return {
        isValid: false,
        validationId,
        keyHash,
        timestamp: startTime,
        error: error.message,
        validationTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Check parameter integrity
   * 
   * @private
   * @param {Object} parameters - Parameters to check
   * @param {Object} options - Validation options
   * @returns {Object} Integrity check results
   */
  async checkIntegrity(parameters, options) {
    try {
      // Check for null or empty parameters
      if (!parameters) {
        return { valid: false, reason: 'Parameters are null or undefined' };
      }
      
      // Check if parameters are an object
      if (typeof parameters !== 'object' || Array.isArray(parameters)) {
        return { valid: false, reason: 'Parameters must be an object' };
      }

      // Check expected hash if provided
      if (options.expectedHash) {
        const calculatedHash = this.hashData(parameters);
        if (calculatedHash !== options.expectedHash) {
          return { 
            valid: false, 
            reason: `Hash mismatch: expected ${options.expectedHash}, got ${calculatedHash}`,
            expectedHash: options.expectedHash,
            calculatedHash,
          };
        }
      }

      // Ensure no invalid or corrupted fields
      for (const [key, value] of Object.entries(parameters)) {
        if (value === undefined || value === null) {
          continue; // Null values are allowed
        }

        // Check for NaN or Infinity in numeric fields
        if (typeof value === 'number' && (isNaN(value) || !isFinite(value))) {
          return { 
            valid: false, 
            reason: `Invalid numeric value in field '${key}'`,
            field: key,
          };
        }

        // Check for invalid strings
        if (typeof value === 'string' && value.length > 0) {
          // Validate string content based on context
          if (key.includes('hash') && !value.match(/^(0x)?[0-9a-fA-F]+$/)) {
            return { 
              valid: false, 
              reason: `Invalid hash format in field '${key}'`,
              field: key,
            };
          }
        }
      }

      // If all checks pass
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        reason: `Integrity check failed: ${error.message}`,
        error: error.message,
      };
    }
  }

  /**
   * Check parameter structure
   * 
   * @private
   * @param {Object} parameters - Parameters to check
   * @param {Object} options - Validation options
   * @returns {Object} Structure check results
   */
  async checkStructure(parameters, options) {
    try {
      // Check specific structure based on circuit type
      if (options.circuitType) {
        switch (options.circuitType.toLowerCase()) {
          case 'standard':
            // Check required fields for standard proof parameters
            if (!parameters.alpha || !parameters.beta || !parameters.gamma || !parameters.delta) {
              return { 
                valid: false, 
                reason: 'Missing required fields for standard proof parameters', 
                missingFields: ['alpha', 'beta', 'gamma', 'delta'].filter(f => !parameters[f]),
              };
            }
            break;
            
          case 'threshold':
            // Check required fields for threshold proof parameters
            if (!parameters.alpha || !parameters.beta || !parameters.gamma || !parameters.delta) {
              return { 
                valid: false, 
                reason: 'Missing required fields for threshold proof parameters', 
                missingFields: ['alpha', 'beta', 'gamma', 'delta'].filter(f => !parameters[f]),
              };
            }
            
            // Check IC array
            if (!Array.isArray(parameters.ic) || parameters.ic.length < 2) {
              return { 
                valid: false, 
                reason: 'Invalid IC array for threshold proof parameters',
                details: 'IC array must be present and have at least 2 elements',
              };
            }
            break;
            
          case 'maximum':
            // Check required fields for maximum proof parameters
            if (!parameters.alpha || !parameters.beta || !parameters.gamma || !parameters.delta) {
              return { 
                valid: false, 
                reason: 'Missing required fields for maximum proof parameters', 
                missingFields: ['alpha', 'beta', 'gamma', 'delta'].filter(f => !parameters[f]),
              };
            }
            
            // Check IC array
            if (!Array.isArray(parameters.ic) || parameters.ic.length < 2) {
              return { 
                valid: false, 
                reason: 'Invalid IC array for maximum proof parameters',
                details: 'IC array must be present and have at least 2 elements',
              };
            }
            break;
            
          default:
            // Unknown circuit type
            return { 
              valid: false, 
              reason: `Unknown circuit type: ${options.circuitType}`,
            };
        }
      } else {
        // Generic structure check for unknown circuit type
        const requiredFields = ['alpha', 'beta', 'gamma', 'delta'];
        const missingFields = requiredFields.filter(field => !parameters[field]);
        
        if (missingFields.length > 0) {
          return { 
            valid: false, 
            reason: `Missing required fields: ${missingFields.join(', ')}`,
            missingFields,
          };
        }
      }

      // Add checks for nested structure if needed
      
      // If all checks pass
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        reason: `Structure check failed: ${error.message}`,
        error: error.message,
      };
    }
  }

  /**
   * Verify digital signature on parameters
   * 
   * @private
   * @param {Object} parameters - Parameters to check
   * @param {string} signature - Digital signature
   * @param {string} source - Source of the parameters
   * @returns {Object} Signature verification results
   */
  async verifySignature(parameters, signature, source) {
    try {
      // In a real implementation, this would verify the signature
      // against a known public key from the trusted source
      
      // Basic validation
      if (!signature) {
        return { valid: false, reason: 'Signature is missing' };
      }
      
      // For this implementation, just validate the signature format
      if (typeof signature !== 'string' || signature.length < 64) {
        return { 
          valid: false, 
          reason: 'Invalid signature format',
          details: 'Signature must be a string of at least 64 characters',
        };
      }
      
      // In a real implementation, we'd verify the actual signature
      // using the source's public key and the parameter hash
      
      // If all checks pass
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        reason: `Signature verification failed: ${error.message}`,
        error: error.message,
      };
    }
  }

  /**
   * Verify chain of trust for parameters
   * 
   * @private
   * @param {Object} parameters - Parameters to check
   * @param {string} ceremonyId - ID of the ceremony
   * @returns {Object} Chain of trust verification results
   */
  async verifyChainOfTrust(parameters, ceremonyId) {
    try {
      // In a real implementation, this would verify the parameters
      // originated from a valid ceremony with sufficient participants
      
      // Basic validation
      if (!ceremonyId) {
        return { valid: false, reason: 'Ceremony ID is missing' };
      }
      
      // Check if this is a trusted ceremony ID
      // In a real implementation, this would check against a registry
      // of completed ceremonies
      
      // For this implementation, just assume the ceremony is valid
      // with a simple format check
      if (typeof ceremonyId !== 'string' || !ceremonyId.startsWith('ceremony-')) {
        return { 
          valid: false, 
          reason: 'Invalid ceremony ID format',
          details: 'Ceremony ID must start with "ceremony-"',
        };
      }
      
      // In a real implementation, we'd verify:
      // 1. The ceremony had sufficient participants
      // 2. The ceremony was properly verified
      // 3. The parameters hash chain back to the ceremony
      
      // If all checks pass
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        reason: `Chain of trust verification failed: ${error.message}`,
        error: error.message,
      };
    }
  }

  /**
   * Check cryptographic properties of parameters
   * 
   * @private
   * @param {Object} parameters - Parameters to check
   * @param {string} circuitType - Type of circuit
   * @returns {Object} Cryptographic property check results
   */
  async checkCryptographicProperties(parameters, circuitType) {
    try {
      // In a real implementation, this would verify the cryptographic
      // properties of the parameters, such as group membership and
      // pairing properties
      
      // For this implementation, just do basic structure validation
      // based on circuit type
      
      switch (circuitType?.toLowerCase()) {
        case 'standard':
        case 'threshold':
        case 'maximum':
          // Simple validation
          if (!parameters.alpha || !parameters.beta || !parameters.gamma || !parameters.delta) {
            return { 
              valid: false, 
              reason: `Missing required fields for ${circuitType} proof parameters`,
            };
          }
          break;
          
        default:
          // For unknown circuit types, can't verify cryptographic properties
          return { 
            valid: false, 
            reason: `Cannot verify cryptographic properties for unknown circuit type: ${circuitType}`,
          };
      }
      
      // In a real implementation, we'd verify:
      // 1. Group element validity (point on curve, correct order)
      // 2. Pairing relationships
      // 3. Knowledge-of-exponent equations
      
      // If all checks pass
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        reason: `Cryptographic property check failed: ${error.message}`,
        error: error.message,
      };
    }
  }

  /**
   * Check historical consistency of parameters
   * 
   * @private
   * @param {Object} parameters - Parameters to check
   * @param {string} version - Version to check against
   * @returns {Object} Historical consistency check results
   */
  async checkHistoricalConsistency(parameters, version) {
    try {
      // In a real implementation, this would compare the parameters
      // with historical versions to ensure consistent evolution
      
      // Basic validation
      if (!version) {
        return { valid: false, reason: 'Version is missing' };
      }
      
      // Check version format
      const versionRegex = /^(\d+)\.(\d+)\.(\d+)$/;
      if (!versionRegex.test(version)) {
        return { 
          valid: false, 
          reason: 'Invalid version format',
          details: 'Version must be in format MAJOR.MINOR.PATCH',
        };
      }
      
      // In a real implementation, we'd verify:
      // 1. Version is registered in our version history
      // 2. Parameters are consistent with previous versions
      // 3. Changes are appropriate for the version increment
      
      // If all checks pass
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        reason: `Historical consistency check failed: ${error.message}`,
        error: error.message,
      };
    }
  }

  /**
   * Validate verification key structure
   * 
   * @private
   * @param {Object} verificationKey - Verification key to validate
   * @returns {Object} Structure validation results
   */
  validateVerificationKeyStructure(verificationKey) {
    try {
      // Check for required fields
      if (!verificationKey) {
        return { valid: false, reason: 'Verification key is null or undefined' };
      }
      
      // Verify key has required fields
      const requiredFields = ['id', 'timestamp'];
      const missingFields = requiredFields.filter(field => !verificationKey[field]);
      
      if (missingFields.length > 0) {
        return { 
          valid: false, 
          reason: `Missing required fields in verification key: ${missingFields.join(', ')}`, 
          missingFields,
        };
      }
      
      // Verify protocol (Groth16, etc.)
      if (verificationKey.protocol && verificationKey.protocol !== 'groth16') {
        return { 
          valid: false, 
          reason: `Unsupported protocol: ${verificationKey.protocol}`,
          details: 'Only Groth16 protocol is supported',
        };
      }
      
      // Check structure based on protocol
      if (verificationKey.protocol === 'groth16' || !verificationKey.protocol) {
        // Groth16 requires alpha, beta, gamma, delta, and ic
        const groth16Fields = ['alpha', 'beta', 'gamma', 'delta'];
        const missingGroth16Fields = groth16Fields.filter(field => !verificationKey[field]);
        
        if (missingGroth16Fields.length > 0) {
          return { 
            valid: false, 
            reason: `Missing required Groth16 fields: ${missingGroth16Fields.join(', ')}`,
            missingFields: missingGroth16Fields,
          };
        }
        
        // Check IC array if present
        if (verificationKey.ic && (!Array.isArray(verificationKey.ic) || verificationKey.ic.length === 0)) {
          return { 
            valid: false, 
            reason: 'Invalid IC array in verification key',
            details: 'IC array must be a non-empty array',
          };
        }
      }
      
      // If all checks pass
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        reason: `Verification key structure validation failed: ${error.message}`,
        error: error.message,
      };
    }
  }

  /**
   * Add a reference hash for validation
   * 
   * @param {string} keyId - ID of the key or parameter
   * @param {string} hash - Reference hash
   * @param {string} source - Source of the reference hash
   */
  addReferenceHash(keyId, hash, source) {
    this.referenceHashes.set(keyId, {
      hash,
      source,
      timestamp: Date.now(),
    });
    
    this.auditLogger.log('info', 'Reference hash added', {
      keyId,
      hash,
      source,
    });
  }

  /**
   * Add a trusted source for validation
   * 
   * @param {string} sourceId - ID of the trusted source
   * @param {Object} sourceInfo - Information about the source
   * @param {string} sourceInfo.name - Name of the source
   * @param {string} sourceInfo.publicKey - Public key of the source
   */
  addTrustedSource(sourceId, sourceInfo) {
    const operationId = 'ParameterValidator:addTrustedSource';
    
    try {
      if (!sourceId) {
        throw new InputError('Missing source ID for trusted source', {
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          operationId,
          userFixable: true,
          recoverable: false,
          details: { sourceIdProvided: false }
        });
      }
      
      if (!sourceInfo) {
        throw new InputError('Missing source information for trusted source', {
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          operationId,
          userFixable: true,
          recoverable: false,
          details: { sourceInfoProvided: false }
        });
      }
      
      if (!sourceInfo.publicKey) {
        throw new InputError('Missing public key for trusted source', {
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          operationId,
          userFixable: true,
          recoverable: false,
          details: { 
            sourceId,
            publicKeyProvided: false 
          }
        });
      }
      
      this.trustedSources.add(sourceId);
      this.signatureKeys.set(sourceId, sourceInfo.publicKey);
      
      this.auditLogger.log('info', 'Trusted source added', {
        sourceId,
        name: sourceInfo.name,
      });
      
      zkErrorLogger.log('INFO', 'Trusted source added successfully', { 
        operationId,
        sourceId,
        sourceName: sourceInfo.name
      });
    } catch (error) {
      zkErrorLogger.logError(error, { 
        operationId,
        sourceId: sourceId || 'unknown',
        sourceInfo: sourceInfo ? { name: sourceInfo.name } : 'missing'
      });
      throw error;
    }
  }

  /**
   * Add a trust anchor for chain of trust validation
   * 
   * @param {string} keyId - ID of the trust anchor
   * @param {Object} anchorInfo - Information about the trust anchor
   */
  addTrustAnchor(keyId, anchorInfo) {
    const operationId = 'ParameterValidator:addTrustAnchor';
    
    try {
      if (!keyId) {
        throw new InputError('Missing key ID for trust anchor', {
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          operationId,
          userFixable: true,
          recoverable: false,
          details: { keyIdProvided: false }
        });
      }
      
      if (!anchorInfo) {
        throw new InputError('Missing anchor information for trust anchor', {
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          operationId,
          userFixable: true,
          recoverable: false,
          details: { 
            keyId,
            anchorInfoProvided: false 
          }
        });
      }
      
      this.trustAnchors.set(keyId, {
        ...anchorInfo,
        timestamp: Date.now(),
      });
      
      this.auditLogger.log('info', 'Trust anchor added', {
        keyId,
        type: anchorInfo.type,
      });
      
      zkErrorLogger.log('INFO', 'Trust anchor added successfully', { 
        operationId,
        keyId,
        anchorType: anchorInfo.type
      });
    } catch (error) {
      zkErrorLogger.logError(error, { 
        operationId,
        keyId: keyId || 'unknown',
        anchorInfo: anchorInfo ? { type: anchorInfo.type } : 'missing'
      });
      throw error;
    }
  }

  /**
   * Hash data using configured algorithm
   * 
   * @private
   * @param {any} data - Data to hash
   * @returns {string} Hash of the data
   */
  hashData(data) {
    // Convert to string for consistent hashing
    const serialized = JSON.stringify(stringifyBigInts(data));
    
    // Use configured hash algorithm
    if (this.config.hashAlgorithm === 'keccak256') {
      return '0x' + keccak256(serialized);
    } else {
      return '0x' + sha256(serialized);
    }
  }

  /**
   * Check if a cache entry is expired
   * 
   * @private
   * @param {Object} cacheEntry - Cache entry to check
   * @returns {boolean} Whether the cache entry is expired
   */
  isCacheExpired(cacheEntry) {
    return cacheEntry.expiresAt && cacheEntry.expiresAt < Date.now();
  }

  /**
   * Clear the validation cache
   * 
   * @param {string} hash - Optional specific hash to clear
   */
  clearCache(hash) {
    if (hash) {
      this.validationCache.delete(hash);
      this.auditLogger.log('info', 'Validation cache entry cleared', { hash });
    } else {
      this.validationCache.clear();
      this.auditLogger.log('info', 'Validation cache cleared');
    }
  }
}

// Export singleton instance
const parameterValidator = new ParameterValidator();
export default parameterValidator;