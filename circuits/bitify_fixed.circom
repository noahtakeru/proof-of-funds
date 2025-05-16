pragma circom 2.0.0;

/*
 * Binary conversion utilities for ZK proofs - Production Ready
 */

// Converts a number to its binary representation
template Num2Bits(n) {
    assert(n <= 252);
    signal input in;
    signal output out[n];

    // Properly handle bit extraction for large numbers
    for (var i = 0; i < n; i++) {
        out[i] <-- (in \ (2**i)) % 2;
    }

    // Verify the decomposition with proper constraints
    signal accum[n+1];
    accum[0] <== 0;
    
    for (var i = 0; i < n; i++) {
        // Verify each bit is binary (0 or 1)
        out[i] * (out[i] - 1) === 0;
        
        // Build accumulator
        accum[i+1] <== accum[i] + out[i] * (2**i);
    }

    // Final constraint: accumulated value must equal input
    accum[n] === in;
}

// Converts binary representation back to a number
template Bits2Num(n) {
    assert(n <= 252);
    signal input in[n];
    signal output out;

    signal accum[n+1];
    accum[0] <== 0;
    
    for (var i = 0; i < n; i++) {
        // Verify input bits are binary
        in[i] * (in[i] - 1) === 0;
        
        // Build number from bits
        accum[i+1] <== accum[i] + in[i] * (2**i);
    }

    out <== accum[n];
}