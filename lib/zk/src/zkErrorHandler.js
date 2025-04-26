/**
 * @fileoverview ZK Error Handler
 * 
 * Handles ZK proof system errors with specialized recovery mechanisms.
 * 
 * @module zkErrorHandler
 */

import { 
  AppError, 
  ErrorSeverity, 
  ErrorCategory, 
  errorLogger, 
  createErrorHandler,
  withErrorHandling,
  ZKError,
  CircuitError,
  ProofError,
  VerificationError,
  SecurityError,
  MemoryError
} from './error/ErrorSystem.js';

import { 
  recoveryOrchestrator, 
  RecoveryStrategy 
} from './error/ErrorRecovery.js';

// Error types specific to ZK operations
const ZK_ERROR_TYPES = {
  PROOF_GENERATION: 'proof_generation',
  PROOF_VERIFICATION: 'proof_verification',
  CIRCUIT_COMPILATION: 'circuit_compilation',
  INPUT_VALIDATION: 'input_validation',
  PARAMETER_DERIVATION: 'parameter_derivation',
  WITNESS_GENERATION: 'witness_generation',
  TRUSTED_SETUP: 'trusted_setup',
  KEY_MANAGEMENT: 'key_management'
};

// Create error context information for consistent logging
function createErrorContext(error, additionalContext = {}) {
  const timestamp = new Date().toISOString();
  const operationId = additionalContext.operationId || 
    `zk_error_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  
  return {
    timestamp,
    operationId,
    environment: typeof window === 'undefined' ? 'node' : 'browser',
    errorType: error.name || (error instanceof Error ? error.constructor.name : 'Unknown'),
    zkErrorType: additionalContext.zkErrorType || 'unknown_zk_error',
    component: additionalContext.component || 'zkSystem',
    circuit: additionalContext.circuit || 'unknown',
    ...additionalContext
  };
}

// Map error to the appropriate ZK error class
function mapToZKError(error, context = {}) {
  // If already a ZK error, return as is
  if (error instanceof ZKError) {
    return error;
  }
  
  // Map based on context or error properties
  const zkErrorType = context.zkErrorType || '';
  
  if (zkErrorType.includes('circuit') || context.circuit) {
    return new CircuitError(error.message, {
      cause: error,
      details: { originalError: error, ...context },
      severity: ErrorSeverity.ERROR
    });
  }
  
  if (zkErrorType.includes('proof') || context.proof) {
    return new ProofError(error.message, {
      cause: error,
      details: { originalError: error, ...context },
      severity: ErrorSeverity.ERROR
    });
  }
  
  if (zkErrorType.includes('verif') || context.verification) {
    return new VerificationError(error.message, {
      cause: error,
      details: { originalError: error, ...context },
      severity: ErrorSeverity.HIGH
    });
  }
  
  if (error.message && (
    error.message.includes('memory') || 
    error.message.includes('allocation failed') ||
    error.message.includes('out of memory')
  )) {
    return new MemoryError(error.message, {
      cause: error,
      details: { originalError: error, ...context },
      severity: ErrorSeverity.HIGH
    });
  }
  
  if (context.security || 
    (error.message && error.message.toLowerCase().includes('security'))) {
    return new SecurityError(error.message, {
      cause: error,
      details: { originalError: error, ...context },
      severity: ErrorSeverity.CRITICAL
    });
  }
  
  // Default to generic ZK error
  return new ZKError(error.message, {
    cause: error,
    details: { originalError: error, ...context },
    severity: context.severity || ErrorSeverity.ERROR
  });
}

// Handle ZK errors with specialized recovery
async function handleZKError(error, context = {}) {
  const errorContext = createErrorContext(error, context);
  
  // First, map the error to a ZK-specific error class for better categorization
  const zkError = mapToZKError(error, errorContext);
  
  // Log the error with full context
  errorLogger.logError(zkError, errorContext);
  
  // Attempt recovery
  try {
    const recoveryResult = await recoveryOrchestrator.recover(zkError, {
      ...errorContext,
      originalError: error,
      zkError
    });
    
    if (recoveryResult.status === 'success') {
      // If recovery succeeded, log it and return the result
      errorLogger.info(`Successfully recovered from ZK error using ${recoveryResult.strategyUsed} strategy`, {
        operationId: errorContext.operationId,
        recovery: true,
        recoveryStrategy: recoveryResult.strategyUsed
      });
      
      return {
        success: true,
        error: null,
        recovered: true,
        result: recoveryResult.result,
        message: 'Operation recovered successfully after error'
      };
    }
    
    // Recovery failed
    return {
      success: false,
      error: zkError,
      recovered: false,
      message: recoveryResult.message || 'Failed to recover from ZK error',
      recoveryAttempted: true
    };
  } catch (recoveryError) {
    // Error during recovery
    errorLogger.error('Error during ZK error recovery', {
      operationId: errorContext.operationId,
      recoveryError
    });
    
    return {
      success: false,
      error: zkError,
      recovered: false,
      recoveryError,
      message: 'Error occurred during recovery attempt'
    };
  }
}

// Create specialized error handlers for different ZK operations
const handleProofGenerationError = createErrorHandler({
  component: 'proofGeneration',
  transform: (error) => mapToZKError(error, { 
    zkErrorType: ZK_ERROR_TYPES.PROOF_GENERATION,
    component: 'proofGeneration'
  }),
  fallback: (error) => ({
    success: false,
    error,
    message: 'Proof generation failed',
    proof: null
  })
});

const handleProofVerificationError = createErrorHandler({
  component: 'proofVerification',
  transform: (error) => mapToZKError(error, { 
    zkErrorType: ZK_ERROR_TYPES.PROOF_VERIFICATION,
    component: 'proofVerification'
  }),
  fallback: (error) => ({
    success: false,
    error,
    message: 'Proof verification failed',
    verified: false
  })
});

const handleCircuitCompilationError = createErrorHandler({
  component: 'circuitCompilation',
  transform: (error) => mapToZKError(error, { 
    zkErrorType: ZK_ERROR_TYPES.CIRCUIT_COMPILATION,
    component: 'circuitCompilation'
  }),
  fallback: (error) => ({
    success: false,
    error,
    message: 'Circuit compilation failed',
    circuit: null
  })
});

const handleInputValidationError = createErrorHandler({
  component: 'inputValidation',
  transform: (error) => mapToZKError(error, { 
    zkErrorType: ZK_ERROR_TYPES.INPUT_VALIDATION,
    component: 'inputValidation'
  }),
  fallback: (error) => ({
    success: false,
    error,
    message: 'Input validation failed',
    valid: false
  })
});

// Function to run an operation with ZK error handling
async function runWithZKErrorHandling(operation, context = {}) {
  try {
    return await operation();
  } catch (error) {
    return handleZKError(error, context);
  }
}

// Decorator for functions that need ZK error handling
function withZKErrorHandling(options = {}) {
  return function decorator(target) {
    return async function wrapped(...args) {
      try {
        return await target(...args);
      } catch (error) {
        const context = {
          component: options.component || target.name || 'zkFunction',
          zkErrorType: options.zkErrorType || ZK_ERROR_TYPES.PROOF_GENERATION,
          args: args.map(arg => typeof arg === 'object' ? '[object]' : arg),
          ...options.context
        };
        
        return handleZKError(error, context);
      }
    };
  };
}

// Function to check if an error is a ZK error
function isZKError(error) {
  return error instanceof ZKError;
}

// Function to extract useful information from ZK errors
function extractZKErrorInfo(error) {
  if (!error) return null;
  
  if (error instanceof ZKError) {
    return {
      code: error.code,
      category: error.category,
      severity: error.severity,
      recoverable: error.recoverable,
      details: error.details,
      operationId: error.operationId
    };
  }
  
  return {
    message: error.message,
    name: error.name,
    stack: error.stack
  };
}

// Export the public API
export const zkErrorHandler = {
  handleError: handleZKError,
  handleProofGenerationError,
  handleProofVerificationError,
  handleCircuitCompilationError,
  handleInputValidationError,
  runWithZKErrorHandling,
  withZKErrorHandling,
  isZKError,
  extractZKErrorInfo,
  ZK_ERROR_TYPES
};

// Default export
export default zkErrorHandler;