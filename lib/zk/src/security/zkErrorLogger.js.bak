/**
 * @fileoverview ZK Error Logger
 * 
 * Provides robust error logging capabilities for ZK operations,
 * with support for different log levels, formatters, and transport options.
 * 
 * @author ZK Infrastructure Team
 * @created August 2024
 */

import fs from 'fs';
import path from 'path';
import { ZKError, SystemError, ErrorCode } from './zkErrorHandler.mjs';

/**
 * Log levels with numeric severity values
 * @enum {number}
 */
export const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    FATAL: 4,
};

/**
 * String representations of log levels
 * @type {Object<string, string>}
 */
export const LogLevelName = {
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.ERROR]: 'ERROR',
    [LogLevel.FATAL]: 'FATAL',
};

/**
 * ANSI color codes for terminal output
 * @type {Object<string, string>}
 */
export const Colors = {
    RESET: '\x1b[0m',
    BLACK: '\x1b[30m',
    RED: '\x1b[31m',
    GREEN: '\x1b[32m',
    YELLOW: '\x1b[33m',
    BLUE: '\x1b[34m',
    MAGENTA: '\x1b[35m',
    CYAN: '\x1b[36m',
    WHITE: '\x1b[37m',
    BRIGHT_RED: '\x1b[91m',
    BRIGHT_GREEN: '\x1b[92m',
    BRIGHT_YELLOW: '\x1b[93m',
    BRIGHT_BLUE: '\x1b[94m',
    BRIGHT_MAGENTA: '\x1b[95m',
    BRIGHT_CYAN: '\x1b[96m',
    BRIGHT_WHITE: '\x1b[97m',
    BOLD: '\x1b[1m',
    UNDERLINE: '\x1b[4m',
};

/**
 * Log level colors for terminal output
 * @type {Object<number, string>}
 */
export const LogLevelColor = {
    [LogLevel.DEBUG]: Colors.CYAN,
    [LogLevel.INFO]: Colors.GREEN,
    [LogLevel.WARN]: Colors.YELLOW,
    [LogLevel.ERROR]: Colors.RED,
    [LogLevel.FATAL]: Colors.BRIGHT_RED + Colors.BOLD,
};

/**
 * Base log transport interface
 */
export class LogTransport {
    /**
     * Log a message
     * @param {number} level - Log level
     * @param {string} message - Log message
     * @param {Object} [metadata={}] - Additional metadata to log
     */
    log(level, message, metadata = {}) {
        throw new SystemError('LogTransport is an abstract class, implement the log method in a subclass', {
            code: ErrorCode.SYSTEM_METHOD_NOT_IMPLEMENTED,
            operationId: `abstract_log_transport_${Date.now()}`,
            recoverable: false,
            details: {
                transportType: this.constructor.name,
                level,
                message
            }
        });
    }
}

/**
 * Console transport for logs
 * @extends LogTransport
 */
export class ConsoleTransport extends LogTransport {
    /**
     * Create a new console transport
     * @param {Object} [options={}] - Transport options
     * @param {boolean} [options.useColors=true] - Whether to use colors in output
     * @param {Function} [options.formatter] - Custom formatter function
     */
    constructor(options = {}) {
        super();
        this.useColors = options.useColors !== undefined ? options.useColors : true;
        this.formatter = options.formatter || this.defaultFormatter.bind(this);
    }

    /**
     * Default log message formatter
     * @param {number} level - Log level
     * @param {string} message - Log message
     * @param {Object} [metadata={}] - Additional metadata
     * @returns {string} Formatted log message
     */
    defaultFormatter(level, message, metadata = {}) {
        const timestamp = new Date().toISOString();
        const levelName = LogLevelName[level] || 'UNKNOWN';

        let formattedMessage = `[${timestamp}] [${levelName}] ${message}`;

        if (Object.keys(metadata).length > 0) {
            formattedMessage += ` ${JSON.stringify(metadata)}`;
        }

        if (this.useColors) {
            const color = LogLevelColor[level] || '';
            formattedMessage = `${color}${formattedMessage}${Colors.RESET}`;
        }

        return formattedMessage;
    }

