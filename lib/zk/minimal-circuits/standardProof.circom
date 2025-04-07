
pragma circom 2.0.0;

// Minimal StandardProof circuit for testing
template StandardProof() {
    // Public inputs
    signal input address;
    signal input amount;
    
    // Private inputs
    signal input nonce;
    signal input actualBalance;
    signal input signature[2];
    signal input walletSecret;
    
    // The primary constraint: actualBalance must equal amount
    actualBalance === amount;
    
    // Simple hash calculation
    var hashValue = address + amount + nonce;
    
    // Output hash
    signal output hash_result;
    hash_result <== hashValue;
}

component main = StandardProof();