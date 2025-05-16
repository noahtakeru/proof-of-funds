/**
 * Internal API endpoint for testing ZK proof generation
 * This file is not meant to be used in production, but for development testing only
 */

import path from 'path';
import fs from 'fs';

/**
 * Tests the ZK proof infrastructure by checking circuit files
 */
export default async function handler(req, res) {
  // Only accept GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check for circuit files first
    const results = {
      circuitFiles: {},
      proofGeneration: {}
    };
    
    // Check circuit files
    const publicDir = path.resolve(process.cwd(), 'public');
    const circuitsDir = path.join(publicDir, 'lib', 'zk', 'circuits');
    
    const circuitTypes = ['standard', 'threshold', 'maximum'];
    
    for (const type of circuitTypes) {
      const circuitName = `${type}Proof`;
      const wasmPath = path.join(circuitsDir, `${circuitName}.wasm`);
      const zkeyPath = path.join(circuitsDir, `${circuitName}.zkey`);
      const vkeyPath = path.join(circuitsDir, `${circuitName}.vkey.json`);
      
      results.circuitFiles[type] = {
        wasmExists: fs.existsSync(wasmPath),
        zkeyExists: fs.existsSync(zkeyPath),
        vkeyExists: fs.existsSync(vkeyPath),
        paths: {
          wasm: wasmPath,
          zkey: zkeyPath,
          vkey: vkeyPath
        }
      };
    }
    
    // Return test results
    return res.status(200).json({
      success: true,
      zkInfrastructureTests: results
    });
  } catch (error) {
    console.error('Error testing ZK infrastructure:', error);
    return res.status(500).json({ 
      error: 'Failed to test ZK infrastructure', 
      message: error.message
    });
  }
}