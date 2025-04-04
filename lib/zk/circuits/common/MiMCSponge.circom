pragma circom 2.0.0;

include "mimcsponge_constants.circom";

/*
 * MiMC hash function (Sponge construction)
 * 
 * This is an efficient hash function designed for ZK circuits
 * based on the MiMC cipher in a sponge construction.
 * 
 * Parameters:
 * - nInputs: Number of inputs
 * - nRounds: Number of rounds in the MiMC permutation
 * - nOutputs: Number of outputs
 * 
 * Inputs:
 * - ins[nInputs]: Input values
 * - k: Arbitrary constant (can be zero)
 * 
 * Outputs:
 * - outs[nOutputs]: Output hash values
 */
template MiMCSponge(nInputs, nRounds, nOutputs) {
    signal input ins[nInputs];
    signal input k;
    signal output outs[nOutputs];
    
    // Constants from MiMC design
    component constants = MiMCSpongeConstants();
    
    // State for the sponge construction
    signal state[nInputs + nOutputs + 1];
    state[0] <== k;
    
    // Sponge absorption phase
    for (var i = 0; i < nInputs; i++) {
        state[i+1] <== MiMCFeistel(nRounds)(ins[i], state[i], constants.c);
    }
    
    // Sponge squeezing phase
    for (var i = 0; i < nOutputs; i++) {
        state[nInputs+i+1] <== MiMCFeistel(nRounds)(0, state[nInputs+i], constants.c);
        outs[i] <== state[nInputs+i+1];
    }
}

/*
 * MiMC Feistel construction
 * 
 * This is the core permutation function used in MiMC.
 */
template MiMCFeistel(nRounds) {
    signal input xL_in;
    signal input xR_in;
    signal input c[nRounds];
    signal output out;
    
    // Initialize the Feistel network state
    signal xL[nRounds+1];
    signal xR[nRounds+1];
    
    xL[0] <== xL_in;
    xR[0] <== xR_in;
    
    // Apply nRounds of the Feistel transformation
    for (var i = 0; i < nRounds; i++) {
        var t = (i==0) ? xL[i] : xL[i] + c[i];
        
        // MiMC encryption step: x^3
        var t2 = t * t;
        var t4 = t2 * t2;
        var t6 = t4 * t2;
        
        xL[i+1] <== xR[i];
        xR[i+1] <== xL[i] + t6;
    }
    
    // Output the result
    out <== xL[nRounds] + xR[nRounds];
}