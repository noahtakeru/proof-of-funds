/**
 * Regression Test Configuration
 * 
 * This module provides configuration and utility functions for regression tests,
 * ensuring consistent test execution across different environments.
 */

// Define baseline module patterns to check for consistency
const MODULE_PATTERNS = {
  ESM_EXPORT: /export\s+(?:const|let|var|function|class|default|{)/,
  ESM_IMPORT: /import\s+(?:.+)\s+from/,
  CJS_EXPORT: /(?:module\.exports|exports\.\w+)\s*=/,
  CJS_REQUIRE: /(?:const|let|var)\s+\w+\s*=\s*require\(/,
  DYNAMIC_IMPORT: /(?:await\s+)?import\(/,
  DUAL_FORMAT: /\/\*\s*#\s*ESM\s*\*\/|\/\/\s*@ts-expect-error/
};

// Define paths that should be excluded from module pattern checks
const EXCLUDE_PATHS = [
  'node_modules',
  'dist',
  '.git',
  'coverage',
  'build',
  'rollup.config.js',
  'cjs'  // Exclude CJS compatibility layer from pattern checks
];

// Define error patterns to check for consistent error handling
const ERROR_PATTERNS = {
  ERROR_CLASS: /extends\s+(?:\w+Error|Error)/,
  TRY_CATCH: /try\s*{[\s\S]*?}\s*catch\s*\(\w+\)\s*{/,
  THROW_ERROR: /throw\s+new\s+\w+Error/,
  ERROR_LOG: /(?:logError|zkErrorLogger\.log)/
};

// Define common import/export patterns to standardize
const STANDARD_PATTERNS = {
  NAMED_EXPORTS: /export\s+(?:const|let|var|function|class)\s+(\w+)/g,
  DEFAULT_EXPORT: /export\s+default\s+(?:{[\s\S]*?}|\w+)/,
  NAMED_IMPORTS: /import\s+{[^}]*}\s+from/,
  NAMESPACE_IMPORT: /import\s+\*\s+as\s+\w+\s+from/,
  DEFAULT_IMPORT: /import\s+\w+\s+from/
};

// Test categories for reporting
const TEST_CATEGORIES = {
  MODULE_SYSTEM: 'module_system',
  ERROR_HANDLING: 'error_handling',
  SECURITY: 'security',
  PERFORMANCE: 'performance',
  API_CONSISTENCY: 'api_consistency',
  DOCUMENTATION: 'documentation'
};

// Required files that must exist and pass validation
const REQUIRED_FILES = [
  {
    path: 'src/index.mjs',
    category: TEST_CATEGORIES.API_CONSISTENCY,
    patterns: [MODULE_PATTERNS.ESM_EXPORT],
    description: 'Main entry point with ESM exports'
  },
  {
    path: 'src/zkErrorHandler.mjs',
    category: TEST_CATEGORIES.ERROR_HANDLING,
    patterns: [ERROR_PATTERNS.ERROR_CLASS],
    description: 'Error handling system with error classes'
  },
  {
    path: 'src/zkUtils.mjs',
    category: TEST_CATEGORIES.MODULE_SYSTEM,
    patterns: [MODULE_PATTERNS.ESM_EXPORT],
    description: 'Utility functions with ESM exports'
  },
  {
    path: 'src/zkProofSerializer.mjs',
    category: TEST_CATEGORIES.API_CONSISTENCY,
    patterns: [STANDARD_PATTERNS.NAMED_EXPORTS],
    description: 'Proof serialization with named exports'
  },
  {
    path: 'cjs/index.cjs',
    category: TEST_CATEGORIES.MODULE_SYSTEM,
    patterns: [MODULE_PATTERNS.CJS_EXPORT],
    description: 'CommonJS compatibility entry point'
  },
  {
    path: 'cjs/zkErrorHandler.cjs',
    category: TEST_CATEGORIES.MODULE_SYSTEM,
    patterns: [MODULE_PATTERNS.CJS_EXPORT],
    description: 'CommonJS error handling module'
  },
  {
    path: 'docs/MODULE_SYSTEM.md',
    category: TEST_CATEGORIES.DOCUMENTATION,
    description: 'Module system documentation'
  },
  {
    path: 'docs/ARCHITECTURE.md',
    category: TEST_CATEGORIES.DOCUMENTATION,
    description: 'Architecture documentation'
  }
];

// Regular expressions for known issues
const KNOWN_ISSUES = {
  CIRCULAR_DEPENDENCY: /import.*from.*\.\/.*\.js.*\n.*import.*from.*\.\/.*\.js/,
  MIXED_EXPORTS: /export\s+default.*\nexport\s+{/,
  INCONSISTENT_QUOTES: /['"]use strict['"]/
};

// Module format validation functions
const validateModuleFormat = (content, fileName) => {
  const issues = [];
  
  // Check for mixed module formats
  const hasEsmExports = MODULE_PATTERNS.ESM_EXPORT.test(content);
  const hasEsmImports = MODULE_PATTERNS.ESM_IMPORT.test(content);
  const hasCjsExports = MODULE_PATTERNS.CJS_EXPORT.test(content);
  const hasCjsRequires = MODULE_PATTERNS.CJS_REQUIRE.test(content);
  
  // Skip validation for compatibility layer files
  if (fileName.includes('/cjs/') || fileName.endsWith('.cjs')) {
    // CJS files should use CJS exports and requires
    if (hasEsmExports && !MODULE_PATTERNS.DUAL_FORMAT.test(content)) {
      issues.push({
        type: 'invalid_module_format',
        description: 'CJS file contains ESM exports',
        severity: 'warning'
      });
    }
    if (hasEsmImports && !MODULE_PATTERNS.DYNAMIC_IMPORT.test(content)) {
      issues.push({
        type: 'invalid_module_format',
        description: 'CJS file contains ESM imports',
        severity: 'warning'
      });
    }
    return issues;
  }
  
  // For ESM files (.mjs or .js with type:module)
  if (fileName.endsWith('.mjs') || (!fileName.endsWith('.cjs') && !fileName.includes('/cjs/'))) {
    // ESM files should use ESM exports and imports
    if (hasCjsExports && !MODULE_PATTERNS.DUAL_FORMAT.test(content)) {
      issues.push({
        type: 'invalid_module_format',
        description: 'ESM file contains CommonJS exports',
        severity: 'warning'
      });
    }
    if (hasCjsRequires && !MODULE_PATTERNS.DYNAMIC_IMPORT.test(content)) {
      issues.push({
        type: 'invalid_module_format',
        description: 'ESM file contains CommonJS requires',
        severity: 'warning'
      });
    }
    return issues;
  }
  
  // For any other files, check for mixed formats
  // Mixed export formats without dual format markers
  if (hasEsmExports && hasCjsExports && !MODULE_PATTERNS.DUAL_FORMAT.test(content)) {
    issues.push({
      type: 'mixed_export_formats',
      description: 'Mixed ESM and CommonJS export formats without dual format markers',
      severity: 'error'
    });
  }
  
  // Mixed import formats without dynamic imports
  if (hasEsmImports && hasCjsRequires && !MODULE_PATTERNS.DYNAMIC_IMPORT.test(content)) {
    issues.push({
      type: 'mixed_import_formats',
      description: 'Mixed ESM and CommonJS import formats without dynamic imports',
      severity: 'error'
    });
  }
  
  // Check for consistent export pattern
  const namedExports = content.match(STANDARD_PATTERNS.NAMED_EXPORTS) || [];
  const hasDefaultExport = STANDARD_PATTERNS.DEFAULT_EXPORT.test(content);
  
  if (namedExports.length > 0 && hasDefaultExport) {
    // Check if default export duplicates named exports
    const exportedNames = namedExports.map(match => {
      const matches = /export\s+(?:const|let|var|function|class)\s+(\w+)/.exec(match);
      return matches ? matches[1] : null;
    }).filter(Boolean);
    
    // Extract default export content
    const defaultExportMatch = content.match(/export\s+default\s+({[\s\S]*?}|\w+)/);
    if (defaultExportMatch) {
      const defaultExportContent = defaultExportMatch[1];
      
      // Check if default export is an object with the same named exports
      const duplicateExports = exportedNames.filter(name => 
        defaultExportContent.includes(`${name},`) || 
        defaultExportContent.includes(`${name}:`) ||
        defaultExportContent === name
      );
      
      if (duplicateExports.length > 0 && duplicateExports.length < exportedNames.length) {
        issues.push({
          type: 'inconsistent_default_export',
          description: `Default export includes some but not all named exports: ${duplicateExports.join(', ')}`,
          severity: 'warning'
        });
      }
    }
  }
  
  return issues;
};

// Error handling validation
const validateErrorHandling = (content, fileName) => {
  const issues = [];
  
  // Check if file has try/catch but doesn't use error handling system
  if (ERROR_PATTERNS.TRY_CATCH.test(content) && 
      !ERROR_PATTERNS.ERROR_LOG.test(content) &&
      !fileName.includes('test') && 
      !fileName.includes('mock')) {
    
    issues.push({
      type: 'missing_error_logging',
      description: 'Try/catch blocks should use the error logging system',
      severity: 'warning'
    });
  }
  
  // Check if file throws errors but doesn't use custom error classes
  if (content.includes('throw new Error(') && 
      !ERROR_PATTERNS.THROW_ERROR.test(content) &&
      !fileName.includes('test') && 
      !fileName.includes('mock')) {
    
    issues.push({
      type: 'generic_error_throw',
      description: 'Generic errors should be replaced with specific error classes',
      severity: 'warning'
    });
  }
  
  return issues;
};

// Documentation validation
const validateDocumentation = (content, fileName) => {
  const issues = [];
  
  // Check for JSDoc comments on exports
  const exportCount = (content.match(STANDARD_PATTERNS.NAMED_EXPORTS) || []).length;
  const jsdocCount = (content.match(/\/\*\*[\s\S]*?\*\/\s*export/g) || []).length;
  
  if (exportCount > 0 && jsdocCount < exportCount && 
      !fileName.includes('test') && 
      !fileName.includes('mock')) {
    
    issues.push({
      type: 'missing_jsdoc',
      description: `Missing JSDoc comments for exports (${jsdocCount}/${exportCount})`,
      severity: 'warning'
    });
  }
  
  // Check for non-technical explanations
  if (fileName.endsWith('.js') && 
      !content.includes('NON-TECHNICAL') && 
      content.length > 500 &&
      !fileName.includes('test') && 
      !fileName.includes('mock')) {
    
    issues.push({
      type: 'missing_non_technical',
      description: 'Missing non-technical explanation for complex file',
      severity: 'info'
    });
  }
  
  return issues;
};

// Export configuration
module.exports = {
  MODULE_PATTERNS,
  ERROR_PATTERNS,
  STANDARD_PATTERNS,
  TEST_CATEGORIES,
  REQUIRED_FILES,
  KNOWN_ISSUES,
  EXCLUDE_PATHS,
  validators: {
    validateModuleFormat,
    validateErrorHandling,
    validateDocumentation
  }
};