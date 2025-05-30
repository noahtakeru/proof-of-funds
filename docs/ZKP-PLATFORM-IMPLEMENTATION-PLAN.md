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
18. Remove vestige or redundant code we create or discover during development.

## Overview

This document outlines the implementation plan for extending the Proof of Funds protocol to support both consumer-facing self-service proofs and institutional verification workflows. The implementation maintains the existing consumer UX while adding sophisticated institutional features for custom verification templates, reference tokens, and compliance needs.

## Executive Summary

This implementation plan follows an incremental approach with clear priorities:

1. **EVM-First Strategy**: Starting with Ethereum/Polygon support and adding other chains incrementally
2. **Simplified Database**: Beginning with core tables and evolving the schema as needed
3. **Leveraging Existing Infrastructure**: Using established Circom trusted setups initially
4. **Focus on Core Value**: Implementing balance verification first, then extending with advanced features
5. **Executable Phasing**: Delivering a functional system in 12-14 weeks with a clear path for enhancement

## Table of Contents

- [Project Phases](#project-phases)
- [Phase 0: Technical Foundation](#phase-0-technical-foundation)
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
- [Future Features](#future-features)

## Project Phases

The implementation will be divided into eight primary phases, starting with a foundation phase to establish core infrastructure, followed by seven feature implementation phases. Each phase has specific deliverables and dependencies, designed to be executable in sequence with minimal disruption to the existing consumer platform.

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
| Phase 0 | Database Access Credentials | Week 1, Day 1 | Critical - Required before any development can start |
| Phase 0 | Repository Access & Setup | Week 1, Day 1 | Critical - Required to configure project |
| Phase 1 | External Service Setup | Week 1-2 | Medium - Can start development but needed for full testing |
| Phase 1 | Smart Contract Deployment | Week 2-3 | Medium - Early deployment allows development against real contract |
| Phase 3 | Existing Trusted Setup Verification | Week 5-6 | Medium - Required for parameter validation |
| Phase 6 | External Security Review | Week 11-12 | Medium - Can develop while review occurs |
| Phase 7 | Production Deployment Authorization | Week 13-14 | Critical - Final step before launch |
| Future | KYC Provider Integration | Post-launch | Low - Only needed for KYC features |
| Future | Custom Trusted Setup Ceremony | Post-launch | Medium - Enhances security of existing implementation |

For each of these intervention points, the implementation plan includes detailed instructions on what is needed from human operators, allowing development to continue efficiently while awaiting these necessary human inputs.

## Phase 0: Technical Foundation (Week 1, Days 1-2)

### 0.1 🔴 HUMAN REQUIRED: Development Environment Setup

**Description:** Before any development can begin, core infrastructure and access must be provided. This is a critical blocking requirement.

**Required Actions:**
1. **Database Access Configuration**
   - Provide PostgreSQL connection string and credentials
   - Specify database name and schema
   - Create developer and test database users with appropriate permissions
   - Document connection pooling requirements
   - Provide access to any existing database dumps for development

2. **Repository Access Setup**
   - Provide access to repository branches
   - Configure development environment permissions
   - Share CI/CD pipeline configuration
   - Document branching and PR strategy

**Handoff Instructions:**
- Document environment variables in `.env.example`
- Provide connection credentials through secure channel
- Document any special database configuration requirements
- Share infrastructure diagrams if available

### 0.2 Database Infrastructure Setup

- Install and configure Prisma ORM
- Create packages/db/ directory structure
- Set up PostgreSQL connection configuration
- Create database initialization scripts
- Initialize migration system
- Configure connection pooling for optimal performance
- Set up database indexes for critical queries
- Create test data seeding utilities

#### Implementation Notes:
- Create `packages/db/prisma/schema.prisma` for ORM configuration
- Set up `packages/db/migrations/` directory for versioned migrations
- Configure database models based on schema definitions
- Implement proper error handling for database connections
- Create database management scripts in `packages/db/scripts/`

### 0.3 Backend Package Structure

- Create proper `packages/backend/` structure
- Set up Express/Next.js API foundation
- Configure database service layer
- Set up basic middleware for authentication and logging
- Implement error handling middleware
- Create API route structure
- Configure TypeScript types for database models
- Set up service layer for business logic

#### Implementation Notes:
- Organize by feature domain in `packages/backend/src/features/`
- Create shared utilities in `packages/backend/src/utils/`
- Set up centralized configuration in `packages/backend/src/config/`
- Implement database services in `packages/backend/src/db/`
- Create middleware in `packages/backend/src/middleware/`

### 0.4 Test Infrastructure

- Set up test database configuration
- Install testing utilities (Jest, Supertest, @testcontainers/postgresql)
- Create test data seeding utilities
- Configure test environment variables
- Set up unit test framework
- Create integration test structure
- Implement end-to-end test harness
- Configure CI/CD test pipeline

#### Implementation Notes:
- Set up Jest configuration in `packages/backend/jest.config.js`
- Create database test helpers in `packages/db/test/`
- Implement mock services for testing in `packages/backend/src/test/mocks/`
- Set up test database container configuration
- Create database seeding utilities for test data

### Deliverables:
- Configured ORM with database connection
- Backend package structure
- Test infrastructure
- Database migration system
- Environment configuration templates
- Database seed scripts for development

## Phase 1: Core Infrastructure Enhancement

**Duration: 2 weeks**

### 1.1 EVM Chain Support Enhancement

- Enhance existing wallet connection interface to fully support all EVM networks
- Optimize Ethereum/Polygon balance and transaction retrieval
- Create abstraction layer that can later be extended to other chains
- Build transaction normalization utilities with extensibility in mind

#### EVM Wallet Integration Enhancements

- Improve existing MetaMask/WalletConnect integration:
  - Add support for all major EVM networks (Ethereum, Polygon, Arbitrum, Optimism)
  - Enhance connection reliability and error handling
  - Implement proper chain switching and validation
- Develop network selection UI component with appropriate configuration
- Implement enhanced balance display component
- Build EVM-specific address validation utilities

#### Chain Adapter Foundation

- Create `ChainAdapter` interface designed for future extensibility:
  ```typescript
  interface ChainAdapter {
    getBalance(address: string): Promise<BigNumber>;
    getTransactions(address: string, options: { limit: number, offset: number }): Promise<Transaction[]>;
    validateAddress(address: string): boolean;
    signMessage(message: string): Promise<string>;
    getAddressFromSignature(message: string, signature: string): string;
  }
  ```
- Implement EVM adapter with comprehensive support:
  - `EVMChainAdapter`: Uses ethers.js for Ethereum/Polygon
- Create placeholder interfaces for future adapters:
  - (Future Phase) `SolanaChainAdapter`: For future Solana support
  - (Future Phase) `BitcoinChainAdapter`: For future Bitcoin support

#### Implementation Notes:
- Use existing wallet connection code in the codebase as a foundation
- Extend the existing `ProofOfFunds` contract integration but with additional network support
- Utilize ethers.js v5 for compatibility with existing codebase (based on deployment scripts)
- Deploy to `packages/frontend/utils/chains/` directory for chain adapters

### 1.2 Core Database Schema Implementation

- Focus on extending existing tables and preparing for later phases:
  - Enhance Organizations and user roles (minimal fields)
  - Extend basic templates (simplified schema)
  - Add essential fields to existing tables only
- Design schema for extensibility with future fields in mind, but do NOT implement advanced models yet

#### Implementation Notes:
- Use existing PostgreSQL database configuration (see `.env.example` for connection params)
- Create migrations using Prisma ORM for compatibility with existing structure
- Deploy migration files to `packages/db/migrations/` directory
- Update schema definitions in `packages/db/schema.prisma` with minimal changes
- Implement appropriate indexes for performance optimization

#### IMPORTANT: Phased Database Implementation Approach
- Follow strict incremental approach to database schema evolution
- Only implement models and fields needed for the current phase
- Defer complex tables and relationships to their designated phases:
  - Reference tokens and signing keys (Phase 5)
  - User consent tracking (Phase 4.4)
  - Circuit version management (Phase 3.7)
  - Organization API keys (Phase 4)
- This ensures the database grows with the application's needs and avoids premature complexity

#### Phase 1.2 Implementation Specifics
For this phase, ONLY:
1. Review the existing schema which already has:
   - User model
   - Wallet model
   - Organization model
   - OrganizationUser model (for user roles)
   - ProofTemplate model
   - Proof model
   - Verification model
   - Batch model
   - AuditLog model

2. Enhance these models with minimal additions if needed:
   - Add missing fields to Organization model (e.g., email if missing)
   - Extend ProofTemplate model with any essential fields
   - Add appropriate indexes for performance

3. Do NOT create or implement:
   - ReferenceToken model (Phase 5)
   - SigningKey model (Phase 5)
   - UserConsent model (Phase 4.4)
   - CircuitVersion model (Phase 3.7)
   - OrganizationApiKey model (Phase 4)

This phase is about enhancing what already exists, not adding entirely new models for future functionality.

### 1.3 Shared Backend Services

- Refactor proof generation service for enhanced circuit support
- Create transaction history processor
- Implement blacklist checking service
- Build extensible verification result formatter

#### Implementation Notes:
- Extend existing proof generation service in `packages/frontend/utils/zkProofHandler.js`
- Create new transaction processor in `packages/frontend/services/`
- Implement services with appropriate unit tests
- Follow existing error handling patterns using `@proof-of-funds/common/src/error-handling`

### 1.4 System-Wide Audit Logging

- Implement secure, append-only audit logging service
- Create structured log schema for all security-relevant events
- Build encrypted log storage mechanism in GCP
- Implement log rotation and retention policies
- Create organization-level log export functionality

#### Implementation Notes:
- Implement based on the audit logging design in `SECURITY-ASSESSMENT.md`
- Use similar patterns to the existing logging mechanisms in the codebase
- Store audit logs in PostgreSQL with appropriate indexes
- Implement GCP Cloud Storage backup mechanism
- Place implementation in `packages/common/src/logging/`

### 1.5 Smart Contract Development

- Create simple ReferenceTokenRegistry contract for on-chain anchoring
- Implement token batch submission and verification logic
- Add signing key management and token revocation capabilities
- Develop test suite for contract functionality validation

#### Implementation Notes:
- Create contract in `packages/contracts/contracts/ReferenceTokenRegistry.sol`
- Use existing `ProofOfFunds.sol` contract as reference for style and patterns
- Implement using Solidity 0.8.19 for consistency with existing contracts
- Leverage OpenZeppelin libraries for security primitives
- Create comprehensive test suite in `packages/contracts/test/`
- Use Hardhat for testing and deployment as per existing setup

### 1.6 🔴 HUMAN REQUIRED: External Service Setup

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

3. **Smart Contract Deployment**
   - Deploy ReferenceTokenRegistry contract to Polygon Amoy testnet
   - Verify contract code on Polygonscan
   - Test contract functions with sample data
   - Create dedicated service wallet for contract interactions
   - Document deployed contract address and ABI

**Handoff Instructions:**
- Provide all API keys and credentials through secure channel
- Document any rate limits or restrictions
- Share deployed contract address and configuration details
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

- Implement simple address-based blacklist checking
- Create efficient lookup mechanism for address verification
- Add basic validation logic for blacklist entries
- Design for future extensibility with minimal initial complexity

### 3.3 Proof Generation with Existing Setup

- Implement core verification logic for standard proofs
- Use existing Circom trusted setups for initial deployment
- Create verification key management system
- Design extensible system for future custom trusted setups

#### Leveraging Existing Trusted Setup

- Use established Powers of Tau ceremonies for initial implementation:
  - Adopt existing Phase 2 setup from the Circom ecosystem
  - Document provenance of chosen parameters
  - Implement verification key management
  - Store trusted setup parameters securely in GCP
  - Create documentation for transparency

- Trusted Setup Storage (for Future Custom Ceremony):
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

#### 🔴 HUMAN REQUIRED: Future Trusted Setup Planning

**Description:** While we'll use existing setups initially, planning for a future custom ceremony is important for long-term security.

**Required Actions:**
1. **Evaluation of Existing Setups**
   - Identify existing Powers of Tau phase 1 ceremony to leverage
   - Document security properties and participation level
   - Determine appropriateness for production use

2. **Documentation and Transparency**
   - Document the provenance of the parameters being used
   - Create transparency report for users explaining the security
   - Plan for future ceremony enhancement

3. **Future Custom Ceremony Planning (Post-Launch)**
   - Create design document for future custom ceremony
   - Identify potential participants for post-launch ceremony
   - Establish security requirements for future ceremony

**Handoff Instructions:**
- Provide links to existing ceremony documentation
- Document hash verification procedures
- Create plan for future upgrade path

**Setup Security Checklist:**
- [ ] Existing parameters thoroughly vetted
- [ ] Security properties documented
- [ ] Verification process established
- [ ] Secure storage implemented
- [ ] Future upgrade path defined

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

> **IMPORTANT**: This feature should only be implemented during Phase 3. Do not create circuit version models, database tables, or related functionality prematurely during earlier phases.

- Implement comprehensive circuit version management:
  - Create version mismatch detection logic in proof generation endpoints
  - Build version compatibility checker based on manifest metadata
  - Implement version migration utilities for existing proofs
  - Create clear error responses for version mismatch situations
  - Add user-facing version mismatch notifications with upgrade paths
  - Create circuit version dashboard for administrators
  - Add database tables for circuit versions (not before this phase)

### 3.8 WASM Performance Optimization

- Implement adaptive WASM execution strategy:
  - Create device capability detection for resource-constrained environments
  - Build client-side metrics collection for proof generation performance
  - Implement server-side fallback for proof generation
  - Create seamless UX for handling WASM failures or timeouts
  - Add background thread execution for non-blocking proof generation
  - Implement graceful degradation for mobile and low-power devices

### 3.9 Secure Metadata Management

- Implement simple encrypted metadata system:
  - Generate cryptographic hash of metadata fields
  - Securely encrypt metadata with proper key management
  - Store metadata and hash separately for verification
  - Design system to be upgradable to full ZK provenance in future
  - Create documentation for metadata format and encryption

**Note:** Full ZK provenance with metadata hash inside the circuit will be implemented in a future phase after core functionality is validated.

### Deliverables:
- Enhanced balance verification circuits
- Basic blacklist verification
- Updated circuit compilation and key generation scripts
- Circuit testing framework
- Circuit schema manifest system
- Initial verification key management
- Adaptive WASM execution strategy
- Secure metadata encryption system

**Future Phase Deliverables:**
- Advanced blacklist verification with Merkle trees and transaction scanning
- KYC attestation verification
- Composite proof generation system
- Full metadata provenance in ZK circuits
- Custom trusted setup ceremony

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

### 4.4 Basic Consent Management

> **IMPORTANT**: This feature should only be implemented during Phase 4. Do not create user consent models, database tables, or related functionality prematurely during earlier phases.

- Create simple consent display component:
  ```
  /components/consent/ConsentDisplay.tsx
  ```
- Implement binary consent system:
  - Clear presentation of what user is consenting to
  - Simple accept/decline options
  - Basic revocation capability
- Implement consent storage in database (add user_consents table during this phase only)
- Design for future extensibility to more granular consent

### Deliverables:
- Heuristic configuration UI
- Dynamic form generation system
- Team management interface
- Administrative dashboard
- Consent management system

## Phase 5: Reference Token System

**Duration: 2 weeks**

> **IMPORTANT**: This phase should NOT be implemented until Phases 1-4 are complete. Do not create reference token models, database tables, or related functionality prematurely during earlier phases.

### 5.1 Token Generation

- Implement secure token generation service
- Create metadata encryption with proper key management
- Leverage previously deployed on-chain anchoring (Polygon) for token references
- Implement token expiration and revocation mechanisms
- Add database tables for reference tokens and signing keys (not before this phase)

#### Simplified Reference Token Structure

Implement streamlined token structure with essential components (only during Phase 5):
```typescript
interface ReferenceToken {
  id: string;                    // UUID for the token
  proofHash: string;             // Hash of the ZK proof
  templateId: string;            // ID of the template
  userPublicKey: string;         // Public key of the user
  organizationId: string;        // ID of the requesting organization
  createdAt: number;             // Unix timestamp of creation
  expiresAt: number;             // Unix timestamp of expiration
  nonce: string;                 // Random nonce for replay protection
  chainId: number;               // Chain ID where anchored
  metadata: EncryptedMetadata;   // Encrypted metadata
  metadataHash: string;          // Hash of metadata for verification
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

## Complete Database Schema

The database schema below represents the FINAL schema after ALL phases are complete. It is presented here for reference and planning purposes. The actual implementation will follow the phased approach described throughout this document.

```sql
-- NOTE: This is the COMPLETE schema - implementation should follow the phased approach
-- Each table should only be added in its designated phase, as outlined below

-- PHASE 1: CORE TABLES
-- These tables are part of the initial implementation in Phase 1.2

-- Organizations Table (Phase 1.2)
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- User Roles (Phase 1.2)
CREATE TABLE user_roles (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  user_id UUID REFERENCES users(id),
  role VARCHAR(50) NOT NULL, -- 'admin', 'verifier'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Basic Templates (Phase 1.2)
CREATE TABLE templates (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  parameters JSONB NOT NULL -- Simplified schema storing parameters directly
);

-- Audit Logs (Phase 1.2)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  event_type VARCHAR(100) NOT NULL,
  user_id UUID,
  resource_type VARCHAR(100),
  resource_id UUID,
  action VARCHAR(50) NOT NULL,
  details JSONB,
  ip_address VARCHAR(50)
);

-- PHASE 3: EXTENDED ZK CIRCUITS
-- These tables should only be added in Phase 3.7

-- Circuit Versions (Phase 3.7 - Circuit Version Management)
CREATE TABLE circuit_versions (
  id UUID PRIMARY KEY,
  circuit_type VARCHAR(50) NOT NULL, -- 'standard', 'threshold', 'maximum'
  version VARCHAR(20) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  manifest JSONB NOT NULL, -- Schema definition
  zkey_hash VARCHAR(255) NOT NULL, -- Hash of proving key
  vkey_hash VARCHAR(255) NOT NULL -- Hash of verification key
);

-- PHASE 4: INSTITUTIONAL INTERFACE
-- These tables should only be added in Phase 4.4 and related sub-phases

-- Organization API Keys (Phase 4)
CREATE TABLE organization_api_keys (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  key_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Simple Consents (Phase 4.4 - Basic Consent Management)
CREATE TABLE user_consents (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  template_id UUID REFERENCES templates(id),
  is_granted BOOLEAN NOT NULL DEFAULT FALSE,
  granted_at TIMESTAMP WITH TIME ZONE,
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  ip_address VARCHAR(50)
);

-- PHASE 5: REFERENCE TOKEN SYSTEM
-- These tables should only be added in Phase 5.1

-- Signing Keys (Phase 5.1 - Token Generation)
CREATE TABLE signing_keys (
  id UUID PRIMARY KEY,
  key_hash VARCHAR(255) NOT NULL,
  public_key TEXT NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT FALSE
);

-- Reference Tokens (Phase 5.1 - Token Generation)
CREATE TABLE reference_tokens (
  id UUID PRIMARY KEY,
  token VARCHAR(100) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id),
  template_id UUID REFERENCES templates(id),
  organization_id UUID REFERENCES organizations(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  metadata_encryption_key_id VARCHAR(255), -- Reference to encrypted key
  metadata_hash VARCHAR(255) NOT NULL, -- Hash of metadata for verification
  transaction_hash VARCHAR(255), -- On-chain reference
  nonce VARCHAR(100) NOT NULL, -- Replay protection
  proof_hash VARCHAR(255) NOT NULL, -- Hash of the ZK proof
  signing_key_id UUID REFERENCES signing_keys(id), -- Key used to sign token
  verification_status VARCHAR(50) NOT NULL DEFAULT 'pending'
);

-- Verifications (Phase 5.2 - Verification Interface)
CREATE TABLE verifications (
  id UUID PRIMARY KEY,
  reference_token_id UUID REFERENCES reference_tokens(id),
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  verification_method VARCHAR(50) NOT NULL, -- 'ui', 'api'
  verification_result JSONB NOT NULL
);

-- Additional tables will be added in future phases as needed
```

> **IMPORTANT IMPLEMENTATION NOTE**: 
> This schema represents the complete database structure that will be implemented incrementally across phases. When implementing each phase, only add the tables and fields needed for that specific phase, as indicated in the phase sections above. DO NOT implement tables from future phases prematurely.

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

## Future Features

The following features have been intentionally deferred to post-launch phases to streamline the initial implementation:

### Advanced Blacklist Verification
- Merkle tree-based blacklist verification for large datasets
- Transaction history scanning for tracking fund flows
- Address interaction graph components for relationship analysis
- Optimization for large blacklists using batching techniques

### KYC Attestation Integration
- Circuit components for external attestation verification
- Secure attestation signature checking
- Revocation checking for attestations
- Timestamp validity verification

#### 🔴 HUMAN REQUIRED: KYC Provider Integration
- KYC provider selection process
- Business agreement setup with selected providers
- API access configuration and credential management
- Compliance requirements documentation

### Custom Trusted Setup Ceremony
- Design and implementation of custom ceremony protocol
- Participant coordination and contribution verification
- Secure entropy generation process
- Publishing and verification of final keys

### Full Metadata Provenance
- Enhanced ZK circuits with direct metadata hash commitment
- Advanced selective disclosure mechanisms
- Cryptographic linking between proof and metadata
- Enhanced verification interfaces for detailed provenance checks

## Conclusion

This implementation plan provides a structured approach to extending the Proof of Funds protocol to support both consumer-facing and institutional use cases. By carefully enhancing the existing architecture while adding new components, we can preserve the user experience for individual users while enabling powerful new capabilities for institutional clients.

The phased implementation approach ensures that we can deliver value incrementally while maintaining system stability and security. Each phase builds on the previous one, creating a complete platform that addresses core needs immediately while enabling more advanced features in future releases.

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