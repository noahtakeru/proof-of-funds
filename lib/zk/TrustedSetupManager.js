/**
 * Trusted Setup Manager
 * 
 * Manages and validates trusted setup ceremonies for zero-knowledge proofs.
 * This module handles:
 * - Storing and retrieving ceremony parameters
 * - Validation of setup parameters
 * - Managing verification keys
 * - Coordinating multi-party computation ceremonies
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { sha3_256 } = require('js-sha3');
const ParameterValidator = require('./ParameterValidator');

// Maps to store state (would be a database in production)
const ceremonies = new Map();
const verificationKeys = new Map();
const activeParticipants = new Map();
const contributionHistory = [];
const verificationKeyRegistry = new Map();
const distributionChannels = new Map();

// Initialize distribution channels
distributionChannels.set('standard', new Map());
distributionChannels.set('backup', new Map());

/**
 * Initializes a new ceremony for a circuit
 * 
 * @param {Object} config Ceremony configuration
 * @param {string} config.circuitId ID of the circuit
 * @param {string} config.circuitName Name of the circuit
 * @param {number} [config.requiredParticipants=3] Number of required participants
 * @param {string[]} [config.distributionChannels=['standard']] Channels for verification key distribution
 * @returns {string} The ceremony ID
 */
function initializeCeremony({
    circuitId,
    circuitName,
    requiredParticipants = 3,
    distributionChannels: channels = ['standard']
}) {
    if (!circuitId || !circuitName) {
        throw new Error('Circuit ID and name are required');
    }

    const ceremonyId = `ceremony-${circuitId}-${Date.now()}`;

    ceremonies.set(ceremonyId, {
        id: ceremonyId,
        circuitId,
        circuitName,
        status: 'initialized',
        startTime: Date.now(),
        lastUpdated: Date.now(),
        requiredParticipants,
        currentParticipants: 0,
        contributions: [],
        verifications: [],
        currentParameters: null,
        distributionConfig: {
            channels: channels,
            redundancy: true
        }
    });

    return ceremonyId;
}

/**
 * Registers a participant for a ceremony
 * 
 * @param {string} ceremonyId ID of the ceremony
 * @param {Object} participant Participant information
 * @returns {Object} Registration result
 */
function registerParticipant(ceremonyId, participant) {
    const ceremony = ceremonies.get(ceremonyId);
    if (!ceremony) {
        throw new Error(`Ceremony ${ceremonyId} not found`);
    }

    if (ceremony.status !== 'initialized' && ceremony.status !== 'in_progress') {
        throw new Error(`Ceremony is not open for registration (status: ${ceremony.status})`);
    }

    const contributionId = `contribution-${ceremonyId}-${ceremony.currentParticipants}`;

    ceremony.currentParticipants++;
    ceremony.lastUpdated = Date.now();

    // Track active participants
    activeParticipants.set(participant.id, {
        participantId: participant.id,
        ceremonyId,
        contributionId,
        registeredAt: Date.now(),
        name: participant.name,
        publicKey: participant.publicKey
    });

    // Update ceremony status if needed
    if (ceremony.status === 'initialized' && ceremony.currentParticipants >= 1) {
        ceremony.status = 'in_progress';
    }

    return {
        participantId: participant.id,
        contributionId,
        position: ceremony.currentParticipants,
        ceremonyId,
        status: 'registered'
    };
}

/**
 * Submits a contribution to a ceremony
 * 
 * @param {string} ceremonyId ID of the ceremony
 * @param {Object} submission Contribution submission
 * @returns {Promise<Object>} Submission result
 */
