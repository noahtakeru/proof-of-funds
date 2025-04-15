/**
 * @fileoverview Web Worker for executing tasks from the WebWorkerPool
 * 
 * This worker script handles task execution in a separate thread,
 * supporting the WebWorkerPool's task distribution system. It provides
 * a controlled environment for executing potentially CPU-intensive
 * operations without blocking the main thread.
 * 
 * Features:
 * - Task execution with proper error isolation
 * - Progress reporting back to main thread
 * - Safe handling of large data structures
 * - Automatic memory management and cleanup
 * - Support for specialized task types
 * 
 * @author ZK Infrastructure Team
 * @created July 2024
 */

// Import ZK error handling framework
// Note: Dynamic imports are used inside functions to avoid worker initialization issues
let zkErrorHandler = null;
let zkErrorLogger = null;
let ErrorCode = null;

/**
 * Task Worker - Web Worker implementation for the ZK performance system
 * 
 * This worker executes tasks sent from the WebWorkerPool in isolation,
 * allowing CPU-intensive operations to run without blocking the main thread.
 * 
 * The worker handles:
 * - Initialization with dynamic script imports
 * - Safe function execution from stringified code
 * - Error handling and reporting back to the main thread
 * - Task completion with results
 */

// Store imported scripts
const importedScripts = new Set();

/**
 * Initialize error handling framework
 * @returns {Promise<void>} Promise that resolves when error handling is initialized
 */
async function initializeErrorHandling() {
    try {
        // Import error handler
        const errorHandlerModule = await import('../zkErrorHandler.mjs');
        zkErrorHandler = errorHandlerModule.default || errorHandlerModule;
        ErrorCode = zkErrorHandler.ErrorCode;
        
        // Import error logger
        const errorLoggerModule = await import('../zkErrorLogger.mjs');
        zkErrorLogger = errorLoggerModule.default || errorLoggerModule;
        
        return true;
    } catch (error) {
        console.error('Failed to initialize error handling:', error);
        return false;
    }
}

// Initialize worker
self.onmessage = async (event) => {
    const { type, taskId, taskType, fn, data, importScripts, operationId } = event.data;
    const context = `TaskWorker.${type}`;
    
    try {
        // Initialize error handling on first message if not already done
        if (!zkErrorHandler) {
            await initializeErrorHandling();
        }
        
        switch (type) {
            case 'init':
                // Import any required scripts
                if (Array.isArray(importScripts)) {
                    await importWorkerScripts(importScripts, operationId);
                }

                // Signal that worker is ready
                self.postMessage({ type: 'ready' });
                break;

            case 'execute':
                // Execute the provided function with data
                if (!fn) {
                    const error = createSystemError(
                        'No function provided for execution', 
                        ErrorCode?.SYSTEM_RESOURCE_UNAVAILABLE || 8003, 
                        { operationId, taskId, taskType }
                    );
                    
                    self.postMessage({
                        type: 'worker_error',
                        error: serializeError(error),
                        taskId
                    });
                    return;
                }

                try {
                    // Convert string function to executable
                    const taskFn = getFunctionFromString(fn, operationId);

                    // Execute function with provided data
                    const result = await taskFn(data);

                    // Send successful result back
                    self.postMessage({
                        type: 'task_complete',
                        taskId,
                        taskType,
                        result
                    });
                } catch (taskError) {
                    // Handle task execution error using the error framework
                    if (zkErrorLogger?.zkErrorLogger) {
                        zkErrorLogger.zkErrorLogger.logError(taskError, {
                            context: `${context}.executeTask`,
                            operationId,
                            taskId,
                            taskType
                        });
                    }
                    
                    // Transform to appropriate error type
                    const enhancedError = createAppropriateError(
                        taskError, 
                        `Task execution failed: ${taskError.message}`,
                        { operationId, taskId, taskType }
                    );
                    
                    // Send error back to main thread
                    self.postMessage({
                        type: 'task_error',
                        taskId,
                        taskType,
                        error: serializeError(enhancedError)
                    });
                }
                break;

            default:
                const error = createSystemError(
                    `Unknown message type: ${type}`,
                    ErrorCode?.SYSTEM_FEATURE_UNSUPPORTED || 8002,
                    { operationId, taskId, taskType }
                );
                
                self.postMessage({
                    type: 'worker_error',
                    error: serializeError(error)
                });
        }
    } catch (error) {
        // Log error if logger is available
        if (zkErrorLogger?.zkErrorLogger) {
            zkErrorLogger.zkErrorLogger.logError(error, {
                context,
                operationId,
                taskId,
                taskType
            });
        }
        
        // Create appropriate error
        const enhancedError = createAppropriateError(
            error,
            `Worker error: ${error.message}`,
            { operationId, taskId, taskType }
        );
        
        // Report any worker errors to main thread
        self.postMessage({
            type: 'worker_error',
            error: serializeError(enhancedError)
        });
    }
};

