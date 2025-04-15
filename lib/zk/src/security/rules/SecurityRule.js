/**
 * @fileoverview Base class for security rules in ZK proof systems
 * 
 * This class provides the foundational structure for all security rules
 * used to detect vulnerabilities in ZK proof implementations. Each rule
 * implements evaluation logic for specific types of security issues in
 * the ZK codebase.
 * 
 * @module SecurityRule
 */

import { RuleCategory, Severity } from '../AuditConfig.js';
import zkErrorLogger from '../../zkErrorLogger.js';

/**
 * Custom error class for security rule validation errors
 * @class SecurityRuleValidationError
 * @classdesc Error thrown when a security rule is invalid or fails validation
 * @extends Error
 * @exports
 */
export class SecurityRuleValidationError extends Error {
    /**
     * Create a new SecurityRuleValidationError
     * @param {string} message - Error message
     * @param {string} ruleId - ID of the rule that caused the error
     * @param {Object} [context] - Additional error context
     */
    constructor(message, ruleId, context = {}) {
        super(`[${ruleId || 'Unknown'}] ${message}`);
        this.name = 'SecurityRuleValidationError';
        this.ruleId = ruleId;
        this.context = context;
    }
}

/**
 * Custom error class for security rule execution errors
 * @class SecurityRuleExecutionError
 * @classdesc Error thrown when a security rule fails during execution
 * @extends Error
 * @exports
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
 * Custom error class for security rule configuration errors
 * @class SecurityRuleConfigError
 * @classdesc Error thrown when a security rule is misconfigured
 * @extends Error
 * @exports
 */
export class SecurityRuleConfigError extends Error {
    /**
     * Create a new SecurityRuleConfigError
     * @param {string} message - Error message
     * @param {string} ruleId - ID of the rule with configuration issues
     * @param {Object} config - The problematic configuration
     */
    constructor(message, ruleId, config = {}) {
        super(`[${ruleId || 'Unknown'}] Configuration error: ${message}`);
        this.name = 'SecurityRuleConfigError';
        this.ruleId = ruleId;
        this.config = config;
    }
}

