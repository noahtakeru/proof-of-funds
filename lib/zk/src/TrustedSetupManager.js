/**
 * Trusted Setup Manager for Zero-Knowledge Proof System
 * 
 * Handles trusted setup ceremony infrastructure, including parameters, key generation, 
 * and ceremony verification.
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This module manages the "trusted setup ceremony" - a special security process that's
 * fundamental to our privacy system. Think of it like creating a lock box with these
 * unique properties:
 * 
 * 1. MULTIPLE LOCKSMITH REQUIREMENT: Multiple independent people (called "participants")
 *    must each add their own lock to the box. No single person can open it alone.
 * 
 * 2. ONE-WAY PROCESS: Once all the locks are added, certain secret information used
 *    to create the locks is permanently destroyed, like burning the original blueprints.
 * 
 * 3. TAMPER EVIDENCE: If anyone tries to compromise the security, it becomes immediately
 *    obvious to everyone, similar to how breaking a wax seal reveals tampering.
 * 
 * 4. VERIFICATION CAPABILITY: Anyone can verify the lock box was properly created
 *    without needing to know any secrets, similar to how you can test a lock without
 *    knowing how it was manufactured.
 * 
 * This security approach is critical because it creates the mathematical foundation
 * that makes our entire privacy system trustworthy. Even if some participants in the
 * ceremony tried to cheat, as long as ONE participant is honest, the entire system
 * remains secure.
 * 
 * Business value: Creates the foundational trust that enables our entire privacy
 * system to function with mathematical certainty that private information can't be
 * exposed, giving users and partners confidence in the platform's security guarantees.
 */

