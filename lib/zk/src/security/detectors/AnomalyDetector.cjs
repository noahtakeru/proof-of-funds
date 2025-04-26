/**
 * Anomaly Detector Module
 * 
 * Detects anomalies in ZK proof generation and verification
 * 
 * @module AnomalyDetector
 */

// Import SecurityDetector base class (commented to avoid actual import issues in compatibility layer)
// const { SecurityDetector } = require('./SecurityDetectorFactory.js');

/**
 * AnomalyDetector class for detecting abnormal patterns in ZK operations
 * @extends SecurityDetector
 */
class AnomalyDetector {
  /**
   * Create a new anomaly detector
   * @param {Object} options - Detector configuration
   */
  constructor(options = {}) {
    this.type = 'Anomaly';
    this.enabled = true;
    this.thresholds = {
      timeDiffMax: options.timeDiffMax || 5000, // ms
      proofSizeMax: options.proofSizeMax || 10000, // bytes
      proofSizeMin: options.proofSizeMin || 50, // bytes
      failureRateMax: options.failureRateMax || 0.2, // 20%
      ...options.thresholds
    };
    
    this.history = [];
    this.maxHistorySize = options.maxHistorySize || 100;
  }

  /**
   * Enable this detector
   * @returns {AnomalyDetector} - This detector instance for method chaining
   */
  enable() {
    this.enabled = true;
    return this;
  }

  /**
   * Disable this detector
   * @returns {AnomalyDetector} - This detector instance for method chaining
   */
  disable() {
    this.enabled = false;
    return this;
  }

  /**
   * Check if this detector is currently enabled
   * @returns {boolean} - Whether the detector is enabled
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Check if a file is relevant for this detector
   * @param {Object} file - The file to check
   * @param {string} file.path - The file path
   * @param {string} file.content - The file content
   * @returns {boolean} True if the file is relevant for this detector
   */
  isRelevantFile(file) {
    // Anomaly detector focuses on runtime behavior, not static code analysis
    // But we can check for files that might be involved in ZK proof generation/verification
    if (!file || !file.path) return false;
    
    const relevantPatterns = [
      /proof/i,
      /verify/i,
      /zkp/i,
      /circuit/i,
      /snark/i
    ];
    
    return relevantPatterns.some(pattern => pattern.test(file.path));
  }

  /**
   * Add an event to the detector history
   * @param {Object} event - Event data
   */
  addEvent(event) {
    if (!event || typeof event !== 'object') return;
    
    // Add timestamp if not present
    if (!event.timestamp) {
      event.timestamp = Date.now();
    }
    
    this.history.push(event);
    
    // Trim history if needed
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
  }

  /**
   * Calculate complexity of a detection operation
   * @param {Object} operation - The operation to analyze
   * @returns {number} - Complexity score for the operation
   */
  calculateComplexity(operation) {
    if (!operation || typeof operation !== 'object') {
      return 0;
    }
    
    let complexity = 0;
    
    // Basic complexity based on operation size
    const operationSize = JSON.stringify(operation).length;
    complexity += Math.min(operationSize / 100, 10); // Max 10 points for size
    
    // Additional complexity based on data types
    if (operation.input && Array.isArray(operation.input)) {
      complexity += operation.input.length * 0.5; // 0.5 points per input item
    }
    
    if (operation.computation === 'intensive') {
      complexity += 20;
    } else if (operation.computation === 'medium') {
      complexity += 10;
    }
    
    // Temporal complexity for time-sensitive operations
    if (operation.timing && operation.timing.deadline) {
      const timeRemaining = operation.timing.deadline - Date.now();
      if (timeRemaining < 1000) { // Less than 1 second
        complexity += 15;
      } else if (timeRemaining < 5000) { // Less than 5 seconds
        complexity += 8;
      }
    }
    
    return Math.min(Math.round(complexity), 100); // Cap at 100
  }
  
