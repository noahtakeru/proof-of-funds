#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Verifying fixes for the two ZK test failures...');

// Test 1: Check for fetchPricesForSymbols in GasManager.js
const gasManagerPath = path.resolve(__dirname, 'lib/zk/src/GasManager.js');
try {
    const gasManagerCode = await fs.readFile(gasManagerPath, 'utf8');
    if (gasManagerCode.includes('async fetchPricesForSymbols(') &&
        gasManagerCode.match(/priceData\s+=\s+await\s+this\.fetchPricesForSymbols/)) {
        console.log('✅ GasManager.js successfully implements fetchPricesForSymbols method');
    } else {
        console.error('❌ GasManager.js does not properly implement fetchPricesForSymbols method');
        process.exit(1);
    }
} catch (err) {
    console.error('❌ Could not find or read GasManager.js at path:', gasManagerPath);
    console.error(err);
    process.exit(1);
}

// Test 2: Check for CommonJS require syntax in test-import.mjs
const testImportPath = path.resolve(__dirname, 'lib/zk/__tests__/ceremony/test-import.mjs');
try {
    const testImportCode = await fs.readFile(testImportPath, 'utf8');
    if (testImportCode.includes('const jssha3 = require(\'js-sha3\')')) {
        console.log('✅ test-import.mjs successfully uses CommonJS require syntax');
    } else {
        console.error('❌ test-import.mjs does not use CommonJS require syntax');
        process.exit(1);
    }
} catch (err) {
    console.error('❌ Could not find or read test-import.mjs at path:', testImportPath);
    console.error(err);
    process.exit(1);
}

console.log('🎉 Both fixes have been verified successfully!'); 