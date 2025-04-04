/**
 * Multi-Party Computation (MPC) Ceremony Process
 * 
 * Defines the protocol and implementation for secure parameter generation through
 * MPC ceremonies for zero-knowledge proofs.
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This module outlines the step-by-step process for our "trusted setup ceremony" - 
 * a collaborative security procedure where multiple independent parties work together
 * to create the core mathematical parameters for our zero-knowledge proof system.
 * By involving multiple participants, no single entity can compromise the system's
 * security, ensuring that our privacy guarantees remain trustworthy even if some
 * participants attempt to cheat.
 * 
 * Business value: Establishes a transparent, secure, and verifiable foundation for
 * the entire zero-knowledge proof system, creating trust through a documented process
 * rather than requiring trust in any single entity.
 */

import TrustedSetupManager from './TrustedSetupManager.js';
import { stringifyBigInts, parseBigInts } from './zkUtils.js';
import SecureKeyManager from './SecureKeyManager.js';
import TamperDetection from './TamperDetection.js';

/**
 * Ceremony Participant roles and requirements
 */
export const PARTICIPANT_ROLES = {
  COORDINATOR: 'coordinator',    // Organizes the ceremony but doesn't generate toxic waste
  CONTRIBUTOR: 'contributor',    // Provides entropy and participates in the MPC
  VERIFIER: 'verifier',          // Independently verifies the ceremony outputs
  AUDITOR: 'auditor',            // Reviews the process for compliance with the protocol
};

/**
 * Ceremony phases with required actions and deliverables
 */
export const CEREMONY_PHASES = {
  PREPARATION: 'preparation',      // Setting up the ceremony infrastructure
  ANNOUNCEMENT: 'announcement',    // Public announcement and participant recruitment
  REGISTRATION: 'registration',    // Participant identity verification and registration
  CONTRIBUTION: 'contribution',    // Actual parameter generation with participant contributions
  VERIFICATION: 'verification',    // Independent verification of ceremony outputs
  PUBLICATION: 'publication',      // Public release of verification keys and parameters
  AUDIT: 'audit',                  // Post-ceremony security audit and transparency report
};

/**
 * Security levels for MPC ceremonies
 */
export const SECURITY_LEVELS = {
  STANDARD: {
    name: 'standard',
    minParticipants: 3,
    recommendedParticipants: 5,
    contributionHashAlgorithm: 'sha256',
    entropyMinBits: 128,
    identityVerificationRequirement: 'email',
  },
  ENHANCED: {
    name: 'enhanced',
    minParticipants: 5,
    recommendedParticipants: 10,
    contributionHashAlgorithm: 'sha3-256',
    entropyMinBits: 192,
    identityVerificationRequirement: 'email+social',
  },
  MAXIMUM: {
    name: 'maximum',
    minParticipants: 10,
    recommendedParticipants: 20,
    contributionHashAlgorithm: 'sha3-512',
    entropyMinBits: 256,
    identityVerificationRequirement: 'kyc',
  },
};

/**
 * MPC Ceremony Process Manager
 * Handles the complete ceremony lifecycle from preparation to audit
 */
class MpcCeremonyProcess {
  constructor() {
    this.trustedSetupManager = TrustedSetupManager;
    this.secureKeyManager = new SecureKeyManager();
    this.tamperDetection = new TamperDetection();
    
    // Process tracking
    this.activeProcesses = new Map();
    this.ceremoniesInProgress = new Map();
    this.publishedParameters = new Map();
    
    // Audit trail
    this.ceremonyLogs = new Map();
  }
  
  /**
   * Initialize a new MPC ceremony process
   * 
   * @param {Object} params - Ceremony parameters
   * @param {string} params.circuitId - Target circuit identifier
   * @param {string} params.circuitName - Human-readable circuit name
   * @param {string} params.securityLevel - Security level from SECURITY_LEVELS
   * @param {Object} params.metadata - Additional ceremony metadata
   * @returns {Object} Process initialization information
   * 
   * ---------- BUSINESS CONTEXT ----------
   * This initiates the trusted setup ceremony by establishing the requirements,
   * security parameters, and infrastructure. It defines how many participants
   * will be needed, the security thresholds, and creates the foundation for
   * a verifiable random parameter generation process. This is the first step
   * in creating parameters that demonstrably couldn't have been manipulated.
   */
  initializeCeremony(params) {
    const { circuitId, circuitName, securityLevel = 'standard', metadata = {} } = params;
    
    if (!circuitId || !circuitName) {
      throw new Error('Circuit ID and name are required');
    }
    
    // Validate security level
    const securityConfig = SECURITY_LEVELS[securityLevel.toUpperCase()];
    if (!securityConfig) {
      throw new Error(`Invalid security level: ${securityLevel}`);
    }
    
    // Generate a unique process ID
    const processId = this.generateProcessId(circuitId);
    
    // Initialize the ceremony in the TrustedSetupManager
    const ceremonyId = this.trustedSetupManager.initializeCeremony({
      circuitId,
      circuitName,
      securityLevel: securityConfig.name,
    });
    
    // Create process tracking record
    const process = {
      id: processId,
      ceremonyId,
      circuitId,
      circuitName,
      securityLevel: securityConfig.name,
      currentPhase: CEREMONY_PHASES.PREPARATION,
      startTime: Date.now(),
      completionTime: null,
      coordinators: [],
      participants: {
        registered: 0,
        contributed: 0,
        verified: 0,
      },
      requiredParticipants: securityConfig.minParticipants,
      recommendedParticipants: securityConfig.recommendedParticipants,
      entropyRequirements: {
        minBits: securityConfig.entropyMinBits,
        sources: ['user-provided', 'system-random'],
      },
      identityRequirement: securityConfig.identityVerificationRequirement,
      metadata: {
        ...metadata,
        createdAt: new Date().toISOString(),
      },
      status: 'initialized',
      phaseHistory: [
        {
          phase: CEREMONY_PHASES.PREPARATION,
          startTime: Date.now(),
          completionTime: null,
        },
      ],
    };
    
    // Store the process
    this.activeProcesses.set(processId, process);
    this.ceremoniesInProgress.set(ceremonyId, processId);
    
    // Initialize ceremony log
    this.ceremonyLogs.set(processId, [
      {
        timestamp: Date.now(),
        event: 'ceremony_initialized',
        data: {
          processId,
          ceremonyId,
          circuitId,
          circuitName,
          securityLevel: securityConfig.name,
        },
      },
    ]);
    
    // Log initialization
    this.logCeremonyEvent(processId, 'preparation_phase_started', {
      requiredParticipants: securityConfig.minParticipants,
      recommendedParticipants: securityConfig.recommendedParticipants,
    });
    
    return {
      processId,
      ceremonyId,
      circuitId,
      circuitName,
      securityLevel: securityConfig.name,
      currentPhase: CEREMONY_PHASES.PREPARATION,
      requiredParticipants: securityConfig.minParticipants,
      recommendedParticipants: securityConfig.recommendedParticipants,
    };
  }
  
