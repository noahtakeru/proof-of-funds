pragma circom 2.0.0;

/*
 * Comparator circuits for ZK proofs
 * Fixed version with proper scoping
 */

// Basic equality check for single bits
template EqualBit() {
    signal input a;
    signal input b;
    signal output out;
    
    out <== 1 - (a - b) * (a - b);
}

// Checks if a is less than b
template LessThan(n) {
    assert(n <= 252);
    signal input a[n];
    signal input b[n];
    signal output out;

    signal isLess[n+1];
    isLess[0] <== 0;

    component equalBit[n];
    signal equalSoFar[n+1];
    equalSoFar[0] <== 1;
    
    signal notA[n];
    signal diffBit[n];
    signal temp[n];
    
    for (var i = 0; i < n; i++) {
        equalBit[i] = EqualBit();
        equalBit[i].a <== a[n-1-i];
        equalBit[i].b <== b[n-1-i];
        
        equalSoFar[i+1] <== equalSoFar[i] * equalBit[i].out;
        
        // Break non-quadratic constraint into quadratic ones
        notA[i] <== 1 - a[n-1-i];
        diffBit[i] <== notA[i] * b[n-1-i];
        temp[i] <== equalSoFar[i] * diffBit[i];
        isLess[i+1] <== temp[i] + isLess[i];
    }

    out <== isLess[n];
}

// Checks if a is greater than or equal to b
template GreaterEqThan(n) {
    signal input a[n];
    signal input b[n];
    signal output out;

    component lt = LessThan(n);
    for (var i = 0; i < n; i++) {
        lt.a[i] <== b[i];
        lt.b[i] <== a[i];
    }

    component isEqual = IsEqual(n);
    for (var i = 0; i < n; i++) {
        isEqual.a[i] <== a[i];
        isEqual.b[i] <== b[i];
    }

    out <== lt.out + isEqual.out;
}

// Checks if a equals b
template IsEqual(n) {
    signal input a[n];
    signal input b[n];
    signal output out;

    signal equal[n];
    for (var i = 0; i < n; i++) {
        equal[i] <== 1 - (a[i] - b[i]) * (a[i] - b[i]);
    }

    signal product[n+1];
    product[0] <== 1;
    for (var i = 0; i < n; i++) {
        product[i+1] <== product[i] * equal[i];
    }

    out <== product[n];
}
