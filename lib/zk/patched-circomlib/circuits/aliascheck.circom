
pragma circom 2.0.0;

template AliasCheck() {
    signal input in[1];
    signal output out[1];
    
    out[0] <== in[0];
}
          