/**
 * Constants for Proof of Funds Application
 *
 * This module provides application-wide constants to ensure
 * consistent values across components.
 */
// ZK Proof types supported by the application
export const ZK_PROOF_TYPES = {
    STANDARD: 'standard', // Exact amount proof
    THRESHOLD: 'threshold', // At-least amount proof
    MAXIMUM: 'maximum', // At-most amount proof
    BATCH: 'batch' // Multiple proofs combined
};
// Mapping of proof types to human-readable names
export const PROOF_TYPE_NAMES = {
    standard: 'Standard Proof (Exact Amount)',
    threshold: 'Threshold Proof (Minimum Amount)',
    maximum: 'Maximum Proof (Maximum Amount)',
    batch: 'Batch Proof (Multiple Proofs)'
};
// Default networks supported by the application
export const SUPPORTED_NETWORKS = {
    ETHEREUM: 'ethereum',
    POLYGON: 'polygon',
    AVALANCHE: 'avalanche',
    ARBITRUM: 'arbitrum',
    OPTIMISM: 'optimism',
    BSC: 'binance'
};
// Default currency symbols
export const CURRENCY_SYMBOLS = {
    ethereum: 'ETH',
    polygon: 'MATIC',
    avalanche: 'AVAX',
    arbitrum: 'ETH',
    optimism: 'ETH',
    binance: 'BNB'
};
// Network name mapping for display
export const NETWORK_NAMES = {
    ethereum: 'Ethereum',
    polygon: 'Polygon',
    avalanche: 'Avalanche',
    arbitrum: 'Arbitrum',
    optimism: 'Optimism',
    binance: 'BNB Chain'
};
