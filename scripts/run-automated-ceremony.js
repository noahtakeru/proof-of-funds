/**
 * Run an automated trusted setup ceremony
 * This script coordinates the ceremony but still requires human participants
 */

const CeremonyCoordinator = require('./automated-ceremony-coordinator');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function runCeremony() {
  console.log('=== Automated Trusted Setup Ceremony ===\n');
  
  // Initialize coordinator
  const coordinator = new CeremonyCoordinator({
    circuitName: 'proof-of-funds',
    minParticipants: 3,
    outputDir: './ceremony-output'
  });
  
  // Step 1: Initialize ceremony
  console.log('Step 1: Initializing ceremony...');
  const initialPtau = await coordinator.initializeCeremony();
  console.log(`✅ Initial Powers of Tau created: ${initialPtau}\n`);
  
  // Step 2: Register participants
  console.log('Step 2: Registering participants...');
  const participants = [];
  
  // In production, this would be a web interface
  for (let i = 0; i < coordinator.config.minParticipants; i++) {
    console.log(`\nParticipant ${i + 1}:`);
    const name = await question('Name: ');
    const email = await question('Email: ');
    const organization = await question('Organization: ');
    
    const result = await coordinator.registerParticipant({
      name,
      email,
      organization
    });
    
    participants.push(result);
    console.log(`\n✅ Registered ${name}`);
    console.log(`Contribution link: ${result.contributionLink}`);
    console.log('\nInstructions have been generated.');
  }
  
  // Step 3: Wait for contributions
  console.log('\n=== Waiting for Contributions ===');
  console.log('Send the contribution links to participants.');
  console.log('They should follow these steps:');
  console.log(coordinator.getContributionInstructions());
  
  // In production, this would be an API endpoint
  console.log('\nThis demo requires manual contribution processing.');
  console.log('In production, contributions would be uploaded via web interface.');
  
  // Step 4: Finalize ceremony (would be automatic when enough contributions received)
  const continue_ceremony = await question('\nHave all contributions been received? (y/n): ');
  
  if (continue_ceremony.toLowerCase() === 'y') {
    // Simulate processing contributions
    for (let i = 0; i < participants.length; i++) {
      const contributionFile = `./ceremony-output/pot12_${String(i + 1).padStart(4, '0')}.ptau`;
      console.log(`\nProcessing contribution ${i + 1}...`);
      
      try {
        // In production, this would process uploaded files
        // Here we're simulating with existing files
        const result = await coordinator.processContribution(
          participants[i].contributionLink.split('token=')[1],
          contributionFile
        );
        console.log(`✅ Contribution ${result.contributionNumber} processed`);
      } catch (error) {
        console.error(`❌ Error processing contribution: ${error.message}`);
      }
    }
    
    // Finalize
    console.log('\n=== Finalizing Ceremony ===');
    const { finalPtau, attestation } = await coordinator.finalizeCeremony();
    
    console.log('\n✅ Ceremony completed successfully!');
    console.log(`Final Powers of Tau: ${finalPtau}`);
    console.log(`Attestation: ./ceremony-output/attestation.json`);
    console.log(`Verification script: ./ceremony-output/verify-ceremony.sh`);
    
    // Generate setup commands for circuits
    console.log('\n=== Next Steps ===');
    console.log('Run these commands to generate zkeys for each circuit:');
    console.log(`
cd circuits/standard
snarkjs groth16 setup standardProof.r1cs ${finalPtau} standardProof.zkey

cd circuits/threshold
snarkjs groth16 setup thresholdProof.r1cs ${finalPtau} thresholdProof.zkey

cd circuits/maximum
snarkjs groth16 setup maximumProof.r1cs ${finalPtau} maximumProof.zkey
    `);
  }
  
  rl.close();
}

// Run if called directly
if (require.main === module) {
  runCeremony().catch(error => {
    console.error('Ceremony error:', error);
    rl.close();
    process.exit(1);
  });
}

module.exports = runCeremony;