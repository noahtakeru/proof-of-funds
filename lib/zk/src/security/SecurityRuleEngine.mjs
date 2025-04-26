/**
 * @fileoverview Security Rule Engine 
 * 
 * Consolidated module for applying security rules to code and ZK implementations.
 * Combines the rule runner, registry, and rule implementations into a single unified
 * engine for detecting security vulnerabilities in ZK code.
 * 
 * @author ZK Infrastructure Team
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import zkErrorLogger from '../zkErrorLogger.js';

/**
 * Security Rule Engine Error
 */
export class SecurityRuleEngineError extends Error {
  /**
   * Create a new SecurityRuleEngineError
   * 
   * @param {string} message - Error message
   * @param {string} code - Error code
   * @param {Object} [details] - Additional error details
   */
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'SecurityRuleEngineError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Base Security Rule class
 * 
 * All security rules extend this base class.
 */
export class SecurityRule {
  /**
   * Create a new SecurityRule
   * 
   * @param {Object} config - Rule configuration
   * @param {string} config.id - Rule identifier
   * @param {string} config.name - Rule name
   * @param {string} config.description - Rule description
   * @param {string} [config.severity='medium'] - Rule severity
   * @param {Object} [config.metadata={}] - Additional metadata
   */
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.description = config.description;
    this.severity = config.severity || 'medium';
    this.metadata = config.metadata || {};
    this.enabled = true;
  }
  
  /**
   * Check if this rule applies to the given context
   * 
   * @param {Object} context - Evaluation context
   * @returns {boolean} - Whether this rule applies
   */
  appliesTo(context) {
    return true; // Base implementation always applies
  }
  
  /**
   * Check if a pattern is exempt from this rule
   * 
   * @param {string} text - Text to check for exemption
   * @returns {boolean} - Whether the pattern is exempt
   */
  isExemptPattern(text) {
    if (!this.metadata.exemptPatterns || !Array.isArray(this.metadata.exemptPatterns)) {
      return false;
    }
    
    return this.metadata.exemptPatterns.some(pattern => pattern.test(text));
  }
  
  /**
   * Get line number for a character index in text
   * 
   * @param {string} text - Text to analyze
   * @param {number} index - Character index
   * @returns {number} - Line number (1-based)
   */
  getLineNumber(text, index) {
    return text.substring(0, index).split('\n').length;
  }
  
  /**
   * Get column number for a character index in text
   * 
   * @param {string} text - Text to analyze
   * @param {number} index - Character index
   * @returns {number} - Column number (1-based)
   */
  getColumn(text, index) {
    const lastNewline = text.lastIndexOf('\n', index);
    return lastNewline === -1 ? index + 1 : index - lastNewline;
  }
  
  /**
   * Evaluate code against this rule
   * 
   * @param {Object} context - Evaluation context
   * @returns {Object} - Rule evaluation result
   */
  evaluate(context) {
    throw new SecurityRuleEngineError(
      'SecurityRule.evaluate() must be implemented by subclasses',
      'RULE_NOT_IMPLEMENTED',
      { ruleId: this.id }
    );
  }
  
  /**
   * Get recommendation for fixing issues detected by this rule
   * 
   * @param {Object} context - Evaluation context
   * @returns {string} - Recommendation text
   */
  getRecommendation(context) {
    return `Review code for issues related to ${this.name}`;
  }
}

/**
 * Cryptographic Verification Rule
 * 
 * Detects potential cryptographic verification vulnerabilities.
 */
