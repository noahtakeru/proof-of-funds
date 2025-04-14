/**
 * Base Security Rule Class
 * 
 * Defines the interface for all security rules to implement.
 * Security rules analyze code to identify potential security vulnerabilities.
 */

import { RuleCategory, Severity } from '../AuditConfig.js';

export class SecurityRule {
    /**
     * Create a new security rule
     * 
     * @param {Object} options - Rule configuration
     * @param {string} options.id - Unique rule identifier
     * @param {string} options.name - Human-readable rule name
     * @param {string} options.description - Description of what the rule checks for
     * @param {string} options.severity - Rule severity ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO')
     * @param {Object} [options.params={}] - Additional rule parameters
     */
    constructor(options) {
        if (!options || !options.id || !options.name || !options.description || !options.severity) {
            throw new Error('Security rule requires id, name, description, and severity');
        }

        this.id = options.id;
        this.name = options.name;
        this.description = options.description;
        this.severity = options.severity;
        this.params = options.params || {};
        this.enabled = true;
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
     */
    evaluate(target, context) {
        throw new Error('evaluate() method must be implemented by security rule subclasses');
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
        const lines = code.substring(0, position).split('\n');
        const line = lines.length;
        const column = lines[lines.length - 1].length + 1;

        return { line, column };
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
        const lines = code.split('\n');
        const { line } = this._findLineAndColumn(code, position);

        const startLine = Math.max(0, line - contextSize - 1);
        const endLine = Math.min(lines.length - 1, line + contextSize - 1);

        return lines.slice(startLine, endLine + 1).join('\n');
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
        this.params = { ...this.params, ...parameters };
    }

    /**
     * Get rule information
     * 
     * @returns {Object} - Rule information
     */
    getInfo() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            severity: this.severity,
            params: { ...this.params },
            enabled: this.enabled
        };
    }
}

export default SecurityRule; 