  /**
   * Extract functions from code for analysis
   * @param {string} code - The code to analyze
   * @returns {Array<Object>} Array of extracted function information
   */
  extractFunctions(code) {
    if (!code || typeof code !== 'string') {
      return [];
    }
    
    const functions = [];
    const functionRegex = /function\s+(\w+)\s*\(([^)]*)\)\s*{|const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*{|class\s+(\w+)|method\s+(\w+)\s*\(/g;
    
    let match;
    while ((match = functionRegex.exec(code)) !== null) {
      // Extract function name from the regex groups
      const name = match[1] || match[3] || match[4] || match[5] || 'anonymous';
      const startPosition = match.index;
      
      // Simple logic to find the end of the function (not perfect for nested functions)
      let braceCount = 0;
      let endPosition = startPosition;
      
      for (let i = startPosition; i < code.length; i++) {
        if (code[i] === '{') braceCount++;
        if (code[i] === '}') {
          braceCount--;
          if (braceCount === 0 && match[0].includes('{')) {
            endPosition = i + 1;
            break;
          }
        }
      }
      
      const functionBody = code.substring(startPosition, endPosition);
      
      functions.push({
        name,
        body: functionBody,
        startPosition,
        endPosition,
        length: functionBody.length,
        params: match[2] ? match[2].split(',').map(p => p.trim()).filter(Boolean) : []
      });
    }
    
    return functions;
  }
  
  /**
   * Detect naming inconsistencies in code
   * @param {string} code - The code to analyze
   * @returns {Array<Object>} - Detected naming inconsistencies
   */
  detectNamingInconsistencies(code) {
    if (!code || typeof code !== 'string') {
      return [];
    }
    
    const anomalies = [];
    const functions = this.extractFunctions(code);
    
    // Check for inconsistent naming conventions
    const camelCaseRegex = /^[a-z][a-zA-Z0-9]*$/;
    const pascalCaseRegex = /^[A-Z][a-zA-Z0-9]*$/;
    const snakeCaseRegex = /^[a-z][a-z0-9_]*$/;
    
    // Count different naming conventions
    let camelCaseCount = 0;
    let pascalCaseCount = 0;
    let snakeCaseCount = 0;
    
    for (const func of functions) {
      if (camelCaseRegex.test(func.name)) {
        camelCaseCount++;
      } else if (pascalCaseRegex.test(func.name)) {
        pascalCaseCount++;
      } else if (snakeCaseRegex.test(func.name)) {
        snakeCaseCount++;
      }
    }
    
    // Determine dominant convention
    const total = camelCaseCount + pascalCaseCount + snakeCaseCount;
    let dominantConvention = '';
    let dominantCount = 0;
    
    if (camelCaseCount > dominantCount) {
      dominantConvention = 'camelCase';
      dominantCount = camelCaseCount;
    }
    
    if (pascalCaseCount > dominantCount) {
      dominantConvention = 'PascalCase';
      dominantCount = pascalCaseCount;
    }
    
    if (snakeCaseCount > dominantCount) {
      dominantConvention = 'snake_case';
      dominantCount = snakeCaseCount;
    }
    
    // If there's a clear dominant convention (>50%) and inconsistencies
    if (dominantCount > total / 2 && dominantCount < total) {
      // Find functions that don't follow the dominant convention
      for (const func of functions) {
        let isConsistent = false;
        
        if (dominantConvention === 'camelCase') {
          isConsistent = camelCaseRegex.test(func.name);
        } else if (dominantConvention === 'PascalCase') {
          isConsistent = pascalCaseRegex.test(func.name);
        } else if (dominantConvention === 'snake_case') {
          isConsistent = snakeCaseRegex.test(func.name);
        }
        
        if (!isConsistent) {
          anomalies.push({
            type: 'NAMING_INCONSISTENCY',
            severity: 'LOW',
            description: `Function '${func.name}' doesn't follow the dominant naming convention (${dominantConvention})`,
            details: {
              functionName: func.name,
              convention: dominantConvention,
              position: func.startPosition
            }
          });
        }
      }
    }
    
    return anomalies;
  }
  
  /**
   * Detect unusual control flow patterns in code
   * @param {string} code - The code to analyze
   * @returns {Array<Object>} - Detected control flow anomalies
   */
  detectUnusualControlFlow(code) {
    if (!code || typeof code !== 'string') {
      return [];
    }
    
    const anomalies = [];
    
    // Extract all functions
    const functions = this.extractFunctions(code);
    
    for (const func of functions) {
      const body = func.body;
      
      // Check for excessive nested conditionals (more than 4 levels deep)
      let maxNestingLevel = 0;
      let currentNestingLevel = 0;
      
      for (let i = 0; i < body.length; i++) {
        if (body[i] === '{') {
          currentNestingLevel++;
          maxNestingLevel = Math.max(maxNestingLevel, currentNestingLevel);
        } else if (body[i] === '}') {
          currentNestingLevel = Math.max(0, currentNestingLevel - 1);
        }
      }
      
      if (maxNestingLevel > 4) {
        anomalies.push({
          type: 'EXCESSIVE_NESTING',
          severity: 'MEDIUM',
          description: `Function '${func.name}' has excessive nesting (${maxNestingLevel} levels)`,
          details: {
            functionName: func.name,
            nestingLevel: maxNestingLevel,
            position: func.startPosition
          }
        });
      }
      
      // Check for excessive complexity (too many conditional branches)
      const conditionalCount = (body.match(/if\s*\(/g) || []).length;
      
      if (conditionalCount > 10) {
        anomalies.push({
          type: 'EXCESSIVE_CONDITIONALS',
          severity: 'MEDIUM',
          description: `Function '${func.name}' has excessive conditionals (${conditionalCount} if statements)`,
          details: {
            functionName: func.name,
            conditionalCount,
            position: func.startPosition
          }
        });
      }
      
      // Check for unusual return patterns (early returns, multiple returns)
      const returnStatements = (body.match(/return\s+/g) || []).length;
      
      if (returnStatements > 5) {
        anomalies.push({
          type: 'MULTIPLE_RETURNS',
          severity: 'LOW',
          description: `Function '${func.name}' has multiple return statements (${returnStatements})`,
          details: {
            functionName: func.name,
            returnCount: returnStatements,
            position: func.startPosition
          }
        });
      }
    }
    
    return anomalies;
  }
  
  /**
   * Detect statistical outliers in performance or behavior data
   * @param {Array<number>} data - Array of numeric values to analyze
   * @param {Object} options - Analysis options
   * @returns {Array<Object>} - Detected outliers
   */
  detectStatisticalOutliers(data, options = {}) {
    if (!Array.isArray(data) || data.length < 5) {
      return [];
    }
    
    const anomalies = [];
    const threshold = options.threshold || 2.0; // Default: 2 standard deviations
    
    // Calculate mean
    const mean = data.reduce((sum, value) => sum + value, 0) / data.length;
    
    // Calculate standard deviation
    const squaredDifferences = data.map(value => Math.pow(value - mean, 2));
    const variance = squaredDifferences.reduce((sum, value) => sum + value, 0) / data.length;
    const stdDev = Math.sqrt(variance);
    
    // Identify outliers (values beyond threshold standard deviations from mean)
    const outliers = [];
    data.forEach((value, index) => {
      const zScore = Math.abs(value - mean) / stdDev;
      if (zScore > threshold) {
        outliers.push({
          index,
          value,
          zScore,
          distanceFromMean: value - mean
        });
      }
    });
    
    if (outliers.length > 0) {
      anomalies.push({
        type: 'STATISTICAL_OUTLIERS',
        severity: 'MEDIUM',
        description: `Found ${outliers.length} statistical outliers in the data`,
        details: {
          mean,
          standardDeviation: stdDev,
          thresholdUsed: threshold,
          outliers
        }
      });
    }
    
    return anomalies;
  }
  
  /**
   * Detect unusual error handling patterns in code
   * @param {string} code - The code to analyze
   * @returns {Array<Object>} - Detected error handling anomalies
   */
  detectUnusualErrorHandling(code) {
    if (!code || typeof code !== 'string') {
      return [];
    }
    
    const anomalies = [];
    const functions = this.extractFunctions(code);
    
    for (const func of functions) {
      const body = func.body;
      
      // Check for empty catch blocks
      const emptyCatchRegex = /catch\s*\([^)]*\)\s*{\s*}/g;
      const emptyCatchMatches = body.match(emptyCatchRegex) || [];
      
      if (emptyCatchMatches.length > 0) {
        anomalies.push({
          type: 'EMPTY_CATCH_BLOCK',
          severity: 'HIGH',
          description: `Function '${func.name}' contains ${emptyCatchMatches.length} empty catch block(s)`,
          details: {
            functionName: func.name,
            position: func.startPosition,
            count: emptyCatchMatches.length
          }
        });
      }
      
      // Check for inconsistent error types in try-catch blocks
      const catchClauseRegex = /catch\s*\(([^)]*)\)/g;
      const catchClauses = [];
      let match;
      
      while ((match = catchClauseRegex.exec(body)) !== null) {
        catchClauses.push({
          errorVar: match[1].trim(),
          position: func.startPosition + match.index
        });
      }
      
      // Check for swallowed errors (caught but not handled)
      const errorSwallowingRegex = /catch\s*\(([^)]*)\)\s*{\s*(?!throw|return|console|log)[^}]*}/g;
      const swallowedErrors = body.match(errorSwallowingRegex) || [];
      
      if (swallowedErrors.length > 0) {
        anomalies.push({
          type: 'SWALLOWED_ERROR',
          severity: 'MEDIUM',
          description: `Function '${func.name}' appears to catch and swallow errors without proper handling`,
          details: {
            functionName: func.name,
            position: func.startPosition,
            count: swallowedErrors.length
          }
        });
      }
      
      // Check for overly generic error handling
      const genericCatchRegex = /catch\s*\((?:err|error|e)\s*\)\s*{\s*.*?console\.(?:log|error|warn)/g;
      const genericCatches = body.match(genericCatchRegex) || [];
      
      if (genericCatches.length > 0) {
        anomalies.push({
          type: 'GENERIC_ERROR_HANDLING',
          severity: 'LOW',
          description: `Function '${func.name}' uses generic error handling without specific error types`,
          details: {
            functionName: func.name,
            position: func.startPosition,
            count: genericCatches.length
          }
        });
      }
      
      // Check for inconsistent error propagation
      const errorRethrowPatterns = [
        /catch\s*\([^)]*\)\s*{\s*.*?throw\s+new\s+\w+Error/g, // throw new CustomError
        /catch\s*\([^)]*\)\s*{\s*.*?throw\s+err/g,             // throw original error
        /catch\s*\([^)]*\)\s*{\s*.*?throw\s+new\s+Error/g      // throw new generic Error
      ];
      
      let errorPropagationStyles = 0;
      let hasRethrows = false;
      
      for (const pattern of errorRethrowPatterns) {
        const matches = body.match(pattern) || [];
        if (matches.length > 0) {
          errorPropagationStyles++;
          hasRethrows = true;
        }
      }
      
      // Also check for error returns
      const errorReturnPattern = /catch\s*\([^)]*\)\s*{\s*.*?return\s+.*?(?:err|error)/g;
      const errorReturns = body.match(errorReturnPattern) || [];
      
      if (errorReturns.length > 0) {
        errorPropagationStyles++;
      }
      
      // If we have multiple error propagation styles in the same function
      if (errorPropagationStyles > 1) {
        anomalies.push({
          type: 'INCONSISTENT_ERROR_PROPAGATION',
          severity: 'MEDIUM',
          description: `Function '${func.name}' uses inconsistent error propagation styles`,
          details: {
            functionName: func.name,
            position: func.startPosition,
            stylesCount: errorPropagationStyles
          }
        });
      }
      
      // Check for missing try-catch in critical operations
      const criticalOperations = [
        /verify\w*\(/g,
        /sign\w*\(/g,
        /encod\w*\(/g,
        /decod\w*\(/g,
        /encrypt\w*\(/g,
        /decrypt\w*\(/g,
        /hash\w*\(/g,
        /generat\w*Key\w*\(/g,
        /initiz\w*\(/g,
        /zkp\w*\(/g
      ];
      
      let hasCriticalOps = false;
      for (const pattern of criticalOperations) {
        if (pattern.test(body)) {
          hasCriticalOps = true;
          break;
        }
      }
      
      const hasTryCatch = /try\s*{/.test(body);
      
      if (hasCriticalOps && !hasTryCatch && func.body.length > 100) {
        // Only flag larger functions with critical operations and no try-catch
        anomalies.push({
          type: 'MISSING_ERROR_HANDLING',
          severity: 'MEDIUM',
          description: `Function '${func.name}' performs critical operations without try-catch error handling`,
          details: {
            functionName: func.name,
            position: func.startPosition,
            length: func.body.length
          }
        });
      }
    }
    
    return anomalies;
  }
  
  /**
   * Detect security bypass flags or debug switches in code
   * @param {string} code - The code to analyze
   * @returns {Array<Object>} - Detected bypass flags
   */
  detectBypassFlags(code) {
    if (!code || typeof code !== 'string') {
      return [];
    }
    
    const anomalies = [];
    
    // Check for security bypass flags
    const bypassPatterns = [
      { 
        pattern: /(?:const|let|var)\s+(?:SKIP|BYPASS|DISABLE)_(?:VERIFICATION|VALIDATION|CHECKS|SECURITY|AUTH)/i,
        type: 'SECURITY_BYPASS_FLAG',
        severity: 'CRITICAL'
      },
      { 
        pattern: /(?:const|let|var)\s+(?:is|enable|disable)(?:Dev|Debug|TestMode|SkipAuth|NoVerify)/i,
        type: 'DEVELOPMENT_FLAG',
        severity: 'HIGH'
      },
      { 
        pattern: /if\s*\(\s*(?:process\.env\.NODE_ENV\s*(?:!==?|==)\s*['"](?:development|test)['"]\s*(?:&&|\|\|)\s*)?(?:!require|skip|bypass|ignoreAuth|disableSecurity|noVerify)/i,
        type: 'CONDITIONAL_SECURITY_BYPASS',
        severity: 'CRITICAL'
      },
      { 
        pattern: /\/\/\s*(?:TODO|FIXME|HACK|XXX).*(?:security|auth|verify|validate|check)/i,
        type: 'SECURITY_TODO',
        severity: 'MEDIUM'
      },
      {
        pattern: /\/\/\s*temporary\s*(?:disable|bypass|skip)/i,
        type: 'TEMPORARY_BYPASS',
        severity: 'HIGH'
      }
    ];
    
    // Extract all bypass flags
    for (const bypass of bypassPatterns) {
      let match;
      const regex = new RegExp(bypass.pattern, 'g');
      
      while ((match = regex.exec(code)) !== null) {
        const lineNumber = code.substring(0, match.index).split('\n').length;
        const matchedText = match[0];
        
        // Get the surrounding code for context (3 lines before and after)
        const codeLines = code.split('\n');
        const startLine = Math.max(0, lineNumber - 4);
        const endLine = Math.min(codeLines.length - 1, lineNumber + 2);
        const contextLines = codeLines.slice(startLine, endLine + 1);
        
        anomalies.push({
          type: bypass.type,
          severity: bypass.severity,
          description: `Potential security bypass flag detected: "${matchedText.trim()}"`,
          details: {
            match: matchedText,
            lineNumber,
            context: contextLines.join('\n'),
            recommendation: this._getBypassRecommendation(bypass.type)
          }
        });
      }
    }
    
    // Check for debug mode configuration
    const debugModePatterns = [
      /config\.debug\s*=\s*true/i,
      /options\.(?:debug|dev|development|testMode)\s*=\s*true/i,
      /process\.env\.DEBUG\s*=\s*(?:true|1|'true')/i,
      /process\.env\.NODE_ENV\s*=\s*(?:'development'|"development"|'test'|"test")/i
    ];
    
    for (const pattern of debugModePatterns) {
      const matches = code.match(pattern) || [];
      
      for (const match of matches) {
        const lineNumber = code.substring(0, code.indexOf(match)).split('\n').length;
        
        // Get the surrounding code for context
        const codeLines = code.split('\n');
        const startLine = Math.max(0, lineNumber - 4);
        const endLine = Math.min(codeLines.length - 1, lineNumber + 2);
        const contextLines = codeLines.slice(startLine, endLine + 1);
        
        anomalies.push({
          type: 'DEBUG_MODE_ENABLED',
          severity: 'HIGH',
          description: `Debug mode enabled in production code: "${match.trim()}"`,
          details: {
            match,
            lineNumber,
            context: contextLines.join('\n'),
            recommendation: "Ensure debug flags are only enabled in development environments and are properly guarded with environment checks"
          }
        });
      }
    }
    
    // Look for commented-out security checks
    const commentedSecurityPatterns = [
      /\/\/\s*(?:if\s*\(\s*!\w+\.verify|validateToken|checkPermission|authenticate|authorize)/i,
      /\/\*\s*(?:if\s*\(\s*!\w+\.verify|validateToken|checkPermission|authenticate|authorize)[\s\S]*?\*\//i
    ];
    
    for (const pattern of commentedSecurityPatterns) {
      const matches = code.match(pattern) || [];
      
      for (const match of matches) {
        const lineNumber = code.substring(0, code.indexOf(match)).split('\n').length;
        
        anomalies.push({
          type: 'COMMENTED_SECURITY_CHECK',
          severity: 'CRITICAL',
          description: `Commented-out security check detected`,
          details: {
            match: match.substring(0, 100) + (match.length > 100 ? '...' : ''),
            lineNumber,
            recommendation: "Verify why this security check was commented out and restore it if needed"
          }
        });
      }
    }
    
    return anomalies;
  }
  
  /**
   * Get recommendation for fixing bypass flags
   * @private
   * @param {string} bypassType - The type of bypass flag
   * @returns {string} - Recommendation for fixing
   */
  _getBypassRecommendation(bypassType) {
    switch (bypassType) {
      case 'SECURITY_BYPASS_FLAG':
        return "Remove this bypass flag or ensure it's only enabled in test environments with proper environment checks";
      case 'DEVELOPMENT_FLAG':
        return "Ensure this development flag is properly guarded with environment checks and never enabled in production";
      case 'CONDITIONAL_SECURITY_BYPASS':
        return "Review this conditional security bypass and ensure proper validation is in place";
      case 'SECURITY_TODO':
        return "Address this security-related TODO comment to ensure proper security implementation";
      case 'TEMPORARY_BYPASS':
        return "Remove this temporary bypass or implement proper security checks";
      default:
        return "Remove or properly secure this potential security issue";
    }
  }

  /**
   * Detect anomalies based on history and current data
   * @param {Object} currentData - Current operation data
   * @returns {Array<Object>} - Detected anomalies
   */
  detect(currentData = {}) {
    const anomalies = [];
    
    // Skip detection if history is empty
    if (this.history.length === 0) {
      return anomalies;
    }
    
    // Add current event to history if provided
    if (Object.keys(currentData).length > 0) {
      this.addEvent(currentData);
    }
    
    // Detect timing anomalies
    const timingAnomalies = this._detectTimingAnomalies();
    if (timingAnomalies.length > 0) {
      anomalies.push(...timingAnomalies);
    }
    
    // Detect proof size anomalies
    const sizeAnomalies = this._detectSizeAnomalies();
    if (sizeAnomalies.length > 0) {
      anomalies.push(...sizeAnomalies);
    }
    
    // Detect failure rate anomalies
    const failureAnomalies = this._detectFailureRateAnomalies();
    if (failureAnomalies.length > 0) {
      anomalies.push(...failureAnomalies);
    }
    
    return anomalies;
  }

  /**
   * Detect timing anomalies
   * @private
   * @returns {Array<Object>} - Detected timing anomalies
   */
  _detectTimingAnomalies() {
    const anomalies = [];
    
    // Need at least 2 events to detect timing anomalies
    if (this.history.length < 2) {
      return anomalies;
    }
    
    // Get proof generation events
    const proofEvents = this.history.filter(event => 
      event.type === 'generate_proof' || event.type === 'proof_generated'
    ).sort((a, b) => a.timestamp - b.timestamp);
    
    // Check for abnormal timing between proof generations
    for (let i = 1; i < proofEvents.length; i++) {
      const prev = proofEvents[i - 1];
      const curr = proofEvents[i];
      
      const timeDiff = curr.timestamp - prev.timestamp;
      
      // Check if time difference is suspiciously small
      if (timeDiff < 100 && prev.userId === curr.userId) {
        anomalies.push({
          type: 'TIMING_ANOMALY',
          subType: 'RAPID_PROOF_GENERATION',
          severity: 'MEDIUM',
          description: 'Suspiciously rapid proof generation',
          details: {
            userId: curr.userId,
            timeDiff,
            threshold: 100,
            prevTimestamp: prev.timestamp,
            currTimestamp: curr.timestamp
          }
        });
      }
      
      // Check if time difference is suspiciously large
      if (timeDiff > this.thresholds.timeDiffMax && prev.userId === curr.userId) {
        anomalies.push({
          type: 'TIMING_ANOMALY',
          subType: 'DELAYED_PROOF_GENERATION',
          severity: 'LOW',
          description: 'Unusually delayed proof generation',
          details: {
            userId: curr.userId,
            timeDiff,
            threshold: this.thresholds.timeDiffMax,
            prevTimestamp: prev.timestamp,
            currTimestamp: curr.timestamp
          }
        });
      }
    }
    
    return anomalies;
  }

  /**
   * Detect proof size anomalies
   * @private
   * @returns {Array<Object>} - Detected size anomalies
   */
  _detectSizeAnomalies() {
    const anomalies = [];
    
    // Get proof generated events with size information
    const proofEvents = this.history.filter(event => 
      event.type === 'proof_generated' && typeof event.proofSize === 'number'
    );
    
    // Check for abnormal proof sizes
    for (const event of proofEvents) {
      // Check if proof is suspiciously large
      if (event.proofSize > this.thresholds.proofSizeMax) {
        anomalies.push({
          type: 'SIZE_ANOMALY',
          subType: 'OVERSIZED_PROOF',
          severity: 'HIGH',
          description: 'Suspiciously large proof size',
          details: {
            userId: event.userId,
            proofSize: event.proofSize,
            threshold: this.thresholds.proofSizeMax,
            timestamp: event.timestamp
          }
        });
      }
      
      // Check if proof is suspiciously small
      if (event.proofSize < this.thresholds.proofSizeMin) {
        anomalies.push({
          type: 'SIZE_ANOMALY',
          subType: 'UNDERSIZED_PROOF',
          severity: 'HIGH',
          description: 'Suspiciously small proof size',
          details: {
            userId: event.userId,
            proofSize: event.proofSize,
            threshold: this.thresholds.proofSizeMin,
            timestamp: event.timestamp
          }
        });
      }
    }
    
    return anomalies;
  }

  /**
   * Detect failure rate anomalies
   * @private
   * @returns {Array<Object>} - Detected failure rate anomalies
   */
  _detectFailureRateAnomalies() {
    const anomalies = [];
    
    // Get verification events
    const verifyEvents = this.history.filter(event => 
      event.type === 'verify_proof'
    );
    
    if (verifyEvents.length === 0) {
      return anomalies;
    }
    
    // Calculate failure rate per user
    const userStats = {};
    
    for (const event of verifyEvents) {
      const userId = event.userId || 'unknown';
      
      if (!userStats[userId]) {
        userStats[userId] = { total: 0, failures: 0 };
      }
      
      userStats[userId].total++;
      
      if (event.success === false) {
        userStats[userId].failures++;
      }
    }
    
    // Check for high failure rates
    for (const userId in userStats) {
      const stats = userStats[userId];
      
      if (stats.total < 5) {
        // Skip users with too few attempts
        continue;
      }
      
      const failureRate = stats.failures / stats.total;
      
      if (failureRate > this.thresholds.failureRateMax) {
        anomalies.push({
          type: 'FAILURE_RATE_ANOMALY',
          severity: 'HIGH',
          description: 'Abnormally high proof verification failure rate',
          details: {
            userId,
            failureRate,
            threshold: this.thresholds.failureRateMax,
            total: stats.total,
            failures: stats.failures
          }
        });
      }
    }
    
    return anomalies;
  }

  /**
   * Clear the detector history
   */
  clearHistory() {
    this.history = [];
  }

  /**
   * Get detector metadata
   * @returns {Object} - Detector metadata
   */
  getMetadata() {
    return {
      type: this.type,
      enabled: this.enabled,
      historySize: this.history.length,
      thresholds: this.thresholds
    };
  }
}

/**
 * Create and return a new AnomalyDetector instance
 * @param {Object} options - Detector configuration options
 * @returns {AnomalyDetector} - New detector instance
 */
function createAnomalyDetector(options = {}) {
  return new AnomalyDetector(options);
}

// Export for CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AnomalyDetector,
    createAnomalyDetector
  };
}
