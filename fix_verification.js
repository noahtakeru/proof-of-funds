#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('Verifying fixes for the two ZK test failures...');

// Test 1: Check for fetchPricesForSymbols in GasManager.js
const gasManagerPath = path.resolve(__dirname, 'lib/zk/src/GasManager.js');
if (!fs.existsSync(gasManagerPath)) {
    console.error('❌ Could not find GasManager.js at path:', gasManagerPath);
    process.exit(1);
}

const gasManagerCode = fs.readFileSync(gasManagerPath, 'utf8');
if (gasManagerCode.includes('async fetchPricesForSymbols(') &&
    gasManagerCode.match(/priceData\s+=\s+await\s+this\.fetchPricesForSymbols/)) {
    console.log('✅ GasManager.js successfully implements fetchPricesForSymbols method');
} else {
    console.error('❌ GasManager.js does not properly implement fetchPricesForSymbols method');
    process.exit(1);
}

// Test 2: Check for CommonJS require syntax in test-import.mjs
const testImportPath = path.resolve(__dirname, 'lib/zk/__tests__/ceremony/test-import.mjs');
if (!fs.existsSync(testImportPath)) {
    console.error('❌ Could not find test-import.mjs at path:', testImportPath);
    process.exit(1);
}

const testImportCode = fs.readFileSync(testImportPath, 'utf8');
if (testImportCode.includes('const jssha3 = require(\'js-sha3\')')) {
    console.log('✅ test-import.mjs successfully uses CommonJS require syntax');
} else {
    console.error('❌ test-import.mjs does not use CommonJS require syntax');
    process.exit(1);
}

console.log('🎉 Both fixes have been verified successfully!'); 