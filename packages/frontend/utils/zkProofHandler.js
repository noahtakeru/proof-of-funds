/**
 * Unified ZK Proof Handler
 * 
 * This module provides a unified API handler for ZK proof generation with
 * different storage strategies and validation.
 */

// Use local shim for better compatibility with Pages Router
import {
  validateApiRequest,
  validators,
  createZkError,
  handleApiError,
  ZkErrorType
} from './shims/error-handling';
import { createProofStrategy } from './zkProofStrategies';

/**
 * Rate limiter factory function
 * @param {number} limit - The rate limit per minute
 * @param {string} limiterType - The rate limiter type to use (memory or redis)
 * @returns {Function} - Rate limiter middleware function
 */
function getRateLimiter(limit = 3, limiterType = 'memory') {
  try {
    // Only use Redis in server environment
    const isServerSide = typeof window === 'undefined';
    
    // Always use in-memory limiter for browser code
    if (!isServerSide) {
      const rateLimiter = require('../lib/rateLimit').default;
      return rateLimiter(limit);
    }
    
    // For server-side, use appropriate limiter based on type
    if (limiterType === 'redis' && process.env.REDIS_URL) {
      try {
        // Import our local copy of the distributed rate limiter
        // This is properly compatible with our error handling shim
        const path = require('path');
        // Use Node.js dynamic require to avoid webpack issues
        const distributedRateLimitPath = path.resolve(__dirname, '../lib/distributedRateLimit.js');
        const createDistributedRateLimiter = require(distributedRateLimitPath);
        
        return createDistributedRateLimiter({ 
          type: 'redis',
          redisUrl: process.env.REDIS_URL
        })(limit, 'zk-proof');
      } catch (redisError) {
        console.warn('Redis rate limiter initialization failed, using memory limiter:', redisError.message);
        const rateLimiter = require('../lib/rateLimit').default;
        return rateLimiter(limit);
      }
    } else {
      // Use in-memory limiter
      const rateLimiter = require('../lib/rateLimit').default;
      return rateLimiter(limit);
    }
  } catch (error) {
    console.error('Failed to initialize rate limiter:', error);
    // Use the standard in-memory rate limiter as a fallback
    const rateLimiter = require('../lib/rateLimit').default;
    return rateLimiter(limit);
  }
}

/**
 * Generate input validation schema
 * @returns {Object} - Validation schema for proof generation input
 */
function getValidationSchema() {
  return {
    required: ['proofType', 'input'],
    fields: {
      proofType: [
        validators.isString,
        validators.isEnum(['standard', 'threshold', 'maximum'])
      ],
      input: [
        (value, fieldName, allValues) => {
          if (typeof value !== 'object' || value === null) {
            return {
              isValid: false,
              error: 'invalid_object',
              message: `The field '${fieldName}' must be an object`
            };
          }
          
          // Determine required fields based on proof type
          let requiredFields = ['userAddress']; // Common required field
          
          // Add proof-type specific required fields
          const proofType = allValues.proofType;
          if (proofType === 'threshold') {
            // For threshold proofs, require either totalBalance or balance, plus threshold and networkId
            if (value.totalBalance === undefined && value.balance === undefined) {
              return {
                isValid: false,
                error: 'missing_field',
                message: `Either '${fieldName}.totalBalance' or '${fieldName}.balance' is required for threshold proofs`
              };
            }
            
            if (value.threshold === undefined) {
              return {
                isValid: false,
                error: 'missing_field',
                message: `The field '${fieldName}.threshold' is required for threshold proofs`
              };
            }
            
            if (value.networkId === undefined) {
              return {
                isValid: false,
                error: 'missing_field',
                message: `The field '${fieldName}.networkId' is required for threshold proofs`
              };
            }
          } 
          else if (proofType === 'maximum') {
            // For maximum proofs, require either maxBalance or balance, plus threshold
            if (value.maxBalance === undefined && value.balance === undefined) {
              return {
                isValid: false,
                error: 'missing_field',
                message: `Either '${fieldName}.maxBalance' or '${fieldName}.balance' is required for maximum proofs`
              };
            }
            
            if (value.threshold === undefined) {
              return {
                isValid: false,
                error: 'missing_field',
                message: `The field '${fieldName}.threshold' is required for maximum proofs`
              };
            }
            
            // For maximum proofs, require either networks array or a single networkId
            if (value.networks === undefined && value.networkId === undefined) {
              return {
                isValid: false,
                error: 'missing_field',
                message: `Either '${fieldName}.networks' or '${fieldName}.networkId' is required for maximum proofs`
              };
            }
            
            // If networks is provided, validate it's an array with at least one element
            if (value.networks !== undefined && (!Array.isArray(value.networks) || value.networks.length === 0)) {
              return {
                isValid: false,
                error: 'invalid_field',
                message: `The field '${fieldName}.networks' must be a non-empty array for maximum proofs`
              };
            }
          }
          else {
            // For standard proofs, require balance
            requiredFields.push('balance');
          }
          
          // Check the common required fields
          for (const field of requiredFields) {
            if (value[field] === undefined) {
              return {
                isValid: false,
                error: 'missing_field',
                message: `The field '${fieldName}.${field}' is required for ${proofType} proofs`
              };
            }
          }
          
          return { isValid: true };
        }
      ],
      // Optional strategy parameter
      strategy: [
        value => value === undefined || validators.isEnum(['public', 'secure', 'cloud'])(value)
      ]
    }
  };
}

