pragma circom 2.0.0;

/*
 * Standard ZK Proof Circuit for Proof of Funds
 * 
 * This circuit validates that a user owns at least a certain amount of tokens
 * without revealing the exact balance.
 */

// Include bitify for number to binary conversion
include "bitify.circom";
include "comparators.circom";

// Main component for standard proof
template StandardProof(nBits) {
    // Public inputs
    signal input minAmount; // The minimum amount to prove
    signal input publicWalletAddress; // Public wallet address hash

    // Private inputs
    signal input actualBalance; // The actual balance of the wallet (private)
    signal input walletSecret; // A secret known only by the wallet owner
    signal input nonceValue; // Nonce to prevent replay attacks

    // Internal signals
    signal hasEnoughFunds;
    
    // Convert inputs to binary for comparison
    component actualBalanceBits = Num2Bits(nBits);
    component minAmountBits = Num2Bits(nBits);
    
    actualBalanceBits.in <== actualBalance;
    minAmountBits.in <== minAmount;
    
    // Check if balance >= minAmount using a greater-than-or-equal comparator
    component greaterEq = GreaterEqThan(nBits);
    
    // Connect binary representations to the comparator
    for (var i = 0; i < nBits; i++) {
        greaterEq.a[i] <== actualBalanceBits.out[i];
        greaterEq.b[i] <== minAmountBits.out[i];
    }
    
    // Output of the comparator (1 if enough funds, 0 otherwise)
    hasEnoughFunds <== greaterEq.out;
    
    // Verify that the user has enough funds
    // This will constrain the proof to only be valid if hasEnoughFunds = 1
    hasEnoughFunds === 1;
    
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
component main {public [minAmount, publicWalletAddress]} = StandardProof(64);