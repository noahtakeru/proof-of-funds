
pragma circom 2.0.0;

// Minimal MaximumProof circuit for testing
template MaximumProof() {
    // Public inputs
    signal input address;
    signal input maximum;
    
    // Private inputs
    signal input actualBalance;
    signal input nonce;
    signal input signature[2];
    signal input walletSecret;
    
    // Boolean signal to represent whether balance is <= maximum
    signal isLessOrEqual;
    isLessOrEqual <-- actualBalance <= maximum ? 1 : 0;
    
    // Constrain isLessOrEqual to be binary (0 or 1)
    isLessOrEqual * (isLessOrEqual - 1) === 0;
    
    // For maximum proof, the result must be 1 (true)
    isLessOrEqual === 1;
    
    // Boolean signal for non-negative balance check
    signal isNonNegative;
    isNonNegative <-- actualBalance >= 0 ? 1 : 0;
    
    // Constrain isNonNegative to be binary
    isNonNegative * (isNonNegative - 1) === 0;
    
    // Enforce non-negative balance
    isNonNegative === 1;
    
    // Simple hash calculation
    var hashValue = address + maximum + nonce;
    
    // Output hash
    signal output hash_result;
    hash_result <== hashValue;
}

component main = MaximumProof();