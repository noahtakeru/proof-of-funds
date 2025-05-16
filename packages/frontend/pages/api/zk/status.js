/**
 * API endpoint for checking ZK proof system status
 * 
 * This endpoint provides status information about the ZK proof system
 * and can be used to check if the system is functioning correctly.
 */

import path from 'path';
import fs from 'fs';

/**
 * Checks if WebAssembly files have the correct format
 * @param {string} wasmPath - Path to WebAssembly file
 * @returns {Object} - Result of check
 */
function checkWasmFormat(wasmPath) {
  try {
    if (!fs.existsSync(wasmPath)) {
      return { 
        exists: false, 
        hasValidMagicBytes: false,
        error: 'File does not exist'
      };
    }
    
    const buffer = fs.readFileSync(wasmPath);
    
    if (buffer.length < 4) {
      return { 
        exists: true, 
        hasValidMagicBytes: false,
        error: 'File too small to be valid WebAssembly'
      };
    }
    
    // Check for WebAssembly magic bytes (0x00, 0x61, 0x73, 0x6d)
    const hasValidMagicBytes = buffer[0] === 0x00 && 
                               buffer[1] === 0x61 && 
                               buffer[2] === 0x73 && 
                               buffer[3] === 0x6d;
    
    return {
      exists: true,
      hasValidMagicBytes,
      size: buffer.length,
      error: hasValidMagicBytes ? null : 'Invalid WebAssembly magic bytes'
    };
  } catch (error) {
    return {
      exists: false,
      hasValidMagicBytes: false,
      error: `Error checking WASM file: ${error.message}`
    };
  }
}

/**
 * Handles the API request for checking ZK system status
 */
export default async function handler(req, res) {
  // Only accept GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const publicDir = path.resolve(process.cwd(), 'public');
    
    // Check circuit files for each proof type
    const proofTypes = ['standard', 'threshold', 'maximum'];
    const results = {};
    
    for (const type of proofTypes) {
      const circuitName = `${type}Proof`;
      const wasmPath = path.join(publicDir, 'lib', 'zk', 'circuits', `${circuitName}.wasm`);
      const zkeyPath = path.join(publicDir, 'lib', 'zk', 'circuits', `${circuitName}.zkey`);
      const vkeyPath = path.join(publicDir, 'lib', 'zk', 'circuits', `${circuitName}.vkey.json`);
      
      results[type] = {
        wasm: checkWasmFormat(wasmPath),
        zkey: {
          exists: fs.existsSync(zkeyPath),
          size: fs.existsSync(zkeyPath) ? fs.statSync(zkeyPath).size : 0
        },
        vkey: {
          exists: fs.existsSync(vkeyPath),
          size: fs.existsSync(vkeyPath) ? fs.statSync(vkeyPath).size : 0
        }
      };
    }
    
    // Return status information
    return res.status(200).json({
      success: true,
      status: 'operational',
      message: 'ZK system status information',
      circuits: results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to check ZK system status',
      message: error.message
    });
  }
}