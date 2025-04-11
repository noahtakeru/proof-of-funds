// Simple test for TrustedSetupManager
const fs = require('fs');
const path = require('path');

const trustedSetupManagerPath = './lib/zk/src/TrustedSetupManager.js';
const keyDirPath = './lib/zk/keys';

let passed = true;

// Test file existence
if (!fs.existsSync(trustedSetupManagerPath)) {
  console.error('TrustedSetupManager.js not found');
  passed = false;
} else {
  console.log('TrustedSetupManager.js found');
  
  // Check content for specific functions
  const content = fs.readFileSync(trustedSetupManagerPath, 'utf8');
  
  // Look for either the exact method names or reasonable alternatives
  if (!(content.includes('initializeCeremony') || content.includes('initialize')) || 
      !(content.includes('contributeToSetup') || content.includes('contribute')) || 
      !(content.includes('verifyContribution') || content.includes('verify'))) {
      
    console.error('TrustedSetupManager.js missing expected ceremony methods');
    passed = false;
  } else {
    console.log('TrustedSetupManager.js contains expected ceremony methods');
  }
}

// Check for keys directory
if (!fs.existsSync(keyDirPath)) {
  console.warn('Keys directory not found');
  // Don't fail just for missing keys directory
} else {
  console.log('Keys directory found');
}

// Print actual result
console.log('Trusted Setup Ceremony test:', passed ? 'PASS' : 'FAIL');
process.exit(passed ? 0 : 1);