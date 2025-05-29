# ZKP-Based Verification Platform Implementation Plan

## Rules
1. No mock or placeholder code. We want to know where we're failing.
2. If something is confusing, don't create crap - stop, make note and consult.
3. Always check if an implementation, file, test, architecture, function or code exists before making any new files or folders.
4. Understand the entire codebase (make sure you grok it before making changes).
5. Review this entire plan and its progress before coding.
6. If you make a new code file - indicate that this is new and exactly what it's needed for. Also make sure there isn't mock or placeholder crap code in here either. Fallback code is NOT ACCEPTABLE EITHER. WE NEED TO KNOW WHEN AND WHERE WE FAIL.
7. Unless a plan or test file was made during this phased sprint (contained in this document) - I'd assume it's unreliable until its contents are analyzed thoroughly. Confirm its legitimacy before proceeding with trusting it blindly. Bad assumptions are unacceptable.
8. Put all imports at the top of the file it's being imported into.
9. Record all progress in this document.
10. Blockchain testing will be done on Polygon Amoy, so keep this in mind.
11. Do not make any UI changes (to existing UI). I like the way the frontend looks at the moment.
12. Track your progress in this file. Do not make more tracking or report files. They're unnecessary.
13. Price estimates are unacceptable. We are building for production, so it's important to prioritize building working code that doesn't rely on mock data or placeholder implementation. NOTHING "FAKE".
14. When you document your progress in this plan, include all the files you've edited and created so others can work off of, integrate and/or understand your work.
15. All testing files must test the real implementation and not rely on any mock or placeholder data or paths. It's better to fail and have errors than make fake tests.
16. Before progressing with any phase, check the codebase for existing related code files so we don't duplicate work/code.
17. If a human is needed for anything, flag it to the human. There are likely some external services that are required. DO NOT MOCK EXTERNAL SERVICES OR CREATE PLACEHOLDERS - PAUSE AND MAKE SURE THESE EXTERNAL TASKS ARE DONE BY A HUMAN IF NEEDED.

## Overview

This document outlines the implementation plan for extending the Proof of Funds protocol to support both consumer-facing self-service proofs and institutional verification workflows. The implementation maintains the existing consumer UX while adding sophisticated institutional features for custom verification templates, reference tokens, and compliance needs.

## Table of Contents

