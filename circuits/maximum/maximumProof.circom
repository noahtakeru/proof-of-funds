pragma circom 2.0.0;

include "../comparators.circom";
include "../bitify.circom";

template MaximumVerifier() {
    signal input maxBalance;
    signal input threshold;
    signal input userAddress;
    signal input networks[4];
    
    signal output valid;
    
    // Convert to bits for comparison
    component balanceBits = Num2Bits(252);
    balanceBits.in <== maxBalance;
    
    component thresholdBits = Num2Bits(252);
    thresholdBits.in <== threshold;
    
    // Check if maxBalance < threshold (below maximum)
    component lt = LessThan(252);
    for (var i = 0; i < 252; i++) {
        lt.a[i] <== balanceBits.out[i];
        lt.b[i] <== thresholdBits.out[i];
    }
    
    valid <== lt.out;
}

component main = MaximumVerifier();
