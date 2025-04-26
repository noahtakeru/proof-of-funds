/**
 * Security Rules Collection
 * 
 * This file exports the security rules used in the system.
 * It provides a centralized registry of all security rules.
 */

import CryptoVerificationRule from './CryptoVerificationRule';
import SecurityRule from './SecurityRule';
import InputValidationRule from './InputValidationRule';
import ParameterTamperingRule from './ParameterTamperingRule';
import CryptographicRule from './CryptographicRule';
import ZKSecurityRule from './ZKSecurityRule';
import AuditRule from './AuditRule';
import PrivilegeEscalationRule from './PrivilegeEscalationRule';
import CryptographicWeaknessRule from './CryptographicWeaknessRule';

// Default rules collection
export const defaultRules = {
  crypto: new CryptoVerificationRule(),
  input: new InputValidationRule(),
  parameter: new ParameterTamperingRule(),
  cryptoWeak: new CryptographicWeaknessRule(),
  zkSecurity: new ZKSecurityRule(),
  audit: new AuditRule(),
  privilege: new PrivilegeEscalationRule()
};

// Function to get all rules
export function getAllRules() {
  return {
    ...defaultRules,
    // Additional rules can be added here
  };
}

// Function to get rules by severity
export function getRulesBySeverity(severity) {
  if (!severity) {
    return getAllRules();
  }
  
  const rules = getAllRules();
  const filteredRules = {};
  
  Object.entries(rules).forEach(([key, rule]) => {
    if (rule.severity === severity) {
      filteredRules[key] = rule;
    }
  });
  
  return filteredRules;
}

// Function to create custom rules
export function createCustomRules(customRuleDefinitions = []) {
  const customRules = {};
  
  customRuleDefinitions.forEach(definition => {
    const { name, description, severity, checkFunction } = definition;
    
    // Create a custom rule based on SecurityRule
    const customRule = new SecurityRule(name, description);
    if (severity) {
      customRule.setSeverity(severity);
    }
    
    // Override the check method if provided
    if (checkFunction) {
      customRule.check = checkFunction;
    }
    
    customRules[name] = customRule;
  });
  
  return customRules;
}

// Export all rules
export {
  CryptoVerificationRule,
  SecurityRule,
  InputValidationRule,
  ParameterTamperingRule,
  CryptographicRule,
  ZKSecurityRule,
  AuditRule,
  PrivilegeEscalationRule,
  CryptographicWeaknessRule
};

// Default export for CommonJS compatibility
export default {
  CryptoVerificationRule,
  SecurityRule,
  InputValidationRule,
  ParameterTamperingRule,
  CryptographicRule,
  ZKSecurityRule,
  AuditRule,
  PrivilegeEscalationRule,
  CryptographicWeaknessRule
};