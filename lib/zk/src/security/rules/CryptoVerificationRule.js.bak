/**
 * @fileoverview Security rule for detecting cryptographic verification vulnerabilities
 * 
 * This rule detects patterns in code that might lead to improper verification
 * of cryptographic primitives in ZK proof implementations.
 */

import { SecurityRule } from '../SecurityRule.js';

/**
 * Security rule to detect potential cryptographic verification vulnerabilities
 */
export class CryptoVerificationRule extends SecurityRule {
    /**
     * Create a new CryptoVerificationRule
     */
    constructor() {
        super({
            id: 'crypto-verification',
            name: 'Cryptographic Verification',
            description: 'Detects potential vulnerabilities in cryptographic verification implementations',
            severity: 'high',
            metadata: {
                moreInfoUrl: 'https://github.com/your-org/zk-security-rules/wiki/CryptoVerificationRule',
                exemptPatterns: [
                    // Patterns that should be exempt from this rule
                    /\/\/ SECURITY-REVIEWED:/i,
                    /\/\/ CRYPTO-AUDIT-PASSED:/i
                ]
            }
        });

        // Patterns that indicate potential vulnerabilities
        this.patterns = {
            weakVerification: [
                // Missing verification
                /verify\s*\(\s*\)\s*{\s*return\s+true/i,
                /isValid\s*\(\s*\)\s*{\s*return\s+true/i,

                // Incomplete verification
                /verify\w+\s*\([^)]*\)\s*{\s*(?!.*check).*return\s+true/i,

                // Commented out verification
                /\/\/\s*verify/i,
                /\/\*\s*verify[^*]*\*\//i,

                // Hardcoded hash comparisons
                /compare\w*\s*\([^)]*\s*===?\s*["']([a-fA-F0-9]{32,})["']/i,
                /===?\s*["']([a-fA-F0-9]{32,})["']/i
            ],
            unsafeComparison: [
                // Non-constant time comparison
                /===/i,
                /!===/i,
                /==/i,
                /!=/i
            ],
            constantTimeBypass: [
                // Early returns in verification functions
                /verify\w*\s*\([^)]*\)\s*{\s*[^}]*if\s*\([^)]*\)\s*{\s*return\s+(true|false)/i,
                /is\w+Valid\s*\([^)]*\)\s*{\s*[^}]*if\s*\([^)]*\)\s*{\s*return\s+(true|false)/i
            ],
            uncheckedInputs: [
                // Not checking inputs before use in crypto operations
                /function\s+verify\w*\s*\([^)]*\)\s*{\s*(?![^}]*if\s*\([^)]*instanceof)/i,
                /function\s+verify\w*\s*\([^)]*\)\s*{\s*(?![^}]*if\s*\([^)]*typeof)/i,
                /function\s+verify\w*\s*\([^)]*\)\s*{\s*(?![^}]*if\s*\([^)]*length)/i
            ],
            insecureRandom: [
                // Use of Math.random in crypto operations
                /Math\.random\(\)/i,
                // Non-cryptographically secure random functions
                /\brandom\(\)/i,
                /\brandInt\(/i,
                /\brandBytes\(/i
            ]
        };
    }

    /**
     * Check if this rule applies to the given file
     * 
     * @param {Object} context - The audit context
     * @returns {boolean} - Whether this rule applies
     */
    appliesTo(context) {
        const cryptoRelatedPatterns = [
            /verify/i,
            /crypto/i,
            /hash/i,
            /sign/i,
            /proof/i,
            /zkp/i,
            /zk.*proof/i,
            /schnorr/i,
            /groth16/i,
            /sha\d+/i,
            /keccak/i,
            /eddsa/i
        ];

        return cryptoRelatedPatterns.some(pattern => pattern.test(context.code));
    }

    /**
     * Check for weak verification implementations
     * 
     * @param {string} code - Code to check
     * @param {string} filePath - Path of the file being checked
     * @returns {Object[]} Array of findings
     */
    checkWeakVerification(code, filePath) {
        const findings = [];

        for (const pattern of this.patterns.weakVerification) {
            const matches = Array.from(code.matchAll(new RegExp(pattern, 'g')));

            for (const match of matches) {
                if (this.isExemptPattern(match[0])) {
                    continue;
                }

                const lineNumber = this._getLineNumber(code, match.index);
                findings.push({
                    rule: this.id,
                    message: 'Weak or insufficient cryptographic verification detected',
                    severity: this.severity,
                    lineNumber,
                    column: this._getColumn(code, match.index),
                    snippet: match[0],
                    filePath
                });
            }
        }

        return findings;
    }

    /**
     * Check for non-constant time comparisons in crypto code
     * 
     * @param {string} code - Code to check
     * @param {string} filePath - Path of the file being checked
     * @returns {Object[]} Array of findings
     */
    checkUnsafeComparison(code, filePath) {
        const findings = [];
        const comparisonContextPattern = /(verify|isValid|check|compare)[^{]*{[^}]*?((===?)|(==))[^}]*}/gi;

        const contextMatches = Array.from(code.matchAll(comparisonContextPattern));

        for (const contextMatch of contextMatches) {
            const context = contextMatch[0];

            // Only flag if there's no explicit constant-time comparison library/function being used
            if (!/constantTime|timingSafe|timingResistant|secureCompare|cryptoCompare/.test(context)) {
                for (const pattern of this.patterns.unsafeComparison) {
                    const matches = Array.from(context.matchAll(new RegExp(pattern, 'g')));

                    for (const match of matches) {
                        if (this.isExemptPattern(context)) {
                            continue;
                        }

                        const lineNumber = this._getLineNumber(code, contextMatch.index + context.indexOf(match[0]));
                        findings.push({
                            rule: this.id,
                            message: 'Non-constant time comparison in cryptographic verification',
                            severity: this.severity,
                            lineNumber,
                            column: this._getColumn(code, contextMatch.index + context.indexOf(match[0])),
                            snippet: match[0],
                            recommendation: 'Use a constant-time comparison function like crypto.timingSafeEqual()',
                            filePath
                        });
                    }
                }
            }
        }

        return findings;
    }

