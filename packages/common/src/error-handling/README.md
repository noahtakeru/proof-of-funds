# Error Handling System

This directory contains the error handling system for the Zero-Knowledge proof generation components. The system is designed to provide robust error logging without using mock or placeholder implementations, following the token-agnostic wallet scanning plan rules.

## Key Components

### 1. Safe Logger Initialization

The `initializeErrorLogger.js` module provides a safe logger initialization that:
- Creates a proper ZKErrorLogger instance with appropriate configuration
- Includes a robust fallback to console logging if initialization fails
- Exports a singleton instance for consistent usage throughout the application
- Registers the logger with the error handler system

### 2. Error Handler System

The `zkErrorHandler.mjs` module provides:
- A comprehensive ZK error class hierarchy
- Structured error representation
- Classification of errors by category and severity
- Error factory functions for creating specific error types
- A getErrorLogger function that safely returns the logger instance

### 3. Logger Availability & Reliability

The system implements multiple layers of fallbacks:
- In-memory logger reference with fallback to console logging
- Logger retrieval functions that never throw exceptions
- CommonJS-compatible logger exports (`logger.cjs`)
- Pre-initialization utility for application entry points
- Guaranteed logger access through `ensureLogger.js`

## Usage Guidelines

1. **In ESM Modules:**
   ```javascript
   import { safeLogger } from '../error-handling/initializeErrorLogger.js';
   
   try {
     // Your code here
   } catch (error) {
     safeLogger.logError(error, { context: 'your-module-name' });
   }
   ```

2. **In CommonJS Modules:**
   ```javascript
   const { logError } = require('../error-handling/logger.cjs');
   
   try {
     // Your code here
   } catch (error) {
     logError(error, { context: 'your-module-name' });
   }
   ```

3. **Early Initialization:**
   For application entry points, import the pre-initialization module:
   ```javascript
   import '../error-handling/preInitialize.js';
   ```

4. **Guaranteed Logger Access:**
   ```javascript
   import { getLogger } from '../error-handling/ensureLogger.js';
   
   const logger = getLogger();
   logger.info('System initialized');
   ```

## Error Handling Best Practices

1. Always catch exceptions and log them with context
2. Use specific error types from zkErrorHandler.mjs when possible
3. Include detailed context when logging errors
4. Prefer direct safeLogger access when working in ESM modules
5. Use the logger.cjs module when working in CommonJS environments
6. Initialize the logger early in application startup

## Implementation Notes

The error handling system is designed to work seamlessly across module systems (ESM and CommonJS) and to provide robust fallbacks that ensure errors are always logged without throwing additional exceptions. The architecture specifically avoids circular dependencies and ensures that the logger is properly initialized before use.

All implementations follow the token-agnostic wallet scanning plan rules, avoiding mock or placeholder implementations and providing real error reporting mechanisms.