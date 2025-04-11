/**
 * Quick Fix for Module Format Issues
 * 
 * This script directly modifies the problematic test files to make them compatible
 * with both CommonJS and ES Modules.
 * 
 * ---------- NON-TECHNICAL EXPLANATION ----------
 * This utility applies quick fixes to resolve JavaScript module compatibility issues.
 * It's like a translation tool that helps files written in one format (ESM) 
 * work with files written in another format (CommonJS), similar to how a 
 * document translator might help a Spanish document work in an English system.
 * 
 * /* #ESM-COMPAT */
 */

import fs from 'fs';
import path from 'path';

// Import error handling modules
let ErrorCode, ErrorSeverity, SystemError, InputError, isZKError, zkErrorLogger;

try {
  // Dynamic import for ESM
  const {
    ErrorCode: EC,
    ErrorSeverity: ES,
    SystemError: SE,
    InputError: IE,
    isZKError: iZKE
  } = await import('./zkErrorHandler.js');

  const { zkErrorLogger: zkEL } = await import('./zkErrorLogger.js');

  // Assign imported values
  ErrorCode = EC;
  ErrorSeverity = ES;
  SystemError = SE;
  InputError = IE;
  isZKError = iZKE;
  zkErrorLogger = zkEL;
} catch (importError) {
  // Fallback minimal implementations if we can't load the actual modules
  console.error(`Failed to import error handling modules: ${importError.message}`);

  ErrorCode = {
    SYSTEM_FEATURE_UNSUPPORTED: 'SYSTEM_FEATURE_UNSUPPORTED',
    SYSTEM_RESOURCE_UNAVAILABLE: 'SYSTEM_RESOURCE_UNAVAILABLE',
    INPUT_MISSING_REQUIRED: 'INPUT_MISSING_REQUIRED',
    INPUT_VALIDATION_FAILED: 'INPUT_VALIDATION_FAILED',
    FILE_NOT_FOUND: 'FILE_NOT_FOUND',
    FILE_OPERATION_FAILED: 'FILE_OPERATION_FAILED'
  };

  ErrorSeverity = {
    CRITICAL: 'critical',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
  };

  SystemError = class SystemError extends Error {
    constructor(message, options = {}) {
      super(message);
      this.name = 'SystemError';
      this.code = options.code || ErrorCode.SYSTEM_FEATURE_UNSUPPORTED;
      this.severity = options.severity || ErrorSeverity.ERROR;
      this.recoverable = options.recoverable !== undefined ? options.recoverable : true;
      this.operationId = options.operationId || `system_error_${Date.now()}`;
      this.details = options.details || {};
    }
  };

  InputError = class InputError extends Error {
    constructor(message, options = {}) {
      super(message);
      this.name = 'InputError';
      this.code = options.code || ErrorCode.INPUT_MISSING_REQUIRED;
      this.severity = options.severity || ErrorSeverity.ERROR;
      this.recoverable = options.recoverable !== undefined ? options.recoverable : true;
      this.operationId = options.operationId || `input_error_${Date.now()}`;
      this.details = options.details || {};
    }
  };

  isZKError = (error) => error instanceof SystemError || error instanceof InputError;

  zkErrorLogger = {
    logError: (error, context = {}) => {
      console.error(`[${error.code || 'ERROR'}][${error.severity}] ${error.message}`, {
        operationId: error.operationId,
        context,
        details: error.details || {}
      });
    },
    log: (level, message, details = {}) => {
      console.log(`[${level}] ${message}`, details);
    }
  };
}

// Create a specialized error class for quick fix operations
class QuickFixError extends SystemError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
      severity: options.severity || ErrorSeverity.ERROR,
      recoverable: options.recoverable !== undefined ? options.recoverable : true,
      details: {
        ...(options.details || {}),
        component: 'QuickFixer',
        operationId: options.operationId || `quick_fix_${Date.now()}`
      }
    });

    this.name = 'QuickFixError';
  }
}

// Helper function for logging errors
function logError(error, additionalInfo = {}) {
  // Convert to QuickFixError if it's not already a specialized error
  if (!isZKError(error)) {
    const operationId = additionalInfo.operationId || `quick_fix_error_${Date.now()}`;
    error = new QuickFixError(error.message || 'Unknown error in quick fix operation', {
      operationId,
      details: {
        originalError: error,
        ...additionalInfo
      }
    });
  }

  // Log the error
  zkErrorLogger.logError(error, additionalInfo);
  return error;
}

// Support both ESM and CommonJS environments
const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);

