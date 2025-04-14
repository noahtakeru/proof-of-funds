/**
 * @fileoverview SecurityRuleFactory for creating security rules
 * 
 * Factory class for creating different types of security rules with
 * consistent configuration and behavior.
 */

import { SecurityRule, SecurityRuleValidationError } from './SecurityRule.js';
import { CryptographicRule } from './CryptographicRule.js';
import { ZKSecurityRule } from './ZKSecurityRule.js';
import { RuleCategory } from '../AuditConfig.js';
import zkErrorLogger from '../../zkErrorLogger.js';

/**
 * Factory class for creating and managing security rules
 * @class
 */
export class SecurityRuleFactory {
    /**
     * Create a new security rule of the specified type
     * 
     * @param {string} type - The type of rule to create ('base', 'crypto', 'zk')
     * @param {Object} options - Rule configuration options
     * @returns {SecurityRule} - The created security rule instance
     * @throws {SecurityRuleValidationError} If the rule type is not supported
     */
    static createRule(type, options) {
        try {
            switch (type.toLowerCase()) {
                case 'crypto':
                case 'cryptographic':
                    return new CryptographicRule(options);

                case 'zk':
                case 'zero-knowledge':
                    return new ZKSecurityRule(options);

                case 'base':
                case 'default':
                    return new SecurityRule(options);

                default:
                    throw new SecurityRuleValidationError(
                        `Unsupported rule type: ${type}`,
                        options.id || 'FACTORY'
                    );
            }
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityRuleFactory.createRule',
                type,
                ruleId: options?.id || 'unknown',
                message: 'Error creating security rule'
            });
            throw error;
        }
    }

    /**
     * Create a set of default rules for a specific category
     * 
     * @param {string} category - The category of rules to create from RuleCategory
     * @returns {Array<SecurityRule>} - Array of created security rules
     * @throws {SecurityRuleValidationError} If there's an error creating the rules
     */
    static createDefaultRules(category) {
        try {
            const rules = [];

            switch (category) {
                case RuleCategory.CRYPTOGRAPHIC:
                    rules.push(
                        new CryptographicRule({
                            id: 'CRYPTO-001',
                            name: 'Insecure Cryptographic Algorithm',
                            description: 'Detects the use of cryptographic algorithms that are considered insecure',
                            severity: 'CRITICAL',
                            references: [
                                'https://nvd.nist.gov/800-53/Rev4/control/SC-13',
                                'https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html'
                            ],
                            evaluator: (context) => {
                                return context.hasInsecureAlgorithm || false;
                            }
                        }),
                        new CryptographicRule({
                            id: 'CRYPTO-002',
                            name: 'Insufficient Key Length',
                            description: 'Detects the use of cryptographic keys with insufficient length',
                            severity: 'HIGH',
                            references: [
                                'https://www.keylength.com/',
                                'https://nvd.nist.gov/800-57/rev5/framework'
                            ],
                            evaluator: (context) => {
                                return context.hasInsufficientKeyLength || false;
                            }
                        })
                    );
                    break;

                case RuleCategory.ZK_PROTOCOL:
                    rules.push(
                        new ZKSecurityRule({
                            id: 'ZK-001',
                            name: 'Proof Malleability',
                            description: 'Detects potential proof malleability issues in the ZK protocol',
                            severity: 'HIGH',
                            references: [
                                'https://zkproof.org/2021/06/30/zkproof-security-track-proceedings/',
                                'https://eprint.iacr.org/2019/1021.pdf'
                            ],
                            evaluator: (context) => {
                                const rule = new ZKSecurityRule({});
                                return rule.checkForProofMalleability(context) !== null;
                            },
                            zkMetadata: {
                                proofSystem: 'General',
                                affectedComponents: ['verifier'],
                                affectsTrustedSetup: false
                            }
                        }),
                        new ZKSecurityRule({
                            id: 'ZK-002',
                            name: 'Trusted Setup Vulnerability',
                            description: 'Detects potential vulnerabilities in the trusted setup process',
                            severity: 'CRITICAL',
                            references: [
                                'https://eprint.iacr.org/2017/1050.pdf',
                                'https://zkproof.org/2020/08/12/setup-ceremonies/'
                            ],
                            evaluator: (context) => {
                                const rule = new ZKSecurityRule({});
                                return rule.checkTrustedSetupSecurity(context) !== null;
                            },
                            zkMetadata: {
                                proofSystem: 'General',
                                affectedComponents: ['setup'],
                                affectsTrustedSetup: true
                            }
                        })
                    );
                    break;

                case RuleCategory.GENERAL:
                default:
                    rules.push(
                        new SecurityRule({
                            id: 'SEC-001',
                            name: 'Generic Security Rule',
                            description: 'A generic security rule for demonstration purposes',
                            severity: 'MEDIUM',
                            category: category || RuleCategory.GENERAL,
                            references: ['https://owasp.org/Top10/'],
                            evaluator: (context) => {
                                return context.hasVulnerability || false;
                            }
                        })
                    );
            }

            return rules;
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityRuleFactory.createDefaultRules',
                category: category || 'unknown',
                message: 'Error creating default security rules'
            });
            throw error;
        }
    }

    /**
     * Load rules from a configuration file
     * 
     * @param {string} configPath - Path to the rule configuration file
     * @returns {Array<SecurityRule>} - Array of created security rules
     * @throws {Error} If there's an error loading the configuration
     */
    static loadRulesFromConfig(configPath) {
        try {
            // In a real implementation, this would read from the config file
            // Here we just return some dummy rules
            return [
                ...SecurityRuleFactory.createDefaultRules(RuleCategory.GENERAL),
                ...SecurityRuleFactory.createDefaultRules(RuleCategory.CRYPTOGRAPHIC),
                ...SecurityRuleFactory.createDefaultRules(RuleCategory.ZK_PROTOCOL)
            ];
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityRuleFactory.loadRulesFromConfig',
                configPath,
                message: 'Failed to load rules from configuration'
            });
            throw error;
        }
    }
}

/**
 * Default export for the SecurityRuleFactory
 * @type {typeof SecurityRuleFactory}
 */
export default SecurityRuleFactory; 