  /**
   * Add a coordinator to the ceremony
   * 
   * @param {string} processId - Ceremony process ID
   * @param {Object} coordinator - Coordinator information
   * @param {string} coordinator.id - Unique identifier
   * @param {string} coordinator.name - Coordinator display name
   * @param {string} coordinator.publicKey - Coordinator public key
   * @param {Array<string>} coordinator.roles - Coordinator roles
   * @returns {Object} Updated coordinator information
   * 
   * ---------- BUSINESS CONTEXT ----------
   * Coordinators are responsible for organizing the ceremony but do not
   * contribute to the actual parameter generation (to avoid potentially
   * compromising the setup). This separates the administrative role from
   * the cryptographic contribution process, ensuring proper separation
   * of duties and reducing trust requirements in any single entity.
   */
  addCoordinator(processId, coordinator) {
    // Validate process exists
    const process = this.activeProcesses.get(processId);
    if (!process) {
      throw new Error(`Ceremony process ${processId} not found`);
    }
    
    // Validate coordinator
    if (!coordinator.id || !coordinator.publicKey) {
      throw new Error('Coordinator ID and public key are required');
    }
    
    // Check for duplicate coordinator
    const existingCoordinator = process.coordinators.find(c => c.id === coordinator.id);
    if (existingCoordinator) {
      throw new Error(`Coordinator ${coordinator.id} is already registered for this ceremony`);
    }
    
    // Add coordinator
    const coordinatorEntry = {
      id: coordinator.id,
      name: coordinator.name || `Coordinator ${coordinator.id.substring(0, 8)}`,
      publicKey: coordinator.publicKey,
      roles: coordinator.roles || [PARTICIPANT_ROLES.COORDINATOR],
      addedAt: Date.now(),
      status: 'active',
    };
    
    process.coordinators.push(coordinatorEntry);
    
    // Log coordinator addition
    this.logCeremonyEvent(processId, 'coordinator_added', {
      coordinatorId: coordinator.id,
      coordinatorName: coordinatorEntry.name,
      roles: coordinatorEntry.roles,
    });
    
    return coordinatorEntry;
  }
  
  /**
   * Start the public announcement phase
   * 
   * @param {string} processId - Ceremony process ID
   * @param {Object} announcementParams - Announcement parameters
   * @param {string} announcementParams.registrationStartTime - Registration start time
   * @param {string} announcementParams.registrationEndTime - Registration end time
   * @param {string} announcementParams.announcementUrl - Public announcement URL
   * @returns {Object} Announcement details
   * 
   * ---------- BUSINESS CONTEXT ----------
   * The announcement phase makes the upcoming ceremony public, establishes
   * the timeline, and provides instructions for participant registration.
   * A public announcement increases transparency and allows a diverse set
   * of participants to join, further enhancing the trustworthiness of the
   * resulting parameters by preventing collusion among participants.
   */
  startAnnouncementPhase(processId, announcementParams) {
    // Validate process exists and is in the right phase
    const process = this.activeProcesses.get(processId);
    if (!process) {
      throw new Error(`Ceremony process ${processId} not found`);
    }
    
    if (process.currentPhase !== CEREMONY_PHASES.PREPARATION) {
      throw new Error(`Ceremony is not in the preparation phase (current: ${process.currentPhase})`);
    }
    
    // Validate announcement params
    if (!announcementParams.registrationStartTime || !announcementParams.registrationEndTime) {
      throw new Error('Registration start and end times are required');
    }
    
    // Complete preparation phase
    this.completePhase(processId, CEREMONY_PHASES.PREPARATION);
    
    // Start announcement phase
    this.startPhase(processId, CEREMONY_PHASES.ANNOUNCEMENT, {
      announcementTime: Date.now(),
      registrationStartTime: new Date(announcementParams.registrationStartTime).getTime(),
      registrationEndTime: new Date(announcementParams.registrationEndTime).getTime(),
      announcementUrl: announcementParams.announcementUrl || null,
      announcementText: announcementParams.announcementText || null,
    });
    
    // Update process status
    process.status = 'announced';
    
    // Log announcement
    this.logCeremonyEvent(processId, 'announcement_published', {
      registrationStartTime: announcementParams.registrationStartTime,
      registrationEndTime: announcementParams.registrationEndTime,
      announcementUrl: announcementParams.announcementUrl,
    });
    
    return {
      processId,
      status: process.status,
      currentPhase: process.currentPhase,
      registrationStartTime: announcementParams.registrationStartTime,
      registrationEndTime: announcementParams.registrationEndTime,
      announcementUrl: announcementParams.announcementUrl,
    };
  }
  
