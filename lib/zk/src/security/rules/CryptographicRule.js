/**
 * @fileoverview Cryptographic security rules for ZK proof systems
 * 
 * This module provides rules for validating cryptographic implementation
 * to ensure secure implementation of the ZK proof system.
 */

import { SecurityRule } from '../SecurityRule.js';
import { CryptographicError } from '../errors/CryptographicError.js';

/**
 * Rule for checking cryptographic implementations in ZK proof systems
 * @extends SecurityRule
 */
export class CryptographicRule extends SecurityRule {
    /**
     * Create a new CryptographicRule
     * 
     * @param {Object} options - Rule configuration options
     * @param {Object} [options.minimumStrength={}] - Minimum strength requirements for crypto primitives
     * @param {number} [options.minimumStrength.keySize=2048] - Minimum key size for asymmetric crypto
     * @param {number} [options.minimumStrength.hashSize=256] - Minimum bit size for hash functions
     * @param {string[]} [options.insecureAlgorithms=[]] - List of insecure algorithms to flag
     */
    constructor(options = {}) {
        super({
            id: 'ZK-CRYPTO-001',
            name: 'Cryptographic Implementation Validation',
            description: 'Validates cryptographic implementations for ZK proof systems',
            severity: 'critical',
            ...options
        });

        this.minimumStrength = {
            keySize: options.minimumStrength?.keySize || 2048,
            hashSize: options.minimumStrength?.hashSize || 256,
            eccCurve: options.minimumStrength?.eccCurve || 'p256'
        };

        this.insecureAlgorithms = options.insecureAlgorithms || [
            'md5', 'sha1', 'des', '3des', 'rc4', 'dsa-1024', 'rsa-1024'
        ];
    }

    /**
     * Check if a cryptographic primitive meets minimum strength requirements
     * 
     * @param {string} primitiveType - Type of primitive (hash, asymmetric, symmetric)
     * @param {Object} params - Parameters of the primitive
     * @returns {boolean} - Whether the primitive meets minimum requirements
     * @throws {CryptographicError} - If primitive type is invalid
     */
    checkPrimitiveStrength(primitiveType, params) {
        try {
            switch (primitiveType.toLowerCase()) {
                case 'hash':
                    return params.bits >= this.minimumStrength.hashSize;
                case 'asymmetric':
                    return params.keySize >= this.minimumStrength.keySize;
                case 'symmetric':
                    return params.keySize >= 128;
                case 'ecc':
                    const strengthMap = {
                        'p256': 256,
                        'secp256k1': 256,
                        'p384': 384,
                        'p521': 521
                    };
                    const curveStrength = strengthMap[params.curve] || 0;
                    return curveStrength >= strengthMap[this.minimumStrength.eccCurve];
                default:
                    throw new CryptographicError(`Unknown primitive type: ${primitiveType}`, { primitiveType });
            }
        } catch (error) {
            if (error instanceof CryptographicError) {
                throw error;
            }
            throw new CryptographicError('Error checking primitive strength', {
                primitiveType,
                params,
                originalError: error.message
            });
        }
    }

    /**
     * Check for potential side channel vulnerabilities
     * 
     * @param {string} code - Code to analyze
     * @returns {Object[]} - Array of potential vulnerabilities
     */
    checkSideChannelVulnerabilities(code) {
        const vulnerabilities = [];

        // Check for timing attack vulnerabilities (non-constant time comparisons)
        const nonConstantTimePatterns = [
            /\.equals\(/g,
            /if\s*\(\s*([a-zA-Z0-9_]+)\s*===?\s*([a-zA-Z0-9_]+)\s*\)/g,
            /for.*?compare/gi
        ];

        // Check each pattern
        for (const pattern of nonConstantTimePatterns) {
            const matches = code.match(pattern);
            if (matches) {
                vulnerabilities.push({
                    type: 'timing-attack',
                    description: 'Potential timing attack vulnerability detected',
                    confidence: 'medium',
                    location: { pattern: pattern.toString() },
                    matches: matches.length
                });
            }
        }

        return vulnerabilities;
    }

    /**
     * Evaluate code for cryptographic vulnerabilities
     * 
     * @param {Object} context - Evaluation context
     * @param {string} context.code - Code to evaluate
     * @param {string} context.filePath - Path of the file being evaluated
     * @returns {Object[]} - Array of findings
     */
    evaluate(context) {
        try {
            const { code, filePath } = context;
            const findings = [];

            // Check for insecure algorithms
            for (const algo of this.insecureAlgorithms) {
                const regex = new RegExp(`\\b${algo}\\b`, 'gi');
                const matches = code.match(regex);

                if (matches) {
                    findings.push({
                        rule: this.id,
                        description: `Use of insecure algorithm detected: ${algo}`,
                        severity: this.severity,
                        location: {
                            file: filePath,
                            pattern: algo
                        },
                        matches: matches.length
                    });
                }
            }

            // Check for side channel vulnerabilities
            const sideChannelVulns = this.checkSideChannelVulnerabilities(code);
            for (const vuln of sideChannelVulns) {
                findings.push({
                    rule: this.id,
                    description: vuln.description,
                    severity: 'high',
                    location: {
                        file: filePath,
                        ...vuln.location
                    },
                    confidence: vuln.confidence,
                    matches: vuln.matches
                });
            }

            return findings;
        } catch (error) {
            this.logger.error(`Error evaluating cryptographic rule: ${error.message}`);
            if (error instanceof CryptographicError) {
                throw error;
            }
            throw new CryptographicError('Error evaluating cryptographic rule', {
                ruleId: this.id,
                originalError: error.message,
                stack: error.stack
            });
        }
    }
}

export default CryptographicRule; 