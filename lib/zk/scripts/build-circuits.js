#!/usr/bin/env node

/**
 * Circuit Build Script
 * 
 * This script compiles circuit files (.circom) into:
 * 1. WebAssembly files (.wasm) for witness calculation
 * 2. zkey files for proving
 * 3. Verification key files for verification
 * 
 * Usage: node build-circuits.js [circuit-name]
 * - If circuit-name is provided, only that circuit will be built
 * - Otherwise, all circuits will be built
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const snarkjs = require('snarkjs');

// Constants
const CIRCUITS_DIR = path.join(__dirname, '..', 'circuits');
const BUILD_DIR = path.join(__dirname, '..', 'build');
const KEYS_DIR = path.join(__dirname, '..', 'keys');
const PHASE1_PATH = path.join(KEYS_DIR, 'phase1_final.ptau');
const CIRCUITS = ['standardProof', 'thresholdProof', 'maximumProof'];

// Ensure directories exist
[
  BUILD_DIR,
  path.join(BUILD_DIR, 'wasm'),
  path.join(BUILD_DIR, 'zkey'),
  path.join(BUILD_DIR, 'verification_key')
].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * Build a single circuit
 * @param {string} circuitName - Name of the circuit to build (without extension)
 */
async function buildCircuit(circuitName) {
  try {
    const circuitPath = path.join(CIRCUITS_DIR, `${circuitName}.circom`);
    const wasmDir = path.join(BUILD_DIR, 'wasm');
    const zkeyDir = path.join(BUILD_DIR, 'zkey');
    const vkDir = path.join(BUILD_DIR, 'verification_key');
    
    console.log(`\n======= Building ${circuitName} =======`);
    
    // Step 1: Compile circuit to r1cs and wasm/sym
    console.log('Compiling circuit to r1cs...');
    execSync(
      `circom ${circuitPath} --r1cs --wasm --sym -o ${BUILD_DIR}`,
      { stdio: 'inherit' }
    );
    
    const r1csPath = path.join(BUILD_DIR, `${circuitName}.r1cs`);
    const wasmPath = path.join(wasmDir, `${circuitName}_js/${circuitName}.wasm`);
    const zkeyPath = path.join(zkeyDir, `${circuitName}.zkey`);
    const vkeyPath = path.join(vkDir, `${circuitName}.json`);
    
    // Step 2: Generate initial zkey (powers of tau phase 2)
    console.log('Generating initial zkey file...');
    await snarkjs.zKey.newZKey(
      r1csPath,
      PHASE1_PATH,
      path.join(zkeyDir, `${circuitName}_initial.zkey`)
    );
    
    // Step 3: Contribute to the ceremony (add entropy)
    console.log('Contributing to the ceremony...');
    await snarkjs.zKey.contribute(
      path.join(zkeyDir, `${circuitName}_initial.zkey`),
      zkeyPath,
      'Circuit build script',
      `random_${Date.now()}`
    );
    
    // Step 4: Export verification key
    console.log('Exporting verification key...');
    const vkey = await snarkjs.zKey.exportVerificationKey(zkeyPath);
    fs.writeFileSync(vkeyPath, JSON.stringify(vkey, null, 2));
    
    // Step 5: Generate Solidity verifier
    console.log('Generating Solidity verifier...');
    const solVerifier = await snarkjs.zKey.exportSolidityVerifier(zkeyPath);
    fs.writeFileSync(
      path.join(BUILD_DIR, `${circuitName}Verifier.sol`),
      solVerifier
    );
    
    // Step 6: Create build info file
    const buildInfo = {
      circuitName,
      buildDate: new Date().toISOString(),
      files: {
        r1cs: path.relative(BUILD_DIR, r1csPath),
        wasm: path.relative(BUILD_DIR, wasmPath),
        zkey: path.relative(BUILD_DIR, zkeyPath),
        vkey: path.relative(BUILD_DIR, vkeyPath),
        solidity: `${circuitName}Verifier.sol`
      },
      constraints: await getConstraintCount(r1csPath)
    };
    
    fs.writeFileSync(
      path.join(BUILD_DIR, `${circuitName}_info.json`),
      JSON.stringify(buildInfo, null, 2)
    );
    
    console.log(`✅ ${circuitName} built successfully!`);
    console.log(`Circuit constraints: ${buildInfo.constraints}`);
    
    return buildInfo;
  } catch (error) {
    console.error(`❌ Error building ${circuitName}:`, error);
    throw error;
  }
}

/**
 * Get constraint count from r1cs file
 * @param {string} r1csPath - Path to r1cs file
 * @returns {Promise<number>} - Number of constraints
 */
async function getConstraintCount(r1csPath) {
  try {
    const { r1cs } = await snarkjs.r1cs.info(r1csPath);
    return r1cs.constraints.length;
  } catch (error) {
    console.error('Error getting constraint count:', error);
    return 0;
  }
}

/**
 * Check if phase1 file exists, download if not
 */
async function ensurePhase1() {
  if (fs.existsSync(PHASE1_PATH)) {
    return;
  }
  
  console.log('Phase 1 file not found. Creating directory...');
  const keysDir = path.dirname(PHASE1_PATH);
  if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
  }
  
  // Download a phase 1 file - we'll use a small one for development
  console.log('Downloading phase 1 file...');
  execSync(
    `curl -o ${PHASE1_PATH} https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_15.ptau`,
    { stdio: 'inherit' }
  );
}

/**
 * Main function
 */
async function main() {
  try {
    await ensurePhase1();
    
    // Determine which circuits to build
    const circuitName = process.argv[2];
    const circuitsToBuild = circuitName 
      ? [circuitName] 
      : CIRCUITS;
    
    console.log(`Building circuits: ${circuitsToBuild.join(', ')}`);
    
    const results = [];
    for (const circuit of circuitsToBuild) {
      const result = await buildCircuit(circuit);
      results.push(result);
    }
    
    console.log('\n======= Build Summary =======');
    results.forEach(info => {
      console.log(`${info.circuitName}: ${info.constraints} constraints`);
    });
    
    console.log('\n✅ All circuits built successfully!');
  } catch (error) {
    console.error('\n❌ Circuit build failed:', error);
    process.exit(1);
  }
}

// Run main function
main();