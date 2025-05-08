/**
 * Feature flag system for enabling/disabling features across environments
 */
import { getConfig } from '@proof-of-funds/common/config';

const DEFAULT_FLAGS = {
  ENABLE_ZK_OPTIMIZATIONS: true,
  USE_HARDWARE_ACCELERATION: true,
  ENABLE_MULTI_WALLET: true,
  SHOW_ADVANCED_OPTIONS: false,
  USE_NEW_VERIFICATION_FLOW: false,
  ENABLE_TELEMETRY: true,
  SHOW_DEBUG_INFO: process.env.NODE_ENV !== 'production'
};

let cachedFlags = null;

/**
 * Get the status of a feature flag
 * @param {string} flagName - The name of the feature flag to check
 * @returns {boolean} True if the feature is enabled, false otherwise
 */
export function isFeatureEnabled(flagName) {
  if (!cachedFlags) {
    cachedFlags = initializeFeatureFlags();
  }
  
  return cachedFlags[flagName] ?? DEFAULT_FLAGS[flagName] ?? false;
}

/**
 * Initialize feature flags from the configuration
 * @returns {Object} The active feature flags
 */
function initializeFeatureFlags() {
  const config = getConfig();
  const envFlags = config.featureFlags || {};
  
  // Merge default flags with environment-specific flags
  return {
    ...DEFAULT_FLAGS,
    ...envFlags
  };
}

/**
 * Reset the feature flag cache - primarily used for testing
 */
export function resetFeatureFlags() {
  cachedFlags = null;
}