  /**
   * Start the participant registration phase
   * 
   * @param {string} processId - Ceremony process ID
   * @returns {Object} Registration phase details
   * 
   * ---------- BUSINESS CONTEXT ----------
   * The registration phase allows participants to sign up for the ceremony
   * and have their identities verified according to the ceremony's security
   * requirements. This step ensures that we have genuine, independent participants
   * who can later be verified to have participated, while still maintaining
   * the security of the overall parameter generation process.
   */
  startRegistrationPhase(processId) {
    // Validate process exists and is in the right phase
    const process = this.activeProcesses.get(processId);
    if (!process) {
      throw new Error(`Ceremony process ${processId} not found`);
    }
    
    if (process.currentPhase !== CEREMONY_PHASES.ANNOUNCEMENT) {
      throw new Error(`Ceremony is not in the announcement phase (current: ${process.currentPhase})`);
    }
    
    // Check if we've reached the registration start time
    const currentTime = Date.now();
    const lastPhase = process.phaseHistory.find(p => p.phase === CEREMONY_PHASES.ANNOUNCEMENT);
    
    if (currentTime < lastPhase.metadata.registrationStartTime) {
      throw new Error(`Registration phase cannot start before scheduled time (${new Date(lastPhase.metadata.registrationStartTime).toISOString()})`);
    }
    
    // Complete announcement phase
    this.completePhase(processId, CEREMONY_PHASES.ANNOUNCEMENT);
    
    // Start registration phase
    this.startPhase(processId, CEREMONY_PHASES.REGISTRATION, {
      startTime: currentTime,
      scheduledEndTime: lastPhase.metadata.registrationEndTime,
      participantRequirements: {
        identityVerification: process.identityRequirement,
        entropyMinBits: process.entropyRequirements.minBits,
      },
    });
    
    // Update process status
    process.status = 'registration_open';
    
    // Log registration phase start
    this.logCeremonyEvent(processId, 'registration_phase_started', {
      startTime: new Date(currentTime).toISOString(),
      scheduledEndTime: new Date(lastPhase.metadata.registrationEndTime).toISOString(),
      identityRequirement: process.identityRequirement,
    });
    
    return {
      processId,
      status: process.status,
      currentPhase: process.currentPhase,
      registrationEndTime: new Date(lastPhase.metadata.registrationEndTime).toISOString(),
      requiredParticipants: process.requiredParticipants,
      recommendedParticipants: process.recommendedParticipants,
      identityRequirement: process.identityRequirement,
    };
  }
  
  /**
   * Register a participant for the ceremony
   * 
   * @param {string} processId - Ceremony process ID
   * @param {Object} participant - Participant information
   * @param {string} participant.id - Unique identifier
   * @param {string} participant.name - Display name (optional)
   * @param {string} participant.publicKey - Public key for encryption
   * @param {string} participant.email - Email address for communication
   * @param {string} participant.role - Participant role (contributor, verifier, etc.)
   * @returns {Object} Registration confirmation
   * 
   * ---------- BUSINESS CONTEXT ----------
   * This function registers an individual participant for the ceremony,
   * storing their public key and identity information. Participants will
   * later use their corresponding private keys to sign their contributions,
   * creating a verifiable chain of participants. This registration enables
   * secure communication with participants while maintaining the integrity
   * of the ceremony process.
   */
  registerParticipant(processId, participant) {
    // Validate process exists and is in the right phase
    const process = this.activeProcesses.get(processId);
    if (!process) {
      throw new Error(`Ceremony process ${processId} not found`);
    }
    
    if (process.currentPhase !== CEREMONY_PHASES.REGISTRATION) {
      throw new Error(`Ceremony is not in the registration phase (current: ${process.currentPhase})`);
    }
    
    // Validate participant
    if (!participant.id || !participant.publicKey || !participant.email) {
      throw new Error('Participant ID, public key, and email are required');
    }
    
    // Validate role
    const role = participant.role || PARTICIPANT_ROLES.CONTRIBUTOR;
    if (!Object.values(PARTICIPANT_ROLES).includes(role)) {
      throw new Error(`Invalid participant role: ${role}`);
    }
    
    // Register with the TrustedSetupManager
    const ceremonyId = process.ceremonyId;
    const registration = this.trustedSetupManager.registerParticipant(ceremonyId, {
      id: participant.id,
      name: participant.name,
      publicKey: participant.publicKey,
    });
    
    // Update participant count
    process.participants.registered++;
    
    // Log registration
    this.logCeremonyEvent(processId, 'participant_registered', {
      participantId: participant.id,
      participantName: participant.name || `Participant ${participant.id.substring(0, 8)}`,
      role: role,
      registrationOrder: registration.contributionOrder,
    });
    
    return {
      processId,
      ceremonyId,
      participantId: participant.id,
      registrationOrder: registration.contributionOrder,
      registrationTime: new Date(registration.registrationTime).toISOString(),
      contributionDeadline: new Date(registration.timeoutAt).toISOString(),
      status: 'registered',
    };
  }
  
