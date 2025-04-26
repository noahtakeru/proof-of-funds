/**
 * @fileoverview Security Module Index (CommonJS)
 * 
 * Consolidated security framework for ZK implementations.
 * CommonJS version for compatibility with Node.js require.
 * 
 * @author ZK Infrastructure Team
 */

const SecurityCore = require('./SecurityCore.cjs');
const SecurityRuleEngine = require('./SecurityRuleEngine.cjs');
const SecurityTesting = require('./SecurityTesting.cjs');
const ZKProofValidator = require('./ZKProofValidator.cjs');

// Export all components
module.exports = {
  // Core security
  SecurityCore: SecurityCore.SecurityCore,
  securityCore: SecurityCore.securityCore,
  
  // Security rule engine
  SecurityRuleEngine: SecurityRuleEngine.SecurityRuleEngine,
  securityRuleEngine: SecurityRuleEngine.securityRuleEngine,
  SecurityRule: SecurityRuleEngine.SecurityRule,
  CryptoVerificationRule: SecurityRuleEngine.CryptoVerificationRule,
  InputValidationRule: SecurityRuleEngine.InputValidationRule,
  ZKSecurityRule: SecurityRuleEngine.ZKSecurityRule,
  SecurityRuleEngineError: SecurityRuleEngine.SecurityRuleEngineError,
  
  // Security testing
  SecurityTest: SecurityTesting.SecurityTest,
  AttackVectorTest: SecurityTesting.AttackVectorTest,
  SecurityTestSuite: SecurityTesting.SecurityTestSuite,
  securityTestSuite: SecurityTesting.securityTestSuite,
  validateSecurity: SecurityTesting.validateSecurity,
  
  // ZK Proof validation
  ZKProofValidator: ZKProofValidator.ZKProofValidator,
  zkProofValidator: ZKProofValidator.zkProofValidator,
  
  // Default export
  default: SecurityCore.securityCore
};