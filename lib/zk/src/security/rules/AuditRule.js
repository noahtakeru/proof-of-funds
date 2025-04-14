/**
 * AuditRule class for ZK security audits
 * 
 * This class extends the SecurityRule class to provide audit-specific
 * functionality for identifying security issues in ZK implementations.
 */

import { SecurityRule } from './SecurityRule.js';
import { RuleCategory, Severity } from '../AuditConfig.js';

export class AuditRule extends SecurityRule {
    /**
     * Create a new audit rule for security auditing
     * 
     * @param {Object} options - Rule configuration options
     * @param {string} options.id - Unique identifier for the rule
     * @param {string} options.name - Human-readable name of the rule
     * @param {string} options.description - Detailed description of the rule
     * @param {string} options.severity - Severity level from Severity enum
     * @param {string} options.category - Rule category from RuleCategory enum
     * @param {string[]} [options.references=[]] - Array of reference URLs related to this rule
     * @param {Function} [options.evaluator] - Function to evaluate if the rule is violated
     * @param {Object} [options.auditMetadata={}] - Audit-specific metadata
     * @param {string[]} [options.tags=[]] - Tags associated with this rule
     * @param {boolean} [options.enabled=true] - Whether the rule is enabled
     */
    constructor(options) {
        // Ensure all required properties are present
        if (!options.category) {
            throw new Error('AuditRule requires a category from RuleCategory enum');
        }

        super(options);

        // Add audit specific properties
        this.category = options.category;
        this.references = options.references || [];
        this.evaluator = options.evaluator;
        this.auditMetadata = options.auditMetadata || {};
        this.tags = options.tags || [];
    }

    /**
     * Evaluate a target against this audit rule using the custom evaluator if provided
     * 
     * @param {Object} target - Target to evaluate (file or function)
     * @param {string} target.code - Code to analyze
     * @param {string} target.filePath - Path to the file
     * @param {string} [target.functionName] - Function name (if target is a function)
     * @param {Object} context - Additional context information
     * @returns {Array<Object>} Array of findings
     */
    evaluate(target, context) {
        if (!this.enabled) {
            return [];
        }

        if (typeof this.evaluator === 'function') {
            try {
                const findings = this.evaluator(target, context, this);
                return Array.isArray(findings) ? findings : [];
            } catch (error) {
                console.error(`Error evaluating rule ${this.id}: ${error.message}`);
                return [];
            }
        }

        // Default implementation for when no evaluator is provided
        return this._defaultEvaluate(target, context);
    }

    /**
     * Default evaluation implementation
     * 
     * @param {Object} target - Target to evaluate
     * @param {Object} context - Additional context information
     * @returns {Array<Object>} Array of findings
     * @private
     */
    _defaultEvaluate(target, context) {
        // This should be overridden by subclasses if they don't use an evaluator function
        return [];
    }

    /**
     * Add references to the rule
     * 
     * @param {string[]} refs - References to add
     * @returns {AuditRule} This instance for chaining
     */
    addReferences(refs) {
        this.references = [...this.references, ...refs];
        return this;
    }

    /**
     * Add tags to the rule
     * 
     * @param {string[]} newTags - Tags to add
     * @returns {AuditRule} This instance for chaining
     */
    addTags(newTags) {
        this.tags = [...this.tags, ...newTags];
        return this;
    }

    /**
     * Get extended rule information including audit-specific properties
     * 
     * @returns {Object} - Complete rule information
     */
    getInfo() {
        return {
            ...super.getInfo(),
            category: this.category,
            references: [...this.references],
            tags: [...this.tags],
            auditMetadata: { ...this.auditMetadata }
        };
    }
}

export default AuditRule; 