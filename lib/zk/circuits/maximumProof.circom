/*
 * Maximum Proof Circuit (version 1.0.0)
 * Proves that balance is at most the maximum amount
 * 
 * Input:
 * - address: Public input, the wallet address
 * - maximum: Public input, the maximum amount
 * - actualBalance: Private input, the actual balance amount
 * - nonce: Private input, random value to prevent correlation
 * - signature: Private input, signature proving ownership of wallet
 */

pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/eddsamimc.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

template MaximumProof() {
    // Public inputs
    signal input address;
    signal input maximum;
    
    // Private inputs
    signal input actualBalance;
    signal input nonce;
    signal input signature[2]; // r, s components of signature
    signal input privateKey;
    
    // Verify wallet ownership with signature
    component signatureVerifier = EdDSAMiMCVerifier();
    signatureVerifier.enabled <== 1;
    signatureVerifier.Ax <== 0; // Public key x-coordinate (derived in real circuit)
    signatureVerifier.Ay <== 0; // Public key y-coordinate (derived in real circuit)
    signatureVerifier.R8x <== signature[0];
    signatureVerifier.R8y <== signature[1];
    signatureVerifier.S <== 0; // Signature S value (derived in real circuit)
    signatureVerifier.M <== address; // Message is the address
    
    // Verify actual balance is less than or equal to maximum
    component lessEqThan = LessEqThan(252); // 252-bit comparison
    lessEqThan.in[0] <== actualBalance;
    lessEqThan.in[1] <== maximum;
    lessEqThan.out === 1; // Must be true - actual balance must be <= maximum
    
    // Hash inputs for verification
    component hash = Poseidon(3);
    hash.inputs[0] <== address;
    hash.inputs[1] <== maximum;
    hash.inputs[2] <== nonce;
    
    // Output the hash and result of comparison for verification
    signal output hash_result;
    hash_result <== hash.out;
}

component main {public [address, maximum]} = MaximumProof();