/**
 * ParameterTamperingRule for detecting code vulnerable to parameter manipulation
 * 
 * This rule identifies patterns that may indicate vulnerability to parameter tampering:
 * - Missing input validation
 * - Unverified user inputs used in critical operations
 * - Improper parameter boundary checks
 * - Lack of parameter type verification
 */

import { AuditRule } from './AuditRule.js';
import { RuleCategory, Severity } from '../AuditConfig.js';

/**
 * @class ParameterTamperingRule
 * @classdesc Security rule for detecting potential parameter tampering vulnerabilities
 * This rule analyzes code for patterns that might indicate insufficient validation
 * of inputs, allowing attackers to manipulate parameters sent to ZK proof systems.
 * It focuses on detecting direct use of user inputs in critical operations, missing
 * validation checks, and unsafe assignment patterns.
 * 
 * @extends {AuditRule}
 * @exports
 */
export class ParameterTamperingRule extends AuditRule {
    /**
     * Create a new rule for detecting parameter tampering vulnerabilities
     */
    constructor() {
        super({
            id: 'ZK-PARAM-TAMPER-001',
            name: 'Parameter Tampering Vulnerability',
            description: 'Detects code patterns vulnerable to parameter manipulation or insufficient input validation',
            severity: Severity.HIGH,
            category: RuleCategory.INPUT_VALIDATION,
            references: [
                'https://owasp.org/www-community/attacks/Web_Parameter_Tampering',
                'https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html'
            ],
            tags: ['parameter-tampering', 'input-validation', 'zero-knowledge']
        });

        // Patterns that indicate potential parameter tampering vulnerabilities
        this.vulnerabilityPatterns = {
            directUserInput: [
                /req\.(?:body|params|query)\.(\w+)(?!\s*=)/g,
                /JSON\.parse\(.*(?:body|input|data).*\)/g
            ],
            missingValidation: [
                /function\s+\w+\s*\([^)]*\)\s*{\s*(?!.*(?:assert|check|valid|verif))/g,
                /exports\.\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*=>\s*{(?!.*(?:assert|check|valid|verif))/g
            ],
            unsafeAssignment: [
                /(\w+)\s*=\s*req\.(?:body|params|query)\.(\w+)/g,
                /const\s+(\w+)\s*=\s*req\.(?:body|params|query)\.(\w+)/g,
                /let\s+(\w+)\s*=\s*req\.(?:body|params|query)\.(\w+)/g
            ],
            criticalOperations: [
                /prove\(.*\)/g,
                /verify\(.*\)/g,
                /generate(?:Proof|Key|Secret)\(.*\)/g
            ]
        };
    }

    /**
     * Evaluate a target to check for parameter tampering vulnerabilities
     * 
     * @param {Object} target - Target to evaluate
     * @param {string} target.code - Code to analyze
     * @param {string} target.filePath - Path to the file
     * @param {string} [target.functionName] - Function name (if target is a function)
     * @param {Object} context - Additional context information
     * @returns {Array<Object>} Array of findings
     */
    _defaultEvaluate(target, context) {
        const findings = [];
        const { code, filePath, functionName } = target;

        if (!code || typeof code !== 'string') {
            return [];
        }

        // Extract all function definitions to analyze them for parameter validation patterns
        const functionMatches = this._extractFunctions(code);

        // Check direct user input patterns
        this._findPatternMatches(findings, code, filePath, functionName,
            this.vulnerabilityPatterns.directUserInput,
            'Direct use of user input detected',
            'Validate and sanitize all user inputs before using them in operations'
        );

        // Check for unsafe assignment
        this._findPatternMatches(findings, code, filePath, functionName,
            this.vulnerabilityPatterns.unsafeAssignment,
            'Unsafe assignment of user input',
            'Always validate user input before assignment and consider using a validation library'
        );

        // Check functions with critical operations but without validation
        this._checkFunctionsForValidation(findings, functionMatches, code, filePath);

        return findings;
    }

    /**
     * Extract all function definitions from code
     * 
     * @param {string} code - Code to analyze
     * @returns {Array<Object>} Array of function matches with name, start, end, and body
     * @private
     */
    _extractFunctions(code) {
        const functions = [];
        const functionRegex = /(?:function\s+(\w+)\s*\([^)]*\)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>)\s*{([^}]*)}/g;

        let match;
        while ((match = functionRegex.exec(code)) !== null) {
            const name = match[1] || match[2];
            const body = match[3];
            const start = match.index;
            const end = match.index + match[0].length;

            functions.push({ name, body, start, end });
        }

        return functions;
    }

    /**
     * Check functions for critical operations without proper validation
     * 
     * @param {Array} findings - Array to add findings to
     * @param {Array<Object>} functions - Array of function matches
     * @param {string} code - Original code
     * @param {string} filePath - Path to file
     * @private
     */
    _checkFunctionsForValidation(findings, functions, code, filePath) {
        for (const func of functions) {
            let hasCriticalOperation = false;

            // Check if function contains critical operations
            for (const pattern of this.vulnerabilityPatterns.criticalOperations) {
                if (pattern.test(func.body)) {
                    hasCriticalOperation = true;
                    break;
                }
            }

            if (hasCriticalOperation) {
                // Check if function has validation
                const hasValidation = /(?:assert|check|valid|verif|if\s*\()/.test(func.body);

                if (!hasValidation) {
                    const { line, column } = this.findLineAndColumn(code, func.start);

                    findings.push(this.createFinding({
                        title: 'Critical operation without input validation',
                        message: `Function ${func.name} performs critical operations without proper input validation`,
                        filePath,
                        line,
                        column,
                        lineText: this.getLineText(code, line),
                        functionName: func.name,
                        recommendation: 'Implement proper input validation before performing critical operations',
                        context: this.extractCodeContext(code, func.start, 3)
                    }));
                }
            }
        }
    }

    /**
     * Helper method to find pattern matches and create findings
     * 
     * @param {Array} findings - Array to add findings to
     * @param {string} code - Code to analyze
     * @param {string} filePath - Path to the file
     * @param {string} functionName - Function name if applicable
     * @param {Array<RegExp>} patterns - Array of regex patterns to match
     * @param {string} title - Title for the finding
     * @param {string} recommendation - Recommendation to fix the issue
     * @private
     */
    _findPatternMatches(findings, code, filePath, functionName, patterns, title, recommendation) {
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(code)) !== null) {
                const matchedText = match[0];
                const { line, column } = this.findLineAndColumn(code, match.index);

                findings.push(this.createFinding({
                    title,
                    message: `${title}: ${matchedText}`,
                    filePath,
                    line,
                    column,
                    lineText: this.getLineText(code, line),
                    functionName,
                    recommendation,
                    context: this.extractCodeContext(code, match.index, 3)
                }));
            }
        }
    }
}

export default ParameterTamperingRule; 