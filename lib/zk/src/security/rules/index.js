/**
 * Security Rules Index - Exports all available security rules
 * 
 * This file provides a single point of import for all security rules
 * that can be used with the SecurityRuleRunner.
 */

import CryptoVerificationRule from './CryptoVerificationRule.js';
import PrivilegeEscalationRule from './PrivilegeEscalationRule.js';

/**
 * @exports CryptoVerificationRule - Rule that verifies cryptographic implementations
 * @exports PrivilegeEscalationRule - Rule that detects privilege escalation vulnerabilities
 */
export {
    CryptoVerificationRule,
    PrivilegeEscalationRule
};

/**
 * Default set of security rules to use for standard security audits
 * @type {Array<Object>}
 * @exports
 */
export const defaultRules = [
    new CryptoVerificationRule(),
    new PrivilegeEscalationRule()
];

/**
 * Get all available security rules
 * @returns {Array} Array of rule instances
 */
export function getAllRules() {
    return defaultRules;
}

/**
 * Get security rules by severity
 * @param {string} severity - Severity level ('HIGH', 'MEDIUM', 'LOW')
 * @returns {Array} Array of rule instances matching the severity
 */
export function getRulesBySeverity(severity) {
    return defaultRules.filter(rule => rule.severity === severity);
}

/**
 * Create a custom set of rules with specified options
 * @param {Object} options - Options for customizing rules
 * @param {Object} options.crypto - Options for CryptoVerificationRule
 * @param {Object} options.privilege - Options for PrivilegeEscalationRule
 * @returns {Array} Array of customized rule instances
 */
export function createCustomRules(options = {}) {
    const rules = [];

    if (options.crypto !== false) {
        rules.push(new CryptoVerificationRule(options.crypto || {}));
    }

    if (options.privilege !== false) {
        rules.push(new PrivilegeEscalationRule(options.privilege || {}));
    }

    return rules;
}

/**
 * Default export containing all security rule functionality
 * @exports
 */
export default {
    CryptoVerificationRule,
    PrivilegeEscalationRule,
    defaultRules,
    getAllRules,
    getRulesBySeverity,
    createCustomRules
}; 