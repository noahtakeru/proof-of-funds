/**
 * ZK Utilities
 * 
 * This script consolidates utility functions for ZK proofs:
 * - Preparing ZK files (previously prepare-zk-files.js)
 * - Testing ZK environment (previously test-zk-environment.js)
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const copyFile = promisify(fs.copyFile);
const mkdir = promisify(fs.mkdir);
const access = promisify(fs.access);

// Circuit types to process
const CIRCUIT_TYPES = ['standard', 'threshold', 'maximum'];

// Source and destination paths
const SOURCE_BASE_PATH = path.resolve(__dirname, '../circuits');
const DEST_BASE_PATH = path.resolve(__dirname, '../packages/frontend/public/lib/zk/circuits');
const BUILD_DIR = path.resolve(DEST_BASE_PATH, 'build');

/**
 * Ensure a directory exists, creating it if necessary
 * @param {string} dirPath - Directory path
 */
async function ensureDir(dirPath) {
  try {
    await access(dirPath);
  } catch (error) {
    // Directory doesn't exist, create it
    await mkdir(dirPath, { recursive: true });
  }
}

/**
 * Copy a file with directory creation if needed
 * @param {string} src - Source path
 * @param {string} dest - Destination path
 */
async function copyFileWithDirCreation(src, dest) {
  const destDir = path.dirname(dest);
  await ensureDir(destDir);
  
  try {
    await copyFile(src, dest);
    console.log(`Copied: ${src} -> ${dest}`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(`Warning: Source file not found: ${src}`);
    } else {
      throw error;
    }
  }
}

/**
 * Copy circuit files for a given proof type
 * @param {string} proofType - Proof type (standard, threshold, maximum)
 */
async function copyCircuitFiles(proofType) {
  console.log(`Processing ${proofType} circuit files...`);
  
  // Define source paths
  const circuitSrcDir = path.join(SOURCE_BASE_PATH, proofType.toLowerCase());
  const wasmSrcDir = path.join(circuitSrcDir, `${proofType}Proof_js`);
  
  // Define source files
  const wasmSrc = path.join(wasmSrcDir, `${proofType}Proof.wasm`);
  const zkeySrc = path.join(circuitSrcDir, `${proofType}Proof.zkey`);
  const vkeySrc = path.join(circuitSrcDir, `${proofType}Proof.vkey.json`);
  const circomSrc = path.join(circuitSrcDir, `${proofType}Proof.circom`);
  
  // Define destination files
  const wasmDest = path.join(DEST_BASE_PATH, `${proofType}Proof.wasm`);
  const zkeyDest = path.join(DEST_BASE_PATH, `${proofType}Proof.zkey`);
  const vkeyDest = path.join(DEST_BASE_PATH, `${proofType}Proof.vkey.json`);
  const circomDest = path.join(DEST_BASE_PATH, `${proofType}Proof.circom`);
  
  // Copy each file
  const copyPromises = [
    copyFileWithDirCreation(wasmSrc, wasmDest),
    copyFileWithDirCreation(zkeySrc, zkeyDest),
    copyFileWithDirCreation(vkeySrc, vkeyDest),
    copyFileWithDirCreation(circomSrc, circomDest)
  ];
  
  await Promise.all(copyPromises);
}

/**
 * Prepare ZK files by copying them to the frontend directory
 */
async function prepareZkFiles() {
  try {
    console.log('=== Preparing ZK Files ===');
    
    // Ensure destination directory exists
    await ensureDir(DEST_BASE_PATH);
    
    // Copy files for each circuit type
    for (const circuitType of CIRCUIT_TYPES) {
      await copyCircuitFiles(circuitType);
    }
    
    // Also copy helper circuits
    const helperCircuits = [
      { src: path.join(SOURCE_BASE_PATH, 'bitify.circom'), dest: path.join(DEST_BASE_PATH, 'bitify.circom') },
      { src: path.join(SOURCE_BASE_PATH, 'comparators.circom'), dest: path.join(DEST_BASE_PATH, 'comparators.circom') }
    ];
    
    for (const circuit of helperCircuits) {
      await copyFileWithDirCreation(circuit.src, circuit.dest);
    }
    
    console.log('✅ Successfully prepared ZK files');
    return true;
  } catch (error) {
    console.error('❌ Error preparing ZK files:', error);
    return false;
  }
}

