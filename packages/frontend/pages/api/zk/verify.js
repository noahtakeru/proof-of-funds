/**
 * Server-side verification endpoint for ZK operations
 * 
 * This endpoint provides secure server-side proof verification with
 * input validation, rate limiting, and security measures.
 */

import { snarkjsLoader } from '@proof-of-funds/common/zk/src/snarkjsLoader';
import { telemetry } from '@proof-of-funds/common/zk/src/telemetry';
import { performance } from 'perf_hooks';
import { RateLimiter } from '@proof-of-funds/common/zk/src/zkProxyClient';
import { nonceValidator } from '@proof-of-funds/common/zk/src/security/NonceValidator';
import { signatureVerifier } from '@proof-of-funds/common/zk/src/security/RequestSignatureVerifier';
import { inputValidator } from '@proof-of-funds/common/zk/src/security/InputValidator';
import { responseSigner } from '@proof-of-funds/common/zk/src/security/ResponseSigner';

// Create rate limiter for API - verification has higher limits than proof generation
const rateLimiter = new RateLimiter();
rateLimiter.defaultRateLimit.maxRequestsPerMinute = 30; // Higher limit for verification
rateLimiter.defaultRateLimit.maxRequestsPerHour = 300;

// API key verification - same as in fullProve.js
const API_KEYS = {
  // In a real system, these would be stored in a database or environment variables
  'dev-test-key': {
    maxRequestsPerMinute: 60,
    maxRequestsPerHour: 1000,
    user: 'developer'
  }
};

// Validate verification parameters
function validateVerificationInput(params) {
  const { verificationKey, publicSignals, proof } = params;

  // Check for required fields
  if (!verificationKey) {
    return { valid: false, error: 'Missing verification key' };
  }

  if (!publicSignals) {
    return { valid: false, error: 'Missing public signals' };
  }

  if (!proof) {
    return { valid: false, error: 'Missing proof' };
  }

  // Basic structural validation for proof
  if (!proof.pi_a || !proof.pi_b || !proof.pi_c) {
    return { valid: false, error: 'Invalid proof format' };
  }

  // The verificationKey should have specific structure
  if (!verificationKey.protocol) {
    return { valid: false, error: 'Invalid verification key format' };
  }

  return { valid: true };
}

// Get user ID from request - same as in fullProve.js
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

