/**
 * Test Compatibility Fixer
 * 
 * This class updates test files to be compatible with Node.js test runner:
 * - Converts Mocha/Jest syntax to Node's test API
 * - Updates assertion libraries to use Node's built-in assert
 * - Adds ESM imports for test runner
 * - Updates async test handling
 */

import fs from 'fs/promises';
import path from 'path';
import logger from '../common/logger.js';
import {
    errorHandler,
    FileSystemError,
    ValidationError,
    tryExecAsync
} from '../common/error-handler.js';

export class TestCompatFixer {
    /**
     * Create a new TestCompatFixer
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

        // Create a module-specific logger
        this.logger = logger.child('test-compat-fixer');
    }

    /**
     * Log a message if verbose mode is enabled
     * @param {string} message Message to log
     */
    log(message) {
        if (this.verbose) {
            this.logger.debug(message);
        }
    }

    /**
     * Check if file should be processed based on name and content
     * @param {string} filePath Path to the file
     * @returns {Promise<boolean>} True if file should be processed
     */
    async shouldProcessFile(filePath) {
        return tryExecAsync(async () => {
            // Only process test files
            const fileName = path.basename(filePath);
            const isTestFile =
                fileName.endsWith('.test.js') ||
                fileName.endsWith('.spec.js') ||
                (fileName.startsWith('test-') && fileName.endsWith('.js'));

            if (!isTestFile) {
                return false;
            }

            // Read file content
            try {
                const content = await fs.readFile(filePath, 'utf8');

                // Check if it's a test file by looking for test frameworks
                return this.isTestFile(content);
            } catch (error) {
                throw new FileSystemError(`Failed to read file for processing: ${filePath}`, {
                    cause: error,
                    module: 'test-compat-fixer',
                    operation: 'shouldProcessFile',
                    context: { filePath }
                });
            }
        }, {
            rethrow: false,
            module: 'test-compat-fixer',
            operation: 'shouldProcessFile',
            context: { filePath },
            onError: (error) => {
                this.logger.error(`Error checking file ${filePath}: ${error.message}`);
                return false;
            }
        });
    }

