/**
 * Module Format Fixer
 * 
 * This class converts CommonJS modules to ESM format by:
 * - Converting require() to import statements
 * - Converting module.exports to export statements
 * - Adding .js extensions to local imports
 * - Converting __dirname and __filename usage to ESM equivalents
 */

import fs from 'fs/promises';
import path from 'path';
import logger from '../common/logger.js';

export class ModuleFormatFixer {
    /**
     * Create a new ModuleFormatFixer
     * @param {Object} options Options for the fixer
     * @param {boolean} [options.verbose=false] Whether to log verbose output
     * @param {boolean} [options.dryRun=false] Whether to simulate fixes without making changes
     * @param {boolean} [options.backup=true] Whether to create backups of modified files
     */
    constructor(options = {}) {
        this.verbose = options.verbose || false;
        this.dryRun = options.dryRun || false;
        this.backup = options.backup !== false;
        this.stats = {
            fixed: 0,
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
            logger.debug(`[ModuleFormatFixer] ${message}`);
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
     * Check if a file needs module format fixes
     * @param {string} content File content
     * @returns {boolean} True if file needs fixes
     */
    needsFixes(content) {
        // Check for CommonJS patterns
        const hasRequire = /\brequire\s*\(/m.test(content);
        const hasModuleExports = /\bmodule\.exports\b/m.test(content);
        const hasExportsX = /\bexports\.\w+\s*=/m.test(content);
        const hasDirname = /\b__dirname\b/.test(content);
        const hasFilename = /\b__filename\b/.test(content);

        // Check for missing .js extensions in imports
        const missingJsExtensions = /import\s+.*\s+from\s+['"]\..*['"]\s*;/m.test(content) &&
            !/import\s+.*\s+from\s+['"]\..*\.js['"]\s*;/m.test(content);

        return hasRequire || hasModuleExports || hasExportsX || hasDirname || hasFilename || missingJsExtensions;
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
                await fs.writeFile(backupPath, content, 'utf8');
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
        updated = updated.replace(
            /exports\.(\w+)\s*=\s*([^;]+);?/gm,
            'export const $1 = $2;'
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
        if (!hasFileURLToPathImport && /\b__dirname\b/.test(updated) || /\b__filename\b/.test(updated)) {
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
     * Fix a single file
     * @param {string} filePath Path to the file
     * @returns {Promise<boolean>} True if file was fixed
     */
    async fixFile(filePath) {
        try {
            if (!this.shouldProcessFile(filePath)) {
                this.log(`Skipping non-JS file: ${filePath}`);
                this.stats.skipped++;
                return false;
            }

            this.log(`Processing file: ${filePath}`);
            const content = await fs.readFile(filePath, 'utf8');

            if (!this.needsFixes(content)) {
                this.log(`No fixes needed for: ${filePath}`);
                this.stats.skipped++;
                return false;
            }

            // Create backup if needed
            await this.createBackup(filePath, content);

            // Apply fixes
            let updated = content;
            updated = this.updateImports(updated);
            updated = this.updateExports(updated);
            updated = this.updateDirnameFilename(updated);

            if (updated === content) {
                this.log(`No changes needed for: ${filePath}`);
                this.stats.skipped++;
                return false;
            }

            this.log(`Fixing file: ${filePath}`);
            if (!this.dryRun) {
                await fs.writeFile(filePath, updated, 'utf8');
            }

            this.stats.fixed++;
            return true;
        } catch (error) {
            logger.error(`Error fixing file ${filePath}: ${error.message}`);
            this.stats.errors++;
            return false;
        }
    }

    /**
     * Process a directory and its subdirectories
     * @param {string} dirPath Path to the directory
     * @returns {Object} Stats object with fixed, skipped, and error counts
     */
    async fixDirectory(dirPath) {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const entryPath = path.join(dirPath, entry.name);

                if (entry.isDirectory()) {
                    // Skip node_modules, .git, dist, build directories
                    const skipDirs = ['node_modules', '.git', 'dist', 'build'];
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
        } catch (error) {
            logger.error(`Error processing directory ${dirPath}: ${error.message}`);
            this.stats.errors++;
            return { ...this.stats };
        }
    }
} 