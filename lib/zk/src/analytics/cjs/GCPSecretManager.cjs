/**
 * GCP Secret Manager for Secure Credential Storage
 * 
 * This module implements secure credential management using Google Cloud Platform's Secret Manager,
 * providing a secure way to store, access, and rotate sensitive credentials and API keys.
 * 
 * Key features:
 * - Secure storage of service account keys
 * - Access control for credentials
 * - Credential rotation support
 * - Environment separation (dev/staging/prod)
 */

const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const { zkErrorLogger } = require('../zkErrorLogger.cjs');

// Secret type enum
const SecretType = {
  SERVICE_ACCOUNT_KEY: 'service_account_key',
  API_KEY: 'api_key',
  DATABASE_CREDENTIAL: 'database_credential',
  SIGNING_KEY: 'signing_key',
  ENCRYPTION_KEY: 'encryption_key',
  WEBHOOK_SECRET: 'webhook_secret',
  OTHER: 'other'
};

// Secret metadata interface
/**
 * @typedef {Object} SecretMetadata
 * @property {string} name
 * @property {string} type
 * @property {string} description
 * @property {Date} created
 * @property {Date} [lastAccessed]
 * @property {Date} [lastRotated]
 * @property {string} [rotationSchedule]
 * @property {'development'|'staging'|'production'} environment
 * @property {string[]} [accessRestrictions]
 */

/**
 * GCP Secret Manager Service
 */
class GCPSecretManager {
  /**
   * Constructs a new GCP Secret Manager instance
   * 
   * @param {string} projectId - The GCP project ID
   * @param {'development'|'staging'|'production'} environment - The current environment
   */
  constructor(
    projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || '',
    environment = process.env.NODE_ENV || 'development'
  ) {
    this.client = null;
    this.projectId = projectId;
    this.secretMetadata = new Map();
    this.environment = environment;
    
    try {
      // Initialize the Secret Manager client
      if (projectId) {
        this.client = new SecretManagerServiceClient();
        this.loadSecretMetadata().catch(error => {
          zkErrorLogger.log('ERROR', 'Failed to load secret metadata', {
            category: 'gcp_integration',
            userFixable: true,
            recoverable: true,
            details: { error: error.message }
          });
        });
      } else {
        zkErrorLogger.log('WARNING', 'GCP Secret Manager initialized without project ID', {
          category: 'gcp_integration',
          userFixable: true,
          recoverable: true
        });
      }
    } catch (error) {
      zkErrorLogger.log('ERROR', 'Failed to initialize GCP Secret Manager', {
        category: 'gcp_integration',
        userFixable: true,
        recoverable: false,
        details: { error: error.message }
      });
    }
  }
  
  /**
   * Get a secret value by name
   * 
   * @param {string} secretName - The name of the secret to retrieve
   * @returns {Promise<string|null>} The secret value as a string, or null if not found
   */
  async getSecret(secretName) {
    if (!this.client || !this.projectId) {
      zkErrorLogger.log('ERROR', 'GCP Secret Manager not properly initialized', {
        category: 'gcp_integration',
        userFixable: true,
        recoverable: false
      });
      return null;
    }
    
    try {
      // Format the secret name with environment prefix
      const formattedSecretName = this.formatSecretName(secretName);
      
      // Access the latest version of the secret
      const [version] = await this.client.accessSecretVersion({
        name: `projects/${this.projectId}/secrets/${formattedSecretName}/versions/latest`
      });
      
      // Extract and return the secret payload
      const payload = version.payload?.data?.toString() || null;
      
      // Update access timestamp
      const metadata = this.secretMetadata.get(formattedSecretName);
      if (metadata) {
        metadata.lastAccessed = new Date();
        this.secretMetadata.set(formattedSecretName, metadata);
      }
      
      return payload;
    } catch (error) {
      zkErrorLogger.log('ERROR', `Failed to retrieve secret: ${secretName}`, {
        category: 'gcp_integration',
        userFixable: true,
        recoverable: true,
        details: { error: error.message }
      });
      return null;
    }
  }
  
  /**
   * Store a new secret or update an existing one
   * 
   * @param {string} secretName - The name of the secret
   * @param {string} secretValue - The value to store
   * @param {Object} [metadata] - Optional metadata about the secret
   * @returns {Promise<boolean>} True if the secret was successfully stored
   */
  async storeSecret(secretName, secretValue, metadata) {
    if (!this.client || !this.projectId) {
      zkErrorLogger.log('ERROR', 'GCP Secret Manager not properly initialized', {
        category: 'gcp_integration',
        userFixable: true,
        recoverable: false
      });
      return false;
    }
    
    try {
      // Format the secret name with environment prefix
      const formattedSecretName = this.formatSecretName(secretName);
      
      // Check if the secret already exists
      let secretExists = false;
      try {
        await this.client.getSecret({
          name: `projects/${this.projectId}/secrets/${formattedSecretName}`
        });
        secretExists = true;
      } catch (error) {
        // Secret doesn't exist yet, we'll create it
      }
      
      // Create the secret if it doesn't exist
      if (!secretExists) {
        await this.client.createSecret({
          parent: `projects/${this.projectId}`,
          secretId: formattedSecretName,
          secret: {
            replication: {
              automatic: {}
            },
            labels: {
              environment: this.environment,
              type: metadata?.type || SecretType.OTHER
            }
          }
        });
      }
      
      // Add the new version of the secret
      await this.client.addSecretVersion({
        parent: `projects/${this.projectId}/secrets/${formattedSecretName}`,
        payload: {
          data: Buffer.from(secretValue)
        }
      });
      
      // Update or create metadata
      const existingMetadata = this.secretMetadata.get(formattedSecretName);
      const now = new Date();
      
      this.secretMetadata.set(formattedSecretName, {
        name: formattedSecretName,
        type: metadata?.type || existingMetadata?.type || SecretType.OTHER,
        description: metadata?.description || existingMetadata?.description || '',
        created: existingMetadata?.created || now,
        lastAccessed: now,
        lastRotated: now,
        rotationSchedule: metadata?.rotationSchedule || existingMetadata?.rotationSchedule,
        environment: this.environment,
        accessRestrictions: metadata?.accessRestrictions || existingMetadata?.accessRestrictions
      });
      
      return true;
    } catch (error) {
      zkErrorLogger.log('ERROR', `Failed to store secret: ${secretName}`, {
        category: 'gcp_integration',
        userFixable: true,
        recoverable: true,
        details: { error: error.message }
      });
      return false;
    }
  }
  