    /**
     * Check if content is a test file
     * @param {string} content File content
     * @returns {boolean} True if it's a test file
     */
    isTestFile(content) {
        // Check for test framework patterns
        const mochaPatterns = [
            /\bdescribe\s*\(/,
            /\bit\s*\(/,
            /\bbefore(?:Each)?\s*\(/,
            /\bafter(?:Each)?\s*\(/,
        ];

        const jestPatterns = [
            /\btest\s*\(/,
            /\bexpect\s*\(/,
            /\bjest\b/,
            /\bbeforeAll\s*\(/,
            /\bafterAll\s*\(/,
        ];

        // Check if any test patterns exist
        return (
            mochaPatterns.some(pattern => pattern.test(content)) ||
            jestPatterns.some(pattern => pattern.test(content))
        );
    }

    /**
     * Check if file needs compatibility fixes
     * @param {string} content File content
     * @returns {boolean} True if file needs fixes
     */
    needsFixes(content) {
        // Check if the file is already using Node.js test runner
        const alreadyUsingNodeTest = (
            /\bimport\s+test\s+from\s+['"]node:test['"]/m.test(content) ||
            /\bimport\s+{\s*test\s*}\s+from\s+['"]node:test['"]/m.test(content) ||
            /\bconst\s+test\s+=\s+require\(['"]node:test['"]\)/m.test(content)
        );

        if (alreadyUsingNodeTest) {
            return false;
        }

        // Check if it has test frameworks that need conversion
        return this.isTestFile(content);
    }

    /**
     * Create backup of the file before modifying
     * @param {string} filePath Path to the file
     * @param {string} content Original content
     */
    async createBackup(filePath, content) {
        return tryExecAsync(async () => {
            if (this.backup) {
                const backupPath = `${filePath}.bak`;
                this.log(`Creating backup at ${backupPath}`);
                if (!this.dryRun) {
                    await fs.writeFile(backupPath, content, 'utf8');
                }
            }
        }, {
            rethrow: false,
            module: 'test-compat-fixer',
            operation: 'createBackup',
            context: { filePath },
            onError: (error) => {
                this.logger.warn(`Failed to create backup of ${filePath}: ${error.message}`);
            }
        });
    }

    /**
     * Add imports for Node.js test API
     * @param {string} content File content
     * @returns {string} Updated content
     */
    addTestImports(content) {
        // Check if the imports already exist
        if (
            /import\s+test\s+from\s+['"]node:test['"]/m.test(content) ||
            /import\s+{\s*test\s*}\s+from\s+['"]node:test['"]/m.test(content)
        ) {
            return content;
        }

        // Check for assertion imports
        const hasAssertImport = (
            /import\s+assert\s+from\s+['"]node:assert['"]/m.test(content) ||
            /import\s+{\s*.*\s*}\s+from\s+['"]node:assert['"]/m.test(content)
        );

        // Create import statements
        const imports = [];
        imports.push("import test from 'node:test';");

        if (!hasAssertImport) {
            imports.push("import assert from 'node:assert';");
        }

        // Add imports to the top of the file
        let lines = content.split('\n');

        // Find a good position to insert imports
        let insertPos = 0;

        // Skip shebang
        if (lines[0].startsWith('#!')) {
            insertPos = 1;
        }

        // Skip comments at the top
        while (
            insertPos < lines.length &&
            (lines[insertPos].trim().startsWith('//') ||
                lines[insertPos].trim().startsWith('/*') ||
                lines[insertPos].trim() === '')
        ) {
            insertPos++;
            // If we find the end of a comment block, stop after it
            if (lines[insertPos - 1].trim().endsWith('*/')) {
                break;
            }
        }

        // Insert imports
        lines.splice(insertPos, 0, ...imports, '');
        return lines.join('\n');
    }

    /**
     * Convert Mocha/Jest describe blocks to Node.js test blocks
     * @param {string} content File content
     * @returns {string} Updated content
     */
    convertDescribeBlocks(content) {
        // Convert describe blocks
        let updated = content.replace(
            /(?<!\w)describe\s*\(\s*(['"`])(.+?)\1\s*,\s*(?:async\s*)?(function\s*\(\s*\)|function\s*\(\)\s*|\(\s*\)\s*=>\s*)\s*\{/g,
            "test($1$2$1, async (t) => {"
        );

        // Remove closing brackets for describe blocks
        // This is tricky and might not be perfect for all cases
        // In complex cases, manual adjustment might be needed

        return updated;
    }

    /**
     * Convert Mocha/Jest it/test blocks to Node.js test blocks
     * @param {string} content File content
     * @returns {string} Updated content
     */
    convertTestBlocks(content) {
        // Convert "it" blocks
        let updated = content.replace(
            /(?<!\w)it\s*\(\s*(['"`])(.+?)\1\s*,\s*(?:async\s*)?(function\s*\(\s*\)|function\s*\(\)\s*|\(\s*\)\s*=>\s*)\s*\{/g,
            "t.test($1$2$1, async (t) => {"
        );

        // Convert "test" blocks (from Jest)
        updated = updated.replace(
            /(?<!\w)test\s*\(\s*(['"`])(.+?)\1\s*,\s*(?:async\s*)?(function\s*\(\s*\)|function\s*\(\)\s*|\(\s*\)\s*=>\s*)\s*\{/g,
            "t.test($1$2$1, async (t) => {"
        );

        return updated;
    }

    /**
     * Convert before/after hooks to Node.js t.before/t.after
     * @param {string} content File content
     * @returns {string} Updated content
     */
    convertHooks(content) {
        // Convert beforeEach
        let updated = content.replace(
            /(?<!\w)beforeEach\s*\(\s*(?:async\s*)?(function\s*\(\s*\)|function\s*\(\)\s*|\(\s*\)\s*=>\s*)\s*\{/g,
            "t.beforeEach(async () => {"
        );

        // Convert afterEach
        updated = updated.replace(
            /(?<!\w)afterEach\s*\(\s*(?:async\s*)?(function\s*\(\s*\)|function\s*\(\)\s*|\(\s*\)\s*=>\s*)\s*\{/g,
            "t.afterEach(async () => {"
        );

        // Convert before
        updated = updated.replace(
            /(?<!\w)before\s*\(\s*(?:async\s*)?(function\s*\(\s*\)|function\s*\(\)\s*|\(\s*\)\s*=>\s*)\s*\{/g,
            "t.before(async () => {"
        );

        // Convert after
        updated = updated.replace(
            /(?<!\w)after\s*\(\s*(?:async\s*)?(function\s*\(\s*\)|function\s*\(\)\s*|\(\s*\)\s*=>\s*)\s*\{/g,
            "t.after(async () => {"
        );

        // Convert beforeAll (Jest)
        updated = updated.replace(
            /(?<!\w)beforeAll\s*\(\s*(?:async\s*)?(function\s*\(\s*\)|function\s*\(\)\s*|\(\s*\)\s*=>\s*)\s*\{/g,
            "t.before(async () => {"
        );

        // Convert afterAll (Jest)
        updated = updated.replace(
            /(?<!\w)afterAll\s*\(\s*(?:async\s*)?(function\s*\(\s*\)|function\s*\(\)\s*|\(\s*\)\s*=>\s*)\s*\{/g,
            "t.after(async () => {"
        );

        return updated;
    }

    /**
     * Convert assertion libraries to Node's assert
     * @param {string} content File content
     * @returns {string} Updated content
     */
    convertAssertions(content) {
        let updated = content;

        // Convert expect().to.be.true to assert(x === true)
        updated = updated.replace(
            /expect\(([^)]+)\)\.to\.be\.true/g,
            "assert($1 === true)"
        );

        // Convert expect().to.be.false to assert(x === false)
        updated = updated.replace(
            /expect\(([^)]+)\)\.to\.be\.false/g,
            "assert($1 === false)"
        );

        // Convert expect().to.equal
        updated = updated.replace(
            /expect\(([^)]+)\)\.to\.equal\(([^)]+)\)/g,
            "assert.strictEqual($1, $2)"
        );

        // Convert expect().toBe (Jest)
        updated = updated.replace(
            /expect\(([^)]+)\)\.toBe\(([^)]+)\)/g,
            "assert.strictEqual($1, $2)"
        );

        // Convert expect().to.deep.equal
        updated = updated.replace(
            /expect\(([^)]+)\)\.to\.deep\.equal\(([^)]+)\)/g,
            "assert.deepStrictEqual($1, $2)"
        );

        // Convert expect().toEqual (Jest)
        updated = updated.replace(
            /expect\(([^)]+)\)\.toEqual\(([^)]+)\)/g,
            "assert.deepStrictEqual($1, $2)"
        );

        // Convert expect().to.throw
        updated = updated.replace(
            /expect\(\(\) => ([^)]+)\)\.to\.throw/g,
            "assert.throws(() => $1)"
        );

        // Convert expect().toThrow (Jest)
        updated = updated.replace(
            /expect\(\(\) => ([^)]+)\)\.toThrow/g,
            "assert.throws(() => $1)"
        );

        // Convert chai assert.equal to assert.strictEqual
        updated = updated.replace(
            /assert\.equal\(([^,]+),\s*([^)]+)\)/g,
            "assert.strictEqual($1, $2)"
        );

        return updated;
    }

    /**
     * Clean up imports for assertion libraries that are no longer used
     * @param {string} content File content
     * @returns {string} Updated content
     */
    cleanupImports(content) {
        let updated = content;

        // Remove chai imports
        updated = updated.replace(
            /(?:const|let|var)\s+{\s*(?:expect|assert|should)[^}]*}\s*=\s*require\(['"]chai['"]\);?/g,
            ""
        );

        updated = updated.replace(
            /import\s+{\s*(?:expect|assert|should)[^}]*}\s+from\s+['"]chai['"];?/g,
            ""
        );

        // Remove jest expect imports
        updated = updated.replace(
            /(?:const|let|var)\s+{\s*expect[^}]*}\s*=\s*require\(['"]@jest\/globals['"]\);?/g,
            ""
        );

        updated = updated.replace(
            /import\s+{\s*expect[^}]*}\s+from\s+['"]@jest\/globals['"];?/g,
            ""
        );

        return updated;
    }

    /**
     * Fix a single file
     * @param {string} filePath Path to the file
     * @returns {Promise<boolean>} True if file was fixed
     */
    async fixFile(filePath) {
        return tryExecAsync(async () => {
            if (!(await this.shouldProcessFile(filePath))) {
                this.log(`Skipping non-test file: ${filePath}`);
                this.stats.skipped++;
                return false;
            }

            this.log(`Processing file: ${filePath}`);

            // Read file content
            let content;
            try {
                content = await fs.readFile(filePath, 'utf8');
            } catch (error) {
                throw new FileSystemError(`Failed to read test file: ${filePath}`, {
                    cause: error,
                    module: 'test-compat-fixer',
                    operation: 'readFile',
                    context: { filePath }
                });
            }

            if (!this.needsFixes(content)) {
                this.log(`No fixes needed for: ${filePath}`);
                this.stats.skipped++;
                return false;
            }

            // Create backup if needed
            await this.createBackup(filePath, content);

            // Apply fixes
            let updated = content;
            updated = this.cleanupImports(updated);
            updated = this.addTestImports(updated);
            updated = this.convertDescribeBlocks(updated);
            updated = this.convertTestBlocks(updated);
            updated = this.convertHooks(updated);
            updated = this.convertAssertions(updated);

            if (updated === content) {
                this.log(`No changes needed for: ${filePath}`);
                this.stats.skipped++;
                return false;
            }

            this.log(`Fixing file: ${filePath}`);
            if (!this.dryRun) {
                try {
                    await fs.writeFile(filePath, updated, 'utf8');
                } catch (error) {
                    throw new FileSystemError(`Failed to write updated test file: ${filePath}`, {
                        cause: error,
                        module: 'test-compat-fixer',
                        operation: 'writeFile',
                        context: { filePath }
                    });
                }
            }

            this.stats.fixed++;
            return true;
        }, {
            rethrow: false,
            module: 'test-compat-fixer',
            operation: 'fixFile',
            context: { filePath },
            onError: (error) => {
                this.logger.error(`Error fixing test file ${filePath}: ${error.message}`);
                this.stats.errors++;
                return false;
            }
        });
    }

    /**
     * Process a directory recursively
     * @param {string} dirPath Path to the directory
     * @returns {Promise<object>} Stats object with counts of fixed and skipped files
     */
    async fixDirectory(dirPath) {
        return tryExecAsync(async () => {
            try {
                this.log(`Processing directory: ${dirPath}`);
                const entries = await fs.readdir(dirPath, { withFileTypes: true });

                for (const entry of entries) {
                    const fullPath = path.join(dirPath, entry.name);

                    // Skip node_modules, .git, dist, build directories
                    if (entry.isDirectory() &&
                        !['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
                        // Process subdirectory
                        await this.fixDirectory(fullPath);
                    } else if (entry.isFile()) {
                        // Process file
                        await this.fixFile(fullPath);
                    }
                }

                return this.stats;
            } catch (error) {
                throw new FileSystemError(`Failed to process directory: ${dirPath}`, {
                    cause: error,
                    module: 'test-compat-fixer',
                    operation: 'readDirectory',
                    context: { dirPath }
                });
            }
        }, {
            rethrow: false,
            module: 'test-compat-fixer',
            operation: 'fixDirectory',
            context: { dirPath },
            onError: (error) => {
                this.logger.error(`Error processing directory ${dirPath}: ${error.message}`);
                this.stats.errors++;
                return this.stats;
            }
        });
    }
} 