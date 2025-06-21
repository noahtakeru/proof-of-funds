/**
 * Bridge file for ComputationStrategies
 * This provides a minimal implementation to break circular dependencies.
 */
/**
 * Computation strategies for optimizing ZK proof generation
 */
/**
 * Strategy for optimizing memory usage
 */
export const MemoryOptimizedStrategy = {
    name: 'memory-optimized',
    batchSize: 10,
    useWorkers: false,
    useFallback: true,
    optimizationTarget: 'memory'
};
/**
 * Strategy for optimizing performance
 */
export const PerformanceOptimizedStrategy = {
    name: 'performance-optimized',
    batchSize: 100,
    useWorkers: true,
    workerCount: 4,
    useFallback: false,
    optimizationTarget: 'performance'
};
/**
 * Strategy for balanced optimization
 */
export const BalancedStrategy = {
    name: 'balanced',
    batchSize: 50,
    useWorkers: true,
    workerCount: 2,
    useFallback: false,
    optimizationTarget: 'balanced'
};
/**
 * Low-power device strategy
 */
export const LowPowerStrategy = {
    name: 'low-power',
    batchSize: 5,
    useWorkers: false,
    useFallback: true,
    optimizationTarget: 'power'
};
/**
 * Computation strategies enum object
 * This is the export expected by zkUtils.mjs
 */
export const COMPUTATION_STRATEGIES = {
    FULL_COMPUTATION: 'full',
    PROGRESSIVE_COMPUTATION: 'progressive',
    FALLBACK_COMPUTATION: 'fallback',
    MEMORY_OPTIMIZED: 'memory-optimized',
    PERFORMANCE_OPTIMIZED: 'performance-optimized',
    BALANCED: 'balanced',
    LOW_POWER: 'low-power'
};
/**
 * Select the best strategy based on device capabilities
 *
 * @param {Object} capabilities - Device capabilities
 * @returns {Object} Selected strategy
 */
export function selectStrategy(capabilities) {
    // Simplified implementation always returns balanced strategy
    return BalancedStrategy;
}
// Default export for ESM compatibility
export default {
    MemoryOptimizedStrategy,
    PerformanceOptimizedStrategy,
    BalancedStrategy,
    LowPowerStrategy,
    COMPUTATION_STRATEGIES,
    selectStrategy
};
