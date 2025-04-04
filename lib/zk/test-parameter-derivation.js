/**
 * Simple test script for zkCircuitParameterDerivation
 */
import * as paramDerivation from './zkCircuitParameterDerivation.js';

// Test wallet address
const testAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
const testAmount = '1000000000000000000'; // 1 ETH

console.log('\n=== Testing Standard Proof Parameters ===');
try {
  const standardParams = paramDerivation.deriveStandardProofParameters({
    walletAddress: testAddress,
    amount: testAmount
  });
  
  console.log('Standard Proof Parameters:');
  console.log('Public Inputs:', standardParams.publicInputs);
  console.log('Metadata:', standardParams.metadata);
  console.log('✅ Standard proof parameters generated successfully');
} catch (error) {
  console.error('❌ Error generating standard proof parameters:', error);
}

console.log('\n=== Testing Threshold Proof Parameters ===');
try {
  const thresholdParams = paramDerivation.deriveThresholdProofParameters({
    walletAddress: testAddress,
    amount: '1.0',  // 1 ETH threshold
    actualBalance: '2.0'  // 2 ETH actual balance
  });
  
  console.log('Threshold Proof Parameters:');
  console.log('Public Inputs:', thresholdParams.publicInputs);
  console.log('Metadata:', thresholdParams.metadata);
  console.log('✅ Threshold proof parameters generated successfully');
} catch (error) {
  console.error('❌ Error generating threshold proof parameters:', error);
}

console.log('\n=== Testing Maximum Proof Parameters ===');
try {
  const maximumParams = paramDerivation.deriveMaximumProofParameters({
    walletAddress: testAddress,
    amount: '2.0',  // 2 ETH maximum
    actualBalance: '1.0'  // 1 ETH actual balance
  });
  
  console.log('Maximum Proof Parameters:');
  console.log('Public Inputs:', maximumParams.publicInputs);
  console.log('Metadata:', maximumParams.metadata);
  console.log('✅ Maximum proof parameters generated successfully');
} catch (error) {
  console.error('❌ Error generating maximum proof parameters:', error);
}

console.log('\n=== Testing Amount Normalization ===');
try {
  const wei = paramDerivation.normalizeAmountForCircuit('1.5', 18);
  console.log('Normalized 1.5 ETH to wei:', wei);
  console.log('✅ Amount normalization successful');
} catch (error) {
  console.error('❌ Error normalizing amount:', error);
}

console.log('\n=== Testing Address Derivation ===');
try {
  const addressParams = paramDerivation.deriveAddressParameters(testAddress);
  console.log('Address bytes length:', addressParams.bytes.length);
  console.log('Address hash:', addressParams.hash.substring(0, 10) + '...');
  console.log('✅ Address derivation successful');
} catch (error) {
  console.error('❌ Error deriving address parameters:', error);
}

console.log('\n=== Testing Parameter Validation ===');
try {
  const validParams = paramDerivation.deriveStandardProofParameters({
    walletAddress: testAddress,
    amount: testAmount
  });
  
  const validationResult = paramDerivation.validateCircuitParameters(validParams);
  console.log('Validation result:', validationResult);
  console.log('✅ Parameter validation successful');
} catch (error) {
  console.error('❌ Error validating parameters:', error);
}

console.log('\n=== End of Tests ===');