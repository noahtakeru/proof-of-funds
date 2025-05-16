pragma circom 2.0.0;

include "../comparators.circom";
include "../bitify.circom";

template ThresholdVerifier() {
    signal input totalBalance;
    signal input threshold;
    signal input userAddress;
    signal input networkId;
    
    signal output valid;
    
    // Convert to bits for comparison
    component balanceBits = Num2Bits(252);
    balanceBits.in <== totalBalance;
    
    component thresholdBits = Num2Bits(252);
    thresholdBits.in <== threshold;
    
    // Check if totalBalance >= threshold
    component gte = GreaterEqThan(252);
    for (var i = 0; i < 252; i++) {
        gte.a[i] <== balanceBits.out[i];
        gte.b[i] <== thresholdBits.out[i];
    }
    
    valid <== gte.out;
}

component main = ThresholdVerifier();
