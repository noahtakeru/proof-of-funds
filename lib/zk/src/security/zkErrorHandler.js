/**
 * @fileoverview ZK Custom Error Handling Module
 * 
 * Provides specialized error classes for ZK operations, enabling more precise
 * error handling and reporting throughout the application.
 * 
 * @author ZK Infrastructure Team
 * @created August 2024
 */

/**
 * Base class for all ZK-related errors
 * @extends Error
 */
class ZKError extends Error {
    /**
     * Creates a new ZK Error
     * @param {string} message - Error message
     * @param {object} [options={}] - Error options
     * @param {string} [options.code] - Error code
     * @param {Error} [options.cause] - Original error that caused this error
     * @param {object} [options.context] - Additional context for the error
     */
    constructor(message, options = {}) {
        super(message);
        this.name = this.constructor.name;
        this.code = options.code || 'ZK_ERROR';
        this.cause = options.cause;
        this.context = options.context || {};
        this.timestamp = new Date();

        // Capture stack trace, excluding constructor call from it
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    /**
     * Get a structured representation of the error
     * @returns {object} Structured error data
     */
    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            stack: this.stack,
            context: this.context,
            timestamp: this.timestamp.toISOString(),
            cause: this.cause ? {
                name: this.cause.name,
                message: this.cause.message,
                stack: this.cause.stack
            } : undefined
        };
    }
}

/**
 * Error indicating an invalid input was provided
 * @extends ZKError
 */
class InputError extends ZKError {
    /**
     * Creates a new Input Error
     * @param {string} message - Error message
     * @param {object} [options={}] - Error options
     * @param {string} [options.field] - The field with invalid input
     */
    constructor(message, options = {}) {
        super(message, {
            ...options,
            code: options.code || 'ZK_INPUT_ERROR'
        });
        this.field = options.field;
        this.context = {
            ...this.context,
            field: this.field
        };
    }
}

/**
 * Error indicating a validation failure
 * @extends ZKError
 */
class ValidationError extends ZKError {
    /**
     * Creates a new Validation Error
     * @param {string} message - Error message
     * @param {object} [options={}] - Error options
     * @param {string} [options.validationType] - Type of validation that failed
     * @param {*} [options.invalidValue] - The value that failed validation
     */
    constructor(message, options = {}) {
        super(message, {
            ...options,
            code: options.code || 'ZK_VALIDATION_ERROR'
        });
        this.validationType = options.validationType;
        this.invalidValue = options.invalidValue;
        this.context = {
            ...this.context,
            validationType: this.validationType,
            invalidValue: this.invalidValue
        };
    }
}

/**
 * Error indicating an authorization failure
 * @extends ZKError
 */
class AuthorizationError extends ZKError {
    /**
     * Creates a new Authorization Error
     * @param {string} message - Error message
     * @param {object} [options={}] - Error options
     * @param {string} [options.requiredPermission] - Permission that was required
     */
    constructor(message, options = {}) {
        super(message, {
            ...options,
            code: options.code || 'ZK_AUTHORIZATION_ERROR'
        });
        this.requiredPermission = options.requiredPermission;
        this.context = {
            ...this.context,
            requiredPermission: this.requiredPermission
        };
    }
}

/**
 * Error indicating an authentication failure
 * @extends ZKError
 */
class AuthenticationError extends ZKError {
    /**
     * Creates a new Authentication Error
     * @param {string} message - Error message
     * @param {object} [options={}] - Error options
     * @param {string} [options.failureReason] - Reason for authentication failure
     */
    constructor(message, options = {}) {
        super(message, {
            ...options,
            code: options.code || 'ZK_AUTHENTICATION_ERROR'
        });
        this.failureReason = options.failureReason;
        this.context = {
            ...this.context,
            failureReason: this.failureReason
        };
    }
}

/**
 * Error related to ZK proof generation
 * @extends ZKError
 */
class ProofGenerationError extends ZKError {
    /**
     * Creates a new Proof Generation Error
     * @param {string} message - Error message
     * @param {object} [options={}] - Error options
     * @param {string} [options.proofType] - Type of proof that failed
     * @param {string} [options.phase] - Phase of proof generation that failed
     */
    constructor(message, options = {}) {
        super(message, {
            ...options,
            code: options.code || 'ZK_PROOF_GENERATION_ERROR'
        });
        this.proofType = options.proofType;
        this.phase = options.phase;
        this.context = {
            ...this.context,
            proofType: this.proofType,
            phase: this.phase
        };
    }
}

/**
 * Error related to ZK proof verification
 * @extends ZKError
 */
class ProofVerificationError extends ZKError {
    /**
     * Creates a new Proof Verification Error
     * @param {string} message - Error message
     * @param {object} [options={}] - Error options
     * @param {string} [options.proofType] - Type of proof that failed verification
     * @param {string} [options.verificationStage] - Stage of verification that failed
     */
    constructor(message, options = {}) {
        super(message, {
            ...options,
            code: options.code || 'ZK_PROOF_VERIFICATION_ERROR'
        });
        this.proofType = options.proofType;
        this.verificationStage = options.verificationStage;
        this.context = {
            ...this.context,
            proofType: this.proofType,
            verificationStage: this.verificationStage
        };
    }
}

/**
 * Error related to circuit operations
 * @extends ZKError
 */
class CircuitError extends ZKError {
    /**
     * Creates a new Circuit Error
     * @param {string} message - Error message
     * @param {object} [options={}] - Error options
     * @param {string} [options.circuitName] - Name of the circuit
     * @param {string} [options.operation] - Operation that failed
     */
    constructor(message, options = {}) {
        super(message, {
            ...options,
            code: options.code || 'ZK_CIRCUIT_ERROR'
        });
        this.circuitName = options.circuitName;
        this.operation = options.operation;
        this.context = {
            ...this.context,
            circuitName: this.circuitName,
            operation: this.operation
        };
    }
}