/**
 * Create a unified ZK proof generation handler
 * @param {Object} options - Handler options
 * @param {string} options.defaultStrategy - Default strategy to use ('public', 'secure', 'cloud')
 * @param {number} options.rateLimit - Rate limit per minute (0 to disable)
 * @param {boolean} options.verifyProof - Whether to verify proofs after generation
 * @returns {Function} - Next.js API route handler
 */
export function createZkProofHandler(options = {}) {
  const {
    defaultStrategy = 'secure',
    rateLimit = 3,
    verifyProof = true,
    rateLimiterType = process.env.RATE_LIMITER_TYPE || 'memory'
  } = options;
  
  /**
 * Verifies the security of circuit inputs to prevent attacks
 * @param {Object} input - The circuit input values
 * @param {string} proofType - The type of proof being created
 * @throws {Error} If any security checks fail
 */
function verifyInputSecurity(input, proofType) {
  // Ensure all required fields are present for the proof type
  const requiredFields = {
    'standard': ['balance', 'threshold', 'userAddress'],
    'threshold': ['totalBalance', 'threshold', 'userAddress', 'networkId'],
    'maximum': ['maxBalance', 'threshold', 'userAddress', 'networks']
  };
  
  const fieldsToCheck = requiredFields[proofType] || [];
  for (const field of fieldsToCheck) {
    if (input[field] === undefined) {
      throw createZkError(`Security validation failed: Missing required field '${field}' for ${proofType} proof`, {
        zkErrorType: ZkErrorType.SECURITY_ERROR,
        details: { 
          missingField: field,
          proofType
        }
      });
    }
  }
  
  // Ensure address is a valid Ethereum address
  if (!/^0x[0-9a-fA-F]{40}$/.test(input.userAddress)) {
    throw createZkError('Security validation failed: Invalid Ethereum address format', {
      zkErrorType: ZkErrorType.SECURITY_ERROR,
      details: { field: 'userAddress' }
    });
  }
  
  // Verify numeric values are properly formatted and reasonable
  for (const field of ['balance', 'totalBalance', 'threshold', 'maxBalance', 'networkId']) {
    if (input[field] !== undefined) {
      // If it's a number field, ensure it's a valid numeric string
      const value = String(input[field]);
      if (!/^[0-9]+$/.test(value)) {
        throw createZkError(`Security validation failed: Field '${field}' must be a numeric string`, {
          zkErrorType: ZkErrorType.SECURITY_ERROR,
          details: { field, providedValue: typeof input[field] }
        });
      }
      
      // Check for reasonable limits to prevent overflow attacks
      // BigInt safely handles numbers of any size
      try {
        const valueBigInt = BigInt(value);
        // Circom number max is 2^253 - 1
        const maxValue = (1n << 253n) - 1n;
        if (valueBigInt < 0n || valueBigInt > maxValue) {
          throw createZkError(`Security validation failed: Value for '${field}' is outside safe range`, {
            zkErrorType: ZkErrorType.SECURITY_ERROR,
            details: { field, outOfRange: true }
          });
        }
      } catch (error) {
        throw createZkError(`Security validation failed: Invalid numeric value for '${field}'`, {
          zkErrorType: ZkErrorType.SECURITY_ERROR,
          details: { field, error: error.message }
        });
      }
    }
  }
  
  // For maximum proof, verify networks array
  if (proofType === 'maximum' && input.networks) {
    if (!Array.isArray(input.networks)) {
      throw createZkError('Security validation failed: networks must be an array', {
        zkErrorType: ZkErrorType.SECURITY_ERROR,
        details: { field: 'networks' }
      });
    }
    
    // Check each network ID in the array
    for (let i = 0; i < input.networks.length; i++) {
      const networkId = input.networks[i];
      if (typeof networkId !== 'number' && (typeof networkId !== 'string' || !/^[0-9]+$/.test(networkId))) {
        throw createZkError(`Security validation failed: Invalid network ID at index ${i}`, {
          zkErrorType: ZkErrorType.SECURITY_ERROR,
          details: { field: 'networks', index: i }
        });
      }
    }
  }
}

// Create rate limiter if enabled
  const applyRateLimit = rateLimit > 0 ? getRateLimiter(rateLimit, rateLimiterType) : null;
  
  /**
   * Next.js API route handler for ZK proof generation
   * @param {Object} req - Next.js request object
   * @param {Object} res - Next.js response object
   */
  return async function handler(req, res) {
    // Apply rate limiting if enabled
    if (applyRateLimit) {
      const rateLimitResult = applyRateLimit(req, res);
      if (!rateLimitResult) {
        // If rate limit is exceeded, response has already been sent
        return;
      }
    }
    
    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // Create a strategy instance
    let proofStrategy = null;
    
    try {
      // Validate request body
      const validation = validateApiRequest(req.body, getValidationSchema());
      
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Invalid input parameters',
          details: validation.errors
        });
      }
      
      // Extract validated data
      const { 
        proofType, 
        input,
        strategy = defaultStrategy
      } = validation.sanitizedData;
      
      // Create appropriate strategy
      proofStrategy = createProofStrategy(strategy);
      
      // Initialize strategy
      await proofStrategy.initialize();
      
      // Get ZK circuit paths from strategy
      const wasmPath = await proofStrategy.getWasmPath(proofType);
      const zkeyData = await proofStrategy.getZKeyData(proofType);
      
      // Standardize input for the circuit based on proof type
      // Each circuit type requires specific inputs as defined in their .circom files
      let circuitInput;

      // Using specific field names required by each circuit
      if (proofType === 'threshold') {
        // thresholdProof.circom requires: totalBalance, threshold, userAddress, networkId
        
        // Require explicit networkId for security - no defaults
        if (input.networkId === undefined) {
          throw createZkError("Missing required networkId for threshold proof", {
            zkErrorType: ZkErrorType.VALIDATION_ERROR,
            details: { 
              missingField: "networkId",
              proofType: "threshold"
            }
          });
        }
        
        circuitInput = {
          totalBalance: input.totalBalance || input.balance, // Accept both field names
          threshold: input.threshold,
          userAddress: input.userAddress,
          networkId: input.networkId
        };
      } else if (proofType === 'maximum') {
        // maximumProof.circom requires: maxBalance, threshold, userAddress, networks
        
        // Require at least one network ID for security
        if (input.networkId === undefined && (!input.networks || !input.networks.length)) {
          throw createZkError("Missing required network information for maximum proof", {
            zkErrorType: ZkErrorType.VALIDATION_ERROR,
            details: { 
              missingField: "networkId or networks",
              proofType: "maximum"
            }
          });
        }
        
        circuitInput = {
          maxBalance: input.maxBalance || input.balance,
          threshold: input.threshold,
          userAddress: input.userAddress,
          networks: input.networks || [input.networkId, 0, 0, 0] // Use provided networkId, no defaults
        };
      } else {
        // standardProof.circom requires: balance, threshold, userAddress
        circuitInput = {
          balance: input.balance,
          threshold: input.threshold || '0',
          userAddress: input.userAddress
        };
      }
      
      // Dynamically import snarkjs
      const snarkjs = require('snarkjs');
      
      // Generate the proof
      console.log("Generating proof with input:", JSON.stringify(circuitInput));
      console.log("WASM path:", wasmPath);
      
      // Final security verification of inputs
      // These checks prevent potential security issues with malformed inputs
      verifyInputSecurity(circuitInput, proofType);
      console.log("Using zkeyData:", typeof zkeyData === 'string' ? zkeyData : 'Buffer or data object');
      
      let proofResult;
      try {
        // Following security assessment rules - no fallbacks, expose real failures
        proofResult = await snarkjs.groth16.fullProve(
          circuitInput,
          wasmPath,
          zkeyData
        );
      } catch (zkError) {
        // Check for common proof-specific errors and provide more details
        if (zkError.message && zkError.message.includes("Signal not found")) {
          // Signal not found errors typically indicate a mismatch between circuit input parameters and provided values
          // Provide a secure error message without exposing full paths
          
          // Create a secure mapping of required inputs for each proof type
          const requiredInputs = {
            'standard': ['balance', 'threshold', 'userAddress'],
            'threshold': ['totalBalance', 'threshold', 'userAddress', 'networkId'],
            'maximum': ['maxBalance', 'threshold', 'userAddress', 'networks']
          };
          
          // Compare provided inputs with required inputs
          const required = requiredInputs[proofType] || [];
          const provided = Object.keys(circuitInput);
          const missing = required.filter(key => !provided.includes(key));
          
          throw createZkError(`Circuit input mismatch: Signal not found for ${proofType} proof. Ensure all required fields are provided.`, {
            zkErrorType: ZkErrorType.CIRCUIT_ERROR,
            details: { 
              providedFields: provided,
              requiredFields: required,
              missingFields: missing.length > 0 ? missing : undefined,
              proofType
            }
          });
        }
        // Simply rethrow other errors without masking them, per security assessment guidelines
        throw zkError;
      }
      
      console.log("Proof generated successfully");
      console.log("Proof structure:", JSON.stringify(proofResult.proof));
      console.log("Public signals:", JSON.stringify(proofResult.publicSignals));
      
      const { proof, publicSignals } = proofResult;
      
      let verified = null;
      
      // Verify the proof if requested
      if (verifyProof) {
        const vKey = await proofStrategy.getVerificationKey(proofType);
        verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);
      }
      
      // Clean up strategy resources
      if (proofStrategy.cleanup) {
        await proofStrategy.cleanup();
      }
      
      // Prepare response
      const response = {
        success: true,
        proofType,
        proof,
        publicSignals
      };
      
      // Add verification result if available
      if (verified !== null) {
        response.verified = verified;
      }
      
      return res.status(200).json(response);
    } catch (error) {
      // Clean up strategy resources if available
      if (proofStrategy && proofStrategy.cleanup) {
        try {
          await proofStrategy.cleanup();
        } catch (cleanupError) {
          console.error('Error cleaning up strategy:', cleanupError);
        }
      }
      
      // Add context to error
      error.details = {
        ...(error.details || {}),
        component: 'zkProofHandler',
        operation: 'generate_proof',
        proofType: req.body?.proofType
      };
      
      // Handle error with unified error handling
      return handleApiError(error, res);
    }
  };
}

export default createZkProofHandler;