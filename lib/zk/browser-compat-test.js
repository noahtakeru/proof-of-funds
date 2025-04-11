
#!/usr/bin/env node

// Simple test for Browser Compatibility
const fs = require('fs');

const browserCompatibilityPath = './lib/zk/browserCompatibility.js';
const matrixPath = './lib/zk/browser-compatibility-matrix.html';

let passed = true;

// Test file existence
if (!fs.existsSync(browserCompatibilityPath)) {
    console.error('browserCompatibility.js not found');
    passed = false;
} else {
    console.log('browserCompatibility.js found');
    
    // Check content
    const content = fs.readFileSync(browserCompatibilityPath, 'utf8');
    if (!content.includes('detectBrowserFeatures') || !content.includes('isBrowserCompatible')) {
        console.error('browserCompatibility.js missing expected methods');
        passed = false;
    } else {
        console.log('browserCompatibility.js contains expected methods');
    }
}

// Check for compatibility matrix
if (!fs.existsSync(matrixPath)) {
    console.error('Browser compatibility matrix not found');
    passed = false;
} else {
    console.log('Browser compatibility matrix found');
}

// Print summary
console.log('Browser Compatibility test:', passed ? 'PASS' : 'FAIL');
process.exit(passed ? 0 : 1);
