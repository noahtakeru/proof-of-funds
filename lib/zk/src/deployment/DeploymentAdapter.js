/**
 * @fileoverview Base deployment adapter class for platform-specific deployment adapters
 * 
 * Base class for platform-specific deployment adapters. Handles common functionality
 * across different deployment environments and strategies.
 * 
 * @module deployment/DeploymentAdapter
 */

import { zkErrorLogger } from '../zkErrorLogger.js';

// For regression test compatibility
const logError = zkErrorLogger.error.bind(zkErrorLogger);
const logInfo = zkErrorLogger.info.bind(zkErrorLogger);
const logDebug = zkErrorLogger.debug.bind(zkErrorLogger);

/**
 * Custom error class for deployment adapter errors
 * @extends Error
 */
export class DeploymentAdapterError extends Error {
    /**
     * Creates a new DeploymentAdapterError instance
     * 
     * @param {string} message - Error message
     * @param {Object} [options={}] - Error options
     * @param {string} [options.code='DEPLOYMENT_ADAPTER_ERROR'] - Error code
     * @param {boolean} [options.recoverable=false] - Whether the error is recoverable
     * @param {Object} [options.details={}] - Additional error details
     */
    constructor(message, options = {}) {
        super(message);
        this.name = 'DeploymentAdapterError';
        this.code = options.code || 'DEPLOYMENT_ADAPTER_ERROR';
        this.recoverable = options.recoverable || false;
        this.details = options.details || {};
        this.timestamp = new Date().toISOString();
    }
}

/**
 * Custom error class for configuration errors in the deployment adapter
 * @extends DeploymentAdapterError
 */
export class ConfigurationError extends DeploymentAdapterError {
    /**
     * Creates a new ConfigurationError instance
     * 
     * @param {string} message - Error message
     * @param {Object} [options={}] - Error options
     */
    constructor(message, options = {}) {
        super(message, {
            ...options,
            code: options.code || 'CONFIGURATION_ERROR'
        });
        this.name = 'ConfigurationError';
    }
}

/**
 * Custom error class for validation errors in the deployment adapter
 * @extends DeploymentAdapterError
 */
export class ValidationError extends DeploymentAdapterError {
    /**
     * Creates a new ValidationError instance
     * 
     * @param {string} message - Error message
     * @param {Object} [options={}] - Error options
     */
    constructor(message, options = {}) {
        super(message, {
            ...options,
            code: options.code || 'VALIDATION_ERROR'
        });
        this.name = 'ValidationError';
    }
}

/**
 * Custom error class for deployment errors in the deployment adapter
 * @extends DeploymentAdapterError
 */
export class DeploymentError extends DeploymentAdapterError {
    /**
     * Creates a new DeploymentError instance
     * 
     * @param {string} message - Error message
     * @param {Object} [options={}] - Error options
     */
    constructor(message, options = {}) {
        super(message, {
            ...options,
            code: options.code || 'DEPLOYMENT_ERROR'
        });
        this.name = 'DeploymentError';
    }
}

/**
 * Base class for platform-specific deployment adapters
 * @class
 */
export class DeploymentAdapter {
    /**
     * Creates a new DeploymentAdapter instance
     * 
     * @param {string} strategy - The deployment strategy
     * @param {string} environment - The environment type
     */
    constructor(strategy, environment) {
        try {
            this.strategy = strategy;
            this.environment = environment;
            this.config = {
                initialized: false,
                strategy,
                environment,
                optimizations: [],
                debugMode: false
            };
            
            logDebug(`Created DeploymentAdapter for ${environment} environment with ${strategy} strategy`, {
                context: 'DeploymentAdapter.constructor',
                environment,
                strategy
            });
        } catch (error) {
            const initError = new DeploymentAdapterError(`Failed to initialize deployment adapter: ${error.message}`, {
                recoverable: false,
                details: {
                    originalError: error.message,
                    strategy,
                    environment
                }
            });
            
            logError(`Initialization error: ${initError.message}`, {
                context: 'DeploymentAdapter.constructor',
                error: initError
            });
            
            throw initError;
        }
    }

    /**
     * Configures the adapter with the provided configurator
     * 
     * @param {PlatformConfigurator} configurator - The platform configurator
     * @returns {Object} The updated configuration
     * @throws {ConfigurationError} If configurator is missing or configuration fails
     */
    async configure(configurator) {
        try {
            if (!configurator) {
                throw new ConfigurationError('Configurator is required', {
                    recoverable: false,
                    details: {
                        strategy: this.strategy,
                        environment: this.environment
                    }
                });
            }

            // Apply common configuration settings
            this.config = await configurator.applyConfiguration(this.config);
            this.config.initialized = true;

            logInfo(`Configured adapter for ${this.environment} environment with ${this.strategy} strategy`, {
                context: 'DeploymentAdapter.configure',
                environment: this.environment,
                strategy: this.strategy
            });

            return this.config;
        } catch (error) {
            // Wrap in ConfigurationError if it's not already
            const configError = error instanceof ConfigurationError
                ? error
                : new ConfigurationError(`Failed to configure adapter: ${error.message}`, {
                    recoverable: false,
                    details: {
                        originalError: error.message,
                        strategy: this.strategy,
                        environment: this.environment
                    }
                });

            logError(`Configuration error: ${configError.message}`, {
                context: 'DeploymentAdapter.configure',
                error: configError
            });

            throw configError;
        }
    }

