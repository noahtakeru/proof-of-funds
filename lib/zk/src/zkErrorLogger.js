/**
 * @fileoverview ZK Error Logger
 * 
 * Specialized error logging for ZK operations with privacy controls.
 * 
 * @module zkErrorLogger
 */

import { 
  ErrorLogger, 
  errorLogger as baseErrorLogger, 
  LogLevel, 
  PrivacyLevel, 
  ErrorSeverity 
} from './error/ErrorSystem.js';

// Create a specialized logger with ZK-specific configuration
const zkErrorLogger = new ErrorLogger({
  enabled: true,
  logLevel: LogLevel.INFO,
  privacyLevel: PrivacyLevel.INTERNAL,
  component: 'zkSystem',
  collectMetrics: true
});

// ZK event types for structured logging
const ZK_EVENT_TYPES = {
  PROOF_GENERATION_START: 'proof_generation_start',
  PROOF_GENERATION_COMPLETE: 'proof_generation_complete',
  PROOF_GENERATION_ERROR: 'proof_generation_error',
  PROOF_VERIFICATION_START: 'proof_verification_start',
  PROOF_VERIFICATION_COMPLETE: 'proof_verification_complete',
  PROOF_VERIFICATION_ERROR: 'proof_verification_error',
  CIRCUIT_COMPILATION_START: 'circuit_compilation_start',
  CIRCUIT_COMPILATION_COMPLETE: 'circuit_compilation_complete',
  CIRCUIT_COMPILATION_ERROR: 'circuit_compilation_error',
  TRUSTED_SETUP_START: 'trusted_setup_start',
  TRUSTED_SETUP_COMPLETE: 'trusted_setup_complete',
  TRUSTED_SETUP_ERROR: 'trusted_setup_error',
  PARAMETER_DERIVATION_START: 'parameter_derivation_start',
  PARAMETER_DERIVATION_COMPLETE: 'parameter_derivation_complete',
  PARAMETER_DERIVATION_ERROR: 'parameter_derivation_error'
};

// ZK components for structured logging
const ZK_COMPONENTS = {
  PROOF_GENERATOR: 'proof_generator',
  PROOF_VERIFIER: 'proof_verifier',
  CIRCUIT_COMPILER: 'circuit_compiler',
  PARAMETER_DERIVATION: 'parameter_derivation',
  TRUSTED_SETUP: 'trusted_setup',
  ZK_UTILS: 'zk_utils',
  ZK_PROVER: 'zk_prover',
  ZK_SNARK: 'zk_snark'
};

// Function to log ZK events with structured context
function logZKEvent(level, eventType, message, context = {}) {
  const enrichedContext = {
    eventType,
    component: context.component || ZK_COMPONENTS.ZK_UTILS,
    circuit: context.circuit || 'unknown',
    timestamp: new Date().toISOString(),
    ...context
  };
  
  return zkErrorLogger.logEvent(level, message, enrichedContext);
}

// Specific logging functions for ZK operations
function logProofGenerationStart(circuit, inputs, context = {}) {
  return logZKEvent(
    LogLevel.INFO,
    ZK_EVENT_TYPES.PROOF_GENERATION_START,
    `Starting proof generation for circuit: ${circuit}`,
    {
      circuit,
      inputSize: inputs ? JSON.stringify(inputs).length : 0,
      component: ZK_COMPONENTS.PROOF_GENERATOR,
      ...context
    }
  );
}

function logProofGenerationComplete(circuit, proofStats, context = {}) {
  return logZKEvent(
    LogLevel.INFO,
    ZK_EVENT_TYPES.PROOF_GENERATION_COMPLETE,
    `Completed proof generation for circuit: ${circuit}`,
    {
      circuit,
      duration: proofStats.duration,
      proofSize: proofStats.proofSize,
      component: ZK_COMPONENTS.PROOF_GENERATOR,
      ...context
    }
  );
}

function logProofVerificationStart(circuit, context = {}) {
  return logZKEvent(
    LogLevel.INFO,
    ZK_EVENT_TYPES.PROOF_VERIFICATION_START,
    `Starting proof verification for circuit: ${circuit}`,
    {
      circuit,
      component: ZK_COMPONENTS.PROOF_VERIFIER,
      ...context
    }
  );
}

