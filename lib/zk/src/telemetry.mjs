/**
 * Telemetry module for ZK operations
 * 
 * This file provides compatibility with the telemetry.ts module
 * It re-exports the telemetry singleton from the TypeScript implementation
 */

import { telemetry as telemetrySingleton } from './telemetry.ts';

/**
 * The telemetry singleton instance for tracking ZK operations.
 * Provides a unified interface for collecting performance metrics, error data,
 * and operational statistics across the ZK proof system.
 * 
 * @type {import('./telemetry.ts').Telemetry}
 */
export const telemetry = telemetrySingleton;

/**
 * Default export containing the telemetry singleton.
 * Allows for convenient default imports while maintaining
 * compatibility with the TypeScript implementation.
 * 
 * @type {Object}
 */
export default { telemetry };