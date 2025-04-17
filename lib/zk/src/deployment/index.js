/**
 * Cross-Platform Deployment Module
 * 
 * Provides functionality for deploying and optimizing Zero-Knowledge proof generation
 * across different platforms and environments.
 */

import { DeploymentManager } from './DeploymentManager.js';
import { DeploymentAdapter } from './DeploymentAdapter.js';
import { PlatformConfigurator } from './PlatformConfigurator.js';
import { PlatformAdapterFactory } from './PlatformAdapterFactory.js';
import { BaseDeploymentAdapter } from './BaseDeploymentAdapter.js';
import { NodeDeploymentAdapter } from './NodeDeploymentAdapter.js';
import { BrowserDeploymentAdapter } from './BrowserDeploymentAdapter.js';

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

// Define enum constants
export const DeploymentStrategyType = {
    FullLocal: 'full-local',
    ServerSide: 'server-side',
    Hybrid: 'hybrid',
    HighPerformance: 'high-performance',
    LowResource: 'low-resource'
};

export const EnvironmentType = {
    Browser: 'browser',
    Node: 'node',
    Worker: 'worker',
    ServiceWorker: 'service-worker',
    Mobile: 'mobile'
};

/**
 * Creates an optimized deployment based on the current environment
 * @param {Object} options - Options for deployment
 * @returns {Promise<DeploymentManager>} - A deployed and initialized manager
 */
export const createOptimizedDeployment = async (options = {}) => {
    const manager = new DeploymentManager({
        autoDetect: true,
        ...options
    });

    await manager.initialize();
    return manager;
};

/**
 * Gets the appropriate deployment adapter for the current environment
 * 
 * @param {Object} config - Configuration options to pass to the adapter
 * @returns {BaseDeploymentAdapter} - An instance of the appropriate deployment adapter
 * @throws {Error} If no compatible adapter is found
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
    throw new Error('No compatible deployment adapter found for this environment');
}

/**
 * Creates a deployment adapter for a specific environment
 * 
 * @param {string} environment - The environment to create an adapter for ('node' or 'browser')
 * @param {Object} config - Configuration options to pass to the adapter
 * @returns {BaseDeploymentAdapter} - An instance of the specified deployment adapter
 * @throws {Error} If the specified environment is not supported
 */
export function createDeploymentAdapter(environment, config = {}) {
    switch (environment.toLowerCase()) {
        case 'node':
            return new NodeDeploymentAdapter(config);
        case 'browser':
            return new BrowserDeploymentAdapter(config);
        default:
            throw new Error(`Unsupported environment: ${environment}`);
    }
} 