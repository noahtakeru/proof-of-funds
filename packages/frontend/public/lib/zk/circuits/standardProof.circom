pragma circom 2.0.0;

include "../comparators.circom";
include "../bitify.circom";

template BalanceVerifier() {
    signal input balance;
    signal input threshold;
    signal input userAddress;
    
    signal output valid;
    
    // Convert to bits for comparison
    component balanceBits = Num2Bits(252);
    balanceBits.in <== balance;
    
    component thresholdBits = Num2Bits(252);
    thresholdBits.in <== threshold;
    
    // Check if balance == threshold (exact match)
    component isEqual = IsEqual(252);
    for (var i = 0; i < 252; i++) {
        isEqual.a[i] <== balanceBits.out[i];
        isEqual.b[i] <== thresholdBits.out[i];
    }
    
    valid <== isEqual.out;
}

component main = BalanceVerifier();