export class CryptoVerificationRule extends SecurityRule {
  /**
   * Create a new CryptoVerificationRule
   */
  constructor() {
    super({
      id: 'crypto-verification',
      name: 'Cryptographic Verification',
      description: 'Detects potential vulnerabilities in cryptographic verification implementations',
      severity: 'high',
      metadata: {
        moreInfoUrl: 'https://github.com/your-org/zk-security-rules/wiki/CryptoVerificationRule',
        exemptPatterns: [
          // Patterns that should be exempt from this rule
          /\/\/ SECURITY-REVIEWED:/i,
          /\/\/ CRYPTO-AUDIT-PASSED:/i
        ]
      }
    });

    // Patterns that indicate potential vulnerabilities
    this.patterns = {
      weakVerification: [
        // Missing verification
        /verify\s*\(\s*\)\s*{\s*return\s+true/i,
        /isValid\s*\(\s*\)\s*{\s*return\s+true/i,

        // Incomplete verification
        /verify\w+\s*\([^)]*\)\s*{\s*(?!.*check).*return\s+true/i,

        // Commented out verification
        /\/\/\s*verify/i,
        /\/\*\s*verify[^*]*\*\//i,

        // Hardcoded hash comparisons
        /compare\w*\s*\([^)]*\s*===?\s*["']([a-fA-F0-9]{32,})["']/i,
        /===?\s*["']([a-fA-F0-9]{32,})["']/i
      ],
      unsafeComparison: [
        // Non-constant time comparison
        /===/i,
        /!===/i,
        /==/i,
        /!=/i
      ],
      constantTimeBypass: [
        // Early returns in verification functions
        /verify\w*\s*\([^)]*\)\s*{\s*[^}]*if\s*\([^)]*\)\s*{\s*return\s+(true|false)/i,
        /is\w+Valid\s*\([^)]*\)\s*{\s*[^}]*if\s*\([^)]*\)\s*{\s*return\s+(true|false)/i
      ],
      uncheckedInputs: [
        // Not checking inputs before use in crypto operations
        /function\s+verify\w*\s*\([^)]*\)\s*{\s*(?![^}]*if\s*\([^)]*instanceof)/i,
        /function\s+verify\w*\s*\([^)]*\)\s*{\s*(?![^}]*if\s*\([^)]*typeof)/i,
        /function\s+verify\w*\s*\([^)]*\)\s*{\s*(?![^}]*if\s*\([^)]*length)/i
      ],
      insecureRandom: [
        // Use of Math.random in crypto operations
        /Math\.random\(\)/i,
        // Non-cryptographically secure random functions
        /\brandom\(\)/i,
        /\brandInt\(/i,
        /\brandBytes\(/i
      ]
    };
  }

  /**
   * Check if this rule applies to the given file
   * 
   * @param {Object} context - The audit context
   * @returns {boolean} - Whether this rule applies
   */
  appliesTo(context) {
    const cryptoRelatedPatterns = [
      /verify/i,
      /crypto/i,
      /hash/i,
      /sign/i,
      /proof/i,
      /zkp/i,
      /zk.*proof/i,
      /schnorr/i,
      /groth16/i,
      /sha\d+/i,
      /keccak/i,
      /eddsa/i
    ];

    return cryptoRelatedPatterns.some(pattern => pattern.test(context.code));
  }

  /**
   * Check for weak verification implementations
   * 
   * @param {string} code - Code to check
   * @param {string} filePath - Path of the file being checked
   * @returns {Object[]} Array of findings
   */
  _checkMissingVerification(code, filePath) {
    const findings = [];

    for (const pattern of this.patterns.weakVerification) {
      const matches = Array.from(code.matchAll(new RegExp(pattern, 'g')));

      for (const match of matches) {
        if (this.isExemptPattern(match[0])) {
          continue;
        }

        const lineNumber = this.getLineNumber(code, match.index);
        findings.push({
          rule: this.id,
          message: 'Weak or insufficient cryptographic verification detected',
          severity: this.severity,
          lineNumber,
          column: this.getColumn(code, match.index),
          snippet: match[0],
          filePath
        });
      }
    }

    return findings;
  }

  /**
   * Check for non-constant time comparisons in crypto code
   * 
   * @param {string} code - Code to check
   * @param {string} filePath - Path of the file being checked
   * @returns {Object[]} Array of findings
   */
  _checkUnsafeComparison(code, filePath) {
    const findings = [];
    const comparisonContextPattern = /(verify|isValid|check|compare)[^{]*{[^}]*?((===?)|(==))[^}]*}/gi;

    const contextMatches = Array.from(code.matchAll(comparisonContextPattern));

    for (const contextMatch of contextMatches) {
      const context = contextMatch[0];

      // Only flag if there's no explicit constant-time comparison library/function being used
      if (!/constantTime|timingSafe|timingResistant|secureCompare|cryptoCompare/.test(context)) {
        for (const pattern of this.patterns.unsafeComparison) {
          const matches = Array.from(context.matchAll(new RegExp(pattern, 'g')));

          for (const match of matches) {
            if (this.isExemptPattern(context)) {
              continue;
            }

            const lineNumber = this.getLineNumber(code, contextMatch.index + context.indexOf(match[0]));
            findings.push({
              rule: this.id,
              message: 'Non-constant time comparison in cryptographic verification',
              severity: this.severity,
              lineNumber,
              column: this.getColumn(code, contextMatch.index + context.indexOf(match[0])),
              snippet: match[0],
              recommendation: 'Use a constant-time comparison function like crypto.timingSafeEqual()',
              filePath
            });
          }
        }
      }
    }

    return findings;
  }