  /**
   * Start the contribution phase
   * 
   * @param {string} processId - Ceremony process ID
   * @returns {Object} Contribution phase details
   * 
   * ---------- BUSINESS CONTEXT ----------
   * The contribution phase is the core of the trusted setup process, where
   * each participant adds their own randomness to the parameters. Each
   * contribution builds on the previous ones, creating a chain where even
   * a single honest participant ensures the security of the entire system.
   * This phase implements the actual cryptographic protocol that makes the
   * zero-knowledge proofs trustworthy.
   */
  startContributionPhase(processId) {
    // Validate process exists and is in the right phase
    const process = this.activeProcesses.get(processId);
    if (!process) {
      throw new Error(`Ceremony process ${processId} not found`);
    }
    
    if (process.currentPhase !== CEREMONY_PHASES.REGISTRATION) {
      throw new Error(`Ceremony is not in the registration phase (current: ${process.currentPhase})`);
    }
    
    // Check if we have enough registered participants
    if (process.participants.registered < process.requiredParticipants) {
      throw new Error(`Not enough participants registered (${process.participants.registered}/${process.requiredParticipants})`);
    }
    
    // Complete registration phase
    this.completePhase(processId, CEREMONY_PHASES.REGISTRATION);
    
    // Start contribution phase
    this.startPhase(processId, CEREMONY_PHASES.CONTRIBUTION, {
      startTime: Date.now(),
      registeredParticipants: process.participants.registered,
      contributionOrder: this.trustedSetupManager.getCeremonyStatus(process.ceremonyId).contributions.map(c => ({
        participantId: c.participantId,
        order: c.contributionOrder,
      })),
    });
    
    // Update process status
    process.status = 'contribution_in_progress';
    
    // Log contribution phase start
    this.logCeremonyEvent(processId, 'contribution_phase_started', {
      startTime: new Date().toISOString(),
      registeredParticipants: process.participants.registered,
    });
    
    return {
      processId,
      status: process.status,
      currentPhase: process.currentPhase,
      registeredParticipants: process.participants.registered,
      requiredParticipants: process.requiredParticipants,
      contributionStartTime: new Date().toISOString(),
    };
  }
  
  /**
   * Submit a participant contribution
   * 
   * @param {string} processId - Ceremony process ID
   * @param {Object} contribution - Contribution data
   * @param {string} contribution.participantId - Participant ID
   * @param {Object} contribution.entropy - Entropy sources
   * @param {Object} contribution.parameters - Contribution parameters
   * @param {string} contribution.signedHash - Signed hash of the contribution
   * @returns {Object} Contribution receipt
   * 
   * ---------- BUSINESS CONTEXT ----------
   * This function allows each participant to submit their cryptographic
   * contribution to the ceremony. The participant adds their own randomness
   * to the parameters, signs the result, and receives a receipt. This creates
   * a secure, verifiable chain of contributions where each participant builds
   * on the previous ones, ensuring that the final parameters remain secure as
   * long as at least one participant is honest.
   */
  async submitContribution(processId, contribution) {
    // Validate process exists and is in the right phase
    const process = this.activeProcesses.get(processId);
    if (!process) {
      throw new Error(`Ceremony process ${processId} not found`);
    }
    
    if (process.currentPhase !== CEREMONY_PHASES.CONTRIBUTION) {
      throw new Error(`Ceremony is not in the contribution phase (current: ${process.currentPhase})`);
    }
    
    // Validate contribution
    if (!contribution.participantId || !contribution.entropy || !contribution.parameters) {
      throw new Error('Participant ID, entropy, and parameters are required');
    }
    
    // Validate entropy quality
    this.validateEntropyQuality(contribution.entropy, process.entropyRequirements);
    
    // Calculate hash of parameters
    const parameterHash = this.trustedSetupManager.hashParameters(contribution.parameters);
    
    // Verify signature if provided
    if (contribution.signedHash) {
      // In a real implementation, we would verify the signature against the participant's public key
      console.log(`Signature verification would happen here for participant ${contribution.participantId}`);
    }
    
    // Submit to the TrustedSetupManager
    const ceremonyId = process.ceremonyId;
    const submissionResult = await this.trustedSetupManager.submitContribution(ceremonyId, {
      participantId: contribution.participantId,
      parameters: contribution.parameters,
      hash: parameterHash,
      proof: contribution.signedHash ? { signature: contribution.signedHash } : undefined,
    });
    
    // Update contributed count
    process.participants.contributed++;
    
    // Log contribution
    this.logCeremonyEvent(processId, 'contribution_submitted', {
      participantId: contribution.participantId,
      contributionOrder: submissionResult.contributionOrder,
      parameterHash,
      timestamp: new Date(submissionResult.timestamp).toISOString(),
    });
    
    // Check if all contributions are complete
    if (process.participants.contributed >= process.requiredParticipants) {
      // Mark ceremony as ready for verification
      this.checkContributionCompletion(processId);
    }
    
    return {
      processId,
      ceremonyId,
      participantId: contribution.participantId,
      contributionOrder: submissionResult.contributionOrder,
      timestamp: new Date(submissionResult.timestamp).toISOString(),
      hash: parameterHash,
      receipt: submissionResult.receipt,
      status: submissionResult.status,
    };
  }
  
