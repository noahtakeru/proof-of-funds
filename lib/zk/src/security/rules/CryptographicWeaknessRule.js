/**
 * CryptographicWeaknessRule for detecting cryptographic weaknesses in ZK implementations
 * 
 * This rule identifies potential cryptographic weaknesses in code, including:
 * - Weak random number generation
 * - Insufficient entropy
 * - Hardcoded cryptographic values
 * - Improper use of cryptographic primitives
 */

import { AuditRule } from './AuditRule.js';
import { RuleCategory, Severity } from '../AuditConfig.js';

export class CryptographicWeaknessRule extends AuditRule {
    /**
     * Create a new rule for detecting cryptographic weaknesses
     */
    constructor() {
        super({
            id: 'ZK-CRYPTO-WEAKNESS-001',
            name: 'Cryptographic Implementation Weakness',
            description: 'Identifies potential cryptographic weaknesses in zero-knowledge proof implementations',
            severity: Severity.CRITICAL,
            category: RuleCategory.CRYPTOGRAPHIC,
            references: [
                'https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html',
                'https://nvd.nist.gov/vuln-metrics/cvss'
            ],
            tags: ['cryptography', 'security', 'zero-knowledge']
        });

        // Patterns that indicate potential cryptographic weaknesses
        this.weaknessPatterns = {
            weakRandomness: [
                /Math\.random\(\)/g,
                /new Date\(\)\.getTime\(\)/g
            ],
            insufficientEntropy: [
                /generateKey.*?(?:128|512|1024)/g,
                /crypto\.randomBytes\(\s*(?:4|8)\s*\)/g
            ],
            hardcodedCrypto: [
                /const\s+(?:key|iv|salt|nonce)\s*=\s*['"][0-9a-fA-F]+['"]/g,
                /['"][0-9a-fA-F]{32,}['"]/g
            ],
            insecureAlgorithms: [
                /createHash\s*\(\s*['"]md5['"]\s*\)/g,
                /createCipheriv\s*\(\s*['"]des['"]/g,
                /createCipheriv\s*\(\s*['"]rc4['"]/g
            ]
        };
    }

    /**
     * Evaluate a target to check for cryptographic weaknesses
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

        // Check for weak randomness
        this._findPatternMatches(findings, code, filePath, functionName,
            this.weaknessPatterns.weakRandomness,
            'Weak random number generation detected',
            'Use cryptographically secure random number generation like crypto.randomBytes() instead of Math.random()'
        );

        // Check for insufficient entropy
        this._findPatternMatches(findings, code, filePath, functionName,
            this.weaknessPatterns.insufficientEntropy,
            'Potentially insufficient entropy detected',
            'Ensure sufficient entropy for cryptographic operations to prevent brute force attacks'
        );

        // Check for hardcoded cryptographic values
        this._findPatternMatches(findings, code, filePath, functionName,
            this.weaknessPatterns.hardcodedCrypto,
            'Hardcoded cryptographic value detected',
            'Avoid hardcoding cryptographic values such as keys, IVs, or nonces'
        );

        // Check for insecure algorithms
        this._findPatternMatches(findings, code, filePath, functionName,
            this.weaknessPatterns.insecureAlgorithms,
            'Insecure cryptographic algorithm detected',
            'Use secure and modern cryptographic algorithms (SHA-256 or better, AES)'
        );

        return findings;
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

export default CryptographicWeaknessRule; 