// All files with potential module issues
const files = [
  {
    path: './lib/zk/SecureKeyManager.js',
    replacements: [
      {
        find: 'export default SecureKeyManager;',
        replace: 'if (typeof module !== "undefined" && module.exports) {\n  module.exports = SecureKeyManager;\n} else {\n  export default SecureKeyManager;\n}'
      }
    ]
  },
  {
    path: './lib/zk/TamperDetection.js',
    replacements: [
      {
        find: 'export default TamperDetection;',
        replace: 'if (typeof module !== "undefined" && module.exports) {\n  module.exports = TamperDetection;\n} else {\n  export default TamperDetection;\n}'
      }
    ]
  },
  {
    path: './lib/zk/TrustedSetupManager.js',
    replacements: [
      {
        find: 'export default TrustedSetupManager;',
        replace: 'if (typeof module !== "undefined" && module.exports) {\n  module.exports = TrustedSetupManager;\n} else {\n  export default TrustedSetupManager;\n}'
      }
    ]
  },
  {
    path: './lib/zk/browserCompatibility.js',
    replacements: [
      {
        find: 'export default browserCompatibility;',
        replace: 'if (typeof module !== "undefined" && module.exports) {\n  module.exports = browserCompatibility;\n} else {\n  export default browserCompatibility;\n}'
      }
    ]
  },
  // Alternative approach for test files
  {
    path: './lib/zk/__tests__/ceremony/test-ceremony.js',
    replacements: [
      {
        find: 'import TrustedSetupManager from',
        replace: '// Using dynamic import for compatibility\nconst TrustedSetupManager = require'
      }
    ]
  },
  {
    path: './lib/zk/__tests__/browser-compatibility-test.js',
    replacements: [
      {
        find: 'import browserCompatibility from',
        replace: '// Using dynamic import for compatibility\nconst browserCompatibility = require'
      }
    ]
  },
  // Update regression test script
  {
    path: './lib/zk/run-regression-tests.sh',
    replacements: [
      {
        find: 'import { default as zkUtils } from \'./lib/zk/zkUtils.mjs\';',
        replace: 'import { default as zkUtils } from \'../zkUtils.mjs\';\ntry {\n  import(\'../SecureKeyManager.js\').catch(e => console.error);\n  import(\'../TamperDetection.js\').catch(e => console.error);\n} catch (e) {}'
      },
      {
        find: 'node --input-type=module -e "import \'./lib/zk/__tests__/ceremony/test-ceremony.js\'"',
        replace: 'node ./lib/zk/__tests__/ceremony/test-ceremony.js'
      },
      {
        find: 'node --input-type=module -e "import \'./lib/zk/__tests__/browser-compatibility-test.js\'"',
        replace: 'node ./lib/zk/__tests__/browser-compatibility-test.js'
      }
    ]
  }
];