  /**
   * Check if the contribution phase is complete
   * 
   * @param {string} processId - Ceremony process ID
   * @returns {boolean} Whether the contribution phase is complete
   * 
   * ---------- BUSINESS CONTEXT ----------
   * This function checks if enough valid contributions have been submitted
   * to consider the contribution phase complete. Once the required number
   * of participants have contributed, the process can move to verification.
   * This ensures that the ceremony meets its security requirements before
   * proceeding to generate the final parameters.
   */
  checkContributionCompletion(processId) {
    // Validate process exists
    const process = this.activeProcesses.get(processId);
    if (!process) {
      throw new Error(`Ceremony process ${processId} not found`);
    }
    
    if (process.currentPhase !== CEREMONY_PHASES.CONTRIBUTION) {
      return false; // Not in contribution phase
    }
    
    // Check contributed count against required
    if (process.participants.contributed < process.requiredParticipants) {
      return false; // Not enough contributions yet
    }
    
    // Verify with TrustedSetupManager
    const ceremonyId = process.ceremonyId;
    const ceremonyStatus = this.trustedSetupManager.getCeremonyStatus(ceremonyId);
    
    // Check if all required contributions are submitted
    const validContributions = ceremonyStatus.contributionCount;
    
    if (validContributions >= process.requiredParticipants) {
      // Complete contribution phase
      this.completePhase(processId, CEREMONY_PHASES.CONTRIBUTION);
      
      // Start verification phase
      this.startPhase(processId, CEREMONY_PHASES.VERIFICATION, {
        startTime: Date.now(),
        contributionCount: validContributions,
        requiredVerifications: this.trustedSetupManager.config.verificationThreshold,
      });
      
      // Update process status
      process.status = 'verification_in_progress';
      
      // Log verification phase start
      this.logCeremonyEvent(processId, 'verification_phase_started', {
        contributionCount: validContributions,
        startTime: new Date().toISOString(),
      });
      
      // Finalize the ceremony in TrustedSetupManager
      try {
        this.trustedSetupManager.finalizeCeremony(ceremonyId);
      } catch (error) {
        console.error(`Error finalizing ceremony ${ceremonyId}:`, error);
        this.logCeremonyEvent(processId, 'ceremony_finalization_error', {
          error: error.message,
        });
        return false;
      }
      
      return true;
    }
    
    return false;
  }
  
  /**
   * Submit a verification of the ceremony
   * 
   * @param {string} processId - Ceremony process ID
   * @param {Object} verification - Verification information
   * @param {string} verification.verifierId - Verifier ID
   * @param {boolean} verification.result - Verification result
   * @param {Object} verification.metadata - Verification details
   * @returns {Object} Verification status
   * 
   * ---------- BUSINESS CONTEXT ----------
   * Independent verifiers check that the contribution process was performed
   * correctly by validating the cryptographic chain of contributions. This
   * adds another layer of trust and transparency to the ceremony, ensuring
   * that the parameters were generated according to the protocol. Multiple
   * independent verifications increase confidence in the ceremony's integrity.
   */
  async submitVerification(processId, verification) {
    // Validate process exists and is in the right phase
    const process = this.activeProcesses.get(processId);
    if (!process) {
      throw new Error(`Ceremony process ${processId} not found`);
    }
    
    if (process.currentPhase !== CEREMONY_PHASES.VERIFICATION) {
      throw new Error(`Ceremony is not in the verification phase (current: ${process.currentPhase})`);
    }
    
    // Validate verification
    if (!verification.verifierId || verification.result === undefined) {
      throw new Error('Verifier ID and result are required');
    }
    
    // Submit to the TrustedSetupManager
    const ceremonyId = process.ceremonyId;
    const verificationResult = await this.trustedSetupManager.verifyCeremony(ceremonyId, {
      verifierId: verification.verifierId,
      result: verification.result,
      metadata: verification.metadata || {},
    });
    
    // Update verified count
    if (verification.result === true) {
      process.participants.verified++;
    }
    
    // Log verification
    this.logCeremonyEvent(processId, 'verification_submitted', {
      verifierId: verification.verifierId,
      result: verification.result,
      timestamp: new Date().toISOString(),
    });
    
    // Check if verification phase is complete
    if (verificationResult.ceremonyStatus === 'verified') {
      // Move to publication phase
      this.completePhase(processId, CEREMONY_PHASES.VERIFICATION);
      
      // Start publication phase
      this.startPhase(processId, CEREMONY_PHASES.PUBLICATION, {
        startTime: Date.now(),
        successfulVerifications: verificationResult.successfulVerifications,
      });
      
      // Update process status
      process.status = 'verified';
      
      // Log publication phase start
      this.logCeremonyEvent(processId, 'publication_phase_started', {
        successfulVerifications: verificationResult.successfulVerifications,
        startTime: new Date().toISOString(),
      });
    }
    
    return {
      processId,
      ceremonyId,
      verifierId: verification.verifierId,
      timestamp: new Date(verificationResult.timestamp).toISOString(),
      result: verification.result,
      ceremonyStatus: verificationResult.ceremonyStatus,
      successfulVerifications: verificationResult.successfulVerifications,
      requiredVerifications: verificationResult.requiredVerifications,
    };
  }
  