    /**
     * Check for potential timing attack vulnerabilities
     * 
     * @param {string} code - Code to check
     * @param {string} filePath - Path of the file being checked
     * @returns {Object[]} Array of findings
     */
    checkConstantTimeBypass(code, filePath) {
        const findings = [];

        for (const pattern of this.patterns.constantTimeBypass) {
            const matches = Array.from(code.matchAll(new RegExp(pattern, 'g')));

            for (const match of matches) {
                if (this.isExemptPattern(match[0])) {
                    continue;
                }

                const lineNumber = this._getLineNumber(code, match.index);
                findings.push({
                    rule: this.id,
                    message: 'Potential timing attack vulnerability due to early return in verification',
                    severity: this.severity,
                    lineNumber,
                    column: this._getColumn(code, match.index),
                    snippet: match[0],
                    recommendation: 'Avoid early returns in cryptographic verification functions to prevent timing attacks',
                    filePath
                });
            }
        }

        return findings;
    }

    /**
     * Check for unchecked input validation before crypto operations
     * 
     * @param {string} code - Code to check
     * @param {string} filePath - Path of the file being checked
     * @returns {Object[]} Array of findings
     */
    checkUncheckedInputs(code, filePath) {
        const findings = [];

        for (const pattern of this.patterns.uncheckedInputs) {
            const matches = Array.from(code.matchAll(new RegExp(pattern, 'g')));

            for (const match of matches) {
                if (this.isExemptPattern(match[0])) {
                    continue;
                }

                const lineNumber = this._getLineNumber(code, match.index);
                findings.push({
                    rule: this.id,
                    message: 'Cryptographic function with potentially unchecked inputs',
                    severity: 'medium',
                    lineNumber,
                    column: this._getColumn(code, match.index),
                    snippet: match[0],
                    recommendation: 'Validate all inputs before using them in cryptographic operations',
                    filePath
                });
            }
        }

        return findings;
    }

    /**
     * Check for insecure random number generation
     * 
     * @param {string} code - Code to check
     * @param {string} filePath - Path of the file being checked
     * @returns {Object[]} Array of findings
     */
    checkInsecureRandom(code, filePath) {
        const findings = [];

        for (const pattern of this.patterns.insecureRandom) {
            const matches = Array.from(code.matchAll(new RegExp(pattern, 'g')));

            for (const match of matches) {
                if (this.isExemptPattern(match[0])) {
                    continue;
                }

                const lineNumber = this._getLineNumber(code, match.index);
                findings.push({
                    rule: this.id,
                    message: 'Insecure random number generation in cryptographic context',
                    severity: 'high',
                    lineNumber,
                    column: this._getColumn(code, match.index),
                    snippet: match[0],
                    recommendation: 'Use crypto.randomBytes() or crypto.getRandomValues() for cryptographic operations',
                    filePath
                });
            }
        }

        return findings;
    }

    /**
     * Check for missing verification in cryptographic implementations
     * 
     * @param {string} code - Code to check
     * @param {string} filePath - Path of the file being checked
     * @returns {Object[]} Array of findings
     * @private
     */
    _checkMissingVerification(code, filePath) {
        return this.checkWeakVerification(code, filePath);
    }

