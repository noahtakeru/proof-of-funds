/**
 * ZKey Manager for Google Cloud Secret Manager
 * Securely stores and retrieves proving keys for ZK proofs
 */

const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const fs = require('fs');
const path = require('path');

class ZKeyManager {
  constructor() {
    this.client = new SecretManagerServiceClient();
    this.projectId = process.env.GCP_PROJECT_ID;
  }

  /**
   * Upload zkey file to Google Cloud Secret Manager
   * @param {string} circuitName - Name of the circuit (standard, threshold, maximum)
   * @param {string} localPath - Local path to the zkey file
   */
  async uploadZKey(circuitName, localPath) {
    try {
      const secretId = `zkey-${circuitName}`;
      const parent = `projects/${this.projectId}`;
      
      // Read the zkey file
      const zkeyData = fs.readFileSync(localPath);
      
      // Create the secret
      try {
        await this.client.createSecret({
          parent,
          secretId,
          secret: {
            replication: {
              automatic: {},
            },
          },
        });
      } catch (err) {
        if (err.code !== 6) { // 6 = ALREADY_EXISTS
          throw err;
        }
      }
      
      // Add secret version
      const [version] = await this.client.addSecretVersion({
        parent: `${parent}/secrets/${secretId}`,
        payload: {
          data: zkeyData,
        },
      });
      
      console.log(`Uploaded ${circuitName} zkey to ${version.name}`);
      return version.name;
    } catch (error) {
      console.error(`Error uploading zkey for ${circuitName}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve zkey from Google Cloud Secret Manager
   * @param {string} circuitName - Name of the circuit
   * @returns {Buffer} The zkey data
   */
  async getZKey(circuitName) {
    try {
      const secretId = `zkey-${circuitName}`;
      const name = `projects/${this.projectId}/secrets/${secretId}/versions/latest`;
      
      const [response] = await this.client.accessSecretVersion({ name });
      const zkeyData = response.payload.data;
      
      return zkeyData;
    } catch (error) {
      console.error(`Error retrieving zkey for ${circuitName}:`, error);
      throw error;
    }
  }

  /**
   * Generate proof using secure zkey from Google Cloud
   * @param {string} circuitName - Name of the circuit
   * @param {object} input - Circuit input
   * @param {string} wasmPath - Path to WASM file
   */
  async generateProof(circuitName, input, wasmPath) {
    const snarkjs = require('snarkjs');
    
    try {
      // Get zkey from Google Cloud
      const zkeyData = await this.getZKey(circuitName);
      
      // Write to temporary file (in memory would be better)
      const tempPath = `/tmp/${circuitName}-${Date.now()}.zkey`;
      fs.writeFileSync(tempPath, zkeyData);
      
      try {
        // Generate proof
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
          input,
          wasmPath,
          tempPath
        );
        
        return { proof, publicSignals };
      } finally {
        // Always clean up temporary file
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      }
    } catch (error) {
      console.error(`Error generating proof for ${circuitName}:`, error);
      throw error;
    }
  }
}

module.exports = ZKeyManager;