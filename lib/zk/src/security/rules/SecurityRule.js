/**
 * SecurityRule
 * 
 * Base class for security rules.
 */

class SecurityRule {
  constructor(name, description) {
    this.name = name || 'SecurityRule';
    this.description = description || 'Base security rule';
    this.severity = 'medium';
  }
  
  /**
   * Check if the rule passes
   * @param {Object} context - Context for rule verification
   * @returns {Object} - Rule verification result
   */
  check(context = {}) {
    // Base implementation always passes
    return { 
      passed: true, 
      message: 'Base rule check', 
      rule: this.name, 
      severity: this.severity
    };
  }
  
  /**
   * Set the severity level for this rule
   * @param {string} severity - Severity level (low, medium, high, critical)
   */
  setSeverity(severity) {
    if (['low', 'medium', 'high', 'critical'].includes(severity)) {
      this.severity = severity;
    }
  }
}

export default SecurityRule;