    /**
     * Deploys the ZK proof system with the current configuration
     * 
     * @param {Object} options - Deployment options
     * @returns {Object} Deployment result
     * @throws {DeploymentError} If adapter is not configured or deployment fails
     */
    async deploy(options = {}) {
        try {
            if (!this.config.initialized) {
                throw new DeploymentError('Adapter must be configured before deployment', {
                    recoverable: true,
                    details: {
                        strategy: this.strategy,
                        environment: this.environment
                    }
                });
            }

            const mergedOptions = {
                ...this.config,
                ...options
            };

            // This base implementation should be overridden by specific adapters
            logInfo(`Deploying with strategy: ${this.strategy} in ${this.environment} environment`, {
                context: 'DeploymentAdapter.deploy',
                environment: this.environment,
                strategy: this.strategy,
                options: mergedOptions
            });

            return {
                success: true,
                environment: this.environment,
                strategy: this.strategy
            };
        } catch (error) {
            // Wrap in DeploymentError if it's not already
            const deployError = error instanceof DeploymentError
                ? error
                : new DeploymentError(`Deployment failed: ${error.message}`, {
                    recoverable: false,
                    details: {
                        originalError: error.message,
                        strategy: this.strategy,
                        environment: this.environment
                    }
                });

            logError(`Deployment error: ${deployError.message}`, {
                context: 'DeploymentAdapter.deploy',
                error: deployError
            });

            throw deployError;
        }
    }

    /**
     * Gets the current configuration
     * 
     * @returns {Object} The current configuration
     */
    getConfiguration() {
        try {
            logDebug(`Getting configuration for ${this.environment} adapter`, {
                context: 'DeploymentAdapter.getConfiguration',
                environment: this.environment,
                strategy: this.strategy
            });
            return { ...this.config };
        } catch (error) {
            const configError = new DeploymentAdapterError(`Failed to get configuration: ${error.message}`, {
                recoverable: true,
                details: {
                    originalError: error.message,
                    strategy: this.strategy,
                    environment: this.environment
                }
            });

            logError(`Configuration retrieval error: ${configError.message}`, {
                context: 'DeploymentAdapter.getConfiguration',
                error: configError
            });

            throw configError;
        }
    }

    /**
     * Validates that the current environment meets the requirements for deployment
     * 
     * @returns {Object} Validation result
     * @throws {ValidationError} If validation fails
     */
    async validateEnvironment() {
        try {
            logDebug(`Validating environment for ${this.environment}`, {
                context: 'DeploymentAdapter.validateEnvironment',
                environment: this.environment,
                strategy: this.strategy
            });

            return {
                valid: true,
                environment: this.environment,
                strategy: this.strategy,
                issues: []
            };
        } catch (error) {
            // Wrap in ValidationError if it's not already
            const validationError = error instanceof ValidationError
                ? error
                : new ValidationError(`Environment validation failed: ${error.message}`, {
                    recoverable: true,
                    details: {
                        originalError: error.message,
                        strategy: this.strategy,
                        environment: this.environment
                    }
                });

            logError(`Validation error: ${validationError.message}`, {
                context: 'DeploymentAdapter.validateEnvironment',
                error: validationError
            });

            throw validationError;
        }
    }

    /**
     * Cleanup any resources used by the adapter
     * 
     * @throws {DeploymentAdapterError} If cleanup fails
     */
    async cleanup() {
        try {
            // Base implementation - to be overridden by specific adapters if needed
            this.config.initialized = false;
            
            logInfo(`Cleaned up resources for ${this.environment} adapter`, {
                context: 'DeploymentAdapter.cleanup',
                environment: this.environment,
                strategy: this.strategy
            });
        } catch (error) {
            // Wrap in DeploymentAdapterError if it's not already
            const cleanupError = error instanceof DeploymentAdapterError
                ? error
                : new DeploymentAdapterError(`Cleanup failed: ${error.message}`, {
                    recoverable: true,
                    details: {
                        originalError: error.message,
                        strategy: this.strategy,
                        environment: this.environment
                    }
                });

            logError(`Cleanup error: ${cleanupError.message}`, {
                context: 'DeploymentAdapter.cleanup',
                error: cleanupError
            });

            throw cleanupError;
        }
    }
}