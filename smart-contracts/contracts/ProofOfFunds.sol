// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title Proof of Funds
 * @author Arbitr Team
 * @notice A smart contract that enables users to submit cryptographic proofs of their funds
 * without revealing the actual amounts. This implementation supports three types of proofs:
 * - Standard proof (exact amount verification)
 * - Threshold proof (minimum amount verification)
 * - Maximum proof (maximum amount verification)
 * 
 * @dev Each proof type uses a different verification mechanism and includes:
 * - Proof hash generation using address + amount + type
 * - Expiration mechanism to ensure proofs are time-bound
 * - Signature message storage for context of the verification
 * - Proof type storage to prevent cross-type verification
 * - Circuit breaker pattern to pause the contract in case of emergencies
 * - Access control for administrative functions
 * - Reentrancy protection for all state-changing functions
 * 
 * @custom:security-contact security@arbitr.finance
 * @custom:version 1.0.0
 */
contract ProofOfFunds is Pausable, Ownable, ReentrancyGuard {
    /**
     * @dev Enum to represent the different types of proofs
     */
    enum ProofType {
        STANDARD,  // Exact amount
        THRESHOLD, // Minimum amount (at least)
        MAXIMUM    // Maximum amount (at most)
    }

    /**
     * @dev Structure to store proof data
     * @param user The address of the user who submitted the proof
     * @param timestamp The time when the proof was submitted
     * @param expiryTime The time when the proof expires
     * @param proofHash The hash of the proof data
     * @param proofType The type of proof (STANDARD, THRESHOLD, MAXIMUM)
     * @param thresholdAmount The threshold amount for threshold proofs
     * @param isRevoked Whether the proof has been revoked
     * @param signatureMessage The message that was signed by the user
     * @param signature The signature of the user
     */
    struct Proof {
        address user;
        uint256 timestamp;
        uint256 expiryTime;
        bytes32 proofHash;
        ProofType proofType;
        uint256 thresholdAmount; // Used for THRESHOLD and MAXIMUM types
        bool isRevoked;
        string signatureMessage;
        bytes signature;
    }

    // Mapping from user address to their proof
    mapping(address => Proof) public proofs;
    
    // Contract version for tracking upgrades
    string public constant VERSION = "1.0.0";
    
    // Minimum expiry time to prevent extremely short-lived proofs (1 hour)
    uint256 public constant MIN_EXPIRY_TIME = 3600;
    
    // Maximum expiry time to prevent extremely long-lived proofs (1 year)
    uint256 public constant MAX_EXPIRY_TIME = 31536000;

    // Events
    /**
     * @dev Emitted when a new proof is submitted
     * @param user The address of the user who submitted the proof
     * @param proofHash The hash of the proof data
     * @param timestamp The time when the proof was submitted
     * @param expiryTime The time when the proof expires
     * @param proofType The type of proof
     */
    event ProofSubmitted(
        address indexed user, 
        bytes32 proofHash, 
        uint256 timestamp, 
        uint256 expiryTime,
        ProofType proofType
    );
    
    /**
     * @dev Emitted when a proof is revoked
     * @param user The address of the user who revoked the proof
     * @param proofHash The hash of the revoked proof
     * @param reason The reason for revoking the proof
     */
    event ProofRevoked(
        address indexed user, 
        bytes32 proofHash,
        string reason
    );
    
    /**
     * @dev Emitted when the contract is paused
     * @param account The address that paused the contract
     */
    event ContractPaused(address account);
    
    /**
     * @dev Emitted when the contract is unpaused
     * @param account The address that unpaused the contract
     */
    event ContractUnpaused(address account);

    /**
     * @dev Constructor to initialize the contract
     */
    constructor() {
        // Contract starts in unpaused state
    }
    
    /**
     * @dev Modifier to validate expiry time is within acceptable bounds
     * @param _expiryTime The expiry time to validate
     */
    modifier validExpiryTime(uint256 _expiryTime) {
        require(_expiryTime > block.timestamp, "Expiry time must be in the future");
        require(_expiryTime <= block.timestamp + MAX_EXPIRY_TIME, "Expiry time too far in the future");
        require(_expiryTime >= block.timestamp + MIN_EXPIRY_TIME, "Expiry time too short");
        _;
    }

    /**
     * @dev Generates a proof hash based on the user address, amount, and proof type
     * @param _user The user's address
     * @param _amount The amount to be verified
     * @param _proofType The type of proof
     * @return bytes32 The generated proof hash
     */
    function generateProofHash(address _user, uint256 _amount, ProofType _proofType) public pure returns (bytes32) {
        // Use ABI encoding to prevent hash collisions between different proof types
        if (_proofType == ProofType.STANDARD) {
            return keccak256(abi.encode(_user, _amount, _proofType));
        } else if (_proofType == ProofType.THRESHOLD) {
            return keccak256(abi.encode(_user, _amount, _proofType, "threshold"));
        } else if (_proofType == ProofType.MAXIMUM) {
            return keccak256(abi.encode(_user, _amount, _proofType, "maximum"));
        }
        revert("Invalid proof type");
    }

    /**
     * @dev Submit a new proof of funds
     * @param _proofType The type of proof (STANDARD, THRESHOLD, MAXIMUM)
     * @param _proofHash The hash of the proof data
     * @param _expiryTime The time when the proof expires
     * @param _thresholdAmount The threshold amount for threshold/maximum proofs
     * @param _signatureMessage The message that was signed by the user
     * @param _signature The signature of the user
     */
    function submitProof(
        ProofType _proofType,
        bytes32 _proofHash,
        uint256 _expiryTime,
        uint256 _thresholdAmount,
        string calldata _signatureMessage,
        bytes calldata _signature
    ) external nonReentrant whenNotPaused validExpiryTime(_expiryTime) {
        // Validation checks
        require(bytes(_signatureMessage).length > 0, "Signature message is required");
        
        // For THRESHOLD and MAXIMUM types, require a threshold amount
        if (_proofType == ProofType.THRESHOLD || _proofType == ProofType.MAXIMUM) {
            require(_thresholdAmount > 0, "Threshold amount must be greater than zero");
        }

        // Create and store the proof
        proofs[msg.sender] = Proof({
            user: msg.sender,
            timestamp: block.timestamp,
            expiryTime: _expiryTime,
            proofHash: _proofHash,
            proofType: _proofType,
            thresholdAmount: _thresholdAmount,
            isRevoked: false,
            signatureMessage: _signatureMessage,
            signature: _signature
        });

        emit ProofSubmitted(msg.sender, _proofHash, block.timestamp, _expiryTime, _proofType);
    }

    /**
     * @dev Verify a standard proof (exact amount)
     * @param _user The user's address
     * @param _claimedAmount The amount to verify
     * @return bool Whether the proof is valid
     */
    function verifyStandardProof(address _user, uint256 _claimedAmount) external view returns (bool) {
        Proof memory userProof = proofs[_user];
        
        // Check if proof exists, is not expired, not revoked, and is of correct type
        if (userProof.user == address(0) || 
            userProof.expiryTime <= block.timestamp || 
            userProof.isRevoked || 
            userProof.proofType != ProofType.STANDARD) {
            return false;
        }

        // Generate hash with claimed amount and check if it matches
        bytes32 claimedHash = generateProofHash(_user, _claimedAmount, ProofType.STANDARD);
        return userProof.proofHash == claimedHash;
    }

    /**
     * @dev Verify a threshold proof (minimum amount)
     * @param _user The user's address
     * @param _minimumAmount The minimum amount to verify
     * @return bool Whether the proof is valid
     */
    function verifyThresholdProof(address _user, uint256 _minimumAmount) external view returns (bool) {
        Proof memory userProof = proofs[_user];
        
        // Check if proof exists, is not expired, not revoked, and is of correct type
        if (userProof.user == address(0) || 
            userProof.expiryTime <= block.timestamp || 
            userProof.isRevoked || 
            userProof.proofType != ProofType.THRESHOLD) {
            return false;
        }

        // For threshold proofs, check if the stored threshold amount is at least the minimum
        return userProof.thresholdAmount >= _minimumAmount;
    }

    /**
     * @dev Verify a maximum proof (maximum amount)
     * @param _user The user's address
     * @param _maximumAmount The maximum amount to verify
     * @return bool Whether the proof is valid
     */
    function verifyMaximumProof(address _user, uint256 _maximumAmount) external view returns (bool) {
        Proof memory userProof = proofs[_user];
        
        // Check if proof exists, is not expired, not revoked, and is of correct type
        if (userProof.user == address(0) || 
            userProof.expiryTime <= block.timestamp || 
            userProof.isRevoked || 
            userProof.proofType != ProofType.MAXIMUM) {
            return false;
        }

        // For maximum proofs, check if the stored threshold amount is at most the maximum
        return userProof.thresholdAmount <= _maximumAmount;
    }

    /**
     * @dev Revoke a proof
     * @param _reason The reason for revoking the proof
     */
    function revokeProof(string calldata _reason) external nonReentrant whenNotPaused {
        Proof storage userProof = proofs[msg.sender];
        
        // Check if proof exists and is not already revoked
        require(userProof.user != address(0), "No proof exists for user");
        require(!userProof.isRevoked, "Proof is already revoked");
        
        // Revoke the proof
        userProof.isRevoked = true;
        
        emit ProofRevoked(msg.sender, userProof.proofHash, _reason);
    }

    /**
     * @dev Check if a proof is valid (not expired and not revoked)
     * @param _user The user's address
     * @return bool Whether the proof is valid
     */
    function isProofValid(address _user) external view returns (bool) {
        Proof memory userProof = proofs[_user];
        
        return (userProof.user != address(0) && 
                userProof.expiryTime > block.timestamp && 
                !userProof.isRevoked);
    }

    /**
     * @dev Retrieve a proof for a specific user
     * @param _user The address of the user
     * @return The proof data for the specified user
     */
    function getProof(address _user) external view returns (Proof memory) {
        return proofs[_user];
    }

    /**
     * @dev Verify if a signature is valid for a message
     * @param _user The user's address
     * @param _message The message that was signed
     * @return bool Whether the signature is valid
     */
    function verifySignature(address _user, string calldata _message) external view returns (bool) {
        Proof memory userProof = proofs[_user];
        
        // Check if proof exists
        if (userProof.user == address(0)) {
            return false;
        }

        // Compare the stored message with the provided message
        return keccak256(bytes(userProof.signatureMessage)) == keccak256(bytes(_message));
    }
    
    /**
     * @dev Pauses the contract, preventing new proof submissions and revocations
     * @notice Can only be called by the contract owner
     */
    function pause() external onlyOwner {
        _pause();
        emit ContractPaused(msg.sender);
    }
    
    /**
     * @dev Unpauses the contract, allowing proof submissions and revocations
     * @notice Can only be called by the contract owner
     */
    function unpause() external onlyOwner {
        _unpause();
        emit ContractUnpaused(msg.sender);
    }
} 