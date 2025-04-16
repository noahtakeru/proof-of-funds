/**
 * @fileoverview Computation Strategies - Constants for ZK computation modes
 * 
 * JavaScript version for direct import in mjs files.
 */

/**
 * Computation strategies available for ZK operations.
 * Defines the different approaches to handle computational tasks based on resource constraints.
 * 
 * @enum {string}
 */
export const ComputationStrategy = {
    // Execute the entire computation in a single operation
    FULL_COMPUTATION: 'full',

    // Execute a subset of the computation, producing a valid but limited result
    PARTIAL_COMPUTATION: 'partial',

    // Split computation across multiple devices or services
    DISTRIBUTED_COMPUTATION: 'distributed',

    // Break computation into smaller chunks executed sequentially
    PROGRESSIVE_COMPUTATION: 'progressive',

    // Schedule computation for later execution when resources are available
    DEFERRED_COMPUTATION: 'deferred',

    // Offload computation to a server-side service
    FALLBACK_COMPUTATION: 'fallback'
};

/**
 * Phases of ZK proof computation.
 * Represents the sequential stages involved in generating and verifying ZK proofs.
 * 
 * @enum {string}
 */
export const ComputationPhase = {
    // Initial setup and input preparation
    PREPARATION: 'preparation',

    // Generating the witness for the circuit
    WITNESS_GENERATION: 'witness-generation',

    // Creating the actual ZK proof
    PROVING: 'proving',

    // Verifying the proof's correctness
    VERIFICATION: 'verification',

    // Encoding and formatting the results
    SERIALIZATION: 'serialization'
};

/**
 * Export constants for direct use in JavaScript modules.
 * String constants representing available computation strategies.
 * 
 * @type {Object<string, string>}
 */
export const COMPUTATION_STRATEGIES = {
    FULL_COMPUTATION: 'full',
    PARTIAL_COMPUTATION: 'partial',
    DISTRIBUTED_COMPUTATION: 'distributed',
    PROGRESSIVE_COMPUTATION: 'progressive',
    DEFERRED_COMPUTATION: 'deferred',
    FALLBACK_COMPUTATION: 'fallback'
};

/**
 * Export constants for direct use in JavaScript modules.
 * String constants representing the phases of computation.
 * 
 * @type {Object<string, string>}
 */
export const COMPUTATION_PHASES = {
    PREPARATION: 'preparation',
    WITNESS_GENERATION: 'witness-generation',
    PROVING: 'proving',
    VERIFICATION: 'verification',
    SERIALIZATION: 'serialization'
};

/**
 * Default export containing all computation strategy related constants.
 * Provides a convenient way to import all computation strategy constants.
 * 
 * @type {Object}
 */
export default {
    ComputationStrategy,
    ComputationPhase,
    COMPUTATION_STRATEGIES,
    COMPUTATION_PHASES
}; 