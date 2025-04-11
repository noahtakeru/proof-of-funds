/**
 * ESM Module Format Standardizer
 * 
 * This script converts the codebase to use ESM format consistently,
 * and creates necessary CJS compatibility layers for backwards compatibility.
 * The approach is "ESM-first" - we standardize on ESM and provide CJS support.
 * 
 * ---------- NON-TECHNICAL EXPLANATION ----------
 * This tool standardizes our code to use modern JavaScript formats (ESM) while
 * maintaining compatibility with older JavaScript systems (CommonJS).
 * Rather than having dual-format modules, we have a clean ESM implementation 
 * and generate CommonJS compatibility versions when needed.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Import error handling modules
import {
  ErrorCode,
  ErrorSeverity,
  SystemError,
  InputError,
  fromError,
  isZKError
} from './zkErrorHandler.js';
import { zkErrorLogger } from './zkErrorLogger.js';

// Create a specialized error class for module format operations
class ModuleFormatError extends SystemError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
      severity: options.severity || ErrorSeverity.ERROR,
      recoverable: options.recoverable !== undefined ? options.recoverable : true,
      details: {
        ...(options.details || {}),
        component: 'ModuleFormatStandardizer',
        operationId: options.operationId || `module_format_${Date.now()}`
      }
    });

    this.name = 'ModuleFormatError';
  }
}

// Helper function for logging errors
function logError(error, additionalInfo = {}) {
  // If it's already a ZKError, just log it and return
  if (isZKError(error)) {
    zkErrorLogger.logError(error, additionalInfo);
    return error;
  }

  // Convert to ModuleFormatError if it's not already a specialized error
  const operationId = additionalInfo.operationId || `module_format_error_${Date.now()}`;
  const moduleError = new ModuleFormatError(error.message || 'Unknown error in module formatting', {
    operationId,
    details: {
      originalError: error,
      ...additionalInfo
    }
  });

  // Log the error
  zkErrorLogger.logError(moduleError, additionalInfo);
  return moduleError;
}

// Get proper file paths in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Primary files to standardize to ESM format
const filesToStandardize = [
  './src/zkProofSerializer.js',
  './src/zkErrorHandler.js',
  './src/zkErrorLogger.js',
  './src/zkCircuitRegistry.js',
  './src/zkCircuitParameterDerivation.js',
  './src/zkSecureInputs.js',
  './src/zkRecoverySystem.js',
  './src/zkCircuitInputs.js',
  './src/index.js'
];

/**
 * Convert a file from CommonJS to ESM format
 * @param {string} filePath - Path to the file to convert
 * @param {boolean} renameFile - Whether to rename the file to .mjs
 * @returns {boolean} Whether the conversion was successful
 */
function convertToESM(filePath, renameFile = true) {
  const operationId = `convert_to_esm_${Date.now()}`;

  try {
    // Resolve the full path
    const fullPath = path.resolve(projectRoot, filePath);

    if (!fs.existsSync(fullPath)) {
      const inputError = new InputError(`File not found: ${filePath}`, {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: true,
        userFixable: true,
        details: {
          filePath,
          fullPath,
          projectRoot
        }
      });

      zkErrorLogger.logError(inputError, {
        context: 'fix-module-formats.convertToESM'
      });

      console.log(`File not found: ${filePath}`);
      return false;
    }

    console.log(`Converting to ESM: ${filePath}`);
    let content = fs.readFileSync(fullPath, 'utf8');

    // Replace CommonJS imports with ESM imports
    content = content.replace(/const\s+([^=]+)\s*=\s*require\(['"]([^'"]+)['"]\);/g,
      (match, importName, importPath) => {
        // Check if it's an internal import that needs .js extension
        if (importPath.startsWith('./') || importPath.startsWith('../')) {
          // Add .js extension if it's not there and doesn't have another extension
          if (!importPath.includes('.js') && !importPath.includes('.mjs') && !importPath.includes('.cjs')) {
            importPath += '.js';
          }
        }
        return `import ${importName} from '${importPath}';`;
      });

    // Replace named exports (exports.X = Y)
    content = content.replace(/exports\.(\w+)\s*=\s*([^;]+);/g,
      (match, exportName, exportValue) => {
        return `export const ${exportName} = ${exportValue};`;
      });

    // Replace full module.exports with export default
    content = content.replace(/module\.exports\s*=\s*([^;]+);/g,
      (match, exportValue) => {
        return `export default ${exportValue};`;
      });

    // Write the updated content
    fs.writeFileSync(fullPath, content);

    // Rename to .mjs if needed
    if (renameFile && !filePath.endsWith('.mjs') && filePath.endsWith('.js')) {
      const newPath = fullPath.replace(/\.js$/, '.mjs');
      fs.renameSync(fullPath, newPath);
      console.log(`Renamed to: ${path.basename(newPath)}`);
    }

    zkErrorLogger.log('INFO', 'Successfully converted file to ESM format', {
      context: 'fix-module-formats.convertToESM',
      details: {
        filePath,
        fullPath,
        renamed: renameFile && !filePath.endsWith('.mjs') && filePath.endsWith('.js')
      }
    });

    return true;
  } catch (error) {
    logError(error, {
      operationId,
      context: 'fix-module-formats.convertToESM',
      details: {
        filePath,
        renameFile
      }
    });

    console.error(`Error converting ${filePath} to ESM format:`, error.message);
    return false;
  }
}

