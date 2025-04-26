/**
 * Cryptographic Verification Rule Module
 * 
 * Provides rules for verifying cryptographic operations in ZK proofs
 * 
 * @module CryptoVerificationRule
 */

// Import SecurityRule base class (commented to avoid actual import issues in compatibility layer)
// const { SecurityRule } = require('./SecurityRule.js');

/**
 * CryptoVerificationRule class for verifying cryptographic operations
 * @extends SecurityRule
 */
class CryptoVerificationRule {
  /**
   * Create a new cryptographic verification rule
   * @param {Object} options - Rule configuration
   */
  constructor(options = {}) {
    this.id = options.id || 'crypto-verification';
    this.name = options.name || 'Cryptographic Verification Rule';
    this.description = options.description || 'Verifies the integrity of cryptographic operations';
    this.severity = options.severity || 'CRITICAL';
    this.enabled = true;
  }

  /**
   * Enable this rule
   * @returns {CryptoVerificationRule} - This rule instance for method chaining
   */
  enable() {
    this.enabled = true;
    return this;
  }

  /**
   * Disable this rule
   * @returns {CryptoVerificationRule} - This rule instance for method chaining
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
   * Check if cryptographic operations are valid
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

    // Verify cryptographic operations
    const { proof, publicSignals, verificationKey } = context;
    
    if (!proof || !publicSignals || !verificationKey) {
      return {
        passed: false,
        message: 'Missing required cryptographic parameters',
        details: {
          missingParams: [
            !proof ? 'proof' : null,
            !publicSignals ? 'publicSignals' : null,
            !verificationKey ? 'verificationKey' : null
          ].filter(Boolean)
        }
      };
    }

    // Check cryptographic parameters integrity
    const hasValidStructure = this._verifyProofStructure(proof);
    
    return {
      passed: hasValidStructure,
      message: hasValidStructure 
        ? 'Cryptographic verification passed' 
        : 'Invalid cryptographic proof structure',
      details: {
        proofStructureValid: hasValidStructure
      }
    };
  }

  /**
   * Verify the structure of a ZK proof
   * @private
   * @param {Object} proof - The ZK proof to verify
   * @returns {boolean} - Whether the proof has a valid structure
   */
  _verifyProofStructure(proof) {
    // Check if proof has the required properties based on used proving system
    if (!proof) return false;
    
    // For Groth16 proofs
    if (proof.pi_a && proof.pi_b && proof.pi_c) {
      return Array.isArray(proof.pi_a) && 
             Array.isArray(proof.pi_b) && 
             Array.isArray(proof.pi_c);
    }
    
    // For PLONK proofs
    if (proof.protocol === 'plonk') {
      return proof.curve && proof.commit && proof.open;
    }
    
    return false;
  }
  
  /**
   * Check for missing verification steps in code
   * @param {string} code - The code to analyze
   * @returns {Array} Array of issues found
   * @private
   */
  _checkMissingVerification(code) {
    const issues = [];
    
    // Check for proof verification without public input validation
    if (/verify\(.*proof.*\)/i.test(code) && 
        !/(validate|check|verify)\s*[^)]*\s*input/i.test(code)) {
      issues.push({
        type: 'MISSING_INPUT_VALIDATION',
        severity: 'CRITICAL',
        message: 'Proof verification without validating public inputs'
      });
    }
    
