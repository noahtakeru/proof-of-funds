/**
 * Automated Trusted Setup Ceremony Coordinator
 * Manages the multi-party computation ceremony for production ZK systems
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

class CeremonyCoordinator {
  constructor(config) {
    this.config = {
      circuitName: config.circuitName,
      minParticipants: config.minParticipants || 3,
      outputDir: config.outputDir || './ceremony',
      contributionTimeout: config.contributionTimeout || 24 * 60 * 60 * 1000, // 24 hours
    };
    
    this.participants = [];
    this.contributions = [];
    this.currentPhase = 'setup';
  }

  /**
   * Initialize the ceremony
   */
  async initializeCeremony() {
    console.log('=== Initializing Trusted Setup Ceremony ===');
    
    // Create ceremony directory
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }
    
    // Generate initial Powers of Tau
    const initialPtau = path.join(this.config.outputDir, 'pot12_0000.ptau');
    execSync(`snarkjs powersoftau new bn128 12 ${initialPtau} -v`);
    
    // Create ceremony metadata
    const metadata = {
      circuitName: this.config.circuitName,
      startTime: new Date().toISOString(),
      minParticipants: this.config.minParticipants,
      phase: 'contribution',
      contributions: []
    };
    
    fs.writeFileSync(
      path.join(this.config.outputDir, 'ceremony.json'),
      JSON.stringify(metadata, null, 2)
    );
    
    console.log('✅ Ceremony initialized');
    return initialPtau;
  }

  /**
   * Register a participant
   */
  async registerParticipant(participantInfo) {
    const participant = {
      id: crypto.randomBytes(16).toString('hex'),
      name: participantInfo.name,
      email: participantInfo.email,
      organization: participantInfo.organization,
      registeredAt: new Date().toISOString(),
      contributionStatus: 'pending'
    };
    
    this.participants.push(participant);
    
    // Generate unique contribution link
    const contributionToken = crypto.randomBytes(32).toString('hex');
    const contributionLink = `https://ceremony.proofoffunds.io/contribute?token=${contributionToken}`;
    
    // Store token mapping
    fs.writeFileSync(
      path.join(this.config.outputDir, `token_${contributionToken}.json`),
      JSON.stringify({ participantId: participant.id })
    );
    
    return {
      participant,
      contributionLink,
      instructions: this.getContributionInstructions()
    };
  }

  /**
   * Process a contribution from a participant
   */
  async processContribution(token, contributionFile) {
    // Verify token
    const tokenFile = path.join(this.config.outputDir, `token_${token}.json`);
    if (!fs.existsSync(tokenFile)) {
      throw new Error('Invalid contribution token');
    }
    
    const { participantId } = JSON.parse(fs.readFileSync(tokenFile));
    const participant = this.participants.find(p => p.id === participantId);
    
    if (!participant || participant.contributionStatus !== 'pending') {
      throw new Error('Invalid participant or contribution already received');
    }
    
    // Verify the contribution
    const contributionNumber = this.contributions.length + 1;
    const outputFile = path.join(
      this.config.outputDir, 
      `pot12_${String(contributionNumber).padStart(4, '0')}.ptau`
    );
    
    try {
      // Verify Powers of Tau file
      execSync(`snarkjs powersoftau verify ${contributionFile}`);
      
      // Copy to ceremony directory
      fs.copyFileSync(contributionFile, outputFile);
      
      // Update participant status
      participant.contributionStatus = 'completed';
      participant.contributionHash = this.calculateFileHash(outputFile);
      participant.contributedAt = new Date().toISOString();
      
      // Add to contributions list
      this.contributions.push({
        participantId: participant.id,
        participantName: participant.name,
        contributionNumber,
        hash: participant.contributionHash,
        timestamp: participant.contributedAt
      });
      
      // Update ceremony metadata
      this.updateCeremonyMetadata();
      
      console.log(`✅ Contribution ${contributionNumber} accepted from ${participant.name}`);
      
      // Check if ceremony is complete
      if (this.contributions.length >= this.config.minParticipants) {
        await this.finalizeCeremony();
      }
      
      return {
        success: true,
        contributionNumber,
        hash: participant.contributionHash
      };
    } catch (error) {
      console.error('Contribution verification failed:', error);
      throw new Error('Invalid contribution file');
    }
  }

  /**
   * Finalize the ceremony
   */
  async finalizeCeremony() {
    console.log('=== Finalizing Ceremony ===');
    
    const lastContribution = path.join(
      this.config.outputDir,
      `pot12_${String(this.contributions.length).padStart(4, '0')}.ptau`
    );
    
    // Apply random beacon
    const beaconHash = crypto.randomBytes(32).toString('hex');
    const beaconPtau = path.join(this.config.outputDir, 'pot12_beacon.ptau');
    
    execSync(`snarkjs powersoftau beacon ${lastContribution} ${beaconPtau} ${beaconHash} 10 -n="Final Beacon"`);
    
    // Prepare phase 2
    const finalPtau = path.join(this.config.outputDir, 'pot12_final.ptau');
    execSync(`snarkjs powersoftau prepare phase2 ${beaconPtau} ${finalPtau} -v`);
    
    // Generate ceremony attestation
    const attestation = {
      ceremony: this.config.circuitName,
      completed: new Date().toISOString(),
      participants: this.participants.length,
      contributions: this.contributions,
      beaconHash,
      finalPtauHash: this.calculateFileHash(finalPtau),
      verificationScript: 'verify-ceremony.sh'
    };
    
    fs.writeFileSync(
      path.join(this.config.outputDir, 'attestation.json'),
      JSON.stringify(attestation, null, 2)
    );
    
    // Generate verification script
    this.generateVerificationScript();
    
    console.log('✅ Ceremony completed successfully');
    console.log(`Final Powers of Tau: ${finalPtau}`);
    
    return {
      finalPtau,
      attestation
    };
  }

  /**
   * Generate instructions for contributors
   */
  getContributionInstructions() {
    return `
# Trusted Setup Ceremony Contribution Instructions

1. Download the latest contribution file from the ceremony coordinator
2. Run the contribution command:
   \`\`\`
   snarkjs powersoftau contribute <input_file> <output_file> --name="Your Name" -v
   \`\`\`
3. Enter random text when prompted (use a secure random source)
4. Upload your output file using your contribution link
5. Publicly attest to your contribution
6. Securely delete any private randomness used

## Security Recommendations:
- Use an air-gapped computer if possible
- Generate entropy from multiple sources
- Document your contribution process
- Sign your attestation with PGP/GPG
    `;
  }

  /**
   * Generate verification script
   */
  generateVerificationScript() {
    const script = `#!/bin/bash
# Ceremony Verification Script
# Verifies the integrity of the trusted setup ceremony

echo "=== Verifying Trusted Setup Ceremony ==="

CEREMONY_DIR="${this.config.outputDir}"

# Verify each contribution
${this.contributions.map((c, i) => `
echo "Verifying contribution ${i + 1}..."
snarkjs powersoftau verify $CEREMONY_DIR/pot12_${String(i + 1).padStart(4, '0')}.ptau
`).join('')}

# Verify final Powers of Tau
echo "Verifying final Powers of Tau..."
snarkjs powersoftau verify $CEREMONY_DIR/pot12_final.ptau

echo "=== Verification Complete ==="
`;

    fs.writeFileSync(
      path.join(this.config.outputDir, 'verify-ceremony.sh'),
      script,
      { mode: 0o755 }
    );
  }

  /**
   * Calculate file hash
   */
  calculateFileHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  /**
   * Update ceremony metadata
   */
  updateCeremonyMetadata() {
    const metadata = {
      circuitName: this.config.circuitName,
      startTime: this.startTime,
      lastUpdate: new Date().toISOString(),
      participants: this.participants,
      contributions: this.contributions,
      phase: this.contributions.length >= this.config.minParticipants ? 'finalizing' : 'contribution'
    };
    
    fs.writeFileSync(
      path.join(this.config.outputDir, 'ceremony.json'),
      JSON.stringify(metadata, null, 2)
    );
  }
}

module.exports = CeremonyCoordinator;