/**
 * Check if a file exists and has the correct format
 * @param {string} filePath - Path to the file
 * @param {string} type - Type of file (wasm, zkey, vkey)
 * @returns {Object} - Status of the file
 */
function checkFile(filePath, type) {
  const result = {
    exists: false,
    valid: false,
    size: 0,
    error: null
  };
  
  try {
    if (!fs.existsSync(filePath)) {
      result.error = 'File does not exist';
      return result;
    }
    
    result.exists = true;
    const stats = fs.statSync(filePath);
    result.size = stats.size;
    
    if (stats.size === 0) {
      result.error = 'File is empty';
      return result;
    }
    
    // Check file format based on type
    if (type === 'wasm') {
      const buffer = fs.readFileSync(filePath);
      if (buffer.length < 4) {
        result.error = 'File too small to be valid WebAssembly';
        return result;
      }
      
      // Check for WebAssembly magic bytes (0x00, 0x61, 0x73, 0x6d)
      if (buffer[0] === 0x00 && buffer[1] === 0x61 && buffer[2] === 0x73 && buffer[3] === 0x6d) {
        result.valid = true;
      } else {
        result.error = 'Invalid WebAssembly magic bytes';
      }
    } else if (type === 'zkey') {
      result.valid = true; // Basic check - would need more validation for real check
    } else if (type === 'vkey') {
      try {
        const vkey = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        result.valid = !!vkey.protocol && !!vkey.curve;
      } catch (error) {
        result.error = `Invalid JSON: ${error.message}`;
      }
    }
    
    return result;
  } catch (error) {
    result.error = error.message;
    return result;
  }
}

/**
 * Check all circuit files for a particular proof type
 * @param {string} proofType - Proof type (standard, threshold, maximum)
 * @returns {Object} - Status of all files for this proof type
 */
function checkCircuit(proofType) {
  const circuitName = `${proofType}Proof`;
  const wasmPath = path.join(DEST_BASE_PATH, `${circuitName}.wasm`);
  const zkeyPath = path.join(DEST_BASE_PATH, `${circuitName}.zkey`);
  const vkeyPath = path.join(DEST_BASE_PATH, `${circuitName}.vkey.json`);
  
  return {
    wasm: checkFile(wasmPath, 'wasm'),
    zkey: checkFile(zkeyPath, 'zkey'),
    vkey: checkFile(vkeyPath, 'vkey')
  };
}

/**
 * Test if we can import snarkjs directly
 * @returns {Object} - Status of snarkjs import
 */
