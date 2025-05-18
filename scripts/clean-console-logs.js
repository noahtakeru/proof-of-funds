#!/usr/bin/env node

/**
 * Script to remove console.log statements from source files
 * Preserves console.error and console.warn for error handling
 */

const fs = require('fs');
const path = require('path');

// Files to clean
const filesToClean = [
    'packages/frontend/pages/create.js',
    'packages/frontend/pages/verify.js',
    'packages/frontend/pages/_app.js',
    'packages/frontend/pages/api/zk/generateProof.js',
    'packages/frontend/pages/api/zk/generateProofSecure.js',
    'packages/frontend/pages/api/zk/generateProofCloudStorage.js',
    'packages/frontend/pages/api/zk/generateTempWallet.js',
    'packages/frontend/pages/api/zk/verify.js',
    'packages/frontend/pages/api/zk/fullProve.js',
    'packages/frontend/utils/zkErrorHandler.js',
    'packages/frontend/utils/apiErrorHandler.js',
    'packages/frontend/utils/zkeyStorageManager.js',
    'packages/common/src/zk-core/snarkjsWrapper.js',
    'packages/common/src/utils/ethersUtils.js',
    'packages/common/src/utils/apiHelpers.js',
    'packages/common/src/utils/moralisApi.js',
    'packages/common/src/utils/wallet.js',
    'packages/common/src/utils/walletHelpers.js'
];

function cleanConsoleLogsFromFile(filePath) {
    try {
        // Read the file
        const fullPath = path.join(process.cwd(), filePath);
        let content = fs.readFileSync(fullPath, 'utf8');
        const originalContent = content;
        
        // Remove console.log statements (single line)
        content = content.replace(/^[\t ]*console\.log\(.*\);?\s*$/gm, '');
        
        // Remove multi-line console.log statements
        content = content.replace(/^[\t ]*console\.log\([^;]*\n([^;]*\n)*[^;]*\);?\s*$/gm, '');
        
        // Remove console.log with object literals or function calls spanning multiple lines
        content = content.replace(/^[\t ]*console\.log\(\s*\{[\s\S]*?\}\s*\);?\s*$/gm, '');
        content = content.replace(/^[\t ]*console\.log\(\s*['"`][\s\S]*?['"`]\s*,[\s\S]*?\);?\s*$/gm, '');
        
        // Also clean up empty lines that might be left behind
        content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
        
        if (content !== originalContent) {
            fs.writeFileSync(fullPath, content, 'utf8');
            console.log(`Cleaned console.log statements from: ${filePath}`);
            return true;
        } else {
            console.log(`No console.log statements found in: ${filePath}`);
            return false;
        }
    } catch (error) {
        console.error(`Error processing ${filePath}:`, error.message);
        return false;
    }
}

// Clean all files
let filesModified = 0;
for (const file of filesToClean) {
    if (cleanConsoleLogsFromFile(file)) {
        filesModified++;
    }
}

console.log(`\nTotal files modified: ${filesModified}`);