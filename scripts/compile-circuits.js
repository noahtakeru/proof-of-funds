/**
 * Circuit Compilation Script
 * 
 * This script properly compiles Circom circuits to WebAssembly and generates proving/verification keys.
 * No placeholder implementations, as per the token-agnostic wallet scanning plan.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Circuit paths
const CIRCUIT_DIR = path.resolve(__dirname, '../packages/frontend/public/lib/zk/circuits');
const BUILD_DIR = path.resolve(__dirname, '../packages/frontend/public/lib/zk/circuits/build');

// Create build directory if it doesn't exist
if (!fs.existsSync(BUILD_DIR)) {
  fs.mkdirSync(BUILD_DIR, { recursive: true });
}

// Compile a circuit to WebAssembly and generate proving/verification keys
async function compileCircuit(circuitName) {
  console.log(`Compiling circuit: ${circuitName}`);
  
  const circuitPath = path.join(CIRCUIT_DIR, `${circuitName}.circom`);
  
  try {
    // Check if circom is installed
    try {
      execSync('circom --version', { stdio: 'inherit' });
    } catch (error) {
      console.error('Error: circom is not installed. Please install it globally with:');
      console.error('npm install -g circom');
      process.exit(1);
    }
    
    // Check if snarkjs is installed
    try {
      execSync('snarkjs --version', { stdio: 'inherit' });
    } catch (error) {
      console.error('Error: snarkjs is not installed. Please install it globally with:');
      console.error('npm install -g snarkjs');
      process.exit(1);
    }
    
    // Compile circuit to WebAssembly
    console.log(`Compiling ${circuitName} to WebAssembly...`);
    execSync(`circom ${circuitPath} --wasm --output ${BUILD_DIR}`, { stdio: 'inherit' });
    
    // Generate proving key (zkey)
    console.log(`Generating proving key for ${circuitName}...`);
    execSync(`snarkjs groth16 setup ${BUILD_DIR}/${circuitName}.r1cs ${BUILD_DIR}/powersOfTau28_hez_final_10.ptau ${BUILD_DIR}/${circuitName}_0.zkey`, { stdio: 'inherit' });
    
    // Contribute to phase 2 of the ceremony (for real application, this should be done more securely)
    console.log(`Contributing to ceremony for ${circuitName}...`);
    execSync(`snarkjs zkey contribute ${BUILD_DIR}/${circuitName}_0.zkey ${BUILD_DIR}/${circuitName}.zkey -n="First contribution" -e="random text for entropy"`, { stdio: 'inherit' });
    
    // Export verification key
    console.log(`Exporting verification key for ${circuitName}...`);
    execSync(`snarkjs zkey export verificationkey ${BUILD_DIR}/${circuitName}.zkey ${BUILD_DIR}/${circuitName}.vkey.json`, { stdio: 'inherit' });
    
    // Copy build artifacts to the circuit directory
    console.log(`Copying build artifacts for ${circuitName}...`);
    fs.copyFileSync(`${BUILD_DIR}/${circuitName}_js/${circuitName}.wasm`, path.join(CIRCUIT_DIR, `${circuitName}.wasm`));
    fs.copyFileSync(`${BUILD_DIR}/${circuitName}.zkey`, path.join(CIRCUIT_DIR, `${circuitName}.zkey`));
    fs.copyFileSync(`${BUILD_DIR}/${circuitName}.vkey.json`, path.join(CIRCUIT_DIR, `${circuitName}.vkey.json`));
    
    console.log(`Successfully compiled circuit: ${circuitName}`);
  } catch (error) {
    console.error(`Error compiling circuit ${circuitName}:`, error.message);
    throw error;
  }
}

// Download Powers of Tau file (needed for the trusted setup)
async function downloadPowersOfTau() {
  if (!fs.existsSync(`${BUILD_DIR}/powersOfTau28_hez_final_10.ptau`)) {
    console.log('Downloading Powers of Tau file...');
    try {
      // Try primary source
      execSync(`curl -L -o ${BUILD_DIR}/powersOfTau28_hez_final_10.ptau https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_10.ptau`, { stdio: 'inherit' });
    } catch (error) {
      console.error('Error downloading from primary source, trying alternative...');
      try {
        // Try alternative source
        execSync(`curl -L -o ${BUILD_DIR}/powersOfTau28_hez_final_10.ptau https://cloudflare-ipfs.com/ipfs/QmY3XTzMDsmn4KRRxHfXSDX1jKMh61Rb2wJEDXXYnLyU3w`, { stdio: 'inherit' });
      } catch (altError) {
        console.error('Error downloading from alternative source.');
        throw new Error('Could not download Powers of Tau file from any source.');
      }
    }
    
    // Verify the file size is reasonable (should be several MB)
    const stats = fs.statSync(`${BUILD_DIR}/powersOfTau28_hez_final_10.ptau`);
    if (stats.size < 1000000) { // Less than 1MB is suspicious
      console.error('Downloaded file is suspiciously small:', stats.size, 'bytes');
      throw new Error('Powers of Tau file may be invalid. Please download it manually.');
    }
  }
}

// Main function
async function main() {
  try {
    console.log('Starting circuit compilation process...');
    
    // Download Powers of Tau parameters
    await downloadPowersOfTau();
    
    // Compile all circuits
    await compileCircuit('standardProof');
    await compileCircuit('thresholdProof');
    await compileCircuit('maximumProof');
    
    console.log('All circuits compiled successfully!');
  } catch (error) {
    console.error('Error during circuit compilation:', error);
    process.exit(1);
  }
}

main();