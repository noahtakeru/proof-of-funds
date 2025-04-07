
pragma circom 2.0.0;

template Num2Bits(n) {
    signal input in;
    signal output out[n];
    
    var lc = 0;
    
    for (var i = 0; i < n; i++) {
        out[i] <-- (in >> i) & 1;
        out[i] * (out[i] - 1) === 0;
        lc += out[i] * (1 << i);
    }
    
    lc === in;
}

template Bits2Num(n) {
    signal input in[n];
    signal output out;
    
    var lc = 0;
    
    for (var i = 0; i < n; i++) {
        lc += in[i] * (1 << i);
    }
    
    out <== lc;
}
          