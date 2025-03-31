// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title Proof of Funds Contract
 * @author Arbitr Team
 * @notice Main smart contract for managing cryptographic proofs of funds
 * 
 * @dev This contract allows users to submit and verify cryptographic proofs of their funds
 * without revealing the actual amounts. It supports three proof types:
 * - Standard: Basic proof of having at least X funds
 * - Threshold: Proof of having funds within a specific range
 * - Maximum: Proof of having at most X funds
 * 
 * Security features:
 * - Proof expiration mechanism to prevent stale proofs
 * - Revocation capability for users to invalidate their proofs
 * - Storage of signature messages to verify authenticity
 * - Access control for administrative functions
 * - Reentrancy protection for state-changing operations
 * 
 * Events are emitted for proof submission, revocation, and contract state changes
 * to provide transparency and enable off-chain tracking.
 * 
 * @custom:security-contact security@arbitr.finance
 */
contract ProofOfFunds is Pausable, Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;

    /**
     * @dev Types of proofs supported by the contract
     * @param STANDARD Proof that user has at least X funds
     * @param THRESHOLD Proof that user has funds within specific range
     * @param MAXIMUM Proof that user has at most X funds
     */
    enum ProofType { STANDARD, THRESHOLD, MAXIMUM }
    
    /**
     * @dev Structure to store proof details
     * @param proofType Type of proof (STANDARD, THRESHOLD, MAXIMUM)
     * @param user Address of the user who submitted the proof
     * @param proofHash Cryptographic hash of the proof data
     * @param expiryTime Unix timestamp when the proof expires
     * @param isRevoked Boolean flag indicating if the proof has been revoked
     * @param signatureMessage Message that was signed to create this proof
     */
    struct Proof {
        ProofType proofType;
        address user;
        bytes32 proofHash;
        uint256 expiryTime;
        bool isRevoked;
        string signatureMessage;
    }

    // Events for tracking proof lifecycle
    /**
     * @dev Emitted when a new proof is submitted
     * @param proofId Unique identifier for the proof
     * @param user Address of the user who submitted the proof
     * @param proofType Type of the proof (STANDARD, THRESHOLD, MAXIMUM)
     * @param proofHash Cryptographic hash of the proof data
     * @param expiryTime Unix timestamp when the proof expires
     */
    event ProofSubmitted(
        uint256 indexed proofId,
        address indexed user,
        ProofType proofType,
        bytes32 proofHash,
        uint256 expiryTime
    );
    
    /**
     * @dev Emitted when a proof is revoked by its owner
     * @param proofId Unique identifier for the revoked proof
     * @param user Address of the user who revoked the proof
     */
    event ProofRevoked(
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
    Counters.Counter private _proofIdCounter;
    
    // Mapping to store all proofs by their ID
    mapping(uint256 => Proof) public proofs;
    
    // Mapping to store active proof IDs for each user
    mapping(address => uint256[]) public userProofs;

    /**
     * @dev Contract constructor
     * Initializes the contract with the owner set to the deployer
     */
    constructor() {
        // OpenZeppelin's Ownable sets msg.sender as the owner by default
    }
    
    /**
     * @notice Submit a new proof of funds
     * @dev Creates a new proof entry with the provided parameters and assigns a unique ID
     * 
     * @param _proofType Type of proof (0=STANDARD, 1=THRESHOLD, 2=MAXIMUM)
     * @param _proofHash Cryptographic hash of the proof data
     * @param _expiryTime Unix timestamp when the proof should expire
     * @param _signatureMessage Message that was signed to create this proof
     * @return uint256 The ID of the newly created proof
     */
    function submitProof(
        ProofType _proofType,
        bytes32 _proofHash,
        uint256 _expiryTime,
        string memory _signatureMessage
    ) external nonReentrant returns (uint256) {
        require(_expiryTime > block.timestamp, "Expiry time must be in the future");
        
        // Increment counter to get a new unique ID
        _proofIdCounter.increment();
        uint256 proofId = _proofIdCounter.current();
        
        // Create and store the proof
        Proof memory newProof = Proof({
            proofType: _proofType,
            user: msg.sender,
            proofHash: _proofHash,
            expiryTime: _expiryTime,
            isRevoked: false,
            signatureMessage: _signatureMessage
        });
        
        proofs[proofId] = newProof;
        userProofs[msg.sender].push(proofId);
        
        emit ProofSubmitted(
            proofId,
            msg.sender,
            _proofType,
            _proofHash,
            _expiryTime
        );
        
        return proofId;
    }
    
    /**
     * @notice Revoke a previously submitted proof
     * @dev Allows a user to invalidate their own proof by marking it as revoked
     * 
     * @param _proofId ID of the proof to revoke
     * @return bool True if the proof was successfully revoked
     */
    function revokeProof(uint256 _proofId) external nonReentrant returns (bool) {
        Proof storage proof = proofs[_proofId];
        
        require(proof.user == msg.sender, "Only proof owner can revoke");
        require(!proof.isRevoked, "Proof already revoked");
        
        proof.isRevoked = true;
        
        emit ProofRevoked(_proofId, msg.sender);
        
        return true;
    }
    
    /**
     * @notice Get a proof by its ID
     * @dev Returns all details of a specific proof
     * 
     * @param _proofId ID of the proof to retrieve
     * @return ProofType Type of the proof
     * @return address Address of the user who submitted the proof
     * @return bytes32 Cryptographic hash of the proof data
     * @return uint256 Unix timestamp when the proof expires
     * @return bool Flag indicating if the proof has been revoked
     * @return string The signature message used to create the proof
     */
    function getProof(uint256 _proofId) external view returns (
        ProofType,
        address,
        bytes32,
        uint256,
        bool,
        string memory
    ) {
        Proof memory proof = proofs[_proofId];
        return (
            proof.proofType,
            proof.user,
            proof.proofHash,
            proof.expiryTime,
            proof.isRevoked,
            proof.signatureMessage
        );
    }
    
    /**
     * @notice Check if a proof is valid
     * @dev Validates a proof by checking expiration and revocation status
     * 
     * @param _proofId ID of the proof to verify
     * @return bool True if the proof is valid (not expired and not revoked)
     */
    function isProofValid(uint256 _proofId) external view returns (bool) {
        Proof memory proof = proofs[_proofId];
        return (
            proof.expiryTime > block.timestamp &&
            !proof.isRevoked
        );
    }
    
    /**
     * @notice Get all proof IDs for a specific user
     * @dev Returns an array of proof IDs associated with the given address
     * 
     * @param _user Address of the user to query
     * @return uint256[] Array of proof IDs belonging to the user
     */
    function getUserProofs(address _user) external view returns (uint256[] memory) {
        return userProofs[_user];
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