/**
 * @fileoverview Wrapper for quick-fix.js
 * 
 * DEPRECATED: This script is deprecated and will be removed in a future version.
 * Please use lib/zk/scripts/zk-fix.js instead.
 * 
 * Example: node lib/zk/scripts/zk-fix.js --test-compat
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

console.warn('\x1b[33m%s\x1b[0m', 'DEPRECATED: quick-fix.js is deprecated. Please use lib/zk/scripts/zk-fix.js instead.');
console.warn('\x1b[33m%s\x1b[0m', 'Example: node lib/zk/scripts/zk-fix.js --test-compat');

// Determine script directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the new script
const newScriptPath = path.resolve(__dirname, '../scripts/zk-fix.js');

// Arguments to forward to the new script
const args = ['--test-compat'];

// Check if verbose mode was requested
if (process.argv.includes('--verbose')) {
    args.push('--verbose');
}

// Forward to the new script
const child = spawn('node', [newScriptPath, ...args], {
    stdio: 'inherit'
});

// Handle exit
child.on('close', (code) => {
    process.exit(code);
}); 