  /**
   * Publish ceremony results
   * 
   * @param {string} processId - Ceremony process ID
   * @param {Object} publicationDetails - Publication information
   * @param {Array<string>} publicationDetails.publicationUrls - URLs where results are published
   * @param {string} publicationDetails.verificationKeyId - ID of the verification key
   * @returns {Object} Publication confirmation
   * 
   * ---------- BUSINESS CONTEXT ----------
   * Once the ceremony is complete and verified, this function publishes the
   * results - most importantly the verification key that will be used to verify
   * zero-knowledge proofs. By publishing these parameters through multiple
   * channels, we ensure transparency and wide availability. Applications can
   * then use these published parameters to create and verify zero-knowledge proofs.
   */
  publishCeremonyResults(processId, publicationDetails) {
    // Validate process exists and is in the right phase
    const process = this.activeProcesses.get(processId);
    if (!process) {
      throw new Error(`Ceremony process ${processId} not found`);
    }
    
    if (process.currentPhase !== CEREMONY_PHASES.PUBLICATION) {
      throw new Error(`Ceremony is not in the publication phase (current: ${process.currentPhase})`);
    }
    
    // Validate publication details
    if (!publicationDetails.publicationUrls || !publicationDetails.verificationKeyId) {
      throw new Error('Publication URLs and verification key ID are required');
    }
    
    // Get verification key from TrustedSetupManager
    const verificationKey = this.trustedSetupManager.getVerificationKey(publicationDetails.verificationKeyId);
    
    // Register published parameters
    this.publishedParameters.set(process.circuitId, {
      verificationKeyId: publicationDetails.verificationKeyId,
      verificationKeyHash: verificationKey.hash,
      ceremonyId: process.ceremonyId,
      processId: processId,
      publicationTimestamp: Date.now(),
      publicationUrls: publicationDetails.publicationUrls,
      metadataHash: this.generatePublicationMetadataHash(process, verificationKey),
    });
    
    // Complete publication phase
    this.completePhase(processId, CEREMONY_PHASES.PUBLICATION);
    
    // Start audit phase
    this.startPhase(processId, CEREMONY_PHASES.AUDIT, {
      startTime: Date.now(),
      publicationUrls: publicationDetails.publicationUrls,
      verificationKeyId: publicationDetails.verificationKeyId,
      verificationKeyHash: verificationKey.hash,
    });
    
    // Update process status
    process.status = 'published';
    process.completionTime = Date.now();
    
    // Log publication
    this.logCeremonyEvent(processId, 'ceremony_results_published', {
      verificationKeyId: publicationDetails.verificationKeyId,
      verificationKeyHash: verificationKey.hash,
      publicationUrls: publicationDetails.publicationUrls,
      timestamp: new Date().toISOString(),
    });
    
    return {
      processId,
      ceremonyId: process.ceremonyId,
      circuitId: process.circuitId,
      status: 'published',
      verificationKeyId: publicationDetails.verificationKeyId,
      verificationKeyHash: verificationKey.hash,
      publicationTimestamp: new Date().toISOString(),
      publicationUrls: publicationDetails.publicationUrls,
      metadataHash: this.publishedParameters.get(process.circuitId).metadataHash,
    };
  }
  
  /**
   * Complete the ceremony with final audit
   * 
   * @param {string} processId - Ceremony process ID
   * @param {Object} auditReport - Audit information
   * @param {string} auditReport.auditorId - ID of the auditor
   * @param {Object} auditReport.findings - Audit findings
   * @param {boolean} auditReport.approved - Whether the audit approves the ceremony
   * @returns {Object} Final ceremony status
   * 
   * ---------- BUSINESS CONTEXT ----------
   * The final step in the ceremony is an independent audit that reviews the
   * entire process for compliance with the protocol. This audit ensures that
   * all steps were followed correctly, all security measures were implemented,
   * and that the ceremony's results can be trusted. The audit report becomes
   * part of the permanent record of the ceremony, providing accountability.
   */
  completeCeremonyAudit(processId, auditReport) {
    // Validate process exists and is in the right phase
    const process = this.activeProcesses.get(processId);
    if (!process) {
      throw new Error(`Ceremony process ${processId} not found`);
    }
    
    if (process.currentPhase !== CEREMONY_PHASES.AUDIT) {
      throw new Error(`Ceremony is not in the audit phase (current: ${process.currentPhase})`);
    }
    
    // Validate audit report
    if (!auditReport.auditorId || auditReport.approved === undefined) {
      throw new Error('Auditor ID and approval status are required');
    }
    
    // Complete audit phase
    this.completePhase(processId, CEREMONY_PHASES.AUDIT, {
      auditReport: {
        auditorId: auditReport.auditorId,
        findings: auditReport.findings || {},
        approved: auditReport.approved,
        completionTime: Date.now(),
      },
    });
    
    // Update process status
    process.status = auditReport.approved ? 'completed' : 'audit_failed';
    
    // Log audit completion
    this.logCeremonyEvent(processId, 'ceremony_audit_completed', {
      auditorId: auditReport.auditorId,
      approved: auditReport.approved,
      findingCount: Object.keys(auditReport.findings || {}).length,
      completionTime: new Date().toISOString(),
    });
    
    // Generate final ceremony record
    const finalRecord = this.generateFinalCeremonyRecord(processId);
    
    // If approved, update the published parameters with audit information
    if (auditReport.approved && this.publishedParameters.has(process.circuitId)) {
      const params = this.publishedParameters.get(process.circuitId);
      this.publishedParameters.set(process.circuitId, {
        ...params,
        auditApproved: true,
        auditCompletionTime: Date.now(),
        auditorId: auditReport.auditorId,
      });
    }
    
    return {
      processId,
      ceremonyId: process.ceremonyId,
      circuitId: process.circuitId,
      status: process.status,
      startTime: new Date(process.startTime).toISOString(),
      completionTime: new Date(process.completionTime).toISOString(),
      participantCounts: process.participants,
      auditApproved: auditReport.approved,
      finalRecordHash: this.hashFinalRecord(finalRecord),
    };
  }
  