    /**
     * Log a message to the console
     * @param {number} level - Log level
     * @param {string} message - Log message
     * @param {Object} [metadata={}] - Additional metadata
     */
    log(level, message, metadata = {}) {
        try {
            const formattedMessage = this.formatter(level, message, metadata);

            switch (level) {
                case LogLevel.DEBUG:
                    console.debug(formattedMessage);
                    break;
                case LogLevel.INFO:
                    console.info(formattedMessage);
                    break;
                case LogLevel.WARN:
                    console.warn(formattedMessage);
                    break;
                case LogLevel.ERROR:
                case LogLevel.FATAL:
                    console.error(formattedMessage);
                    break;
                default:
                    console.log(formattedMessage);
            }
        } catch (error) {
            const loggingError = new SystemError(`ConsoleTransport logging failed: ${error.message}`, {
                code: ErrorCode.SYSTEM_OPERATION_FAILED,
                operationId: `console_transport_log_${Date.now()}`,
                recoverable: true,
                details: {
                    level,
                    message,
                    metadata,
                    originalError: error.message
                }
            });

            // Fallback logging to avoid infinite recursion
            console.error(`[ERROR] ConsoleTransport failed: ${loggingError.message}`);
        }
    }
}

/**
 * File transport for logs
 * @extends LogTransport
 */
export class FileTransport extends LogTransport {
    /**
     * Create a new file transport
     * @param {Object} options - Transport options
     * @param {string} options.filename - Log file path
     * @param {boolean} [options.append=true] - Whether to append to the file
     * @param {Function} [options.formatter] - Custom formatter function
     */
    constructor(options) {
        super();
        if (!options || !options.filename) {
            throw new SystemError('FileTransport requires a filename option', {
                code: ErrorCode.SYSTEM_INVALID_CONFIGURATION,
                operationId: `file_transport_init_${Date.now()}`,
                recoverable: false,
                details: { options }
            });
        }

        this.filename = options.filename;
        this.append = options.append !== undefined ? options.append : true;
        this.formatter = options.formatter || this.defaultFormatter.bind(this);

        try {
            // Ensure directory exists
            const dir = path.dirname(this.filename);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Initialize file
            if (!this.append && fs.existsSync(this.filename)) {
                fs.unlinkSync(this.filename);
            }
        } catch (error) {
            throw new SystemError(`Failed to initialize log file: ${error.message}`, {
                code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
                operationId: `file_transport_init_${Date.now()}`,
                recoverable: false,
                details: {
                    filename: this.filename,
                    originalError: error.message
                }
            });
        }
    }

    /**
     * Default log message formatter
     * @param {number} level - Log level
     * @param {string} message - Log message
     * @param {Object} [metadata={}] - Additional metadata
     * @returns {string} Formatted log message
     */
    defaultFormatter(level, message, metadata = {}) {
        const timestamp = new Date().toISOString();
        const levelName = LogLevelName[level] || 'UNKNOWN';

        let formattedMessage = `[${timestamp}] [${levelName}] ${message}`;

        if (Object.keys(metadata).length > 0) {
            formattedMessage += ` ${JSON.stringify(metadata, null, 0)}`;
        }

        return formattedMessage;
    }

    /**
     * Log a message to the file
     * @param {number} level - Log level
     * @param {string} message - Log message
     * @param {Object} [metadata={}] - Additional metadata
     */
    log(level, message, metadata = {}) {
        try {
            const formattedMessage = this.formatter(level, message, metadata) + '\n';
            fs.appendFileSync(this.filename, formattedMessage);
        } catch (error) {
            const fileError = new SystemError(`Failed to write to log file ${this.filename}: ${error.message}`, {
                code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
                operationId: `file_transport_log_${Date.now()}`,
                recoverable: true,
                details: {
                    filename: this.filename,
                    level,
                    message,
                    metadata,
                    originalError: error.message
                }
            });

            // Fallback to console
            console.error(fileError.message);
        }
    }
}

