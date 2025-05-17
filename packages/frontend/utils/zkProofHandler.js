/**
 * Unified ZK Proof Handler
 * 
 * This module provides a unified API handler for ZK proof generation with
 * different storage strategies and validation.
 */

import {
  validateApiRequest,
  validators,
  createZkError,
  handleApiError
} from '@proof-of-funds/common/src/error-handling';
import { createProofStrategy } from './zkProofStrategies';

/**
 * Rate limiter factory function
 * @param {number} limit - The rate limit per minute
 * @param {string} limiterType - The rate limiter type to use (memory or redis)
 * @returns {Function} - Rate limiter middleware function
 */
function getRateLimiter(limit = 3, limiterType = 'memory') {
  try {
    // Use distributed rate limiter if redis type specified, otherwise fall back to in-memory
    if (limiterType === 'redis') {
      const createDistributedRateLimiter = require('../lib/distributedRateLimit');
      return createDistributedRateLimiter({ type: 'redis' })(limit, 'zk-proof');
    } else {
      const rateLimiter = require('../lib/rateLimit').default;
      return rateLimiter(limit);
    }
  } catch (error) {
    console.error('Failed to initialize rate limiter:', error);
    // Return a pass-through function if rate limiter isn't available
    return () => true;
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
        (value, fieldName) => {
          if (typeof value !== 'object' || value === null) {
            return {
              isValid: false,
              error: 'invalid_object',
              message: `The field '${fieldName}' must be an object`
            };
          }
          
          // Check required input fields
          const requiredFields = ['balance', 'userAddress'];
          for (const field of requiredFields) {
            if (value[field] === undefined) {
              return {
                isValid: false,
                error: 'missing_field',
                message: `The field '${fieldName}.${field}' is required`
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
      
      // Standardize input for the circuit
      const circuitInput = {
        balance: input.balance,
        threshold: input.threshold || '0',
        userAddress: input.userAddress
      };
      
      // Dynamically import snarkjs
      const snarkjs = require('snarkjs');
      
      // Generate the proof
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        circuitInput,
        wasmPath,
        zkeyData
      );
      
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

/**
 * Next.js API config for ZK proof handlers
 */
export const zkProofApiConfig = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};

export default createZkProofHandler;