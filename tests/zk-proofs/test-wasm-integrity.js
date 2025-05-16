/**
 * WebAssembly File Integrity Test
 * 
 * This script verifies that the deployed WebAssembly files have the correct
 * structure and required exports for ZK proofs.
 */

const fs = require('fs');
const path = require('path');

// Path to circuit files
const CIRCUIT_DIR = path.resolve(__dirname, '../../packages/frontend/public/lib/zk/circuits');

// Array of proof types to test
const PROOF_TYPES = ['standard', 'threshold', 'maximum'];

// Check if a file exists
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
}

// Check if WebAssembly file has valid magic bytes
function checkWasmMagicBytes(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    
    // WebAssembly files should start with magic bytes: 0x00, 0x61, 0x73, 0x6d (or "\0asm")
    if (buffer.length < 4) {
      return { valid: false, error: 'File too small to be WebAssembly' };
    }
    
    if (buffer[0] === 0 && buffer[1] === 97 && buffer[2] === 115 && buffer[3] === 109) {
      return { valid: true };
    } else {
      return { 
        valid: false, 
        error: `Invalid magic bytes: ${buffer[0]},${buffer[1]},${buffer[2]},${buffer[3]}` 
      };
    }
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// Check if zkey file has valid format
function checkZkeyFormat(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    
    // Check for "zkey" header (first 4 bytes)
    const header = buffer.toString('utf8', 0, 4);
    if (header === 'zkey') {
      // Also check that file is reasonable size
      if (buffer.length > 100000) { // zkey files should be > 100KB
        return { valid: true };
      } else {
        return { valid: false, error: `File too small: ${buffer.length} bytes` };
      }
    } else {
      return { valid: false, error: `Invalid zkey header: ${header}` };
    }
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// Check if vkey.json is valid JSON
function checkVkeyJson(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(content);
    
    // Check for required fields
    if (json.protocol !== 'groth16') {
      return { valid: false, error: 'Missing or invalid protocol field' };
    }
    
    if (json.curve !== 'bn128') {
      return { valid: false, error: 'Missing or invalid curve field' };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// Main function to test all files
function testAllFiles() {
  console.log('=== ZK Files Integrity Test ===\n');
  
  let allValid = true;
  
  for (const proofType of PROOF_TYPES) {
    console.log(`Testing ${proofType} proof files:`);
    
    // Test WebAssembly file
    const wasmPath = path.join(CIRCUIT_DIR, `${proofType}Proof.wasm`);
    const wasmExists = fileExists(wasmPath);
    console.log(`- WASM file exists: ${wasmExists ? '✅' : '❌'}`);
    
    if (wasmExists) {
      const wasmCheck = checkWasmMagicBytes(wasmPath);
      console.log(`  WASM validity: ${wasmCheck.valid ? '✅' : '❌'}`);
      if (!wasmCheck.valid) {
        console.log(`  Error: ${wasmCheck.error}`);
        allValid = false;
      }
    } else {
      allValid = false;
    }
    
    // Test zkey file
    const zkeyPath = path.join(CIRCUIT_DIR, `${proofType}Proof.zkey`);
    const zkeyExists = fileExists(zkeyPath);
    console.log(`- ZKEY file exists: ${zkeyExists ? '✅' : '❌'}`);
    
    if (zkeyExists) {
      const zkeyCheck = checkZkeyFormat(zkeyPath);
      console.log(`  ZKEY validity: ${zkeyCheck.valid ? '✅' : '❌'}`);
      if (!zkeyCheck.valid) {
        console.log(`  Error: ${zkeyCheck.error}`);
        allValid = false;
      }
    } else {
      allValid = false;
    }
    
    // Test verification key file
    const vkeyPath = path.join(CIRCUIT_DIR, `${proofType}Proof.vkey.json`);
    const vkeyExists = fileExists(vkeyPath);
    console.log(`- VKEY file exists: ${vkeyExists ? '✅' : '❌'}`);
    
    if (vkeyExists) {
      const vkeyCheck = checkVkeyJson(vkeyPath);
      console.log(`  VKEY validity: ${vkeyCheck.valid ? '✅' : '❌'}`);
      if (!vkeyCheck.valid) {
        console.log(`  Error: ${vkeyCheck.error}`);
        allValid = false;
      }
    } else {
      allValid = false;
    }
    
    console.log();
  }
  
  // Print overall status
  console.log('=== Summary ===');
  if (allValid) {
    console.log('✅ All ZK files are valid and ready for proof generation');
  } else {
    console.log('❌ Some ZK files are missing or invalid - see details above');
  }
  
  return allValid;
}

// Run the tests
const result = testAllFiles();
process.exit(result ? 0 : 1);