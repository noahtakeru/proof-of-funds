pragma circom 2.0.0;

/*
 * Maximum ZK Proof Circuit for Proof of Funds
 * 
 * This circuit validates that a user owns at most a certain amount of tokens
 * without revealing the exact balance.
 */

// Include bitify for number to binary conversion
include "bitify.circom";
include "comparators.circom";

// Main component for maximum proof
template MaximumProof(nBits) {
    // Public inputs
    signal input maxAmount; // The maximum amount to prove
    signal input publicWalletAddress; // Public wallet address hash

    // Private inputs
    signal input actualBalance; // The actual balance of the wallet (private)
    signal input walletSecret; // A secret known only by the wallet owner
    signal input nonceValue; // Nonce to prevent replay attacks

    // Internal signals
    signal belowMaximum;
    
    // Convert inputs to binary for comparison
    component actualBalanceBits = Num2Bits(nBits);
    component maxAmountBits = Num2Bits(nBits);
    
    actualBalanceBits.in <== actualBalance;
    maxAmountBits.in <== maxAmount;
    
    // Check if balance <= maxAmount using a less-than-or-equal comparator
    component lessEq = LessEqThan(nBits);
    
    // Connect binary representations to the comparator
    for (var i = 0; i < nBits; i++) {
        lessEq.a[i] <== actualBalanceBits.out[i];
        lessEq.b[i] <== maxAmountBits.out[i];
    }
    
    // Output of the comparator (1 if below maximum, 0 otherwise)
    belowMaximum <== lessEq.out;
    
    // Verify that the user has balance below the maximum
    // This will constrain the proof to only be valid if belowMaximum = 1
    belowMaximum === 1;
    
    // Calculate and output hash of wallet + secret to prove ownership
    // Note: In a real circuit, this would use a cryptographic hash function
    // Here we use a simplified approach for demonstration
    signal walletProof;
    walletProof <== publicWalletAddress + walletSecret * nonceValue;
    
    // Output the wallet proof as a public signal
    // In a real implementation, this would be properly hashed
    signal output proofOfOwnership;
    proofOfOwnership <== walletProof;
}

// Main component instantiation - 64 bits for balance values
component main {public [maxAmount, publicWalletAddress]} = MaximumProof(64);