/**
 * Security Rule Base Module
 * 
 * Provides the base class for all security rules in the ZK system
 * 
 * @module SecurityRule
 */

/**
 * Base class for all security rules
 */
class SecurityRule {
  /**
   * Create a new security rule
   * @param {Object} config - Rule configuration
   * @param {string} config.id - Unique rule identifier
   * @param {string} config.name - Human-readable rule name
   * @param {string} config.description - Description of what the rule checks
   * @param {('LOW'|'MEDIUM'|'HIGH'|'CRITICAL')} config.severity - Rule severity level
   */
  constructor(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('Security rule requires a configuration object');
    }
    
    const { id, name, description, severity } = config;
    
    if (!id || typeof id !== 'string') {
      throw new Error('Security rule requires a string id');
    }
    
    this.id = id;
    this.name = name || id;
    this.description = description || 'No description provided';
    this.severity = severity || 'MEDIUM';
    this.enabled = true;
  }

  /**
   * Enable this security rule
   * @returns {SecurityRule} - This rule instance for method chaining
   */
  enable() {
    this.enabled = true;
    return this;
  }

  /**
   * Disable this security rule
   * @returns {SecurityRule} - This rule instance for method chaining
   */
  disable() {
    this.enabled = false;
    return this;
  }

  /**
   * Check if this rule is currently enabled
   * @returns {boolean} - Whether the rule is enabled
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Verify security rule against provided context
   * @param {Object} context - Verification context
   * @returns {Object} - Verification result
   */
  verify(context) {
    throw new Error('verify() method must be implemented by security rule subclass');
  }

  /**
   * Evaluate a file for security issues
   * @param {Object} file - The file to evaluate
   * @param {string} file.path - The file path
   * @param {string} file.content - The file content
   * @returns {Array} An array of findings/issues identified
   */
  evaluate(file) {
    throw new Error('evaluate() method must be implemented by security rule subclass');
  }

  /**
   * Get rule metadata
   * @returns {Object} - Rule metadata
   */
  getMetadata() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      severity: this.severity,
      enabled: this.enabled
    };
  }
}

// Export for CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SecurityRule
  };
}