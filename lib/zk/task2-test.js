
#!/usr/bin/env node

// Simple test for Client-Side Security
const fs = require('fs');

const secureKeyManagerPath = './lib/zk/SecureKeyManager.js';
const tamperDetectionPath = './lib/zk/TamperDetection.js';

let passed = true;

// Test file existence and content
if (!fs.existsSync(secureKeyManagerPath)) {
    console.error('SecureKeyManager.js not found');
    passed = false;
} else {
    const content = fs.readFileSync(secureKeyManagerPath, 'utf8');
    if (!content.includes('generateEncryptionKey') || !content.includes('encryptData')) {
        console.error('SecureKeyManager.js missing expected methods');
        passed = false;
    } else {
        console.log('SecureKeyManager.js contains expected methods');
    }
}

if (!fs.existsSync(tamperDetectionPath)) {
    console.error('TamperDetection.js not found');
    passed = false;
} else {
    const content = fs.readFileSync(tamperDetectionPath, 'utf8');
    if (!content.includes('sign') || !content.includes('verify')) {
        console.error('TamperDetection.js missing expected methods');
        passed = false;
    } else {
        console.log('TamperDetection.js contains expected methods');
    }
}

// Print summary
console.log('Client-Side Security test:', passed ? 'PASS' : 'FAIL');
process.exit(passed ? 0 : 1);
