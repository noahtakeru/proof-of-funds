/**
 * Specific module fixes utility
 * Extracted from fix-all-modules.js
 * 
 * Applies specific fixes to targeted modules including TrustedSetupManager,
 * browser compatibility, and ceremony test files.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../common/logger.js';

// Get dirname for ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Module-specific fixes registry
 * Maps module names to their fix functions
 */
const MODULE_FIXES = {
    'TrustedSetupManager': fixTrustedSetupManager,
    'ProofGenerator': fixProofGenerator,
    'CircuitRunner': fixCircuitRunner,
    'BrowserCompatibility': fixBrowserCompatibility,
    'CeremonyTest': fixCeremonyTest
};

/**
 * Template for browser compatibility wrapper
 */
const BROWSER_COMPAT_TEMPLATE = `/**
 * Browser compatibility wrapper
 * Automatically added by specific-fixes.js
 */

// Environment detection
const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

// Original module code
$ORIGINAL_CODE

// Browser compatibility layer
if (isBrowser) {
    // Polyfill Node.js specific APIs
    const nodePolyfills = {
        fs: {
            readFileSync: function(path) {
                throw new Error('File system operations not supported in browser');
            },
            writeFileSync: function(path, data) {
                throw new Error('File system operations not supported in browser');
            },
            existsSync: function(path) {
                return false;
            }
        },
        crypto: {
            randomBytes: function(size) {
                const array = new Uint8Array(size);
                window.crypto.getRandomValues(array);
                return array;
            }
        }
    };
    
    // Apply polyfills if APIs are used and not already available
    if ($USES_FS && typeof fs === 'undefined') {
        window.fs = nodePolyfills.fs;
    }
    
    if ($USES_CRYPTO && typeof crypto === 'undefined') {
        window.crypto = { ...window.crypto, ...nodePolyfills.crypto };
    }
}
`;

/**
 * Fix TrustedSetupManager module
 * @param {string} filePath - Path to module file
 * @param {Object} options - Fix options
 * @returns {boolean} Success status
 */
function fixTrustedSetupManager(filePath, options) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');

        // Check if this is the right file
        if (!content.includes('TrustedSetupManager') && !content.includes('trusted-setup')) {
            logger.warn(`File ${filePath} does not appear to be the TrustedSetupManager module`);
            return false;
        }

        let newContent = content;

        // Fix dynamic imports to work in both ESM and CommonJS
        if (content.includes('import(') && !content.includes('import.meta.url')) {
            logger.info(`Fixing dynamic imports in ${filePath}`);

            newContent = content.replace(
                /import\(\s*['"]([^'"]+)['"]\s*\)/g,
                (match, importPath) => {
                    return `(typeof require !== 'undefined' ? Promise.resolve(require('${importPath}')) : import('${importPath}'))`;
                }
            );
        }

        // Fix module.exports and export default mismatch
        if (content.includes('module.exports') && !content.includes('export default')) {
            logger.info(`Adding ESM compatibility to ${filePath}`);

            // Add ESM export at the end of the file
            newContent += '\n\n// ESM compatibility\nexport default module.exports;\n';
        }

        // Write changes if content was modified
        if (newContent !== content && !options.dryRun) {
            // Create backup if enabled
            if (options.backup) {
                const backupPath = `${filePath}.bak`;
                fs.copyFileSync(filePath, backupPath);
                logger.debug(`Created backup: ${backupPath}`);
            }

            fs.writeFileSync(filePath, newContent, 'utf8');
            logger.info(`Fixed TrustedSetupManager module: ${filePath}`);
            return true;
        } else if (newContent !== content) {
            logger.info(`[DRY RUN] Would fix TrustedSetupManager module: ${filePath}`);
            return true;
        } else {
            logger.debug(`No changes needed for ${filePath}`);
            return true;
        }
    } catch (error) {
        logger.error(`Error fixing TrustedSetupManager module ${filePath}:`, error.message);
        return false;
    }
}

/**
 * Fix ProofGenerator module
 * @param {string} filePath - Path to module file
 * @param {Object} options - Fix options
 * @returns {boolean} Success status
 */
