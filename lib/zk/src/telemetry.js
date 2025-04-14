/**
 * Import the analytics tracking utilities
 */
let trackPerformance;
let trackProofGeneration;
let trackProofVerification;

// Only import analytics in browser environment
if (typeof window !== 'undefined') {
    // Use dynamic import to avoid server-side issues
    import('../../analytics.js').then(({ trackPerformance: tp, trackProofGeneration: tpg, trackProofVerification: tpv }) => {
        trackPerformance = tp;
        trackProofGeneration = tpg;
        trackProofVerification = tpv;
    }).catch(e => {
        console.warn('Analytics module could not be loaded:', e);
    });
}

// Find where recordOperation is defined and add analytics tracking:
// Example (adjust based on actual file content):
function recordOperation({ operation, executionTimeMs, serverSide, success, additionalInfo = {} }) {
    // Original code here

    // Add analytics tracking for client-side operations
    if (!serverSide && typeof window !== 'undefined') {
        if (operation === 'fullProve' && trackProofGeneration) {
            trackProofGeneration(
                additionalInfo.proofType || 'unknown',
                additionalInfo.network || 'unknown',
                executionTimeMs
            );
        } else if (operation === 'verify' && trackProofVerification) {
            trackProofVerification(
                additionalInfo.proofType || 'unknown',
                success,
                additionalInfo.network || 'unknown'
            );
        } else if (trackPerformance) {
            // Track other operations as performance metrics
            trackPerformance(operation, executionTimeMs, additionalInfo);
        }
    }
} 