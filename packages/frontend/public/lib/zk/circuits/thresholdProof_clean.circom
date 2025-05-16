pragma circom 2.0.0;

/*
 * Threshold ZK Proof Circuit for Proof of Funds
 * 
 * This circuit validates that a user owns between a minimum and maximum amount
 * of tokens without revealing the exact balance.
 */

// Include bitify for number to binary conversion
include "bitify.circom";
include "comparators.circom";

// Main component for threshold proof
template ThresholdProof(nBits) {
    // Public inputs
    signal input minAmount; // The minimum amount to prove
    signal input maxAmount; // The maximum amount to prove
    signal input publicWalletAddress; // Public wallet address hash

    // Private inputs
    signal input actualBalance; // The actual balance of the wallet (private)
    signal input walletSecret; // A secret known only by the wallet owner
    signal input nonceValue; // Nonce to prevent replay attacks

    // Internal signals
    signal withinThreshold;
    signal aboveMin;
    signal belowMax;
    
    // Convert inputs to binary for comparison
    component actualBalanceBits = Num2Bits(nBits);
    component minAmountBits = Num2Bits(nBits);
    component maxAmountBits = Num2Bits(nBits);
    
    actualBalanceBits.in <== actualBalance;
    minAmountBits.in <== minAmount;
    maxAmountBits.in <== maxAmount;
    
    // Check if balance >= minAmount using a greater-than-or-equal comparator
    component greaterEqMin = GreaterEqThan(nBits);
    
    // Connect binary representations to the comparator
    for (var i = 0; i < nBits; i++) {
        greaterEqMin.a[i] <== actualBalanceBits.out[i];
        greaterEqMin.b[i] <== minAmountBits.out[i];
    }
    
    // Output of the min comparator (1 if above min, 0 otherwise)
    aboveMin <== greaterEqMin.out;
    
    // Check if balance <= maxAmount using a less-than-or-equal comparator
    component lessEqMax = LessEqThan(nBits);
    
    // Connect binary representations to the comparator
    for (var i = 0; i < nBits; i++) {
        lessEqMax.a[i] <== actualBalanceBits.out[i];
        lessEqMax.b[i] <== maxAmountBits.out[i];
    }
    
    // Output of the max comparator (1 if below max, 0 otherwise)
    belowMax <== lessEqMax.out;
    
    // Final threshold check: balance must be >= min AND <= max
    withinThreshold <== aboveMin * belowMax;
    
    // Verify that the user has balance within the threshold
    // This will constrain the proof to only be valid if withinThreshold = 1
    withinThreshold === 1;
    
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
component main {public [minAmount, maxAmount, publicWalletAddress]} = ThresholdProof(64);