/**
 * Trusted Setup Manager for Zero-Knowledge Proof System
 * 
 * Handles trusted setup ceremony infrastructure, including parameters, key generation, 
 * and ceremony verification.
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This module handles the secure process of creating the special mathematical parameters
 * needed for our zero-knowledge proofs. Think of it like creating a secure lock where
 * multiple people each contribute a piece, but nobody has the complete key. This process,
 * called a "trusted setup ceremony," ensures that our privacy system can't be compromised
 * even if some participants try to cheat.
 * 
 * Business value: Provides the critical foundation for verifiable and trustworthy 
 * zero-knowledge proofs, ensuring that the entire privacy system can be trusted.
 */

import { keccak256, sha256 } from 'js-sha3';
import { stringifyBigInts, parseBigInts } from './zkUtils.js';
import SecureKeyManager from './SecureKeyManager.js';
import TamperDetection from './TamperDetection.js';

// Default configuration for trusted setup
const DEFAULT_CONFIG = {
  minParticipants: 3,         // Minimum number of participants for security
  optimalParticipants: 5,     // Recommended number of participants
  contributionTimeout: 48,    // Hours before contribution times out
  verificationThreshold: 2,   // Number of independent verifications required
  entropyMinLength: 32,       // Minimum entropy length in bytes
  powDifficulty: 3,           // Proof-of-work difficulty for anti-spam
  backupCount: 3,             // Number of encrypted backups to maintain
  securityLevel: 'standard',  // standard | enhanced | maximum
};

/**
 * Trusted Setup Manager class
 * Manages multi-party trusted setup ceremonies for zero-knowledge proofs
 */
class TrustedSetupManager {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.ceremonies = new Map();
    this.verificationKeys = new Map();
    this.secureKeyManager = new SecureKeyManager();
    this.tamperDetection = new TamperDetection();
    
    // Loaded circuitsf
    this.circuits = new Map();
    
    // Ceremony status tracking
    this.activeParticipants = new Map();
    this.contributionHistory = [];
    
    // Verification key registry
    this.verificationKeyRegistry = new Map();
    
