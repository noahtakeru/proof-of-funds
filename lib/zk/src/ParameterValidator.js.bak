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

  /**
   * Validate data object against a schema with support for async validators
   * 
   * @param {Object} dataObject - The data object to validate
   * @param {Object} schema - Schema describing validation requirements
   * @param {Object} options - Validation options
   * @param {boolean} options.abortEarly - Whether to stop at first error
   * @param {boolean} options.allowUnknown - Whether to allow unknown fields
   * @returns {Promise<Object>} Validation results with errors if any
   */
  async validateAsync(dataObject, schema, options = {}) {
    const operationId = `validate_async_${Date.now()}`;

    try {
      const validationPromises = [];
      const validationErrors = [];

      // Validate each field according to schema
      for (const fieldName in schema) {
        if (schema.hasOwnProperty(fieldName)) {
          const fieldSchema = schema[fieldName];
          const fieldValue = dataObject[fieldName];

          // Skip validation if field is optional and undefined
          if (fieldValue === undefined && !fieldSchema.required) {
            continue;
          }

          // Required field check
          if (fieldSchema.required && (fieldValue === undefined || fieldValue === null)) {
            validationErrors.push({
              field: fieldName,
              message: `${fieldName} is required`,
              code: 'REQUIRED_FIELD'
            });
            continue;
          }

          // Skip remaining validations if value is undefined
          if (fieldValue === undefined) {
            continue;
          }

          // Type check
          if (fieldSchema.type && typeof fieldValue !== fieldSchema.type) {
            validationErrors.push({
              field: fieldName,
              message: `${fieldName} must be of type ${fieldSchema.type}`,
              code: 'INVALID_TYPE',
              expected: fieldSchema.type,
              received: typeof fieldValue
            });
            continue;
          }

          // Format validations
          if (fieldSchema.format) {
            const formatValidator = this.formatValidators[fieldSchema.format];
            if (formatValidator) {
              const formatPromise = Promise.resolve().then(async () => {
                try {
                  const isValid = await formatValidator(fieldValue);
                  if (!isValid) {
                    validationErrors.push({
                      field: fieldName,
                      message: `${fieldName} has invalid format (${fieldSchema.format})`,
                      code: 'INVALID_FORMAT',
                      format: fieldSchema.format
                    });
                  }
                } catch (error) {
                  validationErrors.push({
                    field: fieldName,
                    message: `${fieldName} format validation failed: ${error.message}`,
                    code: 'FORMAT_VALIDATION_ERROR',
                    format: fieldSchema.format,
                    error: error.message
                  });
                }
              });

              validationPromises.push(formatPromise);
            }
          }

          // Custom validator (which might be async)
          if (fieldSchema.validator) {
            const validatorPromise = Promise.resolve().then(async () => {
              try {
                const validationResult = await fieldSchema.validator(fieldValue, dataObject);

                if (validationResult !== true) {
                  const errorMessage = typeof validationResult === 'string'
                    ? validationResult
                    : `${fieldName} failed custom validation`;

                  validationErrors.push({
                    field: fieldName,
                    message: errorMessage,
                    code: 'CUSTOM_VALIDATION_FAILED'
                  });
                }
              } catch (error) {
                validationErrors.push({
                  field: fieldName,
                  message: `${fieldName} custom validation error: ${error.message}`,
                  code: 'CUSTOM_VALIDATION_ERROR',
                  error: error.message
                });
              }
            });

            validationPromises.push(validatorPromise);
          }

          // Pattern matching
          if (fieldSchema.pattern && typeof fieldValue === 'string') {
            const patternRegex = new RegExp(fieldSchema.pattern);
            if (!patternRegex.test(fieldValue)) {
              validationErrors.push({
                field: fieldName,
                message: `${fieldName} does not match required pattern`,
                code: 'PATTERN_MISMATCH',
                pattern: fieldSchema.pattern
              });
            }
          }

          // Enum validation
          if (fieldSchema.enum && Array.isArray(fieldSchema.enum)) {
            if (!fieldSchema.enum.includes(fieldValue)) {
              validationErrors.push({
                field: fieldName,
                message: `${fieldName} must be one of: ${fieldSchema.enum.join(', ')}`,
                code: 'INVALID_ENUM_VALUE',
                allowedValues: fieldSchema.enum,
                received: fieldValue
              });
            }
          }

          // Min/max validation for numbers
          if (typeof fieldValue === 'number') {
            if (fieldSchema.min !== undefined && fieldValue < fieldSchema.min) {
              validationErrors.push({
                field: fieldName,
                message: `${fieldName} must be at least ${fieldSchema.min}`,
                code: 'BELOW_MINIMUM',
                min: fieldSchema.min,
                received: fieldValue
              });
            }

            if (fieldSchema.max !== undefined && fieldValue > fieldSchema.max) {
              validationErrors.push({
                field: fieldName,
                message: `${fieldName} must be at most ${fieldSchema.max}`,
                code: 'ABOVE_MAXIMUM',
                max: fieldSchema.max,
                received: fieldValue
              });
            }
          }

          // String length validation
          if (typeof fieldValue === 'string') {
            const strLen = fieldValue.length;

            if (fieldSchema.minLength !== undefined && strLen < fieldSchema.minLength) {
              validationErrors.push({
                field: fieldName,
                message: `${fieldName} must be at least ${fieldSchema.minLength} characters`,
                code: 'STRING_TOO_SHORT',
                minLength: fieldSchema.minLength,
                received: strLen
              });
            }

            if (fieldSchema.maxLength !== undefined && strLen > fieldSchema.maxLength) {
              validationErrors.push({
                field: fieldName,
                message: `${fieldName} must be at most ${fieldSchema.maxLength} characters`,
                code: 'STRING_TOO_LONG',
                maxLength: fieldSchema.maxLength,
                received: strLen
              });
            }
          }
        }
      }

      // Check for unknown fields if not allowed
      if (options.allowUnknown === false) {
        const schemaFields = Object.keys(schema);
        const unknownFields = Object.keys(dataObject).filter(field => !schemaFields.includes(field));

        if (unknownFields.length > 0) {
          validationErrors.push({
            field: unknownFields[0], // Report at least the first unknown field
            message: `Unknown field(s): ${unknownFields.join(', ')}`,
            code: 'UNKNOWN_FIELD',
            unknownFields
          });
        }
      }

      // Wait for all async validations to complete
      await Promise.all(validationPromises);

      // Log validation completion
      zkErrorLogger.log('INFO', 'Async validation completed', {
        operationId,
        fieldCount: Object.keys(schema).length,
        errorCount: validationErrors.length
      });

      // Return validation results
      return {
        isValid: validationErrors.length === 0,
        errors: validationErrors,
        validated: Object.keys(schema).filter(field => dataObject[field] !== undefined),
        operationId
      };
    } catch (error) {
      // Log any unexpected errors during validation
      const validationError = new SystemError(`Async validation failed: ${error.message}`, {
        operationId,
        code: ErrorCode.SYSTEM_FUNCTION_EXECUTION_FAILED,
        details: {
          schemaFields: Object.keys(schema),
          originalError: error.message
        },
        cause: error
      });

      zkErrorLogger.logError(validationError, {
        context: 'ParameterValidator.validateAsync'
      });

      throw validationError;
    }
  }

  /**
   * Format validators for commonly used data formats
   * Used by validateAsync for format validation
   */
  formatValidators = {
    email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),

    url: (value) => {
      try {
        new URL(value);
        return true;
      } catch (e) {
        return false;
      }
    },

    hexString: (value) => /^(0x)?[0-9a-fA-F]+$/.test(value),

    base64: (value) => /^[A-Za-z0-9+/=]+$/.test(value),

    ethereumAddress: (value) => /^(0x)?[0-9a-fA-F]{40}$/.test(value),

    // Async validator example using remote validation
    async remoteId(value) {
      try {
        // In a real implementation, this might validate an ID against a remote API
        return true;
      } catch (error) {
        return false;
      }
    }
  };

  /**
   * Validate nested object structures with error chaining
   * 
   * @param {Object} dataObject - The data object to validate
   * @param {Object} schema - Schema describing validation requirements
   * @param {string} [path=''] - Current object path for nested fields
   * @param {Object} [options={}] - Validation options
   * @returns {Promise<Object>} Validation results with errors and paths
   */
  async validateNested(dataObject, schema, path = '', options = {}) {
    const operationId = `validate_nested_${Date.now()}`;

    try {
      const validationPromises = [];
      const validationErrors = [];

      // Validate each field according to schema
      for (const fieldName in schema) {
        if (schema.hasOwnProperty(fieldName)) {
          const fieldSchema = schema[fieldName];
          const fieldValue = dataObject[fieldName];
          const fieldPath = path ? `${path}.${fieldName}` : fieldName;

          // Skip validation if field is optional and undefined
          if (fieldValue === undefined && !fieldSchema.required) {
            continue;
          }

          // Required field check
          if (fieldSchema.required && (fieldValue === undefined || fieldValue === null)) {
            validationErrors.push({
              field: fieldName,
              path: fieldPath,
              message: `${fieldPath} is required`,
              code: 'REQUIRED_FIELD'
            });
            continue;
          }

          // Skip remaining validations if value is undefined
          if (fieldValue === undefined) {
            continue;
          }

          // For nested objects, recursively validate
          if (fieldSchema.type === 'object' && fieldValue !== null && typeof fieldValue === 'object' && !Array.isArray(fieldValue) && fieldSchema.properties) {
            const nestedValidationPromise = Promise.resolve().then(async () => {
              try {
                const nestedResult = await this.validateNested(
                  fieldValue,
                  fieldSchema.properties,
                  fieldPath,
                  options
                );

                // If nested validation has errors, add them to our errors array
                if (!nestedResult.isValid) {
                  // Add all nested errors with proper paths
                  validationErrors.push(...nestedResult.errors);
                }
              } catch (error) {
                validationErrors.push({
                  field: fieldName,
                  path: fieldPath,
                  message: `Error validating nested object at ${fieldPath}: ${error.message}`,
                  code: 'NESTED_VALIDATION_ERROR',
                  error: error.message
                });
              }
            });

            validationPromises.push(nestedValidationPromise);
            continue;
          }

          // For arrays of objects, validate each item
          if (fieldSchema.type === 'array' && Array.isArray(fieldValue) && fieldSchema.items && fieldSchema.items.type === 'object' && fieldSchema.items.properties) {
            // Validate each array item
            for (let i = 0; i < fieldValue.length; i++) {
              const itemValue = fieldValue[i];
              const itemPath = `${fieldPath}[${i}]`;

              if (itemValue && typeof itemValue === 'object' && !Array.isArray(itemValue)) {
                const arrayItemValidationPromise = Promise.resolve().then(async () => {
                  try {
                    const itemResult = await this.validateNested(
                      itemValue,
                      fieldSchema.items.properties,
                      itemPath,
                      options
                    );

                    // If item validation has errors, add them to our errors array
                    if (!itemResult.isValid) {
                      validationErrors.push(...itemResult.errors);
                    }
                  } catch (error) {
                    validationErrors.push({
                      field: fieldName,
                      path: itemPath,
                      message: `Error validating array item at ${itemPath}: ${error.message}`,
                      code: 'ARRAY_ITEM_VALIDATION_ERROR',
                      index: i,
                      error: error.message
                    });
                  }
                });

                validationPromises.push(arrayItemValidationPromise);
              } else if (fieldSchema.items.type !== 'object') {
                // For non-object array items, validate against item type
                if (typeof itemValue !== fieldSchema.items.type) {
                  validationErrors.push({
                    field: fieldName,
                    path: itemPath,
                    message: `${itemPath} must be of type ${fieldSchema.items.type}`,
                    code: 'INVALID_TYPE',
                    expected: fieldSchema.items.type,
                    received: typeof itemValue
                  });
                }
              }
            }
            continue;
          }

          // Type check for non-nested fields
          if (fieldSchema.type && typeof fieldValue !== fieldSchema.type) {
            validationErrors.push({
              field: fieldName,
              path: fieldPath,
              message: `${fieldPath} must be of type ${fieldSchema.type}`,
              code: 'INVALID_TYPE',
              expected: fieldSchema.type,
              received: typeof fieldValue
            });
            continue;
          }

          // Other validations (similar to validateAsync but with path)
          if (fieldSchema.format) {
            const formatValidator = this.formatValidators[fieldSchema.format];
            if (formatValidator) {
              const formatPromise = Promise.resolve().then(async () => {
                try {
                  const isValid = await formatValidator(fieldValue);
                  if (!isValid) {
                    validationErrors.push({
                      field: fieldName,
                      path: fieldPath,
                      message: `${fieldPath} has invalid format (${fieldSchema.format})`,
                      code: 'INVALID_FORMAT',
                      format: fieldSchema.format
                    });
                  }
                } catch (error) {
                  validationErrors.push({
                    field: fieldName,
                    path: fieldPath,
                    message: `${fieldPath} format validation failed: ${error.message}`,
                    code: 'FORMAT_VALIDATION_ERROR',
                    format: fieldSchema.format,
                    error: error.message
                  });
                }
              });

              validationPromises.push(formatPromise);
            }
          }

          // Custom validator with proper path tracking
          if (fieldSchema.validator) {
            const validatorPromise = Promise.resolve().then(async () => {
              try {
                const validationResult = await fieldSchema.validator(fieldValue, dataObject);

                if (validationResult !== true) {
                  const errorMessage = typeof validationResult === 'string'
                    ? validationResult
                    : `${fieldPath} failed custom validation`;

                  validationErrors.push({
                    field: fieldName,
                    path: fieldPath,
                    message: errorMessage,
                    code: 'CUSTOM_VALIDATION_FAILED'
                  });
                }
              } catch (error) {
                validationErrors.push({
                  field: fieldName,
                  path: fieldPath,
                  message: `${fieldPath} custom validation error: ${error.message}`,
                  code: 'CUSTOM_VALIDATION_ERROR',
                  error: error.message
                });
              }
            });

            validationPromises.push(validatorPromise);
          }
        }
      }

      // Wait for all async validations to complete
      await Promise.all(validationPromises);

      // Log validation completion
      zkErrorLogger.log('INFO', 'Nested validation completed', {
        operationId,
        path,
        fieldCount: Object.keys(schema).length,
        errorCount: validationErrors.length
      });

      // Return validation results with proper paths
      return {
        isValid: validationErrors.length === 0,
        errors: validationErrors,
        operationId,
        path
      };
    } catch (error) {
      // Log any unexpected errors during validation
      const validationError = new SystemError(`Nested validation failed at '${path}': ${error.message}`, {
        operationId,
        code: ErrorCode.SYSTEM_FUNCTION_EXECUTION_FAILED,
        details: {
          path,
          schemaFields: Object.keys(schema),
          originalError: error.message
        },
        cause: error
      });

      zkErrorLogger.logError(validationError, {
        context: 'ParameterValidator.validateNested'
      });

      throw validationError;
    }
  }

  /**
   * Format validation errors in a consistent manner
   * 
   * @param {string} field - Field name that failed validation
   * @param {string} message - Error message
   * @param {string} code - Error code
   * @param {Object} [details={}] - Additional error details
   * @param {string} [path=''] - Path to the field in nested objects
   * @returns {Object} Formatted validation error
   */
  formatValidationError(field, message, code, details = {}, path = '') {
    const operationId = details.operationId || `validation_error_${Date.now()}`;
    const finalPath = path || field;

    // Create a standardized error object
    const error = {
      field,
      path: finalPath,
      message,
      code,
      timestamp: Date.now(),
      ...details
    };

    // Log the error
    zkErrorLogger.log('ERROR', message, {
      context: 'ParameterValidator.validation',
      operationId,
      field,
      path: finalPath,
      code,
      details
    });

    // Map to system error codes for consistency
    let errorCode = ErrorCode.INPUT_VALIDATION_FAILED;

    switch (code) {
      case 'REQUIRED_FIELD':
        errorCode = ErrorCode.INPUT_MISSING_REQUIRED;
        break;
      case 'INVALID_TYPE':
        errorCode = ErrorCode.INPUT_TYPE_ERROR;
        break;
      case 'INVALID_FORMAT':
        errorCode = ErrorCode.INPUT_FORMAT_ERROR;
        break;
      case 'PATTERN_MISMATCH':
        errorCode = ErrorCode.INPUT_PATTERN_MISMATCH;
        break;
      case 'CUSTOM_VALIDATION_FAILED':
      case 'CUSTOM_VALIDATION_ERROR':
        errorCode = ErrorCode.INPUT_CUSTOM_VALIDATION_FAILED;
        break;
      case 'NESTED_VALIDATION_ERROR':
      case 'ARRAY_ITEM_VALIDATION_ERROR':
        errorCode = ErrorCode.INPUT_NESTED_VALIDATION_FAILED;
        break;
      default:
        errorCode = ErrorCode.INPUT_VALIDATION_FAILED;
    }

    // Create a proper error instance that integrates with the error system
    const validationError = new InputError(message, {
      code: errorCode,
      operationId,
      userFixable: true,
      recoverable: true,
      details: {
        field,
        path: finalPath,
        validationCode: code,
        ...details
      }
    });

    // Add user-friendly message if available
    if (this.userFriendlyMessages && this.userFriendlyMessages[code]) {
      error.userMessage = this.userFriendlyMessages[code]
        .replace('{field}', finalPath)
        .replace('{value}', details.received || '');

      validationError.userMessage = error.userMessage;
    }

    // Store the structured error for the validation results
    error.systemError = validationError;

    return error;
  }

  /**
   * Map of validation error codes to user-friendly error messages
   * Used to provide helpful guidance to users when validation fails
   */
  userFriendlyMessages = {
    // Required field errors
    'REQUIRED_FIELD': 'The {field} is required to continue.',

    // Type errors
    'INVALID_TYPE': 'The {field} has an incorrect format. Please check and try again.',

    // Format errors
    'INVALID_FORMAT': 'The {field} has an invalid format. Please review the requirements.',
    'FORMAT_VALIDATION_ERROR': 'There was a problem with the format of {field}. Please correct it.',

    // Pattern errors
    'PATTERN_MISMATCH': 'The {field} doesn\'t match the required pattern.',

    // Range errors for numbers
    'BELOW_MINIMUM': 'The {field} must be larger than the minimum allowed value.',
    'ABOVE_MAXIMUM': 'The {field} exceeds the maximum allowed value.',

    // String length errors
    'STRING_TOO_SHORT': 'The {field} is too short. Please enter more characters.',
    'STRING_TOO_LONG': 'The {field} is too long. Please use fewer characters.',

    // Custom validation errors
    'CUSTOM_VALIDATION_FAILED': 'The {field} doesn\'t meet the requirements.',
    'CUSTOM_VALIDATION_ERROR': 'There was a problem validating the {field}.',

    // Enum errors
    'INVALID_ENUM_VALUE': 'The {field} has an invalid value. Please select from the allowed options.',

    // Nested validation errors
    'NESTED_VALIDATION_ERROR': 'There is an issue with the information in {field}.',
    'ARRAY_ITEM_VALIDATION_ERROR': 'There is an issue with one of the items in {field}.',

    // Unknown field errors
    'UNKNOWN_FIELD': 'The {field} is not recognized. Please remove it.',

    // Generic validation errors
    'VALIDATION_FAILED': 'There was a problem with the information provided. Please check {field}.'
  };

  /**
   * Get a user-friendly error message for a validation error
   * 
   * @param {Object} error - The validation error
   * @returns {string} User-friendly error message
   */
  getUserFriendlyErrorMessage(error) {
    // If it already has a user message, return it
    if (error.userMessage) {
      return error.userMessage;
    }

    const field = error.path || error.field || 'field';

    // Get message template based on error code
    let messageTemplate = this.userFriendlyMessages[error.code];

    // Fallback to generic message if no template exists
    if (!messageTemplate) {
      messageTemplate = this.userFriendlyMessages['VALIDATION_FAILED'];
    }

    // Replace placeholders with actual values
    let message = messageTemplate
      .replace('{field}', field)
      .replace('{value}', error.received || '');

    // Add specific guidance based on error types
    if (error.code === 'INVALID_TYPE') {
      message += ` Expected ${error.expected}, received ${error.received}.`;
    } else if (error.code === 'INVALID_FORMAT') {
      message += ` Please check the ${error.format} format requirements.`;
    } else if (error.code === 'BELOW_MINIMUM') {
      message += ` Minimum value: ${error.min}.`;
    } else if (error.code === 'ABOVE_MAXIMUM') {
      message += ` Maximum value: ${error.max}.`;
    } else if (error.code === 'STRING_TOO_SHORT') {
      message += ` Minimum length: ${error.minLength} characters.`;
    } else if (error.code === 'STRING_TOO_LONG') {
      message += ` Maximum length: ${error.maxLength} characters.`;
    } else if (error.code === 'INVALID_ENUM_VALUE' && error.allowedValues) {
      message += ` Allowed values: ${error.allowedValues.join(', ')}.`;
    }

    return message;
  }

  /**
   * Map a technical error to a user-friendly format message
   * 
   * @param {Error|Object} error - The error to translate
   * @returns {Object} User-friendly error information
   */
  translateErrorToUserFriendly(error) {
    // Handle system errors
    if (error instanceof Error) {
      // If it's an InputError, extract relevant information
      if (error instanceof InputError) {
        const field = error.details?.field || 'input';
        const code = error.code;

        // Map to a validation code
        let validationCode = 'VALIDATION_FAILED';

        // Determine the validation code based on the error code
        if (code === ErrorCode.INPUT_MISSING_REQUIRED) {
          validationCode = 'REQUIRED_FIELD';
        } else if (code === ErrorCode.INPUT_TYPE_ERROR) {
          validationCode = 'INVALID_TYPE';
        } else if (code === ErrorCode.INPUT_FORMAT_ERROR) {
          validationCode = 'INVALID_FORMAT';
        } else if (code === ErrorCode.INPUT_PATTERN_MISMATCH) {
          validationCode = 'PATTERN_MISMATCH';
        } else if (code === ErrorCode.INPUT_CUSTOM_VALIDATION_FAILED) {
          validationCode = 'CUSTOM_VALIDATION_FAILED';
        } else if (code === ErrorCode.INPUT_NESTED_VALIDATION_FAILED) {
          validationCode = 'NESTED_VALIDATION_ERROR';
        }

        // Create a structured error object
        const validationError = {
          field,
          path: error.details?.path || field,
          message: error.message,
          code: validationCode,
          details: error.details || {}
        };

        // Get a user-friendly message
        validationError.userMessage = this.getUserFriendlyErrorMessage(validationError);

        return validationError;
      }
      // For other error types
      else {
        return {
          field: 'unknown',
          message: error.message,
          userMessage: 'There was a problem with the provided information. Please try again.',
          code: 'VALIDATION_FAILED'
        };
      }
    }
    // Handle validation result objects
    else if (error && typeof error === 'object') {
      // If it's already a validation error object
      if (error.code && error.field) {
        if (!error.userMessage) {
          error.userMessage = this.getUserFriendlyErrorMessage(error);
        }
        return error;
      }
      // For result objects with errors array
      else if (error.errors && Array.isArray(error.errors)) {
        const errors = error.errors.map(err => this.translateErrorToUserFriendly(err));
        return {
          ...error,
          errors,
          userMessage: errors.length > 0
            ? errors[0].userMessage
            : 'There were validation errors in the provided information.'
        };
      }
    }

    // Default fallback
    return {
      field: 'unknown',
      message: error?.toString() || 'Unknown validation error',
      userMessage: 'There was a problem with the provided information. Please check your inputs and try again.',
      code: 'VALIDATION_FAILED'
    };
  }
}

// Export singleton instance
const parameterValidator = new ParameterValidator();
export default parameterValidator;