- [Project Phases](#project-phases)
- [Phase 1: Core Infrastructure Enhancement](#phase-1-core-infrastructure-enhancement)
- [Phase 2: Authentication System](#phase-2-authentication-system)
- [Phase 3: Extended ZK Circuits](#phase-3-extended-zk-circuits)
- [Phase 4: Institutional Interface](#phase-4-institutional-interface)
- [Phase 5: Reference Token System](#phase-5-reference-token-system)
- [Phase 6: Integration and Testing](#phase-6-integration-and-testing)
- [Phase 7: GCP Deployment](#phase-7-gcp-deployment)
- [Technology Stack](#technology-stack)
- [Database Schema Updates](#database-schema-updates)
- [API Endpoints](#api-endpoints)
- [Circuit Schema Manifest](#circuit-schema-manifest)
- [Reference Token Cryptography](#reference-token-cryptography)
- [Audit Logging System](#audit-logging-system)
- [Key Management System](#key-management-system)
- [Circuit Upgrade Protocol](#circuit-upgrade-protocol)

## Project Phases

The implementation will be divided into seven primary phases, each with specific deliverables and dependencies. The phases are designed to be executable in sequence with minimal disruption to the existing consumer platform.

## Human Intervention Requirements

Throughout the implementation, certain critical steps require human intervention. Development will pause at these points until the required human actions are completed. These are clearly marked with 🔴 **HUMAN REQUIRED** tags.

### Required Human Actions Overview:

1. **External Service Setup**
   - GCP project configuration and service account creation
   - Blockchain node provider accounts (Infura, Alchemy, etc.)
   - Polygon testnet contract deployment
   - Domain configuration and TLS certificates

2. **Trusted Setup Ceremony**
   - Coordinating participants
   - Providing secure entropy source
   - Verifying contributions
   - Publishing final verification keys

3. **Third-Party Integrations**
   - KYC/Identity provider agreements
   - API access credentials
   - Testing account setup

4. **Security and Compliance**
   - External security audit coordination
   - Audit finding review and prioritization
   - Production deployment authorization
   - Infrastructure spending approval

Development can proceed with implementation while awaiting these human inputs, but certain features will remain in a pending state until the required human actions are completed.

### Human Intervention Timeline

The following outlines when human intervention will be required during the implementation process:

| Phase | Human Intervention | Timeline | Blocking Level |
|-------|-------------------|----------|--------------|
| Phase 1 | External Service Setup | Week 1-2 | Medium - Can start development but needed for full testing |
| Phase 3 | KYC Provider Integration | Week 5-6 | Low - Only blocks KYC attestation features |
| Phase 3 | Trusted Setup Ceremony | Week 7-8 | High - Required for secure ZK proof generation |
| Phase 5 | Smart Contract Deployment | Week 12-13 | High - Required for on-chain anchoring |
| Phase 6 | External Security Review | Week 15-16 | Medium - Can develop while review occurs |
| Phase 7 | Production Deployment Authorization | Week 19-20 | Critical - Final step before launch |

For each of these intervention points, the implementation plan includes detailed instructions on what is needed from human operators, allowing development to continue efficiently while awaiting these necessary human inputs.

## Phase 1: Core Infrastructure Enhancement

**Duration: 2 weeks**

### 1.1 Multi-Chain Support Extension

- Enhance wallet connection interface to support EVM, Solana, and Bitcoin networks
- Implement chain-specific balance and transaction retrieval functions
- Create abstraction layer for unified data structures across chains
- Build transaction normalization utilities for cross-chain compatibility

#### Cross-Chain Wallet Integration UI

- Create chain-specific wallet connection adapters:
  - EVM: Extend existing MetaMask/WalletConnect integration
  - Solana: Implement Phantom/Solflare integration with proper transaction signing
  - Bitcoin: Add xPub/address derivation support via BitcoinJS
- Develop chain selection UI component with appropriate signing methods per chain
- Implement unified balance display component supporting all chain types
- Build chain-specific address validation utilities

#### Chain Adapter Implementation

- Create `ChainAdapter` interface with common methods:
  ```typescript
  interface ChainAdapter {
    getBalance(address: string): Promise<BigNumber>;
    getTransactions(address: string, options: { limit: number, offset: number }): Promise<Transaction[]>;
    validateAddress(address: string): boolean;
    signMessage(message: string): Promise<string>;
    getAddressFromSignature(message: string, signature: string): string;
  }
  ```
- Implement concrete adapters for each chain type:
  - `EVMChainAdapter`: Uses ethers.js for Ethereum/Polygon
  - `SolanaChainAdapter`: Uses @solana/web3.js for Solana
  - `BitcoinChainAdapter`: Uses bitcoinjs-lib for Bitcoin

### 1.2 Database Schema Updates

- Add organization and user role tables
- Create heuristic template storage schema
- Implement reference token tables
- Add consent tracking fields

### 1.3 Shared Backend Services

- Refactor proof generation service for enhanced circuit support
- Create transaction history processor
- Implement blacklist checking service
- Build extensible verification result formatter

### 1.4 System-Wide Audit Logging

- Implement secure, append-only audit logging service
- Create structured log schema for all security-relevant events
- Build encrypted log storage mechanism in GCP
- Implement log rotation and retention policies
- Create organization-level log export functionality

### 1.5 🔴 HUMAN REQUIRED: External Service Setup

**Description:** The following external services and configurations are required to proceed with full implementation. Development can start without these, but will reach blocking points.

**Required Actions:**
1. **Blockchain Node Provider Setup**
   - Create accounts with node providers (Infura, Alchemy, etc.) for:
     - Ethereum Mainnet
     - Polygon (Mumbai and Amoy testnet)
     - Solana (Devnet)
   - Generate and securely store API keys
   - Set appropriate rate limits and usage alerts

2. **Initial GCP Setup**
   - Verify/create GCP project with appropriate permissions
   - Enable required APIs:
     - Secret Manager
     - Cloud Storage
     - Cloud Functions
     - Cloud Logging
   - Create service account with minimal required permissions
   - Generate and securely store service account credentials

**Handoff Instructions:**
- Provide all API keys and credentials through secure channel
- Document any rate limits or restrictions
- Create `.env.example` file with required environment variables

### Deliverables:
- Updated database migrations
- Enhanced multi-chain adapters
- Unified verification service
- Comprehensive audit logging system
- External service configuration documentation

## Phase 2: Authentication System

**Duration: 2 weeks**

### 2.1 Consumer Authentication

- Enhance existing wallet-based authentication
- Add email verification layer
- Implement session management with proper JWT handling
- Create account preferences and settings storage

### 2.2 Business Authentication

- Build organization account system
- Implement role-based access control
- Create team member invitation workflow
- Add two-factor authentication for business accounts

### 2.3 Shared Authentication Infrastructure

- Develop unified auth service
- Implement token rotation and refresh
- Create rate limiting and security monitoring
- Build auth-related API endpoints

### 2.4 Security Monitoring & Rate Limiting

- Implement comprehensive rate limiting across all sensitive endpoints:
  - Authentication attempts (per IP, per user)
  - Proof generation requests (per user, per organization)
  - Verification attempts (per token, per verifier)
  - API access (per key, per endpoint)
- Create monitoring dashboard for security events
- Implement alerting for suspicious activity patterns
- Build IP reputation tracking system

### Deliverables:
- Consumer authentication flow (wallet + email)
- Business authentication system with RBAC
- Authentication API endpoints
- Security monitoring services
- Rate limiting system

## Phase 3: Extended ZK Circuits

**Duration: 3 weeks**

### 3.1 Enhanced Balance Verification Circuits

- Update existing threshold, maximum, and standard circuits
- Optimize for multi-chain asset aggregation
- Add timestamp verification components
- Implement proper circuit versioning

### 3.2 Blacklist Verification Circuit

- Create Merkle tree-based blacklist verification
- Implement transaction history scanning circuit
- Build address interaction graph components
- Optimize for large blacklists using batching

### 3.3 KYC Attestation Integration

- Implement circuit components for external attestation verification
- Create secure attestation signature checking
- Build revocation checking for attestations
- Add timestamp validity verification

#### 🔴 HUMAN REQUIRED: KYC Provider Integration

**Description:** Integration with KYC/identity providers requires business agreements, API credentials, and compliance considerations that cannot be automated.

**Required Actions:**
1. **KYC Provider Selection**
   - Evaluate and select compatible KYC/identity providers
   - Consider jurisdictional coverage and compliance requirements
   - Assess technical compatibility with ZK attestations
   - Compare pricing and service level agreements

2. **Business Agreement Setup**
   - Establish business relationship with selected provider(s)
   - Review and sign necessary contracts
   - Address compliance and data handling requirements
   - Set up billing and payment arrangements

3. **API Access Configuration**
   - Obtain API credentials and access tokens
   - Document rate limits and usage requirements
   - Set up secure credential storage in GCP Secret Manager
   - Establish communication channels for support

**Handoff Instructions:**
- Provide API documentation from selected provider
- Share API credentials through secure channels
- Document compliance requirements for integration
- Clarify data retention and handling policies

**Integration Requirements Checklist:**
- [ ] KYC provider selected and agreements signed
- [ ] API credentials obtained and securely stored
- [ ] Test environment access configured
- [ ] Compliance requirements documented
- [ ] Data handling procedures established

### 3.4 Composite Proof Generation

- Develop logic for combining multiple verification types
- Create proper witness generation for complex heuristics
- Implement optimized proof generation pipeline
- Add verification key management

#### Trusted Setup Protocol

- Implement Trusted Setup coordination for Groth16 circuits:
  - Create ceremony coordination service that manages:
    - Participant registration and verification
    - Contribution sequencing and validation
    - Final key publishing and verification
  - Build trusted setup dashboard for administrators
  - Implement secure contribution verification system
  - Store ceremony artifacts with cryptographic integrity checks
  - Generate and publish verification keys for each circuit version
  - Document trusted setup protocol for new circuit versions

- Trusted Setup Storage:
  ```typescript
  interface TrustedSetupArtifact {
    circuitId: string;
    circuitVersion: string;
    ceremonyId: string;
    contributionCount: number;
    zkeyHash: string;
    vkeyHash: string;
    finalizedAt: string;
    isActive: boolean;
  }
  ```

#### 🔴 HUMAN REQUIRED: Trusted Setup Ceremony Coordination

**Description:** The security of Groth16 ZK proofs depends on a secure multi-party computation ceremony. This cannot be automated and requires human coordination.

**Required Actions:**
1. **Ceremony Preparation**
   - Identify and recruit trusted participants (minimum 3-5 independent contributors)
   - Schedule contribution windows for each participant
   - Prepare secure communication channels for coordination

2. **Entropy Generation**
   - Generate secure entropy source for initial parameters
   - Document entropy generation process for transparency
   - Ensure high-quality randomness (e.g., use hardware RNG if available)

3. **Contribution Verification**
   - Verify each participant's contribution hash
   - Ensure proper contribution sequence is followed
   - Validate contribution signatures and attestations

4. **Final Publication**
   - Review final ceremony transcript
   - Publish verification keys and ceremony transcript
   - Sign and attest to the integrity of the process

**Handoff Instructions:**
- Provide final verification keys through secure channel
- Document hashes of all artifacts
- Confirm final participant count and contribution sequence

**Ceremony Security Checklist:**
- [ ] Each participant used different hardware/software
- [ ] No single participant has knowledge of all toxic waste
- [ ] At least one honest participant ensures security
- [ ] Full ceremony transcript is published and verifiable
- [ ] Final parameters verified independently by multiple parties

### 3.5 Circuit Testing Framework

- Create automated testing framework for circuits:
  ```
  /scripts/circuit_bench.ts
  ```
- Implement metrics collection for:
  - Constraint count per circuit
  - Witness size
  - Proof generation time
  - Verification time
  - Gas cost estimation
- Build regression testing harness to catch performance degradation
- Create circuit validation test suite for:
  - Edge case inputs
  - Boundary conditions
  - Invalid inputs
  - Expired proofs
  - Revoked attestations

### 3.6 Circuit Schema Manifest

- Create JSON schema for circuit definitions:
  ```
  /schemas/circuit_manifest.json
  ```
- Implement manifest generation during circuit compilation
- Build versioning system for circuits with proper backward compatibility
- Create circuit documentation generator from manifest
- Add public circuit manifest registry endpoint (`/api/zk/circuits`)

### 3.7 Circuit Version Management

- Implement comprehensive circuit version management:
  - Create version mismatch detection logic in proof generation endpoints
  - Build version compatibility checker based on manifest metadata
  - Implement version migration utilities for existing proofs
  - Create clear error responses for version mismatch situations
  - Add user-facing version mismatch notifications with upgrade paths
  - Create circuit version dashboard for administrators

### 3.8 WASM Performance Optimization

- Implement adaptive WASM execution strategy:
  - Create device capability detection for resource-constrained environments
  - Build client-side metrics collection for proof generation performance
  - Implement server-side fallback for proof generation
  - Create seamless UX for handling WASM failures or timeouts
  - Add background thread execution for non-blocking proof generation
  - Implement graceful degradation for mobile and low-power devices

### 3.9 Metadata Provenance in ZK Proofs

- Include metadata field hash inside ZK proof as a commitment:
  - Generate cryptographic hash of the metadata fields
  - Add metadata hash as a public input to ZK circuits
  - Create circuit components for hash verification
  - Implement proofs that verify the decrypted metadata matches the committed hash
  - Update existing circuits to include metadata hash verification
  - Build metadata provenance verification service
  - Create UI components to display provenance verification status
  - Implement API endpoints for metadata provenance verification
  - Add documentation for integrating metadata provenance in third-party verifiers

### Deliverables:
- Enhanced balance verification circuits
- Blacklist verification circuits
- KYC attestation verification
- Composite proof generation system
- Updated circuit compilation and key generation scripts
- Circuit testing framework
- Circuit schema manifest system
- Trusted setup protocol and artifacts
- Circuit version management system
- Adaptive WASM execution strategy
- Metadata provenance verification system

## Phase 4: Institutional Interface

**Duration: 2 weeks**

### 4.1 Heuristic Configuration UI

- Build template creation interface
- Implement rule builder with UI components
- Create template management dashboard
- Add template versioning and archiving

### 4.2 Form Generation System

- Create dynamic form generation based on templates
- Implement customizable branding options
- Build form preview functionality
- Add form analytics and tracking

### 4.3 Team Management

- Implement organization settings interface
- Build user role and permission management
- Create audit logging for administrative actions
- Implement invitation and user management

### 4.4 Consent Management UI

- Create detailed consent display component:
  ```
  /components/consent/ConsentDisplay.tsx
  ```
- Implement consent lifecycle management:
  - Clear consent presentation
  - Granular acceptance options
  - Revocation workflow
  - Consent history tracking
- Build consent management dashboard for users
- Create organization consent template editor

### Deliverables:
- Heuristic configuration UI
- Dynamic form generation system
- Team management interface
- Administrative dashboard
- Consent management system

## Phase 5: Reference Token System

**Duration: 2 weeks**

### 5.1 Token Generation

- Implement secure token generation service
- Create metadata encryption with proper key management
- Build on-chain anchoring (Polygon) for token references
- Implement token expiration and revocation mechanisms

#### Reference Token Structure

Implement secure token structure with the following components:
```typescript
interface ReferenceToken {
  id: string;                    // UUID for the token
  proofHash: string;             // Hash of the ZK proof
  templateId: string;            // ID of the heuristic template
  userPublicKey: string;         // Public key of the user
  organizationId: string;        // ID of the requesting organization
  createdAt: number;             // Unix timestamp of creation
  expiresAt: number;             // Unix timestamp of expiration
  nonce: string;                 // Random nonce for replay protection
  chainId: number;               // Chain ID where anchored
  version: number;               // Token format version
  metadata: EncryptedMetadata;   // Encrypted metadata
  metadataHash: string;          // Hash of unencrypted metadata (for ZK provenance)
  signature: string;             // Signature for token integrity
  signingKeyId: string;          // Reference to the signing key used
}

interface EncryptedMetadata {
  ciphertext: string;            // Encrypted metadata content
  iv: string;                    // Initialization vector
  authTag: string;               // Authentication tag
  keyId: string;                 // Reference to encryption key
}
```

#### On-Chain Anchoring Mechanism

Implement Polygon smart contract for token anchoring:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract ReferenceTokenRegistry {
    // Token batch structure
    struct TokenBatch {
        bytes32 merkleRoot;
        uint256 timestamp;
        uint256 count;
        address submitter;
    }
    
    // Mapping of batch IDs to batches
    mapping(bytes32 => TokenBatch) public batches;
    
    // Events
    event BatchAnchored(
        bytes32 indexed batchId,
        bytes32 merkleRoot,
        uint256 timestamp,
        uint256 count,
        address submitter
    );
    event TokenRevoked(
        bytes32 indexed tokenId,
        bytes32 indexed batchId,
        uint256 timestamp,
        address revoker
    );
    event SigningKeyRotated(
        bytes32 indexed newKeyHash,
        bytes32 indexed oldKeyHash,
        uint256 timestamp,
        address rotator
    );
    
    // Revocation mapping
    mapping(bytes32 => bool) public revokedTokens;
    
    // Signing key registry
    mapping(bytes32 => uint256) public signingKeys;
    bytes32[] public activeSigningKeys;
    
    // Register a new signing key
    function registerSigningKey(bytes32 keyHash) external {
        require(msg.sender == owner(), "Not authorized");
        
        // Add to active keys
        activeSigningKeys.push(keyHash);
        signingKeys[keyHash] = block.timestamp;
        
        emit SigningKeyRotated(
            keyHash,
            activeSigningKeys.length > 1 ? activeSigningKeys[activeSigningKeys.length - 2] : bytes32(0),
            block.timestamp,
            msg.sender
        );
    }
    
    // Verify if a signing key is valid
    function isValidSigningKey(bytes32 keyHash) external view returns (bool) {
        return signingKeys[keyHash] > 0;
    }
    
    // Anchor a batch of tokens
    function anchorBatch(
        bytes32 batchId,
        bytes32 merkleRoot,
        uint256 count
    ) external {
        require(batches[batchId].timestamp == 0, "Batch already exists");
        
        batches[batchId] = TokenBatch({
            merkleRoot: merkleRoot,
            timestamp: block.timestamp,
            count: count,
            submitter: msg.sender
        });
        
        emit BatchAnchored(
            batchId,
            merkleRoot,
            block.timestamp,
            count,
            msg.sender
        );
    }
    
    // Verify token inclusion in batch
    function verifyToken(
        bytes32 batchId,
        bytes32 tokenId,
        bytes32[] calldata proof
    ) external view returns (bool) {
        // Check if token is revoked
        if (revokedTokens[tokenId]) {
            return false;
        }
        
        TokenBatch storage batch = batches[batchId];
        require(batch.timestamp > 0, "Batch does not exist");
        
        // Verify Merkle proof
        bytes32 leaf = keccak256(abi.encodePacked(tokenId));
        bytes32 currentHash = leaf;
        
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            
            if (currentHash < proofElement) {
                currentHash = keccak256(abi.encodePacked(currentHash, proofElement));
            } else {
                currentHash = keccak256(abi.encodePacked(proofElement, currentHash));
            }
        }
        
        return currentHash == batch.merkleRoot;
    }
    
    // Revoke a token
    function revokeToken(bytes32 tokenId, bytes32 batchId) external {
        TokenBatch storage batch = batches[batchId];
        require(batch.timestamp > 0, "Batch does not exist");
        
        // Only batch submitter can revoke
        require(msg.sender == batch.submitter, "Not authorized");
        
        revokedTokens[tokenId] = true;
        
        emit TokenRevoked(
            tokenId,
            batchId,
            block.timestamp,
            msg.sender
        );
    }
}
```

#### 🔴 HUMAN REQUIRED: Smart Contract Deployment

**Description:** The on-chain anchoring system requires a smart contract deployed to Polygon. This process requires human intervention for security and proper deployment.

**Required Actions:**
1. **Contract Deployment Preparation**
   - Review final smart contract code
   - Set up MetaMask or other wallet with the deployer account
   - Fund deployer account with sufficient MATIC for deployment
   - Configure deployment environment for Polygon Amoy testnet

2. **Contract Deployment**
   - Deploy ReferenceTokenRegistry contract to Polygon Amoy testnet
   - Verify contract code on Polygonscan
   - Test contract functions with sample data
   - Document deployed contract address

3. **Service Wallet Setup**
   - Create dedicated service wallet for contract interactions
   - Fund service wallet with MATIC for gas fees
   - Securely store wallet credentials
   - Grant appropriate permissions to service wallet

**Handoff Instructions:**
- Provide deployed contract address
- Document contract ABI
- Share service wallet public address (keep private key secure)
- Verify contract is correctly functioning on testnet

**Deployment Verification Checklist:**
- [ ] Contract successfully deployed to Polygon Amoy testnet
- [ ] Contract verified on Polygonscan
- [ ] All functions tested and working correctly
- [ ] Service wallet has sufficient MATIC for operations
- [ ] Contract address documented in configuration
```

### 5.2 Verification Interface

- Build token lookup and verification UI
- Create detailed verification result display
- Implement verification history and audit log
- Add verification status updates and notifications

### 5.3 API Access

- Create token verification API endpoints
- Implement programmatic access controls
- Build webhook notifications for verification events
- Add rate limiting and access monitoring

### 5.4 Proof Replayer Tool

- Create CLI tool for proof replay and debugging:
  ```
  /tools/proof-replayer.ts
  ```
- Implement web interface for proof analysis
- Build witness storage and retrieval system
- Create proof comparison functionality for debugging

### 5.5 External Circuit Consumer Support

- Create API endpoint for accessing circuit manifests:
  ```
  GET /api/zk/circuits - List all public circuit definitions
  GET /api/zk/circuits/:id - Get specific circuit definition
  GET /api/zk/circuits/:id/versions - List all versions of a circuit
  GET /api/zk/circuits/:id/versions/:version - Get specific circuit version
  ```
- Implement structured circuit export format for external verifiers
- Create circuit verification guide for third-party consumers
- Add examples for verification in multiple languages
- Build proof verification toolkit for external consumers

### Deliverables:
- Reference token generation system with cryptographic integrity
- Polygon smart contract for token anchoring
- Token verification interface with anti-replay protection
- API access for verification
- Token management system
- Proof replayer tool
- External circuit consumer support

## Phase 6: Integration and Testing

**Duration: 3 weeks**

### 6.1 End-to-End Testing

- Create comprehensive test suite for full verification flow
- Implement integration tests for all components
- Build performance testing for proof generation
- Create security testing plan and execution

#### ZK-Specific Test Cases

Implement specialized test suites for ZK components:
- Circuit constraint validation tests
- Proof generation performance tests
- Verification gas usage tests
- Circuit version compatibility tests
- Input boundary condition tests
- Invalid input handling tests
- Expired/revoked proof tests

#### Cross-Chain Test Harness

Build automated test system for multi-chain support:
- EVM chain signature and verification tests
- Solana program verification tests
- Bitcoin xPub derivation and validation tests
- Cross-chain asset aggregation tests
- Chain-specific error handling tests

#### Device Compatibility Testing

Create comprehensive device compatibility test suite:
- Low-end mobile device testing (2GB RAM or less)
- Browser-specific WASM performance testing
- Proof generation timeout handling
- Server-side fallback verification
- Degraded-mode operation testing
- Battery impact assessment

### 6.2 User Acceptance Testing

- Conduct UAT for consumer flow
- Perform UAT for institutional dashboard
- Test reference token verification process
- Validate multi-chain support

### 6.3 Security Audit

- Conduct thorough security audit
- Perform penetration testing
- Review authentication and authorization mechanisms
- Validate ZK proof security

### 6.4 🔴 HUMAN REQUIRED: External Security Review

**Description:** A thorough external security review is essential for a financial-grade application. This requires coordination with security professionals and cannot be automated.

**Required Actions:**
1. **Security Audit Coordination**
   - Select and engage qualified security auditors with ZK expertise
   - Provide auditors with complete codebase access
   - Establish communication channels with audit team
   - Set clear scope and timeline for the audit

2. **Audit Finding Review**
   - Review security findings from external audit
   - Prioritize issues based on severity and impact
   - Make final decisions on addressing critical vulnerabilities
   - Approve remediation plan for identified issues

3. **Remediation Verification**
   - Verify that all critical issues have been properly addressed
   - Conduct follow-up review with auditors if necessary
   - Sign off on final security posture
   - Publish audit results and remediation summary

**Handoff Instructions:**
- Provide codebase access to auditors through secure channels
- Document all known security considerations
- Identify high-value components requiring special scrutiny
- Share all existing security documentation

**Security Audit Checklist:**
- [ ] External audit team engaged and briefed
- [ ] Full codebase review completed
- [ ] Smart contract code audited
- [ ] ZK circuits and cryptography reviewed
- [ ] Critical vulnerabilities addressed
- [ ] Final security report received and reviewed

### 6.5 Documentation

- Create comprehensive API documentation
- Build user guides for both consumer and institutional interfaces
- Develop integration guides for third parties
- Create maintenance and operations documentation

### Deliverables:
- Comprehensive test suite with ZK-specific tests
- Cross-chain test harness
- Device compatibility test results
- UAT reports
- Security audit report
- Documentation package

## Phase 7: GCP Deployment

**Duration: 2 weeks**

### 7.1 GCP Infrastructure Setup

- Review existing GCP integration in the codebase (see `docs/EXISTING-GCP-INTEGRATION.md` and `docs/GCP-INTEGRATION.md`)
- Enhance current GCP project configuration for production needs
- Set up separate environments (development, staging, production)
- Configure Cloud Storage buckets for different circuit types and environments
- Set up Secret Manager for sensitive keys and credentials
- Implement Cloud IAM policies with principle of least privilege
- Set up Cloud Monitoring and Logging for application telemetry
- Configure network security and VPC setup

### 7.2 Continuous Integration/Continuous Deployment

- Implement CI/CD pipeline for automated testing and deployment
- Set up Cloud Build for automated building and testing
- Configure deployment to Cloud Run for serverless container execution
- Implement separate deployment tracks for frontend and backend
- Set up environment-specific configuration management
- Create build validation tests to run pre-deployment
- Implement rollback mechanisms for failed deployments
- Set up blue/green deployment strategy for zero-downtime updates

### 7.3 ZK Proof File Management

- Enhance existing ZKey storage manager for production scalability
- Implement secure key rotation mechanisms for storage access
- Set up automated backup and disaster recovery for proof files
- Create deployment scripts for circuit updates
- Configure secure transfer mechanism for trusted setup files
- Implement access audit logging for proof file access
- Set up geographic redundancy for proof file storage
- Create maintenance procedures for circuit updates

### 7.4 Production Security Hardening

- Conduct security review of GCP configuration
- Implement VPC Service Controls for resource isolation
- Set up Cloud Armor for DDoS protection
- Configure Web Application Firewall for API endpoints
- Implement IP allowlisting for admin interfaces
- Set up automated vulnerability scanning
- Create security incident response procedures
- Implement secrets rotation policy

### 7.5 Performance Optimization

- Set up Cloud CDN for static assets
- Configure autoscaling policies for backend services
- Implement load testing to determine optimal instance sizing
- Set up database connection pooling and optimization
- Configure caching strategies for frequently accessed data
- Implement rate limiting for public APIs
- Optimize proof generation and verification processes
- Set up performance monitoring and alerting

### 7.6 Production Readiness

- Create runbooks for common operational tasks
- Set up monitoring dashboards for key metrics
- Implement alerting for critical service issues
- Configure automated backup systems
- Create disaster recovery procedures
- Implement production readiness checklist
- Conduct load and stress testing on production infrastructure
- Document production deployment process

### 7.7 🔴 HUMAN REQUIRED: Production Deployment Authorization

**Description:** The final production deployment requires human authorization and oversight to ensure all security, compliance, and infrastructure requirements are met.

**Required Actions:**
1. **Pre-Deployment Review**
   - Review production readiness report
   - Verify all security audit findings have been addressed
   - Confirm infrastructure spending and resource allocation
   - Validate that all regulatory requirements are satisfied
   - Review disaster recovery and incident response procedures

2. **Domain and TLS Configuration**
   - Configure production domain DNS settings
   - Obtain and install TLS certificates
   - Verify HTTPS-only access with proper security headers
   - Configure content delivery network if applicable
   - Set up domain monitoring

3. **Production Deployment Authorization**
   - Approve final production deployment
   - Authorize infrastructure spending
   - Sign off on security posture
   - Set maintenance window expectations
   - Establish communication plan for launch

4. **Post-Deployment Verification**
   - Verify all services are operational in production
   - Confirm monitoring systems are properly alerting
   - Test critical user flows in production environment
   - Verify data integrity and security controls
   - Approve production status

**Handoff Instructions:**
- Document all production environment details
- Provide emergency contact procedures
- Establish regular maintenance schedule
- Create post-launch monitoring plan

**Production Deployment Checklist:**
- [ ] All critical and high-severity security issues addressed
- [ ] Load testing completed with acceptable results
- [ ] Backup and disaster recovery tested
- [ ] Monitoring and alerting verified
- [ ] Domain and TLS certificates properly configured
- [ ] Legal and compliance requirements satisfied
- [ ] Incident response plan documented and tested

### Deliverables:
- Production-ready GCP environment
- CI/CD pipeline for automated deployments
- Secure ZK proof file management system
- Hardened security configuration
- Performance-optimized infrastructure
- Production monitoring and maintenance documentation
- Deployment runbooks and procedures

## Technology Stack

### Frontend
- React/Next.js (existing)
- Tailwind CSS for UI components
- React Query for data fetching
- Redux or Context API for state management

### Backend
- Node.js/Express (existing)
- PostgreSQL for relational data
- Redis for caching and rate limiting
- JWT for authentication

### ZK Stack
- Circom for circuit definition
- SnarkJS for proof generation/verification
- WASM for browser-based proof generation
- Polygon for on-chain anchoring

### Infrastructure
- Google Cloud Platform (existing)
- Docker for containerization
- CI/CD pipeline
- Monitoring and logging services

## Database Schema Updates

```sql
-- Organizations Table
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  subscription_tier VARCHAR(50) NOT NULL DEFAULT 'free',
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Organization API Keys
CREATE TABLE organization_api_keys (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  key_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- User Roles
CREATE TABLE user_roles (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  user_id UUID REFERENCES users(id),
  role VARCHAR(50) NOT NULL, -- 'admin', 'manager', 'verifier'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Heuristic Templates
CREATE TABLE heuristic_templates (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  version INT NOT NULL DEFAULT 1
);

-- Template Components
CREATE TABLE template_components (
  id UUID PRIMARY KEY,
  template_id UUID REFERENCES heuristic_templates(id),
  component_type VARCHAR(50) NOT NULL, -- 'threshold', 'maximum', 'standard', 'blacklist', 'kyc'
  parameters JSONB NOT NULL,
  required BOOLEAN NOT NULL DEFAULT TRUE,
  order_index INT NOT NULL
);

-- Consent Requirements
CREATE TABLE consent_requirements (
  id UUID PRIMARY KEY,
  template_id UUID REFERENCES heuristic_templates(id),
  consent_type VARCHAR(50) NOT NULL, -- 'ownership', 'history', 'future'
  description TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT TRUE,
  duration_days INT -- For time-bound consents
);

-- User Consents
CREATE TABLE user_consents (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  consent_requirement_id UUID REFERENCES consent_requirements(id),
  is_granted BOOLEAN NOT NULL DEFAULT FALSE,
  granted_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  revocation_reason TEXT,
  ip_address VARCHAR(50),
  user_agent TEXT
);

-- Signing Keys
CREATE TABLE signing_keys (
  id UUID PRIMARY KEY,
  key_hash VARCHAR(255) NOT NULL,
  public_key TEXT NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMP WITH TIME ZONE,
  deactivated_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  transaction_hash VARCHAR(255), -- On-chain registration reference
  metadata JSONB
);

-- Circuit Versions
CREATE TABLE circuit_versions (
  id UUID PRIMARY KEY,
  circuit_type VARCHAR(50) NOT NULL, -- 'standard', 'threshold', 'maximum', 'blacklist', 'kyc'
  version VARCHAR(20) NOT NULL,
  description TEXT,
  constraint_count INT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMP WITH TIME ZONE,
  deactivated_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  manifest JSONB NOT NULL, -- Schema definition
  zkey_hash VARCHAR(255) NOT NULL, -- Hash of proving key
  vkey_hash VARCHAR(255) NOT NULL, -- Hash of verification key
  trusted_setup_id UUID, -- Reference to trusted setup ceremony
  compatible_with JSONB -- List of compatible versions
);

-- Trusted Setup Ceremonies
CREATE TABLE trusted_setup_ceremonies (
  id UUID PRIMARY KEY,
  circuit_version_id UUID REFERENCES circuit_versions(id),
  status VARCHAR(50) NOT NULL, -- 'pending', 'in_progress', 'completed', 'failed'
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  participant_count INT NOT NULL DEFAULT 0,
  final_zkey_hash VARCHAR(255),
  final_vkey_hash VARCHAR(255),
  coordinator_id UUID REFERENCES users(id),
  description TEXT,
  metadata JSONB
);

-- Trusted Setup Contributions
CREATE TABLE trusted_setup_contributions (
  id UUID PRIMARY KEY,
  ceremony_id UUID REFERENCES trusted_setup_ceremonies(id),
  participant_id UUID,
  contribution_index INT NOT NULL,
  contribution_hash VARCHAR(255) NOT NULL,
  contributed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMP WITH TIME ZONE,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verification_result JSONB,
  metadata JSONB
);

-- Reference Tokens
CREATE TABLE reference_tokens (
  id UUID PRIMARY KEY,
  token VARCHAR(100) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id),
  template_id UUID REFERENCES heuristic_templates(id),
  organization_id UUID REFERENCES organizations(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  revocation_reason TEXT,
  metadata_encryption_key_id VARCHAR(255), -- Reference to encrypted key
  metadata_hash VARCHAR(255) NOT NULL, -- Hash of unencrypted metadata for ZK provenance
  transaction_hash VARCHAR(255), -- On-chain reference
  merkle_root VARCHAR(255), -- Merkle root for verification
  merkle_proof JSONB, -- Merkle proof for this token
  batch_id VARCHAR(100), -- Batch ID for anchoring
  nonce VARCHAR(100) NOT NULL, -- Replay protection
  proof_hash VARCHAR(255) NOT NULL, -- Hash of the ZK proof
  signing_key_id UUID REFERENCES signing_keys(id), -- Key used to sign token
  verification_status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'verified', 'failed'
  verification_result JSONB
);

-- Device Capabilities
CREATE TABLE device_capabilities (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  device_id VARCHAR(255) NOT NULL,
  user_agent TEXT,
  browser_type VARCHAR(100),
  browser_version VARCHAR(50),
  os_type VARCHAR(100),
  os_version VARCHAR(50),
  wasm_supported BOOLEAN,
  proof_generation_capable BOOLEAN,
  avg_proof_time_ms INT,
  avg_memory_usage_mb INT,
  last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metadata JSONB
);

-- Verifications
CREATE TABLE verifications (
  id UUID PRIMARY KEY,
  reference_token_id UUID REFERENCES reference_tokens(id),
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  verification_method VARCHAR(50) NOT NULL, -- 'ui', 'api'
  verification_result JSONB NOT NULL,
  ip_address VARCHAR(50),
  user_agent TEXT
);

-- Blacklists
CREATE TABLE blacklists (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Blacklisted Addresses
CREATE TABLE blacklisted_addresses (
  id UUID PRIMARY KEY,
  blacklist_id UUID REFERENCES blacklists(id),
  address VARCHAR(255) NOT NULL,
  chain_id INT NOT NULL,
  reason TEXT,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  added_by UUID REFERENCES users(id)
);

-- Audit Logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  event_type VARCHAR(100) NOT NULL,
  user_id UUID,
  organization_id UUID,
  resource_type VARCHAR(100),
  resource_id UUID,
  action VARCHAR(50) NOT NULL,
  details JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT,
  hash VARCHAR(255), -- Hash of previous log + this log for tamper evidence
  previous_hash VARCHAR(255) -- Hash of previous log entry
);
```

## API Endpoints

### Authentication Endpoints

- `POST /api/auth/wallet-login` - Wallet-based authentication
- `POST /api/auth/email-signup` - Email registration
- `POST /api/auth/email-login` - Email-based login
- `POST /api/auth/refresh-token` - Refresh JWT token
- `POST /api/auth/logout` - Logout and invalidate tokens
- `POST /api/auth/verify-email` - Email verification
- `POST /api/auth/request-password-reset` - Password reset request
- `POST /api/auth/reset-password` - Password reset execution

### Consumer Endpoints

- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile
- `GET /api/user/wallets` - List connected wallets
- `POST /api/user/wallets` - Connect new wallet
- `DELETE /api/user/wallets/:id` - Disconnect wallet
- `GET /api/user/proofs` - List user's proofs
- `POST /api/user/proofs` - Create new proof
- `GET /api/user/proofs/:id` - Get proof details
- `DELETE /api/user/proofs/:id` - Revoke a proof

### Consent Management Endpoints

- `GET /api/user/consents` - List user's active consents
- `POST /api/user/consents` - Grant new consent
- `GET /api/user/consents/:id` - Get consent details
- `DELETE /api/user/consents/:id` - Revoke consent
- `GET /api/templates/:id/consents` - Get consent requirements for template

### Institutional Endpoints

- `GET /api/org` - Get organization details
- `PUT /api/org` - Update organization details
- `GET /api/org/members` - List organization members
- `POST /api/org/members` - Invite new member
- `PUT /api/org/members/:id` - Update member role
- `DELETE /api/org/members/:id` - Remove member

- `GET /api/org/templates` - List heuristic templates
- `POST /api/org/templates` - Create new template
- `GET /api/org/templates/:id` - Get template details
- `PUT /api/org/templates/:id` - Update template
- `DELETE /api/org/templates/:id` - Archive template
- `GET /api/org/templates/:id/form-link` - Get shareable form link

- `GET /api/org/blacklists` - List blacklists
- `POST /api/org/blacklists` - Create new blacklist
- `PUT /api/org/blacklists/:id` - Update blacklist
- `POST /api/org/blacklists/:id/addresses` - Add addresses to blacklist
- `DELETE /api/org/blacklists/:id/addresses/:addressId` - Remove address

### Reference Token Endpoints

- `GET /api/verify/:token` - Verify reference token
- `POST /api/verify/:token/details` - Get verification details (with auth)
- `GET /api/verify/:token/metadata-provenance` - Verify metadata hash against ZK proof commitment
- `POST /api/tokens` - Programmatically create verification request
- `GET /api/tokens/:id/status` - Check verification status
- `POST /api/tokens/:id/revoke` - Revoke token
- `GET /api/tokens/:id/on-chain-status` - Check token status on Polygon

### ZK Proof Endpoints

- `POST /api/zk/generateProof` - Generate proof
- `POST /api/zk/verify` - Verify proof
- `POST /api/zk/templates/:id/generate` - Generate from template
- `GET /api/zk/circuits` - List available circuit definitions
- `GET /api/zk/circuits/:id` - Get specific circuit definition
- `GET /api/zk/circuits/:id/versions` - List all versions of a circuit
- `GET /api/zk/circuits/:id/versions/:version` - Get specific circuit version

### Key Management Endpoints

- `GET /api/admin/keys` - List all signing keys (admin only)
- `POST /api/admin/keys` - Create new signing key (admin only)
- `PUT /api/admin/keys/:id/activate` - Activate signing key (admin only)
- `PUT /api/admin/keys/:id/deactivate` - Deactivate signing key (admin only)
- `GET /api/admin/keys/:id/usage` - Get key usage statistics (admin only)

### Device Capability Endpoints

- `POST /api/device/capabilities` - Register device capabilities
- `GET /api/device/capabilities` - Get current device capabilities
- `GET /api/admin/device-stats` - Get device capability statistics (admin only)

### Audit Log Endpoints

- `GET /api/org/audit-logs` - Get organization audit logs
- `GET /api/user/audit-logs` - Get user audit logs
- `POST /api/org/audit-logs/export` - Export organization logs
- `GET /api/system/audit-logs` - Get system logs (admin only)

## Circuit Schema Manifest

The circuit schema manifest provides a structured way to define, version, and validate ZK circuits:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "CircuitManifest",
  "type": "object",
  "required": ["name", "version", "description", "inputs", "outputs", "constraints"],
  "properties": {
    "name": {
      "type": "string",
      "description": "Circuit identifier"
    },
    "version": {
      "type": "string",
      "description": "Semantic version of the circuit"
    },
    "description": {
      "type": "string",
      "description": "Human-readable description"
    },
    "inputs": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "type", "visibility"],
        "properties": {
          "name": { "type": "string" },
          "type": { "type": "string", "enum": ["field", "u8", "u16", "u32", "u64", "bool", "array"] },
          "visibility": { "type": "string", "enum": ["public", "private"] },
          "description": { "type": "string" },
          "arrayType": {
            "type": "object",
            "properties": {
              "elementType": { "type": "string" },
              "length": { "type": "integer" }
            }
          }
        }
      }
    },
    "outputs": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "type"],
        "properties": {
          "name": { "type": "string" },
          "type": { "type": "string" },
          "description": { "type": "string" }
        }
      }
    },
    "constraints": {
      "type": "object",
      "properties": {
        "count": { "type": "integer" },
        "maxConstraintComplexity": { "type": "integer" }
      }
    },
    "metadata": {
      "type": "object",
      "properties": {
        "compatibleWith": { 
          "type": "array",
          "items": { "type": "string" }
        },
        "generatedAt": { "type": "string", "format": "date-time" },
        "compiler": { "type": "string" },
        "estimatedGas": { "type": "integer" },
        "averageProofTime": { "type": "number" },
        "trustedSetupId": { "type": "string" },
        "zkeyHash": { "type": "string" },
        "vkeyHash": { "type": "string" }
      }
    }
  }
}
```

Example manifest for a threshold verification circuit:

```json
{
  "name": "thresholdProof",
  "version": "1.0.0",
  "description": "Verifies that a wallet balance meets or exceeds a specified threshold",
  "inputs": [
    {
      "name": "totalBalance",
      "type": "field",
      "visibility": "private",
      "description": "Total balance across all wallets"
    },
    {
      "name": "threshold",
      "type": "field",
      "visibility": "public",
      "description": "Minimum required balance"
    },
    {
      "name": "userAddress",
      "type": "field",
      "visibility": "private",
      "description": "User's wallet address"
    },
    {
      "name": "networkId",
      "type": "field",
      "visibility": "public",
      "description": "Chain ID of the network"
    },
    {
      "name": "metadataHash",
      "type": "field",
      "visibility": "public",
      "description": "Hash of the unencrypted metadata for provenance verification"
    }
  ],
  "outputs": [
    {
      "name": "valid",
      "type": "bool",
      "description": "Whether the balance meets or exceeds the threshold"
    }
  ],
  "constraints": {
    "count": 2532,
    "maxConstraintComplexity": 8
  },
  "metadata": {
    "compatibleWith": ["1.0.0"],
    "generatedAt": "2023-05-28T12:34:56Z",
    "compiler": "circom 2.1.4",
    "estimatedGas": 120000,
    "averageProofTime": 1.25,
    "trustedSetupId": "b5e7a2d1-9c63-4b5a-8d7e-f8c9b6a5d4e3",
    "zkeyHash": "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    "vkeyHash": "3c9909afec25354d551dae21590bb26e38d53f2173b8d3dc3eee4c047e7ab1c1"
  }
}
```

## Reference Token Cryptography

The reference token system uses a combination of cryptographic techniques to ensure token security, integrity, and privacy:

### Token Generation Process

1. **Proof Generation**:
   - Generate ZK proof based on user inputs and template requirements
   - Calculate proof hash using SHA-256

2. **Metadata Encryption**:
   - Generate AES-256-GCM encryption key
   - Encrypt selective metadata based on consent:
     - Wallet addresses (if consented)
     - Transaction summary (if consented)
     - Balance snapshots (if consented)
   - Store encryption key securely in GCP Secret Manager

3. **Token Creation**:
   - Generate UUID for token
   - Create token structure with all required fields
   - Retrieve active signing key from database
   - Generate cryptographic signature over token data using signing key
   - Store token in database with signing key reference

4. **On-Chain Anchoring**:
   - Generate Merkle tree from token batch
   - Submit Merkle root to Polygon contract
   - Store transaction hash and Merkle proof with token

### Token Verification Process

1. **Token Lookup**:
   - Retrieve token by ID
   - Verify token hasn't expired
   - Verify token hasn't been revoked

2. **Cryptographic Verification**:
   - Retrieve signing key referenced by token
   - Verify key was active when token was created
   - Verify token signature using signing key
   - Check nonce hasn't been used before
   - Verify Merkle proof against on-chain root

3. **Proof Verification**:
   - Verify ZK proof is valid
   - Verify proof hash matches token's proofHash
   - Check all template requirements are satisfied

4. **Metadata Decryption**:
   - Retrieve encryption key from GCP Secret Manager
   - Decrypt metadata based on verification permissions
   - Apply redaction based on consent levels

5. **Metadata Provenance Verification**:
   - Calculate hash of decrypted metadata
   - Verify calculated hash matches the metadataHash stored in the token
   - Verify metadataHash matches the value committed in the ZK proof
   - Return provenance verification status to user
   - Include provenance verification in audit log

### Security Measures

- **Replay Protection**: Single-use nonces prevent token reuse
- **Expiration**: Time-bound validity prevents indefinite use
- **Revocation**: On-chain revocation list allows invalidating compromised tokens
- **Selective Disclosure**: Encrypted metadata with consent-based access
- **Tamper Resistance**: Cryptographic signatures and Merkle proofs ensure integrity
- **Privacy**: ZK proofs reveal only the verification result, not the underlying data
- **Key Rotation**: Signing keys can be rotated without invalidating existing tokens

## Audit Logging System

The audit logging system provides a secure, tamper-evident record of all security-relevant events:

### Log Entry Structure

```typescript
interface AuditLogEntry {
  id: string;                  // UUID for the log entry
  timestamp: number;           // Unix timestamp
  eventType: string;           // Type of event (e.g., 'auth.login', 'proof.generate')
  userId?: string;             // User who performed the action (if authenticated)
  organizationId?: string;     // Organization context (if applicable)
  resourceType?: string;       // Type of resource affected (e.g., 'token', 'proof')
  resourceId?: string;         // ID of the resource affected
  action: string;              // Action performed (e.g., 'create', 'verify', 'revoke')
  details: any;                // Event-specific details (sanitized)
  ipAddress?: string;          // IP address of the actor
  userAgent?: string;          // User agent of the actor
  hash: string;                // Hash of this log entry
  previousHash?: string;       // Hash of the previous log entry (for chain integrity)
}
```

### Logging Implementation

The audit logging system will be implemented as a secure, append-only service:

1. **Log Creation**:
   - Generate log entry with all relevant fields
   - Sanitize sensitive data from details
   - Calculate hash of entry combined with previous hash
   - Store log entry in database with hash chain

2. **Log Storage**:
   - Store logs in PostgreSQL with appropriate indexes
   - Implement log rotation and archiving policies
   - Create encrypted backup mechanism

3. **Log Access**:
   - Provide organization-specific log access
   - Implement proper access controls
   - Create exportable log formats (CSV, JSON)

4. **Tamper Evidence**:
   - Use hash chaining to detect log tampering
   - Periodically anchor log hash to blockchain
   - Implement log integrity verification

### Events to Log

- **Authentication Events**:
  - Login attempts (success/failure)
  - Token refresh
  - Password reset
  - Email verification

- **Proof Events**:
  - Proof generation
  - Proof verification
  - Template creation/modification
  - Consent grants/revocations

- **Token Events**:
  - Token creation
  - Token verification
  - Token revocation
  - On-chain anchoring

- **Administrative Events**:
  - Organization creation
  - User role changes
  - API key creation/revocation
  - Blacklist modifications
  - Key rotation events

## Key Management System

The key management system provides secure handling of cryptographic keys throughout their lifecycle:

### Signing Key Lifecycle

1. **Key Generation**:
   - Generate new key pair (private/public) using secure random source
   - Store private key in secure storage (GCP Secret Manager)
   - Store public key and metadata in database
   - Record key creation in audit log

2. **Key Activation**:
   - Set key status to active in database
   - Register key hash on-chain for external verification
   - Update key activation timestamp
   - Record activation in audit log

3. **Key Usage**:
   - Retrieve active key for signing operations
   - Track key usage statistics
   - Monitor for abnormal usage patterns
   - Record usage in audit log

4. **Key Rotation**:
   - Generate new key pair
   - Set new key as active
   - Mark old key as inactive
   - Register key rotation on-chain
   - Record rotation in audit log

5. **Key Deactivation**:
   - Set key status to inactive
   - Update key deactivation timestamp
   - Record deactivation in audit log

### Key Usage Security

- **Principle of Least Privilege**: Keys are only accessible to services that require them
- **Key Isolation**: Different key types are isolated from each other
- **Usage Monitoring**: Key usage is monitored for anomalies
- **Regular Rotation**: Keys are rotated on a schedule
- **Revocation**: Compromised keys can be immediately revoked

### Key Types

- **Token Signing Keys**: Used to sign reference tokens
- **API Authentication Keys**: Used for API authentication
- **Encryption Keys**: Used for metadata encryption
- **Backup Keys**: Used for encrypted backups

## Circuit Upgrade Protocol

The circuit upgrade protocol ensures smooth transitions between circuit versions:

### Circuit Versioning

1. **Version Naming**:
   - Use semantic versioning (MAJOR.MINOR.PATCH)
   - Major version changes for breaking changes
   - Minor version changes for backward-compatible additions
   - Patch version changes for bug fixes

2. **Compatibility Matrix**:
   - Define compatibility between versions
   - Specify migration paths for proofs
   - Document breaking changes

### Upgrade Process

1. **Development Phase**:
   - Create new circuit version
   - Conduct trusted setup ceremony
   - Generate and validate proving/verification keys
   - Create comprehensive test suite

2. **Testing Phase**:
   - Test new circuit with both valid and invalid inputs
   - Verify compatibility with existing proofs
   - Benchmark performance against previous version
   - Validate gas costs for verification

3. **Deployment Phase**:
   - Add new circuit version to database
   - Update manifest registry
   - Deploy verification keys
   - Implement frontend version detection

4. **Activation Phase**:
   - Mark new version as active
   - Start accepting proofs with new version
   - Continue supporting older versions based on compatibility
   - Monitor for issues

### Version Mismatch Handling

1. **Detection**:
   - Identify circuit version mismatch during proof generation
   - Check compatibility between versions

2. **Response**:
   - Return structured error with detailed information
   - Suggest upgrade path if available
   - Provide migration assistance if needed

3. **User Experience**:
   - Display clear version mismatch notifications
   - Guide users through upgrade process
   - Allow fallback to compatible versions when possible

## Implementation Strategy

1. **Incremental Development**:
   - Maintain existing consumer functionality throughout development
   - Develop institutional features in parallel without disruption
   - Use feature flags to control rollout

2. **Backward Compatibility**:
   - Ensure all API changes are backward compatible
   - Maintain support for existing proof formats
   - Create migration paths for existing users

3. **Testing Strategy**:
   - Comprehensive unit tests for all new components
   - Integration tests for cross-component functionality
   - End-to-end tests for complete flows
   - Security-focused testing for authentication and ZK components
   - ZK-specific testing for circuit correctness and performance
   - Device compatibility testing for various hardware profiles

4. **Deployment Approach**:
   - Staged rollout of new features
   - Canary deployments for institutional features
   - Blue/green deployment for major updates
   - Automated rollback capability

## Conclusion

This implementation plan provides a structured approach to extending the Proof of Funds protocol to support both consumer-facing and institutional use cases. By carefully enhancing the existing architecture while adding new components, we can preserve the user experience for individual users while enabling powerful new capabilities for institutional clients.

The phased implementation approach ensures that we can deliver value incrementally while maintaining system stability and security. Each phase builds on the previous one, creating a complete platform that addresses both consumer and institutional needs.

## Implementation Progress

Please update this section with progress as implementation proceeds, following rule #9.

### Phase 1 Progress
*Not started*

### Phase 2 Progress
*Not started*

### Phase 3 Progress
*Not started*

### Phase 4 Progress
*Not started*

### Phase 5 Progress
*Not started*

### Phase 6 Progress
*Not started*

### Phase 7 Progress
*Not started*