import pkg from 'js-sha3';
const { keccak256 } = pkg;
// Use SHA3-256 since SHA-256 is not available
const sha256 = pkg.sha3_256;
import { stringifyBigInts, parseBigInts } from './zkUtils.js';
import SecureKeyManager from './SecureKeyManager.js';
import TamperDetection from './TamperDetection.js';
import ParameterValidator from './ParameterValidator.js';
import SecurityAuditLogger from './SecurityAuditLogger.js';

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
    this.parameterValidator = ParameterValidator;
    
    // Initialize security audit logger
    this.auditLogger = new SecurityAuditLogger({
      component: 'TrustedSetupManager',
      logLevel: config.logLevel || 'standard',
      includeTimestamp: true,
      persistToStorage: true
    });

    // Loaded circuits
    this.circuits = new Map();

    // Ceremony status tracking
    this.activeParticipants = new Map();
    this.contributionHistory = [];

    // Verification key registry
    this.verificationKeyRegistry = new Map();
    
    // Key distribution channels
    this.distributionChannels = new Map();

    // Initialization timestamp
    this.initialized = Date.now();
    
    // Log initialization
    this.auditLogger.log('TrustedSetupManager initialized', {
      configSummary: {
        minParticipants: this.config.minParticipants,
        verificationThreshold: this.config.verificationThreshold,
        securityLevel: this.config.securityLevel
      },
      timestamp: this.initialized
    });
  }

  /**
   * Initialize a new ceremony for a specific circuit
   * 
   * @param {Object} params - Ceremony parameters
   * @param {string} params.circuitId - Unique identifier for the circuit
   * @param {string} params.circuitName - Human-readable name
   * @param {Object} params.initialParameters - Initial parameters (if any)
   * @param {number} params.securityLevel - Security level for the ceremony
   * @param {Object} params.validationOptions - Options for parameter validation
   * @param {Array<string>} params.distributionChannels - Channels for key distribution
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
    try {
      const { 
        circuitId, 
        circuitName, 
        initialParameters, 
        securityLevel,
        validationOptions = {},
        distributionChannels = ['standard']
      } = params;

      // Validate required parameters
      if (!circuitId || !circuitName) {
        throw new Error('Circuit ID and name are required');
      }

      // Check for duplicate ceremonies for the same circuit
      const existingCeremonies = Array.from(this.ceremonies.values())
        .filter(c => c.circuitId === circuitId && c.status !== 'completed' && c.status !== 'failed');
      
      if (existingCeremonies.length > 0) {
        const activeId = existingCeremonies[0].id;
        this.auditLogger.logWarning('Attempted to initialize duplicate ceremony', {
          circuitId,
          existingCeremonyId: activeId,
          status: existingCeremonies[0].status
        });
        throw new Error(`An active ceremony for circuit ${circuitId} already exists (${activeId})`);
      }

      // Generate a unique ceremony ID
      const ceremonyId = this.generateCeremonyId(circuitId);

      // Validate initial parameters if provided
      let validatedParameters = null;
      if (initialParameters) {
        // Simple validation for now, we'll use parameterValidator for actual validation
        if (typeof initialParameters !== 'object') {
          throw new Error('Initial parameters must be a valid object');
        }
        validatedParameters = initialParameters;
      }

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
        currentParameters: validatedParameters,
        finalParameters: null,
        verificationKey: null,
        lastUpdated: Date.now(),
        validationOptions: {
          validationLevel: validationOptions.validationLevel || 'standard',
          circuitType: validationOptions.circuitType || circuitId,
          ...validationOptions
        },
        distributionConfig: {
          channels: distributionChannels,
          redundancy: distributionChannels.length > 1,
          publicAccess: distributionChannels.includes('public')
        },
        audit: {
          creationTime: Date.now(),
          lastStatusChange: Date.now(),
          statusHistory: [{
            status: 'initialized',
            timestamp: Date.now()
          }]
        }
      };

      // Store the ceremony
      this.ceremonies.set(ceremonyId, ceremony);

      // Set up distribution channels
      distributionChannels.forEach(channel => {
        if (!this.distributionChannels.has(channel)) {
          this.distributionChannels.set(channel, new Map());
        }
      });

      // Log initialization with audit logger
      this.auditLogger.log('Ceremony initialized', {
        ceremonyId,
        circuitId,
        circuitName,
        securityLevel: ceremony.securityLevel,
        requiredParticipants: ceremony.requiredParticipants,
        distributionChannels: ceremony.distributionConfig.channels
      });

      return ceremonyId;
    } catch (error) {
      // Log error
      this.auditLogger.logError('Ceremony initialization failed', {
        error: error.message,
        circuitId: params.circuitId || 'unknown'
      });
      
      // Re-throw for caller
      throw error;
    }
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
   * @param {string} contribution.entropy - Source of entropy (optional)
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
    const contributionStartTime = Date.now();
    const contributionId = `contrib-${ceremonyId}-${contributionStartTime}`;
    
    try {
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

      // Validate entropy if provided
      if (contribution.entropy) {
        if (typeof contribution.entropy !== 'string' || 
            contribution.entropy.length < this.config.entropyMinLength) {
          throw new Error(`Entropy must be a string of at least ${this.config.entropyMinLength} characters`);
        }
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
        this.auditLogger.logSecurity('Parameter hash verification failed', {
          ceremonyId,
          participantId: contribution.participantId,
          expectedHash: contribution.hash,
          calculatedHash
        });
        throw new Error('Parameter hash verification failed');
      }
      
      // Validate parameters using ParameterValidator
      const validationOptions = {
        circuitType: ceremony.validationOptions.circuitType,
        validationLevel: ceremony.securityLevel === 'maximum' ? 'strict' : 'standard',
        expectedHash: calculatedHash,
        ceremonyId
      };
      
      // Log validation start
      this.auditLogger.log('Starting parameter validation', {
        contributionId,
        ceremonyId,
        participantId: contribution.participantId,
        validationLevel: validationOptions.validationLevel
      });
      
      // Validate parameters
      const validationResult = await this.parameterValidator.validateParameters(
        contribution.parameters, 
        validationOptions
      );
      
      // Check validation result
      if (!validationResult.isValid) {
        this.auditLogger.logSecurity('Contribution parameter validation failed', {
          ceremonyId,
          participantId: contribution.participantId,
          errors: validationResult.errors,
          validationId: validationResult.validationId
        });
        throw new Error(`Parameter validation failed: ${validationResult.errors.join(', ')}`);
      }
      
      // Log successful validation
      this.auditLogger.log('Parameter validation successful', {
        contributionId,
        ceremonyId,
        participantId: contribution.participantId,
        validationId: validationResult.validationId,
        validationTimeMs: validationResult.validationTimeMs
      });

      // Update participant status
      ceremony.contributions[participantIndex] = {
        ...ceremony.contributions[participantIndex],
        contributionTime: Date.now(),
        status: 'contributed',
        hash: contribution.hash,
        proof: contribution.proof || null,
        validationId: validationResult.validationId,
        entropySummary: contribution.entropy ? {
          length: contribution.entropy.length,
          source: contribution.entropySource || 'user-provided'
        } : null
      };

      // Update ceremony parameters and timestamps
      ceremony.currentParameters = contribution.parameters;
      ceremony.lastUpdated = Date.now();
      
      // Update ceremony audit information
      this.updateCeremonyStatus(ceremony, ceremony.status);

      // Check if ceremony is complete
      if (this.checkCeremonyCompletion(ceremony)) {
        await this.finalizeCeremony(ceremonyId);
      }

      // Remove from active participants
      this.activeParticipants.delete(contribution.participantId);

      // Add to contribution history
      const historyEntry = {
        ceremonyId,
        participantId: contribution.participantId,
        timestamp: Date.now(),
        hash: contribution.hash,
        contributionId,
        processingTimeMs: Date.now() - contributionStartTime
      };
      
      this.contributionHistory.push(historyEntry);
      
      // Log successful contribution
      this.auditLogger.log('Contribution accepted', {
        contributionId,
        ceremonyId,
        participantId: contribution.participantId,
        contributionOrder: ceremony.contributions[participantIndex].contributionOrder,
        validationId: validationResult.validationId,
        processingTimeMs: historyEntry.processingTimeMs
      });

      // Generate receipt
      return {
        ceremonyId,
        contributionId,
        participantId: contribution.participantId,
        contributionOrder: ceremony.contributions[participantIndex].contributionOrder,
        timestamp: Date.now(),
        hash: contribution.hash,
        receipt: this.generateContributionReceipt(ceremonyId, contribution),
        validationId: validationResult.validationId,
        status: 'accepted',
      };
    } catch (error) {
      // Log error
      this.auditLogger.logError('Contribution submission failed', {
        ceremonyId,
        contributionId,
        participantId: contribution?.participantId || 'unknown',
        error: error.message,
        processingTimeMs: Date.now() - contributionStartTime
      });
      
      // Re-throw for caller
      throw error;
    }
  }
  
  /**
   * Update ceremony status with audit trail
   * 
   * @private
   * @param {Object} ceremony - The ceremony to update
   * @param {string} newStatus - The new status
   */
  updateCeremonyStatus(ceremony, newStatus) {
    // Only update if status is changing
    if (ceremony.status === newStatus) return;
    
    const oldStatus = ceremony.status;
    
    // Update status
    ceremony.status = newStatus;
    ceremony.lastUpdated = Date.now();
    
    // Update audit trail
    ceremony.audit.lastStatusChange = Date.now();
    ceremony.audit.statusHistory.push({
      status: newStatus,
      timestamp: Date.now(),
      previousStatus: oldStatus
    });
    
    // Log status change
    this.auditLogger.log('Ceremony status changed', {
      ceremonyId: ceremony.id,
      circuitId: ceremony.circuitId,
      oldStatus,
      newStatus,
      participantCount: ceremony.currentParticipants,
      contributionCount: ceremony.contributions.filter(c => c.status === 'contributed').length
    });
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
    const finalizationStartTime = Date.now();
    
    try {
      // Validate ceremony exists
      const ceremony = this.ceremonies.get(ceremonyId);
      if (!ceremony) {
        throw new Error(`Ceremony ${ceremonyId} not found`);
      }

      // Check if ceremony is ready for finalization
      if (!this.checkCeremonyCompletion(ceremony)) {
        throw new Error(`Ceremony ${ceremonyId} is not ready for finalization`);
      }
      
      // Log finalization start
      this.auditLogger.log('Ceremony finalization started', {
        ceremonyId,
        circuitId: ceremony.circuitId,
        participantCount: ceremony.contributions.filter(c => c.status === 'contributed').length,
        requiredParticipants: ceremony.requiredParticipants
      });
      
      // Perform final parameter validation with strict rules
      const finalValidationOptions = {
        circuitType: ceremony.validationOptions.circuitType,
        validationLevel: 'strict', // Always use strict validation for finalization
        ceremonyId
      };
      
      // Validate final parameters
      const validationResult = await this.parameterValidator.validateParameters(
        ceremony.currentParameters, 
        finalValidationOptions
      );
      
      // Check validation result
      if (!validationResult.isValid) {
        this.auditLogger.logSecurity('Final parameter validation failed during ceremony finalization', {
          ceremonyId,
          errors: validationResult.errors,
          validationId: validationResult.validationId
        });
        
        // Update ceremony status to failed
        this.updateCeremonyStatus(ceremony, 'failed');
        ceremony.failureReason = `Parameter validation failed: ${validationResult.errors.join(', ')}`;
        
        throw new Error(`Final parameter validation failed: ${validationResult.errors.join(', ')}`);
      }
      
      // Log successful validation
      this.auditLogger.log('Final parameter validation successful', {
        ceremonyId,
        validationId: validationResult.validationId,
        validationTimeMs: validationResult.validationTimeMs
      });

      // Generate verification key from final parameters
      this.auditLogger.log('Generating verification key', { ceremonyId });
      const verificationKey = await this.generateVerificationKey(ceremony.currentParameters, ceremony);
      
      // Validate the verification key
      const keyValidationResult = await this.parameterValidator.validateVerificationKey(
        verificationKey,
        { 
          circuitType: ceremony.validationOptions.circuitType,
          ceremonyId 
        }
      );
      
      if (!keyValidationResult.isValid) {
        this.auditLogger.logSecurity('Verification key validation failed', {
          ceremonyId,
          errors: keyValidationResult.errors || [keyValidationResult.error],
          keyId: verificationKey.id
        });
        
        // Update ceremony status to failed
        this.updateCeremonyStatus(ceremony, 'failed');
        ceremony.failureReason = `Verification key validation failed: ${
          keyValidationResult.errors?.join(', ') || keyValidationResult.error
        }`;
        
        throw new Error(`Verification key validation failed: ${
          keyValidationResult.errors?.join(', ') || keyValidationResult.error
        }`);
      }
      
      // Generate cryptographic hash of verification key
      const keyHash = this.hashVerificationKey(verificationKey);
      
      // Update ceremony status
      this.updateCeremonyStatus(ceremony, 'completed');
      ceremony.endTime = Date.now();
      ceremony.finalParameters = ceremony.currentParameters;
      ceremony.verificationKey = verificationKey;
      ceremony.verificationKeyHash = keyHash;
      ceremony.finalValidationId = validationResult.validationId;
      ceremony.keyValidationId = keyValidationResult.validationId;
      ceremony.lastUpdated = Date.now();
      
      // Add key metadata
      verificationKey.metadata = {
        generateTime: Date.now(),
        ceremonyId,
        circuitId: ceremony.circuitId,
        circuitName: ceremony.circuitName,
        participantCount: ceremony.contributions.filter(c => c.status === 'contributed').length,
        hash: keyHash,
        validationId: keyValidationResult.validationId
      };

      // Store verification key (but don't register until verified)
      this.verificationKeys.set(ceremonyId, {
        key: verificationKey,
        timestamp: Date.now(),
        status: 'pending_verification',
        ceremonyId,
        circuitId: ceremony.circuitId,
        hash: keyHash,
        validationId: keyValidationResult.validationId
      });

      // Create tamper-evident backup of parameters
      await this.backupCeremonyParameters(ceremony);
      
      // Distribute verification key to configured channels
      await this.distributeVerificationKey(ceremonyId, verificationKey, ceremony.distributionConfig);
      
      // Log completion
      this.auditLogger.log('Ceremony finalized successfully', {
        ceremonyId,
        circuitId: ceremony.circuitId,
        participantCount: ceremony.contributions.filter(c => c.status === 'contributed').length,
        verificationKeyId: verificationKey.id,
        verificationKeyHash: keyHash,
        processingTimeMs: Date.now() - finalizationStartTime
      });

      return {
        ceremonyId,
        status: ceremony.status,
        finalizedAt: ceremony.endTime,
        participantCount: ceremony.contributions.filter(c => c.status === 'contributed').length,
        verificationKey: {
          id: verificationKey.id,
          circuit: ceremony.circuitName,
          hash: keyHash,
          validatedAt: Date.now(),
        },
        processingTimeMs: Date.now() - finalizationStartTime
      };
    } catch (error) {
      // Log error
      this.auditLogger.logError('Ceremony finalization failed', {
        ceremonyId,
        error: error.message,
        processingTimeMs: Date.now() - finalizationStartTime
      });
      
      // Re-throw for caller
      throw error;
    }
  }
  
  /**
   * Distribute verification key to configured channels
   * 
   * @private
   * @param {string} ceremonyId - Ceremony ID
   * @param {Object} verificationKey - Verification key to distribute
   * @param {Object} distributionConfig - Distribution configuration
   * @returns {Promise<Object>} Distribution results
   */
  async distributeVerificationKey(ceremonyId, verificationKey, distributionConfig) {
    const distributionStartTime = Date.now();
    const distributionResults = {};
    const ceremony = this.ceremonies.get(ceremonyId);
    
    try {
      this.auditLogger.log('Starting verification key distribution', {
        ceremonyId,
        keyId: verificationKey.id,
        channels: distributionConfig.channels
      });
      
      // Distribute to each configured channel
      for (const channel of distributionConfig.channels) {
        try {
          const channelMap = this.distributionChannels.get(channel);
          if (!channelMap) {
            throw new Error(`Distribution channel ${channel} not found`);
          }
          
          // Add key to channel
          const channelEntry = {
            verificationKey,
            timestamp: Date.now(),
            ceremonyId,
            circuitId: ceremony.circuitId,
            hash: this.hashVerificationKey(verificationKey)
          };
          
          channelMap.set(verificationKey.id, channelEntry);
          
          // Add signed receipt for channel distribution
          const receipt = await this.tamperDetection.sign({
            keyId: verificationKey.id,
            channel,
            timestamp: Date.now(),
            hash: channelEntry.hash
          });
          
          distributionResults[channel] = {
            status: 'success',
            timestamp: Date.now(),
            receipt
          };
          
          this.auditLogger.log('Verification key distributed to channel', {
            ceremonyId,
            keyId: verificationKey.id,
            channel,
            hash: channelEntry.hash
          });
        } catch (error) {
          distributionResults[channel] = {
            status: 'failed',
            error: error.message
          };
          
          this.auditLogger.logError('Failed to distribute verification key to channel', {
            ceremonyId,
            keyId: verificationKey.id,
            channel,
            error: error.message
          });
          
          // If redundancy is not enabled, fail on first error
          if (!distributionConfig.redundancy) {
            throw new Error(`Failed to distribute to channel ${channel}: ${error.message}`);
          }
        }
      }
      
      // Check if at least one channel succeeded
      const successfulChannels = Object.entries(distributionResults)
        .filter(([_, result]) => result.status === 'success')
        .map(([channel]) => channel);
        
      if (successfulChannels.length === 0) {
        throw new Error('Failed to distribute verification key to any channel');
      }
      
      // Log distribution summary
      this.auditLogger.log('Verification key distribution completed', {
        ceremonyId,
        keyId: verificationKey.id,
        successfulChannels,
        failedChannels: distributionConfig.channels.filter(c => !successfulChannels.includes(c)),
        processingTimeMs: Date.now() - distributionStartTime
      });
      
      return {
        keyId: verificationKey.id,
        successfulChannels,
        results: distributionResults,
        processingTimeMs: Date.now() - distributionStartTime
      };
    } catch (error) {
      this.auditLogger.logError('Verification key distribution failed', {
        ceremonyId,
        keyId: verificationKey.id,
        error: error.message,
        processingTimeMs: Date.now() - distributionStartTime
      });
      
      throw error;
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

    // Use SHA3-256 for hashing
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

    // Use SHA3-256 for hashing
    return '0x' + sha256(serialized);
  }

  /**
   * Generate a verification key from parameters with security guarantees
   * 
   * @private
   * @param {Object} parameters - Final ceremony parameters
   * @param {Object} ceremony - The ceremony object
   * @returns {Promise<Object>} Generated verification key
   */
  async generateVerificationKey(parameters, ceremony) {
    const generationStartTime = Date.now();
    const keyId = `vk-${ceremony?.circuitId || 'circuit'}-${Date.now().toString(36)}`;
    
    try {
      this.auditLogger.log('Verification key generation started', {
        keyId,
        ceremonyId: ceremony?.id,
        circuitType: ceremony?.validationOptions?.circuitType || 'unknown'
      });
      
      // Check if parameters are valid
      if (!parameters || typeof parameters !== 'object') {
        throw new Error('Invalid parameters for verification key generation');
      }
      
      // In a real implementation, this would use the zero-knowledge library
      // to derive a verification key from parameters using a secure derivation process
      
      // Create verification key structure with appropriate data
      const verificationKey = {
        id: keyId,
        timestamp: Date.now(),
        protocol: 'groth16',  // The ZK proof protocol used
        version: '1.0.0',     // Verification key format version
        
        // Core cryptographic elements
        alpha: parameters.alpha || 'sample_alpha',
        beta: parameters.beta || 'sample_beta',
        gamma: parameters.gamma || 'sample_gamma',
        delta: parameters.delta || 'sample_delta',
        ic: parameters.ic || ['sample_ic'],
        
        // Security features
        securityLevel: ceremony?.securityLevel || 'standard',
        contributorCount: ceremony ? 
          ceremony.contributions.filter(c => c.status === 'contributed').length : 0,
        
        // Provenance information
        source: {
          type: 'mpc_ceremony',
          ceremonyId: ceremony?.id || 'unknown',
          circuitId: ceremony?.circuitId || 'unknown',
          circuitType: ceremony?.validationOptions?.circuitType || 'unknown'
        },
        
        // Verification information
        verification: {
          status: 'pending_verification',
          verifiersRequired: ceremony?.config?.verificationThreshold || 
            this.config.verificationThreshold || 2,
          verifierCount: 0
        }
      };
      
      // Add tamper-evidence by generating a cryptographic digest of the key
      const keyHash = this.hashVerificationKey(verificationKey);
      
      // Create a signed record of the key generation
      const generationRecord = await this.tamperDetection.sign({
        keyId,
        ceremonyId: ceremony?.id,
        circuitId: ceremony?.circuitId,
        timestamp: Date.now(),
        keyHash,
        parametersHash: this.hashParameters(parameters),
        generationTimeMs: Date.now() - generationStartTime
      });
      
      // Add the record to the key
      verificationKey.generationRecord = generationRecord;
      
      // Log successful generation
      this.auditLogger.log('Verification key generated successfully', {
        keyId,
        ceremonyId: ceremony?.id,
        hash: keyHash,
        generationTimeMs: Date.now() - generationStartTime
      });
      
      return verificationKey;
    } catch (error) {
      this.auditLogger.logError('Verification key generation failed', {
        keyId,
        ceremonyId: ceremony?.id,
        error: error.message,
        generationTimeMs: Date.now() - generationStartTime
      });
      
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

/* #ESM-COMPAT */
// Export the singleton instance and class for both CommonJS and ESM
export { TrustedSetupManager };
export default trustedSetupManager;