/**
 * @class SecurityRule
 * @classdesc Base security rule class for detecting vulnerabilities in ZK proof systems
 * This abstract class serves as the foundation for all security rules in the ZK security
 * framework. It provides core functionality for rule configuration, evaluation,
 * and finding management. Specific rule types extend this class to implement
 * targeted security checks.
 * 
 * @exports
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
     * @param {Object} [options.params={}] - Rule-specific parameters
     * @param {Object} [options.metadata={}] - Additional rule metadata
     * @throws {SecurityRuleConfigError} When required options are missing or invalid
     */
    constructor(options) {
        if (!options || !options.id || !options.name || !options.description) {
            const configError = new SecurityRuleConfigError(
                'Security rule requires id, name, and description',
                options?.id || 'unknown',
                options
            );

            zkErrorLogger.logError(configError, {
                context: 'SecurityRule.constructor',
                options: options
            });

            throw configError;
        }

        this.id = options.id;
        this.name = options.name;
        this.description = options.description;
        this.severity = options.severity || 'medium';
        this.enabled = options.enabled !== undefined ? options.enabled : true;
        this.params = options.params || {};
        this.metadata = options.metadata || {};

        // Validate severity
        const validSeverities = ['low', 'medium', 'high', 'critical'];
        if (!validSeverities.includes(this.severity)) {
            const severityError = new SecurityRuleConfigError(
                `Invalid severity: ${this.severity}. Must be one of: ${validSeverities.join(', ')}`,
                this.id,
                { providedSeverity: this.severity, validSeverities }
            );

            zkErrorLogger.logError(severityError, {
                context: 'SecurityRule.constructor',
                ruleId: this.id,
                ruleName: this.name
            });

            throw severityError;
        }
    }

    /**
     * Evaluate a target against this security rule
     * 
     * @param {Object} target - Target to evaluate (file or function)
     * @param {string} target.code - Code to analyze
     * @param {string} target.filePath - Path to the file
     * @param {string} [target.functionName] - Function name (if target is a function)
     * @param {Object} context - Additional context information
     * @returns {Array<Object>} Array of findings
     * @throws {SecurityRuleExecutionError} When evaluation fails
     */
    evaluate(target, context) {
        const notImplementedError = new SecurityRuleExecutionError(
            'evaluate() method must be implemented by security rule subclasses',
            this.id,
            { target, context }
        );

        zkErrorLogger.logError(notImplementedError, {
            context: 'SecurityRule.evaluate',
            ruleId: this.id,
            ruleName: this.name
        });

        throw notImplementedError;
    }

    /**
     * Create a finding object
     * 
     * @param {Object} details - Finding details
     * @param {string} details.message - Finding message
     * @param {string} details.filePath - Path to the file
     * @param {number} [details.line] - Line number
     * @param {number} [details.column] - Column number
     * @param {string} [details.code] - Related code snippet
     * @param {Object} [details.metadata] - Additional metadata
     * @returns {Object} Formatted finding
     * @protected
     */
    _createFinding(details) {
        try {
            return {
                ruleId: this.id,
                ruleName: this.name,
                message: details.message,
                severity: this.severity,
                filePath: details.filePath,
                line: details.line,
                column: details.column,
                code: details.code,
                metadata: details.metadata || {},
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityRule._createFinding',
                ruleId: this.id,
                details: JSON.stringify(details)
            });

            // Return minimal finding in case of error
            return {
                ruleId: this.id,
                ruleName: this.name,
                message: details.message || 'Error creating finding',
                severity: this.severity,
                filePath: details.filePath,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Find line and column number for a position in code
     * 
     * @param {string} code - Full code string
     * @param {number} position - Character position
     * @returns {Object} Line and column numbers
     * @protected
     */
    _findLineAndColumn(code, position) {
        try {
            const lines = code.substring(0, position).split('\n');
            const line = lines.length;
            const column = lines[lines.length - 1].length + 1;

            return { line, column };
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityRule._findLineAndColumn',
                ruleId: this.id,
                position,
                codeLength: code?.length
            });
            return { line: 1, column: 1 }; // Default values in case of error
        }
    }

    /**
     * Extract code context around a position
     * 
     * @param {string} code - Full code string
     * @param {number} position - Character position
     * @param {number} [contextSize=2] - Number of context lines before and after
     * @returns {string} Code context
     * @protected
     */
    _extractCodeContext(code, position, contextSize = 2) {
        try {
            const lines = code.split('\n');
            const { line } = this._findLineAndColumn(code, position);

            const startLine = Math.max(0, line - contextSize - 1);
            const endLine = Math.min(lines.length - 1, line + contextSize - 1);

            return lines.slice(startLine, endLine + 1).join('\n');
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityRule._extractCodeContext',
                ruleId: this.id,
                position,
                contextSize
            });
            return ''; // Return empty string in case of error
        }
    }

    /**
     * Find all occurrences of a pattern in code
     * 
     * @param {string} code - Code to search
     * @param {RegExp} pattern - Regular expression pattern
     * @returns {Array<Object>} Array of matches with positions
     * @protected
     */
    _findAllOccurrences(code, pattern) {
        try {
            const matches = [];
            let match;

            // Reset the regex to start from the beginning
            pattern.lastIndex = 0;

            while ((match = pattern.exec(code)) !== null) {
                const position = match.index;
                const { line, column } = this._findLineAndColumn(code, position);

                matches.push({
                    match: match[0],
                    position,
                    line,
                    column,
                    groups: match.groups || {}
                });

                // Avoid infinite loops with zero-width matches
                if (match.index === pattern.lastIndex) {
                    pattern.lastIndex++;
                }
            }

            return matches;
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityRule._findAllOccurrences',
                ruleId: this.id,
                patternSource: pattern.source
            });
            return []; // Return empty array in case of error
        }
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
     * Update rule parameters
     * 
     * @param {Object} parameters - New parameters
     */
    updateParameters(parameters) {
        try {
            this.params = { ...this.params, ...parameters };
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityRule.updateParameters',
                ruleId: this.id,
                parameters
            });
        }
    }

    /**
     * Get rule information
     * 
     * @returns {Object} - Rule information
     */
    getInfo() {
        try {
            return {
                id: this.id,
                name: this.name,
                description: this.description,
                severity: this.severity,
                params: { ...this.params },
                enabled: this.enabled
            };
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityRule.getInfo',
                ruleId: this.id
            });
            return { id: this.id, error: 'Failed to get rule info' };
        }
    }
}

/**
 * Default export for the SecurityRule class
 * @exports SecurityRule
 */
export default SecurityRule; 