  /**
   * Retrieve active parameters for a circuit
   * 
   * @param {string} circuitId - Circuit identifier
   * @returns {Object} Active parameters information
   * 
   * ---------- BUSINESS CONTEXT ----------
   * Applications need access to the verification parameters produced by the
   * ceremony to verify zero-knowledge proofs. This function provides the
   * official parameters for a given circuit, including metadata about their
   * provenance and security. This is the primary interface for applications
   * to access the trusted parameters they need for cryptographic operations.
   */
  getActiveParameters(circuitId) {
    // Check if parameters exist for this circuit
    if (!this.publishedParameters.has(circuitId)) {
      throw new Error(`No published parameters found for circuit ${circuitId}`);
    }
    
    const params = this.publishedParameters.get(circuitId);
    
    // Get verification key
    const verificationKey = this.trustedSetupManager.getVerificationKey(params.verificationKeyId);
    
    return {
      circuitId,
      verificationKeyId: params.verificationKeyId,
      verificationKeyHash: params.verificationKeyHash,
      ceremonyId: params.ceremonyId,
      publicationTimestamp: new Date(params.publicationTimestamp).toISOString(),
      publicationUrls: params.publicationUrls,
      metadataHash: params.metadataHash,
      auditApproved: params.auditApproved || false,
      verificationKey: verificationKey.key,
    };
  }
  
  /**
   * List all published parameters across circuits
   * 
   * @returns {Array<Object>} List of published parameters
   * 
   * ---------- BUSINESS CONTEXT ----------
   * This provides a comprehensive view of all circuits that have completed
   * their trusted setup ceremonies and have published parameters. This registry
   * acts as the source of truth for which parameters should be used with which
   * circuits, enabling applications to correctly configure their zero-knowledge
   * proof systems with the appropriate trusted setup parameters.
   */
  listPublishedParameters() {
    return Array.from(this.publishedParameters.entries()).map(([circuitId, params]) => ({
      circuitId,
      verificationKeyId: params.verificationKeyId,
      verificationKeyHash: params.verificationKeyHash,
      ceremonyId: params.ceremonyId,
      publicationTimestamp: new Date(params.publicationTimestamp).toISOString(),
      publicationUrls: params.publicationUrls,
      metadataHash: params.metadataHash,
      auditApproved: params.auditApproved || false,
    }));
  }
  
  /**
   * Retrieve ceremony logs for transparency
   * 
   * @param {string} processId - Ceremony process ID
   * @returns {Array<Object>} Ceremony event logs
   * 
   * ---------- BUSINESS CONTEXT ----------
   * Transparency is essential for trust in the ceremony process. This function
   * provides access to the complete audit trail of events during the ceremony,
   * allowing anyone to verify that the process was followed correctly. This
   * level of transparency is crucial for establishing trust in the resulting
   * parameters and the zero-knowledge proofs that use them.
   */
  getCeremonyLogs(processId) {
    // Validate process exists
    if (!this.ceremonyLogs.has(processId)) {
      throw new Error(`No logs found for ceremony process ${processId}`);
    }
    
    // Return logs with timestamps converted to ISO format
    return this.ceremonyLogs.get(processId).map(log => ({
      ...log,
      timestamp: new Date(log.timestamp).toISOString(),
    }));
  }
  
  /**
   * Generate a unique process ID
   * 
   * @private
   * @param {string} circuitId - Circuit identifier
   * @returns {string} Unique process ID
   */
  generateProcessId(circuitId) {
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
    
    return `mpc-${circuitId}-${timestamp}-${randomPart}`;
  }
  