function logProofVerificationComplete(circuit, verified, context = {}) {
  return logZKEvent(
    LogLevel.INFO,
    ZK_EVENT_TYPES.PROOF_VERIFICATION_COMPLETE,
    `Completed proof verification for circuit: ${circuit} (${verified ? 'VALID' : 'INVALID'})`,
    {
      circuit,
      verified,
      component: ZK_COMPONENTS.PROOF_VERIFIER,
      ...context
    }
  );
}

// Log function for ZK errors with proper categorization
function logZKError(error, context = {}) {
  // Extract ZK-specific context
  const zkContext = {
    component: context.component || ZK_COMPONENTS.ZK_UTILS,
    circuit: context.circuit || 'unknown',
    eventType: getErrorEventType(context.component, error),
    ...context
  };
  
  // Log using base error logger with enhanced context
  return baseErrorLogger.logError(error, zkContext);
}

// Helper to determine the event type based on component and error
function getErrorEventType(component, error) {
  if (!component) {
    // Default error event based on error message content
    if (error && error.message) {
      const msg = error.message.toLowerCase();
      if (msg.includes('proof') && msg.includes('generat')) {
        return ZK_EVENT_TYPES.PROOF_GENERATION_ERROR;
      }
      if (msg.includes('proof') && msg.includes('verif')) {
        return ZK_EVENT_TYPES.PROOF_VERIFICATION_ERROR;
      }
      if (msg.includes('circuit') && msg.includes('compil')) {
        return ZK_EVENT_TYPES.CIRCUIT_COMPILATION_ERROR;
      }
      if (msg.includes('trusted') && msg.includes('setup')) {
        return ZK_EVENT_TYPES.TRUSTED_SETUP_ERROR;
      }
      if (msg.includes('parameter') && msg.includes('deriv')) {
        return ZK_EVENT_TYPES.PARAMETER_DERIVATION_ERROR;
      }
    }
    
    // Default
    return ZK_EVENT_TYPES.PROOF_GENERATION_ERROR;
  }
  
  // Map component to appropriate error event type
  switch (component) {
    case ZK_COMPONENTS.PROOF_GENERATOR:
      return ZK_EVENT_TYPES.PROOF_GENERATION_ERROR;
    case ZK_COMPONENTS.PROOF_VERIFIER:
      return ZK_EVENT_TYPES.PROOF_VERIFICATION_ERROR;
    case ZK_COMPONENTS.CIRCUIT_COMPILER:
      return ZK_EVENT_TYPES.CIRCUIT_COMPILATION_ERROR;
    case ZK_COMPONENTS.TRUSTED_SETUP:
      return ZK_EVENT_TYPES.TRUSTED_SETUP_ERROR;
    case ZK_COMPONENTS.PARAMETER_DERIVATION:
      return ZK_EVENT_TYPES.PARAMETER_DERIVATION_ERROR;
    default:
      return ZK_EVENT_TYPES.PROOF_GENERATION_ERROR;
  }
}

// Create an audit log for security events
function createSecurityAuditLog(event, context = {}) {
  const timestamp = new Date().toISOString();
  const operationId = context.operationId || `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  
  const auditLog = {
    timestamp,
    operationId,
    event,
    severity: context.severity || ErrorSeverity.CRITICAL,
    component: context.component || ZK_COMPONENTS.ZK_UTILS,
    circuit: context.circuit || 'unknown',
    authenticated: context.authenticated || false,
    userId: context.userId || 'anonymous',
    ipAddress: context.ipAddress,
    action: context.action || 'unknown',
    outcome: context.outcome || 'failure',
    ...context
  };
  
  // Log using critical level for security events
  zkErrorLogger.critical(`Security event: ${event}`, auditLog);
  
  return auditLog;
}

// Performance logging for ZK operations
function logPerformanceMetrics(operation, metrics, context = {}) {
  return zkErrorLogger.info(`Performance metrics for ${operation}`, {
    operation,
    metrics,
    component: context.component || ZK_COMPONENTS.ZK_UTILS,
    ...context
  });
}

// Export the public API
export const zkErrorLogger = {
  // Core logging functions
  logError: logZKError,
  logEvent: logZKEvent,
  
  // ZK-specific logging functions
  logProofGenerationStart,
  logProofGenerationComplete,
  logProofVerificationStart,
  logProofVerificationComplete,
  
  // Security audit logging
  createSecurityAuditLog,
  
  // Performance logging
  logPerformanceMetrics,
  
  // Constants
  ZK_EVENT_TYPES,
  ZK_COMPONENTS
};

// Default export
export default zkErrorLogger;