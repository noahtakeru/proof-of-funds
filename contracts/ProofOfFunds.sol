// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title Proof of Funds
 * @dev A smart contract that enables users to submit cryptographic proofs of their funds
 * without revealing the actual amounts. This is a simplified implementation for demonstration
 * purposes that showcases the core functionality of the Arbitr platform.
 *
 * The contract stores proof hashes submitted by users, where each hash could represent:
 * - Standard proof (exact amount verification)
 * - Threshold proof (minimum amount verification)
 * - Maximum proof (maximum amount verification)
 *
 * In a production implementation, this contract would include additional functionality
 * for proof verification, expiration handling, and revocation.
 */
contract ProofOfFunds {
    /**
     * @dev Structure to store proof data
     * @param user The address of the user who submitted the proof
     * @param timestamp The time when the proof was submitted
     * @param proofHash The hash of the proof data
     */
    struct Proof {
        address user;
        uint256 timestamp;
        bytes32 proofHash;
    }

    // Mapping from user address to their proof
    mapping(address => Proof) public proofs;

    // Event emitted when a new proof is submitted
    event ProofSubmitted(address indexed user, bytes32 proofHash, uint256 timestamp);

    /**
     * @dev Submit a new proof of funds
     * @param _proofHash The hash of the proof data
     */
    function submitProof(bytes32 _proofHash) external {
        proofs[msg.sender] = Proof(msg.sender, block.timestamp, _proofHash);
        emit ProofSubmitted(msg.sender, _proofHash, block.timestamp);
    }

    /**
     * @dev Retrieve a proof for a specific user
     * @param _user The address of the user
     * @return The proof data for the specified user
     */
    function getProof(address _user) external view returns (Proof memory) {
        return proofs[_user];
    }
} 