    // Initialization timestamp
    this.initialized = Date.now();
  }
  
  /**
   * Initialize a new ceremony for a specific circuit
   * 
   * @param {Object} params - Ceremony parameters
   * @param {string} params.circuitId - Unique identifier for the circuit
   * @param {string} params.circuitName - Human-readable name
   * @param {Object} params.initialParameters - Initial parameters (if any)
   * @param {number} params.securityLevel - Security level for the ceremony
   * @returns {string} Ceremony ID
   * 
   * ---------- BUSINESS CONTEXT ----------
   * This function starts the process of creating secure parameters for our
   * zero-knowledge system. It's like initializing a secure vault that will
   * require multiple trusted parties to set up. Each circuit (mathematical
   * function) in our system needs its own separate trusted setup ceremony.
   * This initialization establishes the rules and requirements for that
   * particular ceremony.
   */
  initializeCeremony(params) {
    const { circuitId, circuitName, initialParameters, securityLevel } = params;
    
    if (!circuitId || !circuitName) {
      throw new Error('Circuit ID and name are required');
    }
    
    // Generate a unique ceremony ID
    const ceremonyId = this.generateCeremonyId(circuitId);
    
    // Create ceremony record
    const ceremony = {
      id: ceremonyId,
      circuitId,
      circuitName,
      status: 'initialized',
      securityLevel: securityLevel || this.config.securityLevel,
      startTime: Date.now(),
      endTime: null,
      requiredParticipants: this.config.minParticipants,
      currentParticipants: 0,
      contributions: [],
      verifications: [],
      currentParameters: initialParameters || null,
      finalParameters: null,
      verificationKey: null,
      lastUpdated: Date.now(),
    };
    
    // Store the ceremony
    this.ceremonies.set(ceremonyId, ceremony);
    
    // Log initialization
    console.log(`Ceremony ${ceremonyId} initialized for circuit ${circuitName}`);
    
    return ceremonyId;
  }
  
  /**
   * Register a participant for a ceremony
   * 
   * @param {string} ceremonyId - ID of the ceremony
   * @param {Object} participant - Participant information
   * @param {string} participant.id - Unique identifier for the participant
   * @param {string} participant.name - Optional display name
   * @param {string} participant.publicKey - Public key for verification
   * @returns {Object} Registration information
   * 
   * ---------- BUSINESS CONTEXT ----------
   * This function allows a person or organization to join the trusted setup
   * process. It's like registering to be one of the trusted key holders for
   * our secure vault. The system checks that the participant meets the
   * necessary requirements and hasn't participated before, ensuring that
   * the ceremony has proper diversity of participants for security.
   */
  registerParticipant(ceremonyId, participant) {
    // Validate ceremony exists
    const ceremony = this.ceremonies.get(ceremonyId);
    if (!ceremony) {
      throw new Error(`Ceremony ${ceremonyId} not found`);
    }
    
    // Check ceremony status
    if (ceremony.status !== 'initialized' && ceremony.status !== 'in_progress') {
      throw new Error(`Ceremony ${ceremonyId} is not accepting registrations (status: ${ceremony.status})`);
    }
    
    // Validate participant
    if (!participant.id || !participant.publicKey) {
      throw new Error('Participant ID and public key are required');
    }
    
    // Check for existing participant
    const existingParticipant = ceremony.contributions.find(c => c.participantId === participant.id);
    if (existingParticipant) {
      throw new Error(`Participant ${participant.id} has already contributed to this ceremony`);
    }
    
    // Register participant
    const registration = {
      participantId: participant.id,
      displayName: participant.name || `Participant ${participant.id.substring(0, 8)}`,
      publicKey: participant.publicKey,
      registrationTime: Date.now(),
      status: 'registered',
      contributionOrder: ceremony.contributions.length + 1,
      timeoutAt: Date.now() + (this.config.contributionTimeout * 60 * 60 * 1000),
    };
    
    // Add to active participants
    this.activeParticipants.set(participant.id, {
      ceremonyId,
      registrationTime: registration.registrationTime,
      lastActivity: Date.now(),
    });
    
    // Update ceremony
    ceremony.currentParticipants++;
    ceremony.lastUpdated = Date.now();
    if (ceremony.status === 'initialized' && ceremony.currentParticipants >= 1) {
      ceremony.status = 'in_progress';
    }
    
    // Add registration to contributions list
    ceremony.contributions.push(registration);
    
    return {
      ceremonyId,
      participantId: participant.id,
      contributionOrder: registration.contributionOrder,
      timeoutAt: registration.timeoutAt,
      status: registration.status,
    };
  }
  
  /**
   * Submit a contribution to the ceremony
   * 
   * @param {string} ceremonyId - ID of the ceremony
   * @param {Object} contribution - Contribution data
   * @param {string} contribution.participantId - ID of the participant
   * @param {Object} contribution.parameters - Updated parameters
   * @param {string} contribution.hash - Hash of the parameters
   * @param {Object} contribution.proof - Contribution proof
   * @returns {Object} Contribution receipt
   * 
   * ---------- BUSINESS CONTEXT ----------
   * This function enables a registered participant to add their secure
   * contribution to the ceremony. It's like each trusted party adding their
   * piece to the lock mechanism, where each piece makes the lock more secure.
   * The system verifies the integrity of each contribution to ensure it
   * doesn't compromise the security of the system.
   */
  async submitContribution(ceremonyId, contribution) {
    // Validate ceremony exists
    const ceremony = this.ceremonies.get(ceremonyId);
    if (!ceremony) {
      throw new Error(`Ceremony ${ceremonyId} not found`);
    }
    
    // Check ceremony status
    if (ceremony.status !== 'in_progress') {
      throw new Error(`Ceremony ${ceremonyId} is not accepting contributions (status: ${ceremony.status})`);
    }
    
    // Validate contribution
    if (!contribution.participantId || !contribution.parameters || !contribution.hash) {
      throw new Error('Participant ID, parameters, and hash are required');
    }
    
    // Find participant registration
    const participantIndex = ceremony.contributions.findIndex(
      c => c.participantId === contribution.participantId && c.status === 'registered'
    );
    
    if (participantIndex === -1) {
      throw new Error(`Participant ${contribution.participantId} is not registered for this ceremony`);
    }
    
    // Validate hash
    const calculatedHash = this.hashParameters(contribution.parameters);
    if (calculatedHash !== contribution.hash) {
      throw new Error('Parameter hash verification failed');
    }
    
    // Update participant status
    ceremony.contributions[participantIndex] = {
      ...ceremony.contributions[participantIndex],
      contributionTime: Date.now(),
      status: 'contributed',
      hash: contribution.hash,
      proof: contribution.proof || null,
    };
    
    // Update ceremony parameters
    ceremony.currentParameters = contribution.parameters;
    ceremony.lastUpdated = Date.now();
    
    // Check if ceremony is complete
    if (this.checkCeremonyCompletion(ceremony)) {
      await this.finalizeCeremony(ceremonyId);
    }
    
    // Remove from active participants
    this.activeParticipants.delete(contribution.participantId);
    
    // Add to contribution history
    this.contributionHistory.push({
      ceremonyId,
      participantId: contribution.participantId,
      timestamp: Date.now(),
      hash: contribution.hash,
    });
    
    // Generate receipt
    return {
      ceremonyId,
      participantId: contribution.participantId,
      contributionOrder: ceremony.contributions[participantIndex].contributionOrder,
      timestamp: Date.now(),
      hash: contribution.hash,
      receipt: this.generateContributionReceipt(ceremonyId, contribution),
      status: 'accepted',
    };
  }
  
  /**
   * Verify a ceremony's contributions
   * 
   * @param {string} ceremonyId - ID of the ceremony
   * @param {Object} verification - Verification information
   * @param {string} verification.verifierId - ID of the verifier
   * @param {boolean} verification.result - Verification result
   * @param {Object} verification.metadata - Additional verification metadata
   * @returns {Object} Verification status
   * 
   * ---------- BUSINESS CONTEXT ----------
   * This function ensures that the trusted setup process has been conducted
   * correctly by allowing independent parties to verify the mathematical
   * correctness of the process. It's like having auditors check that our
   * secure vault was built according to specifications. This verification
   * provides assurance that the zero-knowledge proofs generated with these
   * parameters will be secure and trustworthy.
   */
  async verifyCeremony(ceremonyId, verification) {
    // Validate ceremony exists
    const ceremony = this.ceremonies.get(ceremonyId);
    if (!ceremony) {
      throw new Error(`Ceremony ${ceremonyId} not found`);
    }
    
    // Validate verification
    if (!verification.verifierId || verification.result === undefined) {
      throw new Error('Verifier ID and result are required');
    }
    
    // Check for duplicate verification
    const existingVerification = ceremony.verifications.find(v => v.verifierId === verification.verifierId);
    if (existingVerification) {
      throw new Error(`Verifier ${verification.verifierId} has already verified this ceremony`);
    }
    
    // Add verification
    const verificationEntry = {
      verifierId: verification.verifierId,
      timestamp: Date.now(),
      result: verification.result,
      metadata: verification.metadata || {},
    };
    
    ceremony.verifications.push(verificationEntry);
    ceremony.lastUpdated = Date.now();
    
    // Check verification threshold
    const successfulVerifications = ceremony.verifications.filter(v => v.result === true).length;
    
    if (ceremony.status === 'completed' && 
        successfulVerifications >= this.config.verificationThreshold) {
      ceremony.status = 'verified';
      ceremony.lastUpdated = Date.now();
      
      // Store verification key in registry
      if (ceremony.verificationKey) {
        this.registerVerificationKey(ceremonyId, ceremony.verificationKey);
      }
    }
    
    return {
      ceremonyId,
      verifierId: verification.verifierId,
      timestamp: Date.now(),
      result: verification.result,
      ceremonyStatus: ceremony.status,
      successfulVerifications,
      requiredVerifications: this.config.verificationThreshold,
    };
  }
  
  /**
   * Finalize a ceremony and generate verification key
   * 
   * @param {string} ceremonyId - ID of the ceremony to finalize
   * @returns {Object} Final ceremony parameters
   * 
   * ---------- BUSINESS CONTEXT ----------
   * This function completes the trusted setup process by finalizing the
   * parameters and generating the verification key. It's like putting the
   * final touches on our secure vault and creating the verification mechanism
   * that will be used to check the validity of zero-knowledge proofs. The
   * finalized parameters will be used in all future proof generations, while
   * the verification key will be published for anyone to verify proofs.
   */
  async finalizeCeremony(ceremonyId) {
    // Validate ceremony exists
    const ceremony = this.ceremonies.get(ceremonyId);
    if (!ceremony) {
      throw new Error(`Ceremony ${ceremonyId} not found`);
    }
    
    // Check if ceremony is ready for finalization
    if (!this.checkCeremonyCompletion(ceremony)) {
      throw new Error(`Ceremony ${ceremonyId} is not ready for finalization`);
    }
    
    try {
      // Generate verification key from final parameters
      const verificationKey = await this.generateVerificationKey(ceremony.currentParameters);
      
      // Update ceremony status
      ceremony.status = 'completed';
      ceremony.endTime = Date.now();
      ceremony.finalParameters = ceremony.currentParameters;
      ceremony.verificationKey = verificationKey;
      ceremony.lastUpdated = Date.now();
      
      // Store verification key (but don't register until verified)
      this.verificationKeys.set(ceremonyId, {
        key: verificationKey,
        timestamp: Date.now(),
        status: 'pending_verification',
        ceremonyId,
        circuitId: ceremony.circuitId,
      });
      
      // Create tamper-evident backup of parameters
      await this.backupCeremonyParameters(ceremony);
      
      console.log(`Ceremony ${ceremonyId} finalized successfully`);
      
      return {
        ceremonyId,
        status: ceremony.status,
        finalizedAt: ceremony.endTime,
        participantCount: ceremony.contributions.filter(c => c.status === 'contributed').length,
        verificationKey: {
          id: verificationKey.id,
          circuit: ceremony.circuitName,
          hash: this.hashVerificationKey(verificationKey),
        },
      };
    } catch (error) {
      console.error(`Error finalizing ceremony ${ceremonyId}:`, error);
      throw new Error(`Failed to finalize ceremony: ${error.message}`);
    }
  }
  
  /**
   * Register a verification key in the registry
   * 
   * @param {string} ceremonyId - ID of the source ceremony
   * @param {Object} verificationKey - The verification key
   * @returns {string} Key ID in the registry
   * 
   * ---------- BUSINESS CONTEXT ----------
   * This function adds a verified zero-knowledge verification key to the
   * official registry. It's like publishing the specifications for our
   * secure lock so others can verify that locks were constructed properly,
   * without revealing the secrets needed to create them. This registry
   * becomes the trusted source of verification keys that applications use
   * when they need to verify zero-knowledge proofs.
   */
  registerVerificationKey(ceremonyId, verificationKey) {
    // Generate key ID if not present
    const keyId = verificationKey.id || this.generateKeyId(verificationKey);
    
    // Create registry entry
    const entry = {
      id: keyId,
      ceremonyId,
      circuitId: this.ceremonies.get(ceremonyId)?.circuitId,
      timestamp: Date.now(),
      key: verificationKey,
      hash: this.hashVerificationKey(verificationKey),
      status: 'active',
    };
    
    // Add to registry
    this.verificationKeyRegistry.set(keyId, entry);
    
    console.log(`Verification key ${keyId} registered for ceremony ${ceremonyId}`);
    
    return keyId;
  }
  
  /**
   * Get a verification key from the registry
   * 
   * @param {string} keyId - ID of the verification key
   * @returns {Object} The verification key
   * 
   * ---------- BUSINESS CONTEXT ----------
   * This function retrieves a specific verification key from the registry
   * when needed to check the validity of a zero-knowledge proof. It's like
   * looking up the specifications of a specific lock model to verify that
   * a lock was properly constructed. Applications use this function whenever
   * they need to validate a proof that was generated using parameters from
   * a specific trusted setup ceremony.
   */
  getVerificationKey(keyId) {
    // Get from registry
    const entry = this.verificationKeyRegistry.get(keyId);
    if (!entry) {
      throw new Error(`Verification key ${keyId} not found`);
    }
    
    return {
      id: entry.id,
      ceremonyId: entry.ceremonyId,
      circuitId: entry.circuitId,
      hash: entry.hash,
      key: entry.key,
      status: entry.status,
    };
  }
  
  /**
   * Get ceremony status and information
   * 
   * @param {string} ceremonyId - ID of the ceremony
   * @returns {Object} Ceremony status and information
   * 
   * ---------- BUSINESS CONTEXT ----------
   * This function provides detailed information about a trusted setup ceremony,
   * including its current status, participants, and progress. It's like getting
   * a status report on the secure vault setup process. This information is
   * useful for participants, auditors, and administrators who need to monitor
   * the trusted setup process and ensure it's proceeding correctly.
   */
  getCeremonyStatus(ceremonyId) {
    // Get ceremony
    const ceremony = this.ceremonies.get(ceremonyId);
    if (!ceremony) {
      throw new Error(`Ceremony ${ceremonyId} not found`);
    }
    
    // Build response with safe information
    return {
      id: ceremony.id,
      circuitId: ceremony.circuitId,
      circuitName: ceremony.circuitName,
      status: ceremony.status,
      startTime: ceremony.startTime,
      endTime: ceremony.endTime,
      requiredParticipants: ceremony.requiredParticipants,
      currentParticipants: ceremony.currentParticipants,
      contributionCount: ceremony.contributions.filter(c => c.status === 'contributed').length,
      verificationCount: ceremony.verifications.length,
      successfulVerifications: ceremony.verifications.filter(v => v.result === true).length,
      lastUpdated: ceremony.lastUpdated,
      // Only include the verification key hash if available
      verificationKeyHash: ceremony.verificationKey ? this.hashVerificationKey(ceremony.verificationKey) : null,
    };
  }
  
  /**
   * List all ceremonies and their statuses
   * 
   * @param {Object} filters - Optional filters
   * @returns {Array<Object>} List of ceremony summaries
   * 
   * ---------- BUSINESS CONTEXT ----------
   * This function provides an overview of all trusted setup ceremonies in the
   * system, allowing administrators to monitor multiple setup processes at once.
   * It's like getting a dashboard view of all secure vault setups in progress.
   * This information is useful for keeping track of which circuits have
   * completed their trusted setup and which ones still need participants.
   */
  listCeremonies(filters = {}) {
    let ceremonies = Array.from(this.ceremonies.values());
    
    // Apply filters if provided
    if (filters.status) {
      ceremonies = ceremonies.filter(c => c.status === filters.status);
    }
    
    if (filters.circuitId) {
      ceremonies = ceremonies.filter(c => c.circuitId === filters.circuitId);
    }
    
    // Return summaries
    return ceremonies.map(c => ({
      id: c.id,
      circuitId: c.circuitId,
      circuitName: c.circuitName,
      status: c.status,
      startTime: c.startTime,
      endTime: c.endTime,
      requiredParticipants: c.requiredParticipants,
      currentParticipants: c.currentParticipants,
      contributionCount: c.contributions.filter(con => con.status === 'contributed').length,
      verificationCount: c.verifications.length,
      lastUpdated: c.lastUpdated,
    }));
  }
  
  /**
   * Generate a unique ceremony ID
   * 
   * @private
   * @param {string} circuitId - Circuit identifier
   * @returns {string} Unique ceremony ID
   */
  generateCeremonyId(circuitId) {
    const timestamp = Date.now().toString(36);
    const randomBytes = new Uint8Array(8);
    
    // Use crypto API if available
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(randomBytes);
    } else {
      // Fallback for non-browser environments
      for (let i = 0; i < 8; i++) {
        randomBytes[i] = Math.floor(Math.random() * 256);
      }
    }
    
    const randomPart = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return `ceremony-${circuitId}-${timestamp}-${randomPart}`;
  }
  
  /**
   * Hash ceremony parameters for integrity verification
   * 
   * @private
   * @param {Object} parameters - The parameters to hash
   * @returns {string} Hash of the parameters
   */
  hashParameters(parameters) {
    // Convert to string for consistent hashing
    const serialized = JSON.stringify(stringifyBigInts(parameters));
    
    // Use SHA-256 for hashing
    return '0x' + sha256(serialized);
  }
  
  /**
   * Hash a verification key for identification
   * 
   * @private
   * @param {Object} verificationKey - The key to hash
   * @returns {string} Hash of the verification key
   */
  hashVerificationKey(verificationKey) {
    // Convert to string for consistent hashing
    const serialized = JSON.stringify(stringifyBigInts(verificationKey));
    
    // Use SHA-256 for hashing
    return '0x' + sha256(serialized);
  }
  
  /**
   * Generate a verification key from parameters
   * 
   * @private
   * @param {Object} parameters - Final ceremony parameters
   * @returns {Promise<Object>} Generated verification key
   */
  async generateVerificationKey(parameters) {
    try {
      // In a real implementation, this would use the zero-knowledge library
      // to derive a verification key from parameters
      
      // For now, create a sample verification key
      const keyId = 'vk-' + Date.now().toString(36);
      
      return {
        id: keyId,
        timestamp: Date.now(),
        alpha: parameters.alpha || 'sample_alpha',
        beta: parameters.beta || 'sample_beta',
        gamma: parameters.gamma || 'sample_gamma',
        delta: parameters.delta || 'sample_delta',
        ic: parameters.ic || ['sample_ic'],
      };
    } catch (error) {
      console.error('Error generating verification key:', error);
      throw new Error(`Failed to generate verification key: ${error.message}`);
    }
  }
  
  /**
   * Check if a ceremony has received sufficient contributions
   * 
   * @private
   * @param {Object} ceremony - The ceremony to check
   * @returns {boolean} Whether the ceremony is complete
   */
  checkCeremonyCompletion(ceremony) {
    // Count valid contributions
    const validContributions = ceremony.contributions.filter(c => c.status === 'contributed').length;
    
    // Check against required participants
    return validContributions >= ceremony.requiredParticipants;
  }
  
  /**
   * Generate a receipt for a contribution
   * 
   * @private
   * @param {string} ceremonyId - Ceremony ID
   * @param {Object} contribution - Contribution data
   * @returns {string} Contribution receipt
   */
  generateContributionReceipt(ceremonyId, contribution) {
    const ceremony = this.ceremonies.get(ceremonyId);
    
    // Create receipt data
    const receiptData = {
      ceremonyId,
      ceremonyName: ceremony.circuitName,
      participantId: contribution.participantId,
      timestamp: Date.now(),
      contributionHash: contribution.hash,
      order: ceremony.contributions.findIndex(c => c.participantId === contribution.participantId) + 1,
    };
    
    // Sign receipt data
    const signedData = this.tamperDetection.sign(receiptData);
    
    // Return receipt
    return Buffer.from(JSON.stringify(signedData)).toString('base64');
  }
  
  /**
   * Create secure backups of ceremony parameters
   * 
   * @private
   * @param {Object} ceremony - The ceremony to backup
   * @returns {Promise<void>}
   */
  async backupCeremonyParameters(ceremony) {
    try {
      // Generate a secure key for each backup
      const backupKeys = [];
      for (let i = 0; i < this.config.backupCount; i++) {
        const backupKey = this.secureKeyManager.generateEncryptionKey();
        backupKeys.push(backupKey);
      }
      
      // Create encrypted backups
      const backups = [];
      for (let i = 0; i < backupKeys.length; i++) {
        // Prepare data for backup
        const backupData = {
          ceremonyId: ceremony.id,
          circuitId: ceremony.circuitId,
          circuitName: ceremony.circuitName,
          timestamp: Date.now(),
          parameters: ceremony.finalParameters,
          verificationKey: ceremony.verificationKey,
          participantCount: ceremony.contributions.filter(c => c.status === 'contributed').length,
          backupId: `backup-${ceremony.id}-${i + 1}`,
        };
        
        // Add tamper detection
        const protectedData = await this.tamperDetection.protect(backupData, backupKeys[i]);
        
        // Encrypt the backup
        const encryptedBackup = await this.secureKeyManager.encrypt(
          JSON.stringify(protectedData),
          backupKeys[i]
        );
        
        backups.push({
          id: backupData.backupId,
          data: encryptedBackup,
          keyId: `key-${backupData.backupId}`,
          timestamp: backupData.timestamp,
        });
      }
      
      // In a real implementation, these backups would be stored securely
      // For now, just log that backups were created
      console.log(`Created ${backups.length} encrypted backups for ceremony ${ceremony.id}`);
    } catch (error) {
      console.error(`Error creating backups for ceremony ${ceremony.id}:`, error);
    }
  }
  
  /**
   * Generate a unique key ID
   * 
   * @private
   * @param {Object} key - Key data
   * @returns {string} Unique key ID
   */
  generateKeyId(key) {
    // Hash key data for ID
    const keyHash = this.hashVerificationKey(key);
    
    // Use first 16 chars of hash plus timestamp
    const timestamp = Date.now().toString(36);
    return `vk-${keyHash.substring(2, 18)}-${timestamp}`;
  }
}

// Export as singleton
const trustedSetupManager = new TrustedSetupManager();
export default trustedSetupManager;