    /**
     * Check for insecure random number generation in cryptographic implementations
     * 
     * @param {string} code - Code to check
     * @param {string} filePath - Path of the file being checked
     * @returns {Object[]} Array of findings
     * @private
     */
    _checkInsecureRandomGeneration(code, filePath) {
        return this.checkInsecureRandom(code, filePath);
    }

    /**
     * Check for hardcoded secrets in code
     * 
     * @param {string} code - Code to check
     * @param {string} filePath - Path of the file being checked
     * @returns {Object[]} Array of findings
     * @private
     */
    _checkHardcodedSecrets(code, filePath) {
        const findings = [];
        const patterns = [
            /const\s+(?:secret|key|password|token)\s*=\s*['"`][^'"`]{8,}['"`]/gi,
            /let\s+(?:secret|key|password|token)\s*=\s*['"`][^'"`]{8,}['"`]/gi,
            /var\s+(?:secret|key|password|token)\s*=\s*['"`][^'"`]{8,}['"`]/gi,
            /private\s+(?:secret|key|password|token)\s*=\s*['"`][^'"`]{8,}['"`]/gi
        ];

        for (const pattern of patterns) {
            const matches = Array.from(code.matchAll(pattern));

            for (const match of matches) {
                if (this.isExemptPattern(match[0])) {
                    continue;
                }

                const lineNumber = this._getLineNumber(code, match.index);
                findings.push({
                    rule: this.id,
                    message: 'Hardcoded secret or key found in source code',
                    severity: 'critical',
                    lineNumber,
                    column: this._getColumn(code, match.index),
                    snippet: match[0],
                    recommendation: 'Store secrets in environment variables or a secure vault',
                    filePath
                });
            }
        }

        return findings;
    }

    /**
     * Check for usage of weak cryptographic algorithms
     * 
     * @param {string} code - Code to check
     * @param {string} filePath - Path of the file being checked
     * @returns {Object[]} Array of findings
     * @private
     */
    _checkWeakAlgorithms(code, filePath) {
        const findings = [];
        const weakAlgorithms = [
            { pattern: /createHash\s*\(\s*['"]md5['"]\s*\)/i, name: 'MD5' },
            { pattern: /createHash\s*\(\s*['"]sha1['"]\s*\)/i, name: 'SHA-1' },
            { pattern: /createCipher\s*\(\s*['"]des['"]/i, name: 'DES' },
            { pattern: /createCipher\s*\(\s*['"]rc4['"]/i, name: 'RC4' },
            { pattern: /createCipher\s*\(\s*['"]blowfish['"]/i, name: 'Blowfish' }
        ];

        for (const algo of weakAlgorithms) {
            const matches = Array.from(code.matchAll(algo.pattern));

            for (const match of matches) {
                if (this.isExemptPattern(match[0])) {
                    continue;
                }

                const lineNumber = this._getLineNumber(code, match.index);
                findings.push({
                    rule: this.id,
                    message: `Weak cryptographic algorithm (${algo.name}) detected`,
                    severity: 'high',
                    lineNumber,
                    column: this._getColumn(code, match.index),
                    snippet: match[0],
                    recommendation: 'Use modern algorithms like SHA-256/SHA-3 for hashing, and AES-256-GCM for encryption',
                    filePath
                });
            }
        }

        return findings;
    }

    /**
     * Evaluate the code for cryptographic verification vulnerabilities
     * 
     * @param {Object} context - Evaluation context
     * @param {string} context.code - Code to evaluate
     * @param {string} context.filePath - Path of the file being evaluated
     * @returns {Object[]} Array of findings
     */
    evaluate(context) {
        if (!this.appliesTo(context)) {
            return [];
        }

        const { code, filePath } = context;

        const findings = [
            ...this._checkMissingVerification(code, filePath),
            ...this._checkInsecureRandomGeneration(code, filePath),
            ...this._checkHardcodedSecrets(code, filePath),
            ...this._checkWeakAlgorithms(code, filePath),
            ...this.checkUnsafeComparison(code, filePath),
            ...this.checkConstantTimeBypass(code, filePath),
            ...this.checkUncheckedInputs(code, filePath)
        ];

        return findings;
    }

    /**
     * Get the line number for a character position in code
     * 
     * @param {string} code - The code to analyze
     * @param {number} index - Character index
     * @returns {number} Line number (1-based)
     * @private
     */
    _getLineNumber(code, index) {
        return code.substring(0, index).split('\n').length;
    }

    /**
     * Get the column number for a character position in code
     * 
     * @param {string} code - The code to analyze
     * @param {number} index - Character index
     * @returns {number} Column number (1-based)
     * @private
     */
    _getColumn(code, index) {
        const lastNewline = code.lastIndexOf('\n', index);
        return lastNewline === -1 ? index + 1 : index - lastNewline;
    }
}

export default CryptoVerificationRule; 