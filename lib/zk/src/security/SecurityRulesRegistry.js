/**
 * @fileoverview Security Rules Registry for ZK security audits
 * 
 * Registry that manages all available security rules and provides
 * methods to access and filter them.
 */

import { CryptoVerificationRule } from './rules/CryptoVerificationRule.js';
import { PrivilegeEscalationRule } from './rules/PrivilegeEscalationRule.js';
import { SecurityRuleValidationError } from './SecurityRule.js';
import zkErrorLogger from '../zkErrorLogger.js';

/**
 * Custom error class for registry-specific errors
 * @extends Error
 */
export class SecurityRulesRegistryError extends Error {
    /**
     * Create a new SecurityRulesRegistryError
     * @param {string} message - Error message
     * @param {string} operation - Operation that caused the error
     */
    constructor(message, operation) {
        super(`[SecurityRulesRegistry:${operation}] ${message}`);
        this.name = 'SecurityRulesRegistryError';
        this.operation = operation;
    }
}

/**
 * Registry for managing security rules and providing access methods
 * @class
 */
export class SecurityRulesRegistry {
    /**
     * Create a new security rules registry
     * 
     * @param {Object} [options] - Registry options
     * @param {Object[]} [options.additionalRules=[]] - Additional rules to register
     */
    constructor(options = {}) {
        this.rules = [];
        this.rulesById = new Map();

        // Register default rules
        try {
            this._registerDefaultRules();

            // Register additional rules if provided
            if (options.additionalRules && Array.isArray(options.additionalRules)) {
                for (const rule of options.additionalRules) {
                    this.registerRule(rule);
                }
            }
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityRulesRegistry.constructor',
                additionalRulesCount: options.additionalRules?.length || 0,
                message: 'Error initializing security rules registry'
            });
            throw error;
        }
    }

    /**
     * Register default security rules
     * 
     * @private
     */
    _registerDefaultRules() {
        try {
            this.registerRule(new CryptoVerificationRule());
            this.registerRule(new PrivilegeEscalationRule());
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityRulesRegistry._registerDefaultRules',
                message: 'Error registering default security rules'
            });
            throw error;
        }
    }

    /**
     * Register a security rule
     * 
     * @param {Object} rule - Security rule to register
     * @returns {boolean} Success
     * @throws {SecurityRuleValidationError} If the rule is invalid
     */
    registerRule(rule) {
        try {
            if (!rule || !rule.id || typeof rule.evaluate !== 'function') {
                throw new SecurityRuleValidationError(
                    'Invalid security rule: must have ID and evaluate method',
                    rule?.id || 'unknown'
                );
            }

            if (this.rulesById.has(rule.id)) {
                console.warn(`Rule with ID ${rule.id} is already registered. Skipping.`);
                return false;
            }

            this.rules.push(rule);
            this.rulesById.set(rule.id, rule);

            return true;
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityRulesRegistry.registerRule',
                ruleId: rule?.id || 'unknown',
                ruleName: rule?.name || 'unknown',
                message: 'Error registering security rule'
            });
            throw error;
        }
    }

    /**
     * Get a rule by ID
     * 
     * @param {string} ruleId - Rule ID to get
     * @returns {Object|null} Found rule or null
     */
    getRuleById(ruleId) {
        try {
            return this.rulesById.get(ruleId) || null;
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityRulesRegistry.getRuleById',
                ruleId,
                message: 'Error getting rule by ID'
            });
            return null;
        }
    }

    /**
     * Get all registered rules
     * 
     * @returns {Object[]} All registered rules
     */
    getAllRules() {
        try {
            return [...this.rules];
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityRulesRegistry.getAllRules',
                message: 'Error getting all rules'
            });
            return [];
        }
    }

    /**
     * Get default rules for the system
     * 
     * @returns {Object[]} Default security rules
     */
    getDefaultRules() {
        try {
            return [
                new CryptoVerificationRule(),
                new PrivilegeEscalationRule()
            ];
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityRulesRegistry.getDefaultRules',
                message: 'Error getting default rules'
            });
            return [];
        }
    }

    /**
     * Get rules by severity
     * 
     * @param {string} severity - Severity to filter by
     * @returns {Object[]} Rules matching the severity
     */
    getRulesBySeverity(severity) {
        try {
            if (!severity) return [];

            const normalizedSeverity = severity.toUpperCase();
            return this.rules.filter(rule => rule.severity.toUpperCase() === normalizedSeverity);
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityRulesRegistry.getRulesBySeverity',
                severity,
                message: 'Error getting rules by severity'
            });
            return [];
        }
    }

    /**
     * Get rules by name pattern
     * 
     * @param {string|RegExp} pattern - Pattern to match rule names
     * @returns {Object[]} Rules with matching names
     */
    getRulesByNamePattern(pattern) {
        try {
            if (!pattern) return [];

            const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i');
            return this.rules.filter(rule => regex.test(rule.name));
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityRulesRegistry.getRulesByNamePattern',
                pattern: pattern?.toString() || 'undefined',
                message: 'Error getting rules by name pattern'
            });
            return [];
        }
    }

    /**
     * Enable a rule by ID
     * 
     * @param {string} ruleId - ID of the rule to enable
     * @returns {boolean} Success
     */
    enableRule(ruleId) {
        try {
            const rule = this.getRuleById(ruleId);
            if (rule) {
                rule.enabled = true;
                return true;
            }
            return false;
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityRulesRegistry.enableRule',
                ruleId,
                message: 'Error enabling rule'
            });
            return false;
        }
    }

    /**
     * Disable a rule by ID
     * 
     * @param {string} ruleId - ID of the rule to disable
     * @returns {boolean} Success
     */
    disableRule(ruleId) {
        try {
            const rule = this.getRuleById(ruleId);
            if (rule) {
                rule.enabled = false;
                return true;
            }
            return false;
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityRulesRegistry.disableRule',
                ruleId,
                message: 'Error disabling rule'
            });
            return false;
        }
    }

    /**
     * Update rule parameters
     * 
     * @param {string} ruleId - ID of the rule to update
     * @param {Object} params - New parameters
     * @returns {boolean} Success
     */
    updateRuleParams(ruleId, params) {
        try {
            const rule = this.getRuleById(ruleId);
            if (rule && params) {
                if (typeof rule.updateParameters === 'function') {
                    rule.updateParameters(params);
                    return true;
                } else {
                    throw new SecurityRulesRegistryError(
                        `Rule ${ruleId} does not support parameter updates`,
                        'updateRuleParams'
                    );
                }
            }
            return false;
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityRulesRegistry.updateRuleParams',
                ruleId,
                params: JSON.stringify(params),
                message: 'Error updating rule parameters'
            });
            return false;
        }
    }

    /**
     * Get enabled rules
     * 
     * @returns {Object[]} Enabled rules
     */
    getEnabledRules() {
        try {
            return this.rules.filter(rule => rule.enabled !== false);
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityRulesRegistry.getEnabledRules',
                message: 'Error getting enabled rules'
            });
            return [];
        }
    }

    /**
     * Create registry configuration object
     * 
     * @returns {Object} Registry configuration
     */
    toJSON() {
        try {
            return {
                rules: this.rules.map(rule => ({
                    id: rule.id,
                    name: rule.name,
                    description: rule.description,
                    severity: rule.severity,
                    enabled: rule.enabled !== false,
                    params: rule.params ? { ...rule.params } : {}
                }))
            };
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityRulesRegistry.toJSON',
                message: 'Error converting registry to JSON'
            });
            return { rules: [] };
        }
    }
}

/**
 * SecurityRulesRegistry default export
 * @type {SecurityRulesRegistry}
 */
export default SecurityRulesRegistry; 