  /**
   * Check for insecure random number generation in cryptographic implementations
   * 
   * @param {string} code - Code to check
   * @param {string} filePath - Path of the file being checked
   * @returns {Object[]} Array of findings
   */
  _checkInsecureRandomGeneration(code, filePath) {
    const findings = [];

    for (const pattern of this.patterns.insecureRandom) {
      const matches = Array.from(code.matchAll(new RegExp(pattern, 'g')));

      for (const match of matches) {
        if (this.isExemptPattern(match[0])) {
          continue;
        }

        const lineNumber = this.getLineNumber(code, match.index);
        findings.push({
          rule: this.id,
          message: 'Insecure random number generation in cryptographic context',
          severity: 'high',
          lineNumber,
          column: this.getColumn(code, match.index),
          snippet: match[0],
          recommendation: 'Use crypto.randomBytes() or crypto.getRandomValues() for cryptographic operations',
          filePath
        });
      }
    }

    return findings;
  }

  /**
   * Check for hardcoded secrets in code
   * 
   * @param {string} code - Code to check
   * @param {string} filePath - Path of the file being checked
   * @returns {Object[]} Array of findings
   */
  _checkHardcodedSecrets(code, filePath) {
    const findings = [];
    const patterns = [
      /const\s+(?:secret|key|password|token)\s*=\s*['"`][^'"`]{8,}['"`]/gi,
      /let\s+(?:secret|key|password|token)\s*=\s*['"`][^'"`]{8,}['"`]/gi,
      /var\s+(?:secret|key|password|token)\s*=\s*['"`][^'"`]{8,}['"`]/gi,
      /private\s+(?:secret|key|password|token)\s*=\s*['"`][^'"`]{8,}['"`]/gi
    ];

    for (const pattern of patterns) {
      const matches = Array.from(code.matchAll(pattern));

      for (const match of matches) {
        if (this.isExemptPattern(match[0])) {
          continue;
        }

        const lineNumber = this.getLineNumber(code, match.index);
        findings.push({
          rule: this.id,
          message: 'Hardcoded secret or key found in source code',
          severity: 'critical',
          lineNumber,
          column: this.getColumn(code, match.index),
          snippet: match[0],
          recommendation: 'Store secrets in environment variables or a secure vault',
          filePath
        });
      }
    }

    return findings;
  }
  
  /**
   * Evaluate code for cryptographic vulnerabilities
   *
   * @param {Object} context - Evaluation context with code and filePath
   * @returns {Object[]} - Array of findings
   */
  evaluate(context) {
    if (!this.appliesTo(context)) {
      return [];
    }

    const { code, filePath } = context;

    const findings = [
      ...this._checkMissingVerification(code, filePath),
      ...this._checkInsecureRandomGeneration(code, filePath),
      ...this._checkHardcodedSecrets(code, filePath),
      ...this._checkUnsafeComparison(code, filePath)
    ];

    return findings;
  }
}

/**
 * Input Validation Rule
 * 
 * Detects potential input validation issues in ZK code.
 */
export class InputValidationRule extends SecurityRule {
  /**
   * Create a new InputValidationRule
   */
  constructor() {
    super({
      id: 'input-validation',
      name: 'Input Validation',
      description: 'Detects missing or insufficient input validation',
      severity: 'high',
      metadata: {
        exemptPatterns: [
          /\/\/ INPUT-VALIDATION-VERIFIED:/i,
          /\/\/ SECURITY-REVIEWED:/i
        ]
      }
    });
    
    // Patterns for detecting input validation issues
    this.patterns = {
      missingValidation: [
        // Function parameters without validation
        /function\s+(\w+)\s*\([^)]+\)\s*{\s*(?![^}]*typeof|instanceof|if\s*\(|validate)/i
      ],
      directUsage: [
        // Direct usage of user input
        /req\.body/i,
        /req\.query/i,
        /req\.params/i,
        /JSON\.parse\s*\(/i
      ],
      unsafeOperations: [
        // Potentially unsafe operations
        /eval\s*\(/i,
        /new\s+Function\s*\(/i,
        /setTimeout\s*\(\s*['"`]/i,
        /setInterval\s*\(\s*['"`]/i,
        /require\s*\(\s*[^\)]*\+/i
      ]
    };
  }
  
  /**
   * Check if this rule applies to the given context
   * 
   * @param {Object} context - Evaluation context
   * @returns {boolean} - Whether this rule applies
   */
  appliesTo(context) {
    return true; // Input validation applies to all code
  }
  
  /**
   * Check for missing input validation
   * 
   * @param {string} code - Code to check
   * @param {string} filePath - Path of the file being checked
   * @returns {Object[]} Array of findings
   */
  _checkMissingValidation(code, filePath) {
    const findings = [];
    const apiRelatedPatterns = [
      /api/i,
      /handler/i,
      /controller/i,
      /route/i,
      /endpoint/i
    ];
    
    // Only check for missing validation in API-related files
    if (!apiRelatedPatterns.some(pattern => pattern.test(filePath))) {
      return findings;
    }
    
    for (const pattern of this.patterns.missingValidation) {
      const matches = Array.from(code.matchAll(new RegExp(pattern, 'g')));
      
      for (const match of matches) {
        if (this.isExemptPattern(match[0])) {
          continue;
        }
        
        const functionName = match[1] || 'anonymous function';
        const lineNumber = this.getLineNumber(code, match.index);
        
        findings.push({
          rule: this.id,
          message: `Function "${functionName}" may lack proper input validation`,
          severity: 'medium',
          lineNumber,
          column: this.getColumn(code, match.index),
          snippet: match[0].substring(0, 100), // Limit snippet length
          recommendation: 'Validate all function inputs before use',
          filePath
        });
      }
    }
    
    return findings;
  }
  
  /**
   * Check for direct usage of user input
   * 
   * @param {string} code - Code to check
   * @param {string} filePath - Path of the file being checked
   * @returns {Object[]} Array of findings
   */
  _checkDirectUsage(code, filePath) {
    const findings = [];
    
    for (const pattern of this.patterns.directUsage) {
      const matches = Array.from(code.matchAll(new RegExp(pattern, 'g')));
      
      for (const match of matches) {
        if (this.isExemptPattern(match[0])) {
          continue;
        }
        
        // Skip if input appears to be validated nearby
        const contextStart = Math.max(0, match.index - 200);
        const contextEnd = Math.min(code.length, match.index + 200);
        const context = code.substring(contextStart, contextEnd);
        
        if (/validate|sanitize|check|verify|assert/.test(context)) {
          continue;
        }
        
        const lineNumber = this.getLineNumber(code, match.index);
        findings.push({
          rule: this.id,
          message: `Direct usage of potentially untrusted input: ${match[0]}`,
          severity: 'high',
          lineNumber,
          column: this.getColumn(code, match.index),
          snippet: match[0],
          recommendation: 'Validate and sanitize all user inputs before use',
          filePath
        });
      }
    }
    
    return findings;
  }
  
  /**
   * Check for potentially unsafe operations
   * 
   * @param {string} code - Code to check
   * @param {string} filePath - Path of the file being checked
   * @returns {Object[]} Array of findings
   */
  _checkUnsafeOperations(code, filePath) {
    const findings = [];
    
    for (const pattern of this.patterns.unsafeOperations) {
      const matches = Array.from(code.matchAll(new RegExp(pattern, 'g')));
      
      for (const match of matches) {
        if (this.isExemptPattern(match[0])) {
          continue;
        }
        
        const lineNumber = this.getLineNumber(code, match.index);
        findings.push({
          rule: this.id,
          message: `Potentially unsafe operation detected: ${match[0]}`,
          severity: 'critical',
          lineNumber,
          column: this.getColumn(code, match.index),
          snippet: match[0],
          recommendation: 'Avoid dynamic code execution with user input',
          filePath
        });
      }
    }
    
    return findings;
  }
  
  /**
   * Evaluate code for input validation issues
   * 
   * @param {Object} context - Evaluation context
   * @returns {Object[]} - Array of findings
   */
  evaluate(context) {
    if (!this.appliesTo(context)) {
      return [];
    }
    
    const { code, filePath } = context;
    
    const findings = [
      ...this._checkMissingValidation(code, filePath),
      ...this._checkDirectUsage(code, filePath),
      ...this._checkUnsafeOperations(code, filePath)
    ];
    
    return findings;
  }
}

/**
 * ZK Security Rule
 * 
 * Detects issues specific to ZK proof implementations.
 */
export class ZKSecurityRule extends SecurityRule {
  /**
   * Create a new ZKSecurityRule
   */
  constructor() {
    super({
      id: 'zk-security',
      name: 'ZK Security',
      description: 'Detects issues specific to zero-knowledge proof implementations',
      severity: 'high',
      metadata: {
        exemptPatterns: [
          /\/\/ ZK-SECURITY-REVIEWED:/i
        ]
      }
    });
    
    // Patterns for detecting ZK-specific issues
    this.patterns = {
      untrustedProofSource: [
        /proof\s*=\s*req\.body/i,
        /proof\s*=\s*JSON\.parse/i,
        /proof\s*=\s*input/i,
        /proof\s*=\s*data/i
      ],
      missingProofVerification: [
        /function\s+\w*verify\w*\s*\([^)]*proof[^)]*\)\s*{\s*(?![^}]*snarkjs\.groth16\.verify)/i,
        /function\s+\w*verify\w*\s*\([^)]*proof[^)]*\)\s*{\s*(?![^}]*verify)/i
      ],
      weakCircuitConstraints: [
        /\/\/\s*TODO.*constraint/i,
        /\/\/\s*FIXME.*constraint/i,
        /template\s+\w+\s*\([^)]*\)\s*{\s*(?![^}]*signal\s+input)/i
      ]
    };
  }
  
  /**
   * Check if this rule applies to the given context
   * 
   * @param {Object} context - Evaluation context
   * @returns {boolean} - Whether this rule applies
   */
  appliesTo(context) {
    const zkPatterns = [
      /zk/i,
      /proof/i,
      /verify/i,
      /snarkjs/i,
      /circom/i,
      /groth16/i,
      /plonk/i,
      /circuit/i,
      /constraint/i,
      /signal/i,
      /template/i,
      /component/i
    ];
    
    return zkPatterns.some(pattern => pattern.test(context.code) || pattern.test(context.filePath));
  }
  
  /**
   * Check for untrusted proof sources
   * 
   * @param {string} code - Code to check
   * @param {string} filePath - Path of the file being checked
   * @returns {Object[]} Array of findings
   */
  _checkUntrustedProofSource(code, filePath) {
    const findings = [];
    
    for (const pattern of this.patterns.untrustedProofSource) {
      const matches = Array.from(code.matchAll(new RegExp(pattern, 'g')));
      
      for (const match of matches) {
        if (this.isExemptPattern(match[0])) {
          continue;
        }
        
        // Look for validation nearby
        const contextStart = Math.max(0, match.index - 200);
        const contextEnd = Math.min(code.length, match.index + 200);
        const context = code.substring(contextStart, contextEnd);
        
        if (/validate\s*\(\s*proof\s*\)|validateProof|verifyProofFormat|sanitizeProof/.test(context)) {
          continue;
        }
        
        const lineNumber = this.getLineNumber(code, match.index);
        findings.push({
          rule: this.id,
          message: 'Potentially untrusted source for ZK proof',
          severity: 'high',
          lineNumber,
          column: this.getColumn(code, match.index),
          snippet: match[0],
          recommendation: 'Validate and sanitize all proof inputs before processing',
          filePath
        });
      }
    }
    
    return findings;
  }
  
  /**
   * Check for missing proof verification
   * 
   * @param {string} code - Code to check
   * @param {string} filePath - Path of the file being checked
   * @returns {Object[]} Array of findings
   */
  _checkMissingProofVerification(code, filePath) {
    const findings = [];
    
    for (const pattern of this.patterns.missingProofVerification) {
      const matches = Array.from(code.matchAll(new RegExp(pattern, 'g')));
      
      for (const match of matches) {
        if (this.isExemptPattern(match[0])) {
          continue;
        }
        
        const lineNumber = this.getLineNumber(code, match.index);
        findings.push({
          rule: this.id,
          message: 'Possible missing proof verification',
          severity: 'critical',
          lineNumber,
          column: this.getColumn(code, match.index),
          snippet: match[0],
          recommendation: 'Ensure proof verification is properly implemented',
          filePath
        });
      }
    }
    
    return findings;
  }
  
  /**
   * Check for weak circuit constraints
   * 
   * @param {string} code - Code to check
   * @param {string} filePath - Path of the file being checked
   * @returns {Object[]} Array of findings
   */
  _checkWeakCircuitConstraints(code, filePath) {
    const findings = [];
    
    // Only check circuit files
    if (!filePath.endsWith('.circom')) {
      return findings;
    }
    
    for (const pattern of this.patterns.weakCircuitConstraints) {
      const matches = Array.from(code.matchAll(new RegExp(pattern, 'g')));
      
      for (const match of matches) {
        if (this.isExemptPattern(match[0])) {
          continue;
        }
        
        const lineNumber = this.getLineNumber(code, match.index);
        findings.push({
          rule: this.id,
          message: 'Potential weak circuit constraints',
          severity: 'high',
          lineNumber,
          column: this.getColumn(code, match.index),
          snippet: match[0],
          recommendation: 'Strengthen circuit constraints to ensure security properties',
          filePath
        });
      }
    }
    
    return findings;
  }
  
  /**
   * Evaluate code for ZK-specific security issues
   * 
   * @param {Object} context - Evaluation context
   * @returns {Object[]} - Array of findings
   */
  evaluate(context) {
    if (!this.appliesTo(context)) {
      return [];
    }
    
    const { code, filePath } = context;
    
    const findings = [
      ...this._checkUntrustedProofSource(code, filePath),
      ...this._checkMissingProofVerification(code, filePath),
      ...this._checkWeakCircuitConstraints(code, filePath)
    ];
    
    return findings;
  }
}

/**
 * Security Rule Engine
 * 
 * Main engine for running security rules against code
 */
export class SecurityRuleEngine {
  /**
   * Create a new SecurityRuleEngine
   * 
   * @param {Object} options - Configuration options
   * @param {Array} [options.rules] - Security rules to use
   * @param {string} [options.outputDir='./security-reports'] - Output directory
   * @param {boolean} [options.verbose=false] - Enable verbose logging
   * @param {Array<string>} [options.excludePatterns] - Glob patterns to exclude
   * @param {Array<string>} [options.includeExtensions] - File extensions to include
   */
  constructor(options = {}) {
    this.rules = options.rules || [];
    this.outputDir = options.outputDir || './security-reports';
    this.verbose = options.verbose || false;
    this.excludePatterns = options.excludePatterns || [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/*.min.js',
      '**/vendor/**'
    ];
    this.includeExtensions = options.includeExtensions || ['.js', '.ts', '.jsx', '.tsx', '.circom'];

    // Load default rules if none provided
    if (this.rules.length === 0) {
      this._loadDefaultRules();
    }

    this.log(`Initialized SecurityRuleEngine with ${this.rules.length} rules`);
    this.log(`Output directory: ${this.outputDir}`);
  }

  /**
   * Load default security rules
   * @private
   */
  _loadDefaultRules() {
    this.rules = [
      new CryptoVerificationRule(),
      new InputValidationRule(),
      new ZKSecurityRule()
    ];
    this.log(`Loaded ${this.rules.length} default security rules`);
  }

  /**
   * Check if a file should be excluded from analysis
   * 
   * @param {string} filePath - Path to check
   * @returns {boolean} - Whether the file should be excluded
   * @private
   */
  _shouldExcludeFile(filePath) {
    try {
      // Check against exclude patterns
      for (const pattern of this.excludePatterns) {
        if (filePath.includes(pattern.replace(/\*/g, ''))) {
          return true;
        }
      }

      // Check file extension
      const ext = path.extname(filePath);
      return !this.includeExtensions.includes(ext);
    } catch (error) {
      zkErrorLogger.logError(error, {
        context: 'SecurityRuleEngine._shouldExcludeFile',
        filePath,
        message: 'Error checking file exclusion'
      });
      return true; // Exclude on error
    }
  }

  /**
   * Read and parse a file
   * 
   * @param {string} filePath - Path to file
   * @returns {Promise<Object>} - File content and metadata
   * @private
   */
  async _readFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return {
        path: filePath,
        content,
        size: content.length,
        extension: path.extname(filePath)
      };
    } catch (error) {
      zkErrorLogger.logError(error, {
        context: 'SecurityRuleEngine._readFile',
        filePath,
        message: 'Error reading file'
      });
      throw new SecurityRuleEngineError(
        `Failed to read file ${filePath}: ${error.message}`,
        'READ_ERROR',
        { filePath, originalError: error.message }
      );
    }
  }

  /**
   * Run security analysis on a single file
   * 
   * @param {string} filePath - Path to file
   * @returns {Promise<Object>} - Analysis results
   */
  async analyzeFile(filePath) {
    try {
      this.log(`Analyzing file: ${filePath}`);

      if (this._shouldExcludeFile(filePath)) {
        this.log(`Skipping excluded file: ${filePath}`);
        return {
          filePath,
          skipped: true,
          reason: 'Excluded by pattern or extension'
        };
      }

      const file = await this._readFile(filePath);
      
      const results = {
        filePath,
        skipped: false,
        findings: [],
        ruleResults: {}
      };

      // Run each rule against the file
      for (const rule of this.rules) {
        try {
          this.log(`Running rule ${rule.id} against ${filePath}`);

          const ruleContext = {
            code: file.content,
            filePath: file.path,
            extension: file.extension
          };

          const ruleFindings = rule.evaluate(ruleContext);
          results.ruleResults[rule.id] = {
            triggered: ruleFindings.length > 0,
            findingCount: ruleFindings.length
          };

          // Add findings to results
          results.findings.push(...ruleFindings);
        } catch (error) {
          zkErrorLogger.logError(error, {
            context: 'SecurityRuleEngine.analyzeFile.ruleExecution',
            filePath,
            ruleId: rule.id,
            message: 'Error executing security rule'
          });

          results.findings.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: 'ERROR',
            message: `Error running rule: ${error.message}`,
            details: { error: error.message },
            recommendation: 'Fix the error in the security rule implementation',
            filePath
          });
        }
      }

      this.log(`Found ${results.findings.length} issues in ${filePath}`);
      return results;
    } catch (error) {
      zkErrorLogger.logError(error, {
        context: 'SecurityRuleEngine.analyzeFile',
        filePath,
        message: 'Error analyzing file'
      });

      return {
        filePath,
        error: error.message,
        skipped: false,
        findings: [{
          severity: 'ERROR',
          message: `Error analyzing file: ${error.message}`,
          recommendation: 'Check if the file exists and can be read',
          filePath
        }]
      };
    }
  }

  /**
   * Run security analysis on a directory
   * 
   * @param {string} dirPath - Path to directory
   * @returns {Promise<Object>} - Analysis results
   */
  async analyzeDirectory(dirPath) {
    try {
      this.log(`Analyzing directory: ${dirPath}`);

      // Find all files recursively, excluding patterns
      const globPattern = path.join(dirPath, '**/*');
      const ignorePatterns = this.excludePatterns.map(pattern => {
        return pattern.startsWith('**/') ? pattern : `**/${pattern}`;
      });

      const files = await glob(globPattern, {
        ignore: ignorePatterns,
        nodir: true
      });

      // Filter files by extension
      const validFiles = files.filter(file => {
        const ext = path.extname(file);
        return this.includeExtensions.includes(ext);
      });

      this.log(`Found ${validFiles.length} files to analyze in ${dirPath}`);

      // Run analysis on each file
      const results = {
        dirPath,
        totalFiles: validFiles.length,
        analyzedFiles: 0,
        skippedFiles: 0,
        errorFiles: 0,
        totalFindings: 0,
        findingsBySeverity: {
          CRITICAL: 0,
          HIGH: 0,
          MEDIUM: 0,
          LOW: 0,
          INFO: 0,
          ERROR: 0
        },
        fileResults: []
      };

      for (const file of validFiles) {
        const fileResult = await this.analyzeFile(file);
        results.fileResults.push(fileResult);

        if (fileResult.skipped) {
          results.skippedFiles++;
        } else if (fileResult.error) {
          results.errorFiles++;
        } else {
          results.analyzedFiles++;
          results.totalFindings += fileResult.findings.length;

          // Count findings by severity
          for (const finding of fileResult.findings) {
            const severity = finding.severity ? finding.severity.toUpperCase() : 'INFO';
            results.findingsBySeverity[severity] =
              (results.findingsBySeverity[severity] || 0) + 1;
          }
        }
      }

      this.log(`Analysis complete for ${dirPath}`);
      this.log(`Analyzed ${results.analyzedFiles} files, found ${results.totalFindings} issues`);

      // Generate summary
      results.summary = this._generateSummary(results);

      // Save report if output directory is set
      if (this.outputDir) {
        await this._saveReport(results);
      }

      return results;
    } catch (error) {
      zkErrorLogger.logError(error, {
        context: 'SecurityRuleEngine.analyzeDirectory',
        dirPath,
        message: 'Error analyzing directory'
      });

      return {
        dirPath,
        error: error.message,
        summary: `Error analyzing directory: ${error.message}`
      };
    }
  }

  /**
   * Run security analysis on a target (file or directory)
   * 
   * @param {string} targetPath - Path to analyze
   * @returns {Promise<Object>} - Analysis results
   */
  async analyze(targetPath) {
    try {
      // Check if target exists
      const stats = await fs.stat(targetPath);

      if (stats.isDirectory()) {
        return this.analyzeDirectory(targetPath);
      } else if (stats.isFile()) {
        const fileResult = await this.analyzeFile(targetPath);

        // Format the results similar to directory results for consistency
        const results = {
          targetPath,
          targetType: 'file',
          totalFiles: 1,
          analyzedFiles: fileResult.skipped ? 0 : 1,
          skippedFiles: fileResult.skipped ? 1 : 0,
          errorFiles: fileResult.error ? 1 : 0,
          totalFindings: fileResult.findings ? fileResult.findings.length : 0,
          findingsBySeverity: {},
          fileResults: [fileResult]
        };

        // Count findings by severity
        if (fileResult.findings) {
          for (const finding of fileResult.findings) {
            const severity = finding.severity ? finding.severity.toUpperCase() : 'INFO';
            results.findingsBySeverity[severity] =
              (results.findingsBySeverity[severity] || 0) + 1;
          }
        }

        // Generate summary
        results.summary = this._generateSummary(results);

        // Save report if output directory is set
        if (this.outputDir) {
          await this._saveReport(results);
        }

        return results;
      } else {
        throw new Error(`Target is neither a file nor a directory: ${targetPath}`);
      }
    } catch (error) {
      zkErrorLogger.logError(error, {
        context: 'SecurityRuleEngine.analyze',
        targetPath,
        message: 'Error executing security analysis'
      });

      return {
        targetPath,
        error: error.message,
        summary: `Error running security analysis: ${error.message}`
      };
    }
  }

  /**
   * Generate a summary of analysis results
   * 
   * @param {Object} results - Analysis results
   * @returns {string} - Summary text
   * @private
   */
  _generateSummary(results) {
    try {
      const { totalFiles, analyzedFiles, skippedFiles, errorFiles, totalFindings, findingsBySeverity } = results;

      let riskLevel = 'Low';
      if ((findingsBySeverity.CRITICAL || 0) > 0) {
        riskLevel = 'Critical';
      } else if ((findingsBySeverity.HIGH || 0) > 0) {
        riskLevel = 'High';
      } else if ((findingsBySeverity.MEDIUM || 0) > 2) {
        riskLevel = 'Medium';
      }

      return (
        `Security analysis complete. Analyzed ${analyzedFiles} of ${totalFiles} files ` +
        `(${skippedFiles} skipped, ${errorFiles} errors). ` +
        `Found ${totalFindings} issues (${findingsBySeverity.CRITICAL || 0} critical, ` +
        `${findingsBySeverity.HIGH || 0} high, ${findingsBySeverity.MEDIUM || 0} medium, ` +
        `${findingsBySeverity.LOW || 0} low, ${findingsBySeverity.INFO || 0} info). ` +
        `Overall risk level: ${riskLevel}.`
      );
    } catch (error) {
      zkErrorLogger.logError(error, {
        context: 'SecurityRuleEngine._generateSummary',
        message: 'Error generating summary'
      });
      return 'Error generating summary report';
    }
  }

  /**
   * Save analysis report to file
   * 
   * @param {Object} results - Analysis results
   * @returns {Promise<string>} - Path to saved report
   * @private
   */
  async _saveReport(results) {
    try {
      // Create output directory if it doesn't exist
      await fs.mkdir(this.outputDir, { recursive: true });

      // Generate filename based on target and timestamp
      const targetName = results.dirPath || results.targetPath || 'unknown';
      const sanitizedName = path.basename(targetName).replace(/[^a-z0-9]/gi, '-');
      const timestamp = new Date().toISOString().replace(/[:\.]/g, '-');
      const filename = `security-report-${sanitizedName}-${timestamp}.json`;
      const reportPath = path.join(this.outputDir, filename);

      // Save report as JSON
      await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
      this.log(`Report saved to: ${reportPath}`);

      return reportPath;
    } catch (error) {
      zkErrorLogger.logError(error, {
        context: 'SecurityRuleEngine._saveReport',
        outputDir: this.outputDir,
        message: 'Error saving security report'
      });

      console.error(`Error saving report: ${error.message}`);
      return null;
    }
  }

  /**
   * Log a message if verbose mode is enabled
   * 
   * @param {string} message - Message to log
   * @private
   */
  log(message) {
    if (this.verbose) {
      console.log(`[SecurityRuleEngine] ${message}`);
    }
  }
}

// Create singleton instance
const securityRuleEngine = new SecurityRuleEngine();

export { securityRuleEngine };
export default securityRuleEngine;