function fixProofGenerator(filePath, options) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');

        // Check if this is the right file
        if (!content.includes('ProofGenerator') && !content.includes('generateProof')) {
            logger.warn(`File ${filePath} does not appear to be the ProofGenerator module`);
            return false;
        }

        let newContent = content;

        // Fix web worker compatibility
        if (content.includes('Worker(') && !content.includes('typeof Worker !== "undefined"')) {
            logger.info(`Adding Worker detection in ${filePath}`);

            // Add Worker detection
            const workerDetection = `
// Worker compatibility
const hasWorker = typeof Worker !== 'undefined';
`;

            // Add to the beginning of the file
            newContent = workerDetection + newContent;

            // Replace Worker instantiation with conditional check
            newContent = newContent.replace(
                /new\s+Worker\s*\(/g,
                'hasWorker ? new Worker('
            );

            // Add fallback for environments without Worker
            newContent = newContent.replace(
                /hasWorker\s*\?\s*new\s+Worker\s*\([^)]+\)/g,
                match => `${match} : { postMessage: () => {}, onmessage: () => {}, terminate: () => {} }`
            );
        }

        // Write changes if content was modified
        if (newContent !== content && !options.dryRun) {
            // Create backup if enabled
            if (options.backup) {
                const backupPath = `${filePath}.bak`;
                fs.copyFileSync(filePath, backupPath);
                logger.debug(`Created backup: ${backupPath}`);
            }

            fs.writeFileSync(filePath, newContent, 'utf8');
            logger.info(`Fixed ProofGenerator module: ${filePath}`);
            return true;
        } else if (newContent !== content) {
            logger.info(`[DRY RUN] Would fix ProofGenerator module: ${filePath}`);
            return true;
        } else {
            logger.debug(`No changes needed for ${filePath}`);
            return true;
        }
    } catch (error) {
        logger.error(`Error fixing ProofGenerator module ${filePath}:`, error.message);
        return false;
    }
}

/**
 * Fix CircuitRunner module
 * @param {string} filePath - Path to module file
 * @param {Object} options - Fix options
 * @returns {boolean} Success status
 */
function fixCircuitRunner(filePath, options) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');

        // Check if this is the right file
        if (!content.includes('CircuitRunner') && !content.includes('runCircuit')) {
            logger.warn(`File ${filePath} does not appear to be the CircuitRunner module`);
            return false;
        }

        let newContent = content;

        // Fix WebAssembly compatibility
        if (content.includes('WebAssembly') && !content.includes('typeof WebAssembly !== "undefined"')) {
            logger.info(`Adding WebAssembly detection in ${filePath}`);

            // Add WebAssembly detection
            const wasmDetection = `
// WebAssembly compatibility
const hasWebAssembly = typeof WebAssembly !== 'undefined';
`;

            // Add to the beginning of the file
            newContent = wasmDetection + newContent;

            // Replace WebAssembly usage with conditional check
            newContent = newContent.replace(
                /WebAssembly\.(compile|instantiate|instantiateStreaming)\s*\(/g,
                match => `hasWebAssembly ? ${match}`
            );

            // Add fallback for environments without WebAssembly
            newContent = newContent.replace(
                /hasWebAssembly\s*\?\s*WebAssembly\.(compile|instantiate|instantiateStreaming)\s*\([^)]+\)/g,
                match => `${match} : Promise.reject(new Error('WebAssembly not supported'))`
            );
        }

        // Write changes if content was modified
        if (newContent !== content && !options.dryRun) {
            // Create backup if enabled
            if (options.backup) {
                const backupPath = `${filePath}.bak`;
                fs.copyFileSync(filePath, backupPath);
                logger.debug(`Created backup: ${backupPath}`);
            }

            fs.writeFileSync(filePath, newContent, 'utf8');
            logger.info(`Fixed CircuitRunner module: ${filePath}`);
            return true;
        } else if (newContent !== content) {
            logger.info(`[DRY RUN] Would fix CircuitRunner module: ${filePath}`);
            return true;
        } else {
            logger.debug(`No changes needed for ${filePath}`);
            return true;
        }
    } catch (error) {
        logger.error(`Error fixing CircuitRunner module ${filePath}:`, error.message);
        return false;
    }
}

/**
 * Fix browser compatibility issues
 * @param {string} filePath - Path to module file
 * @param {Object} options - Fix options
 * @returns {boolean} Success status
 */