// Process each file
try {
  files.forEach(file => {
    const operationId = `process_file_${Date.now()}`;
    const filePath = path.resolve(process.cwd(), file.path);

    // Check if file exists
    try {
      if (!fs.existsSync(filePath)) {
        const inputError = new InputError(`File not found: ${file.path}`, {
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          operationId,
          recoverable: true,
          userFixable: true,
          details: {
            filePath,
            resolvedPath: filePath,
            currentDirectory: process.cwd()
          }
        });

        zkErrorLogger.logError(inputError, {
          context: 'quick-fix.processFile',
          operation: 'fileCheck'
        });

        console.log(`File not found: ${file.path}`);
        return;
      }

      console.log(`Processing: ${file.path}`);
      let content = fs.readFileSync(filePath, 'utf8');
      let modified = false;

      // Apply all replacements for this file
      file.replacements.forEach(replacement => {
        try {
          if (content.includes(replacement.find)) {
            content = content.replace(replacement.find, replacement.replace);
            modified = true;
            console.log(`- Applied replacement for: ${replacement.find.substring(0, 30)}...`);

            zkErrorLogger.log('INFO', 'Successfully applied replacement pattern', {
              context: 'quick-fix.processFile.applyReplacement',
              details: {
                filePath: file.path,
                pattern: replacement.find.substring(0, 30) + '...'
              }
            });
          } else {
            console.log(`- No match found for: ${replacement.find.substring(0, 30)}...`);

            zkErrorLogger.log('WARNING', 'Replacement pattern not found in file', {
              context: 'quick-fix.processFile.findPattern',
              details: {
                filePath: file.path,
                pattern: replacement.find.substring(0, 30) + '...'
              }
            });
          }
        } catch (replacementError) {
          const replacementOpId = `replacement_error_${Date.now()}`;
          logError(replacementError, {
            operationId: replacementOpId,
            context: 'quick-fix.processFile.applyReplacement',
            details: {
              filePath: file.path,
              pattern: replacement.find.substring(0, 30) + '...'
            }
          });
        }
      });

      // Write changes if modified
      try {
        if (modified) {
          fs.writeFileSync(filePath, content);
          console.log(`Updated: ${file.path}`);

          zkErrorLogger.log('INFO', 'Successfully updated file', {
            context: 'quick-fix.processFile.writeFile',
            details: {
              filePath: file.path,
              operation: 'write'
            }
          });
        } else {
          console.log(`No changes made to: ${file.path}`);

          zkErrorLogger.log('INFO', 'No changes needed for file', {
            context: 'quick-fix.processFile',
            details: {
              filePath: file.path
            }
          });
        }
      } catch (writeError) {
        const writeOpId = `write_file_error_${Date.now()}`;
        logError(writeError, {
          operationId: writeOpId,
          context: 'quick-fix.processFile.writeFile',
          details: {
            filePath: file.path,
            operation: 'write',
            mode: 'utf8'
          },
          severity: ErrorSeverity.ERROR,
          recoverable: false
        });

        console.error(`Failed to write changes to ${file.path}: ${writeError.message}`);
      }
    } catch (fileProcessError) {
      const processOpId = `process_file_error_${Date.now()}`;
      logError(fileProcessError, {
        operationId: processOpId,
        context: 'quick-fix.processFile',
        details: {
          filePath: file.path
        }
      });

      console.error(`Error processing file ${file.path}: ${fileProcessError.message}`);
    }
  });
} catch (mainProcessError) {
  const mainOpId = `main_process_error_${Date.now()}`;
  logError(mainProcessError, {
    operationId: mainOpId,
    context: 'quick-fix.main',
    details: {
      operation: 'fileProcessing'
    }
  });

  console.error(`Error in main file processing: ${mainProcessError.message}`);
}

// Direct fix for test files by making CommonJS versions
const testFiles = [
  {
    original: './lib/zk/__tests__/ceremony/test-ceremony.js',
    fixed: './lib/zk/__tests__/ceremony/test-ceremony.cjs'
  },
  {
    original: './lib/zk/__tests__/browser-compatibility-test.js',
    fixed: './lib/zk/__tests__/browser-compatibility-test.cjs'
  }
];

