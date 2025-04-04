pragma circom 2.0.0;

/*
 * Checks if an amount matches an expected amount
 * 
 * This component implements a simple equality check for amounts.
 * 
 * Inputs:
 * - actualAmount: The amount to check
 * - expectedAmount: The expected amount
 * 
 * Outputs:
 * - result: 1 if equal, 0 otherwise
 */
template AmountCheck() {
    signal input actualAmount;
    signal input expectedAmount;
    signal output result;
    
    // Check equality
    result <-- (actualAmount == expectedAmount) ? 1 : 0;
    
    // Constrain result to be 0 or 1
    result * (1 - result) === 0;
    
    // Enforce the constraint that result is 1 only if amounts are equal
    (actualAmount - expectedAmount) * result === 0;
}