// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Proof of Funds Simple
 * @author Arbitr Team
 * @notice A simplified version of the Proof of Funds contract for demonstration and educational purposes
 * 
 * @dev This contract provides a minimal implementation of the proof of funds concept,
 * focusing on the core functionality without the additional features of the main contract.
 * It allows users to submit and verify simple proofs of fund ownership without the complexity
 * of different proof types, expiration, or revocation.
 * 
 * This contract is intended for:
 * - Educational purposes to understand the basic concept
 * - Quick demos and prototyping
 * - Testing integrations with minimal overhead
 * 
 * For production use, the full ProofOfFunds.sol contract with security features
 * should be used instead.
 * 
 * @custom:security-contact security@arbitr.finance
 * @custom:version 0.1.0
 */
contract ProofOfFundsSimple is Ownable {
    // Contract version for tracking upgrades
    string public constant VERSION = "1.0.0";
    
    /**
     * @dev Mapping to store proofs for each user address
     * The value is a bytes32 hash of their proof data
     */
    mapping(address => bytes32) public proofs;

    /**
     * @dev Event emitted when a new proof is submitted
     * @param user The address of the user who submitted the proof
     * @param proofHash The hash of the proof data
     */
    event ProofSubmitted(address indexed user, bytes32 proofHash);

    constructor() {
        // In OpenZeppelin 4.x, Ownable sets msg.sender as the owner by default
    }
    
    /**
     * @dev Submits a new proof of funds
     * Creates a hash based on the user's address and the claimed amount,
     * then stores it in the contract's state
     * 
     * @param _amount The amount the user is claiming to possess
     * @return bytes32 The generated proof hash
     */
    function submitProof(uint256 _amount) external returns (bytes32) {
        bytes32 proofHash = keccak256(abi.encode(msg.sender, _amount));
        proofs[msg.sender] = proofHash;
        emit ProofSubmitted(msg.sender, proofHash);
        return proofHash;
    }
    
    /**
     * @dev Verifies if a user's proof matches a claimed amount
     * Regenerates the hash based on the user's address and the claimed amount,
     * then compares it to the stored hash
     * 
     * @param _user The address of the user to verify
     * @param _claimedAmount The amount being verified against the proof
     * @return bool True if the proof is valid, false otherwise
     */
    function verifyProof(address _user, uint256 _claimedAmount) external view returns (bool) {
        bytes32 storedProof = proofs[_user];
        bytes32 checkProof = keccak256(abi.encode(_user, _claimedAmount));
        return storedProof == checkProof;
    }
    
    // View function to return the version
    function getVersion() external pure returns (string memory) {
        return VERSION;
    }
} 