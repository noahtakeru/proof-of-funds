pragma circom 2.0.0;

include "./GreaterThanOrEqual.circom";

/*
 * Checks if a <= b
 * 
 * This component implements a less-than-or-equal comparison by reusing the GreaterThanOrEqual
 * component but swapping the inputs.
 * 
 * Inputs:
 * - a: First number 
 * - b: Second number
 * 
 * Outputs:
 * - out: 1 if a <= b, 0 otherwise
 */
template LessThanOrEqual(n) {
    assert(n <= 252);
    signal input a;
    signal input b;
    signal output out;
    
    // a <= b is the same as b >= a
    component gte = GreaterThanOrEqual(n);
    gte.a <== b;
    gte.b <== a;
    
    out <== gte.out;
}