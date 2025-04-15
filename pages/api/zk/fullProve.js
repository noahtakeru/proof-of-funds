/**
 * Server-side fullProve endpoint for ZK operations
 * 
 * This endpoint provides server-side proof generation for clients
 * that can't perform the operations locally.
 * 
 * Security features:
 * - Input validation
 * - Rate limiting
 * - User-based quotas
 * - DDoS protection
 * - Authentication checks
 */

import { snarkjsLoader } from '../../../lib/zk/src/snarkjsLoader';
import { telemetry } from '../../../lib/zk/src/telemetry';
import { performance } from 'perf_hooks';
import { RateLimiter } from '../../../lib/zk/src/zkProxyClient';

// Import analytics for server-side tracking
let analyticsClient;
try {
  analyticsClient = require('../../../lib/analytics/bigQueryClient');
} catch (e) {
  console.warn('Analytics client could not be loaded:', e.message);
  analyticsClient = null;
}

// Create rate limiter for API
const rateLimiter = new RateLimiter();

// API key verification
const API_KEYS = {
  // In a real system, these would be stored in a database or environment variables
  'dev-test-key': {
    maxRequestsPerMinute: 30,
    maxRequestsPerHour: 500,
    user: 'developer'
  }
};

// Validated input schemas for different proof types
const PROOF_TYPE_SCHEMAS = {
  0: ['walletAddress', 'amount'], // STANDARD
  1: ['walletAddress', 'amount', 'threshold'], // THRESHOLD
  2: ['walletAddress', 'amount', 'maximum'] // MAXIMUM
};

// Validate proof input based on proof type
function validateProofInput(input, proofType) {
  if (proofType === undefined || !Number.isInteger(proofType) || proofType < 0 || proofType > 2) {
    return { valid: false, error: 'Invalid proof type, must be 0, 1, or 2' };
  }

  // Get required fields for this proof type
  const requiredFields = PROOF_TYPE_SCHEMAS[proofType];
  if (!requiredFields) {
    return { valid: false, error: `Unknown proof type: ${proofType}` };
  }

  // Check for required fields
  for (const field of requiredFields) {
    if (input[field] === undefined) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }

  // Validate wallet address format (basic check)
  if (!/^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/.test(input.walletAddress)) {
    return { valid: false, error: 'Invalid wallet address format' };
  }

  // Validate amount (basic check, more complex validation would depend on the chain)
  if (isNaN(input.amount) && !/^\d+$/.test(input.amount)) {
    return { valid: false, error: 'Amount must be a number or numeric string' };
  }

  return { valid: true };
}

// Get user ID from request
function getUserId(req) {
  const userId =
    req.headers['x-user-id'] ||
    req.query.userId ||
    req.cookies?.userId ||
    req.headers['x-forwarded-for'] ||
    req.socket.remoteAddress ||
    'anonymous';

  return userId;
}

// Verify API key
function verifyApiKey(req) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;

  if (!apiKey) {
    return {
      valid: false,
      error: 'No API key provided'
    };
  }

  const keyInfo = API_KEYS[apiKey];
  if (!keyInfo) {
    return {
      valid: false,
      error: 'Invalid API key'
    };
  }

  return {
    valid: true,
    userId: keyInfo.user,
    limits: {
      maxRequestsPerMinute: keyInfo.maxRequestsPerMinute,
      maxRequestsPerHour: keyInfo.maxRequestsPerHour
    }
  };
}