    // Check for verification without signature check
    if (/verify\(.*proof.*\)/i.test(code) && 
        !/(validate|check|verify)\s*[^)]*\s*signature/i.test(code)) {
      issues.push({
        type: 'MISSING_SIGNATURE_CHECK',
        severity: 'HIGH',
        message: 'Proof verification without signature validation'
      });
    }
    
    // Check for verification without hash verification
    if (/verify\(.*proof.*\)/i.test(code) && 
        !/(hash|digest|sha|keccak)/i.test(code)) {
      issues.push({
        type: 'MISSING_HASH_VERIFICATION',
        severity: 'MEDIUM',
        message: 'Verification without hash integrity check'
      });
    }
    
    return issues;
  }
  
  /**
   * Check for insecure random number generation practices
   * @param {string} code - The code to analyze
   * @returns {Array} Array of issues found
   * @private
   */
  _checkInsecureRandomGeneration(code) {
    const issues = [];
    
    // Check for use of Math.random
    if (/Math\.random\(\)/i.test(code)) {
      issues.push({
        type: 'INSECURE_RANDOMNESS',
        severity: 'HIGH',
        message: 'Using Math.random() for cryptographic purposes'
      });
    }
    
    // Check for inappropriate Date.now() based randomness
    if (/new Date\(\)\.getTime\(\)|Date\.now\(\).*random/i.test(code)) {
      issues.push({
        type: 'INSECURE_RANDOMNESS',
        severity: 'HIGH',
        message: 'Using time-based values for randomness generation'
      });
    }
    
    // Check for proper secure random number generation
    if (/crypto.*random/i.test(code) && 
        !/getRandomValues|randomBytes|randomUUID/i.test(code)) {
      issues.push({
        type: 'POTENTIAL_RANDOMNESS_ISSUE',
        severity: 'MEDIUM',
        message: 'Potentially using non-standard randomness generation method'
      });
    }
    
    return issues;
  }
  
  /**
   * Check for hardcoded secrets in code
   * @param {string} code - The code to analyze
   * @returns {Array} Array of issues found
   * @private
   */
  _checkHardcodedSecrets(code) {
    const issues = [];
    
    // Check for hardcoded API keys
    if (/const\s+(api[kK]ey|API[kK]ey|token|secret|password|credentials)\s*=\s*['"][a-zA-Z0-9\-_]{8,}['"];?/g.test(code)) {
      issues.push({
        type: 'HARDCODED_SECRETS',
        severity: 'CRITICAL',
        message: 'Hardcoded API key, token or secret detected in code'
      });
    }
    
    // Check for hardcoded private keys
    if (/private[kK]ey\s*=\s*['"][a-fA-F0-9]{32,}['"];?/g.test(code)) {
      issues.push({
        type: 'HARDCODED_PRIVATE_KEY',
        severity: 'CRITICAL',
        message: 'Hardcoded private key detected in code'
      });
    }
    
    // Check for hardcoded passwords
    if (/password\s*=\s*['"]((?!process\.env).)*['"];?/g.test(code)) {
      issues.push({
        type: 'HARDCODED_PASSWORD',
        severity: 'CRITICAL',
        message: 'Hardcoded password detected in code'
      });
    }
    
    // Check for hardcoded verification keys
    if (/verif(ication)?[kK]ey\s*=\s*['"][a-zA-Z0-9\+\/\=]{20,}['"];?/g.test(code)) {
      issues.push({
        type: 'HARDCODED_VERIFICATION_KEY',
        severity: 'HIGH',
        message: 'Hardcoded verification key detected in code'
      });
    }
    
    return issues;
  }
  
  /**
   * Check for use of weak cryptographic algorithms
   * @param {string} code - The code to analyze
   * @returns {Array} Array of issues found
   * @private
   */
  _checkWeakAlgorithms(code) {
    const issues = [];
    
    // Check for weak hash algorithms
    if (/\b(md5|sha1)\b/i.test(code) && !/\b(test|example|demo|legacy)\b/i.test(code)) {
      issues.push({
        type: 'WEAK_HASH_ALGORITHM',
        severity: 'HIGH',
        message: 'Using weak hash algorithm (MD5 or SHA-1) for cryptographic purposes'
      });
    }
    
    // Check for weak encryption algorithms
    if (/\b(des|rc4|blowfish)\b/i.test(code) && !/\b(test|example|demo|legacy)\b/i.test(code)) {
      issues.push({
        type: 'WEAK_ENCRYPTION_ALGORITHM',
        severity: 'HIGH',
        message: 'Using weak encryption algorithm (DES, RC4, or Blowfish)'
      });
    }
    
    // Check for appropriate key lengths
    if (/\b(rsa|dsa)\b.*1024/i.test(code)) {
      issues.push({
        type: 'INSUFFICIENT_KEY_LENGTH',
        severity: 'MEDIUM',
        message: 'Using insufficient key length for RSA/DSA (1024 bits or less)'
      });
    }
    
    // Check for ECB mode (which is insecure)
    if (/\becb\b.*mode/i.test(code)) {
      issues.push({
        type: 'INSECURE_CIPHER_MODE',
        severity: 'HIGH',
        message: 'Using insecure ECB mode for block cipher'
      });
    }
    
    return issues;
  }

  /**
   * Evaluate a file for cryptographic security issues
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

    // Check for weak cryptographic practices
    if (/Math\.random\(\)/.test(content)) {
      findings.push({
        rule: this.id,
        severity: this.severity,
        message: 'Using Math.random() for cryptographic purposes is insecure',
        location: file.path,
        lineNumbers: this._findLineNumbers(content, /Math\.random\(\)/g)
      });
    }

    // Check for hardcoded verification keys
    if (/const\s+verificationKey\s*=\s*['"].*['"]/.test(content)) {
      findings.push({
        rule: this.id,
        severity: this.severity,
        message: 'Hardcoded verification key detected',
        location: file.path,
        lineNumbers: this._findLineNumbers(content, /const\s+verificationKey\s*=\s*['"].*['"])/g)
      });
    }

    // Check for insufficient validation of public signals
    if (/verify.*proof.*signals/i.test(content) && 
        !/validate.*signals|validatePublicSignals/.test(content)) {
      findings.push({
        rule: this.id,
        severity: 'HIGH',
        message: 'Verification without proper validation of public signals',
        location: file.path
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
 * Create and return a new CryptoVerificationRule
 * @param {Object} options - Rule configuration options
 * @returns {CryptoVerificationRule} - New rule instance
 */
function createCryptoVerificationRule(options = {}) {
  return new CryptoVerificationRule(options);
}

// Export for CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CryptoVerificationRule,
    createCryptoVerificationRule
  };
}