  /**
   * Validate the quality of entropy provided by a participant
   * 
   * @private
   * @param {Object} entropy - Entropy sources
   * @param {Object} requirements - Entropy requirements
   */
  validateEntropyQuality(entropy, requirements) {
    // Check entropy sources
    if (!entropy.userProvided) {
      throw new Error('User-provided entropy is required');
    }
    
    // In a real implementation, this would perform entropy quality analysis
    // For now, just check if it meets minimum length
    const estimatedEntropyBits = entropy.userProvided.length * 8; // Rough estimate
    
    if (estimatedEntropyBits < requirements.minBits) {
      throw new Error(`Insufficient entropy: ${estimatedEntropyBits} bits provided, ${requirements.minBits} required`);
    }
    
    return true;
  }
  
  /**
   * Start a new phase in the ceremony process
   * 
   * @private
   * @param {string} processId - Ceremony process ID
   * @param {string} phase - Phase from CEREMONY_PHASES
   * @param {Object} metadata - Phase-specific metadata
   */
  startPhase(processId, phase, metadata = {}) {
    const process = this.activeProcesses.get(processId);
    if (!process) return;
    
    // Update process phase
    process.currentPhase = phase;
    
    // Add to phase history
    process.phaseHistory.push({
      phase,
      startTime: Date.now(),
      completionTime: null,
      metadata,
    });
  }
  
  /**
   * Complete a phase in the ceremony process
   * 
   * @private
   * @param {string} processId - Ceremony process ID
   * @param {string} phase - Phase to complete
   * @param {Object} metadata - Completion metadata
   */
  completePhase(processId, phase, metadata = {}) {
    const process = this.activeProcesses.get(processId);
    if (!process) return;
    
    // Find the phase in history
    const phaseIndex = process.phaseHistory.findIndex(p => 
      p.phase === phase && p.completionTime === null
    );
    
    if (phaseIndex >= 0) {
      // Mark as complete
      process.phaseHistory[phaseIndex].completionTime = Date.now();
      if (metadata) {
        process.phaseHistory[phaseIndex].metadata = {
          ...process.phaseHistory[phaseIndex].metadata,
          ...metadata,
        };
      }
    }
  }
  
  /**
   * Log an event in the ceremony audit trail
   * 
   * @private
   * @param {string} processId - Ceremony process ID
   * @param {string} event - Event type
   * @param {Object} data - Event data
   */
  logCeremonyEvent(processId, event, data = {}) {
    if (!this.ceremonyLogs.has(processId)) {
      this.ceremonyLogs.set(processId, []);
    }
    
    const logEntry = {
      timestamp: Date.now(),
      event,
      data,
    };
    
    this.ceremonyLogs.get(processId).push(logEntry);
    
    // In a production environment, we might also want to:
    // 1. Store logs in a tamper-evident data structure
    // 2. Publish log hashes to a blockchain for immutability
    // 3. Sign log entries with a ceremony key
  }
  
  /**
   * Generate a hash of the publication metadata
   * 
   * @private
   * @param {Object} process - Ceremony process
   * @param {Object} verificationKey - Verification key
   * @returns {string} Metadata hash
   */
  generatePublicationMetadataHash(process, verificationKey) {
    const metadata = {
      circuitId: process.circuitId,
      circuitName: process.circuitName,
      ceremonyId: process.ceremonyId,
      processId: process.id,
      participantCount: process.participants.contributed,
      securityLevel: process.securityLevel,
      verificationKeyId: verificationKey.id,
      verificationKeyHash: verificationKey.hash,
      timestamp: Date.now(),
    };
    
    // Use SHA-256 for hashing
    return '0x' + sha256(JSON.stringify(metadata));
  }
  
  /**
   * Generate a comprehensive final record of the ceremony
   * 
   * @private
   * @param {string} processId - Ceremony process ID
   * @returns {Object} Final ceremony record
   */
  generateFinalCeremonyRecord(processId) {
    const process = this.activeProcesses.get(processId);
    const logs = this.ceremonyLogs.get(processId) || [];
    
    // Get verification key info if published
    let verificationKeyInfo = null;
    if (this.publishedParameters.has(process.circuitId)) {
      const params = this.publishedParameters.get(process.circuitId);
      verificationKeyInfo = {
        id: params.verificationKeyId,
        hash: params.verificationKeyHash,
        publicationTimestamp: params.publicationTimestamp,
        publicationUrls: params.publicationUrls,
      };
    }
    
    return {
      processId,
      ceremonyId: process.ceremonyId,
      circuitId: process.circuitId,
      circuitName: process.circuitName,
      securityLevel: process.securityLevel,
      startTime: process.startTime,
      completionTime: process.completionTime,
      status: process.status,
      participants: {
        registered: process.participants.registered,
        contributed: process.participants.contributed,
        verified: process.participants.verified,
      },
      requiredParticipants: process.requiredParticipants,
      phaseHistory: process.phaseHistory,
      verificationKey: verificationKeyInfo,
      auditReport: process.phaseHistory.find(p => p.phase === CEREMONY_PHASES.AUDIT)?.metadata?.auditReport,
      eventCount: logs.length,
      finalizedAt: Date.now(),
    };
  }
  
  /**
   * Hash a final ceremony record for integrity verification
   * 
   * @private
   * @param {Object} record - Final ceremony record
   * @returns {string} Record hash
   */
  hashFinalRecord(record) {
    // Use SHA-256 for hashing
    return '0x' + sha256(JSON.stringify(record));
  }
}

// Export singleton instance
const mpcCeremonyProcess = new MpcCeremonyProcess();
export default mpcCeremonyProcess;