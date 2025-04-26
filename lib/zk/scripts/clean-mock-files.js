#!/usr/bin/env node

/**
 * Script to clean up mock and temporary files in the project
 * This script reads the list of patterns from mock_files_to_delete.txt
 * and deletes matching files
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const { promisify } = require('util');

const globPromise = promisify(glob);
const unlinkPromise = promisify(fs.unlink);
const readFilePromise = promisify(fs.readFile);

const ZK_ROOT = path.join(__dirname, '..');
const MOCK_FILES_LIST = path.join(ZK_ROOT, 'mock_files_to_delete.txt');

async function cleanMockFiles() {
    try {
        // Read the list of patterns from the mock_files_to_delete.txt file
        const patternsText = await readFilePromise(MOCK_FILES_LIST, 'utf8');
        const patterns = patternsText
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#')); // Skip empty lines and comments

        console.log('Cleaning up mock and temporary files...');
        console.log(`Found ${patterns.length} patterns to match`);

        let totalFilesDeleted = 0;

        for (const pattern of patterns) {
            // Make the pattern relative to the ZK_ROOT
            const fullPattern = path.join(ZK_ROOT, pattern);

            try {
                // Find files matching the pattern
                const matchingFiles = await globPromise(fullPattern, { dot: true });

                if (matchingFiles.length > 0) {
                    console.log(`\nFound ${matchingFiles.length} files matching pattern: ${pattern}`);

                    // Delete each file
                    for (const file of matchingFiles) {
                        try {
                            await unlinkPromise(file);
                            console.log(`  Deleted: ${path.relative(ZK_ROOT, file)}`);
                            totalFilesDeleted++;
                        } catch (deleteError) {
                            console.error(`  Error deleting ${path.relative(ZK_ROOT, file)}: ${deleteError.message}`);
                        }
                    }
                }
            } catch (globError) {
                console.error(`Error matching pattern ${pattern}: ${globError.message}`);
            }
        }

        console.log(`\nCleanup complete. Deleted ${totalFilesDeleted} files.`);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.error(`Error: Could not find ${MOCK_FILES_LIST}`);
            console.error('Please ensure that the mock_files_to_delete.txt file exists at the root of the zk library.');
        } else {
            console.error('An error occurred during cleanup:', error);
        }
        process.exit(1);
    }
}

cleanMockFiles(); 