#!/usr/bin/env node

/**
 * Circuit Compilation Script
 * 
 * This script automates the compilation and setup of Circom circuits for the Proof of Funds protocol.
 * It handles the following tasks:
 * 
 * 1. Compile Circom circuits to R1CS, WASM, and symbols files
 * 2. Generate Powers of Tau (Phase 1)
 * 3. Create proof and verification keys (Phase 2)
 * 4. Export verification key for client-side verification
 * 5. Generate Solidity verifier contract
 * 
 * Usage: node compile.js [--circuit circuit_name] [--full] [--force]
 *   --circuit: Compile a specific circuit (default: balance_verification)
 *   --full: Perform full trusted setup (powers of tau)
 *   --force: Force recompilation even if outputs exist
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import * as snarkjs from 'snarkjs';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  circuit: 'balance_verification',
  full: false,
  force: false
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--circuit' && i + 1 < args.length) {
    options.circuit = args[i + 1];
    i++;
  } else if (args[i] === '--full') {
    options.full = true;
  } else if (args[i] === '--force') {
    options.force = true;
  }
}

// Setup paths
const circuitPath = path.join(__dirname, `${options.circuit}.circom`);
const compiledDir = path.join(__dirname, 'compiled');
const outputDir = path.join(compiledDir, options.circuit);

// Create output directories if they don't exist
if (!fs.existsSync(compiledDir)) {
  fs.mkdirSync(compiledDir);
}

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Check if circuit exists
if (!fs.existsSync(circuitPath)) {
  console.error(`Error: Circuit file ${circuitPath} does not exist`);
  process.exit(1);
}

// Define output file paths
const r1csPath = path.join(outputDir, `${options.circuit}.r1cs`);
const wasmDir = path.join(outputDir, `${options.circuit}_js`);
const wasmPath = path.join(wasmDir, `${options.circuit}.wasm`);
const symPath = path.join(outputDir, `${options.circuit}.sym`);
const potPath = path.join(outputDir, `pot14_final.ptau`);
const zkeyPath = path.join(outputDir, `${options.circuit}_final.zkey`);
const vkeyPath = path.join(outputDir, `verification_key.json`);
const solVerifierPath = path.join(outputDir, `${options.circuit}_verifier.sol`);

/**
 * Main function to compile the circuit and generate keys
 */
async function main() {
  try {
    console.log(`\n🔄 Compiling circuit: ${options.circuit}`);
    
    // Step 1: Compile the circuit
    if (!fs.existsSync(r1csPath) || !fs.existsSync(wasmPath) || options.force) {
      console.log('📝 Compiling circuit to R1CS, WASM, and symbols...');
      
      // Create wasm directory if needed
      if (!fs.existsSync(wasmDir)) {
        fs.mkdirSync(wasmDir, { recursive: true });
      }
      
      execSync(`circom ${circuitPath} --r1cs --wasm --sym -o ${outputDir}`, { stdio: 'inherit' });
      console.log('✅ Circuit compilation complete');
    } else {
      console.log('✅ Circuit already compiled (use --force to recompile)');
    }
    
    // Step 2: Powers of Tau (Phase 1)
    if (options.full || !fs.existsSync(potPath) || options.force) {
      console.log('⚡ Generating Powers of Tau (Phase 1)...');
      
      // For a production system, you'd use a proper ceremony
      // Here we generate a small example for development
      await snarkjs.powersOfTau.newAccumulator(12, potPath, { entropy1: "random1", name: "powersoftau" });
      console.log('✅ Powers of Tau (Phase 1) complete');
    } else {
      console.log('✅ Powers of Tau already generated (use --full to regenerate)');
    }
    
    // Step 3: Generate zkey (Phase 2)
    if (!fs.existsSync(zkeyPath) || options.force) {
      console.log('🔑 Generating proving key (Phase 2)...');
      
      // Setup the circuit with the Powers of Tau
      await snarkjs.zKey.newZKey(r1csPath, potPath, zkeyPath);
      console.log('✅ Proving key generation complete');
    } else {
      console.log('✅ Proving key already generated (use --force to regenerate)');
    }
    
    // Step 4: Export verification key
    if (!fs.existsSync(vkeyPath) || options.force) {
      console.log('🔍 Exporting verification key...');
      const vkey = await snarkjs.zKey.exportVerificationKey(zkeyPath);
      fs.writeFileSync(vkeyPath, JSON.stringify(vkey, null, 2));
      console.log('✅ Verification key exported');
    } else {
      console.log('✅ Verification key already exported (use --force to regenerate)');
    }
    
    // Step 5: Generate Solidity verifier contract
    if (!fs.existsSync(solVerifierPath) || options.force) {
      console.log('📄 Generating Solidity verifier contract...');
      const solidityVerifier = await snarkjs.zKey.exportSolidityVerifier(zkeyPath);
      fs.writeFileSync(solVerifierPath, solidityVerifier);
      console.log('✅ Solidity verifier contract generated');
    } else {
      console.log('✅ Solidity verifier already generated (use --force to regenerate)');
    }
    
    // Print summary
    console.log('\n✨ Circuit compilation and setup complete!');
    console.log(`\nOutput files in: ${outputDir}`);
    console.log(`  - R1CS: ${r1csPath}`);
    console.log(`  - WASM: ${wasmPath}`);
    console.log(`  - Proving Key: ${zkeyPath}`);
    console.log(`  - Verification Key: ${vkeyPath}`);
    console.log(`  - Solidity Verifier: ${solVerifierPath}`);
    
    // Provide next steps
    console.log('\n📋 Next steps:');
    console.log('  1. Use the circuit files in your application');
    console.log('  2. Copy the Solidity verifier to your contracts directory');
    console.log('  3. Run integration tests with the compiled circuit');
    
  } catch (error) {
    console.error('\n❌ Error during circuit compilation:', error);
    process.exit(1);
  }
}

// Run the main function
main();