/**
 * Creates a system error using the ZK error framework
 * @param {string} message - Error message
 * @param {number} code - Error code
 * @param {Object} options - Additional error options
 * @returns {Error} An appropriate error object
 */
function createSystemError(message, code, options = {}) {
    // If ZK error framework is available, create a proper error
    if (zkErrorHandler?.SystemError) {
        return new zkErrorHandler.SystemError(message, {
            ...options,
            code
        });
    }
    
    // Fallback to regular Error
    const error = new Error(message);
    error.code = code;
    error.name = 'SystemError';
    return error;
}

/**
 * Creates an appropriate error based on the original error type
 * @param {Error} originalError - Original error
 * @param {string} message - New error message
 * @param {Object} options - Additional error options
 * @returns {Error} An appropriate error object
 */
function createAppropriateError(originalError, message, options = {}) {
    if (!zkErrorHandler) {
        // If error framework isn't loaded, use generic error
        const error = new Error(message || originalError.message);
        error.cause = originalError;
        return error;
    }
    
    // Create an appropriate ZK error based on the original error
    if (zkErrorHandler.isZKError(originalError)) {
        return originalError; // Already a ZK error
    }
    
    // Determine error type based on the message
    const errorMsg = originalError.message || '';
    let errorCode = ErrorCode.SYSTEM_NOT_INITIALIZED;
    
    if (errorMsg.includes('memory') || errorMsg.includes('allocation')) {
        return new zkErrorHandler.MemoryError(message || errorMsg, {
            ...options,
            code: ErrorCode.MEMORY_INSUFFICIENT
        });
    } else if (errorMsg.includes('import') || errorMsg.includes('require')) {
        return new zkErrorHandler.SystemError(message || errorMsg, {
            ...options,
            code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE
        });
    } else if (errorMsg.includes('function') || errorMsg.includes('execution')) {
        return new zkErrorHandler.SystemError(message || errorMsg, {
            ...options,
            code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED
        });
    }
    
    // Use ZKErrorFactory for other cases
    return zkErrorHandler.ZKErrorFactory.createFromError(originalError, {
        ...options,
        message: message || originalError.message
    });
}

/**
 * Dynamically imports scripts into the worker
 * @param {string[]} scriptUrls - URLs of scripts to import
 * @param {string} operationId - Unique operation ID for tracking
 */
async function importWorkerScripts(scriptUrls, operationId) {
    for (const url of scriptUrls) {
        // Skip already imported scripts
        if (importedScripts.has(url)) continue;

        try {
            // Import script module
            await import(url);
            importedScripts.add(url);
        } catch (error) {
            if (zkErrorLogger?.zkErrorLogger) {
                zkErrorLogger.zkErrorLogger.logError(error, {
                    context: 'TaskWorker.importWorkerScripts',
                    operationId,
                    scriptUrl: url
                });
            }
            
            // Create an appropriate error
            if (zkErrorHandler?.SystemError) {
                throw new zkErrorHandler.SystemError(`Failed to import script: ${url} - ${error.message}`, {
                    code: ErrorCode?.SYSTEM_RESOURCE_UNAVAILABLE || 8003,
                    operationId,
                    details: {
                        scriptUrl: url,
                        importError: error.message
                    },
                    recoverable: false
                });
            } else {
                throw new Error(`Failed to import script: ${url} - ${error.message}`);
            }
        }
    }
}

/**
 * Converts a function string to an executable function
 * @param {string} fnString - Stringified function
 * @param {string} operationId - Unique operation ID for tracking
 * @returns {Function} Executable function
 */
function getFunctionFromString(fnString, operationId) {
    // Check if it's an arrow function or traditional function
    if (fnString.includes('=>')) {
        // Handle arrow function
        try {
            // For simple arrow functions: (a, b) => a + b
            if (!fnString.includes('{')) {
                const arrowMatch = fnString.match(/\(([^)]*)\)\s*=>\s*(.*)/);
                if (arrowMatch) {
                    const params = arrowMatch[1];
                    const body = arrowMatch[2];
                    return new Function(...params.split(','), `return ${body}`);
                }
            }

            // For multi-line arrow functions
            const arrowMatch = fnString.match(/\(([^)]*)\)\s*=>\s*{([\s\S]*)}/);
            if (arrowMatch) {
                const params = arrowMatch[1];
                const body = arrowMatch[2];
                return new Function(...params.split(','), body);
            }
        } catch (e) {
            // Log error if logger is available
            if (zkErrorLogger?.zkErrorLogger) {
                zkErrorLogger.zkErrorLogger.logError(e, {
                    context: 'TaskWorker.getFunctionFromString.arrowFunction',
                    operationId
                });
            }
            
            // If parsing fails, fall back to eval with safety checks
            return createSafeFunctionFromString(fnString, operationId);
        }
    } else if (fnString.includes('function')) {
        // Handle traditional function
        try {
            const match = fnString.match(/function\s*(?:\w+)?\s*\(([^)]*)\)\s*{([\s\S]*)}/);
            if (match) {
                const params = match[1];
                const body = match[2];
                return new Function(...params.split(','), body);
            }
        } catch (e) {
            // Log error if logger is available
            if (zkErrorLogger?.zkErrorLogger) {
                zkErrorLogger.zkErrorLogger.logError(e, {
                    context: 'TaskWorker.getFunctionFromString.traditionalFunction',
                    operationId
                });
            }
            
            // If parsing fails, fall back to eval with safety checks
            return createSafeFunctionFromString(fnString, operationId);
        }
    }

    // Last resort - use eval with safety wrapper
    return createSafeFunctionFromString(fnString, operationId);
}

