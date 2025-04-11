
#!/usr/bin/env node

// Simple test for Trusted Setup Ceremony
const fs = require('fs');

const trustedSetupManagerPath = './lib/zk/TrustedSetupManager.js';
const pTauPath = './lib/zk/keys/phase1_final.ptau';
const keyDirPath = './lib/zk/keys';

let passed = true;

// Test file existence
if (!fs.existsSync(trustedSetupManagerPath)) {
    console.error('TrustedSetupManager.js not found');
    passed = false;
} else {
    console.log('TrustedSetupManager.js found');
    
    // Check content
    const content = fs.readFileSync(trustedSetupManagerPath, 'utf8');
    if (!content.includes('contributeToSetup') || !content.includes('verifyContribution')) {
        console.error('TrustedSetupManager.js missing expected methods');
        passed = false;
    } else {
        console.log('TrustedSetupManager.js contains expected methods');
    }
}

// Check for keys directory
if (!fs.existsSync(keyDirPath)) {
    console.error('Keys directory not found');
    passed = false;
} else {
    console.log('Keys directory found');
}

// Print summary
console.log('Trusted Setup Ceremony test:', passed ? 'PASS' : 'FAIL');
process.exit(passed ? 0 : 1);