function fixBrowserCompatibility(filePath, options) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');

        // Check for Node.js specific APIs
        const usesFs = content.includes('fs.') || content.includes("require('fs')") || content.includes('require("fs")');
        const usesCrypto = content.includes('crypto.') || content.includes("require('crypto')") || content.includes('require("crypto")');

        // Skip if no Node.js specific APIs are used
        if (!usesFs && !usesCrypto) {
            logger.debug(`No Node.js specific APIs found in ${filePath}`);
            return true;
        }

        logger.info(`Adding browser compatibility layer to ${filePath}`);

        // Generate browser compatibility wrapper
        const newContent = BROWSER_COMPAT_TEMPLATE
            .replace('$ORIGINAL_CODE', content)
            .replace('$USES_FS', usesFs.toString())
            .replace('$USES_CRYPTO', usesCrypto.toString());

        // Write changes if not dry run
        if (!options.dryRun) {
            // Create backup if enabled
            if (options.backup) {
                const backupPath = `${filePath}.bak`;
                fs.copyFileSync(filePath, backupPath);
                logger.debug(`Created backup: ${backupPath}`);
            }

            fs.writeFileSync(filePath, newContent, 'utf8');
            logger.info(`Added browser compatibility layer to ${filePath}`);
            return true;
        } else {
            logger.info(`[DRY RUN] Would add browser compatibility layer to ${filePath}`);
            return true;
        }
    } catch (error) {
        logger.error(`Error adding browser compatibility to ${filePath}:`, error.message);
        return false;
    }
}

/**
 * Fix ceremony test files
 * @param {string} filePath - Path to module file
 * @param {Object} options - Fix options
 * @returns {boolean} Success status
 */
function fixCeremonyTest(filePath, options) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');

        // Check if this is a ceremony test file
        if (!content.includes('ceremony') && !content.includes('contribut')) {
            logger.warn(`File ${filePath} does not appear to be a ceremony test file`);
            return false;
        }

        let newContent = content;

        // Add ESM compatibility
        if (content.includes('describe(') && content.includes('it(') && !content.includes('export {')) {
            logger.info(`Adding ESM compatibility to ceremony test ${filePath}`);

            // Add ESM exports for Mocha globals
            const esmExports = `
// Export Mocha globals for ESM compatibility
export { describe, it, before, after, beforeEach, afterEach };
`;

            // Add to the end of the file
            newContent += esmExports;
        }

        // Fix imports/requires
        if (content.includes('require(') && content.includes('import ')) {
            logger.info(`Fixing mixed module formats in ceremony test ${filePath}`);

            // Add createRequire if needed
            if (!content.includes('createRequire')) {
                const createRequireImport = `import { createRequire } from 'module';
const require = createRequire(import.meta.url);

`;

                // Add to the beginning of the file
                newContent = createRequireImport + newContent;
            }
        }

        // Write changes if content was modified
        if (newContent !== content && !options.dryRun) {
            // Create backup if enabled
            if (options.backup) {
                const backupPath = `${filePath}.bak`;
                fs.copyFileSync(filePath, backupPath);
                logger.debug(`Created backup: ${backupPath}`);
            }

            fs.writeFileSync(filePath, newContent, 'utf8');
            logger.info(`Fixed ceremony test: ${filePath}`);
            return true;
        } else if (newContent !== content) {
            logger.info(`[DRY RUN] Would fix ceremony test: ${filePath}`);
            return true;
        } else {
            logger.debug(`No changes needed for ${filePath}`);
            return true;
        }
    } catch (error) {
        logger.error(`Error fixing ceremony test ${filePath}:`, error.message);
        return false;
    }
}

/**
 * Find module files in directory
 * @param {string} dirPath - Directory to search
 * @param {string} moduleName - Module name to look for
 * @param {string[]} ignoreDirs - Directories to ignore
 * @returns {string[]} Array of matching file paths
 */
function findModuleFiles(dirPath, moduleName, ignoreDirs = []) {
    const results = [];

    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);

            if (entry.isDirectory()) {
                // Skip ignored directories
                if (ignoreDirs.includes(entry.name)) {
                    continue;
                }

                // Search in subdirectory
                const subResults = findModuleFiles(fullPath, moduleName, ignoreDirs);
                results.push(...subResults);
            } else if (entry.isFile() && entry.name.endsWith('.js')) {
                // Quick check of file name
                if (entry.name.includes(moduleName) ||
                    entry.name.toLowerCase().includes(moduleName.toLowerCase())) {
                    results.push(fullPath);
                    continue;
                }

                // Check file content if less than 100KB (avoid large files)
                try {
                    const stats = fs.statSync(fullPath);
                    if (stats.size < 100 * 1024) {
                        const content = fs.readFileSync(fullPath, 'utf8');
                        if (content.includes(moduleName)) {
                            results.push(fullPath);
                        }
                    }
                } catch (error) {
                    // Ignore read errors and continue
                }
            }
        }
    } catch (error) {
        logger.error(`Error searching for module ${moduleName} in ${dirPath}:`, error.message);
    }

    return results;
}

