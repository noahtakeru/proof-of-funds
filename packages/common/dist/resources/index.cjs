/**
 * Resources Module - Package Index
 * 
 * Exports resource management utilities from the resources package
 */

// Export all resource management modules
Object.assign(exports, require('./ResourceMonitor.js'));
Object.assign(exports, require('./ResourceAllocator.js'));
Object.assign(exports, require('./AdaptiveComputation.js'));
Object.assign(exports, require('./ComputationStrategies.js'));

// Export default for each module
module.exports = { default as ResourceMonitor } from './ResourceMonitor.js';
module.exports = { default as ResourceAllocator } from './ResourceAllocator.js';
module.exports = { default as AdaptiveComputation } from './AdaptiveComputation.js';