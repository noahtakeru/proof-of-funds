// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Proof of Funds Simple
 * @author Arbitr Team
 * @notice A simplified version of ProofOfFunds for testing deployment
 */
contract ProofOfFundsSimple is Ownable {
    // Contract version for tracking upgrades
    string public constant VERSION = "1.0.0";
    
    // Simple event
    event ProofSubmitted(address indexed user, uint256 timestamp);

    constructor() {
        // In OpenZeppelin 4.x, Ownable sets msg.sender as the owner by default
    }
    
    // Simple function to emit an event
    function submitProof() external {
        emit ProofSubmitted(msg.sender, block.timestamp);
    }
    
    // View function to return the version
    function getVersion() external pure returns (string memory) {
        return VERSION;
    }
} 