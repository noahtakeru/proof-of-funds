/**
 * Replay Attack Detector for ZK Proofs
 * 
 * This detector identifies potential replay attack vulnerabilities in
 * zero-knowledge proof implementations. A replay attack occurs when a
 * valid proof is captured and reused in a different context or at a
 * different time.
 */

import { SecurityRule } from '../rules/SecurityRule.js';
import { RuleCategory, Severity } from '../AuditConfig.js';

/**
 * @class ReplayAttackDetector
 * @classdesc Detects potential replay attack vulnerabilities in ZK proof systems
 * Replay attacks occur when a valid proof is captured and reused at a different time
 * or in a different context. This detector identifies code patterns that might allow
 * such attacks, including missing nonce validation, no proof tracking, and absence
 * of temporal or contextual binding.
 * 
 * @extends {SecurityRule}
 * @exports
 */
export class ReplayAttackDetector extends SecurityRule {
    /**
     * Create a new replay attack detector
     * 
     * @param {Object} [options] - Detector options
     */
    constructor(options = {}) {
        super({
            id: 'ZK-REPLAY-001',
            name: 'Replay Attack Detector',
            description: 'Detects potential replay attack vulnerabilities in ZK proof systems',
            severity: 'HIGH',
            ...options
        });

        // Common patterns that may indicate replay attack vulnerabilities
        this.patterns = {
            // Missing proof tracking/storage
            noProofStorage: /(?<verify>verify(?:Proof)?\s*\([^)]*\)\s*{[^}]*return\s+(?:true|valid|result))(?![^}]*store|[^}]*record|[^}]*track|[^}]*log)/g,

            // Missing nonce or timestamp usage
            noNonce: /(?<proof>proof\s*[=:][^;]*;)(?![^;]*nonce|[^;]*timestamp|[^;]*time|[^;]*expir)/g,

            // Missing nullifier check
            noNullifier: /(?<zk>(?:zero-knowledge|zk|proof|verify))(?![^;{]*nullifier|[^;{]*uniqueId|[^;{]*oneTimeUse)/gi,

            // Missing expiration mechanism
            noExpiration: /(?<verify>verify(?:Proof)?\s*\([^)]*\))(?![^;{]*expir|[^;{]*timeout|[^;{]*ttl|[^;{]*valid(?:Until|Before|After))/g,

            // Missing context binding
            noContextBinding: /(?<verify>verify(?:Proof)?\s*\([^)]*\))(?![^;{]*context|[^;{]*session|[^;{]*domain|[^;{]*purpose|[^;{]*scope)/g,

            // Missing validation from storage
            noValidationFromStorage: /(?<verify>verify(?:Proof)?\s*\([^)]*\))(?![^;{]*(?:lookup|find|get|query|check)(?:Used|Spent|Consumed|Processed))/g
        };
    }

    /**
     * Check if a file is relevant for replay attack analysis
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
            'proof', 'verify', 'zk', 'zero-knowledge', 'authentication',
            'zkp', 'validate', 'snark', 'plonk', 'groth16', 'credential'
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
            /checkAlreadyUsed/i,
            /preventReplay/i,
            /replayProtection/i,
            /nullifier/i,
            /uniqueId/i,
            /isUsed\s*\(/i,
            /wasUsed\s*\(/i,
            /has(?:Proof|Nullifier)/i,
            /addUsedProof/i,
            /markAsUsed/i,
            /timestamp/i,
            /expiresAt/i,
            /validUntil/i,
            /nonce/i
        ];

        for (const pattern of protectionPatterns) {
            if (pattern.test(context)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check for advanced replay attack vulnerabilities
     * 
     * @param {string} content - File content
     * @returns {Array<Object>} Array of advanced vulnerabilities found
     */
    checkForAdvancedVulnerabilities(content) {
        const findings = [];

        // 1. Database transaction without atomicity for proof validation and storage
        if ((/verify(?:Proof)?\s*\([^)]*\)/i.test(content) &&
            /(?:save|store|insert|update|add)\s*\([^)]*proof/i.test(content)) &&
            !(/transaction|atomic|lock|mutex/.test(content))) {
            findings.push({
                type: 'non-atomic-verification',
                message: 'Proof verification and storage lack atomic transaction guarantees',
                lineNumber: this.getLineNumber(content, content.search(/verify(?:Proof)?\s*\([^)]*\)/i))
            });
        }

        // 2. Missing replay protection across different sessions/contexts
        if (/session(?:Id|Token|Key)/i.test(content) &&
            /verify(?:Proof)?\s*\([^)]*\)/i.test(content) &&
            !/(?:session|context|domain).*(?:verify|validate|check)/i.test(content)) {
            findings.push({
                type: 'missing-session-binding',
                message: 'Proof verification lacks binding to session/context',
                lineNumber: this.getLineNumber(content, content.search(/verify(?:Proof)?\s*\([^)]*\)/i))
            });
        }

        // 3. Distributed systems without global proof tracking
        if ((/cluster|distributed|multiple.*instances|scaling|load.{1,10}balanc(?:er|ing)/i.test(content) ||
            /kubernetes|k8s|docker|container/i.test(content)) &&
            /verify(?:Proof)?\s*\([^)]*\)/i.test(content) &&
            !/(?:redis|memcached|centralized|global).{1,30}(?:storage|cache|record|track)/i.test(content)) {
            findings.push({
                type: 'distributed-replay-vulnerability',
                message: 'Distributed system lacks global proof tracking for replay protection',
                lineNumber: this.getLineNumber(content, content.search(/verify(?:Proof)?\s*\([^)]*\)/i))
            });
        }

        // 4. No proof invalidation mechanism
        if (/verify(?:Proof)?\s*\([^)]*\)/i.test(content) &&
            !/invalidate(?:Proof|Credential|Token)/i.test(content) &&
            !/revoke(?:Proof|Credential|Token)/i.test(content)) {
            findings.push({
                type: 'missing-invalidation',
                message: 'No mechanism to invalidate/revoke proofs',
                lineNumber: this.getLineNumber(content, content.search(/verify(?:Proof)?\s*\([^)]*\)/i))
            });
        }

        return findings;
    }

    /**
     * Check if the code has usage tracking for proofs
     * 
     * @param {string} content - File content
     * @returns {boolean} Whether usage tracking exists
     */
    hasUsageTracking(content) {
        // Look for common usage tracking patterns
        const usageTrackingPatterns = [
            // Database operations
            /(?:insert|update|save)\s*\(\s*[^)]*(?:usedProof|proof.*used|nullifier)/i,

            // In-memory tracking
            /(?:usedProofs|nullifiers|proofMap|usedSet)\s*\.\s*(?:add|set|push)/i,

            // Cache operations
            /cache\s*\.\s*(?:set|put|add)\s*\(\s*[^,]+,\s*(?:true|1|used)/i,

            // Redis or similar usage
            /redis\s*\.\s*(?:set|sadd|zadd)\s*\(\s*[^,]+,/i,

            // Specialized tracking
            /track(?:Proof|Nullifier|Usage)/i,
            /mark(?:Proof|Nullifier)AsUsed/i
        ];

        for (const pattern of usageTrackingPatterns) {
            if (pattern.test(content)) {
                return true;
            }
        }

        return false;
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
     * Evaluate a target file for replay attack vulnerabilities
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

        // Check if the file has usage tracking
        const hasTracking = this.hasUsageTracking(code);

        // If file already has usage tracking, reduce the number of checks
        // to avoid false positives on files that already implement protection
        if (hasTracking) {
            // Only check for advanced vulnerabilities in files with tracking
            const advancedVulnerabilities = this.checkForAdvancedVulnerabilities(code);

            for (const vuln of advancedVulnerabilities) {
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

        // Check for advanced vulnerabilities
        const advancedVulnerabilities = this.checkForAdvancedVulnerabilities(code);

        for (const vuln of advancedVulnerabilities) {
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
            noProofStorage: 'Verified proofs are not tracked/stored, potentially allowing replay attacks',
            noNonce: 'Proof does not include a nonce or timestamp to prevent replay',
            noNullifier: 'Missing nullifier mechanism to prevent proof reuse',
            noExpiration: 'Proofs lack an expiration mechanism, allowing indefinite reuse',
            noContextBinding: 'Proof is not bound to a specific context or session',
            noValidationFromStorage: 'Verification lacks a check against previously used proofs'
        };

        return messages[patternName] || 'Potential replay attack vulnerability detected';
    }
}

export default ReplayAttackDetector; 