// Verify API key - same as in fullProve.js
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

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      allowedMethods: ['POST']
    });
  }

  // Record the request start time for performance tracking
  const startTime = performance.now();

  // Generate operation ID if not provided
  const operationId = req.headers['x-operation-id'] || `verify_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  try {
    // Extract verification parameters
    const { verificationKey, publicSignals, proof, nonce, timestamp } = req.body;

    // Validate required parameters
    if (!verificationKey || !publicSignals || !proof) {
      return res.status(400).json({
        error: 'Missing required parameters',
        requiredParams: ['verificationKey', 'publicSignals', 'proof']
      });
    }

    // Sanitize proof data
    const sanitizedProof = inputValidator.sanitizeInput(proof);
    const sanitizedPublicSignals = inputValidator.sanitizeInput(publicSignals);
    
    // Basic structural validation for proof
    if (!sanitizedProof.pi_a || !sanitizedProof.pi_b || !sanitizedProof.pi_c) {
      return res.status(400).json({
        error: 'Invalid proof format',
        message: 'Proof must contain pi_a, pi_b, and pi_c components'
      });
    }

    // Validate nonce to prevent replay attacks
    if (!nonce) {
      return res.status(400).json({
        error: 'Missing required parameter',
        message: 'Nonce is required to prevent replay attacks',
        requiredParams: ['nonce']
      });
    }
    
    // Get user ID for nonce validation and rate limiting
    const userId = getUserId(req);
    
    // Validate the nonce
    const nonceValidation = nonceValidator.validateNonce(nonce, userId, timestamp || Date.now());
    
    if (!nonceValidation.valid) {
      return res.status(400).json({
        error: 'Invalid nonce',
        message: nonceValidation.message,
        reason: nonceValidation.reason
      });
    }
    
    // Verify request signature if provided
    if (req.body.signature) {
      const signatureInfo = {
        signature: req.body.signature,
        timestamp: req.body.timestamp || Date.now().toString(),
        clientId: req.body.clientId || userId
      };
      
      // Create a copy of the request data without the signature for verification
      const { signature, ...requestDataWithoutSignature } = req.body;
      
      const signatureValidation = signatureVerifier.verifyClientSignature(
        requestDataWithoutSignature,
        signatureInfo
      );
      
      if (!signatureValidation.valid) {
        return res.status(401).json({
          error: 'Invalid signature',
          message: signatureValidation.message,
          reason: signatureValidation.reason
        });
      }
    }

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

    // Validate verification input
    const validationResult = validateVerificationInput({ verificationKey, publicSignals, proof });
    if (!validationResult.valid) {
      return res.status(400).json({
        error: 'Invalid input',
        message: validationResult.error
      });
    }

    // Initialize snarkjs if not already initialized
    if (!snarkjsLoader.isInitialized()) {
      const initialized = await snarkjsLoader.initialize({
        serverSide: true,
        maxRetries: 3
      });

      if (!initialized) {
        telemetry.recordError('verify-api', 'Failed to initialize snarkjs');

        // Release rate limit slot on error
        rateLimiter.releaseRequest(apiKeyResult.userId || userId);

        return res.status(500).json({
          error: 'Failed to initialize verification environment',
          operationId
        });
      }
    }

    // Perform actual verification with proper error handling
    let verificationResult = false;

    try {
      // Initialize snarkjs if not already done
      if (!snarkjsLoader.isInitialized()) {
        await snarkjsLoader.initialize({
          serverSide: true,
          timeout: 10000,
          maxRetries: 3
        });
      }
      
      const snarkjs = snarkjsLoader.getSnarkjs();
      
      if (!snarkjs || !snarkjs.groth16 || typeof snarkjs.groth16.verify !== 'function') {
        throw new Error('snarkjs not properly initialized or missing verify functionality');
      }
      
      // Perform actual cryptographic verification
      verificationResult = await snarkjs.groth16.verify(
        verificationKey,
        publicSignals,
        proof
      );
      
      if (verificationResult === undefined || verificationResult === null) {
        throw new Error('Verification returned undefined result');
      }
      
      // Record successful verification in telemetry
      telemetry.recordOperation({
        operation: 'verify-success',
        executionTimeMs: performance.now() - startTime,
        serverSide: true,
        success: !!verificationResult,
        additionalInfo: {
          operationId
        }
      });
    } catch (verifyError) {
      // Log the error with detailed information
      console.error("Verification error:", verifyError.message, {
        error: verifyError,
        operationId,
        hasVerificationKey: !!verificationKey,
        publicSignalsLength: publicSignals?.length,
        proofStructure: proof ? Object.keys(proof) : null
      });
      
      telemetry.recordError('verify-operation', verifyError.message);
      
      // Do not use mock results, return actual error
      return res.status(400).json({
        verified: false,
        error: `Verification failed: ${verifyError.message}`,
        operationId
      });
    }

    const endTime = performance.now();
    const processingTime = endTime - startTime;

    // Release rate limit slot on success
    rateLimiter.releaseRequest(apiKeyResult.userId || userId);

    telemetry.recordOperation({
      operation: 'verify',
      executionTimeMs: processingTime,
      serverSide: true,
      success: true,
      additionalInfo: {
        operationId,
        verified: verificationResult
      }
    });

    // Prepare response data
    const responseData = {
      verified: verificationResult,
      executionTimeMs: processingTime,
      serverTiming: {
        totalTime: processingTime
      },
      operationId
    };
    
    // Sign the response to protect against MITM attacks
    const signedResponse = responseSigner.signResponse(responseData);
    
    // Return the signed response
    return res.status(200).json(signedResponse);
  } catch (error) {
    console.error('Unexpected error in verify API:', error);
    telemetry.recordError('verify-api', error.message || 'Unknown error during verification');

    return res.status(500).json({
      error: 'Verification failed',
      message: error.message || 'Unknown error during verification',
      operationId
    });
  }
}