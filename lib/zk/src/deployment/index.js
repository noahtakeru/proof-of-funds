/**
 * Cross-Platform Deployment Module
 * 
 * Provides functionality for deploying and optimizing Zero-Knowledge proof generation
 * across different platforms and environments.
 * @module deployment
 */

import { DeploymentManager } from './DeploymentManager.js';
import { DeploymentAdapter } from './DeploymentAdapter.js';
import { PlatformConfigurator } from './PlatformConfigurator.js';
import { PlatformAdapterFactory } from './PlatformAdapterFactory.js';
import { BaseDeploymentAdapter } from './BaseDeploymentAdapter.js';
import { NodeDeploymentAdapter } from './NodeDeploymentAdapter.js';
import { BrowserDeploymentAdapter } from './BrowserDeploymentAdapter.js';
import { zkErrorLogger } from '../zkErrorLogger.mjs';

/**
 * Custom error class for deployment-related errors
 * @extends Error
 */
export class DeploymentError extends Error {
    /**
     * Creates a new DeploymentError
     * 
     * @param {string} message - Error message
     * @param {Object} [options={}] - Error options
     * @param {string} [options.code='DEPLOYMENT_ERROR'] - Error code
     * @param {boolean} [options.recoverable=false] - Whether the error is recoverable
     * @param {string} [options.component='deployment'] - Component where the error occurred
     * @param {Object} [options.details={}] - Additional error details
     */
    constructor(message, options = {}) {
        super(message);
        this.name = 'DeploymentError';
        this.code = options.code || 'DEPLOYMENT_ERROR';
        this.recoverable = options.recoverable || false;
        this.component = options.component || 'deployment';
        this.details = options.details || {};
        this.timestamp = new Date().toISOString();
    }
}

/**
 * Error for environment compatibility issues
 * @extends DeploymentError
 */
export class EnvironmentCompatibilityError extends DeploymentError {
    /**
     * Creates a new EnvironmentCompatibilityError
     * 
     * @param {string} message - Error message
     * @param {Object} [options={}] - Error options
     */
    constructor(message, options = {}) {
        super(message, {
            code: 'ENVIRONMENT_COMPATIBILITY_ERROR',
            recoverable: false,
            component: 'environment-detection',
            ...options
        });
        this.name = 'EnvironmentCompatibilityError';
    }
}

/**
 * Error for configuration issues
 * @extends DeploymentError
 */
export class ConfigurationError extends DeploymentError {
    /**
     * Creates a new ConfigurationError
     * 
     * @param {string} message - Error message
     * @param {Object} [options={}] - Error options
     */
    constructor(message, options = {}) {
        super(message, {
            code: 'CONFIGURATION_ERROR',
            recoverable: true,
            component: 'deployment-configuration',
            ...options
        });
        this.name = 'ConfigurationError';
    }
}

/**
 * Error for deployment process failures
 * @extends DeploymentError
 */
export class DeploymentProcessError extends DeploymentError {
    /**
     * Creates a new DeploymentProcessError
     * 
     * @param {string} message - Error message
     * @param {Object} [options={}] - Error options
     */
    constructor(message, options = {}) {
        super(message, {
            code: 'DEPLOYMENT_PROCESS_ERROR',
            recoverable: false,
            component: 'deployment-process',
            ...options
        });
        this.name = 'DeploymentProcessError';
    }
}

// Export the main classes
export {
    DeploymentManager,
    DeploymentAdapter,
    PlatformConfigurator,
    PlatformAdapterFactory
};

// Export all adapter classes
export {
    BaseDeploymentAdapter,
    NodeDeploymentAdapter,
    BrowserDeploymentAdapter
};

/**
 * Deployment strategy types for different environments and use cases
 * @enum {string}
 */
export const DeploymentStrategyType = {
    /** Full local proving and verification */
    FullLocal: 'full-local',
    /** Server-side processing for all ZK operations */
    ServerSide: 'server-side',
    /** Mix of client and server operations based on capabilities */
    Hybrid: 'hybrid',
    /** Optimized for maximum performance, may use more resources */
    HighPerformance: 'high-performance',
    /** Optimized for low-resource environments like mobile devices */
    LowResource: 'low-resource'
};

