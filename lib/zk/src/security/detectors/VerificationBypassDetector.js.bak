/**
 * @file VerificationBypassDetector.js
 * @description Detects potential verification bypass vulnerabilities in ZK proofs
 * 
 * This detector identifies vulnerabilities that could allow attackers to bypass
 * verification steps in ZK proof systems, potentially allowing invalid proofs
 * to be accepted as valid.
 * 
 * ---------- MOCK STATUS ----------
 * This file contains the following mock implementations:
 * - patterns.mockVerification: A regular expression (line 31) designed to detect mock implementations
 *   that could bypass verification. The pattern itself is part of a security detector and needs 
 *   refinement to handle legitimate test code versus actual bypass vulnerabilities.
 * 
 * This mock is documented in MOCKS.md with priority MEDIUM for replacement.
 */

import { SecurityRule } from '../rules/SecurityRule.js';
import { RuleCategory, Severity } from '../AuditConfig.js';

/**
 * Detector for ZK proof verification bypass vulnerabilities
 */
export class VerificationBypassDetector extends SecurityRule {
    /**
     * Create a new VerificationBypassDetector
     */
    constructor() {
        super(
            'ZK-VERIFY-001',
            'Verification Bypass Vulnerability',
            'Identifies code patterns that could allow attackers to bypass proof verification steps',
            Severity.CRITICAL,
            RuleCategory.SECURITY
        );

        // Common patterns that may indicate verification bypass vulnerabilities
        this.patterns = {
            conditionalVerification: /if\s*\(.*\)\s*{\s*verify|validate/i,
            earlyReturn: /return\s+(true|false)\s*;\s*}\s*\/\/\s*skip verification/i,
            mockVerification: /mock(Verify|Validation)|test(Verify|Validation)|skip(Verify|Validation)/i,
            debugFlags: /(DEBUG|TEST|DEVELOPMENT).*?verify/i,
            optionalVerification: /optional(Verify|Validation)|if\s*\(\s*options\.(verify|validate)/i,
            truncatedVerification: /\/\/\s*TODO.*?verification|\/\/\s*FIXME.*?verification/i
        };
    }

    /**
     * Evaluate a file for verification bypass vulnerabilities
     * @param {Object} file The file to evaluate
     * @returns {Array} An array of findings
     */
    evaluate(file) {
        const findings = [];

        if (!this.isRelevantFile(file)) {
            return findings;
        }

        const content = file.content || '';

        // Check for pattern matches
        for (const [key, pattern] of Object.entries(this.patterns)) {
            const matches = [...content.matchAll(new RegExp(pattern, 'g'))];

            for (const match of matches) {
                // Skip if there are strong protective measures nearby
                if (this.hasProtectionNearby(content, match.index)) {
                    continue;
                }

                const line = this.getLineNumber(content, match.index);
                findings.push({
                    ruleId: this.id,
                    severity: this.severity,
                    message: `Potential verification bypass vulnerability: ${key}`,
                    location: {
                        file: file.path,
                        position: {
                            line: line
                        }
                    },
                    code: match[0],
                    suggestion: 'Ensure verification steps cannot be bypassed under any circumstances'
                });
            }
        }

        // Check for advanced verification bypass issues
        const advancedIssues = this.checkAdvancedVerificationIssues(content, file.path);
        findings.push(...advancedIssues);

        return findings;
    }

    /**
     * Check if a file is relevant for verification bypass checking
     * @param {Object} file The file to check
     * @returns {boolean} True if the file is relevant
     */
    isRelevantFile(file) {
        if (!file || !file.path || !file.content) {
            return false;
        }

        // Check if file is likely to contain verification logic
        const path = file.path.toLowerCase();
        const content = file.content.toLowerCase();

        return path.includes('verify') ||
            path.includes('valid') ||
            path.includes('proof') ||
            content.includes('verify') ||
            content.includes('validate') ||
            content.includes('proof');
    }

    /**
     * Check if there are protection mechanisms nearby a match
     * @param {string} content The file content
     * @param {number} index The match index
     * @returns {boolean} True if protection is found
     */
    hasProtectionNearby(content, index) {
        // Check for a reasonable window around the match
        const window = 200;
        const start = Math.max(0, index - window);
        const end = Math.min(content.length, index + window);
        const contextWindow = content.substring(start, end);

        // Protection patterns
        const protectionPatterns = [
            /assert\(.*?verify/i,
            /require\(.*?verify/i,
            /if\s*\(\s*!\s*verify.*?\)\s*{\s*throw/i,
            /mandatory\s*verification/i
        ];

        return protectionPatterns.some(pattern => pattern.test(contextWindow));
    }

    /**
     * Check for advanced verification bypass issues
     * @param {string} content The file content
     * @param {string} filePath The file path
     * @returns {Array} An array of findings
     */
    checkAdvancedVerificationIssues(content, filePath) {
        const findings = [];
        const line = 1; // Default to line 1 if specific line can't be determined

        // Check for verification functions that always return true
        if (/function\s+verify.*?{\s*[^}]*?return\s+true/is.test(content)) {
            findings.push({
                ruleId: this.id,
                severity: this.severity,
                message: 'Verification function always returns true',
                location: {
                    file: filePath,
                    position: {
                        line: line
                    }
                },
                suggestion: 'Implement proper verification logic instead of always returning true'
            });
        }

        // Check for verification functions with no error handling
        if (/function\s+verify.*?{\s*[^}]*?try\s*{[^}]*?}\s*catch\s*\([^)]*\)\s*{\s*return\s+true/is.test(content)) {
            findings.push({
                ruleId: this.id,
                severity: this.severity,
                message: 'Verification catch block returns true, allowing errors to pass verification',
                location: {
                    file: filePath,
                    position: {
                        line: line
                    }
                },
                suggestion: 'Errors during verification should fail the validation, not pass it'
            });
        }

        // Check for direct field manipulation that could bypass verification
        if (/\.isVerified\s*=\s*true/i.test(content)) {
            findings.push({
                ruleId: this.id,
                severity: this.severity,
                message: 'Direct manipulation of verification status flag',
                location: {
                    file: filePath,
                    position: {
                        line: line
                    }
                },
                suggestion: 'Verification status should only be set through proper verification methods'
            });
        }

        return findings;
    }

    /**
     * Get the line number for a character index
     * @param {string} content The file content
     * @param {number} index The character index
     * @returns {number} The line number
     */
    getLineNumber(content, index) {
        return content.substring(0, index).split('\n').length;
    }
} 