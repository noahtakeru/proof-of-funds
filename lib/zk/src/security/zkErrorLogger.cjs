/**
 * Error logger for ZK modules
 * 
 * Provides a standardized way to log errors in ZK modules with appropriate
 * context and severity levels. Can be used in both Node.js and browser environments.
 */

const ErrorCode = {
    // General errors
    UNKNOWN_ERROR: 'ZK_UNKNOWN_ERROR',
    INITIALIZATION_ERROR: 'ZK_INITIALIZATION_ERROR',
    RUNTIME_ERROR: 'ZK_RUNTIME_ERROR',
    
    // Circuit-related errors
    CIRCUIT_ERROR: 'ZK_CIRCUIT_ERROR',
    CONSTRAINT_VIOLATION: 'ZK_CONSTRAINT_VIOLATION',
    WITNESS_GENERATION_ERROR: 'ZK_WITNESS_ERROR',
    
    // Proof-related errors
    PROOF_GENERATION_ERROR: 'ZK_PROOF_ERROR',
    VERIFICATION_ERROR: 'ZK_VERIFICATION_ERROR',
    
    // Security-related errors
    SECURITY_ERROR: 'ZK_SECURITY_ERROR',
    SECURITY_INPUT_ERROR: 'ZK_SECURITY_INPUT_ERROR',
    SECURITY_KEY_ERROR: 'ZK_SECURITY_KEY_ERROR',
    TAMPER_DETECTION: 'ZK_TAMPER_DETECTION',
    
    // Resource-related errors
    MEMORY_ERROR: 'ZK_MEMORY_ERROR',
    PERFORMANCE_ERROR: 'ZK_PERFORMANCE_ERROR',
    TIMEOUT_ERROR: 'ZK_TIMEOUT_ERROR',
    
    // Platform-related errors
    COMPATIBILITY_ERROR: 'ZK_COMPATIBILITY_ERROR',
    BROWSER_ERROR: 'ZK_BROWSER_ERROR',
    NODE_ERROR: 'ZK_NODE_ERROR',
    WASM_ERROR: 'ZK_WASM_ERROR',
    
    // Module-related errors
    MODULE_ERROR: 'ZK_MODULE_ERROR',
    DEPENDENCY_ERROR: 'ZK_DEPENDENCY_ERROR',
    CONFIG_ERROR: 'ZK_CONFIG_ERROR',
    
    // Network-related errors
    NETWORK_ERROR: 'ZK_NETWORK_ERROR',
    API_ERROR: 'ZK_API_ERROR'
};

// Base error class
class ZKError extends Error {
    constructor(message, options = {}) {
        super(message);
        this.name = this.constructor.name;
        this.code = options.code || ErrorCode.UNKNOWN_ERROR;
        this.timestamp = options.timestamp || Date.now();
        this.context = options.context || {};
        this.severity = options.severity || 'error';
        this.reportable = options.reportable !== false; // Default to true
        
        // Capture stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

// Runtime error
class RuntimeError extends ZKError {
    constructor(message, options = {}) {
        super(message, {
            ...options,
            code: options.code || ErrorCode.RUNTIME_ERROR
        });
    }
}

// Circuit errors
class CircuitError extends ZKError {
    constructor(message, options = {}) {
        super(message, {
            ...options,
            code: options.code || ErrorCode.CIRCUIT_ERROR
        });
    }
}

// Proof errors
class ProofError extends ZKError {
    constructor(message, options = {}) {
        super(message, {
            ...options,
            code: options.code || ErrorCode.PROOF_GENERATION_ERROR
        });
    }
}

// Verification errors
class VerificationError extends ZKError {
    constructor(message, options = {}) {
        super(message, {
            ...options,
            code: options.code || ErrorCode.VERIFICATION_ERROR
        });
    }
}

// Security errors
class SecurityError extends ZKError {
    constructor(message, options = {}) {
        super(message, {
            ...options,
            code: options.code || ErrorCode.SECURITY_ERROR,
            severity: options.severity || 'critical'
        });
    }
}

// Crypto errors (subclass of SecurityError)
class CryptoError extends SecurityError {
    constructor(message, options = {}) {
        super(message, {
            ...options,
            code: options.code || ErrorCode.SECURITY_KEY_ERROR,
            securityCritical: true
        });
    }
}

// Resource errors
class ResourceError extends ZKError {
    constructor(message, options = {}) {
        super(message, {
            ...options,
            code: options.code || ErrorCode.MEMORY_ERROR
        });
    }
}

// Compatibility errors
class CompatibilityError extends ZKError {
    constructor(message, options = {}) {
        super(message, {
            ...options,
            code: options.code || ErrorCode.COMPATIBILITY_ERROR
        });
    }
}

// Network errors
class NetworkError extends ZKError {
    constructor(message, options = {}) {
        super(message, {
            ...options,
            code: options.code || ErrorCode.NETWORK_ERROR
        });
    }
}

// Module errors
class ModuleError extends ZKError {
    constructor(message, options = {}) {
        super(message, {
            ...options,
            code: options.code || ErrorCode.MODULE_ERROR
        });
    }
}

/**
 * Log error to console with consistent formatting
 * @param {Error} error - Error to log
 * @param {Object} options - Additional logging options
 */
function logError(error, options = {}) {
    const isZKError = error instanceof ZKError;
    const level = isZKError ? error.severity : (options.severity || 'error');
    const prefix = `[ZK-${level.toUpperCase()}]`;
    
    // Determine appropriate console method based on severity
    let logMethod;
    switch (level) {
        case 'debug':
            logMethod = console.debug;
            break;
        case 'info':
            logMethod = console.info;
            break;
        case 'warning':
        case 'warn':
            logMethod = console.warn;
            break;
        case 'critical':
        case 'fatal':
            logMethod = console.error;
            break;
        case 'error':
        default:
            logMethod = console.error;
    }
    
    // Log basic error info
    const errorCode = isZKError ? error.code : (options.code || ErrorCode.UNKNOWN_ERROR);
    const timestamp = isZKError ? error.timestamp : (options.timestamp || Date.now());
    const formattedTime = new Date(timestamp).toISOString();
    
    logMethod(`${prefix} [${formattedTime}] [${errorCode}] ${error.message}`);
    
    // Log additional context if available
    const context = isZKError ? error.context : (options.context || {});
    if (Object.keys(context).length > 0) {
        logMethod(`${prefix} Context:`, context);
    }
    
    // Log stack trace
    if (error.stack && (options.includeStack !== false)) {
        logMethod(`${prefix} Stack trace:`, error.stack);
    }
}

// Export error classes and utilities
module.exports = {
    ErrorCode,
    ZKError,
    RuntimeError,
    CircuitError,
    ProofError,
    VerificationError,
    SecurityError,
    CryptoError,
    ResourceError,
    CompatibilityError,
    NetworkError,
    ModuleError,
    logError
};