async function testSnarkjsImport() {
  try {
    const snarkjs = await import('snarkjs');
    return {
      success: true,
      version: snarkjs.version || 'unknown'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test our wrapper
 * @returns {Object} - Status of wrapper functionality
 */
async function testWrapper() {
  // Try to import our ZK utilities using different methods
  let snarkjsWrapper;
  
  // First try the original module
  try {
    snarkjsWrapper = require('../packages/common/src/zk-core/snarkjsWrapper.js');
    console.log('Successfully imported snarkjsWrapper.js using require()');
  } catch (error) {
    console.log('Error importing snarkjsWrapper.js:', error.message);
    
    // Fallback to the CommonJS version
    try {
      snarkjsWrapper = require('../packages/common/src/zk-core/snarkjsWrapper.cjs');
      console.log('Successfully imported snarkjsWrapper.cjs using require()');
    } catch (fallbackError) {
      console.log('Error importing snarkjsWrapper.cjs:', fallbackError.message);
      snarkjsWrapper = null;
    }
  }
  
  if (!snarkjsWrapper) {
    return {
      success: false,
      error: 'snarkjsWrapper not available'
    };
  }
  
  try {
    // Just test that we can access the functions
    const hasFullProve = typeof snarkjsWrapper.fullProve === 'function';
    const hasVerify = typeof snarkjsWrapper.verify === 'function';
    
    return {
      success: hasFullProve && hasVerify,
      functions: {
        fullProve: hasFullProve,
        verify: hasVerify
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test ZK environment
 */
async function testZkEnvironment() {
  console.log('=== ZK Environment Test ===\n');
  
  // 1. Check circuit files
  console.log('Checking circuit files...');
  const proofTypes = ['standard', 'threshold', 'maximum'];
  const circuitResults = {};
  
  for (const type of proofTypes) {
    circuitResults[type] = checkCircuit(type);
    console.log(`\n${type} circuit:`);
    console.log(`- WASM: ${circuitResults[type].wasm.exists ? (circuitResults[type].wasm.valid ? 'Valid' : 'Invalid') : 'Missing'}`);
    if (circuitResults[type].wasm.error) {
      console.log(`  Error: ${circuitResults[type].wasm.error}`);
    }
    console.log(`- ZKEY: ${circuitResults[type].zkey.exists ? (circuitResults[type].zkey.valid ? 'Valid' : 'Invalid') : 'Missing'}`);
    if (circuitResults[type].zkey.error) {
      console.log(`  Error: ${circuitResults[type].zkey.error}`);
    }
    console.log(`- VKEY: ${circuitResults[type].vkey.exists ? (circuitResults[type].vkey.valid ? 'Valid' : 'Invalid') : 'Missing'}`);
    if (circuitResults[type].vkey.error) {
      console.log(`  Error: ${circuitResults[type].vkey.error}`);
    }
  }
  
  // 2. Test snarkjs import
  console.log('\nTesting snarkjs import...');
  const snarkjsResult = await testSnarkjsImport();
  console.log(snarkjsResult.success 
    ? `Success! snarkjs version: ${snarkjsResult.version}` 
    : `Failed: ${snarkjsResult.error}`);
  
  // 3. Test wrapper
  console.log('\nTesting snarkjs wrapper...');
  const wrapperResult = await testWrapper();
  console.log(wrapperResult.success 
    ? `Success! Wrapper functions available` 
    : `Failed: ${wrapperResult.error}`);
  
  console.log('\n=== Summary ===');
  const allCircuitsValid = Object.values(circuitResults).every(circuit => 
    circuit.wasm.valid && circuit.zkey.valid && circuit.vkey.valid);
  
  console.log(`Circuit files: ${allCircuitsValid ? 'All valid' : 'Some invalid or missing'}`);
  console.log(`snarkjs import: ${snarkjsResult.success ? 'Working' : 'Failed'}`);
  console.log(`snarkjs wrapper: ${wrapperResult.success ? 'Working' : 'Failed'}`);
  
  console.log('\nOverall status:');
  if (allCircuitsValid && snarkjsResult.success && wrapperResult.success) {
    console.log('✅ ZK environment looks good, but real circuit compilation is still needed for full functionality.');
    return true;
  } else {
    console.log('❌ ZK environment has issues that need to be addressed.');
    
    if (!allCircuitsValid) {
      console.log('• Circuit files need to be properly compiled');
    }
    if (!snarkjsResult.success) {
      console.log('• snarkjs import is not working correctly');
    }
    if (!wrapperResult.success) {
      console.log('• snarkjs wrapper is not working correctly');
    }
    
    return false;
  }
}

// Command-line handler
async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'prepare':
      return await prepareZkFiles();
    case 'test':
      return await testZkEnvironment();
    default:
      console.log('Usage: node zk-utilities.js [prepare|test]');
      console.log('  prepare: Copy ZK files to frontend directory');
      console.log('  test: Test ZK environment');
      return false;
  }
}

// Run if called directly
if (require.main === module) {
  main().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

// Export functions for use in other scripts
module.exports = {
  prepareZkFiles,
  testZkEnvironment,
  checkCircuit,
  checkFile,
  copyCircuitFiles,
  ensureDir,
};