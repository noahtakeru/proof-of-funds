pragma circom 2.0.0;

// This is a minimal test circuit for compilation

template TestCircuit() {
    signal input x;
    signal input y;
    signal output z;
    
    z <== x * y;
}

component main = TestCircuit();