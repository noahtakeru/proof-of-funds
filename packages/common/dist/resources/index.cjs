/**
 * Resources Module - Package Index
 * 
 * Exports resource management utilities from the resources package
 */

// Export all resource management modules
Object.assign(exports, require('./ResourceMonitor.js.cjs'));
Object.assign(exports, require('./ResourceAllocator.js.cjs'));
Object.assign(exports, require('./AdaptiveComputation.js.cjs'));
Object.assign(exports, require('./ComputationStrategies.js.cjs'));

// Export default for each module
export { default as ResourceMonitor } from './ResourceMonitor.js';
export { default as ResourceAllocator } from './ResourceAllocator.js';
export { default as AdaptiveComputation } from './AdaptiveComputation.js';