  /**
   * Delete a secret
   * 
   * @param {string} secretName - The name of the secret to delete
   * @returns {Promise<boolean>} True if the secret was successfully deleted
   */
  async deleteSecret(secretName) {
    if (!this.client || !this.projectId) {
      zkErrorLogger.log('ERROR', 'GCP Secret Manager not properly initialized', {
        category: 'gcp_integration',
        userFixable: true,
        recoverable: false
      });
      return false;
    }
    
    try {
      // Format the secret name with environment prefix
      const formattedSecretName = this.formatSecretName(secretName);
      
      // Delete the secret
      await this.client.deleteSecret({
        name: `projects/${this.projectId}/secrets/${formattedSecretName}`
      });
      
      // Remove metadata
      this.secretMetadata.delete(formattedSecretName);
      
      return true;
    } catch (error) {
      zkErrorLogger.log('ERROR', `Failed to delete secret: ${secretName}`, {
        category: 'gcp_integration',
        userFixable: true,
        recoverable: true,
        details: { error: error.message }
      });
      return false;
    }
  }
  
  /**
   * List all secrets for the current environment
   * 
   * @returns {Promise<SecretMetadata[]>} Array of secret metadata
   */
  async listSecrets() {
    if (!this.client || !this.projectId) {
      zkErrorLogger.log('ERROR', 'GCP Secret Manager not properly initialized', {
        category: 'gcp_integration',
        userFixable: true,
        recoverable: false
      });
      return [];
    }
    
    try {
      // Load latest metadata if not already loaded
      if (this.secretMetadata.size === 0) {
        await this.loadSecretMetadata();
      }
      
      // Return all metadata entries for the current environment
      return Array.from(this.secretMetadata.values())
        .filter(metadata => metadata.environment === this.environment);
    } catch (error) {
      zkErrorLogger.log('ERROR', 'Failed to list secrets', {
        category: 'gcp_integration',
        userFixable: true,
        recoverable: true,
        details: { error: error.message }
      });
      return [];
    }
  }
  
  /**
   * Rotate a secret by generating a new version
   * 
   * @param {string} secretName - The name of the secret to rotate
   * @param {string} newValue - The new value for the secret
   * @returns {Promise<boolean>} True if the secret was successfully rotated
   */
  async rotateSecret(secretName, newValue) {
    // Rotating a secret is the same as storing a new version
    const result = await this.storeSecret(secretName, newValue);
    
    if (result) {
      // Update rotation timestamp
      const formattedSecretName = this.formatSecretName(secretName);
      const metadata = this.secretMetadata.get(formattedSecretName);
      
      if (metadata) {
        metadata.lastRotated = new Date();
        this.secretMetadata.set(formattedSecretName, metadata);
      }
    }
    
    return result;
  }
  
  /**
   * Format a secret name with environment prefix
   * 
   * @param {string} baseName - The base name of the secret
   * @returns {string} The environment-prefixed secret name
   * @private
   */
  formatSecretName(baseName) {
    // Remove any existing environment prefix
    const cleanName = baseName.replace(/^(development|staging|production)_/, '');
    
    // Add current environment prefix
    return `${this.environment}_${cleanName}`;
  }
  
  /**
   * Load metadata for all secrets
   * @private
   */
  async loadSecretMetadata() {
    if (!this.client || !this.projectId) {
      return;
    }
    
    try {
      // List all secrets in the project
      const [secrets] = await this.client.listSecrets({
        parent: `projects/${this.projectId}`
      });
      
      // Process each secret
      for (const secret of secrets) {
        if (!secret.name) continue;
        
        // Extract secret ID from the full name
        const secretId = secret.name.split('/').pop() || '';
        
        // Extract environment from prefix
        let environment = 'development';
        if (secretId.startsWith('production_')) {
          environment = 'production';
        } else if (secretId.startsWith('staging_')) {
          environment = 'staging';
        } else if (secretId.startsWith('development_')) {
          environment = 'development';
        }
        
        // Extract type from labels
        const type = (secret.labels?.type) || SecretType.OTHER;
        
        // Create metadata entry
        this.secretMetadata.set(secretId, {
          name: secretId,
          type,
          description: secret.labels?.description || '',
          created: new Date(secret.createTime?.seconds * 1000 || Date.now()),
          environment,
          accessRestrictions: []
        });
      }
    } catch (error) {
      zkErrorLogger.log('ERROR', 'Failed to load secret metadata', {
        category: 'gcp_integration',
        userFixable: true,
        recoverable: true,
        details: { error: error.message }
      });
    }
  }
}

// Create a singleton instance
const gcpSecretManager = new GCPSecretManager();

// Export for CommonJS
module.exports = {
  SecretType,
  GCPSecretManager,
  gcpSecretManager
};