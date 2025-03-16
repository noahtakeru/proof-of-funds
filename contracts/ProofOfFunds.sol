// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ProofOfFunds {
    struct Proof {
        address user;
        uint256 timestamp;
        bytes32 proofHash;
    }

    mapping(address => Proof) public proofs;

    event ProofSubmitted(address indexed user, bytes32 proofHash, uint256 timestamp);

    function submitProof(bytes32 _proofHash) external {
        proofs[msg.sender] = Proof(msg.sender, block.timestamp, _proofHash);
        emit ProofSubmitted(msg.sender, _proofHash, block.timestamp);
    }

    function getProof(address _user) external view returns (Proof memory) {
        return proofs[_user];
    }
} 