/**
 * Environment types supported by the deployment system
 * @enum {string}
 */
export const EnvironmentType = {
    /** Web browser environments */
    Browser: 'browser',
    /** Node.js environments */
    Node: 'node',
    /** Web worker contexts */
    Worker: 'worker',
    /** Service worker contexts */
    ServiceWorker: 'service-worker',
    /** Mobile environments */
    Mobile: 'mobile'
};

/**
 * Creates an optimized deployment based on the current environment
 * @param {Object} options - Options for deployment
 * @returns {Promise<DeploymentManager>} - A deployed and initialized manager
 * @throws {DeploymentError} If initialization fails
 */
export const createOptimizedDeployment = async (options = {}) => {
    try {
        const manager = new DeploymentManager({
            autoDetect: true,
            ...options
        });

        await manager.initialize();
        return manager;
    } catch (error) {
        // Convert generic errors to deployment errors
        if (!(error instanceof DeploymentError)) {
            const deploymentError = new DeploymentProcessError(
                `Failed to create optimized deployment: ${error.message}`,
                {
                    details: {
                        originalError: error.message,
                        stack: error.stack,
                        options
                    }
                }
            );
            
            // Log the error
            zkErrorLogger.logError(deploymentError, {
                context: 'createOptimizedDeployment',
                options
            });
            
            throw deploymentError;
        }
        throw error;
    }
};

/**
 * Gets the appropriate deployment adapter for the current environment
 * 
 * @param {Object} config - Configuration options to pass to the adapter
 * @returns {BaseDeploymentAdapter} - An instance of the appropriate deployment adapter
 * @throws {EnvironmentCompatibilityError} If no compatible adapter is found
 */
export function getDeploymentAdapter(config = {}) {
    // Try Node.js adapter first
    if (NodeDeploymentAdapter.isCompatible()) {
        return new NodeDeploymentAdapter(config);
    }

    // Try browser adapter next
    if (BrowserDeploymentAdapter.isCompatible()) {
        return new BrowserDeploymentAdapter(config);
    }

    // If no compatible adapter is found, throw an error
    const error = new EnvironmentCompatibilityError(
        'No compatible deployment adapter found for this environment',
        {
            details: {
                environmentInfo: {
                    isNode: typeof process !== 'undefined' && process.versions,
                    isBrowser: typeof window !== 'undefined',
                    config
                }
            }
        }
    );
    
    zkErrorLogger.logError(error, {
        context: 'getDeploymentAdapter'
    });
    
    throw error;
}

/**
 * Creates a deployment adapter for a specific environment
 * 
 * @param {string} environment - The environment to create an adapter for ('node' or 'browser')
 * @param {Object} config - Configuration options to pass to the adapter
 * @returns {BaseDeploymentAdapter} - An instance of the specified deployment adapter
 * @throws {ConfigurationError} If the specified environment is not supported
 */
export function createDeploymentAdapter(environment, config = {}) {
    try {
        switch (environment.toLowerCase()) {
            case 'node':
                return new NodeDeploymentAdapter(config);
            case 'browser':
                return new BrowserDeploymentAdapter(config);
            default:
                throw new ConfigurationError(
                    `Unsupported environment: ${environment}`,
                    {
                        details: {
                            requestedEnvironment: environment,
                            supportedEnvironments: ['node', 'browser'],
                            config
                        }
                    }
                );
        }
    } catch (error) {
        // If it's already a ConfigurationError, just log and rethrow
        if (error instanceof ConfigurationError) {
            zkErrorLogger.logError(error, {
                context: 'createDeploymentAdapter',
                environment,
                config
            });
            throw error;
        }
        
        // Otherwise, wrap in a ConfigurationError
        const configError = new ConfigurationError(
            `Failed to create adapter for ${environment}: ${error.message}`,
            {
                details: {
                    originalError: error.message,
                    stack: error.stack,
                    environment,
                    config
                }
            }
        );
        
        zkErrorLogger.logError(configError, {
            context: 'createDeploymentAdapter'
        });
        
        throw configError;
    }
} 