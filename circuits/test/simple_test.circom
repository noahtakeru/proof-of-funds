pragma circom 2.0.0;

template SimpleTest() {
    signal input a;
    signal input b;
    signal output result;
    
    // Simple constraint: a must be greater than b
    component isGreater = IsGreater();
    isGreater.a <== a;
    isGreater.b <== b;
    
    result <== isGreater.out;
}

template IsGreater() {
    signal input a;
    signal input b;
    signal output out;
    
    // a > b is equivalent to a - b > 0
    signal diff <== a - b;
    
    // For simplicity, just output 1 if a >= b, 0 otherwise
    // In production, this would need proper comparison logic
    out <-- (diff > 0) ? 1 : 0;
    
    // Constraint to ensure out is binary
    out * (out - 1) === 0;
}

component main = SimpleTest();