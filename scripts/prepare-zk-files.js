/**
 * ZK Files Preparation Script
 * 
 * This script copies necessary ZK circuit files to the correct locations.
 * It avoids maintaining duplicate copies of circuit files by copying them during the build process.
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
 * Main function
 */
async function main() {
  try {
    // Ensure destination directory exists
    await ensureDir(DEST_BASE_PATH);
    
    // Copy files for each circuit type
    for (const circuitType of CIRCUIT_TYPES) {
      await copyCircuitFiles(circuitType);
    }
    
    console.log('Successfully prepared ZK files');
  } catch (error) {
    console.error('Error preparing ZK files:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = main;