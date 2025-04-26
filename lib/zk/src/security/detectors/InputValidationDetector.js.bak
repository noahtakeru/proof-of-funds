/**
 * Input Validation Detector for ZK Proofs
 * 
 * This detector identifies missing or inadequate input validation
 * in zero-knowledge proof applications. Proper input validation
 * is critical to prevent malicious inputs from causing system failures
 * or vulnerabilities.
 */

import { SecurityRule } from '../rules/SecurityRule.js';
import { RuleCategory, Severity } from '../AuditConfig.js';

/**
 * @class InputValidationDetector
 * @classdesc Detects inadequate or missing input validation in ZK proof systems
 * Input validation is critical for ZK proof systems as invalid inputs can lead to
 * security vulnerabilities, including potential proof forgery or system crashes.
 * This detector analyzes code patterns to identify missing validation checks.
 * 
 * @extends {SecurityRule}
 * @exports
 */
export class InputValidationDetector extends SecurityRule {
    /**
     * Create a new input validation detector
     * 
     * @param {Object} [options] - Detector options
     */
    constructor(options = {}) {
        super({
            id: 'ZK-INPUT-VAL-001',
            name: 'Input Validation Detector',
            description: 'Detects missing or inadequate input validation in ZK systems',
            severity: 'HIGH',
            ...options
        });

        // Define patterns for potential input validation issues
        this.patterns = {
            // Direct usage of inputs without validation
            noInputValidation: /(?<input>function\s+\w+\s*\([^)]*\)\s*{[^}]*(?:input|param|arg|witness)[^}]*})(?![^}]*(?:valid|check|sanitize|verify|assert))/g,

            // Missing type checking
            noTypeChecking: /(?<type>\b(?:let|var|const)\s+\w+\s*=\s*(?:input|param|args?)\.(\w+))(?![^;]*(?:typeof|instanceof|isNaN|Number|String|BigInt))/g,

            // Missing range checking
            noRangeChecking: /(?<range>\b(?:let|var|const)\s+\w+\s*=\s*(?:input|param|args?)\.(\w+))(?![^;]*(?:[<>]=?|===|!==|Math\.(?:min|max)|\.length))/g,

            // Unsafe parsing of inputs
            unsafeParsing: /(?<parse>(?:parseInt|parseFloat|Number|BigInt|JSON\.parse)\s*\(\s*(?:input|param|args?|req\.body|req\.query|req\.params)\.(\w+)\s*\))(?![^;]*(?:try|catch|isNaN))/g,

            // Missing sanitization of string inputs
            noStringSanitization: /(?<string>\b(?:let|var|const)\s+\w+\s*=\s*(?:input|param|args?)\.(\w+)(?:\s*\|\|\s*["'][^"']*["'])?)(?![^;]*(?:trim|replace|test|match|sanitize))/g,

            // Missing array bounds checking
            noArrayBoundsCheck: /(?<array>\b(?:let|var|const)\s+\w+\s*=\s*(?:input|param|args?)\.(\w+)(?:\s*\|\|\s*\[\]))(?![^;]*(?:\.length|Array\.isArray))/g
        };
    }

    /**
     * Check if a file is relevant for input validation analysis
     * 
     * @param {string} filePath - Path to the file
     * @param {string} content - File content
     * @returns {boolean} Whether the file is relevant
     */
    isRelevantFile(filePath, content) {
        // Only analyze JavaScript/TypeScript files 
        if (!/\.(js|ts|jsx|tsx)$/.test(filePath)) {
            return false;
        }

        // Check if file contains input-related keywords
        const relevantKeywords = [
            'input', 'param', 'argument', 'proof', 'witness', 'request',
            'validate', 'parse', 'req.body', 'req.query', 'sanitize'
        ];

        const contentLower = content.toLowerCase();
        for (const keyword of relevantKeywords) {
            if (contentLower.includes(keyword)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Find all matches for a pattern in the code
     * 
     * @param {string} content - Code content
     * @param {RegExp} pattern - Pattern to match
     * @returns {Array<Object>} Array of matches
     */
    findPatternMatches(content, pattern) {
        const matches = [];
        let match;

        // Reset the lastIndex to ensure we start from the beginning
        pattern.lastIndex = 0;

        while ((match = pattern.exec(content)) !== null) {
            // Avoid infinite loops for zero-width matches
            if (match.index === pattern.lastIndex) {
                pattern.lastIndex++;
            }

            const lineNumber = this.getLineNumber(content, match.index);

            matches.push({
                match: match[0],
                index: match.index,
                lineNumber,
                variableName: match.groups && match.groups.input ? this.extractVariableName(match.groups.input) : null,
                groups: match.groups || {}
            });
        }

        return matches;
    }

    /**
     * Extract variable name from a match
     * 
     * @param {string} matchStr - Matched string
     * @returns {string|null} Extracted variable name
     */
    extractVariableName(matchStr) {
        // Extract variable name from declaration
        const varMatch = /\b(?:let|var|const)\s+(\w+)\s*=/.exec(matchStr);
        if (varMatch) {
            return varMatch[1];
        }

        // Extract function name from function declaration
        const funcMatch = /function\s+(\w+)\s*\(/.exec(matchStr);
        if (funcMatch) {
            return funcMatch[1];
        }

        return null;
    }

    /**
     * Check if there's validation code nearby a match
     * 
     * @param {string} content - File content
     * @param {number} matchIndex - Index of the match
     * @param {string} [varName] - Variable name to check for
     * @returns {boolean} Whether validation exists nearby
     */
    hasValidationNearby(content, matchIndex, varName) {
        // Look for validation patterns within a reasonable range (300 chars)
        const contextRadius = 300;
        const startIndex = Math.max(0, matchIndex - contextRadius);
        const endIndex = Math.min(content.length, matchIndex + contextRadius);
        const context = content.substring(startIndex, endIndex);

        // Generic validation patterns
        const validationPatterns = [
            /validate(?:Input|Param|Args|Request)/i,
            /(?:check|verify|assert)(?:Input|Param|Args|Request)/i,
            /\b(?:isValid|isValidInput|sanitizeInput)\b/i,
            /\bschema\.validate\b/i,
            /\b(?:joi|yup|zod|ajv)\.validate\b/i,
            /throw new (?:Error|ValidationError)/i,
            /\breturn (?:false|null|undefined|error)/i
        ];

        // Check for generic validation
        for (const pattern of validationPatterns) {
            if (pattern.test(context)) {
                return true;
            }
        }

        // If variable name is provided, check for validation specific to that variable
        if (varName) {
            const varValidationPattern = new RegExp(`(?:validate|check|verify|assert|isValid)\\s*\\(\\s*${varName}\\b|${varName}\\s*(?:\\.(?:length|type|value)\\s*(?:[<>]=?|===|!==|[!=]=)|instanceof\\b|typeof\\b)`, 'i');
            if (varValidationPattern.test(context)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check for advanced validation issues in ZK systems
     * 
     * @param {string} content - File content
     * @returns {Array<Object>} Array of issues found
     */
    checkForAdvancedIssues(content) {
        const findings = [];

        // Check for BigInt validation (common in ZK systems)
        if (/BigInt\(\s*(?:input|param|args?)\.(\w+)\s*\)/g.test(content) &&
            !/(try|catch|isNaN)\s*\{\s*BigInt\(/g.test(content)) {
            const match = /BigInt\(\s*(?:input|param|args?)\.(\w+)\s*\)/g.exec(content);
            if (match) {
                findings.push({
                    type: 'unchecked-bigint-conversion',
                    message: 'BigInt conversion without error handling might throw for invalid inputs',
                    lineNumber: this.getLineNumber(content, match.index)
                });
            }
        }

        // Check for missing pedersen commitment validation
        if (/pedersen(?:Hash|Commit)/i.test(content) &&
            !/validate(?:Commitment|PedersenCommit)/i.test(content)) {
            const match = /pedersen(?:Hash|Commit)/i.exec(content);
            if (match) {
                findings.push({
                    type: 'missing-commitment-validation',
                    message: 'Pedersen commitments are used without proper validation',
                    lineNumber: this.getLineNumber(content, match.index)
                });
            }
        }

        // Check for missing field element validation
        if (/(?:field|scalar|bn128|babyJub|curve).*element/i.test(content) &&
            !/(?:isInField|checkField|validate(?:Field|Scalar))/i.test(content)) {
            const match = /(?:field|scalar|bn128|babyJub|curve).*element/i.exec(content);
            if (match) {
                findings.push({
                    type: 'missing-field-validation',
                    message: 'Field elements are used without validation against field modulus',
                    lineNumber: this.getLineNumber(content, match.index)
                });
            }
        }

        // Check for insecure input file handling
        if (/(?:read|load)(?:File|Input)(?:Sync|Async)?/i.test(content) &&
            !/validate(?:File|Input)|sanitize/i.test(content)) {
            const match = /(?:read|load)(?:File|Input)(?:Sync|Async)?/i.exec(content);
            if (match) {
                findings.push({
                    type: 'insecure-file-handling',
                    message: 'File input is read without validation or sanitization',
                    lineNumber: this.getLineNumber(content, match.index)
                });
            }
        }

        return findings;
    }

    /**
     * Get the line number for an index in the code
     * 
     * @param {string} content - File content
     * @param {number} index - Character index
     * @returns {number} Line number (1-based)
     */
    getLineNumber(content, index) {
        const lines = content.substring(0, index).split('\n');
        return lines.length;
    }

    /**
     * Get code snippet around a line
     * 
     * @param {Array<string>} lines - All lines of code
     * @param {number} lineNumber - Target line number (1-based)
     * @param {number} [context=2] - Number of context lines before/after
     * @returns {string} Code snippet
     */
    getCodeSnippet(lines, lineNumber, context = 2) {
        const startLine = Math.max(0, lineNumber - context - 1);
        const endLine = Math.min(lines.length - 1, lineNumber + context - 1);

        return lines.slice(startLine, endLine + 1).join('\n');
    }

    /**
     * Evaluate a target file for input validation issues
     * 
     * @param {Object} target - Target to evaluate
     * @param {string} target.code - File content
     * @param {string} target.filePath - Path to the file
     * @param {Object} context - Additional context
     * @returns {Array<Object>} Array of findings
     */
    evaluate(target, context) {
        const findings = [];
        const { code, filePath } = target;

        // Skip non-relevant files
        if (!this.isRelevantFile(filePath, code)) {
            return findings;
        }

        const lines = code.split('\n');

        // Check for each pattern issue
        for (const [patternName, pattern] of Object.entries(this.patterns)) {
            const matches = this.findPatternMatches(code, pattern);

            for (const match of matches) {
                // Skip if there's validation nearby
                if (this.hasValidationNearby(code, match.index, match.variableName)) {
                    continue;
                }

                findings.push(this._createFinding({
                    message: this.getMessageForPattern(patternName, match),
                    filePath,
                    line: match.lineNumber,
                    column: 1, // Approximate column
                    code: this.getCodeSnippet(lines, match.lineNumber),
                    metadata: {
                        patternName,
                        matchedCode: match.match,
                        variableName: match.variableName
                    }
                }));
            }
        }

        // Check for advanced validation issues
        const advancedIssues = this.checkForAdvancedIssues(code);

        for (const issue of advancedIssues) {
            findings.push(this._createFinding({
                message: issue.message,
                filePath,
                line: issue.lineNumber,
                column: 1, // Approximate column
                code: this.getCodeSnippet(lines, issue.lineNumber),
                metadata: {
                    type: issue.type
                }
            }));
        }

        return findings;
    }

    /**
     * Get descriptive message for a pattern
     * 
     * @param {string} patternName - Pattern name
     * @param {Object} match - Match information
     * @returns {string} Descriptive message
     */
    getMessageForPattern(patternName, match) {
        const varName = match && match.variableName ? match.variableName : 'input';
        const messages = {
            noInputValidation: `Function uses input parameters without validation`,
            noTypeChecking: `Variable '${varName}' is used without type checking`,
            noRangeChecking: `Variable '${varName}' lacks range or bounds validation`,
            unsafeParsing: `Unsafe parsing of input without error handling`,
            noStringSanitization: `String input '${varName}' is not sanitized`,
            noArrayBoundsCheck: `Array input '${varName}' lacks bounds checking`
        };

        return messages[patternName] || 'Missing input validation detected';
    }
}

export default InputValidationDetector; 