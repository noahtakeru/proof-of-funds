/**
 * Centralized logging service with structured logging
 * 
 * Supports production and development environments with different formatting
 */
import winston from 'winston';
import config from '../config';

// Define log format based on environment
const logFormat = config.isProduction 
  ? winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  : winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(({ level, message, timestamp, ...meta }) => {
        return `${timestamp} ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
      })
    );

// Create winston logger
const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: { service: 'proof-of-funds-api' },
  transports: [
    // Write logs to console
    new winston.transports.Console()
  ]
});

// Production-specific configuration
if (config.isProduction) {
  // Add error-specific log file
  logger.add(
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' })
  );
  
  // Add combined log file
  logger.add(
    new winston.transports.File({ filename: 'logs/combined.log' })
  );
}

// Log uncaught exceptions and unhandled rejections
winston.exceptions.handle(
  new winston.transports.Console({
    format: logFormat
  })
);

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', { reason, promise });
});

// Export logger instance
export default logger;