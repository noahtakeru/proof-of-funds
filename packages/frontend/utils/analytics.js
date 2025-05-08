/**
 * Analytics utilities for tracking user behavior and application performance
 */
import { isFeatureEnabled } from './featureFlags';
import { getAnalyticsClient } from '@proof-of-funds/common/analytics';

let analyticsInitialized = false;
let analyticsClient = null;

/**
 * Initialize the analytics system
 * @param {Object} options - Configuration options
 * @param {string} options.userId - Anonymous user identifier
 * @param {boolean} options.consentGiven - Whether user has consented to analytics
 * @returns {Object} The configured analytics client
 */
export function initializeAnalytics(options = {}) {
  if (analyticsInitialized) {
    return analyticsClient;
  }
  
  const { 
    userId = generateAnonymousId(),
    consentGiven = false
  } = options;
  
  // Only track if user has given consent and feature is enabled
  const shouldTrack = consentGiven && isFeatureEnabled('ENABLE_TELEMETRY');
  
  // Get client from common package
  analyticsClient = getAnalyticsClient({
    enabled: shouldTrack,
    userId,
    environment: process.env.NODE_ENV,
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0'
  });
  
  analyticsInitialized = true;
  
  return analyticsClient;
}

/**
 * Track a user action or event
 * @param {string} eventName - Name of the event to track
 * @param {Object} properties - Additional properties for the event
 */
export function trackEvent(eventName, properties = {}) {
  if (!analyticsInitialized) {
    initializeAnalytics();
  }
  
  if (!analyticsClient || !isFeatureEnabled('ENABLE_TELEMETRY')) {
    return;
  }
  
  analyticsClient.track(eventName, {
    timestamp: new Date().toISOString(),
    ...properties
  });
}

/**
 * Track an error that occurred
 * @param {Error} error - The error object
 * @param {Object} context - Additional context about where the error occurred
 */
export function trackError(error, context = {}) {
  if (!analyticsInitialized) {
    initializeAnalytics();
  }
  
  if (!analyticsClient || !isFeatureEnabled('ENABLE_TELEMETRY')) {
    return;
  }
  
  analyticsClient.trackError({
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...context,
    timestamp: new Date().toISOString()
  });
}

/**
 * Generate an anonymous identifier for tracking
 * @returns {string} Anonymous ID
 */
function generateAnonymousId() {
  // Create a pseudorandom ID that doesn't contain PII
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}