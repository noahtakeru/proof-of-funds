// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title Reference Token Registry
 * @author Arbitr Team
 * @notice A smart contract that enables anchoring of reference tokens on-chain
 * using Merkle trees for efficient batch processing.
 * 
 * @dev This contract implements:
 * - Batch anchoring of reference tokens via Merkle roots
 * - Token verification against anchored Merkle roots
 * - Signing key management for token integrity
 * - Token revocation for invalidating tokens
 * - Circuit breaker pattern to pause the contract in emergencies
 * - Access control for administrative functions
 * - Reentrancy protection for all state-changing functions
 * 
 * @custom:security-contact security@arbitr.finance
 * @custom:version 1.0.0
 */
contract ReferenceTokenRegistry is Pausable, Ownable, ReentrancyGuard {
    /**
     * @dev Batch structure for storing Merkle roots and related data
     */
    struct TokenBatch {
        bytes32 merkleRoot;        // Merkle root of all tokens in the batch
        uint256 timestamp;         // When the batch was anchored
        uint256 proofCount;        // Number of proofs in the batch
        address submitter;         // Address that submitted the batch
        bool isRevoked;            // Whether the entire batch is revoked
    }
    
    /**
     * @dev Signing key structure for key management
     */
    struct SigningKey {
        uint256 activatedAt;       // When the key was activated
        bool isActive;             // Whether the key is currently active
        string description;        // Optional description for the key
    }
    
    // ====== Storage ======
    
    // Mapping from batch ID to batch data
    mapping(bytes32 => TokenBatch) public batches;
    
    // Mapping from token ID to revocation status
    mapping(bytes32 => bool) public revokedTokens;
    
    // Mapping from signing key hash to key data
    mapping(bytes32 => SigningKey) public signingKeys;
    
    // Array of all signing key hashes for enumeration
    bytes32[] public signingKeyHashes;
    
    // Contract version for tracking upgrades
    string public constant VERSION = "1.0.0";
    
    // ====== Events ======
    
    /**
     * @dev Emitted when a new batch is anchored
     */
    event BatchAnchored(
        bytes32 indexed batchId,
        bytes32 merkleRoot,
        uint256 timestamp,
        uint256 proofCount,
        address indexed submitter
    );
    
    /**
     * @dev Emitted when a token is revoked
     */
    event TokenRevoked(
        bytes32 indexed tokenId,
        bytes32 indexed batchId,
        uint256 timestamp,
        address indexed revoker
    );
    
    /**
     * @dev Emitted when a batch is revoked
     */
    event BatchRevoked(
        bytes32 indexed batchId,
        uint256 timestamp,
        address indexed revoker
    );
    
    /**
     * @dev Emitted when a signing key is registered
     */
    event SigningKeyRegistered(
        bytes32 indexed keyHash,
        uint256 timestamp,
        address indexed registrar,
        string description
    );
    
    /**
     * @dev Emitted when a signing key is rotated
     */
    event SigningKeyRotated(
        bytes32 indexed newKeyHash,
        bytes32 indexed oldKeyHash,
        uint256 timestamp,
        address indexed rotator
    );
    
    /**
     * @dev Emitted when a signing key is deactivated
     */
    event SigningKeyDeactivated(
        bytes32 indexed keyHash,
        uint256 timestamp,
        address indexed deactivator
    );
    
    // ====== Constructor ======
    
    /**
     * @dev Initializes the contract
     */
    constructor() {
        // Initialize contract state
        _pause(); // Start paused for safety
    }
    
    // ====== External/Public Functions ======
    
    /**
     * @notice Anchors a batch of reference tokens on-chain
     * @param batchId Unique identifier for the batch
     * @param merkleRoot Merkle root of all token IDs in the batch
     * @param proofCount Number of proofs in the batch
     */
    function anchorBatch(
        bytes32 batchId,
        bytes32 merkleRoot,
        uint256 proofCount
    ) external nonReentrant whenNotPaused {
        require(batchId != bytes32(0), "ReferenceTokenRegistry: batch ID cannot be zero");
        require(merkleRoot != bytes32(0), "ReferenceTokenRegistry: merkle root cannot be zero");
        require(proofCount > 0, "ReferenceTokenRegistry: proof count must be positive");
        require(batches[batchId].timestamp == 0, "ReferenceTokenRegistry: batch already exists");
        
        // Store the batch
        batches[batchId] = TokenBatch({
            merkleRoot: merkleRoot,
            timestamp: block.timestamp,
            proofCount: proofCount,
            submitter: msg.sender,
            isRevoked: false
        });
        
        // Emit event
        emit BatchAnchored(
            batchId,
            merkleRoot,
            block.timestamp,
            proofCount,
            msg.sender
        );
    }
    
    /**
     * @notice Verify if a token is part of a batch and not revoked
     * @param batchId Batch ID the token belongs to
     * @param tokenId Token ID to verify
     * @param merkleProof Merkle proof showing the token is part of the batch
     * @return True if the token is valid (part of the batch and not revoked)
     */
    function verifyToken(
        bytes32 batchId,
        bytes32 tokenId,
        bytes32[] calldata merkleProof
    ) external view returns (bool) {
        // Check batch exists and is not revoked
        TokenBatch storage batch = batches[batchId];
        if (batch.timestamp == 0 || batch.isRevoked) {
            return false;
        }
        
        // Check token is not individually revoked
        if (revokedTokens[tokenId]) {
            return false;
        }
        
        // Verify merkle proof
        bytes32 leaf = keccak256(abi.encodePacked(tokenId));
        return MerkleProof.verify(merkleProof, batch.merkleRoot, leaf);
    }
    
    /**
     * @notice Revoke a specific token
     * @param tokenId Token ID to revoke
     * @param batchId Batch ID the token belongs to
     */
    function revokeToken(bytes32 tokenId, bytes32 batchId) external nonReentrant whenNotPaused {
        TokenBatch storage batch = batches[batchId];
        require(batch.timestamp > 0, "ReferenceTokenRegistry: batch does not exist");
        require(!batch.isRevoked, "ReferenceTokenRegistry: batch is already revoked");
        
        // Only batch submitter or contract owner can revoke
        require(
            msg.sender == batch.submitter || msg.sender == owner(),
            "ReferenceTokenRegistry: not authorized"
        );
        
        // Mark token as revoked
        revokedTokens[tokenId] = true;
        
        // Emit event
        emit TokenRevoked(
            tokenId,
            batchId,
            block.timestamp,
            msg.sender
        );
    }
    
    /**
     * @notice Revoke an entire batch of tokens
     * @param batchId Batch ID to revoke
     */
    function revokeBatch(bytes32 batchId) external nonReentrant whenNotPaused onlyOwner {
        TokenBatch storage batch = batches[batchId];
        require(batch.timestamp > 0, "ReferenceTokenRegistry: batch does not exist");
        require(!batch.isRevoked, "ReferenceTokenRegistry: batch is already revoked");
        
        // Mark batch as revoked
        batch.isRevoked = true;
        
        // Emit event
        emit BatchRevoked(
            batchId,
            block.timestamp,
            msg.sender
        );
    }
    
    /**
     * @notice Register a new signing key
     * @param keyHash Hash of the signing key
     * @param description Optional description for the key
     */
    function registerSigningKey(
        bytes32 keyHash,
        string calldata description
    ) external nonReentrant whenNotPaused onlyOwner {
        require(keyHash != bytes32(0), "ReferenceTokenRegistry: key hash cannot be zero");
        require(signingKeys[keyHash].activatedAt == 0, "ReferenceTokenRegistry: key already registered");
        
        // Register the key
        signingKeys[keyHash] = SigningKey({
            activatedAt: block.timestamp,
            isActive: true,
            description: description
        });
        
        // Add to array for enumeration
        signingKeyHashes.push(keyHash);
        
        // Emit event
        emit SigningKeyRegistered(
            keyHash,
            block.timestamp,
            msg.sender,
            description
        );
    }
    
    /**
     * @notice Rotate the active signing key
     * @param newKeyHash Hash of the new signing key to activate
     * @param description Optional description for the new key
     */
    function rotateSigningKey(
        bytes32 newKeyHash,
        string calldata description
    ) external nonReentrant whenNotPaused onlyOwner {
        require(newKeyHash != bytes32(0), "ReferenceTokenRegistry: key hash cannot be zero");
        
        // Find current active key to deactivate
        bytes32 oldKeyHash = bytes32(0);
        for (uint256 i = 0; i < signingKeyHashes.length; i++) {
            bytes32 keyHash = signingKeyHashes[i];
            if (signingKeys[keyHash].isActive) {
                oldKeyHash = keyHash;
                signingKeys[keyHash].isActive = false;
                
                // Emit deactivation event
                emit SigningKeyDeactivated(
                    keyHash,
                    block.timestamp,
                    msg.sender
                );
                break;
            }
        }
        
        // Register or activate the new key
        if (signingKeys[newKeyHash].activatedAt == 0) {
            // New key, register it
            signingKeys[newKeyHash] = SigningKey({
                activatedAt: block.timestamp,
                isActive: true,
                description: description
            });
            
            // Add to array for enumeration
            signingKeyHashes.push(newKeyHash);
            
            // Emit registration event
            emit SigningKeyRegistered(
                newKeyHash,
                block.timestamp,
                msg.sender,
                description
            );
        } else {
            // Existing key, reactivate it
            signingKeys[newKeyHash].isActive = true;
        }
        
        // Emit rotation event
        emit SigningKeyRotated(
            newKeyHash,
            oldKeyHash,
            block.timestamp,
            msg.sender
        );
    }
    
    /**
     * @notice Deactivate a signing key
     * @param keyHash Hash of the signing key to deactivate
     */
    function deactivateSigningKey(bytes32 keyHash) external nonReentrant whenNotPaused onlyOwner {
        require(keyHash != bytes32(0), "ReferenceTokenRegistry: key hash cannot be zero");
        require(signingKeys[keyHash].activatedAt > 0, "ReferenceTokenRegistry: key not registered");
        require(signingKeys[keyHash].isActive, "ReferenceTokenRegistry: key already inactive");
        
        // Deactivate the key
        signingKeys[keyHash].isActive = false;
        
        // Emit event
        emit SigningKeyDeactivated(
            keyHash,
            block.timestamp,
            msg.sender
        );
    }
    
    /**
     * @notice Check if a signing key is currently active
     * @param keyHash Hash of the signing key to check
     * @return True if the key is active
     */
    function isSigningKeyActive(bytes32 keyHash) external view returns (bool) {
        return signingKeys[keyHash].isActive;
    }
    
    /**
     * @notice Get all registered signing key hashes
     * @return Array of all signing key hashes
     */
    function getAllSigningKeyHashes() external view returns (bytes32[] memory) {
        return signingKeyHashes;
    }
    
    /**
     * @notice Get signing key details
     * @param keyHash Hash of the signing key
     * @return activatedAt Timestamp when the key was activated
     * @return isActive Whether the key is currently active
     * @return description Description of the key
     */
    function getSigningKeyDetails(bytes32 keyHash) external view returns (
        uint256 activatedAt,
        bool isActive,
        string memory description
    ) {
        SigningKey storage key = signingKeys[keyHash];
        return (key.activatedAt, key.isActive, key.description);
    }
    
    /**
     * @notice Get batch details
     * @param batchId Batch ID to query
     * @return merkleRoot Merkle root of the batch
     * @return timestamp When the batch was anchored
     * @return proofCount Number of proofs in the batch
     * @return submitter Address that submitted the batch
     * @return isRevoked Whether the batch is revoked
     */
    function getBatchDetails(bytes32 batchId) external view returns (
        bytes32 merkleRoot,
        uint256 timestamp,
        uint256 proofCount,
        address submitter,
        bool isRevoked
    ) {
        TokenBatch storage batch = batches[batchId];
        return (
            batch.merkleRoot,
            batch.timestamp,
            batch.proofCount,
            batch.submitter,
            batch.isRevoked
        );
    }
    
    // ====== Admin Functions ======
    
    /**
     * @notice Pause the contract
     * @dev Can only be called by the contract owner
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpause the contract
     * @dev Can only be called by the contract owner
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}