/**
 * Test Compatibility Fixer
 * 
 * Ensures test files are compatible with the test framework by:
 * - Converting test files to ESM format
 * - Updating imports to use .js extensions
 * - Standardizing test function signatures
 * - Adding proper imports for test framework
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../common/logger.js';

// Get directory name in ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Fixer for test compatibility issues
 */
export class TestCompatFixer {
    /**
     * Constructor
     * @param {Object} options - Configuration options
     * @param {boolean} options.verbose - Whether to output verbose logs
     * @param {boolean} options.dryRun - Whether to only show what would be fixed without making changes
     * @param {boolean} options.backup - Whether to create backups of modified files
     * @param {string[]} options.testDirs - Test directories to process
     */
    constructor(options = {}) {
        this.verbose = options.verbose ?? false;
        this.dryRun = options.dryRun ?? false;
        this.backup = options.backup ?? true;
        this.testDirs = options.testDirs ?? ['tests', 'test', '__tests__'];
        this.fixedCount = 0;
        this.errorCount = 0;
    }

    /**
     * Log a message if verbose mode is enabled
     * @param {string} message - Message to log
     */
    log(message) {
        if (this.verbose) {
            logger.debug(`[TestCompatFixer] ${message}`);
        }
    }

    /**
     * Determine if a file is a test file
     * @param {string} filePath - Path to check
     * @returns {boolean} Whether the file is a test file
     */
    isTestFile(filePath) {
        // Check file extension
        if (!filePath.endsWith('.js') && !filePath.endsWith('.mjs') && !filePath.endsWith('.test.js')) {
            return false;
        }

        // Check if file is in a test directory
        for (const testDir of this.testDirs) {
            if (filePath.includes(`/${testDir}/`)) {
                return true;
            }
        }

        // Check if filename contains test or spec
        const fileName = path.basename(filePath);
        return fileName.includes('.test.') || fileName.includes('.spec.') ||
            fileName.startsWith('test-') || fileName.startsWith('test_');
    }

    /**
     * Create a backup of a file before modifying it
     * @param {string} filePath - Path to the file
     * @param {string} content - Original content
     * @returns {Promise<void>}
     */
    async createBackup(filePath, content) {
        if (!this.backup) return;

        const backupPath = `${filePath}.bak`;
        this.log(`Creating backup: ${backupPath}`);

        if (!this.dryRun) {
            await fs.writeFile(backupPath, content, 'utf8');
        }
    }

