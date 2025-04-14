/**
 * Logger utility for ZK tests
 * Provides consistent logging across test modules
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Log levels
export const LOG_LEVELS = {
    TRACE: 0,
    DEBUG: 1,
    INFO: 2,
    WARN: 3,
    ERROR: 4,
    SILENT: 5
};

// ANSI color codes for terminal output
const COLORS = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    underscore: '\x1b[4m',
    blink: '\x1b[5m',
    reverse: '\x1b[7m',
    hidden: '\x1b[8m',
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bgBlack: '\x1b[40m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
    bgCyan: '\x1b[46m',
    bgWhite: '\x1b[47m'
};

/**
 * Logger class for ZK tests
 */
class Logger {
    /**
     * Create a new logger instance
     * @param {Object} options - Logger options
     * @param {number} options.level - Minimum log level to display (from LOG_LEVELS)
     * @param {boolean} options.useColors - Whether to use colors in console output
     * @param {string} options.logFile - Path to log file (if file logging is enabled)
     * @param {boolean} options.logToFile - Whether to log to a file
     * @param {boolean} options.logToConsole - Whether to log to the console
     * @param {string} options.timeFormat - Format for timestamps ('iso', 'local', 'none')
     */
    constructor(options = {}) {
        this.level = options.level !== undefined ? options.level : LOG_LEVELS.INFO;
        this.useColors = options.useColors !== undefined ? options.useColors : true;
        this.logToFile = options.logToFile !== undefined ? options.logToFile : false;
        this.logToConsole = options.logToConsole !== undefined ? options.logToConsole : true;
        this.timeFormat = options.timeFormat || 'iso';

        // Set up file logging if enabled
        if (this.logToFile) {
            const __dirname = path.dirname(fileURLToPath(import.meta.url));
            this.logFile = options.logFile || path.join(__dirname, '../../logs/zk-tests.log');

            // Create logs directory if it doesn't exist
            const logDir = path.dirname(this.logFile);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
        }
    }

    /**
     * Format a timestamp based on the configured time format
     * @returns {string} Formatted timestamp
     */
    getTimestamp() {
        if (this.timeFormat === 'none') return '';

        const now = new Date();
        if (this.timeFormat === 'iso') {
            return now.toISOString();
        } else if (this.timeFormat === 'local') {
            return now.toLocaleString();
        }
        return now.toISOString();
    }

    /**
     * Format a log message
     * @param {string} level - Log level (e.g., 'INFO', 'ERROR')
     * @param {string} message - Log message
     * @param {Object} meta - Additional metadata to include
     * @returns {Object} Formatted log object and string
     */
    formatLog(level, message, meta = {}) {
        const timestamp = this.getTimestamp();
        const prefix = timestamp ? `[${timestamp}] ` : '';
        const logObj = {
            timestamp,
            level,
            message,
            ...meta
        };

        // Create plaintext version
        let plainText = `${prefix}${level}: ${message}`;
        if (Object.keys(meta).length > 0) {
            plainText += ` ${JSON.stringify(meta)}`;
        }

        // Create colored version for console if enabled
        let coloredText = plainText;
        if (this.useColors && this.logToConsole) {
            let color = COLORS.reset;
            switch (level) {
                case 'TRACE':
                    color = COLORS.dim + COLORS.white;
                    break;
                case 'DEBUG':
                    color = COLORS.cyan;
                    break;
                case 'INFO':
                    color = COLORS.green;
                    break;
                case 'WARN':
                    color = COLORS.yellow;
                    break;
                case 'ERROR':
                    color = COLORS.red;
                    break;
                default:
                    color = COLORS.reset;
            }

            coloredText = `${color}${prefix}${COLORS.bright}${level}${COLORS.reset}${color}: ${message}${COLORS.reset}`;
            if (Object.keys(meta).length > 0) {
                coloredText += ` ${COLORS.dim}${JSON.stringify(meta)}${COLORS.reset}`;
            }
        }

        return { logObj, plainText, coloredText };
    }

    /**
     * Write a log entry
     * @param {number} levelValue - Numeric log level value
     * @param {string} levelName - String log level name
     * @param {string} message - Log message
     * @param {Object} meta - Additional metadata
     */
    log(levelValue, levelName, message, meta = {}) {
        // Skip if below configured level
        if (levelValue < this.level) return;

        const { logObj, plainText, coloredText } = this.formatLog(levelName, message, meta);

        // Write to console if enabled
        if (this.logToConsole) {
            if (levelValue >= LOG_LEVELS.ERROR) {
                console.error(coloredText);
            } else if (levelValue >= LOG_LEVELS.WARN) {
                console.warn(coloredText);
            } else {
                console.log(coloredText);
            }
        }

        // Write to file if enabled
        if (this.logToFile && this.logFile) {
            try {
                const logLine = plainText + '\n';
                fs.appendFileSync(this.logFile, logLine);
            } catch (err) {
                console.error(`Failed to write to log file: ${err.message}`);
            }
        }

        return logObj;
    }

    /**
     * Log a message at TRACE level
     * @param {string} message - Log message
     * @param {Object} meta - Additional metadata
     */
    trace(message, meta = {}) {
        return this.log(LOG_LEVELS.TRACE, 'TRACE', message, meta);
    }

    /**
     * Log a message at DEBUG level
     * @param {string} message - Log message
     * @param {Object} meta - Additional metadata
     */
    debug(message, meta = {}) {
        return this.log(LOG_LEVELS.DEBUG, 'DEBUG', message, meta);
    }

    /**
     * Log a message at INFO level
     * @param {string} message - Log message
     * @param {Object} meta - Additional metadata
     */
    info(message, meta = {}) {
        return this.log(LOG_LEVELS.INFO, 'INFO', message, meta);
    }

    /**
     * Log a message at WARN level
     * @param {string} message - Log message
     * @param {Object} meta - Additional metadata
     */
    warn(message, meta = {}) {
        return this.log(LOG_LEVELS.WARN, 'WARN', message, meta);
    }

    /**
     * Log a message at ERROR level
     * @param {string} message - Log message
     * @param {Object} meta - Additional metadata
     */
    error(message, meta = {}) {
        return this.log(LOG_LEVELS.ERROR, 'ERROR', message, meta);
    }

    /**
     * Set the log level
     * @param {number|string} level - Log level (numeric value or key from LOG_LEVELS)
     */
    setLevel(level) {
        if (typeof level === 'string') {
            const levelUpper = level.toUpperCase();
            if (LOG_LEVELS[levelUpper] !== undefined) {
                this.level = LOG_LEVELS[levelUpper];
            }
        } else if (typeof level === 'number') {
            this.level = level;
        }
        return this;
    }

    /**
     * Create a child logger with the same configuration
     * @param {Object} meta - Default metadata to include with all logs from this child
     * @returns {Object} Child logger instance
     */
    child(meta = {}) {
        const childLogger = {};
        const parentLogger = this;

        // Create child methods that include the default metadata
        Object.keys(LOG_LEVELS).forEach(level => {
            const method = level.toLowerCase();
            if (typeof parentLogger[method] === 'function') {
                childLogger[method] = (message, extraMeta = {}) => {
                    return parentLogger[method](message, { ...meta, ...extraMeta });
                };
            }
        });

        // Add non-logging methods
        childLogger.setLevel = (level) => parentLogger.setLevel(level);

        return childLogger;
    }
}

// Create the default logger
const defaultLogger = new Logger();

// Export default instance and constructor
export { Logger };
export default defaultLogger; 