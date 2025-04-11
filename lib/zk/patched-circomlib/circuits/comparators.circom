
pragma circom 2.0.0;
include "./bitify.circom";

template LessThan(n) {
    assert(n <= 252);
    signal input in[2];
    signal output out;

    component n2b = Num2Bits(n+1);
    n2b.in <== in[0] - in[1] + (1 << n);
    out <== 1 - n2b.out[n];
}

template GreaterThan(n) {
    assert(n <= 252);
    signal input in[2];
    signal output out;
    
    component lt = LessThan(n);
    lt.in[0] <== in[1];
    lt.in[1] <== in[0];
    out <== lt.out;
}

template GreaterEqThan(n) {
    assert(n <= 252);
    signal input in[2];
    signal output out;
    
    component lt = LessThan(n);
    lt.in[0] <== in[1];
    lt.in[1] <== in[0];
    out <== 1 - lt.out;
}

template LessEqThan(n) {
    assert(n <= 252);
    signal input in[2];
    signal output out;
    
    component gt = GreaterThan(n);
    gt.in[0] <== in[0];
    gt.in[1] <== in[1];
    out <== 1 - gt.out;
}

template IsEqual() {
    signal input in[2];
    signal output out;
    
    signal diff <== in[0] - in[1];
    signal isZero <== diff == 0 ? 1 : 0;
    out <== isZero;
}