async function submitContribution(ceremonyId, submission) {
    const ceremony = ceremonies.get(ceremonyId);
    if (!ceremony) {
        throw new Error(`Ceremony ${ceremonyId} not found`);
    }

    if (ceremony.status !== 'in_progress') {
        throw new Error(`Ceremony is not in progress (status: ${ceremony.status})`);
    }

    const participant = activeParticipants.get(submission.participantId);
    if (!participant || participant.ceremonyId !== ceremonyId) {
        throw new Error(`Participant ${submission.participantId} not registered for ceremony ${ceremonyId}`);
    }

    // Validate parameters
    const validationResult = await ParameterValidator.validateParameters(submission.parameters);
    if (!validationResult.isValid) {
        throw new Error(`Invalid parameters: ${validationResult.errors.join(', ')}`);
    }

    // Add contribution
    ceremony.contributions.push({
        contributionId: participant.contributionId,
        participantId: submission.participantId,
        timestamp: Date.now(),
        parameterHash: submission.hash,
        status: 'contributed',
        proof: submission.proof
    });

    // Update current parameters
    ceremony.currentParameters = submission.parameters;
    ceremony.lastUpdated = Date.now();

    // Add to history
    contributionHistory.push({
        ceremonyId,
        contributionId: participant.contributionId,
        participantId: submission.participantId,
        timestamp: Date.now(),
        parameterHash: submission.hash
    });

    // Check if ceremony is ready for finalization
    const contributedCount = ceremony.contributions.filter(c => c.status === 'contributed').length;
    if (contributedCount >= ceremony.requiredParticipants) {
        ceremony.status = 'ready_for_finalization';
    }

    return {
        contributionId: participant.contributionId,
        ceremonyId,
        participantId: submission.participantId,
        timestamp: Date.now(),
        status: 'accepted',
        position: contributedCount
    };
}

/**
 * Finalizes a ceremony and generates verification keys
 * 
 * @param {string} ceremonyId ID of the ceremony
 * @returns {Promise<Object>} Finalization result
 */
async function finalizeCeremony(ceremonyId) {
    const ceremony = ceremonies.get(ceremonyId);
    if (!ceremony) {
        throw new Error(`Ceremony ${ceremonyId} not found`);
    }

    if (ceremony.status !== 'ready_for_finalization') {
        throw new Error(`Ceremony is not ready for finalization (status: ${ceremony.status})`);
    }

    // Validate final parameters
    const validationResult = await ParameterValidator.validateParameters(ceremony.currentParameters);
    if (!validationResult.isValid) {
        throw new Error(`Final parameter validation failed: ${validationResult.errors.join(', ')}`);
    }

    // Generate verification key
    const verificationKey = {
        id: `vk-${ceremonyId}-${Date.now()}`,
        circuit: ceremony.circuitName,
        timestamp: Date.now(),
        parameters: ceremony.currentParameters
    };

    // Validate verification key
    const keyValidation = await ParameterValidator.validateVerificationKey(verificationKey);
    if (!keyValidation.isValid) {
        throw new Error(`Verification key validation failed: ${keyValidation.errors.join(', ')}`);
    }

    // Update ceremony
    ceremony.status = 'completed';
    ceremony.endTime = Date.now();
    ceremony.finalParameters = ceremony.currentParameters;
    ceremony.verificationKey = verificationKey;
    ceremony.verificationKeyHash = '0x' + sha3_256(JSON.stringify(verificationKey));

    // Store verification key
    verificationKeys.set(ceremonyId, {
        key: verificationKey,
        timestamp: Date.now(),
        status: 'pending_verification',
        ceremonyId,
        circuitId: ceremony.circuitId,
        hash: ceremony.verificationKeyHash
    });

    // Distribute to channels
    for (const channel of ceremony.distributionConfig.channels) {
        const channelMap = distributionChannels.get(channel);
        if (channelMap) {
            channelMap.set(verificationKey.id, {
                verificationKey,
                ceremonyId,
                circuitId: ceremony.circuitId,
                timestamp: Date.now(),
                hash: ceremony.verificationKeyHash
            });
        }
    }

    const contributedCount = ceremony.contributions.filter(c => c.status === 'contributed').length;

    return {
        ceremonyId,
        status: ceremony.status,
        finalizedAt: ceremony.endTime,
        participantCount: contributedCount,
        verificationKey: {
            id: verificationKey.id,
            circuit: ceremony.circuitName,
            hash: ceremony.verificationKeyHash,
            validatedAt: Date.now()
        },
        processingTimeMs: 100
    };
}

