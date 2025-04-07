/**
 * Test Debug Script
 * 
 * This script verifies if real WebAssembly files and artifacts have been
 * created and distinguishes between real and placeholder implementations.
 */

const fs = require('fs');
const path = require('path');

// Constants
const BUILD_DIR = path.join(__dirname, 'build');
const CIRCUITS = ['standardProof', 'thresholdProof', 'maximumProof'];

console.log('=== Checking ZK Implementation Status ===');

// Check each circuit
CIRCUITS.forEach(circuit => {
  console.log(`\n--- ${circuit} ---`);
  
  // Check R1CS file
  const r1csPath = path.join(BUILD_DIR, `${circuit}.r1cs`);
  let r1csStatus = 'Missing';
  let isR1csPlaceholder = true;
  
  if (fs.existsSync(r1csPath)) {
    try {
      const content = fs.readFileSync(r1csPath, 'utf8');
      if (content.includes('Placeholder')) {
        r1csStatus = 'Placeholder Text';
        isR1csPlaceholder = true;
      } else {
        // Try reading as binary
        const buffer = fs.readFileSync(r1csPath);
        if (buffer.length > 50) {
          r1csStatus = 'Probably Real (Binary)';
          isR1csPlaceholder = false;
        } else {
          r1csStatus = 'Very Small Binary (Likely Placeholder)';
          isR1csPlaceholder = true;
        }
      }
    } catch (e) {
      // If it throws on UTF-8 decode, it's likely binary
      r1csStatus = 'Likely Real (Binary)';
      isR1csPlaceholder = false;
    }
  }
  
  // Check WASM file
  const wasmPath = path.join(BUILD_DIR, 'wasm', `${circuit}_js`, `${circuit}.wasm`);
  let wasmStatus = 'Missing';
  let isWasmPlaceholder = true;
  
  if (fs.existsSync(wasmPath)) {
    try {
      const content = fs.readFileSync(wasmPath, 'utf8');
      if (content.includes('Placeholder')) {
        wasmStatus = 'Placeholder Text';
        isWasmPlaceholder = true;
      } else {
        // Check for WebAssembly magic number
        const buffer = fs.readFileSync(wasmPath);
        if (buffer.length > 8 && 
            buffer[0] === 0 && 
            buffer[1] === 0x61 && 
            buffer[2] === 0x73 && 
            buffer[3] === 0x6D) {
          
          if (buffer.length < 100) {
            wasmStatus = 'WebAssembly Header Only (Minimal)';
            isWasmPlaceholder = true;
          } else {
            wasmStatus = 'Real WebAssembly File';
            isWasmPlaceholder = false;
          }
        } else {
          wasmStatus = 'Invalid Format';
          isWasmPlaceholder = true;
        }
      }
    } catch (e) {
      // If it throws on UTF-8 decode, check for wasm header
      try {
        const buffer = fs.readFileSync(wasmPath);
        if (buffer.length > 8 && 
            buffer[0] === 0 && 
            buffer[1] === 0x61 && 
            buffer[2] === 0x73 && 
            buffer[3] === 0x6D) {
          
          if (buffer.length < 100) {
            wasmStatus = 'WebAssembly Header Only (Minimal)';
            isWasmPlaceholder = true;
          } else {
            wasmStatus = 'Real WebAssembly File';
            isWasmPlaceholder = false;
          }
        } else {
          wasmStatus = 'Binary but not WebAssembly';
          isWasmPlaceholder = true;
        }
      } catch (err) {
        wasmStatus = 'Error Reading File';
        isWasmPlaceholder = true;
      }
    }
  }
  
  // Check zkey file
  const zkeyPath = path.join(BUILD_DIR, 'zkey', `${circuit}.zkey`);
  let zkeyStatus = 'Missing';
  let isZkeyPlaceholder = true;
  
  if (fs.existsSync(zkeyPath)) {
    try {
      const content = fs.readFileSync(zkeyPath, 'utf8');
      if (content.includes('Placeholder')) {
        zkeyStatus = 'Placeholder Text';
        isZkeyPlaceholder = true;
      } else {
        // Try reading as binary
        const buffer = fs.readFileSync(zkeyPath);
        if (buffer.length > 500) {
          zkeyStatus = 'Probably Real (Binary)';
          isZkeyPlaceholder = false;
        } else {
          zkeyStatus = 'Very Small Binary (Likely Placeholder)';
          isZkeyPlaceholder = true;
        }
      }
    } catch (e) {
      // If it throws on UTF-8 decode, it's likely binary
      zkeyStatus = 'Likely Real (Binary)';
      isZkeyPlaceholder = false;
    }
  }
  
  // Check verification key
  const vkeyPath = path.join(BUILD_DIR, 'verification_key', `${circuit}.json`);
  let vkeyStatus = 'Missing';
  let isVkeyPlaceholder = true;
  
  if (fs.existsSync(vkeyPath)) {
    try {
      const content = fs.readFileSync(vkeyPath, 'utf8');
      const vkey = JSON.parse(content);
      
      // Check if it's all zeros
      let allZeros = true;
      if (vkey.vk_alpha_1.every(val => val === "0")) {
        vkeyStatus = 'Placeholder (All Zeros)';
        isVkeyPlaceholder = true;
      } else {
        vkeyStatus = 'Real Verification Key';
        isVkeyPlaceholder = false;
      }
    } catch (e) {
      vkeyStatus = 'Invalid JSON Format';
      isVkeyPlaceholder = true;
    }
  }
  
  // Overall status
  const isRealImplementation = !isR1csPlaceholder && !isWasmPlaceholder && 
                               !isZkeyPlaceholder && !isVkeyPlaceholder;
  
  console.log(`R1CS Status: ${r1csStatus}`);
  console.log(`WASM Status: ${wasmStatus}`);
  console.log(`zkey Status: ${zkeyStatus}`);
  console.log(`vkey Status: ${vkeyStatus}`);
  console.log(`Overall: ${isRealImplementation ? '✅ REAL IMPLEMENTATION' : '❌ PLACEHOLDER IMPLEMENTATION'}`);
});

console.log('\n=== Summary ===');
const overallStatus = CIRCUITS.every(circuit => {
  const buildInfoPath = path.join(BUILD_DIR, `${circuit}_info.json`);
  if (fs.existsSync(buildInfoPath)) {
    try {
      const info = JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'));
      return info.isReal === true;
    } catch (e) {
      return false;
    }
  }
  return false;
});

console.log(`Overall implementation status: ${overallStatus ? '✅ REAL' : '❌ PLACEHOLDER'}`);

// Check if debug.js in scripts directory exists and try to run it
const debugScriptPath = path.join(__dirname, 'scripts', 'debug.js');
if (fs.existsSync(debugScriptPath)) {
  console.log('\n=== Running Advanced Debug Script ===');
  try {
    const debugModule = require('./scripts/debug');
    debugModule.debugCircuit('standardProof')
      .then(() => {
        console.log('Advanced debug completed successfully');
      })
      .catch(error => {
        console.error('Error running advanced debug:', error);
      });
  } catch (error) {
    console.error('Error importing debug script:', error);
  }
}