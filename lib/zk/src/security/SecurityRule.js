/**
 * @fileoverview Base class for security rules in ZK proof systems
 * 
 * This class provides the foundational structure for all security rules
 * used to detect vulnerabilities in ZK proof implementations.
 */

import zkErrorLogger from '../zkErrorLogger.js';
import { RuleCategory, Severity } from './AuditConfig.js';

/**
 * Custom error class for security rule validation errors
 * @extends Error
 */
export class SecurityRuleValidationError extends Error {
    /**
     * Create a new SecurityRuleValidationError
     * @param {string} message - Error message
     * @param {string} ruleId - ID of the rule that caused the error
     */
    constructor(message, ruleId) {
        super(`[${ruleId || 'Unknown'}] ${message}`);
        this.name = 'SecurityRuleValidationError';
        this.ruleId = ruleId;
    }
}

/**
 * Custom error class for security rule execution errors
 * @extends Error
 */
export class SecurityRuleExecutionError extends Error {
    /**
     * Create a new SecurityRuleExecutionError
     * @param {string} message - Error message
     * @param {string} ruleId - ID of the rule that caused the error
     * @param {Object} context - Additional context about the error
     */
    constructor(message, ruleId, context = {}) {
        super(`[${ruleId || 'Unknown'}] ${message}`);
        this.name = 'SecurityRuleExecutionError';
        this.ruleId = ruleId;
        this.context = context;
    }
}

/**
 * Base security rule class that all specific rules should extend
 */
export class SecurityRule {
    /**
     * Create a new security rule
     * 
     * @param {Object} options - Rule configuration
     * @param {string} options.id - Unique identifier for the rule
     * @param {string} options.name - Human-readable name for the rule
     * @param {string} options.description - Description of what the rule checks
     * @param {string} options.severity - Severity level: 'low', 'medium', 'high', or 'critical'
     * @param {boolean} [options.enabled=true] - Whether the rule is enabled by default
     * @param {Object} [options.metadata={}] - Additional rule metadata
     */
    constructor(options) {
        if (!options || !options.id || !options.name || !options.description) {
            throw new Error('Security rule requires id, name, and description');
        }

        this.id = options.id;
        this.name = options.name;
        this.description = options.description;
        this.severity = options.severity || 'medium';
        this.enabled = options.enabled !== undefined ? options.enabled : true;
        this.metadata = options.metadata || {};

        // Validate severity
        const validSeverities = ['low', 'medium', 'high', 'critical'];
        if (!validSeverities.includes(this.severity)) {
            throw new Error(`Invalid severity: ${this.severity}. Must be one of: ${validSeverities.join(', ')}`);
        }
    }

    /**
     * Check if the rule is enabled
     * 
     * @returns {boolean} Whether the rule is enabled
     */
    isEnabled() {
        return this.enabled;
    }

    /**
     * Enable the rule
     */
    enable() {
        this.enabled = true;
    }

    /**
     * Disable the rule
     */
    disable() {
        this.enabled = false;
    }

    /**
     * Get rule metadata
     * 
     * @returns {Object} Rule metadata
     */
    getMetadata() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            severity: this.severity,
            enabled: this.enabled,
            ...this.metadata
        };
    }

    /**
     * Set rule metadata
     * 
     * @param {Object} metadata - Additional metadata to set
     */
    setMetadata(metadata) {
        this.metadata = { ...this.metadata, ...metadata };
    }

    /**
     * Abstract method to evaluate code against this rule
     * Must be implemented by subclasses
     * 
     * @param {Object} context - Evaluation context
     * @param {string} context.code - Code to evaluate
     * @param {string} context.filePath - Path of the file being evaluated
     * @returns {Object[]} - Array of finding objects
     */
    evaluate(context) {
        throw new Error(`Rule ${this.id} must implement evaluate() method`);
    }

    /**
     * Calculate numeric risk score based on severity
     * 
     * @returns {number} Risk score (1-10)
     */
    getRiskScore() {
        const scores = {
            'low': 3,
            'medium': 5,
            'high': 8,
            'critical': 10
        };

        return scores[this.severity] || 5;
    }

    /**
     * Get URL for more information about this rule
     * 
     * @returns {string|null} URL for more information or null if not available
     */
    getMoreInfoUrl() {
        return this.metadata.moreInfoUrl || null;
    }

    /**
     * Check if a code pattern is exempt from this rule
     * 
     * @param {string} pattern - The code pattern to check
     * @returns {boolean} Whether the pattern is exempt
     */
    isExemptPattern(pattern) {
        if (!this.metadata.exemptPatterns || !Array.isArray(this.metadata.exemptPatterns)) {
            return false;
        }

        return this.metadata.exemptPatterns.some(exemptPattern => {
            if (exemptPattern instanceof RegExp) {
                return exemptPattern.test(pattern);
            } else if (typeof exemptPattern === 'string') {
                return pattern.includes(exemptPattern);
            }
            return false;
        });
    }

    /**
     * Check if this rule applies to the given context
     * Must be implemented by subclasses to determine if rule should be evaluated
     * 
     * @param {Object} context - The audit context
     * @returns {boolean} - Whether this rule applies
     */
    appliesTo(context) {
        // Base implementation always applies
        return true;
    }

    /**
     * Get a recommendation based on the rule findings
     * 
     * @param {Object} context - Context used for evaluation
     * @returns {string} Recommendation text
     */
    getRecommendation(context) {
        try {
            // Default implementation, can be overridden by subclasses
            return `Review the code for issues related to ${this.name.toLowerCase()}.`;
        } catch (error) {
            // Log error with the ZK error logger
            zkErrorLogger.logError(error, {
                context: 'SecurityRule.getRecommendation',
                ruleId: this.id,
                ruleName: this.name
            });

            return 'Unable to generate recommendation due to an error.';
        }
    }

    /**
     * Create a finding object for a rule violation
     * 
     * @param {Object} details - Additional details about the finding
     * @param {string} details.message - Specific message about the violation
     * @param {string} details.location - Where the violation was found
     * @param {Array} details.evidence - Evidence supporting the finding
     * @param {string} details.recommendation - Recommended fix
     * @returns {Object} - The finding object
     */
    createFinding(details = {}) {
        return {
            ruleId: this.id,
            ruleName: this.name,
            severity: this.severity,
            category: this.category,
            message: details.message || this.description,
            location: details.location || 'Unknown',
            evidence: details.evidence || [],
            recommendation: details.recommendation || 'No specific recommendation provided',
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Check if this rule matches the specified parameters
     * 
     * @param {Object} params - Parameters to check
     * @param {string} params.id - Rule ID
     * @param {string} params.category - Rule category
     * @param {string} params.severity - Rule severity
     * @returns {boolean} - Whether this rule matches the parameters
     */
    matches(params = {}) {
        if (params.id && params.id !== this.id) return false;
        if (params.category && params.category !== this.category) return false;
        if (params.severity && params.severity !== this.severity) return false;
        return true;
    }
}

export default SecurityRule; 