/**
 * Manual test script for TrustedSetupManager
 * 
 * This script provides a basic example of using the TrustedSetupManager
 * to initialize a ceremony, register participants, submit contributions,
 * and finalize the ceremony.
 * 
 * To run this script:
 * node --experimental-vm-modules lib/zk/__tests__/ceremony/manual-test.js
 * 
 * IMPORTANT NOTES:
 * 1. This script tests the actual implementation (not mocks)
 * 2. You need to run with --experimental-vm-modules flag for ESM support
 * 3. This is the best way to test the Week 4 Task 1 implementation
 * 4. If you encounter errors, check the console output for details
 */

import TrustedSetupManager from '../../TrustedSetupManager.js';

console.log('🔑 Testing TrustedSetupManager implementation...');

// Sample parameters for testing
const sampleParameters = {
  alpha: 'test-alpha',
  beta: 'test-beta',
  gamma: 'test-gamma',
  delta: 'test-delta',
  ic: ['test-ic-1', 'test-ic-2'],
};

async function runCeremonyTest() {
  try {
    console.log('Initializing ceremony...');
    const ceremonyId = TrustedSetupManager.initializeCeremony({
      circuitId: 'manual-test-circuit',
      circuitName: 'Manual Test Circuit',
      distributionChannels: ['standard', 'backup'],
    });
    
    console.log(`Ceremony initialized: ${ceremonyId}`);
    
    // Register first participant
    const participant1 = {
      id: 'manual-test-participant-1',
      name: 'Test Participant 1',
      publicKey: 'test-public-key-1',
    };
    
    const registration1 = TrustedSetupManager.registerParticipant(ceremonyId, participant1);
    console.log(`Registered participant 1: ${registration1.participantId}`);
    
    // Register second participant
    const participant2 = {
      id: 'manual-test-participant-2',
      name: 'Test Participant 2',
      publicKey: 'test-public-key-2',
    };
    
    const registration2 = TrustedSetupManager.registerParticipant(ceremonyId, participant2);
    console.log(`Registered participant 2: ${registration2.participantId}`);
    
    // Submit contribution from participant 1
    const hash1 = TrustedSetupManager.hashParameters(sampleParameters);
    
    console.log('Submitting contribution from participant 1...');
    const contribution1 = await TrustedSetupManager.submitContribution(ceremonyId, {
      participantId: participant1.id,
      parameters: sampleParameters,
      hash: hash1,
      proof: { type: 'test-proof' },
    });
    
    console.log(`Contribution 1 accepted: ${contribution1.hash}`);
    
    // Submit contribution from participant 2
    const hash2 = TrustedSetupManager.hashParameters({
      ...sampleParameters,
      delta: 'modified-delta', // Slightly different parameters
    });
    
    console.log('Submitting contribution from participant 2...');
    const contribution2 = await TrustedSetupManager.submitContribution(ceremonyId, {
      participantId: participant2.id,
      parameters: {
        ...sampleParameters,
        delta: 'modified-delta',
      },
      hash: hash2,
      proof: { type: 'test-proof' },
    });
    
    console.log(`Contribution 2 accepted: ${contribution2.hash}`);
    
    // Get ceremony status
    const status = TrustedSetupManager.getCeremonyStatus(ceremonyId);
    console.log('Ceremony status:', status);
    
    // Finalize ceremony
    console.log('Finalizing ceremony...');
    const finalizationResult = await TrustedSetupManager.finalizeCeremony(ceremonyId);
    
    console.log('Ceremony finalized successfully:');
    console.log(`  Status: ${finalizationResult.status}`);
    console.log(`  Participant count: ${finalizationResult.participantCount}`);
    console.log(`  Verification key ID: ${finalizationResult.verificationKey.id}`);
    console.log(`  Verification key hash: ${finalizationResult.verificationKey.hash}`);
    
    // Verify ceremony
    console.log('Verifying ceremony...');
    const verification1 = await TrustedSetupManager.verifyCeremony(ceremonyId, {
      verifierId: 'manual-test-verifier-1',
      result: true,
      metadata: { method: 'manual-test' },
    });
    
    console.log(`Verification 1 result: ${verification1.result}`);
    console.log(`Ceremony status after first verification: ${verification1.ceremonyStatus}`);
    
    // Second verification
    const verification2 = await TrustedSetupManager.verifyCeremony(ceremonyId, {
      verifierId: 'manual-test-verifier-2',
      result: true,
      metadata: { method: 'manual-test' },
    });
    
    console.log(`Verification 2 result: ${verification2.result}`);
    console.log(`Ceremony status after second verification: ${verification2.ceremonyStatus}`);
    
    // Get verification key
    const verificationKey = TrustedSetupManager.getVerificationKey(finalizationResult.verificationKey.id);
    console.log('Successfully retrieved verification key');
    
    // List all ceremonies
    const ceremonies = TrustedSetupManager.listCeremonies();
    console.log(`Total ceremonies: ${ceremonies.length}`);
    
    console.log('✅ Manual test completed successfully!');
    
    return { ceremonyId, verificationKeyId: finalizationResult.verificationKey.id };
  } catch (error) {
    console.error('❌ Manual test failed:');
    console.error(error);
    throw error;
  }
}

runCeremonyTest().catch(console.error);