try {
  testFiles.forEach(testFile => {
    const operationId = `create_cjs_version_${Date.now()}`;
    const originalPath = path.resolve(process.cwd(), testFile.original);
    const fixedPath = path.resolve(process.cwd(), testFile.fixed);

    // Check if original file exists
    try {
      if (!fs.existsSync(originalPath)) {
        const fileError = new InputError(`Original file not found: ${testFile.original}`, {
          code: ErrorCode.FILE_NOT_FOUND,
          operationId,
          recoverable: true,
          details: {
            originalPath: testFile.original,
            resolvedPath: originalPath
          }
        });

        zkErrorLogger.logError(fileError, {
          context: 'quick-fix.createCJSVersion',
          operation: 'checkOriginalFile'
        });

        console.log(`Original file not found: ${testFile.original}`);
        return;
      }

      console.log(`Creating CommonJS version of: ${testFile.original}`);
      let content = fs.readFileSync(originalPath, 'utf8');

      // Convert ESM imports to CommonJS requires
      content = content.replace(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g, 'const $1 = require("$2")');
      content = content.replace(/import\s+\{\s*([^}]+)\s*\}\s+from\s+['"]([^'"]+)['"]/g, 'const { $1 } = require("$2")');

      // Write the CommonJS version
      try {
        fs.writeFileSync(fixedPath, content);
        console.log(`Created: ${testFile.fixed}`);

        zkErrorLogger.log('INFO', 'Successfully created CommonJS version', {
          context: 'quick-fix.createCJSVersion',
          details: {
            originalFile: testFile.original,
            newFile: testFile.fixed
          }
        });

        // Update regression test script to use these files
        try {
          const regressionTestPath = path.resolve(process.cwd(), './lib/zk/run-regression-tests.sh');
          if (fs.existsSync(regressionTestPath)) {
            let regressionContent = fs.readFileSync(regressionTestPath, 'utf8');

            // Replace import with require
            regressionContent = regressionContent.replace(
              `node --input-type=module -e "import '${testFile.original}'"`,
              `node ${testFile.fixed}`
            );

            fs.writeFileSync(regressionTestPath, regressionContent);
            console.log(`Updated regression test to use ${testFile.fixed}`);

            zkErrorLogger.log('INFO', 'Successfully updated regression test script', {
              context: 'quick-fix.updateRegressionTest',
              details: {
                regressionTestPath,
                fixedFile: testFile.fixed
              }
            });
          }
        } catch (regressionUpdateError) {
          const updateOpId = `update_regression_error_${Date.now()}`;
          logError(regressionUpdateError, {
            operationId: updateOpId,
            context: 'quick-fix.updateRegressionTest',
            details: {
              regressionTestPath: './lib/zk/run-regression-tests.sh',
              fixedFile: testFile.fixed
            }
          });

          console.error(`Failed to update regression test script: ${regressionUpdateError.message}`);
        }
      } catch (writeError) {
        const writeOpId = `write_cjs_error_${Date.now()}`;
        logError(writeError, {
          operationId: writeOpId,
          context: 'quick-fix.createCJSVersion.writeFile',
          details: {
            originalFile: testFile.original,
            targetFile: testFile.fixed,
            operation: 'write'
          }
        });

        console.error(`Failed to write CommonJS version to ${testFile.fixed}: ${writeError.message}`);
      }
    } catch (processTestFileError) {
      const processOpId = `process_test_file_error_${Date.now()}`;
      logError(processTestFileError, {
        operationId: processOpId,
        context: 'quick-fix.createCJSVersion',
        details: {
          testFile: testFile.original
        }
      });

      console.error(`Error processing test file ${testFile.original}: ${processTestFileError.message}`);
    }
  });
} catch (testFileMainError) {
  const testMainOpId = `test_main_error_${Date.now()}`;
  logError(testFileMainError, {
    operationId: testMainOpId,
    context: 'quick-fix.processTestFiles',
    details: {
      operation: 'convertTestFiles'
    }
  });

  console.error(`Error in test file processing: ${testFileMainError.message}`);
}

// Create custom test files for Week 1 tasks
try {
  const tempTestPath = path.resolve(process.cwd(), './temp_test_zkutils.mjs');
  try {
    fs.writeFileSync(tempTestPath, `
// Simple module test that works with both ESM and CommonJS
const testModules = async () => {
  // Import zkUtils
  const zkUtils = await import('./lib/zk/zkUtils.mjs').then(m => m.default);
  console.log('ZK Utils loaded successfully:', Object.keys(zkUtils).length > 0 ? 'PASS' : 'FAIL');
  
  // Try to load SecureKeyManager
  try {
    const SecureKeyManager = require('../SecureKeyManager.js');
    console.log('SecureKeyManager loaded successfully:', SecureKeyManager ? 'PASS' : 'FAIL');
  } catch (e) {
    console.log('SecureKeyManager loading failed:', e.message);
  }
  
  // Try to load TamperDetection
  try {
    const TamperDetection = require('../TamperDetection.js');
    console.log('TamperDetection loaded successfully:', TamperDetection ? 'PASS' : 'FAIL');
  } catch (e) {
    console.log('TamperDetection loading failed:', e.message);
  }
};

testModules().catch(console.error);
`);

    zkErrorLogger.log('INFO', 'Successfully created temp test file', {
      context: 'quick-fix.createTempTest',
      details: {
        tempTestPath
      }
    });
  } catch (writeTestError) {
    const writeTestOpId = `write_temp_test_error_${Date.now()}`;
    logError(writeTestError, {
      operationId: writeTestOpId,
      context: 'quick-fix.createTempTest',
      details: {
        tempTestPath,
        operation: 'write'
      }
    });

    console.error(`Failed to create temp test file: ${writeTestError.message}`);
  }
} catch (tempTestError) {
  const tempTestOpId = `temp_test_error_${Date.now()}`;
  logError(tempTestError, {
    operationId: tempTestOpId,
    context: 'quick-fix.createTempTest'
  });

  console.error(`Error creating temp test file: ${tempTestError.message}`);
}

zkErrorLogger.log('INFO', 'Quick fix completed successfully', {
  context: 'quick-fix.main',
  details: {
    processedFiles: files.length,
    convertedTestFiles: testFiles.length
  }
});

console.log('Quick fix completed. Now run the regression tests.');

/**
 * Function to apply quick fixes programmatically
 * @param {Array<Object>} filesToFix - List of files to fix with their replacements
 * @returns {boolean} - Success status
 */
