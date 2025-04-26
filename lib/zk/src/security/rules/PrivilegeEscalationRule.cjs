/**
 * Privilege Escalation Rule Module
 * 
 * Provides rules for detecting and preventing privilege escalation in ZK proofs
 * 
 * @module PrivilegeEscalationRule
 */

// Import SecurityRule base class (commented to avoid actual import issues in compatibility layer)
// const { SecurityRule } = require('./SecurityRule.js');

/**
 * PrivilegeEscalationRule class for detecting privilege escalation
 * @extends SecurityRule
 */
class PrivilegeEscalationRule {
  /**
   * Create a new privilege escalation rule
   * @param {Object} options - Rule configuration
   */
  constructor(options = {}) {
    this.id = options.id || 'privilege-escalation';
    this.name = options.name || 'Privilege Escalation Rule';
    this.description = options.description || 'Prevents privilege escalation in ZK proof systems';
    this.severity = options.severity || 'CRITICAL';
    this.enabled = true;
  }

  /**
   * Enable this rule
   * @returns {PrivilegeEscalationRule} - This rule instance for method chaining
   */
  enable() {
    this.enabled = true;
    return this;
  }

  /**
   * Disable this rule
   * @returns {PrivilegeEscalationRule} - This rule instance for method chaining
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
   * Check for potential privilege escalation
   * @param {Object} context - Verification context
   * @returns {Object} - Verification result
   */
  verify(context) {
    if (!context || typeof context !== 'object') {
      return {
        passed: false,
        message: 'Invalid verification context',
        details: { error: 'Context must be a valid object' }
      };
    }

    // Verify against privilege escalation
    const { requestedAction, userPermissions, proof } = context;
    
    if (!requestedAction || !userPermissions) {
      return {
        passed: false,
        message: 'Missing required parameters',
        details: {
          missingParams: [
            !requestedAction ? 'requestedAction' : null,
            !userPermissions ? 'userPermissions' : null
          ].filter(Boolean)
        }
      };
    }

    // Check if user has permission for the requested action
    const hasPermission = this._verifyActionPermission(requestedAction, userPermissions);
    
    // Check for tampering in the proof
    const proofIntegrity = this._verifyProofIntegrity(proof);
    
    return {
      passed: hasPermission && proofIntegrity,
      message: hasPermission && proofIntegrity 
        ? 'Privilege verification passed' 
        : 'Privilege escalation detected',
      details: {
        hasRequiredPermission: hasPermission,
        proofIntegrityValid: proofIntegrity
      }
    };
  }

  /**
   * Verify if a user has permission for a requested action
   * @private
   * @param {string} action - The requested action
   * @param {Array<string>} permissions - User's permissions
   * @returns {boolean} - Whether the user has the required permission
   */
  _verifyActionPermission(action, permissions) {
    if (!action || !permissions || !Array.isArray(permissions)) {
      return false;
    }
    
    return permissions.includes(action) || permissions.includes('admin');
  }

