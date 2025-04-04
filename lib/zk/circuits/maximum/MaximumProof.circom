pragma circom 2.0.0;

/*
 * Maximum Proof of Funds Circuit
 * 
 * This circuit proves that a user has at most a specific maximum amount of funds
 * in their wallet, without revealing the wallet's address or the exact balance.
 * 
 * Inputs:
 * - privateAmount: The actual token amount the user has (private)
 * - privateAddress: The wallet address (as array of bytes)
 * - privateNonce: A random nonce for uniqueness
 * - maximum: The maximum amount being verified
 * 
 * Public Inputs (outputs):
 * - maximumAmount: The maximum token amount being proven
 * - publicAddressHash: Hash of the wallet address
 */

include "../common/HashAddress.circom";
include "../common/LessThanOrEqual.circom";

template MaximumProof() {
    // Private inputs
    signal input privateAmount;
    signal input privateAddress[20]; // ETH address is 20 bytes
    signal input privateNonce;
    
    // Maximum value (can be public)
    signal input maximum;
    
    // Public inputs
    signal output maximumAmount;
    signal output publicAddressHash;
    
    // Hash the address for privacy
    component hasher = HashAddress();
    for (var i = 0; i < 20; i++) {
        hasher.in[i] <== privateAddress[i];
    }
    publicAddressHash <== hasher.out;
    
    // Check that actual amount <= maximum
    component lteCheck = LessThanOrEqual(64);  // 64-bit comparison
    lteCheck.a <== privateAmount;
    lteCheck.b <== maximum;
    lteCheck.out === 1;
    
    // Set maximum amount output
    maximumAmount <== maximum;
}