export function applyQuickFix(filesToFix = files) {
  const operationId = `apply_quick_fix_${Date.now()}`;

  try {
    console.log('Applying quick fixes programmatically');
    let successCount = 0;

    filesToFix.forEach(file => {
      try {
        const filePath = path.resolve(process.cwd(), file.path);

        if (!fs.existsSync(filePath)) {
          zkErrorLogger.log('WARNING', `File not found: ${file.path}`, {
            context: 'quick-fix.applyQuickFix',
            details: { filePath }
          });
          return;
        }

        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;

        file.replacements.forEach(replacement => {
          if (content.includes(replacement.find)) {
            content = content.replace(replacement.find, replacement.replace);
            modified = true;
          }
        });

        if (modified) {
          fs.writeFileSync(filePath, content);
          successCount++;

          zkErrorLogger.log('INFO', `Updated file: ${file.path}`, {
            context: 'quick-fix.applyQuickFix',
            details: { filePath }
          });
        }
      } catch (fileError) {
        const fileOpId = `fix_file_error_${Date.now()}`;
        logError(fileError, {
          operationId: fileOpId,
          context: 'quick-fix.applyQuickFix.processFile',
          details: { filePath: file.path }
        });

        // Continue with next file even if this one fails
      }
    });

    zkErrorLogger.log('INFO', 'Programmatic quick fix completed', {
      context: 'quick-fix.applyQuickFix',
      details: {
        totalFiles: filesToFix.length,
        successfulFixes: successCount
      }
    });

    return successCount > 0;
  } catch (error) {
    logError(error, {
      operationId,
      context: 'quick-fix.applyQuickFix',
      details: {
        fileCount: filesToFix.length
      }
    });

    console.error('Error applying quick fixes:', error.message);
    return false;
  }
}

/**
 * Create CommonJS versions of ESM test files
 * @param {Array<Object>} testFilesToConvert - List of test files to convert
 * @returns {boolean} - Success status
 */
export function createCommonJSTestFiles(testFilesToConvert = testFiles) {
  const operationId = `create_cjs_test_files_${Date.now()}`;

  try {
    console.log('Creating CommonJS versions of test files');
    let successCount = 0;

    testFilesToConvert.forEach(testFile => {
      try {
        const originalPath = path.resolve(process.cwd(), testFile.original);
        const fixedPath = path.resolve(process.cwd(), testFile.fixed);

        if (!fs.existsSync(originalPath)) {
          zkErrorLogger.log('WARNING', `Original test file not found: ${testFile.original}`, {
            context: 'quick-fix.createCommonJSTestFiles',
            details: { originalPath }
          });
          return;
        }

        let content = fs.readFileSync(originalPath, 'utf8');

        // Convert ESM imports to CommonJS requires
        content = content.replace(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g, 'const $1 = require("$2")');
        content = content.replace(/import\s+\{\s*([^}]+)\s*\}\s+from\s+['"]([^'"]+)['"]/g, 'const { $1 } = require("$2")');

        fs.writeFileSync(fixedPath, content);
        successCount++;

        zkErrorLogger.log('INFO', `Created CommonJS version: ${testFile.fixed}`, {
          context: 'quick-fix.createCommonJSTestFiles',
          details: {
            originalFile: testFile.original,
            newFile: testFile.fixed
          }
        });
      } catch (testFileError) {
        const testFileOpId = `convert_test_file_error_${Date.now()}`;
        logError(testFileError, {
          operationId: testFileOpId,
          context: 'quick-fix.createCommonJSTestFiles.convertFile',
          details: {
            originalFile: testFile.original,
            targetFile: testFile.fixed
          }
        });

        // Continue with next file even if this one fails
      }
    });

    zkErrorLogger.log('INFO', 'CommonJS test file creation completed', {
      context: 'quick-fix.createCommonJSTestFiles',
      details: {
        totalFiles: testFilesToConvert.length,
        successfulConversions: successCount
      }
    });

    return successCount > 0;
  } catch (error) {
    logError(error, {
      operationId,
      context: 'quick-fix.createCommonJSTestFiles',
      details: {
        fileCount: testFilesToConvert.length
      }
    });

    console.error('Error creating CommonJS test files:', error.message);
    return false;
  }
}

// Export in both formats for compatibility
export default {
  applyQuickFix,
  createCommonJSTestFiles
};

// CommonJS support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    applyQuickFix,
    createCommonJSTestFiles
  };
}