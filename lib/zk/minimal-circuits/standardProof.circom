pragma circom 2.0.0;

template StandardProof() {
    signal input address;
    signal input amount;
    
    signal input actualBalance;
    signal input nonce;
    
    // Main constraint
    actualBalance === amount;
    
    // Output
    signal output hash_result;
    hash_result <== nonce;
}

component main {public [address, amount]} = StandardProof();
