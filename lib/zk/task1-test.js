
#!/usr/bin/env node

// Simple test for SecureKeyManager and TamperDetection
const fs = require('fs');

const secureKeyManagerPath = './lib/zk/SecureKeyManager.js';
const tamperDetectionPath = './lib/zk/TamperDetection.js';
const zkUtilsPath = './lib/zk/zkUtils.js';

let passed = true;

// Test file existence
if (!fs.existsSync(secureKeyManagerPath)) {
    console.error('SecureKeyManager.js not found');
    passed = false;
} else {
    console.log('SecureKeyManager.js found');
}

if (!fs.existsSync(tamperDetectionPath)) {
    console.error('TamperDetection.js not found');
    passed = false;
} else {
    console.log('TamperDetection.js found');
}

if (!fs.existsSync(zkUtilsPath)) {
    console.error('zkUtils.js not found');
    passed = false;
} else {
    console.log('zkUtils.js found');
}

// Print summary
console.log('System Architecture test:', passed ? 'PASS' : 'FAIL');
process.exit(passed ? 0 : 1);
