/**
 * Performance utilities for monitoring and optimizing application performance
 */
import { isFeatureEnabled } from './featureFlags';
import { getPerformanceMonitor } from '@proof-of-funds/common/monitoring';

const monitor = getPerformanceMonitor();
const measurements = new Map();

/**
 * Start measuring performance for a named operation
 * @param {string} operationName - Name of the operation to measure
 */
export function startMeasurement(operationName) {
  if (!isFeatureEnabled('ENABLE_TELEMETRY')) {
    return;
  }
  
  measurements.set(operationName, performance.now());
}

/**
 * End performance measurement for a named operation and record the result
 * @param {string} operationName - Name of the operation being measured
 * @param {Object} metadata - Additional metadata about the operation
 * @returns {number|null} The duration in milliseconds, or null if measurement wasn't started
 */
export function endMeasurement(operationName, metadata = {}) {
  if (!isFeatureEnabled('ENABLE_TELEMETRY')) {
    return null;
  }
  
  const startTime = measurements.get(operationName);
  if (!startTime) {
    return null;
  }
  
  const duration = performance.now() - startTime;
  measurements.delete(operationName);
  
  // Record the measurement to the monitoring system
  monitor.recordTiming(operationName, duration, metadata);
  
  return duration;
}

/**
 * Measure the execution time of a function
 * @param {Function} fn - The function to measure
 * @param {string} operationName - Name of the operation
 * @param {Object} metadata - Additional metadata
 * @returns {*} The result of the function
 */
export async function measureFunction(fn, operationName, metadata = {}) {
  startMeasurement(operationName);
  
  try {
    const result = await fn();
    return result;
  } finally {
    endMeasurement(operationName, metadata);
  }
}