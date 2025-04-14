/**
 * Input Validation Rule
 * 
 * Security rule that checks for proper input validation in ZK proof generation
 */

import { SecurityRule } from './SecurityRule.js';
import { RuleCategory, Severity } from '../AuditConfig.js';

export class InputValidationRule extends SecurityRule {
    /**
     * Create a new input validation rule
     * 
     * @param {Object} [options] - Rule configuration
     * @param {Object} [options.parameters] - Rule-specific parameters
     * @param {boolean} [options.parameters.checkTypeValidation=true] - Check for type validation
     * @param {boolean} [options.parameters.checkRangeValidation=true] - Check for range validation
     * @param {boolean} [options.parameters.checkSanitization=true] - Check for input sanitization
     * @param {Array<RegExp>} [options.parameters.dangerousPatterns] - Patterns to check for
     */
    constructor(options = {}) {
        super({
            id: 'ZK-SEC-001',
            name: 'Input Validation',
            description: 'Checks for proper input validation in ZK proof generation',
            category: RuleCategory.INPUT_VALIDATION,
            severity: Severity.HIGH,
            parameters: {
                checkTypeValidation: true,
                checkRangeValidation: true,
                checkSanitization: true,
                dangerousPatterns: [
                    /^0x[a-fA-F0-9]*$/,  // Hex input without length validation
                    /(\d+)n(?!\s*instanceof)/,  // BigInt without validation
                    /JSON\.parse\(.*\)/  // JSON parsing without try/catch
                ],
                ...options.parameters
            }
        });
    }

    /**
     * Evaluate a code object for input validation issues
     * 
     * @param {Object} target - Target object to evaluate (function/code)
     * @param {Object} context - Evaluation context
     * @returns {Array} - Array of findings
     */
    evaluate(target, context) {
        const findings = [];

        // Skip if no target or not code
        if (!target || !target.code) {
            return findings;
        }

        const { code, filePath, functionName } = target;

        // Check for type validation
        if (this.parameters.checkTypeValidation) {
            const hasTypeValidation = this._checkTypeValidation(code);
            if (!hasTypeValidation) {
                findings.push(this.createFinding({
                    message: `Missing type validation in function ${functionName || 'unknown'}`,
                    location: { file: filePath },
                    source: this._extractRelevantCode(code),
                    metadata: {
                        validationType: 'type',
                        functionName
                    }
                }));
            }
        }

        // Check for range validation
        if (this.parameters.checkRangeValidation) {
            const hasRangeValidation = this._checkRangeValidation(code);
            if (!hasRangeValidation) {
                findings.push(this.createFinding({
                    message: `Missing range/bounds validation in function ${functionName || 'unknown'}`,
                    location: { file: filePath },
                    source: this._extractRelevantCode(code),
                    metadata: {
                        validationType: 'range',
                        functionName
                    }
                }));
            }
        }

        // Check for dangerous patterns
        const dangerousFindings = this._checkDangerousPatterns(code, filePath, functionName);
        findings.push(...dangerousFindings);

        return findings;
    }

    /**
     * Check if code has type validation
     * 
     * @param {string} code - Code to check
     * @returns {boolean} - True if type validation is present
     * @private
     */
    _checkTypeValidation(code) {
        // Check for common type validation patterns
        const typeofPattern = /typeof\s+\w+\s*===?\s*['"](?:string|number|boolean|object|function|undefined|bigint)['"]/;
        const instanceofPattern = /\w+\s+instanceof\s+(?:Array|BigInt|Object|String|Number|Boolean)/;
        const typeCheckPattern = /(?:isString|isNumber|isArray|isObject|isBoolean)\s*\(\s*\w+\s*\)/;

        return typeofPattern.test(code) ||
            instanceofPattern.test(code) ||
            typeCheckPattern.test(code);
    }

    /**
     * Check if code has range validation
     * 
     * @param {string} code - Code to check
     * @returns {boolean} - True if range validation is present
     * @private
     */
    _checkRangeValidation(code) {
        // Check for common range validation patterns
        const comparisonPattern = /\w+\s*(?:<=?|>=?|===?)\s*(?:\d+|0x[a-fA-F0-9]+|[A-Z_][A-Z0-9_]*)/;
        const minMaxPattern = /(?:Math\.min|Math\.max|\.length)\s*\(/;
        const rangeCheckPattern = /\w+\s*\.\s*(?:length|size)\s*(?:<=?|>=?|===?)\s*\d+/;

        return comparisonPattern.test(code) ||
            minMaxPattern.test(code) ||
            rangeCheckPattern.test(code);
    }

    /**
     * Check for dangerous patterns in code
     * 
     * @param {string} code - Code to check
     * @param {string} filePath - File path
     * @param {string} functionName - Function name
     * @returns {Array} - Array of findings
     * @private
     */
    _checkDangerousPatterns(code, filePath, functionName) {
        const findings = [];

        if (!this.parameters.dangerousPatterns) {
            return findings;
        }

        for (const pattern of this.parameters.dangerousPatterns) {
            if (pattern.test(code)) {
                findings.push(this.createFinding({
                    message: `Potentially unsafe pattern found in function ${functionName || 'unknown'}: ${pattern.toString()}`,
                    severity: Severity.MEDIUM,
                    location: { file: filePath },
                    source: this._extractRelevantCode(code, pattern),
                    metadata: {
                        validationType: 'dangerous-pattern',
                        functionName,
                        pattern: pattern.toString()
                    }
                }));
            }
        }

        return findings;
    }

    /**
     * Extract relevant code snippet from full code
     * 
     * @param {string} code - Full code
     * @param {RegExp} [pattern] - Pattern to search for
     * @returns {string} - Code snippet
     * @private
     */
    _extractRelevantCode(code, pattern = null) {
        if (!code) return '';

        const maxLength = 150;

        if (pattern) {
            const match = pattern.exec(code);
            if (match && match.index !== undefined) {
                const start = Math.max(0, match.index - 50);
                const end = Math.min(code.length, match.index + match[0].length + 50);
                return code.substring(start, end);
            }
        }

        // Return first part of code if no pattern or match
        return code.length > maxLength ? code.substring(0, maxLength) + '...' : code;
    }
}

export default InputValidationRule; 