/**
 * DependencyMapper Module
 * 
 * This module provides a static mapping system for all dependencies used throughout
 * the ZK module system. It replaces dynamic imports with static imports to eliminate
 * webpack warnings related to critical dependencies.
 * 
 * By using this mapper, we ensure that webpack can statically analyze all imports,
 * which eliminates the "Critical dependency: the request of a dependency is an expression"
 * warning.
 */

// Import error handling classes
import { SystemError, ErrorCode } from '../zkErrorHandler.mjs';

// Import all possible dependencies statically
import * as snarkjsModule from 'snarkjs';
import * as zkErrorHandlerMjs from '../zkErrorHandler.mjs';
import * as zkErrorLoggerMjs from '../zkErrorLogger.mjs';
import * as browserCompatibilityMjs from '../browserCompatibility.mjs';
import * as zkRecoverySystemMjs from '../zkRecoverySystem.mjs';
import * as zkUtilsMjs from '../zkUtils.mjs';
import * as realZkUtilsMjs from '../realZkUtils.mjs';
import * as deviceCapabilitiesMjs from '../deviceCapabilities.mjs';
import * as moduleLoaderMjs from '../moduleLoader.mjs';
import * as zkCircuitInputsMjs from '../zkCircuitInputs.mjs';
import * as zkCircuitParameterDerivationMjs from '../zkCircuitParameterDerivation.mjs';
import * as wasmLoaderModule from '../wasmLoader';
import * as zkProofGeneratorModule from '../zkProofGenerator';
import * as zkProofSerializerModule from '../zkProofSerializer';
import * as telemetryModule from '../telemetry';

/**
 * Map of module paths to their actual implementations
 * This allows us to replace dynamic imports with static lookups
 */
const moduleMappings = {
  // Main modules
  'snarkjs': snarkjsModule,
  
  // MJS modules
  './zkErrorHandler.mjs': zkErrorHandlerMjs,
  './zkErrorLogger.mjs': zkErrorLoggerMjs,
  './browserCompatibility.mjs': browserCompatibilityMjs,
  './zkRecoverySystem.mjs': zkRecoverySystemMjs,
  './zkUtils.mjs': zkUtilsMjs,
  './realZkUtils.mjs': realZkUtilsMjs, 
  './deviceCapabilities.mjs': deviceCapabilitiesMjs,
  './moduleLoader.mjs': moduleLoaderMjs,
  './zkCircuitInputs.mjs': zkCircuitInputsMjs,
  './zkCircuitParameterDerivation.mjs': zkCircuitParameterDerivationMjs,
  
  // Other modules
  './wasmLoader': wasmLoaderModule,
  './zkProofGenerator': zkProofGeneratorModule,
  './zkProofSerializer': zkProofSerializerModule,
  './telemetry': telemetryModule
};

/**
 * Get a module by its path
 * 
 * This function replaces dynamic imports with a static lookup
 * 
 * @param {string} modulePath - Path to the module
 * @returns {object} The module implementation 
 * @throws {Error} If the module is not found in the mapper
 */
export function getModule(modulePath) {
  if (moduleMappings[modulePath]) {
    return moduleMappings[modulePath];
  }
  
  // Use specific error class instead of generic Error
  throw new SystemError(`Module not found: ${modulePath}. Add it to the dependencyMapper.`, {
    code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
    operationId: `getDependency_${Date.now()}`,
    recoverable: false,
    details: { 
      modulePath,
      availableModules: Object.keys(moduleMappings)
    }
  });
}

/**
 * Register a new module in the mapper
 * 
 * This allows for dynamic registration of modules at runtime if needed
 * 
 * @param {string} modulePath - Path to the module
 * @param {object} implementation - The module implementation
 */
export function registerModule(modulePath, implementation) {
  moduleMappings[modulePath] = implementation;
}

/**
 * Check if a module is available in the mapper
 * 
 * @param {string} modulePath - Path to the module
 * @returns {boolean} Whether the module is available
 */
export function hasModule(modulePath) {
  return !!moduleMappings[modulePath];
}

export default {
  getModule,
  registerModule,
  hasModule
};