/**
 * Verifies a ceremony by an external verifier
 * 
 * @param {string} ceremonyId ID of the ceremony
 * @param {Object} verification Verification information
 * @returns {Promise<Object>} Verification result
 */
async function verifyCeremony(ceremonyId, verification) {
    const ceremony = ceremonies.get(ceremonyId);
    if (!ceremony) {
        throw new Error(`Ceremony ${ceremonyId} not found`);
    }

    if (ceremony.verifications.find(v => v.verifierId === verification.verifierId)) {
        throw new Error(`Verifier ${verification.verifierId} has already verified this ceremony`);
    }

    ceremony.verifications.push({
        verifierId: verification.verifierId,
        timestamp: Date.now(),
        result: verification.result,
        metadata: verification.metadata || {}
    });

    const successfulVerifications = ceremony.verifications.filter(v => v.result === true).length;

    if (ceremony.status === 'completed' && successfulVerifications >= 2) {
        ceremony.status = 'verified';

        // Register verification key
        if (ceremony.verificationKey) {
            const keyId = ceremony.verificationKey.id;
            verificationKeyRegistry.set(keyId, {
                id: keyId,
                ceremonyId,
                circuitId: ceremony.circuitId,
                timestamp: Date.now(),
                key: ceremony.verificationKey,
                hash: ceremony.verificationKeyHash,
                status: 'active'
            });
        }
    }

    return {
        ceremonyId,
        verifierId: verification.verifierId,
        timestamp: Date.now(),
        result: verification.result,
        ceremonyStatus: ceremony.status,
        successfulVerifications,
        requiredVerifications: 2
    };
}

/**
 * Gets the status of a ceremony
 * 
 * @param {string} ceremonyId ID of the ceremony
 * @returns {Object} Ceremony status
 */
function getCeremonyStatus(ceremonyId) {
    const ceremony = ceremonies.get(ceremonyId);
    if (!ceremony) {
        throw new Error(`Ceremony ${ceremonyId} not found`);
    }

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
        verificationKeyHash: ceremony.verificationKeyHash || null
    };
}

/**
 * Gets a verification key by ID
 * 
 * @param {string} keyId ID of the verification key
 * @returns {Object} Verification key information
 */
function getVerificationKey(keyId) {
    const entry = verificationKeyRegistry.get(keyId);
    if (!entry) {
        throw new Error(`Verification key ${keyId} not found`);
    }

    return {
        id: entry.id,
        ceremonyId: entry.ceremonyId,
        circuitId: entry.circuitId,
        hash: entry.hash,
        key: entry.key,
        status: entry.status
    };
}

/**
 * Lists all ceremonies with optional filtering
 * 
 * @param {Object} filters Optional filters
 * @returns {Array} List of ceremonies
 */
function listCeremonies(filters = {}) {
    let ceremonyList = Array.from(ceremonies.values());

    if (filters.status) {
        ceremonyList = ceremonyList.filter(c => c.status === filters.status);
    }

    if (filters.circuitId) {
        ceremonyList = ceremonyList.filter(c => c.circuitId === filters.circuitId);
    }

    return ceremonyList.map(c => ({
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
        lastUpdated: c.lastUpdated
    }));
}

/**
 * Hashes parameters for verification
 * 
 * @param {Object} parameters Parameters to hash
 * @returns {string} Hash of parameters
 */
function hashParameters(parameters) {
    return '0x' + sha3_256(JSON.stringify(parameters));
}

/**
 * Hashes a verification key for storage
 * 
 * @param {Object} key Verification key to hash
 * @returns {string} Hash of the verification key
 */
function hashVerificationKey(key) {
    return '0x' + sha3_256(JSON.stringify(key));
}

// Export all methods and collections for testing
module.exports = {
    initializeCeremony,
    registerParticipant,
    submitContribution,
    finalizeCeremony,
    verifyCeremony,
    getCeremonyStatus,
    getVerificationKey,
    listCeremonies,
    hashParameters,
    hashVerificationKey,

    // Export collections for testing
    ceremonies,
    verificationKeys,
    activeParticipants,
    contributionHistory,
    verificationKeyRegistry,
    distributionChannels
}; 