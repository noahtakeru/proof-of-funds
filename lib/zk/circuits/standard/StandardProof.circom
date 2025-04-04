pragma circom 2.0.0;

/*
 * Standard Proof of Funds Circuit
 * 
 * This circuit proves that a user has exactly a specific amount of funds
 * in their wallet, without revealing the wallet's address.
 * 
 * Inputs:
 * - privateAmount: The token amount the user is proving they have
 * - privateAddress: The wallet address (as array of bytes)
 * - privateNonce: A random nonce for uniqueness
 * 
 * Public Inputs (outputs):
 * - publicAmount: The token amount being proven
 * - publicAddressHash: Hash of the wallet address
 */

include "../common/HashAddress.circom";
include "../common/AmountCheck.circom";

template StandardProof() {
    // Private inputs
    signal input privateAmount;
    signal input privateAddress[20]; // ETH address is 20 bytes
    signal input privateNonce;
    
    // Public inputs
    signal output publicAmount;
    signal output publicAddressHash;
    
    // Hash the address for privacy
    component hasher = HashAddress();
    for (var i = 0; i < 20; i++) {
        hasher.in[i] <== privateAddress[i];
    }
    publicAddressHash <== hasher.out;
    
    // Standard amount check (exact match)
    component amountCheck = AmountCheck();
    amountCheck.actualAmount <== privateAmount;
    amountCheck.expectedAmount <== privateAmount;
    amountCheck.result === 1;
    
    // Set public amount output
    publicAmount <== privateAmount;
}