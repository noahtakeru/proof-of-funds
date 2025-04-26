/**
 * @fileoverview Deployment-specific error classes
 * 
 * This module defines specific error classes for the deployment framework.
 * Using specific error classes improves error handling and makes debugging easier.
 * 
 * @author ZK Infrastructure Team
 */

/**
 * Base class for all deployment-related errors
 */
export class DeploymentError extends Error {
  /**
   * Create a new DeploymentError
   * 
   * @param {string} message - Error message
   * @param {Object} [details] - Additional error details
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'DeploymentError';
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Error for environment detection failures
 */
export class EnvironmentDetectionError extends DeploymentError {
  /**
   * Create a new EnvironmentDetectionError
   * 
   * @param {string} message - Error message
   * @param {Object} [details] - Additional error details
   */
  constructor(message, details = {}) {
    super(message, details);
    this.name = 'EnvironmentDetectionError';
  }
}

/**
 * Error for deployment initialization failures
 */
export class DeploymentInitializationError extends DeploymentError {
  /**
   * Create a new DeploymentInitializationError
   * 
   * @param {string} message - Error message
   * @param {Object} [details] - Additional error details
   */
  constructor(message, details = {}) {
    super(message, details);
    this.name = 'DeploymentInitializationError';
  }
}

/**
 * Error for circuit deployment failures
 */
export class CircuitDeploymentError extends DeploymentError {
  /**
   * Create a new CircuitDeploymentError
   * 
   * @param {string} message - Error message
   * @param {Object} [details] - Additional error details
   */
  constructor(message, details = {}) {
    super(message, details);
    this.name = 'CircuitDeploymentError';
  }
}

/**
 * Error for proof generation failures
 */
export class ProofGenerationError extends DeploymentError {
  /**
   * Create a new ProofGenerationError
   * 
   * @param {string} message - Error message
   * @param {Object} [details] - Additional error details
   */
  constructor(message, details = {}) {
    super(message, details);
    this.name = 'ProofGenerationError';
  }
}

/**
 * Error for proof verification failures
 */
export class ProofVerificationError extends DeploymentError {
  /**
   * Create a new ProofVerificationError
   * 
   * @param {string} message - Error message
   * @param {Object} [details] - Additional error details
   */
  constructor(message, details = {}) {
    super(message, details);
    this.name = 'ProofVerificationError';
  }
}

/**
 * Error for adapter-specific failures
 */
export class PlatformAdapterError extends DeploymentError {
  /**
   * Create a new PlatformAdapterError
   * 
   * @param {string} message - Error message
   * @param {Object} [details] - Additional error details
   */
  constructor(message, details = {}) {
    super(message, details);
    this.name = 'PlatformAdapterError';
  }
}

/**
 * Error for resource limitations
 */
export class ResourceLimitationError extends DeploymentError {
  /**
   * Create a new ResourceLimitationError
   * 
   * @param {string} message - Error message
   * @param {Object} [details] - Additional error details
   */
  constructor(message, details = {}) {
    super(message, details);
    this.name = 'ResourceLimitationError';
  }
}

/**
 * Error for configuration issues
 */
export class ConfigurationError extends DeploymentError {
  /**
   * Create a new ConfigurationError
   * 
   * @param {string} message - Error message
   * @param {Object} [details] - Additional error details
   */
  constructor(message, details = {}) {
    super(message, details);
    this.name = 'ConfigurationError';
  }
}

/**
 * Module exports
 */
export default {
  DeploymentError,
  EnvironmentDetectionError,
  DeploymentInitializationError,
  CircuitDeploymentError,
  ProofGenerationError,
  ProofVerificationError,
  PlatformAdapterError,
  ResourceLimitationError,
  ConfigurationError
};