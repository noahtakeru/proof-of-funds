pragma circom 2.0.0;

/*
 * Threshold Proof of Funds Circuit
 * 
 * This circuit proves that a user has at least a specific threshold amount of funds
 * in their wallet, without revealing the wallet's address or the exact balance.
 * 
 * Inputs:
 * - privateAmount: The actual token amount the user has (private)
 * - privateAddress: The wallet address (as array of bytes)
 * - privateNonce: A random nonce for uniqueness
 * - threshold: The minimum amount being verified
 * 
 * Public Inputs (outputs):
 * - thresholdAmount: The minimum token amount being proven
 * - publicAddressHash: Hash of the wallet address
 */

include "../common/HashAddress.circom";
include "../common/GreaterThanOrEqual.circom";

template ThresholdProof() {
    // Private inputs
    signal input privateAmount;
    signal input privateAddress[20]; // ETH address is 20 bytes
    signal input privateNonce;
    
    // Threshold value (can be public)
    signal input threshold;
    
    // Public inputs
    signal output thresholdAmount;
    signal output publicAddressHash;
    
    // Hash the address for privacy
    component hasher = HashAddress();
    for (var i = 0; i < 20; i++) {
        hasher.in[i] <== privateAddress[i];
    }
    publicAddressHash <== hasher.out;
    
    // Check that actual amount >= threshold
    component gteCheck = GreaterThanOrEqual(64);  // 64-bit comparison
    gteCheck.a <== privateAmount;
    gteCheck.b <== threshold;
    gteCheck.out === 1;
    
    // Set threshold amount output
    thresholdAmount <== threshold;
}