/**
 * Error related to network operations
 * @extends ZKError
 */
class NetworkError extends ZKError {
    /**
     * Creates a new Network Error
     * @param {string} message - Error message
     * @param {object} [options={}] - Error options
     * @param {string} [options.endpoint] - The endpoint that was being accessed
     * @param {number} [options.statusCode] - HTTP status code (if applicable)
     */
    constructor(message, options = {}) {
        super(message, {
            ...options,
            code: options.code || 'ZK_NETWORK_ERROR'
        });
        this.endpoint = options.endpoint;
        this.statusCode = options.statusCode;
        this.context = {
            ...this.context,
            endpoint: this.endpoint,
            statusCode: this.statusCode
        };
    }
}

/**
 * Error related to configuration issues
 * @extends ZKError
 */
class ConfigurationError extends ZKError {
    /**
     * Creates a new Configuration Error
     * @param {string} message - Error message
     * @param {object} [options={}] - Error options
     * @param {string} [options.configKey] - The configuration key that has issues
     * @param {*} [options.invalidValue] - The invalid configuration value
     */
    constructor(message, options = {}) {
        super(message, {
            ...options,
            code: options.code || 'ZK_CONFIGURATION_ERROR'
        });
        this.configKey = options.configKey;
        this.invalidValue = options.invalidValue;
        this.context = {
            ...this.context,
            configKey: this.configKey,
            invalidValue: this.invalidValue
        };
    }
}

/**
 * Error related to implementation vulnerabilities
 * @extends ZKError
 */
class SecurityVulnerabilityError extends ZKError {
    /**
     * Creates a new Security Vulnerability Error
     * @param {string} message - Error message
     * @param {object} [options={}] - Error options
     * @param {string} [options.vulnerabilityType] - Type of vulnerability
     * @param {string} [options.severity] - Severity level (low, medium, high, critical)
     */
    constructor(message, options = {}) {
        super(message, {
            ...options,
            code: options.code || 'ZK_SECURITY_VULNERABILITY'
        });
        this.vulnerabilityType = options.vulnerabilityType;
        this.severity = options.severity || 'high';
        this.context = {
            ...this.context,
            vulnerabilityType: this.vulnerabilityType,
            severity: this.severity
        };
    }
}

/**
 * Error related to testing or simulation failures
 * @extends ZKError
 */
class TestError extends ZKError {
    /**
     * Creates a new Test Error
     * @param {string} message - Error message
     * @param {object} [options={}] - Error options
     * @param {string} [options.testName] - Name of the test that failed
     * @param {string} [options.testPhase] - Phase of testing that failed
     */
    constructor(message, options = {}) {
        super(message, {
            ...options,
            code: options.code || 'ZK_TEST_ERROR'
        });
        this.testName = options.testName;
        this.testPhase = options.testPhase;
        this.context = {
            ...this.context,
            testName: this.testName,
            testPhase: this.testPhase
        };
    }
}

/**
 * Error handler function that properly processes and logs ZK errors
 * @param {Error} error - The error to handle
 * @param {object} [options={}] - Handler options
 * @param {boolean} [options.rethrow=false] - Whether to rethrow the error after handling
 * @param {Function} [options.logger=console.error] - Logger function to use
 * @returns {ZKError} The processed error
 */
function handleError(error, options = {}) {
    const { rethrow = false, logger = console.error } = options;

    // Convert generic errors to ZKError if needed
    let zkError = error;
    if (!(error instanceof ZKError)) {
        zkError = new ZKError(error.message, { cause: error });
    }

    // Log the error with appropriate formatting
    logger(`[ZK-ERROR] ${zkError.code}: ${zkError.message}`);

    if (zkError.context && Object.keys(zkError.context).length > 0) {
        logger(`[ZK-ERROR] Context: ${JSON.stringify(zkError.context)}`);
    }

    if (zkError.cause) {
        logger(`[ZK-ERROR] Caused by: ${zkError.cause.name}: ${zkError.cause.message}`);
    }

    // Optionally rethrow
    if (rethrow) {
        throw zkError;
    }

    return zkError;
}

/**
 * Error constants for common error messages
 */
const ErrorConstants = {
    INVALID_INPUT: 'Invalid input provided',
    UNAUTHORIZED: 'Unauthorized access',
    UNAUTHENTICATED: 'Authentication required',
    PROOF_GENERATION_FAILED: 'Failed to generate ZK proof',
    PROOF_VERIFICATION_FAILED: 'Failed to verify ZK proof',
    CIRCUIT_COMPILATION_FAILED: 'Failed to compile circuit',
    NETWORK_REQUEST_FAILED: 'Network request failed',
    INVALID_CONFIGURATION: 'Invalid configuration',
    SECURITY_VULNERABILITY_DETECTED: 'Security vulnerability detected',
    TEST_FAILURE: 'Test failed'
};

// Convert CommonJS exports to ESM exports
export {
    ZKError,
    InputError,
    ValidationError,
    AuthorizationError,
    AuthenticationError,
    ProofGenerationError,
    ProofVerificationError,
    CircuitError,
    NetworkError,
    ConfigurationError,
    SecurityVulnerabilityError,
    TestError,
    handleError,
    ErrorConstants
};

// Default export for backwards compatibility
export default {
    ZKError,
    InputError,
    ValidationError,
    AuthorizationError,
    AuthenticationError,
    ProofGenerationError,
    ProofVerificationError,
    CircuitError,
    NetworkError,
    ConfigurationError,
    SecurityVulnerabilityError,
    TestError,
    handleError,
    ErrorConstants
}; 