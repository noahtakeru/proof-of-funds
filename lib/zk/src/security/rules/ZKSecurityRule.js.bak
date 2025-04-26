/**
 * ZKSecurityRule class
 * 
 * This class extends the SecurityRule class to provide specialized
 * functionality for zero-knowledge proof system security rules.
 */

import { SecurityRule } from './SecurityRule.js';
import { RuleCategory } from '../AuditConfig.js';

/**
 * @class ZKSecurityRule
 * @classdesc Specialized security rule for zero-knowledge proof systems
 * This class extends the base SecurityRule to provide specific functionality
 * for detecting vulnerabilities in zero-knowledge proof implementations.
 * It includes specialized checks for proof malleability, trusted setup issues,
 * and protocol soundness.
 * 
 * @extends {SecurityRule}
 * @exports
 */
export class ZKSecurityRule extends SecurityRule {
    /**
     * Create a new zero-knowledge proof system security rule
     * 
     * @param {Object} options - Rule configuration options
     * @param {string} options.id - Unique identifier for the rule
     * @param {string} options.name - Human-readable name of the rule
     * @param {string} options.description - Detailed description of the rule
     * @param {string} options.severity - Severity level from SeverityLevel enum
     * @param {string[]} options.references - Array of reference URLs related to this rule
     * @param {Function} options.evaluator - Function to evaluate if the rule is violated
     * @param {Object} [options.zkMetadata] - ZK-specific metadata
     * @param {string} [options.zkMetadata.proofSystem] - ZK proof system type (e.g., "Groth16", "PLONK", "Bulletproofs")
     * @param {string[]} [options.zkMetadata.affectedComponents] - Parts of the ZK system affected (e.g., "prover", "verifier")
     * @param {boolean} [options.zkMetadata.affectsTrustedSetup] - Whether the rule affects trusted setup
     * @param {boolean} [options.enabled=true] - Whether the rule is enabled
     */
    constructor(options) {
        // Force the category to ZK_PROTOCOL
        const zkOptions = {
            ...options,
            category: RuleCategory.ZK_PROTOCOL
        };

        super(zkOptions);

        // Add ZK specific metadata
        this.zkMetadata = options.zkMetadata || {};
    }

    /**
     * Check for potential proof malleability issues
     * 
     * @param {Object} context - Evaluation context
     * @returns {Object|null} - Vulnerability details if found, null otherwise
     */
    checkForProofMalleability(context) {
        // Example implementation - would be more complex in reality
        const proofValidation = context.proofValidation || {};

        // Check if additional validation is performed beyond basic proof verification
        if (!proofValidation.hasAdditionalChecks) {
            return {
                location: {
                    file: context.filePath,
                    line: proofValidation.lineNumber || 0
                },
                evidence: 'Potential proof malleability issue: no additional validation beyond proof verification',
                recommendation: 'Add input validation and structural checks to prevent proof malleability'
            };
        }

        return null;
    }

    /**
     * Check for trusted setup vulnerabilities
     * 
     * @param {Object} context - Evaluation context
     * @returns {Object|null} - Vulnerability details if found, null otherwise
     */
    checkTrustedSetupSecurity(context) {
        const setupInfo = context.trustedSetup || {};

        // Check if the trusted setup is properly secured
        if (setupInfo.isCentralized && !setupInfo.hasVerifiableRandomness) {
            return {
                location: {
                    file: context.filePath,
                    line: setupInfo.lineNumber || 0
                },
                evidence: 'Centralized trusted setup without verifiable randomness',
                recommendation: 'Implement multi-party computation for trusted setup with verifiable randomness'
            };
        }

        return null;
    }

    /**
     * Check for soundness issues in the ZK protocol
     * 
     * @param {Object} context - Evaluation context
     * @returns {Object|null} - Vulnerability details if found, null otherwise
     */
    checkSoundness(context) {
        const prover = context.prover || {};

        // Check for incomplete constraints or missing edge cases
        if (prover.hasIncompleteConstraints) {
            return {
                location: {
                    file: context.filePath,
                    line: prover.lineNumber || 0
                },
                evidence: 'Incomplete constraint system may allow invalid proofs',
                recommendation: 'Ensure all possible states are properly constrained in the proving system'
            };
        }

        return null;
    }

    /**
     * Get extended recommendation for fixing ZK vulnerabilities
     * 
     * @returns {string} - Extended recommendation text
     */
    getRecommendation() {
        const baseRecommendation = super.getRecommendation();

        // Add ZK specific recommendations
        let zkRecommendation = '';

        if (this.zkMetadata.proofSystem) {
            zkRecommendation += `\n- For ${this.zkMetadata.proofSystem} proof systems, ensure you follow the security best practices specific to this protocol.`;
        }

        if (this.zkMetadata.affectedComponents && this.zkMetadata.affectedComponents.length > 0) {
            zkRecommendation += `\n- Pay special attention to these components: ${this.zkMetadata.affectedComponents.join(', ')}.`;
        }

        if (this.zkMetadata.affectsTrustedSetup) {
            zkRecommendation += `\n- This issue affects the trusted setup. Consider implementing a multi-party computation ceremony with verifiable randomness.`;
        }

        return baseRecommendation + zkRecommendation;
    }

    /**
     * Get rule information as a plain object, including ZK metadata
     * 
     * @returns {Object} - Rule information with ZK metadata
     */
    toJSON() {
        const baseJson = super.toJSON();
        return {
            ...baseJson,
            zkMetadata: this.zkMetadata
        };
    }
}

export default ZKSecurityRule; 