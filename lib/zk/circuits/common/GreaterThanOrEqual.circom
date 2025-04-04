pragma circom 2.0.0;

/*
 * Checks if a >= b
 * 
 * This component implements a greater-than-or-equal comparison using bit decomposition.
 * It works for numbers up to n bits.
 * 
 * Inputs:
 * - a: First number 
 * - b: Second number
 * 
 * Outputs:
 * - out: 1 if a >= b, 0 otherwise
 */
template GreaterThanOrEqual(n) {
    assert(n <= 252);
    signal input a;
    signal input b;
    signal output out;

    // Compute 2^n - 1
    signal n2m1 <-- (1 << n) - 1;
    signal diff <-- (a - b) % (1 << n);
    signal msb;
    
    // Check if MSB is set (a < b)
    msb <-- (diff >> (n-1)) & 1;
    
    component n2b = Num2Bits(n);
    n2b.in <== diff;
    
    // out is 1 if a >= b, 0 otherwise
    out <== 1 - msb;
    
    // Constrain that out is 0 or 1
    out * (1 - out) === 0;
}

/* 
 * Converts a number to its binary representation
 * 
 * This is a utility template used by the comparison circuits.
 */
template Num2Bits(n) {
    signal input in;
    signal output out[n];
    var lc1=0;

    for (var i = 0; i < n; i++) {
        out[i] <-- (in >> i) & 1;
        out[i] * (out[i] - 1) === 0;
        lc1 += out[i] * (1 << i);
    }

    lc1 === in;
}