/**
 * Tests for TrustedSetupManager
 * 
 * This file contains tests for the TrustedSetupManager module which
 * handles trusted setup ceremonies for zero-knowledge proof parameters.
 */

import TrustedSetupManager from '../TrustedSetupManager.js';

describe('TrustedSetupManager', () => {
  // Test initialization
  test('should initialize correctly', () => {
    expect(TrustedSetupManager).toBeDefined();
    expect(TrustedSetupManager.ceremonies).toBeDefined();
    expect(TrustedSetupManager.verificationKeys).toBeDefined();
  });

  // Test ceremony initialization
  test('should initialize a ceremony with correct parameters', () => {
    const ceremonyId = TrustedSetupManager.initializeCeremony({
      circuitId: 'test-circuit',
      circuitName: 'Test Circuit',
      securityLevel: 'standard',
    });

    expect(ceremonyId).toBeDefined();
    expect(ceremonyId).toMatch(/ceremony-test-circuit-/);
    
    const ceremony = TrustedSetupManager.ceremonies.get(ceremonyId);
    expect(ceremony).toBeDefined();
    expect(ceremony.circuitId).toBe('test-circuit');
    expect(ceremony.circuitName).toBe('Test Circuit');
    expect(ceremony.status).toBe('initialized');
  });

  // Test participant registration
  test('should register participants for a ceremony', () => {
    // Initialize a ceremony
    const ceremonyId = TrustedSetupManager.initializeCeremony({
      circuitId: 'registration-test',
      circuitName: 'Registration Test',
    });

    // Register a participant
    const registration = TrustedSetupManager.registerParticipant(ceremonyId, {
      id: 'participant1',
      name: 'Test Participant',
      publicKey: 'test-public-key',
    });

    expect(registration).toBeDefined();
    expect(registration.participantId).toBe('participant1');
    expect(registration.contributionOrder).toBe(1);
    
    // Verify the participant was registered
    const ceremony = TrustedSetupManager.ceremonies.get(ceremonyId);
    expect(ceremony.contributions.length).toBe(1);
    expect(ceremony.contributions[0].participantId).toBe('participant1');
    expect(ceremony.status).toBe('in_progress');
  });

  // Test contribution submission
  test('should accept contributions from registered participants', async () => {
    // Initialize a ceremony
    const ceremonyId = TrustedSetupManager.initializeCeremony({
      circuitId: 'contribution-test',
      circuitName: 'Contribution Test',
    });

    // Register a participant
    TrustedSetupManager.registerParticipant(ceremonyId, {
      id: 'contributor1',
      name: 'Test Contributor',
      publicKey: 'test-public-key',
    });

    // Submit a contribution
    const mockParameters = { alpha: 'test-alpha', beta: 'test-beta' };
    const submission = await TrustedSetupManager.submitContribution(ceremonyId, {
      participantId: 'contributor1',
      parameters: mockParameters,
      hash: TrustedSetupManager.hashParameters(mockParameters),
    });

    expect(submission).toBeDefined();
    expect(submission.participantId).toBe('contributor1');
    
    // Verify the contribution was accepted
    const ceremony = TrustedSetupManager.ceremonies.get(ceremonyId);
    expect(ceremony.currentParameters).toEqual(mockParameters);
    expect(ceremony.contributions[0].status).toBe('contributed');
  });

  // Test ceremony verification
  test('should verify a ceremony when sufficient verifications provided', async () => {
    // Initialize a ceremony
    const ceremonyId = TrustedSetupManager.initializeCeremony({
      circuitId: 'verification-test',
      circuitName: 'Verification Test',
    });

    // Register and submit contribution
    TrustedSetupManager.registerParticipant(ceremonyId, {
      id: 'contributor2',
      name: 'Test Contributor',
      publicKey: 'test-public-key',
    });

    const mockParameters = { alpha: 'verify-alpha', beta: 'verify-beta' };
    await TrustedSetupManager.submitContribution(ceremonyId, {
      participantId: 'contributor2',
      parameters: mockParameters,
      hash: TrustedSetupManager.hashParameters(mockParameters),
    });

    // Finalize the ceremony
    await TrustedSetupManager.finalizeCeremony(ceremonyId);

    // Submit verification
    const verification = await TrustedSetupManager.verifyCeremony(ceremonyId, {
      verifierId: 'verifier1',
      result: true,
      metadata: { methods: ['cryptographic', 'procedural'] },
    });

    expect(verification).toBeDefined();
    expect(verification.verifierId).toBe('verifier1');
    expect(verification.result).toBe(true);
    
    // Add more verifications to reach threshold
    await TrustedSetupManager.verifyCeremony(ceremonyId, {
      verifierId: 'verifier2',
      result: true,
    });

    // Check ceremony status
    const ceremony = TrustedSetupManager.ceremonies.get(ceremonyId);
    expect(ceremony.status).toBe('verified');
  });

  // Test verification key management
  test('should register and retrieve verification keys', async () => {
    // Set up ceremony and generate key
    const ceremonyId = TrustedSetupManager.initializeCeremony({
      circuitId: 'key-test',
      circuitName: 'Key Test',
    });

    // Contribute and finalize
    TrustedSetupManager.registerParticipant(ceremonyId, {
      id: 'key-contributor',
      publicKey: 'test-key',
    });

    const mockParameters = { alpha: 'key-alpha', beta: 'key-beta' };
    await TrustedSetupManager.submitContribution(ceremonyId, {
      participantId: 'key-contributor',
      parameters: mockParameters,
      hash: TrustedSetupManager.hashParameters(mockParameters),
    });

    const finalizationResult = await TrustedSetupManager.finalizeCeremony(ceremonyId);
    expect(finalizationResult.verificationKey).toBeDefined();
    
    // Register the key
    const keyId = TrustedSetupManager.registerVerificationKey(
      ceremonyId,
      finalizationResult.verificationKey
    );
    
    // Retrieve the key
    const retrievedKey = TrustedSetupManager.getVerificationKey(keyId);
    expect(retrievedKey).toBeDefined();
    expect(retrievedKey.id).toBe(keyId);
    expect(retrievedKey.ceremonyId).toBe(ceremonyId);
  });
});