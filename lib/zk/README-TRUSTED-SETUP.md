# Trusted Setup Ceremony Process

This document outlines the comprehensive Multi-Party Computation (MPC) ceremony process used to generate secure parameters for our zero-knowledge proof system.

## Overview

A trusted setup ceremony is a cryptographic protocol that generates the initial parameters required for zero-knowledge proofs. The security of these parameters is critical - if compromised, they could potentially allow creation of false proofs.

Our implementation uses a Multi-Party Computation (MPC) ceremony where multiple independent participants each contribute randomness to the parameters. The key security property is that **as long as at least one participant is honest**, the resulting parameters remain secure.

## Key Components

The trusted setup implementation consists of three main components:

1. **TrustedSetupManager.js**: Core infrastructure for managing ceremonies, participants, and verification keys
2. **MpcCeremonyProcess.js**: Protocol implementation and ceremony lifecycle management
3. **VerificationKeyRegistry.js**: Registry for managing, validating and distributing verification keys

## Ceremony Phases

### 1. Preparation
- System initializes ceremony infrastructure
- Defines security parameters and participant requirements
- Sets up secure communication channels

### 2. Announcement
- Public announcement of upcoming ceremony
- Publication of ceremony details and participation requirements
- Registration period specification

### 3. Registration
- Participant identity verification
- Public key submission
- Role assignment (contributor, verifier, etc.)

### 4. Contribution
- Sequential process where each participant adds randomness
- Each contribution builds on previous contributions
- Each participant receives cryptographic proof of their contribution

### 5. Verification
- Independent verification of the contribution process
- Cryptographic validation of the parameter chain
- Verification of participant signatures

### 6. Publication
- Release of final verification keys
- Publication of ceremony transcript
- Distribution of verification infrastructure

### 7. Audit
- Complete review of ceremony process
- Security assessment of implementation
- Publication of transparency report

## Security Measures

Our implementation includes several critical security features:

1. **Zero-Knowledge of Toxic Waste**: The ceremony is designed so that no participant ever has access to the complete "toxic waste" (secret values that could compromise the system).

2. **Defense in Depth**: Multiple security layers protect against various attack vectors:
   - Tamper detection on all contributions
   - Cryptographic signatures for each step
   - Independent verification requirements

3. **Transparent Process**: The entire ceremony is publicly verifiable:
   - All contributions are publicly recorded
   - Cryptographic proofs verify proper execution
   - Complete audit trail is maintained

4. **Entropy Requirements**: Strong randomness is enforced for all contributions:
   - Minimum entropy thresholds (128-256 bits depending on security level)
   - Multiple independent entropy sources required
   - Cryptographic mixing of entropy inputs

## Implementation Details

### Participant Roles

- **Coordinator**: Manages the ceremony but does not contribute to parameters
- **Contributor**: Provides entropy and participates in the MPC process
- **Verifier**: Independently verifies the ceremony outputs
- **Auditor**: Reviews the process for compliance with the protocol

### Security Levels

The system supports three security levels:

1. **Standard**: 
   - Minimum 3 participants
   - 128-bit minimum entropy
   - Basic email verification

2. **Enhanced**:
   - Minimum 5 participants
   - 192-bit minimum entropy
   - Email + social verification

3. **Maximum**:
   - Minimum 10 participants
   - 256-bit minimum entropy
   - Full KYC verification

### Verification Key Management

After successful ceremony completion, verification keys are:

1. Registered in the `VerificationKeyRegistry`
2. Associated with specific circuit versions
3. Made available through standardized file paths
4. Published with cryptographic hashes for integrity verification

## Using the Trusted Setup

Applications can access ceremony-generated verification keys through:

```javascript
// Get the latest verification key for a circuit
const verificationKey = VerificationKeyRegistry.getLatestKey('standard-proof');

// Verify a proof using the key
const isValid = await verifyProof(proof, verificationKey.key);
```

## Security Considerations

- **Parameter Rotation**: Consider regularly rotating parameters through new ceremonies
- **Multiple Ceremonies**: For highest security, run separate ceremonies for critical circuits
- **Diverse Participants**: Include participants from different organizations and jurisdictions
- **Public Verification**: Encourage widespread independent verification of parameters
- **Transparency**: Maintain public records of all ceremony participants and processes

## References

- [ZkSNARKs in a Nutshell](https://blog.ethereum.org/2016/12/05/zksnarks-in-a-nutshell)
- [The Zcash Powers of Tau Ceremony](https://electriccoin.co/blog/powers-of-tau/)
- [What is Trusted Setup?](https://zkproof.org/2021/06/30/setup-ceremonies/)
- [Perpetual Powers of Tau](https://github.com/privacy-scaling-explorations/perpetualpowersoftau)