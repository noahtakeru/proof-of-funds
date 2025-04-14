/**
 * Logger utility for ZK tests
 * 
 * Provides consistent logging across test modules with:
 * - Log levels (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
 * - Terminal colors for better readability
 * - File output options
 * - Child loggers with namespaces
 * - Error handling integration
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Define log levels
export const LogLevel = {
    TRACE: 0,
    DEBUG: 1,
    INFO: 2,
    WARN: 3,
    ERROR: 4,
    SILENT: 5
};

// Color codes for terminal output
export const Colors = {
    RESET: '\x1b[0m',
    BRIGHT: '\x1b[1m',
    DIM: '\x1b[2m',
    UNDERSCORE: '\x1b[4m',
    BLINK: '\x1b[5m',
    REVERSE: '\x1b[7m',
    HIDDEN: '\x1b[8m',

    FG_BLACK: '\x1b[30m',
    FG_RED: '\x1b[31m',
    FG_GREEN: '\x1b[32m',
    FG_YELLOW: '\x1b[33m',
    FG_BLUE: '\x1b[34m',
    FG_MAGENTA: '\x1b[35m',
    FG_CYAN: '\x1b[36m',
    FG_WHITE: '\x1b[37m',

    BG_BLACK: '\x1b[40m',
    BG_RED: '\x1b[41m',
    BG_GREEN: '\x1b[42m',
    BG_YELLOW: '\x1b[43m',
    BG_BLUE: '\x1b[44m',
    BG_MAGENTA: '\x1b[45m',
    BG_CYAN: '\x1b[46m',
    BG_WHITE: '\x1b[47m'
};

/**
 * Logger class for ZK tests
 */
export class Logger {
    /**
     * Create a new logger
     * @param {Object} options Logger configuration
     * @param {number} options.level Minimum log level to output
     * @param {boolean} options.useColors Whether to use colors in console output
     * @param {boolean|string} options.logToFile Whether to log to file and optionally the file path
     * @param {string} options.timestampFormat Format for timestamps
     * @param {string} options.namespace Namespace for this logger
     * @param {Object} options.metadata Default metadata to include with logs
     */
    constructor(options = {}) {
        this.level = options.level !== undefined ? options.level : LogLevel.INFO;
        this.useColors = options.useColors !== undefined ? options.useColors : true;
        this.logToFile = options.logToFile !== undefined ? options.logToFile : false;
        this.timestampFormat = options.timestampFormat || 'ISO';
        this.namespace = options.namespace || '';
        this.metadata = options.metadata || {};

        // Determine log file path if logging to file
        if (this.logToFile) {
            if (typeof this.logToFile === 'string') {
                this.logFilePath = this.logToFile;
            } else {
                // Default log file location
                const __dirname = path.dirname(fileURLToPath(import.meta.url));
                this.logFilePath = path.resolve(__dirname, '../../logs/zk.log');

                // Ensure logs directory exists
                const logsDir = path.dirname(this.logFilePath);
                if (!fs.existsSync(logsDir)) {
                    fs.mkdirSync(logsDir, { recursive: true });
                }
            }
        }

        // Set up log level names for easier reference
        this.levelNames = Object.keys(LogLevel);
    }

    /**
     * Format timestamp according to configuration
     * @returns {string} Formatted timestamp
     */
    formatTimestamp() {
        const now = new Date();

        if (this.timestampFormat === 'ISO') {
            return now.toISOString();
        } else if (this.timestampFormat === 'simple') {
            return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
        } else {
            return now.toISOString();
        }
    }

    /**
     * Format a log message
     * @param {string} level Log level
     * @param {string} message Log message
     * @param {Object} metadata Additional metadata
     * @returns {string} Formatted log message
     */
    formatLogMessage(level, message, metadata = {}) {
        const timestamp = this.formatTimestamp();
        let prefix = `[${timestamp}] [${level}]`;

        if (this.namespace) {
            prefix += ` [${this.namespace}]`;
        }

        // Combine default metadata with log-specific metadata
        const mergedMetadata = { ...this.metadata, ...metadata };
        let metadataStr = '';

        if (Object.keys(mergedMetadata).length > 0) {
            try {
                metadataStr = ' ' + JSON.stringify(mergedMetadata);
            } catch (e) {
                metadataStr = ' [metadata serialization error]';
            }
        }

        return `${prefix} ${message}${metadataStr}`;
    }

    /**
     * Add colors to a log message for console output
     * @param {string} level Log level
     * @param {string} message Formatted log message
     * @returns {string} Colorized log message
     */
    colorize(level, message) {
        if (!this.useColors) {
            return message;
        }

        switch (level) {
            case 'TRACE':
                return `${Colors.FG_CYAN}${message}${Colors.RESET}`;
            case 'DEBUG':
                return `${Colors.FG_BLUE}${message}${Colors.RESET}`;
            case 'INFO':
                return `${Colors.FG_GREEN}${message}${Colors.RESET}`;
            case 'WARN':
                return `${Colors.FG_YELLOW}${message}${Colors.RESET}`;
            case 'ERROR':
                return `${Colors.FG_RED}${message}${Colors.RESET}`;
            default:
                return message;
        }
    }