/**
 * ZK Error Logger class
 */
export class ZKErrorLogger {
    /**
     * Create a new ZK Error Logger
     * @param {Object} [options={}] - Logger options
     * @param {number} [options.minLevel=LogLevel.INFO] - Minimum log level to record
     * @param {LogTransport[]} [options.transports=[]] - Log transports
     * @param {Object} [options.metadata={}] - Global metadata to include with all logs
     */
    constructor(options = {}) {
        this.minLevel = options.minLevel !== undefined ? options.minLevel : LogLevel.INFO;
        this.transports = options.transports || [new ConsoleTransport()];
        this.metadata = options.metadata || {};
        this.operationId = `logger_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    }

    /**
     * Add a transport to the logger
     * @param {LogTransport} transport - Transport to add
     * @returns {ZKErrorLogger} - Returns this for method chaining
     */
    addTransport(transport) {
        if (!(transport instanceof LogTransport)) {
            throw new SystemError('Transport must be an instance of LogTransport', {
                code: ErrorCode.SYSTEM_INVALID_PARAMETER,
                operationId: `add_transport_${this.operationId}`,
                recoverable: false,
                details: { transportType: typeof transport }
            });
        }

        this.transports.push(transport);
        return this;
    }

    /**
     * Remove a transport from the logger
     * @param {LogTransport} transport - Transport to remove
     * @returns {ZKErrorLogger} - Returns this for method chaining
     */
    removeTransport(transport) {
        const index = this.transports.indexOf(transport);
        if (index !== -1) {
            this.transports.splice(index, 1);
        }
        return this;
    }

    /**
     * Set the minimum log level
     * @param {number} level - Log level
     * @returns {ZKErrorLogger} - Returns this for method chaining
     */
    setMinLevel(level) {
        this.minLevel = level;
        return this;
    }

    /**
     * Add global metadata to include with all logs
     * @param {Object} metadata - Metadata to add
     * @returns {ZKErrorLogger} - Returns this for method chaining
     */
    addMetadata(metadata) {
        this.metadata = {
            ...this.metadata,
            ...metadata
        };
        return this;
    }

    /**
     * Log a message at the specified level
     * @param {number} level - Log level
     * @param {string} message - Log message
     * @param {Object} [metadata={}] - Additional metadata
     * @returns {ZKErrorLogger} - Returns this for method chaining
     */
    log(level, message, metadata = {}) {
        if (level < this.minLevel) {
            return this;
        }

        try {
            const combinedMetadata = {
                ...this.metadata,
                ...metadata,
                timestamp: new Date().toISOString(),
                loggerId: this.operationId
            };

            for (const transport of this.transports) {
                try {
                    transport.log(level, message, combinedMetadata);
                } catch (transportError) {
                    console.error(`Transport error: ${transportError.message}`);
                }
            }
        } catch (error) {
            // Fallback logging to avoid recursion
            console.error(`[CRITICAL] Logger error: ${error.message}`);
        }

        return this;
    }

    /**
     * Log a debug message
     * @param {string} message - Log message
     * @param {Object} [metadata={}] - Additional metadata
     * @returns {ZKErrorLogger} - Returns this for method chaining
     */
    debug(message, metadata = {}) {
        return this.log(LogLevel.DEBUG, message, metadata);
    }

    /**
     * Log an info message
     * @param {string} message - Log message
     * @param {Object} [metadata={}] - Additional metadata
     * @returns {ZKErrorLogger} - Returns this for method chaining
     */
    info(message, metadata = {}) {
        return this.log(LogLevel.INFO, message, metadata);
    }

    /**
     * Log a warning message
     * @param {string} message - Log message
     * @param {Object} [metadata={}] - Additional metadata
     * @returns {ZKErrorLogger} - Returns this for method chaining
     */
    warn(message, metadata = {}) {
        return this.log(LogLevel.WARN, message, metadata);
    }

    /**
     * Log an error message or a ZKError object
     * @param {string|Error|ZKError} messageOrError - Message or error to log
     * @param {Object} [metadata={}] - Additional metadata
     * @returns {ZKErrorLogger} - Returns this for method chaining
     */
    error(messageOrError, metadata = {}) {
        try {
            let errorMessage;
            let errorMetadata = { ...metadata };

            if (messageOrError instanceof Error) {
                errorMessage = messageOrError.message;

                // Add additional info for ZKError instances
                if (messageOrError instanceof ZKError) {
                    errorMetadata = {
                        ...errorMetadata,
                        errorCode: messageOrError.code,
                        errorName: messageOrError.name,
                        operationId: messageOrError.operationId,
                        recoverable: messageOrError.recoverable,
                        details: messageOrError.details
                    };

                    // Include original error if present
                    if (messageOrError.originalError) {
                        errorMetadata.originalError = typeof messageOrError.originalError === 'object'
                            ? messageOrError.originalError.message
                            : messageOrError.originalError;
                    }
                } else {
                    // For standard errors, include stack trace
                    errorMetadata.stack = messageOrError.stack;
                    errorMetadata.errorName = messageOrError.name;
                }
            } else {
                errorMessage = String(messageOrError);
            }

            return this.log(LogLevel.ERROR, errorMessage, errorMetadata);
        } catch (error) {
            // Fallback error logging
            console.error(`Failed to log error: ${error.message}`);
            console.error(`Original error: ${messageOrError instanceof Error ? messageOrError.message : messageOrError}`);
            return this;
        }
    }

    /**
     * Log a fatal error message
     * @param {string|Error|ZKError} messageOrError - Message or error to log
     * @param {Object} [metadata={}] - Additional metadata
     * @returns {ZKErrorLogger} - Returns this for method chaining
     */
    fatal(messageOrError, metadata = {}) {
        try {
            let errorMessage;
            let errorMetadata = {
                ...metadata,
                fatal: true
            };

            if (messageOrError instanceof Error) {
                errorMessage = messageOrError.message;

                // Add additional info for ZKError instances
                if (messageOrError instanceof ZKError) {
                    errorMetadata = {
                        ...errorMetadata,
                        errorCode: messageOrError.code,
                        errorName: messageOrError.name,
                        operationId: messageOrError.operationId,
                        recoverable: messageOrError.recoverable,
                        details: messageOrError.details
                    };

                    // Include original error if present
                    if (messageOrError.originalError) {
                        errorMetadata.originalError = typeof messageOrError.originalError === 'object'
                            ? messageOrError.originalError.message
                            : messageOrError.originalError;
                    }
                } else {
                    // For standard errors, include stack trace
                    errorMetadata.stack = messageOrError.stack;
                    errorMetadata.errorName = messageOrError.name;
                }
            } else {
                errorMessage = String(messageOrError);
            }

            return this.log(LogLevel.FATAL, errorMessage, errorMetadata);
        } catch (error) {
            // Fallback fatal error logging
            console.error(`[FATAL] ${messageOrError instanceof Error ? messageOrError.message : messageOrError}`);
            console.error(`Failed to log fatal error: ${error.message}`);
            return this;
        }
    }

    /**
     * Log an error with stack trace
     * @param {Error} error - Error to log
     * @param {Object} [metadata={}] - Additional metadata
     * @returns {ZKErrorLogger} - Returns this for method chaining
     */
    logError(error, metadata = {}) {
        return this.error(error, metadata);
    }
}

// Create a default logger instance
const zkErrorLogger = new ZKErrorLogger();

// Export logger instance and classes
export { zkErrorLogger };
export default zkErrorLogger; 