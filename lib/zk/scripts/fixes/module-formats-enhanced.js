/**
 * Enhanced Module Format Standardizer
 * 
 * This class standardizes module formats across the codebase by:
 * - Converting CommonJS patterns to ESM in .mjs files
 * - Properly handling both ESM and CommonJS formats
 * - Adding .js extensions to local imports in ESM files
 * - Converting __dirname and __filename usage to ESM equivalents
 * - Standardizing export patterns
 * 
 * Improvements over the original module-formats.js:
 * - Better detection of module format inconsistencies
 * - More accurate file extension recommendations (.mjs vs .cjs vs .js)
 * - Enhanced dual-format compatibility handling
 * - More comprehensive import path fixes
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Calculate __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Local error handling
const errorLogger = {
  error: (...args) => console.error(...args),
  warn: (...args) => console.warn(...args),
  info: (...args) => console.info(...args)
};

// Simple tryCatch wrapper for promise-based operations
const tryCatch = async (operation, errorMessage) => {
  try {
    return await operation();
  } catch (error) {
    errorLogger.error(`${errorMessage}: ${error.message}`);
    throw error;
  }
};

// FileSystemError class
class FileSystemError extends Error {
  constructor(message, code = 'FILESYSTEM_ERROR') {
    super(message);
    this.name = 'FileSystemError';
    this.code = code;
  }
}

// Constants for module patterns
const MODULE_PATTERNS = {
  // ESM patterns
  ESM_IMPORT: /import\s+(?:(?:\w+|\{[^}]+\})(?:\s*,\s*)?)?(?:\*\s+as\s+\w+)?(?:\s*,\s*)?(?:(?:\w+|\{[^}]+\})(?:\s*,\s*)?)?from\s+['"][^'"]+['"];/gm,
  ESM_EXPORT: /export\s+(?:default|const|function|class|var|let|async)/gm,
  ESM_EXPORT_FROM: /export\s+(?:\*|\{[^}]+\})\s+from/gm,
  
  // CommonJS patterns
  CJS_REQUIRE: /(?:const|let|var)\s+(\w+|\{[^}]+\})\s*=\s*require\(['"][^'"]+['"](?:\)\.([^;]+))?\)?;?/gm,
  CJS_EXPORTS: /(?:module\.)?exports(?:\.([^=\s]+))?\s*=\s*/gm,
  CJS_PROPERTY_EXPORTS: /exports\.([^=\s]+)\s*=\s*/gm,
  
  // Mixed/Dual format patterns
  DYNAMIC_IMPORT: /await\s+import\(/gm,
  DYNAMIC_REQUIRE: /require\(['"][^'"]+['"](?:\)\.([^;]+))?\)?;?/gm,
  CONDITION_FORMAT: /typeof\s+(?:require|module|exports)\s+!==\s+['"]undefined['"]/gm,
  
  // Problematic patterns
  DIRNAME_FILENAME: /(?:__dirname|__filename)\b/g,
  MISSING_EXTENSION: /from\s+['"]([./][^'"]*?)(?:['"])/gm,
};

