/**
 * @fileoverview Computation Strategies - Constants for ZK computation modes
 * 
 * This module defines the computation strategies available for ZK operations
 * and related constants. This is designed to be easily importable in both 
 * TypeScript and JavaScript environments.
 */

/**
 * Computation strategies available for ZK operations
 * 
 * These strategies represent different approaches to executing computationally
 * intensive operations, each with different resource requirements and performance
 * characteristics. The system dynamically selects the most appropriate strategy
 * based on available resources and operation requirements.
 */
export enum ComputationStrategy {
    /** Execute the entire computation in a single operation */
    FULL_COMPUTATION = 'full',

    /** Execute a subset of the computation, producing a valid but limited result */
    PARTIAL_COMPUTATION = 'partial',

    /** Split computation across multiple devices or services */
    DISTRIBUTED_COMPUTATION = 'distributed',

    /** Break computation into smaller chunks executed sequentially */
    PROGRESSIVE_COMPUTATION = 'progressive',

    /** Schedule computation for later execution when resources are available */
    DEFERRED_COMPUTATION = 'deferred',

    /** Offload computation to a server-side service */
    FALLBACK_COMPUTATION = 'fallback'
}

/**
 * Phases of ZK proof computation
 */
export enum ComputationPhase {
    /** Initial setup and input preparation */
    PREPARATION = 'preparation',

    /** Generating the witness for the circuit */
    WITNESS_GENERATION = 'witness-generation',

    /** Creating the actual ZK proof */
    PROVING = 'proving',

    /** Verifying the proof's correctness */
    VERIFICATION = 'verification',

    /** Encoding and formatting the results */
    SERIALIZATION = 'serialization'
}

// Export constants for direct use in JavaScript modules
export const COMPUTATION_STRATEGIES = {
    FULL_COMPUTATION: 'full',
    PARTIAL_COMPUTATION: 'partial',
    DISTRIBUTED_COMPUTATION: 'distributed',
    PROGRESSIVE_COMPUTATION: 'progressive',
    DEFERRED_COMPUTATION: 'deferred',
    FALLBACK_COMPUTATION: 'fallback'
};

export const COMPUTATION_PHASES = {
    PREPARATION: 'preparation',
    WITNESS_GENERATION: 'witness-generation',
    PROVING: 'proving',
    VERIFICATION: 'verification',
    SERIALIZATION: 'serialization'
};

// Default export for the constants
export default {
    ComputationStrategy,
    ComputationPhase,
    COMPUTATION_STRATEGIES,
    COMPUTATION_PHASES
}; 