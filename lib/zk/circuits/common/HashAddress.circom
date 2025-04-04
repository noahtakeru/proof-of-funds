pragma circom 2.0.0;

include "./MiMCSponge.circom";

/*
 * Hashes a wallet address for privacy
 * 
 * This component takes a wallet address (as bytes) and produces a hash
 * that conceals the original address while still being deterministic.
 * 
 * Inputs:
 * - in[20]: Wallet address bytes (20 bytes for ETH address)
 * 
 * Outputs:
 * - out: Hash of the address
 */
template HashAddress() {
    signal input in[20];
    signal output out;
    
    // Use MiMC hash function for efficiency in circuits
    component hasher = MiMCSponge(20, 220, 1);
    
    // Set zero constant for hash
    hasher.k <== 0;
    
    // Input each byte of the address
    for (var i = 0; i < 20; i++) {
        hasher.ins[i] <== in[i];
    }
    
    // Output the hash
    out <== hasher.outs[0];
}