    /**
     * Fix imports in test files
     * @param {string} content - File content
     * @returns {string} Updated content
     */
    fixTestImports(content) {
        let updatedContent = content;

        // Add jest imports if missing and file uses jest
        if (content.includes('describe(') || content.includes('test(') ||
            content.includes('it(') || content.includes('expect(')) {

            // Check if jest is already imported
            if (!content.includes('import') || !content.includes('jest')) {
                // Add jest import at the beginning of the file, after any comments or 'use strict'
                updatedContent = updatedContent.replace(
                    /^((?:\/\/.*\n|\/\*[\s\S]*?\*\/\n|['"]use strict['"];?\n)*)/,
                    '$1import { describe, it, test, expect, beforeEach, afterEach, beforeAll, afterAll } from \'@jest/globals\';\n\n'
                );
            }
        }

        // Fix relative imports to add .js extension if missing
        const importPattern = /import\s+(?:(?:{[^}]*})|(?:[a-zA-Z0-9_]+))\s+from\s+['"]([^'"]+)['"];?/g;

        updatedContent = updatedContent.replace(importPattern, (match, importPath) => {
            // Don't modify absolute imports, node_modules imports, or those with extensions
            if (importPath.startsWith('@') ||
                importPath.startsWith('/') ||
                importPath.includes('.js') ||
                !importPath.includes('/')) {
                return match;
            }

            // Add .js extension to relative imports
            return match.replace(`'${importPath}'`, `'${importPath}.js'`);
        });

        return updatedContent;
    }

    /**
     * Fix test function signatures
     * @param {string} content - File content
     * @returns {string} Updated content
     */
    fixTestFunctions(content) {
        let updatedContent = content;

        // Replace describe('...', function() { with describe('...', () => {
        updatedContent = updatedContent.replace(
            /describe\s*\(\s*(['"].*?['"])\s*,\s*function\s*\(\s*\)\s*{/g,
            'describe($1, () => {'
        );

        // Replace it('...', function() { with it('...', () => {
        updatedContent = updatedContent.replace(
            /it\s*\(\s*(['"].*?['"])\s*,\s*function\s*\(\s*\)\s*{/g,
            'it($1, () => {'
        );

        // Replace test('...', function() { with test('...', () => {
        updatedContent = updatedContent.replace(
            /test\s*\(\s*(['"].*?['"])\s*,\s*function\s*\(\s*\)\s*{/g,
            'test($1, () => {'
        );

        // Replace beforeEach(function() { with beforeEach(() => {
        updatedContent = updatedContent.replace(
            /beforeEach\s*\(\s*function\s*\(\s*\)\s*{/g,
            'beforeEach(() => {'
        );

        // Replace afterEach(function() { with afterEach(() => {
        updatedContent = updatedContent.replace(
            /afterEach\s*\(\s*function\s*\(\s*\)\s*{/g,
            'afterEach(() => {'
        );

        return updatedContent;
    }

    /**
     * Fix done callbacks in async tests
     * @param {string} content - File content
     * @returns {string} Updated content
     */
    fixAsyncTests(content) {
        let updatedContent = content;

        // Replace it('...', (done) => { with it('...', async () => {
        updatedContent = updatedContent.replace(
            /it\s*\(\s*(['"].*?['"])\s*,\s*\(\s*done\s*\)\s*=>\s*{(?!\s*done\(\);)/g,
            (match, testName) => {
                // Only replace if there's a done() call in the function body
                const functionBody = content.slice(content.indexOf(match) + match.length);
                const closingBraceIndex = findClosingBrace(functionBody);

                if (closingBraceIndex !== -1 && functionBody.slice(0, closingBraceIndex).includes('done(')) {
                    return `it(${testName}, async () => {`;
                }

                return match;
            }
        );

        // Replace done() with nothing in async tests
        updatedContent = updatedContent.replace(
            /it\s*\(\s*(['"].*?['"])\s*,\s*async\s*\(\s*\)\s*=>\s*{([\s\S]*?)done\(\);([\s\S]*?)}\s*\)/g,
            'it($1, async () => {$2$3})'
        );

        return updatedContent;
    }

    /**
     * Fix a single test file
     * @param {string} filePath - Path to the file
     * @returns {Promise<boolean>} Whether the file was fixed
     */
    async fixFile(filePath) {
        try {
            this.log(`Processing test file: ${filePath}`);

            // Read file content
            const content = await fs.readFile(filePath, 'utf8');

            // Apply fixes
            let updatedContent = content;
            updatedContent = this.fixTestImports(updatedContent);
            updatedContent = this.fixTestFunctions(updatedContent);
            updatedContent = this.fixAsyncTests(updatedContent);

            // Check if content was changed
            if (content === updatedContent) {
                this.log(`No changes needed for ${filePath}`);
                return false;
            }

            // Create backup of original file
            await this.createBackup(filePath, content);

            // Write updated content
            if (!this.dryRun) {
                this.log(`Updating file: ${filePath}`);
                await fs.writeFile(filePath, updatedContent, 'utf8');
            } else {
                this.log(`[DRY RUN] Would update: ${filePath}`);
            }

            this.fixedCount++;
            return true;
        } catch (error) {
            logger.error(`Error fixing test file ${filePath}: ${error.message}`);
            this.errorCount++;
            return false;
        }
    }

    /**
     * Process a directory recursively
     * @param {string} dirPath - Path to the directory
     * @returns {Promise<Object>} Results with fixed count and error count
     */
    async fixDirectory(dirPath) {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);

                if (entry.isDirectory()) {
                    // Skip node_modules and other irrelevant directories
                    if (entry.name === 'node_modules' || entry.name === '.git' ||
                        entry.name === 'dist' || entry.name === 'build') {
                        continue;
                    }

                    // Process subdirectory recursively
                    await this.fixDirectory(fullPath);
                } else if (entry.isFile() && this.isTestFile(fullPath)) {
                    // Process test file
                    await this.fixFile(fullPath);
                }
            }

            return {
                fixed: this.fixedCount,
                errors: this.errorCount
            };
        } catch (error) {
            logger.error(`Error processing directory ${dirPath}: ${error.message}`);
            this.errorCount++;
            return {
                fixed: this.fixedCount,
                errors: this.errorCount
            };
        }
    }
}

/**
 * Helper function to find the index of the closing brace matching the opening brace at the start
 * @param {string} text - Text to search in
 * @returns {number} Index of closing brace or -1 if not found
 */
function findClosingBrace(text) {
    let braceCount = 1;
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '{') {
            braceCount++;
        } else if (text[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
                return i;
            }
        }
    }
    return -1;
}

export default TestCompatFixer; 