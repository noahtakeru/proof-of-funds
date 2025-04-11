#!/usr/bin/env node

/**
 * Enhanced Regression Test Runner
 * 
 * This script runs comprehensive validation checks on the codebase to ensure
 * adherence to coding standards, module patterns, and implementation requirements.
 * It validates actual functionality rather than just checking for file existence.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { 
  MODULE_PATTERNS, 
  ERROR_PATTERNS, 
  STANDARD_PATTERNS,
  TEST_CATEGORIES,
  REQUIRED_FILES,
  KNOWN_ISSUES,
  EXCLUDE_PATHS,
  validators
} = require('./config');

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Get project root directory
const projectRoot = path.resolve(__dirname, '../../');

// Results storage
const results = {
  startTime: new Date(),
  endTime: null,
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    warnings: 0
  },
  categories: Object.fromEntries(
    Object.values(TEST_CATEGORIES).map(category => [
      category, 
      { total: 0, passed: 0, failed: 0, warnings: 0 }
    ])
  ),
  fileResults: [],
  issuesFound: []
};

// Utility functions
function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function log(message, color = 'white') {
  console.log(colorize(message, color));
}

function findFiles(dir, pattern, exclude = []) {
  const files = [];
  
  function traverse(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(projectRoot, fullPath);
      
      // Skip excluded paths
      if (exclude.some(excl => relativePath.includes(excl))) {
        continue;
      }
      
      if (entry.isDirectory()) {
        traverse(fullPath);
      } else if (pattern.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

function validateFile(filePath, requirements = null) {
  const relativePath = path.relative(projectRoot, filePath);
  let content;
  
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return {
      path: relativePath,
      exists: false,
      issues: [{
        type: 'file_not_found',
        description: 'File does not exist or cannot be read',
        severity: 'error'
      }]
    };
  }
  
  // File exists and can be read
  const result = {
    path: relativePath,
    exists: true,
    size: content.length,
    issues: []
  };
  
  // Check against specific requirements if provided
  if (requirements) {
    requirements.patterns?.forEach(pattern => {
      if (!pattern.test(content)) {
        result.issues.push({
          type: 'pattern_not_found',
          description: `Required pattern not found: ${pattern}`,
          severity: 'error'
        });
      }
    });
  }
  
  // Run general validators based on file type
  if (filePath.endsWith('.js') || filePath.endsWith('.mjs') || filePath.endsWith('.cjs')) {
    result.issues.push(...validators.validateModuleFormat(content, filePath));
    result.issues.push(...validators.validateErrorHandling(content, filePath));
  }
  
  // Run documentation validators on all files
  result.issues.push(...validators.validateDocumentation(content, filePath));
  
  return result;
}

function runTest(name, category, callback) {
  log(`\nRunning test: ${name}`, 'cyan');
  results.summary.total++;
  results.categories[category].total++;
  
  try {
    const testResult = callback();
    
    if (testResult.success) {
      log(`✓ PASS: ${name}`, 'green');
      results.summary.passed++;
      results.categories[category].passed++;
    } else {
      log(`✗ FAIL: ${name}`, 'red');
      log(`  Reason: ${testResult.reason}`, 'red');
      results.summary.failed++;
      results.categories[category].failed++;
      results.issuesFound.push({
        test: name,
        category,
        reason: testResult.reason,
        details: testResult.details
      });
    }
    
    // Track warnings separately
    if (testResult.warnings && testResult.warnings.length > 0) {
      testResult.warnings.forEach(warning => {
        log(`! WARNING: ${warning}`, 'yellow');
      });
      results.summary.warnings += testResult.warnings.length;
      results.categories[category].warnings += testResult.warnings.length;
    }
    
    return testResult;
  } catch (error) {
    log(`✗ ERROR: ${name} - ${error.message}`, 'red');
    results.summary.failed++;
    results.categories[category].failed++;
    results.issuesFound.push({
      test: name,
      category,
      reason: `Test execution error: ${error.message}`,
      details: error.stack
    });
    
    return {
      success: false,
      reason: `Test execution error: ${error.message}`,
      details: error.stack
    };
  }
}

// Tests implementation
function testRequiredFiles() {
  log('\n=== Testing Required Files ===', 'blue');
  
  let allFilesExist = true;
  const issues = [];
  const warnings = [];
  
  REQUIRED_FILES.forEach(requiredFile => {
    const filePath = path.join(projectRoot, requiredFile.path);
    const result = validateFile(filePath, requiredFile);
    results.fileResults.push(result);
    
    if (!result.exists) {
      allFilesExist = false;
      issues.push(`Required file not found: ${requiredFile.path}`);
    } else if (result.issues.some(issue => issue.severity === 'error')) {
      allFilesExist = false;
      const errorIssues = result.issues.filter(issue => issue.severity === 'error');
      errorIssues.forEach(issue => {
        issues.push(`${requiredFile.path}: ${issue.description}`);
      });
    }
    
    // Collect warnings
    const warningIssues = result.issues.filter(issue => issue.severity === 'warning');
    warningIssues.forEach(issue => {
      warnings.push(`${requiredFile.path}: ${issue.description}`);
    });
  });
  
  return {
    success: allFilesExist,
    reason: allFilesExist ? 'All required files exist and pass validation' : 'Some required files are missing or invalid',
    details: issues,
    warnings
  };
}

function testModuleSystemConsistency() {
  log('\n=== Testing Module System Consistency ===', 'blue');
  
  const jsFiles = findFiles(
    path.join(projectRoot, 'src'), 
    /\.(js|mjs|cjs)$/, 
    EXCLUDE_PATHS
  );
  
  let consistent = true;
  const issues = [];
  const warnings = [];
  
  // Count module pattern occurrences
  const stats = {
    esmExport: 0,
    cjsExport: 0,
    mixed: 0,
    dualFormat: 0
  };
  
  jsFiles.forEach(file => {
    const result = validateFile(file);
    results.fileResults.push(result);
    
    if (result.issues.some(issue => 
        issue.type === 'mixed_export_formats' || 
        issue.type === 'mixed_import_formats')) {
      
      consistent = false;
      
      const mixedIssues = result.issues.filter(issue => 
        issue.type === 'mixed_export_formats' || 
        issue.type === 'mixed_import_formats'
      );
      
      mixedIssues.forEach(issue => {
        issues.push(`${result.path}: ${issue.description}`);
      });
      
      stats.mixed++;
    }
    
    // Track format stats
    const content = fs.readFileSync(file, 'utf8');
    if (MODULE_PATTERNS.ESM_EXPORT.test(content)) stats.esmExport++;
    if (MODULE_PATTERNS.CJS_EXPORT.test(content)) stats.cjsExport++;
    if (MODULE_PATTERNS.DUAL_FORMAT.test(content)) stats.dualFormat++;
    
    // Collect warnings
    const warningIssues = result.issues.filter(issue => issue.severity === 'warning');
    warningIssues.forEach(issue => {
      warnings.push(`${result.path}: ${issue.description}`);
    });
  });
  
  return {
    success: consistent,
    reason: consistent ? 'Module system is consistent' : 'Mixed module formats detected',
    details: {
      issues,
      stats: {
        totalFiles: jsFiles.length,
        esmExportCount: stats.esmExport,
        cjsExportCount: stats.cjsExport,
        mixedFormatCount: stats.mixed,
        dualFormatCount: stats.dualFormat
      }
    },
    warnings
  };
}

function testErrorHandlingConsistency() {
  log('\n=== Testing Error Handling Consistency ===', 'blue');
  
  const jsFiles = findFiles(
    path.join(projectRoot, 'src'), 
    /\.(js|mjs|cjs)$/, 
    [...EXCLUDE_PATHS, 'test', 'mock']
  );
  
  let consistent = true;
  const issues = [];
  const warnings = [];
  
  // Count error handling pattern occurrences
  const stats = {
    tryCatch: 0,
    customErrors: 0,
    errorLogging: 0,
    genericErrors: 0
  };
  
  jsFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const relativePath = path.relative(projectRoot, file);
    
    // Skip test files
    if (relativePath.includes('test') || relativePath.includes('mock')) {
      return;
    }
    
    // Track stats
    if (ERROR_PATTERNS.TRY_CATCH.test(content)) stats.tryCatch++;
    if (ERROR_PATTERNS.ERROR_CLASS.test(content)) stats.customErrors++;
    if (ERROR_PATTERNS.ERROR_LOG.test(content)) stats.errorLogging++;
    if (content.includes('throw new Error(')) stats.genericErrors++;
    
    // Check for inconsistencies
    if (ERROR_PATTERNS.TRY_CATCH.test(content) && !ERROR_PATTERNS.ERROR_LOG.test(content)) {
      warnings.push(`${relativePath}: Try/catch without error logging`);
    }
    
    if (content.includes('throw new Error(') && !ERROR_PATTERNS.THROW_ERROR.test(content)) {
      warnings.push(`${relativePath}: Generic errors used instead of custom error classes`);
    }
  });
  
  // Check if zkErrorHandler.js exists and has required components
  const errorHandlerPath = path.join(projectRoot, 'src', 'zkErrorHandler.js');
  if (fs.existsSync(errorHandlerPath)) {
    const content = fs.readFileSync(errorHandlerPath, 'utf8');
    
    if (!content.includes('class ZKError extends Error')) {
      consistent = false;
      issues.push('zkErrorHandler.js missing ZKError base class');
    }
    
    if (!content.match(/class \w+Error extends (?:ZK)?Error/g)) {
      consistent = false;
      issues.push('zkErrorHandler.js missing specific error subclasses');
    }
  } else {
    consistent = false;
    issues.push('zkErrorHandler.js not found');
  }
  
  return {
    success: consistent,
    reason: consistent ? 'Error handling is consistent' : 'Error handling inconsistencies detected',
    details: {
      issues,
      stats: {
        tryCatchCount: stats.tryCatch,
        customErrorsCount: stats.customErrors,
        errorLoggingCount: stats.errorLogging,
        genericErrorsCount: stats.genericErrors
      }
    },
    warnings
  };
}

function testDocumentationCoverage() {
  log('\n=== Testing Documentation Coverage ===', 'blue');
  
  // Check for required documentation files
  const requiredDocs = [
    'MODULE_SYSTEM.md',
    'ARCHITECTURE.md',
    'TESTING_STRATEGY.md'
  ];
  
  const missingDocs = [];
  
  requiredDocs.forEach(doc => {
    const docPath = path.join(projectRoot, 'docs', doc);
    if (!fs.existsSync(docPath)) {
      missingDocs.push(doc);
    }
  });
  
  // Check for JSDoc coverage in source files
  const jsFiles = findFiles(
    path.join(projectRoot, 'src'), 
    /\.(js|mjs|cjs)$/, 
    [...EXCLUDE_PATHS, 'test', 'mock']
  );
  
  let totalExports = 0;
  let documentedExports = 0;
  const undocumentedFiles = [];
  
  jsFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const relativePath = path.relative(projectRoot, file);
    
    // Count exports
    const exports = content.match(STANDARD_PATTERNS.NAMED_EXPORTS) || [];
    const jsdocs = content.match(/\/\*\*[\s\S]*?\*\/\s*export/g) || [];
    
    totalExports += exports.length;
    documentedExports += jsdocs.length;
    
    if (exports.length > 0 && jsdocs.length < exports.length) {
      undocumentedFiles.push({
        file: relativePath,
        exported: exports.length,
        documented: jsdocs.length
      });
    }
  });
  
  const jsdocCoverage = totalExports > 0 ? (documentedExports / totalExports) * 100 : 100;
  const success = missingDocs.length === 0 && jsdocCoverage >= 80;
  
  return {
    success,
    reason: success 
      ? 'Documentation coverage is sufficient' 
      : `Documentation issues found: ${missingDocs.length > 0 ? 'Missing docs' : ''} ${jsdocCoverage < 80 ? 'Low JSDoc coverage' : ''}`.trim(),
    details: {
      missingDocs,
      jsdocCoverage: `${jsdocCoverage.toFixed(2)}%`,
      totalExports,
      documentedExports,
      undocumentedFiles
    },
    warnings: undocumentedFiles.map(f => `${f.file}: Undocumented exports (${f.documented}/${f.exported})`)
  };
}

function testCircuitImplementation() {
  log('\n=== Testing Circuit Implementation ===', 'blue');
  
  // Check for placeholder code in circuits
  const circuitFiles = [
    'standardProof.circom',
    'thresholdProof.circom',
    'maximumProof.circom'
  ];
  
  const placeholderPatterns = [
    /signatureValid <== 1/,
    /ownershipVerified <== 1/
  ];
  
  const realImplementationPatterns = [
    /component signatureCheck = IsEqual\(\)/,
    /signatureCheck\.in\[0\] <== secretHasher\.out/,
    /signatureCheck\.in\[1\] <== addressDerivedValue\.out/
  ];
  
  const circuitIssues = [];
  const circuitWarnings = [];
  
  circuitFiles.forEach(circuitFile => {
    const filePath = path.join(projectRoot, 'circuits', circuitFile);
    
    if (!fs.existsSync(filePath)) {
      circuitIssues.push(`Circuit file not found: ${circuitFile}`);
      return;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check for placeholder patterns
    placeholderPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        circuitIssues.push(`Placeholder code found in ${circuitFile}: ${pattern}`);
      }
    });
    
    // Check for real implementation patterns
    let implementationFound = false;
    realImplementationPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        implementationFound = true;
      }
    });
    
    if (!implementationFound) {
      circuitIssues.push(`Real implementation not found in ${circuitFile}`);
    }
  });
  
  // Check GasManager for CoinGecko API integration
  const gasManagerPath = path.join(projectRoot, 'src', 'GasManager.js');
  let gasManagerIssue = null;
  
  if (fs.existsSync(gasManagerPath)) {
    const content = fs.readFileSync(gasManagerPath, 'utf8');
    
    if (!content.includes('fetchPricesForSymbols') || 
        !content.includes('walletHelpers') ||
        content.includes('return 2200; // Mock ETH price in USD')) {
      gasManagerIssue = 'GasManager.js is not using CoinGecko API integration';
    }
  } else {
    gasManagerIssue = 'GasManager.js not found';
  }
  
  if (gasManagerIssue) {
    circuitIssues.push(gasManagerIssue);
  }
  
  return {
    success: circuitIssues.length === 0,
    reason: circuitIssues.length === 0 
      ? 'All circuits use real implementations' 
      : 'Placeholder code or missing implementations found',
    details: circuitIssues,
    warnings: circuitWarnings
  };
}

// Run all tests
function runAllTests() {
  log('Starting Enhanced Regression Tests', 'blue');
  log(`Project root: ${projectRoot}`, 'blue');
  log(`Time: ${new Date().toISOString()}`, 'blue');
  
  // Run tests
  const requiredFilesResult = runTest(
    'Required Files Validation', 
    TEST_CATEGORIES.API_CONSISTENCY, 
    testRequiredFiles
  );
  
  const moduleSystemResult = runTest(
    'Module System Consistency', 
    TEST_CATEGORIES.MODULE_SYSTEM, 
    testModuleSystemConsistency
  );
  
  const errorHandlingResult = runTest(
    'Error Handling Consistency', 
    TEST_CATEGORIES.ERROR_HANDLING, 
    testErrorHandlingConsistency
  );
  
  const documentationResult = runTest(
    'Documentation Coverage', 
    TEST_CATEGORIES.DOCUMENTATION, 
    testDocumentationCoverage
  );
  
  const circuitImplementationResult = runTest(
    'Circuit Implementation', 
    TEST_CATEGORIES.API_CONSISTENCY, 
    testCircuitImplementation
  );
  
  // Generate report
  results.endTime = new Date();
  generateReport();
}

// Generate test report
function generateReport() {
  const duration = (results.endTime - results.startTime) / 1000;
  
  log('\n=== Regression Test Report ===', 'blue');
  log(`Execution time: ${duration.toFixed(2)} seconds`, 'white');
  log(`Start: ${results.startTime.toISOString()}`, 'white');
  log(`End: ${results.endTime.toISOString()}`, 'white');
  
  // Summary table
  log('\nOverall Results:', 'blue');
  log(`Total: ${results.summary.total}`, 'white');
  log(`Passed: ${results.summary.passed}`, results.summary.passed === results.summary.total ? 'green' : 'white');
  log(`Failed: ${results.summary.failed}`, results.summary.failed > 0 ? 'red' : 'white');
  log(`Warnings: ${results.summary.warnings}`, results.summary.warnings > 0 ? 'yellow' : 'white');
  
  // Category breakdown
  log('\nResults by Category:', 'blue');
  Object.entries(results.categories).forEach(([category, stats]) => {
    if (stats.total > 0) {
      const passRate = stats.passed / stats.total * 100;
      const color = passRate === 100 ? 'green' : passRate >= 80 ? 'yellow' : 'red';
      log(`${category}: ${stats.passed}/${stats.total} (${passRate.toFixed(0)}%)`, color);
    }
  });
  
  // Issues found
  if (results.issuesFound.length > 0) {
    log('\nIssues Found:', 'red');
    results.issuesFound.forEach((issue, index) => {
      log(`${index + 1}. ${issue.test}: ${issue.reason}`, 'red');
      
      if (Array.isArray(issue.details)) {
        issue.details.forEach(detail => {
          log(`   - ${detail}`, 'white');
        });
      } else if (issue.details && typeof issue.details === 'object') {
        Object.entries(issue.details).forEach(([key, value]) => {
          if (key !== 'issues' && key !== 'stats') {
            log(`   - ${key}: ${value}`, 'white');
          }
        });
        
        if (issue.details.issues && issue.details.issues.length > 0) {
          log('   Issues:', 'white');
          issue.details.issues.forEach(detail => {
            log(`     - ${detail}`, 'white');
          });
        }
      }
    });
  }
  
  // Save results to a file
  const reportPath = path.join(projectRoot, 'tests', 'regression', 'reports');
  if (!fs.existsSync(reportPath)) {
    fs.mkdirSync(reportPath, { recursive: true });
  }
  
  const timestamp = results.startTime.toISOString().replace(/[:.]/g, '-');
  const reportFile = path.join(reportPath, `regression-report-${timestamp}.json`);
  fs.writeFileSync(reportFile, JSON.stringify(results, null, 2));
  
  log(`\nDetailed report saved to: ${reportFile}`, 'blue');
  
  // Exit with appropriate code
  if (results.summary.failed > 0) {
    log('❌ Regression tests failed', 'red');
    process.exit(1);
  } else {
    log('✅ Regression tests passed', 'green');
    process.exit(0);
  }
}

// Execute all tests
runAllTests();