  /**
   * Verify the integrity of a ZK proof against tampering
   * @private
   * @param {Object} proof - The ZK proof to verify
   * @returns {boolean} - Whether the proof integrity is valid
   */
  _verifyProofIntegrity(proof) {
    if (!proof) return false;
    
    // Basic structural checks
    if (typeof proof !== 'object') return false;
    
    // Check for suspicious patterns that could indicate tampering
    const proofStr = JSON.stringify(proof);
    const suspiciousPatterns = [
      /"admin":true/i,
      /"role":"admin"/i,
      /"isAdmin":true/i,
      /"permissions":\[.*"admin".*\]/i
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(proofStr)) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Check for unsafe admin function usage
   * @param {string} code - The code to analyze
   * @returns {Array} Array of issues found
   * @private
   */
  _checkUnsafeAdminFunctions(code) {
    const issues = [];
    
    // Check for direct admin role assignments
    if (/\.(role|userType)\s*=\s*['"]admin['"]/.test(code)) {
      issues.push({
        type: 'UNSAFE_ADMIN_ASSIGNMENT',
        severity: 'CRITICAL',
        message: 'Direct assignment of admin role'
      });
    }
    
    // Check for bypassing permission checks with logical OR
    if (/\|\|\s*(isAdmin|user\.role\s*===?\s*['"]admin['"])/.test(code)) {
      issues.push({
        type: 'UNSAFE_PERMISSION_LOGIC',
        severity: 'HIGH',
        message: 'Permission check can be bypassed with OR condition'
      });
    }
    
    // Check for permissions in query parameters
    if (/req\.query\.(role|admin|isAdmin|permissions)/.test(code)) {
      issues.push({
        type: 'INSECURE_PERMISSION_SOURCE',
        severity: 'CRITICAL',
        message: 'Permission/role from query parameters'
      });
    }
    
    // Check for admin checks in exception handling
    if (/try\s*{[^}]*}\s*catch[^{]*{[^}]*(role|admin|permissions)/.test(code)) {
      issues.push({
        type: 'PRIVILEGE_EXCEPTION_HANDLING',
        severity: 'HIGH',
        message: 'Privilege checks in exception handling can lead to privilege escalation'
      });
    }
    
    return issues;
  }
  
  /**
   * Check for improper access control mechanisms
   * @param {string} code - The code to analyze
   * @returns {Array} Array of issues found
   * @private
   */
  _checkImproperAccessControl(code) {
    const issues = [];
    
    // Check for hardcoded credentials
    if (/const\s+(password|secret|key|token)\s*=\s*['"][^'"]+['"]/.test(code)) {
      issues.push({
        type: 'HARDCODED_CREDENTIALS',
        severity: 'CRITICAL',
        message: 'Hardcoded credentials or secrets in code'
      });
    }
    
    // Check for missing authentication before authorization
    if (/authorize|permission|isAuthorized/.test(code) && 
        !/authenticate|isAuthenticated|requireAuth/.test(code)) {
      issues.push({
        type: 'MISSING_AUTHENTICATION',
        severity: 'HIGH',
        message: 'Authorization without prior authentication'
      });
    }
    
    // Check for client-side only access control
    if (/(client|browser|frontend).*only.*check/.test(code) || 
        /\/\/\s*Authorization\s+check/.test(code)) {
      issues.push({
        type: 'CLIENT_SIDE_AUTHORIZATION',
        severity: 'CRITICAL',
        message: 'Access control implemented only on client side'
      });
    }
    
    // Check for insufficient session management
    if (/session\s*=|req\.session/.test(code) && 
        !/session\.regenerate|session\.destroy/.test(code)) {
      issues.push({
        type: 'WEAK_SESSION_MANAGEMENT',
        severity: 'MEDIUM',
        message: 'Insufficient session rotation or management'
      });
    }
    
    return issues;
  }
  
  /**
   * Check for unchecked parameters that could lead to privilege escalation
   * @param {string} code - The code to analyze
   * @returns {Array} Array of issues found
   * @private
   */
  _checkUncheckedParameters(code) {
    const issues = [];
    
    // Check for user-supplied parameters in permission checks
    if (/req\.(?:body|query|params)\.(role|admin|permissions|isAdmin|access[lL]evel)/.test(code)) {
      issues.push({
        type: 'UNCHECKED_USER_INPUT',
        severity: 'CRITICAL',
        message: 'Using user-provided input directly in authorization logic'
      });
    }
    
    // Check for JWT tokens without validation
    if (/jwt\.verify/.test(code) && !/catch|try/.test(code)) {
      issues.push({
        type: 'UNCHECKED_JWT',
        severity: 'HIGH',
        message: 'JWT verification without proper error handling'
      });
    }
    
    // Check for parameter tampering prevention
    if (/router\.(?:get|post|put|delete)/.test(code) && 
        !/validate|sanitize|check/.test(code)) {
      issues.push({
        type: 'MISSING_PARAMETER_VALIDATION',
        severity: 'MEDIUM',
        message: 'Route handler without parameter validation'
      });
    }
    
    // Check for unvalidated redirects
    if (/req\.(?:query|body|params)\.(?:redirect|url|target|to)/.test(code) && 
        !/validate|sanitize|check/.test(code)) {
      issues.push({
        type: 'UNCHECKED_REDIRECT',
        severity: 'HIGH',
        message: 'Unvalidated redirect parameter from user input'
      });
    }
    
    return issues;
  }
  
  /**
   * Check for unsafe dynamic imports or requires
   * @param {string} code - The code to analyze
   * @returns {Array} Array of issues found
   * @private
   */
  _checkUnsafeDynamicImports(code) {
    const issues = [];
    
    // Check for dynamic imports with user input
    if (/(?:import|require)\(.*\$\{.*\}.*\)/.test(code) || 
        /(?:import|require)\(.*\+.*\)/.test(code)) {
      issues.push({
        type: 'UNSAFE_DYNAMIC_IMPORT',
        severity: 'CRITICAL',
        message: 'Using user-controlled or dynamically constructed module path in import/require'
      });
    }
    
    // Check for Function constructor (which can execute arbitrary code)
    if (/new\s+Function\(/.test(code) || /Function\(/i.test(code)) {
      issues.push({
        type: 'UNSAFE_CODE_EXECUTION',
        severity: 'CRITICAL',
        message: 'Using the Function constructor which can lead to arbitrary code execution'
      });
    }
    
    // Check for eval usage
    if (/\beval\s*\(/.test(code)) {
      issues.push({
        type: 'UNSAFE_EVAL',
        severity: 'CRITICAL',
        message: 'Using eval() which is dangerous and can lead to code injection'
      });
    }
    
    // Check for child_process exec with user input
    if (/child_process.*\.exec\(.*(?:\$\{|\+)/.test(code)) {
      issues.push({
        type: 'COMMAND_INJECTION',
        severity: 'CRITICAL',
        message: 'Potential command injection via child_process.exec with dynamic input'
      });
    }
    
    return issues;
  }

  /**
   * Evaluate a file for privilege escalation vulnerabilities
   * @param {Object} file - The file to evaluate
   * @param {string} file.path - The file path
   * @param {string} file.content - The file content
   * @returns {Array} An array of findings/issues identified
   */
  evaluate(file) {
    if (!file || !file.path || !file.content) {
      return [{
        rule: this.id,
        severity: this.severity,
        message: 'Invalid file object provided for evaluation',
        location: 'unknown'
      }];
    }

    const findings = [];
    const content = file.content;

    // Check for direct role/permission assignment without verification
    if (/\.role\s*=\s*['"]admin['"]|\.userType\s*=\s*['"]admin['"]/.test(content)) {
      findings.push({
        rule: this.id,
        severity: this.severity,
        message: 'Direct role assignment without proper verification detected',
        location: file.path,
        lineNumbers: this._findLineNumbers(content, /\.role\s*=\s*['"]admin['"]|\.userType\s*=\s*['"]admin['"])/g)
      });
    }

    // Check for permission checks that can be bypassed
    if (/if\s*\(.*\.hasPermission\(.*\)\s*\)/.test(content) && 
        /try\s*{[^}]*\.hasPermission\([^}]*}\s*catch/.test(content)) {
      findings.push({
        rule: this.id,
        severity: this.severity,
        message: 'Permission check in try-catch block could be bypassed by throwing an exception',
        location: file.path
      });
    }

    // Check for insecure permission validation logic
    if (/\|\|\s*isAdmin\s*\)/.test(content) || 
        /\|\|\s*user\.role\s*===\s*['"]admin['"]\s*\)/.test(content)) {
      findings.push({
        rule: this.id,
        severity: 'HIGH',
        message: 'Potentially insecure permission validation logic using OR conditions',
        location: file.path,
        lineNumbers: this._findLineNumbers(content, /\|\|\s*isAdmin\s*\)|\|\|\s*user\.role\s*===\s*['"]admin['"]\s*\)/g)
      });
    }

    return findings;
  }

  /**
   * Find line numbers for regex matches in content
   * @private
   * @param {string} content - File content
   * @param {RegExp} regex - Regular expression to match
   * @returns {Array<number>} - Array of line numbers (1-based)
   */
  _findLineNumbers(content, regex) {
    const lines = content.split('\n');
    const lineNumbers = [];

    lines.forEach((line, index) => {
      if (regex.test(line)) {
        lineNumbers.push(index + 1); // 1-based line numbers
      }
    });

    return lineNumbers;
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

/**
 * Create and return a new PrivilegeEscalationRule
 * @param {Object} options - Rule configuration options
 * @returns {PrivilegeEscalationRule} - New rule instance
 */
function createPrivilegeEscalationRule(options = {}) {
  return new PrivilegeEscalationRule(options);
}

// Export for CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PrivilegeEscalationRule,
    createPrivilegeEscalationRule
  };
}
