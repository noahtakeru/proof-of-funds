/**
 * Analytics Utility for Proof of Funds Application
 * 
 * This module provides functions for tracking user interactions and system events.
 * It abstracts the underlying analytics implementation (Google Analytics)
 * to provide a consistent API for event tracking throughout the application.
 */

/**
 * Track a user event
 * @param {string} eventName - Name of the event to track
 * @param {Object} eventParams - Additional parameters to include with the event
 */
export const trackEvent = (eventName, eventParams = {}) => {
    // Only run on client side
    if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', eventName, eventParams);
    }
};

/**
 * Track a wallet connection event
 * @param {string} walletType - Type of wallet (e.g., 'metamask', 'phantom')
 * @param {string} walletAddress - The address of the connected wallet
 * @param {string} network - The blockchain network (e.g., 'ethereum', 'polygon')
 */
export const trackWalletConnection = (walletType, walletAddress, network) => {
    // Hash the address for privacy before tracking
    const hashedAddress = walletAddress ? `0x${walletAddress.slice(2, 6)}...${walletAddress.slice(-4)}` : 'unknown';

    trackEvent('wallet_connected', {
        wallet_type: walletType,
        wallet_address: hashedAddress,
        network
    });
};

/**
 * Track a proof generation event
 * @param {string} proofType - The type of proof generated (e.g., 'standard', 'threshold')
 * @param {string} network - The blockchain network used
 * @param {number} proofTime - Time taken to generate the proof in milliseconds
 */
export const trackProofGeneration = (proofType, network, proofTime) => {
    trackEvent('proof_generated', {
        proof_type: proofType,
        network,
        generation_time_ms: proofTime
    });
};

/**
 * Track a proof verification event
 * @param {string} proofType - The type of proof verified
 * @param {boolean} success - Whether verification was successful
 * @param {string} network - The blockchain network used
 */
export const trackProofVerification = (proofType, success, network) => {
    trackEvent('proof_verified', {
        proof_type: proofType,
        success,
        network
    });
};

/**
 * Track system performance metrics
 * @param {string} operation - The operation being measured
 * @param {number} duration - Time taken in milliseconds
 * @param {Object} additionalData - Any additional data to include
 */
export const trackPerformance = (operation, duration, additionalData = {}) => {
    trackEvent('performance', {
        operation,
        duration_ms: duration,
        ...additionalData
    });
}; 