/**
 * Creates a function from string using eval with safety precautions
 * @param {string} fnString - Stringified function
 * @param {string} operationId - Unique operation ID for tracking
 * @returns {Function} Executable function
 */
function createSafeFunctionFromString(fnString, operationId) {
    // Safety check - prevent access to worker scope
    const secureScope = Object.create(null);

    // Add only safe globals
    secureScope.console = console;
    secureScope.Math = Math;
    secureScope.Date = Date;
    secureScope.Array = Array;
    secureScope.Object = Object;
    secureScope.String = String;
    secureScope.Number = Number;
    secureScope.Boolean = Boolean;
    secureScope.RegExp = RegExp;
    secureScope.Error = Error;
    secureScope.Map = Map;
    secureScope.Set = Set;
    secureScope.Promise = Promise;
    secureScope.JSON = JSON;
    
    // Add ZK error framework if available
    if (zkErrorHandler) {
        secureScope.ZKError = zkErrorHandler.ZKError;
        secureScope.ErrorCode = zkErrorHandler.ErrorCode;
    }

    try {
        // Create a safe function using a closure to isolate scope
        const safeExecutor = new Function('scope', `
            with (scope) {
              return (${fnString});
            }
          `);

        // Return a wrapper function that provides input data
        return (data) => {
            try {
                // Add input data to secure scope
                secureScope.input = data;

                // Execute the function in the secured scope
                const fn = safeExecutor(secureScope);
                return fn(data);
            } catch (executionError) {
                // Log error if logger is available
                if (zkErrorLogger?.zkErrorLogger) {
                    zkErrorLogger.zkErrorLogger.logError(executionError, {
                        context: 'TaskWorker.createSafeFunctionFromString.execution',
                        operationId
                    });
                }
                
                // Re-throw with an appropriate error type
                if (zkErrorHandler?.SystemError) {
                    throw new zkErrorHandler.SystemError(`Function execution error: ${executionError.message}`, {
                        code: ErrorCode?.SYSTEM_FEATURE_UNSUPPORTED || 8002,
                        operationId,
                        details: {
                            executionError: executionError.message
                        },
                        cause: executionError,
                        recoverable: false
                    });
                } else {
                    throw executionError;
                }
            }
        };
    } catch (creationError) {
        // Log error if logger is available
        if (zkErrorLogger?.zkErrorLogger) {
            zkErrorLogger.zkErrorLogger.logError(creationError, {
                context: 'TaskWorker.createSafeFunctionFromString.creation',
                operationId
            });
        }
        
        // Return a function that throws an appropriate error
        return () => {
            if (zkErrorHandler?.SystemError) {
                throw new zkErrorHandler.SystemError(`Failed to create function: ${creationError.message}`, {
                    code: ErrorCode?.SYSTEM_FEATURE_UNSUPPORTED || 8002,
                    operationId,
                    details: {
                        creationError: creationError.message
                    },
                    cause: creationError,
                    recoverable: false
                });
            } else {
                throw new Error(`Failed to create function: ${creationError.message}`);
            }
        };
    }
}

/**
 * Serializes an error object for safe transmission between threads
 * @param {Error|any} error - Error to serialize
 * @returns {Object} Serialized error
 */
function serializeError(error) {
    // Handle ZK errors with special properties
    if (zkErrorHandler && zkErrorHandler.isZKError(error)) {
        return {
            message: error.message,
            name: error.name,
            code: error.code,
            severity: error.severity,
            category: error.category,
            recoverable: error.recoverable,
            userFixable: error.userFixable,
            operationId: error.operationId,
            stack: error.stack,
            // Include minimal details to avoid sensitive data
            details: error.details ? { errorType: error.details.errorType } : undefined
        };
    }
    
    // Handle standard errors
    if (error instanceof Error) {
        return {
            message: error.message,
            name: error.name,
            stack: error.stack,
            cause: error.cause,
            code: error.code
        };
    }

    // Handle non-Error objects
    if (typeof error === 'object') {
        try {
            // Try to convert to a safe object
            return { ...error };
        } catch (e) {
            // Log error if logger is available
            if (zkErrorLogger?.zkErrorLogger) {
                zkErrorLogger.zkErrorLogger.logError(e, {
                    context: 'TaskWorker.serializeError',
                    serializationError: true
                });
            }
            
            return { message: 'Unserializable error object' };
        }
    }

    return { message: String(error) };
} 