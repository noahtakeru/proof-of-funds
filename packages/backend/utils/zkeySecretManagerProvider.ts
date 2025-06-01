/**
 * ZKey Provider implementation using Google Cloud Secret Manager
 * 
 * This module implements the ZKeyProvider interface for Google Cloud Secret Manager.
 * It is used for storing and retrieving smaller ZK proving keys securely.
 */

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { BaseZKeyProvider } from './zkeyProvider';
import { promises as fs } from 'fs';

/**
 * ZKey provider using Google Cloud Secret Manager
 */
export class SecretManagerZKeyProvider extends BaseZKeyProvider {
  private client: any;
  private projectId: string;
  
  /**
   * Initialize the Secret Manager provider
   */
  constructor() {
    super();
    this.client = new SecretManagerServiceClient();
    this.projectId = process.env.GCP_PROJECT_ID || '';
    
    if (!this.projectId) {
      console.warn('GCP_PROJECT_ID is not set in environment variables');
    }
  }
  
  /**
   * Upload a ZKey file to Google Cloud Secret Manager
   * @param circuitName Name of the circuit
   * @param localPath Local path to the zkey file
   */
  async uploadZKey(circuitName: string, localPath: string): Promise<string> {
    try {
      const secretId = `zkey-${circuitName}`;
      const parent = `projects/${this.projectId}`;
      
      // Read the zkey file
      const zkeyData = await fs.readFile(localPath);
      
      // Create the secret if it doesn't exist
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
      } catch (err: any) {
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
   * Get ZKey from Google Cloud Secret Manager
   * @param circuitName Name of the circuit
   */
  async getZKey(circuitName: string): Promise<Buffer> {
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
}

export default SecretManagerZKeyProvider;