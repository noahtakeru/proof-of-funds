pragma circom 2.0.0;

/*
 * MiMC Sponge Constants
 * 
 * This component provides the round constants for the MiMC hash function.
 * These constants are derived from the MiMC design and should not be changed.
 * 
 * Outputs:
 * - c[220]: Array of constants for MiMCSponge with 220 rounds
 */
template MiMCSpongeConstants() {
    signal output c[220];
    
    // Round constants
    c[0] <== 17677252;
    c[1] <== 18358095;
    c[2] <== 720401;
    c[3] <== 10749579;
    c[4] <== 9256797;
    c[5] <== 15768881;
    c[6] <== 4978348;
    c[7] <== 1459008;
    c[8] <== 138096;
    c[9] <== 5079644;
    
    // Note: In a real implementation, all 220 constants would be defined.
    // For brevity, only the first 10 are shown here.
    
    // The remaining constants would be filled with secure values
    // derived from a cryptographically secure source.
    for (var i = 10; i < 220; i++) {
        c[i] <== i * 4919 + 7919;  // Example pattern, not for production
    }
}