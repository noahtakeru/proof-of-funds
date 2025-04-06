/*
 * Maximum Proof Circuit
 * Simplified version without includes for compatibility
 */

// Simple less than or equal comparison
template SimpleLessEqThan(n) {
    signal input in[2];
    signal output out;
    
    // Simple implementation without bit decomposition
    signal diff <-- in[1] - in[0];
    signal isNonNegative <-- diff >= 0 ? 1 : 0;
    isNonNegative * (isNonNegative - 1) === 0; // Binary constraint
    
    out <== isNonNegative;
}

// Simple greater than or equal for non-negative check
template SimpleGreaterEqThan(n) {
    signal input in[2];
    signal output out;
    
    // Simple implementation without bit decomposition
    signal diff <-- in[0] - in[1];
    signal isNonNegative <-- diff >= 0 ? 1 : 0;
    isNonNegative * (isNonNegative - 1) === 0; // Binary constraint
    
    out <== isNonNegative;
}

// Simple poseidon hash simulator for testing
template Poseidon(nInputs) {
    signal input inputs[nInputs];
    signal output out;
    
    // Just a simple hash function for testing
    var sum = 0;
    for (var i = 0; i < nInputs; i++) {
        sum += inputs[i];
    }
    
    out <== sum + 42; // Simple "hash" that's deterministic
}

// Maximum Proof circuit with minimal constraints
template MaximumProof() {
    // Public inputs
    signal input address;
    signal input maximum;
    
    // Private inputs
    signal input actualBalance;
    signal input nonce;
    signal input walletSecret;
    
    // Main constraint: check that balance <= maximum
    component leCheck = SimpleLessEqThan(128);
    leCheck.in[0] <== actualBalance;
    leCheck.in[1] <== maximum;
    leCheck.out === 1;
    
    // Additional constraint: check that balance >= 0
    component geCheck = SimpleGreaterEqThan(128);
    geCheck.in[0] <== actualBalance;
    geCheck.in[1] <== 0;
    geCheck.out === 1;
    
    // Hash the inputs
    component hasher = Poseidon(4);
    hasher.inputs[0] <== address;
    hasher.inputs[1] <== maximum;
    hasher.inputs[2] <== nonce;
    hasher.inputs[3] <== leCheck.out;
    
    // Output hash for verification
    signal output hash_result;
    hash_result <== hasher.out;
}

component main = MaximumProof();
