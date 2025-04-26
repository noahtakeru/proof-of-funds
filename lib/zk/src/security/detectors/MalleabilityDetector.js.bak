/**
 * Malleability Detector for ZK Proofs
 * 
 * This detector identifies potential malleability vulnerabilities in
 * zero-knowledge proof implementations. Malleability occurs when an
 * attacker can modify a valid proof to create another valid proof
 * without knowing the secret.
 */

import { SecurityRule } from '../rules/SecurityRule.js';
import { RuleCategory, Severity } from '../AuditConfig.js';

/**
 * @class MalleabilityDetector
 * @classdesc Detects potential malleability vulnerabilities in ZK proof systems
 * Proof malleability is a critical vulnerability that allows attackers to transform 
 * valid proofs into other valid proofs without knowing the underlying secret.
 * This detector identifies code patterns that could lead to malleable proofs.
 * 
 * @extends {SecurityRule}
 * @exports
 */
export class MalleabilityDetector extends SecurityRule {
    /**
     * Create a new malleability detector
     * 
     * @param {Object} [options] - Detector options
     */
    constructor(options = {}) {
        super({
            id: 'ZK-MALLEABLE-001',
            name: 'Proof Malleability Detector',
            description: 'Detects vulnerabilities that could allow proof malleability in ZK systems',
            severity: 'CRITICAL',
            ...options
        });

        // Define patterns for potential malleability vulnerabilities
        this.patterns = {
            // Direct proof usage without structural validation
            noStructuralValidation: /(?<verify>verify(?:Proof)?\s*\([^)]*\)\s*{[^}]*return\s+(?:result|valid|check))(?![^}]*structure|[^}]*format|[^}]*schema|[^}]*type)/g,

            // Absence of hash verification
            noHashVerification: /(?<proof>proof\s*[=:][^;{]*;)(?![^;{]*hash|[^;{]*digest|[^;{]*checksum)/g,

            // Direct binary proof manipulation
            directBinaryManipulation: /(?<binary>(?:proof|credential)\.(?:data|content|raw|binary)\s*=)/g,

            // Missing signature verification
            noSignatureVerification: /(?<proof>proof(?:Data)?\s*\.verify\s*\([^)]*\))(?![^;{]*signature|[^;{]*signed|[^;{]*(?:ec|rsa|eddsa))/ig,

            // Weak encoding/decoding of proofs
            weakEncoding: /(?<encoding>(?:encodeURI|decodeURI|btoa|atob|JSON\.parse|JSON\.stringify)\s*\((?:[^)]*proof|[^)]*credential)[^)]*\))/g,

            // Missing proof integrity checks
            noIntegrityCheck: /(?<integrity>verify(?:Proof)?\s*\([^)]*\))(?![^;{]*integr|[^;{]*tamper|[^;{]*(?:hmac|mac))/g
        };
    }

    /**
     * Check if a file is relevant for malleability analysis
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

        // Check if file contains proof-related keywords
        const relevantKeywords = [
            'proof', 'verify', 'credential', 'zkp', 'zero-knowledge',
            'snark', 'stark', 'bulletproof', 'signature', 'zk'
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
                groups: match.groups || {}
            });
        }

        return matches;
    }

    /**
     * Check if there's protection code nearby a match
     * 
     * @param {string} content - File content
     * @param {number} matchIndex - Index of the match
     * @returns {boolean} Whether protection exists nearby
     */
    hasProtectionNearby(content, matchIndex) {
        // Look for protection patterns within a reasonable range (300 chars)
        const contextRadius = 300;
        const startIndex = Math.max(0, matchIndex - contextRadius);
        const endIndex = Math.min(content.length, matchIndex + contextRadius);
        const context = content.substring(startIndex, endIndex);

        // Protection patterns
        const protectionPatterns = [
            /nonMalleable/i,
            /prevent(?:Proof)?Malleability/i,
            /isStructureValid/i,
            /validateProofStructure/i,
            /validateFormat/i,
            /checkIntegrity/i,
            /(?:ec|rsa|eddsa)Verify/i,
            /(?:hmac|sha256|sha512|keccak|blake2b)/i,
            /strictEqual/i,
            /immutable/i,
            /readonly/i
        ];

        for (const pattern of protectionPatterns) {
            if (pattern.test(context)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check for vulnerable cryptographic implementations that could lead to malleability
     * 
     * @param {string} content - File content
     * @returns {Array<Object>} Array of vulnerabilities
     */
    checkForVulnerableImplementations(content) {
        const findings = [];

        // Check for ECDSA usage without low-S value normalization
        if (/ECDSA/i.test(content) && !/normaliz(e|ing)\s+[sS][-\s]value/i.test(content)) {
            const index = content.search(/ECDSA/i);
            if (index !== -1) {
                findings.push({
                    type: 'ecdsa-malleable',
                    message: 'ECDSA signature without low-S value normalization may be malleable',
                    lineNumber: this.getLineNumber(content, index)
                });
            }
        }

        // Check for malleable Merkle tree implementations (using non-collision-resistant hashing)
        if (/merkle\s*tree/i.test(content) &&
            !/(sha256|sha512|keccak|blake2b|sha3)/i.test(content) &&
            /(md5|sha1|double\s*hashing)/i.test(content)) {
            const index = content.search(/merkle\s*tree/i);
            if (index !== -1) {
                findings.push({
                    type: 'weak-merkle-hashing',
                    message: 'Merkle tree implementation uses weak hashing algorithm, potentially allowing malleability',
                    lineNumber: this.getLineNumber(content, index)
                });
            }
        }

        // Check for homomorphic operations without integrity checks
        if (/homomorphic/i.test(content) && !/integrity\s*check/i.test(content)) {
            const index = content.search(/homomorphic/i);
            if (index !== -1) {
                findings.push({
                    type: 'unchecked-homomorphic',
                    message: 'Homomorphic operations without integrity checks may allow proof malleability',
                    lineNumber: this.getLineNumber(content, index)
                });
            }
        }

        // Check for direct proof modification
        const proofModificationPattern = /(?:proof|credential)\.(?:data|elements|values|points)(?:\[\w+\])?\s*=\s*[^;]*/g;
        let match;
        while ((match = proofModificationPattern.exec(content)) !== null) {
            findings.push({
                type: 'direct-proof-modification',
                message: 'Direct modification of proof elements may create malleability vulnerabilities',
                lineNumber: this.getLineNumber(content, match.index)
            });
        }

        // Check for encoding/decoding of proofs without validation
        const encodingPattern = /(?:encode|decode|parse|stringify)\(\s*(?:proof|credential)/g;
        while ((match = encodingPattern.exec(content)) !== null) {
            if (!this.hasProtectionNearby(content, match.index)) {
                findings.push({
                    type: 'unsafe-proof-encoding',
                    message: 'Encoding/decoding proofs without validation may lead to malleability',
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
     * Evaluate a target file for malleability vulnerabilities
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

        // Check for each vulnerability pattern
        for (const [patternName, pattern] of Object.entries(this.patterns)) {
            const matches = this.findPatternMatches(code, pattern);

            for (const match of matches) {
                // Skip if there's protection nearby
                if (this.hasProtectionNearby(code, match.index)) {
                    continue;
                }

                findings.push(this._createFinding({
                    message: this.getMessageForPattern(patternName),
                    filePath,
                    line: match.lineNumber,
                    column: 1, // Approximate column
                    code: this.getCodeSnippet(lines, match.lineNumber),
                    metadata: {
                        patternName,
                        matchedCode: match.match
                    }
                }));
            }
        }

        // Check for vulnerable implementations
        const vulnerableImplementations = this.checkForVulnerableImplementations(code);

        for (const vuln of vulnerableImplementations) {
            findings.push(this._createFinding({
                message: vuln.message,
                filePath,
                line: vuln.lineNumber,
                column: 1, // Approximate column
                code: this.getCodeSnippet(lines, vuln.lineNumber),
                metadata: {
                    type: vuln.type
                }
            }));
        }

        return findings;
    }

    /**
     * Get descriptive message for a pattern
     * 
     * @param {string} patternName - Pattern name
     * @returns {string} Descriptive message
     */
    getMessageForPattern(patternName) {
        const messages = {
            noStructuralValidation: 'Proof verification lacks structural validation, allowing malleability',
            noHashVerification: 'Proof is used without hash verification',
            directBinaryManipulation: 'Direct manipulation of binary proof data may create malleability',
            noSignatureVerification: 'Missing signature verification in proof validation',
            weakEncoding: 'Weak encoding/decoding methods used for proofs',
            noIntegrityCheck: 'Proof verification lacks integrity checks'
        };

        return messages[patternName] || 'Potential proof malleability vulnerability detected';
    }
}

export default MalleabilityDetector; 