pragma circom 2.0.0;

include "circomlib/poseidon.circom";
include "circomlib/comparators.circom";

/*
 * Balance Verification Circuit
 *
 * This circuit allows a wallet owner to prove statements about their balance
 * without revealing the actual balance.
 *
 * Proof Types:
 * 0 = Standard (Equal): Balance is exactly equal to threshold
 * 1 = Threshold (Greater Than or Equal): Balance is ≥ threshold
 * 2 = Maximum (Less Than or Equal): Balance is ≤ threshold
 */
template BalanceVerification() {
    // Public inputs (will be visible in the proof)
    signal input walletAddress;  // Address of the wallet (as a field element)
    signal input threshold;      // Threshold value for comparison
    signal input proofType;      // 0=standard, 1=threshold, 2=maximum
    
    // Private inputs (kept hidden)
    signal input balance;        // Actual wallet balance
    
    // Public outputs
    signal output addressHash;   // Hash of the wallet address (for privacy)
    signal output thresholdHash; // Hash of the threshold (for privacy)
    signal output proofTypeOut;  // Type of proof being performed
    signal output result;        // Result of the proof (1 = true, 0 = false)
    
    // Calculate hashes for public outputs
    component addressHasher = Poseidon(1);
    addressHasher.inputs[0] <== walletAddress;
    addressHash <== addressHasher.out;
    
    component thresholdHasher = Poseidon(1);
    thresholdHasher.inputs[0] <== threshold;
    thresholdHash <== thresholdHasher.out;
    
    // Verify the proof type is valid (0, 1, or 2)
    signal validProofType;
    validProofType <== (proofType * (proofType - 1) * (proofType - 2)) === 0;
    
    // Output the proof type
    proofTypeOut <== proofType;
    
    // Perform the comparison based on proof type
    component isEqual = IsEqual();
    isEqual.in[0] <== balance;
    isEqual.in[1] <== threshold;
    
    component isGreaterOrEqual = GreaterEqThan(252); // 252-bit numbers
    isGreaterOrEqual.in[0] <== balance;
    isGreaterOrEqual.in[1] <== threshold;
    
    component isLessOrEqual = LessEqThan(252); // 252-bit numbers
    isLessOrEqual.in[0] <== balance;
    isLessOrEqual.in[1] <== threshold;
    
    // Select the appropriate result based on the proof type
    signal standardResult <== isEqual.out;
    signal thresholdResult <== isGreaterOrEqual.out;
    signal maximumResult <== isLessOrEqual.out;
    
    // Use conditional logic to select the correct result
    signal isTypeStandard <== (proofType == 0);
    signal isTypeThreshold <== (proofType == 1);
    signal isTypeMaximum <== (proofType == 2);
    
    result <== 
        isTypeStandard * standardResult + 
        isTypeThreshold * thresholdResult + 
        isTypeMaximum * maximumResult;
}

component main {public [walletAddress, threshold, proofType]} = BalanceVerification();