"use strict";
/**
 * BigQuery Analytics Client
 *
 * This module provides utilities for logging analytics data to BigQuery.
 */
/**
 * Log a proof generation event to BigQuery
 * @param {Object} proofData - The proof generation data to log
 * @param {string} proofData.operationId - The unique operation ID
 * @param {number} proofData.proofType - The type of proof generated
 * @param {string} proofData.network - The network on which the proof was generated
 * @param {number} proofData.executionTimeMs - The execution time in milliseconds
 * @param {boolean} proofData.success - Whether the proof generation was successful
 * @param {string} proofData.clientType - The type of client that generated the proof
 */
function logProofGeneration(proofData) {
    try {
        // In a real implementation, this would send the data to BigQuery
        console.log('[Analytics] Proof generation logged:', {
            timestamp: new Date().toISOString(),
            ...proofData
        });
    }
    catch (error) {
        console.error('[Analytics] Failed to log proof generation:', error);
    }
}
/**
 * Log a proof verification event to BigQuery
 * @param {Object} verificationData - The proof verification data to log
 * @param {string} verificationData.operationId - The unique operation ID
 * @param {boolean} verificationData.valid - Whether the proof was valid
 * @param {string} verificationData.network - The network on which the proof was verified
 * @param {number} verificationData.executionTimeMs - The execution time in milliseconds
 */
function logProofVerification(verificationData) {
    try {
        // In a real implementation, this would send the data to BigQuery
        console.log('[Analytics] Proof verification logged:', {
            timestamp: new Date().toISOString(),
            ...verificationData
        });
    }
    catch (error) {
        console.error('[Analytics] Failed to log proof verification:', error);
    }
}
/**
 * Log an error event to BigQuery
 * @param {Object} errorData - The error data to log
 * @param {string} errorData.errorCode - The error code
 * @param {string} errorData.errorMessage - The error message
 * @param {string} errorData.context - The context in which the error occurred
 * @param {string} errorData.component - The component that generated the error
 */
function logError(errorData) {
    try {
        // In a real implementation, this would send the data to BigQuery
        console.error('[Analytics] Error logged:', {
            timestamp: new Date().toISOString(),
            ...errorData
        });
    }
    catch (error) {
        console.error('[Analytics] Failed to log error:', error);
    }
}
/**
 * Log a user event to BigQuery
 * @param {Object} userData - The user data to log
 * @param {string} userData.userId - The user ID
 * @param {string} userData.eventType - The type of event
 * @param {Object} userData.eventData - Additional data about the event
 */
function logUserEvent(userData) {
    try {
        // In a real implementation, this would send the data to BigQuery
        console.log('[Analytics] User event logged:', {
            timestamp: new Date().toISOString(),
            ...userData
        });
    }
    catch (error) {
        console.error('[Analytics] Failed to log user event:', error);
    }
}
// Export the analytics client functions
module.exports = {
    logProofGeneration,
    logProofVerification,
    logError,
    logUserEvent
};
