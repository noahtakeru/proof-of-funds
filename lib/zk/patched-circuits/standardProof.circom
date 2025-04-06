/*
 * Standard Proof Circuit
 * Simplified version without includes for compatibility
 */

// Custom Num2Bits template (copied from circomlib)
template Num2Bits(n) {
    signal input in;
    signal output out[n];
    var lc1=0;

    var e2=1;
    for (var i = 0; i<n; i++) {
        out[i] <-- (in >> i) & 1;
        out[i] * (out[i] -1 ) === 0;
        lc1 += out[i] * e2;
        e2 = e2+e2;
    }

    lc1 === in;
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

// Standard Proof circuit with minimal constraints
template StandardProof() {
    // Public inputs
    signal input address;
    signal input amount;
    
    // Private inputs
    signal input actualBalance;
    signal input nonce;
    signal input walletSecret;
    
    // Key constraint: balance matches claimed amount
    actualBalance === amount;
    
    // Hash the inputs
    component hasher = Poseidon(3);
    hasher.inputs[0] <== address;
    hasher.inputs[1] <== amount;
    hasher.inputs[2] <== nonce;
    
    // Output hash for verification
    signal output hash_result;
    hash_result <== hasher.out;
}

component main = StandardProof();