    /**
     * Write a log message to the configured outputs
     * @param {number} levelValue Numeric log level value
     * @param {string} levelName String log level name
     * @param {string} message Log message
     * @param {Object} metadata Additional metadata
     */
    log(levelValue, levelName, message, metadata = {}) {
        // Skip if the log level is below the configured minimum
        if (levelValue < this.level) {
            return;
        }

        // Format the log message
        const formattedMessage = this.formatLogMessage(levelName, message, metadata);

        // Write to console
        const consoleMethod = levelValue >= LogLevel.ERROR
            ? console.error
            : levelValue >= LogLevel.WARN
                ? console.warn
                : levelValue >= LogLevel.INFO
                    ? console.info
                    : console.log;

        consoleMethod(this.colorize(levelName, formattedMessage));

        // Write to file if configured
        if (this.logToFile) {
            this.writeToFile(formattedMessage);
        }
    }

    /**
     * Write a log message to file
     * @param {string} message Formatted log message
     */
    writeToFile(message) {
        try {
            fs.appendFileSync(this.logFilePath, message + '\n', 'utf8');
        } catch (error) {
            console.error(`Error writing to log file: ${error.message}`);
        }
    }

    /**
     * Set the minimum log level
     * @param {number|string} level Log level (number or name)
     */
    setLevel(level) {
        if (typeof level === 'string') {
            const levelUpper = level.toUpperCase();
            if (LogLevel[levelUpper] !== undefined) {
                this.level = LogLevel[levelUpper];
            }
        } else if (typeof level === 'number' && level >= LogLevel.TRACE && level <= LogLevel.SILENT) {
            this.level = level;
        }
    }

    /**
     * Create a child logger with a specific namespace
     * @param {string} namespace Namespace for the child logger
     * @param {Object} metadata Default metadata for the child logger
     * @returns {Logger} Child logger instance
     */
    child(namespace, metadata = {}) {
        return new Logger({
            level: this.level,
            useColors: this.useColors,
            logToFile: this.logToFile,
            timestampFormat: this.timestampFormat,
            namespace: this.namespace ? `${this.namespace}:${namespace}` : namespace,
            metadata: { ...this.metadata, ...metadata }
        });
    }

    /**
     * Log a trace message
     * @param {string} message Log message
     * @param {Object} metadata Additional metadata
     */
    trace(message, metadata = {}) {
        this.log(LogLevel.TRACE, 'TRACE', message, metadata);
    }

    /**
     * Log a debug message
     * @param {string} message Log message
     * @param {Object} metadata Additional metadata
     */
    debug(message, metadata = {}) {
        this.log(LogLevel.DEBUG, 'DEBUG', message, metadata);
    }

    /**
     * Log an info message
     * @param {string} message Log message
     * @param {Object} metadata Additional metadata
     */
    info(message, metadata = {}) {
        this.log(LogLevel.INFO, 'INFO', message, metadata);
    }

    /**
     * Log a warning message
     * @param {string} message Log message
     * @param {Object} metadata Additional metadata
     */
    warn(message, metadata = {}) {
        this.log(LogLevel.WARN, 'WARN', message, metadata);
    }

    /**
     * Log an error message
     * @param {string} message Log message
     * @param {Object} metadata Additional metadata
     */
    error(message, metadata = {}) {
        this.log(LogLevel.ERROR, 'ERROR', message, metadata);
    }

    /**
     * Log an error object
     * @param {Error} error Error object
     * @param {string} message Optional message to prepend
     * @param {Object} metadata Additional metadata
     */
    logError(error, message = '', metadata = {}) {
        const errorMessage = message
            ? `${message}: ${error.message}`
            : error.message;

        const errorMetadata = {
            ...metadata,
            stack: error.stack,
            name: error.name
        };

        // Include cause if it exists
        if (error.cause) {
            errorMetadata.cause = error.cause instanceof Error
                ? error.cause.message
                : String(error.cause);
        }

        this.error(errorMessage, errorMetadata);
    }

    /**
     * Log a message only once, using a unique key to track
     * @param {string} key Unique key for this message
     * @param {string} message Log message
     * @param {string} level Log level name
     * @param {Object} metadata Additional metadata
     */
    logOnce(key, message, level = 'INFO', metadata = {}) {
        if (!Logger.loggedKeys) {
            Logger.loggedKeys = new Set();
        }

        if (!Logger.loggedKeys.has(key)) {
            Logger.loggedKeys.add(key);

            const levelName = level.toUpperCase();
            const levelValue = LogLevel[levelName] !== undefined
                ? LogLevel[levelName]
                : LogLevel.INFO;

            this.log(levelValue, levelName, message, { ...metadata, once: key });
        }
    }
}

// Create a default logger instance
const defaultLogger = new Logger();

// Export the default logger and the Logger class
export { defaultLogger as logger };
export default defaultLogger; 