export class ModuleFormatStandardizer {
  /**
   * Create a new ModuleFormatStandardizer
   * @param {Object} options Options for the standardizer
   * @param {boolean} [options.verbose=false] Whether to log verbose output
   * @param {boolean} [options.dryRun=false] Whether to simulate fixes without making changes
   * @param {boolean} [options.backup=true] Whether to create backups of modified files
   * @param {boolean} [options.renameFiles=true] Whether to rename files based on format
   */
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.dryRun = options.dryRun || false;
    this.backup = options.backup !== false;
    this.renameFiles = options.renameFiles !== false;
    this.stats = {
      analyzed: 0,
      fixed: 0,
      renamed: 0,
      skipped: 0,
      errors: 0
    };
  }

  /**
   * Log a message if verbose mode is enabled
   * @param {string} message Message to log
   */
  log(message) {
    if (this.verbose) {
      console.log(`[ModuleStandardizer] ${message}`);
    }
  }

  /**
   * Check if a file should be processed
   * @param {string} filePath Path to the file
   * @returns {boolean} Whether the file should be processed
   */
  shouldProcessFile(filePath) {
    // Only process JS files
    const ext = path.extname(filePath);
    return ['.js', '.mjs', '.cjs'].includes(ext);
  }

  /**
   * Detect the module format of a file
   * @param {string} content File content
   * @returns {{ format: string, isUsingEsm: boolean, isUsingCommonJs: boolean, isDualFormat: boolean }}
   */
  detectModuleFormat(content) {
    // Check for ESM patterns
    const hasEsmImport = MODULE_PATTERNS.ESM_IMPORT.test(content);
    const hasEsmExport = MODULE_PATTERNS.ESM_EXPORT.test(content);
    const hasEsmExportFrom = MODULE_PATTERNS.ESM_EXPORT_FROM.test(content);
    
    // Check for CommonJS patterns
    const hasCjsRequire = MODULE_PATTERNS.CJS_REQUIRE.test(content);
    const hasCjsExports = MODULE_PATTERNS.CJS_EXPORTS.test(content);
    const hasCjsPropertyExports = MODULE_PATTERNS.CJS_PROPERTY_EXPORTS.test(content);
    
    // Check for dual format indicators
    const hasDynamicImport = MODULE_PATTERNS.DYNAMIC_IMPORT.test(content);
    const hasDynamicRequire = MODULE_PATTERNS.DYNAMIC_REQUIRE.test(content);
    const hasConditionFormat = MODULE_PATTERNS.CONDITION_FORMAT.test(content);
    
    // Determine format based on patterns
    const isUsingEsm = hasEsmImport || hasEsmExport || hasEsmExportFrom;
    const isUsingCommonJs = hasCjsRequire || hasCjsExports || hasCjsPropertyExports;
    const isDualFormat = hasConditionFormat || (isUsingEsm && isUsingCommonJs);
    
    let format;
    if (isDualFormat) {
      format = 'dual';
    } else if (isUsingEsm && !isUsingCommonJs) {
      format = 'esm';
    } else if (!isUsingEsm && isUsingCommonJs) {
      format = 'commonjs';
    } else {
      // If no clear patterns detected, guess based on other indicators
      if (hasDynamicImport) {
        format = 'esm';
      } else if (hasDynamicRequire) {
        format = 'commonjs';
      } else {
        // Default to ESM for new files with no clear patterns
        format = 'esm';
      }
    }
    
    return { 
      format, 
      isUsingEsm, 
      isUsingCommonJs, 
      isDualFormat
    };
  }

  /**
   * Get the recommended file extension based on module format
   * @param {string} filePath Current file path
   * @param {string} format Detected module format
   * @returns {string|null} Recommended file extension or null if no change needed
   */
  getRecommendedExtension(filePath, format) {
    const ext = path.extname(filePath);
    
    // Only recommend extension changes if they don't match the format
    switch (format) {
      case 'esm':
        return ext !== '.mjs' ? '.mjs' : null;
      case 'commonjs':
        return ext !== '.cjs' ? '.cjs' : null;
      case 'dual':
        return ext !== '.js' ? '.js' : null;
      default:
        return null;
    }
  }

  /**
   * Analyze a file to determine what fixes it needs
   * @param {string} filePath Path to the file
   * @param {string} content File content
   * @returns {{ 
   *   path: string, 
   *   format: string, 
   *   recommendedExtension: string|null, 
   *   needsMixedFormatFix: boolean,
   *   needsImportFix: boolean,
   *   needsExportFix: boolean,
   *   needsDirnameFilename: boolean
   * }}
   */
  analyzeFile(filePath, content) {
    const { format, isUsingEsm, isUsingCommonJs, isDualFormat } = this.detectModuleFormat(content);
    const recommendedExtension = this.getRecommendedExtension(filePath, format);
    
    // Check for specific issues
    const hasMissingExtensions = MODULE_PATTERNS.MISSING_EXTENSION.test(content);
    const hasMixedExports = isUsingEsm && isUsingCommonJs && !isDualFormat;
    const hasDirnameFilename = MODULE_PATTERNS.DIRNAME_FILENAME.test(content) && isUsingEsm;
    
    return {
      path: filePath,
      format,
      recommendedExtension,
      needsMixedFormatFix: hasMixedExports,
      needsImportFix: hasMissingExtensions && isUsingEsm,
      needsExportFix: hasMixedExports,
      needsDirnameFilename: hasDirnameFilename
    };
  }

  /**
   * Create a backup of a file
   * @param {string} filePath Path to the file
   * @param {string} content Original content
   */
  async createBackup(filePath, content) {
    if (this.backup) {
      const backupPath = `${filePath}.bak`;
      this.log(`Creating backup at ${backupPath}`);

      if (!this.dryRun) {
        const [error] = await tryCatch(async () => {
          await fs.writeFile(backupPath, content, 'utf8');
        }, {
          context: {
            component: 'ModuleFormatStandardizer.createBackup',
            filePath,
            backupPath
          }
        });
        
        if (error) {
          throw new FileSystemError(`Failed to create backup: ${backupPath}`, {
            cause: error,
            filePath,
            backupPath
          });
        }
      }
    }
  }

  /**
   * Convert require statements to import statements
   * @param {string} content File content
   * @returns {string} Updated content
   */
  updateImports(content) {
    // Convert const/let/var x = require('y') to import x from 'y'
    let updated = content.replace(
      /(?:const|let|var)\s+(\w+)\s*=\s*require\(['"]([^'"]+)['"]\);?/gm,
      (match, varName, modulePath) => {
        // Add .js extension for local imports if missing
        if (modulePath.startsWith('./') || modulePath.startsWith('../')) {
          if (!/\.\w+$/.test(modulePath)) {
            modulePath += '.js';
          }
        }
        return `import ${varName} from '${modulePath}';`;
      }
    );

    // Convert destructuring require to named imports
    updated = updated.replace(
      /(?:const|let|var)\s+\{([^}]+)\}\s*=\s*require\(['"]([^'"]+)['"]\);?/gm,
      (match, importList, modulePath) => {
        // Add .js extension for local imports if missing
        if (modulePath.startsWith('./') || modulePath.startsWith('../')) {
          if (!/\.\w+$/.test(modulePath)) {
            modulePath += '.js';
          }
        }
        return `import { ${importList} } from '${modulePath}';`;
      }
    );

    // Add .js extension to existing imports if missing
    updated = updated.replace(
      /import\s+(?:(?:\w+|\{[^}]+\})(?:\s*,\s*)?)?(?:\*\s+as\s+\w+)?(?:\s*,\s*)?(?:(?:\w+|\{[^}]+\})(?:\s*,\s*)?)?from\s+['"]([./][^'"]+)['"];/gm,
      (match, modulePath) => {
        if (modulePath.startsWith('./') || modulePath.startsWith('../')) {
          if (!/\.\w+$/.test(modulePath)) {
            return match.replace(modulePath, `${modulePath}.js`);
          }
        }
        return match;
      }
    );

    return updated;
  }

  /**
   * Convert module.exports to export statements
   * @param {string} content File content
   * @returns {string} Updated content
   */
  updateExports(content) {
    // Convert module.exports = ... to export default ...
    let updated = content.replace(
      /module\.exports\s*=\s*([^;]+);?/gm,
      'export default $1;'
    );

    // Convert exports.x = y to export const x = y
    // This is trickier because we need to handle function/class declarations differently
    updated = updated.replace(
      /exports\.(\w+)\s*=\s*([^;]+);?/gm,
      (match, exportName, exportValue) => {
        // Check if this is a function or class definition
        if (exportValue.trim().startsWith('function') || exportValue.trim().startsWith('class')) {
          return `export ${exportValue};`;
        } else if (exportValue.trim().startsWith('async function')) {
          return `export ${exportValue};`;
        } else if (exportValue.trim().startsWith('(')) {
          // Arrow function
          return `export const ${exportName} = ${exportValue};`;
        } else {
          return `export const ${exportName} = ${exportValue};`;
        }
      }
    );

    return updated;
  }

  /**
   * Convert __dirname and __filename to ESM equivalents
   * @param {string} content File content
   * @returns {string} Updated content
   */
  updateDirnameFilename(content) {
    // Check if we need to add the imports
    const needsImports = (
      /\b__dirname\b/.test(content) ||
      /\b__filename\b/.test(content)
    );

    if (!needsImports) {
      return content;
    }

    // Add import statements at the top if not already present
    let updated = content;
    const importStatements = [
      "import { fileURLToPath } from 'url';",
      "import path from 'path';"
    ];

    // Check if imports already exist
    const hasFileURLToPathImport = /import.*fileURLToPath.*from\s+['"]url['"]/.test(updated);
    const hasPathImport = /import.*path.*from\s+['"]path['"]/.test(updated);

    let importsToAdd = [];
    if (!hasFileURLToPathImport && (/\b__dirname\b/.test(updated) || /\b__filename\b/.test(updated))) {
      importsToAdd.push(importStatements[0]);
    }
    if (!hasPathImport && /\b__dirname\b/.test(updated)) {
      importsToAdd.push(importStatements[1]);
    }

    if (importsToAdd.length > 0) {
      // Find a good place to insert imports 
      // (after shebang and comments at the top, before other code)
      const lines = updated.split('\n');
      let insertLine = 0;

      // Skip shebang line if exists
      if (lines[0].startsWith('#!')) {
        insertLine = 1;
      }

      // Skip initial comments
      while (insertLine < lines.length &&
        (lines[insertLine].trim().startsWith('//') ||
          lines[insertLine].trim().startsWith('/*') ||
          lines[insertLine].trim() === '')) {
        insertLine++;

        // If we found the end of a multi-line comment, stop after it
        if (lines[insertLine - 1].trim().endsWith('*/')) {
          break;
        }
      }

      // Insert imports
      lines.splice(insertLine, 0, ...importsToAdd);
      updated = lines.join('\n');
    }

    // If we have __filename references, add the conversion code
    if (/\b__filename\b/.test(updated)) {
      const filenameConversion = "\nconst __filename = fileURLToPath(import.meta.url);";

      // Check if conversion already exists
      if (!updated.includes(filenameConversion) && !updated.includes('__filename = fileURLToPath')) {
        // Find appropriate place to insert the conversion
        // After imports but before other code
        const lines = updated.split('\n');
        let insertLine = 0;

        // Find last import statement
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].trim().startsWith('import ')) {
            insertLine = i + 1;
          } else if (insertLine > 0 && lines[i].trim() !== '') {
            break;
          }
        }

        lines.splice(insertLine, 0, filenameConversion);
        updated = lines.join('\n');
      }
    }

    // If we have __dirname references, add the conversion code
    if (/\b__dirname\b/.test(updated)) {
      const dirnameConversion = "\nconst __dirname = path.dirname(fileURLToPath(import.meta.url));";

      // Check if conversion already exists
      if (!updated.includes(dirnameConversion) && !updated.includes('__dirname = path.dirname')) {
        // Find appropriate place to insert the conversion
        // After __filename conversion if it exists, or after imports
        const lines = updated.split('\n');
        let insertLine = 0;

        // Check if __filename conversion exists
        const filenameIndex = lines.findIndex(line =>
          line.includes('__filename = fileURLToPath') ||
          line.includes('= fileURLToPath(import.meta.url)')
        );

        if (filenameIndex >= 0) {
          insertLine = filenameIndex + 1;
        } else {
          // Find last import statement
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().startsWith('import ')) {
              insertLine = i + 1;
            } else if (insertLine > 0 && lines[i].trim() !== '') {
              break;
            }
          }
        }

        lines.splice(insertLine, 0, dirnameConversion);
        updated = lines.join('\n');
      }
    }

    return updated;
  }

  /**
   * Update imports for dual-format modules
   * @param {string} content File content
   * @returns {string} Updated content
   */
  updateDualFormatImports(content) {
    // This function handles modules that need to support both ESM and CommonJS
    // It keeps the conditional logic but ensures proper formatting for both
    
    // Look for typical dual-format pattern
    const dualFormatPattern = /(?:typeof\s+require\s*!==\s*['"]undefined['"]|typeof\s+module\s*!==\s*['"]undefined['"])/;
    
    if (!dualFormatPattern.test(content)) {
      // Not a dual-format module, nothing to do
      return content;
    }
    
    // Ensure proper conditional handling for both formats
    let updated = content;
    
    // Standardize the conditional check
    updated = updated.replace(
      /if\s*\(\s*(?:typeof\s+require\s*!==\s*['"]undefined['"]|typeof\s+module\s*!==\s*['"]undefined['"])\s*\)\s*\{[\s\S]*?\}\s*else\s*\{[\s\S]*?\}/gm,
      (match) => {
        // Ensure the block has a consistent style
        return match.replace(
          /if\s*\(\s*((?:typeof\s+require\s*!==\s*['"]undefined['"]|typeof\s+module\s*!==\s*['"]undefined['"]))\s*\)/,
          'if (typeof require !== "undefined" && typeof module !== "undefined")'
        );
      }
    );
    
    return updated;
  }

  /**
   * Fix a single file
   * @param {string} filePath Path to the file
   * @returns {Promise<boolean>} True if file was fixed
   */
  async fixFile(filePath) {
    return tryCatch(async () => {
      if (!this.shouldProcessFile(filePath)) {
        this.log(`Skipping non-JS file: ${filePath}`);
        this.stats.skipped++;
        return false;
      }

      this.log(`Processing file: ${filePath}`);
      this.stats.analyzed++;

      // Read file content
      const [readError, content] = await tryCatch(async () => {
        return await fs.readFile(filePath, 'utf8');
      }, {
        context: {
          component: 'ModuleFormatStandardizer.fixFile.readFile',
          filePath
        }
      });
      
      if (readError) {
        this.stats.errors++;
        throw new FileSystemError(`Failed to read file: ${filePath}`, {
          cause: readError,
          filePath
        });
      }

      // Analyze the file
      const analysis = this.analyzeFile(filePath, content);
      this.log(`Detected format: ${analysis.format} for file: ${filePath}`);
      
      // Create backup if needed
      await this.createBackup(filePath, content);

      // Apply fixes
      let updated = content;
      if (analysis.format === 'esm' || analysis.needsMixedFormatFix) {
        if (analysis.needsImportFix) {
          updated = this.updateImports(updated);
        }
        if (analysis.needsExportFix) {
          updated = this.updateExports(updated);
        }
        if (analysis.needsDirnameFilename) {
          updated = this.updateDirnameFilename(updated);
        }
      } else if (analysis.format === 'dual') {
        updated = this.updateDualFormatImports(updated);
      }

      // Check if any changes were made
      if (updated === content && !analysis.recommendedExtension) {
        this.log(`No changes needed for: ${filePath}`);
        this.stats.skipped++;
        return false;
      }

      // Write updated content
      if (updated !== content) {
        this.log(`Updating content for: ${filePath}`);
        if (!this.dryRun) {
          const [writeError] = await tryCatch(async () => {
            await fs.writeFile(filePath, updated, 'utf8');
          }, {
            context: {
              component: 'ModuleFormatStandardizer.fixFile.writeFile',
              filePath
            }
          });
          
          if (writeError) {
            this.stats.errors++;
            throw new FileSystemError(`Failed to write fixed file: ${filePath}`, {
              cause: writeError,
              filePath
            });
          }
        }
        this.stats.fixed++;
      }

      // Rename file if needed
      if (analysis.recommendedExtension && this.renameFiles) {
        const directory = path.dirname(filePath);
        const baseName = path.basename(filePath, path.extname(filePath));
        const newPath = path.join(directory, `${baseName}${analysis.recommendedExtension}`);
        
        this.log(`Renaming file to match format: ${filePath} -> ${newPath}`);
        if (!this.dryRun) {
          const [renameError] = await tryCatch(async () => {
            await fs.rename(filePath, newPath);
          }, {
            context: {
              component: 'ModuleFormatStandardizer.fixFile.rename',
              filePath,
              newPath
            }
          });
          
          if (renameError) {
            this.stats.errors++;
            throw new FileSystemError(`Failed to rename file: ${filePath} -> ${newPath}`, {
              cause: renameError,
              filePath,
              newPath
            });
          }
        }
        this.stats.renamed++;
      }

      return true;
    }, {
      context: {
        component: 'ModuleFormatStandardizer.fixFile',
        filePath
      },
      onError: (error) => {
        console.error(`Error fixing file ${filePath}: ${error.message}`);
        this.stats.errors++;
        return false;
      }
    });
  }

  /**
   * Process a directory and its subdirectories
   * @param {string} dirPath Path to the directory
   * @returns {Promise<Object>} Stats object with fixed, skipped, and error counts
   */
  async fixDirectory(dirPath) {
    return tryCatch(async () => {
      const [readdirError, entries] = await tryCatch(async () => {
        return await fs.readdir(dirPath, { withFileTypes: true });
      }, {
        context: {
          component: 'ModuleFormatStandardizer.fixDirectory.readdir',
          dirPath
        }
      });
      
      if (readdirError) {
        this.stats.errors++;
        throw new FileSystemError(`Error reading directory: ${dirPath}`, {
          cause: readdirError,
          dirPath
        });
      }

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules, .git, dist, build directories
          const skipDirs = ['node_modules', '.git', 'dist', 'build', 'coverage'];
          if (skipDirs.includes(entry.name)) {
            continue;
          }

          // Process subdirectory
          await this.fixDirectory(entryPath);
        } else if (entry.isFile() && this.shouldProcessFile(entryPath)) {
          // Process file
          await this.fixFile(entryPath);
        }
      }

      return { ...this.stats };
    }, {
      context: {
        component: 'ModuleFormatStandardizer.fixDirectory',
        dirPath
      },
      onError: (error) => {
        console.error(`Error processing directory ${dirPath}: ${error.message}`);
        this.stats.errors++;
        return { ...this.stats };
      }
    });
  }
}

/**
 * Main function to run the standardizer
 */
export async function runModuleStandardization(options = {}) {
  const rootDir = options.rootDir || path.resolve(__dirname, '../../');
  const targetDir = options.targetDir || path.join(rootDir, 'src');
  const verbose = options.verbose !== false;
  const dryRun = options.dryRun === true;
  
  console.log(`Starting Module Format Standardization`);
  console.log(`Target directory: ${targetDir}`);
  console.log(`Dry run: ${dryRun ? 'Yes' : 'No'}`);
  
  const standardizer = new ModuleFormatStandardizer({
    verbose,
    dryRun,
    backup: true,
    renameFiles: options.renameFiles !== false
  });
  
  const startTime = Date.now();
  const stats = await standardizer.fixDirectory(targetDir);
  const duration = (Date.now() - startTime) / 1000;
  
  console.log(`\nModule Format Standardization Completed in ${duration.toFixed(2)}s`);
  console.log(`  Files analyzed: ${stats.analyzed}`);
  console.log(`  Files modified: ${stats.fixed}`);
  console.log(`  Files renamed: ${stats.renamed}`);
  console.log(`  Files skipped: ${stats.skipped}`);
  console.log(`  Errors encountered: ${stats.errors}`);
  
  return stats;
}

// Run the standardizer if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const options = {
    verbose: process.argv.includes('--verbose'),
    dryRun: process.argv.includes('--dry-run'),
    renameFiles: !process.argv.includes('--no-rename')
  };
  
  runModuleStandardization(options).catch(error => {
    console.error(`Error running module standardization: ${error.message}`);
    process.exit(1);
  });
}