export default async function handler(req, res) {
  // Set CORS headers for API access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, X-User-Id, X-Operation-Id');

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      allowedMethods: ['POST']
    });
  }

  // Record the request start time for performance tracking
  const startTime = performance.now();

  // Generate operation ID if not provided
  const operationId = req.headers['x-operation-id'] || `op_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  try {
    // Extract request parameters
    const {
      input,
      circuitWasmPath,
      zkeyPath,
      options = {},
      clientInfo = {}
    } = req.body;

    // Validate required parameters
    if (!input || !circuitWasmPath || !zkeyPath) {
      return res.status(400).json({
        error: 'Missing required parameters',
        requiredParams: ['input', 'circuitWasmPath', 'zkeyPath']
      });
    }

    // Get user ID for rate limiting
    const userId = getUserId(req);

    // Check API key if enabled (disabled for development)
    const apiKeyResult = process.env.REQUIRE_API_KEY === 'true'
      ? verifyApiKey(req)
      : { valid: true, userId };

    if (!apiKeyResult.valid) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: apiKeyResult.error
      });
    }

    // Set custom rate limits for API key user if available
    if (apiKeyResult.limits) {
      rateLimiter.setUserLimits(apiKeyResult.userId || userId, apiKeyResult.limits);
    }

    // Check rate limits
    const rateLimit = rateLimiter.checkRateLimit(apiKeyResult.userId || userId);

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Please try again later.`,
        retryAfter: Math.ceil((rateLimit.minuteLimit.reset - Date.now()) / 1000),
        limits: rateLimit
      });
    }

    // Validate proof input
    const validationResult = validateProofInput(input, input.proofType);
    if (!validationResult.valid) {
      return res.status(400).json({
        error: 'Invalid input',
        message: validationResult.error
      });
    }

    // Log client information for telemetry if provided
    if (clientInfo.userAgent) {
      console.log(`Server-side fullProve request from:`, {
        userAgent: clientInfo.userAgent,
        wasmSupported: clientInfo.wasmSupported,
        timestamp: clientInfo.timestamp || new Date().toISOString(),
        operationId
      });
    }

    // Initialize snarkjs if not already initialized
    if (!snarkjsLoader.isInitialized()) {
      const initialized = await snarkjsLoader.initialize({
        serverSide: true,
        maxRetries: 3
      });

      if (!initialized) {
        telemetry.recordError('fullProve-api', 'Failed to initialize snarkjs');
        return res.status(500).json({ error: 'Failed to initialize proof generation environment' });
      }
    }

    // Get the snarkjs instance
    const snarkjs = snarkjsLoader.getSnarkjs();

    // Generate the proof
    let proof, publicSignals;

    try {
      // Generate a real ZK proof with proper error handling
      try {
        // Extra validation of input files
        if (!circuitWasmPath || typeof circuitWasmPath !== 'string') {
          throw new Error('Invalid circuit WASM path');
        }
        
        if (!zkeyPath || typeof zkeyPath !== 'string') {
          throw new Error('Invalid zkey path');
        }
        
        // Check if files exist by attempting to access them (this is server-side)
        const fs = require('fs').promises;
        
        try {
          await fs.access(circuitWasmPath);
          await fs.access(zkeyPath);
        } catch (fileAccessError) {
          throw new Error(`Circuit files not accessible: ${fileAccessError.message}`);
        }
        
        // Perform the actual proof generation
        const result = await snarkjs.groth16.fullProve(
          input,
          circuitWasmPath,
          zkeyPath,
          options
        );
        
        if (!result || !result.proof || !result.publicSignals) {
          throw new Error('Proof generation returned incomplete results');
        }

        proof = result.proof;
        publicSignals = result.publicSignals;
        
        // Log success
        console.log(`Proof generated successfully for operation ${operationId}`);
      } catch (proofError) {
        console.error('Proof generation error:', proofError.message, {
          error: proofError,
          operationId,
          circuitWasmPath,
          zkeyPath,
          inputKeys: Object.keys(input || {})
        });
        
        telemetry.recordError('fullProve-api', `Error generating real proof: ${proofError.message}`);
        
        // Do not use mock data, return an error to the client
        return res.status(500).json({
          error: 'Proof generation failed',
          message: proofError.message,
          operationId,
          details: {
            errorType: proofError.name || 'Unknown',
            errorTimestamp: new Date().toISOString()
          }
        });
      }
    } catch (proofGenError) {
      telemetry.recordError('fullProve-api', `Proof generation failed: ${proofGenError.message}`);

      // Release rate limit slot on error
      rateLimiter.releaseRequest(apiKeyResult.userId || userId);

      return res.status(500).json({
        error: 'Proof generation failed',
        message: proofGenError.message
      });
    }

    const endTime = performance.now();
    const processingTime = endTime - startTime;

    // Release rate limit slot on success
    rateLimiter.releaseRequest(apiKeyResult.userId || userId);

    telemetry.recordOperation({
      operation: 'fullProve',
      executionTimeMs: processingTime,
      serverSide: true,
      success: true,
      additionalInfo: {
        operationId,
        proofType: input.proofType
      }
    });

    // Track server-side proof generation in BigQuery
    if (analyticsClient) {
      try {
        analyticsClient.logProofGeneration({
          operationId,
          proofType: input.proofType,
          network: clientInfo.network || 'unknown',
          executionTimeMs: processingTime,
          success: true,
          clientType: clientInfo.clientType || 'browser'
        });
      } catch (analyticsError) {
        console.warn('Failed to log analytics:', analyticsError);
      }
    }

    // Return the proof and public signals
    return res.status(200).json({
      proof,
      publicSignals,
      serverTiming: {
        totalTime: processingTime
      },
      operationId,
      executionTimeMs: processingTime
    });
  } catch (error) {
    console.error('Unexpected error in fullProve API:', error);
    telemetry.recordError('fullProve-api', error.message || 'Unknown error during proof generation');

    return res.status(500).json({
      error: 'Proof generation failed',
      message: error.message || 'Unknown error during proof generation',
      operationId
    });
  }
}