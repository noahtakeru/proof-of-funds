/**
 * Chain Adapter Entry Point
 * 
 * This module exports all chain adapter related components for easy access.
 */

// Export interfaces and types
export * from './ChainAdapter';

// Export implementations
export * from './EVMChainAdapter';
export * from './SolanaChainAdapter';
export * from './BitcoinChainAdapter';

// Export registry
export * from './ChainAdapterRegistry';

// Default export for convenience
import { ChainAdapterRegistry, ChainType } from './ChainAdapterRegistry';
export default ChainAdapterRegistry.getInstance();