/**
 * AuditRule class for ZK security audits
 * 
 * This class extends the SecurityRule class to provide audit-specific
 * functionality for identifying security issues in ZK implementations.
 */

import { SecurityRule, SecurityRuleConfigError, SecurityRuleExecutionError } from './SecurityRule.js';
import { RuleCategory, Severity } from '../AuditConfig.js';
import zkErrorLogger from '../../zkErrorLogger.js';

/**
 * @class AuditRule
 * @classdesc Security rule specialized for audit purposes with enhanced metadata capabilities
 * AuditRule extends the base SecurityRule with additional audit-specific properties
 * such as references, tags, and custom evaluators, making it more suitable for
 * comprehensive security audits of ZK proof systems.
 * 
 * @extends {SecurityRule}
 * @exports
 */
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
     * @throws {SecurityRuleConfigError} When required options are missing
     */
    constructor(options) {
        // Ensure all required properties are present
        if (!options.category) {
            const configError = new SecurityRuleConfigError(
                'AuditRule requires a category from RuleCategory enum',
                options?.id || 'unknown-audit-rule',
                { options }
            );

            zkErrorLogger.logError(configError, {
                context: 'AuditRule.constructor',
                options: options
            });

            throw configError;
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
                const executionError = new SecurityRuleExecutionError(
                    `Error evaluating rule: ${error.message}`,
                    this.id,
                    { target, context, originalError: error }
                );

                zkErrorLogger.logError(executionError, {
                    context: 'AuditRule.evaluate',
                    ruleId: this.id,
                    ruleName: this.name,
                    target: {
                        filePath: target.filePath,
                        hasFunction: !!target.functionName
                    }
                });

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
        try {
            this.references = [...this.references, ...refs];
            return this;
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'AuditRule.addReferences',
                ruleId: this.id,
                ruleName: this.name
            });
            return this;
        }
    }

    /**
     * Add tags to the rule
     * 
     * @param {string[]} newTags - Tags to add
     * @returns {AuditRule} This instance for chaining
     */
    addTags(newTags) {
        try {
            this.tags = [...this.tags, ...newTags];
            return this;
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'AuditRule.addTags',
                ruleId: this.id,
                ruleName: this.name
            });
            return this;
        }
    }

    /**
     * Get extended rule information including audit-specific properties
     * 
     * @returns {Object} - Complete rule information
     */
    getInfo() {
        try {
            return {
                ...super.getInfo(),
                category: this.category,
                references: [...this.references],
                tags: [...this.tags],
                auditMetadata: { ...this.auditMetadata }
            };
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'AuditRule.getInfo',
                ruleId: this.id,
                ruleName: this.name
            });
            return {
                id: this.id,
                name: this.name,
                error: 'Failed to get complete rule info'
            };
        }
    }
}

export default AuditRule; 