// Test circuit with patched include

include "../patched-circomlib/circuits/bitify.circom";

// Custom template
template MyTestWithInclude() {
    signal input a;
    signal output b[32];
    
    component bits = Num2Bits(32);
    bits.in <== a;
    
    for (var i = 0; i < 32; i++) {
        b[i] <== bits.out[i];
    }
}

component main = MyTestWithInclude();
