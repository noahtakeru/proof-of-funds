#!/usr/bin/env node

/**
 * Zero-Knowledge Circuit Build Script
 * 
 * This script automates the building of zero-knowledge circuits for the
 * Proof of Funds application. It compiles circuit definitions, generates
 * keys, and organizes the build artifacts in a standardized directory structure.
 * 
 * Usage:
 *   node build-circuits.js [circuit-type] [version] [--force]
 * 
 * Parameters:
 *   circuit-type: standard, threshold, or maximum (default: all)
 *   version: Semantic version number X.Y.Z (required)
 * 
 * Options:
 *   --force: Override existing builds with the same version
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { program } = require('commander');

// Import CircuitBuildManager (using dynamic import for ESM module)
const importCircuitBuildManager = async () => {
  const modulePath = path.resolve(__dirname, '../CircuitBuildManager.js');
  if (fs.existsSync(modulePath)) {
    try {
      return (await import('../CircuitBuildManager.js')).default;
    } catch (error) {
      console.error(`Error importing CircuitBuildManager: ${error.message}`);
      return null;
    }
  }
  return null;
};

// Define command-line interface
program
  .version('1.0.0')
  .arguments('[circuit-type] [version]')
  .option('--force', 'Force rebuild even if version exists')
  .description('Build zero-knowledge circuits for the Proof of Funds application')
  .action(async (circuitType, version, options) => {
    // Validate version if provided
    if (version && !version.match(/^\d+\.\d+\.\d+$/)) {
      console.error('Error: Version must be in format X.Y.Z');
      process.exit(1);
    }
    
    // Request version if not provided
    if (!version) {
      console.error('Error: Version is required (format: X.Y.Z)');
      process.exit(1);
    }
    
    try {
      // Start performance timing
      const startTime = Date.now();
      
      // Map of circuit types to circuit names
      const circuitMap = {
        'standard': { name: 'StandardProof', type: 'standard' },
        'threshold': { name: 'ThresholdProof', type: 'threshold' },
        'maximum': { name: 'MaximumProof', type: 'maximum' },
      };
      
      // Determine which circuits to build
      let circuitsToBuiltd = [];
      if (circuitType && circuitMap[circuitType]) {
        circuitsToBuiltd = [circuitMap[circuitType]];
      } else if (!circuitType) {
        circuitsToBuiltd = Object.values(circuitMap);
      } else {
        console.error(`Error: Unknown circuit type: ${circuitType}`);
        console.error('Available types: standard, threshold, maximum');
        process.exit(1);
      }
      
      // Import CircuitBuildManager
      const CircuitBuildManager = await importCircuitBuildManager();
      if (!CircuitBuildManager) {
        console.error('Error: Could not load CircuitBuildManager');
        process.exit(1);
      }
      
      // Track build results
      const results = {
        success: [],
        failed: [],
      };
      
      // Build each selected circuit
      for (const circuit of circuitsToBuiltd) {
        console.log(`\n------ Building ${circuit.name} (${circuit.type}) v${version} ------`);
        
        try {
          // Verify circuit source exists
          const sourceFile = path.resolve(__dirname, `../circuits/${circuit.type}/${circuit.name}.circom`);
          if (!fs.existsSync(sourceFile)) {
            console.error(`Error: Circuit source file not found: ${sourceFile}`);
            results.failed.push({ name: circuit.name, type: circuit.type, error: 'Source file not found' });
            continue;
          }
          
          // Build the circuit
          const result = await CircuitBuildManager.buildCircuit({
            circuitType: circuit.type,
            circuitName: circuit.name,
            version: version,
            buildOptions: {
              force: options.force,
              keyStatus: 'active', // Status for verification key registry
            },
          });
          
          // Display results
          console.log(`✓ Successfully built ${circuit.name} v${version}`);
          console.log(`  - Build time: ${result.duration}ms`);
          console.log(`  - Verification key ID: ${result.keyId}`);
          
          // Track success
          results.success.push({
            name: circuit.name,
            type: circuit.type,
            keyId: result.keyId,
            buildTime: result.duration,
          });
        } catch (error) {
          console.error(`✗ Failed to build ${circuit.name}: ${error.message}`);
          results.failed.push({
            name: circuit.name,
            type: circuit.type,
            error: error.message,
          });
        }
      }
      
      // Display summary
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      console.log('\n------ Build Summary ------');
      console.log(`Total build time: ${totalTime}ms`);
      console.log(`Successful builds: ${results.success.length}`);
      console.log(`Failed builds: ${results.failed.length}`);
      
      if (results.success.length > 0) {
        console.log('\nSuccessful builds:');
        results.success.forEach(circuit => {
          console.log(`  - ${circuit.name} (${circuit.type}): Key ID ${circuit.keyId}`);
        });
      }
      
      if (results.failed.length > 0) {
        console.log('\nFailed builds:');
        results.failed.forEach(circuit => {
          console.log(`  - ${circuit.name} (${circuit.type}): ${circuit.error}`);
        });
        process.exit(1);
      }
    } catch (error) {
      console.error(`Build process failed: ${error.message}`);
      process.exit(1);
    }
  });

// Parse command-line arguments
program.parse(process.argv);

// Display help if no arguments provided
if (process.argv.length <= 2) {
  program.help();
}