/**
 * Specific module fixer class
 */
export class SpecificModuleFixer {
    /**
     * Create a new SpecificModuleFixer
     * @param {Object} options - Options
     * @param {boolean} options.verbose - Enable verbose logging
     * @param {boolean} options.dryRun - Don't actually modify files
     * @param {boolean} options.backup - Create backups of modified files
     * @param {string[]} options.ignoreDirs - Directories to ignore
     */
    constructor(options = {}) {
        this.verbose = options.verbose || false;
        this.dryRun = options.dryRun || false;
        this.backup = options.backup !== false;
        this.ignoreDirs = options.ignoreDirs || ['node_modules', 'dist', 'build', '.git'];

        // Configure logger
        this.logger = this.verbose ? logger : {
            info: () => { },
            debug: () => { },
            warn: logger.warn,
            error: logger.error
        };
    }

    /**
     * Fix a specific module
     * @param {string} moduleName - Module name to fix
     * @param {string} filePath - Path to module file (optional)
     * @returns {Object} Results of the operation
     */
    fixModule(moduleName, filePath) {
        const results = {
            module: moduleName,
            fixed: 0,
            errors: 0,
            skipped: 0
        };

        // Check if module has a registered fix function
        if (!MODULE_FIXES[moduleName]) {
            this.logger.error(`No fix function registered for module: ${moduleName}`);
            results.errors++;
            return results;
        }

        // Fix function options
        const fixOptions = {
            dryRun: this.dryRun,
            backup: this.backup,
            verbose: this.verbose
        };

        // If file path is provided, fix that specific file
        if (filePath) {
            const success = MODULE_FIXES[moduleName](filePath, fixOptions);

            if (success) {
                results.fixed++;
            } else {
                results.errors++;
            }

            return results;
        }

        // Find module files and fix them
        this.logger.info(`Searching for ${moduleName} module files...`);

        const moduleFiles = findModuleFiles(
            path.resolve(__dirname, '../../'),
            moduleName,
            this.ignoreDirs
        );

        if (moduleFiles.length === 0) {
            this.logger.warn(`No files found for module: ${moduleName}`);
            return results;
        }

        this.logger.info(`Found ${moduleFiles.length} files for module ${moduleName}`);

        // Apply fixes to each file
        for (const moduleFile of moduleFiles) {
            this.logger.debug(`Applying ${moduleName} fix to ${moduleFile}`);

            const success = MODULE_FIXES[moduleName](moduleFile, fixOptions);

            if (success) {
                results.fixed++;
            } else {
                results.errors++;
            }
        }

        return results;
    }

    /**
     * Fix all modules in the specified modules array
     * @param {string[]} modules - Array of module names to fix
     * @returns {Object} Results of the operation
     */
    fixAllModules(modules) {
        const results = {
            modules: [],
            totalFixed: 0,
            totalErrors: 0,
            totalSkipped: 0
        };

        // Filter modules to those with registered fix functions
        const validModules = modules.filter(module => {
            if (!MODULE_FIXES[module]) {
                this.logger.warn(`No fix function registered for module: ${module}`);
                return false;
            }
            return true;
        });

        if (validModules.length === 0) {
            this.logger.error('No valid modules to fix');
            return results;
        }

        // Fix each module
        for (const module of validModules) {
            this.logger.info(`Fixing module: ${module}`);

            const moduleResults = this.fixModule(module);

            results.modules.push(moduleResults);
            results.totalFixed += moduleResults.fixed;
            results.totalErrors += moduleResults.errors;
            results.totalSkipped += moduleResults.skipped;
        }

        return results;
    }
}

/**
 * Fix specific modules
 * @param {Object} options - Options
 * @returns {Promise<Object>} Results of the operation
 */
export async function fixSpecificModules(options = {}) {
    const fixer = new SpecificModuleFixer({
        verbose: options.verbose || false,
        dryRun: options.dryRun || false,
        backup: options.backup !== false,
        ignoreDirs: options.ignoreDirs || ['node_modules', 'dist', 'build', '.git']
    });

    const modules = options.modules || Object.keys(MODULE_FIXES);

    fixer.logger.info(`Starting specific module fixes for: ${modules.join(', ')}`);

    const results = fixer.fixAllModules(modules);

    fixer.logger.info(`Module fixes completed: fixed=${results.totalFixed}, errors=${results.totalErrors}, skipped=${results.totalSkipped}`);

    return results;
}

export default fixSpecificModules; 