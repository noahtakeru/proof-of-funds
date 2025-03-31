// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title Zero-Knowledge Proof Verifier Contract
 * @author Arbitr Team
 * @notice Smart contract for managing and verifying zero-knowledge proofs related to fund verification
 * 
 * @dev This contract enables zero-knowledge fund verification without revealing actual amounts.
 * It allows users to submit ZK proofs that cryptographically verify fund ownership
 * while maintaining privacy of the actual amounts. The contract supports three proof types:
 * - Standard: Basic proof of having at least X funds
 * - Threshold: Proof of having funds within a specific range
 * - Maximum: Proof of having at most X funds
 * 
 * Each ZK proof includes metadata such as:
 * - Expiration time to prevent stale proofs
 * - Revocation status to allow users to invalidate proofs
 * - Public inputs associated with the ZK circuit
 * - Verification key hash for proof verification
 * 
 * Events are emitted for proof submission, revocation, and contract state changes
 * to provide transparency and enable off-chain tracking.
 * 
 * @custom:security-contact security@arbitr.finance
 */
contract ZKVerifier is Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;

    /**
     * @dev Types of proofs supported by the contract
     * @param STANDARD Proof that user has at least X funds
     * @param THRESHOLD Proof that user has funds within specific range
     * @param MAXIMUM Proof that user has at most X funds
     */
    enum ProofType { STANDARD, THRESHOLD, MAXIMUM }
    
    /**
     * @dev Structure to store ZK proof details
     * @param proofType Type of proof (STANDARD, THRESHOLD, MAXIMUM)
     * @param user Address of the user who submitted the proof
     * @param publicInputs Array of public inputs for the ZK circuit
     * @param verificationKeyHash Hash of the verification key for this proof
     * @param expiryTime Unix timestamp when the proof expires
     * @param isRevoked Boolean flag indicating if the proof has been revoked
     */
    struct ZKProof {
        ProofType proofType;
        address user;
        uint256[] publicInputs;
        bytes32 verificationKeyHash;
        uint256 expiryTime;
        bool isRevoked;
    }

    /**
     * @dev Emitted when a new ZK proof is submitted
     * @param proofId Unique identifier for the proof
     * @param user Address of the user who submitted the proof
     * @param proofType Type of the proof (STANDARD, THRESHOLD, MAXIMUM)
     * @param verificationKeyHash Hash of the verification key used
     * @param expiryTime Unix timestamp when the proof expires
     */
    event ZKProofSubmitted(
        uint256 indexed proofId,
        address indexed user,
        ProofType proofType,
        bytes32 verificationKeyHash,
        uint256 expiryTime
    );
    
    /**
     * @dev Emitted when a ZK proof is revoked by its owner
     * @param proofId Unique identifier for the revoked proof
     * @param user Address of the user who revoked the proof
     */
    event ZKProofRevoked(
        uint256 indexed proofId,
        address indexed user
    );
    
    /**
     * @dev Emitted when the owner updates the contract version
     * @param newVersion The new version string
     */
    event VersionUpdated(string newVersion);

    // Contract version for tracking upgrades
    string public version = "1.0.0";
    
    // Proof ID counter for assigning unique IDs
    Counters.Counter private _zkProofIdCounter;
    
    // Mapping to store all ZK proofs by their ID
    mapping(uint256 => ZKProof) public zkProofs;
    
    // Mapping to store active ZK proof IDs for each user
    mapping(address => uint256[]) public userZKProofs;
    
    // Approved verification key hashes that can be used for proofs
    mapping(bytes32 => bool) public approvedVerificationKeys;

    /**
     * @dev Contract constructor
     * Initializes the contract with the owner set to the deployer
     */
    constructor() {
        // OpenZeppelin's Ownable sets msg.sender as the owner by default
    }
    
    /**
     * @notice Submit a new zero-knowledge proof
     * @dev Creates a new ZK proof entry with the provided parameters and assigns a unique ID
     * 
     * @param _proofType Type of proof (0=STANDARD, 1=THRESHOLD, 2=MAXIMUM)
     * @param _publicInputs Array of public inputs for the ZK circuit
     * @param _verificationKeyHash Hash of the verification key used
     * @param _expiryTime Unix timestamp when the proof should expire
     * @return uint256 The ID of the newly created ZK proof
     */
    function submitZKProof(
        ProofType _proofType,
        uint256[] memory _publicInputs,
        bytes32 _verificationKeyHash,
        uint256 _expiryTime
    ) external nonReentrant returns (uint256) {
        require(_expiryTime > block.timestamp, "Expiry time must be in the future");
        require(approvedVerificationKeys[_verificationKeyHash], "Verification key not approved");
        require(_publicInputs.length > 0, "Public inputs cannot be empty");
        
        // Increment counter to get a new unique ID
        _zkProofIdCounter.increment();
        uint256 proofId = _zkProofIdCounter.current();
        
        // Create and store the ZK proof
        ZKProof memory newProof = ZKProof({
            proofType: _proofType,
            user: msg.sender,
            publicInputs: _publicInputs,
            verificationKeyHash: _verificationKeyHash,
            expiryTime: _expiryTime,
            isRevoked: false
        });
        
        zkProofs[proofId] = newProof;
        userZKProofs[msg.sender].push(proofId);
        
        emit ZKProofSubmitted(
            proofId,
            msg.sender,
            _proofType,
            _verificationKeyHash,
            _expiryTime
        );
        
        return proofId;
    }
    
    /**
     * @notice Revoke a previously submitted ZK proof
     * @dev Allows a user to invalidate their own ZK proof by marking it as revoked
     * 
     * @param _proofId ID of the ZK proof to revoke
     * @return bool True if the ZK proof was successfully revoked
     */
    function revokeZKProof(uint256 _proofId) external nonReentrant returns (bool) {
        ZKProof storage proof = zkProofs[_proofId];
        
        require(proof.user == msg.sender, "Only proof owner can revoke");
        require(!proof.isRevoked, "Proof already revoked");
        
        proof.isRevoked = true;
        
        emit ZKProofRevoked(_proofId, msg.sender);
        
        return true;
    }
    
    /**
     * @notice Get a ZK proof by its ID
     * @dev Returns all details of a specific ZK proof
     * 
     * @param _proofId ID of the ZK proof to retrieve
     * @return ProofType Type of the ZK proof
     * @return address Address of the user who submitted the proof
     * @return uint256[] Array of public inputs for the ZK circuit
     * @return bytes32 Hash of the verification key used
     * @return uint256 Unix timestamp when the proof expires
     * @return bool Flag indicating if the proof has been revoked
     */
    function getZKProof(uint256 _proofId) external view returns (
        ProofType,
        address,
        uint256[] memory,
        bytes32,
        uint256,
        bool
    ) {
        ZKProof memory proof = zkProofs[_proofId];
        return (
            proof.proofType,
            proof.user,
            proof.publicInputs,
            proof.verificationKeyHash,
            proof.expiryTime,
            proof.isRevoked
        );
    }
    
    /**
     * @notice Check if a ZK proof is valid
     * @dev Validates a ZK proof by checking expiration and revocation status
     * 
     * @param _proofId ID of the ZK proof to verify
     * @return bool True if the ZK proof is valid (not expired and not revoked)
     */
    function isZKProofValid(uint256 _proofId) external view returns (bool) {
        ZKProof memory proof = zkProofs[_proofId];
        return (
            proof.expiryTime > block.timestamp &&
            !proof.isRevoked
        );
    }
    
    /**
     * @notice Get all ZK proof IDs for a specific user
     * @dev Returns an array of ZK proof IDs associated with the given address
     * 
     * @param _user Address of the user to query
     * @return uint256[] Array of ZK proof IDs belonging to the user
     */
    function getUserZKProofs(address _user) external view returns (uint256[] memory) {
        return userZKProofs[_user];
    }
    
    /**
     * @notice Approve a verification key for use in ZK proofs
     * @dev Only callable by the contract owner
     * 
     * @param _verificationKeyHash Hash of the verification key to approve
     */
    function approveVerificationKey(bytes32 _verificationKeyHash) external onlyOwner {
        approvedVerificationKeys[_verificationKeyHash] = true;
    }
    
    /**
     * @notice Revoke approval for a verification key
     * @dev Only callable by the contract owner
     * 
     * @param _verificationKeyHash Hash of the verification key to revoke
     */
    function revokeVerificationKey(bytes32 _verificationKeyHash) external onlyOwner {
        approvedVerificationKeys[_verificationKeyHash] = false;
    }
    
    /**
     * @notice Update the contract version
     * @dev Only callable by the contract owner
     * 
     * @param _newVersion New version string to set
     */
    function updateVersion(string memory _newVersion) external onlyOwner {
        version = _newVersion;
        emit VersionUpdated(_newVersion);
    }
} 