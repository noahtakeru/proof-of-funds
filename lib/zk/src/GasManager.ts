/**
 * @file GasManager.ts
 * @description Manages gas price estimation and optimization for transactions
 * 
 * This TypeScript declaration file provides types for the modular gas management system.
 * The actual implementation is in the './gas' directory with separate components for:
 * - GasEstimator: Estimates gas usage for different proof operations
 * - GasPriceMonitor: Tracks and predicts gas prices
 * - GasOptimizer: Optimizes gas usage and transaction timing
 */

import { ethers } from 'ethers';
import { GasStrategy, GasPriceEstimation } from './types/contractTypes';

// Re-export from the modular implementation
export * from './gas/index.js';
export { default } from './gas/index.js';

// Export additional TypeScript-specific constants and types
export const GAS_STRATEGIES: Record<string, GasStrategy> = {
  FASTEST: {
    name: 'fastest',
    multiplier: 2.0,
    description: 'Very high priority, expected to be mined immediately',
    estimatedTimeSeconds: 15
  },
  FAST: {
    name: 'fast',
    multiplier: 1.5,
    description: 'High priority, expected to be mined within 1-2 blocks',
    estimatedTimeSeconds: 30
  },
  STANDARD: {
    name: 'standard',
    multiplier: 1.0,
    description: 'Standard priority, expected to be mined within 3-6 blocks',
    estimatedTimeSeconds: 60
  },
  ECONOMY: {
    name: 'economy',
    multiplier: 0.8,
    description: 'Low priority, expected to be mined when network is less congested',
    estimatedTimeSeconds: 300
  },
  SLOW: {
    name: 'slow',
    multiplier: 0.6,
    description: 'Very low priority, may take significant time to be mined',
    estimatedTimeSeconds: 600
  }
};