/**
 * Function to build CommonJS compatibility versions using rollup
 * @returns {boolean} Whether the build was successful
 */
function buildCJSCompatibilityVersions() {
  const operationId = `build_cjs_compat_${Date.now()}`;

  console.log('Building CommonJS compatibility versions...');
  try {
    // Run rollup to build CJS versions of our ESM modules
    execSync('npx rollup -c', { cwd: projectRoot, stdio: 'inherit' });

    zkErrorLogger.log('INFO', 'Successfully built CJS compatibility modules', {
      context: 'fix-module-formats.buildCJSCompatibilityVersions',
      details: {
        projectRoot,
        command: 'npx rollup -c'
      }
    });

    console.log('Successfully built CJS compatibility modules');
    return true;
  } catch (error) {
    logError(error, {
      operationId,
      context: 'fix-module-formats.buildCJSCompatibilityVersions',
      details: {
        projectRoot,
        command: 'npx rollup -c'
      }
    });

    console.error('Error building CJS compatibility versions:', error.message);
    return false;
  }
}

/**
 * Update import paths in modules to use .mjs extensions
 * @param {string} directory - Directory to scan
 */
function updateImportPaths(directory = path.join(projectRoot, 'src')) {
  const operationId = `update_import_paths_${Date.now()}`;

  try {
    const files = fs.readdirSync(directory);

    files.forEach(file => {
      try {
        const fullPath = path.join(directory, file);

        // Skip if it's a directory
        if (fs.statSync(fullPath).isDirectory()) {
          return;
        }

        // Only process .mjs files
        if (!file.endsWith('.mjs')) {
          return;
        }

        console.log(`Updating import paths in: ${file}`);
        let content = fs.readFileSync(fullPath, 'utf8');

        // Update import paths to use .mjs
        content = content.replace(/import\s+(?:[\w\s{}*,]+\s+from\s+)?['"]([^'"]+)\.js['"]/g,
          (match, importPath) => {
            return match.replace('.js', '.mjs');
          });

        fs.writeFileSync(fullPath, content);

        zkErrorLogger.log('INFO', 'Successfully updated import paths', {
          context: 'fix-module-formats.updateImportPaths',
          details: {
            file,
            fullPath
          }
        });
      } catch (fileError) {
        logError(fileError, {
          operationId: `${operationId}_${file}`,
          context: 'fix-module-formats.updateImportPaths.processFile',
          details: {
            file,
            directory
          }
        });

        console.error(`Error processing file ${file}:`, fileError.message);
      }
    });

    zkErrorLogger.log('INFO', 'Completed updating import paths in directory', {
      context: 'fix-module-formats.updateImportPaths',
      details: {
        directory,
        processedFiles: files.filter(f => f.endsWith('.mjs')).length
      }
    });
  } catch (error) {
    logError(error, {
      operationId,
      context: 'fix-module-formats.updateImportPaths',
      details: {
        directory
      }
    });

    console.error(`Error updating import paths in ${directory}:`, error.message);
  }
}

/**
 * Main function to run the standardization process
 */
function standardizeModules() {
  const operationId = `standardize_modules_${Date.now()}`;

  try {
    console.log('Starting module format standardization...');

    // 1. Convert files to ESM format
    const convertResults = filesToStandardize.map(filePath => {
      return { filePath, success: convertToESM(filePath) };
    });

    // 2. Update import paths to use .mjs extension
    updateImportPaths();

    // 3. Build CommonJS compatibility versions
    const cjsBuildSuccess = buildCJSCompatibilityVersions();

    // Log overall results
    zkErrorLogger.log('INFO', 'Module format standardization completed', {
      context: 'fix-module-formats.standardizeModules',
      details: {
        totalFiles: filesToStandardize.length,
        convertedFiles: convertResults.filter(r => r.success).length,
        cjsBuildSuccess,
        failures: convertResults.filter(r => !r.success).map(r => r.filePath)
      }
    });

    console.log('Module format standardization complete!');
  } catch (error) {
    logError(error, {
      operationId,
      context: 'fix-module-formats.standardizeModules'
    });

    console.error('Error during module standardization:', error.message);
  }
}

// Run the standardization if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    standardizeModules();
  } catch (error) {
    logError(error, {
      operationId: `main_execution_${Date.now()}`,
      context: 'fix-module-formats.main'
    });

    console.error('Fatal error during module standardization:', error.message);
    process.exit(1);
  }
}

// Export functions for programmatic use
export {
  convertToESM,
  updateImportPaths,
  buildCJSCompatibilityVersions,
  standardizeModules
};

// Default export for compatibility
export default {
  convertToESM,
  updateImportPaths,
  buildCJSCompatibilityVersions,
  standardizeModules
};