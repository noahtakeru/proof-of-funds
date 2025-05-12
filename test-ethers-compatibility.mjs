/**
 * Simple test script for ethers.js compatibility
 * Run with `node test-ethers-compatibility.mjs`
 */

import ethersUtils from './packages/common/src/utils/ethersUtils.js';

async function runTests() {
  console.log('===== Testing Ethers.js Compatibility Enhancement =====');
  
  try {
    console.log('\n--- Testing getEthers() ---');
    const ethersObj = await ethersUtils.getEthers();
    console.log('Ethers object:', {
      version: ethersObj.version,
      isV5: ethersObj.isV5,
      isV6: ethersObj.isV6,
      hasEthersObject: !!ethersObj.ethers,
    });
    
    console.log('\n--- Testing parseUnits() ---');
    const parsedUnits1 = await ethersUtils.parseUnits('10.5', 18);
    console.log('parseUnits(10.5, 18):', parsedUnits1.toString());
    
    const parsedUnits2 = await ethersUtils.parseUnits('100', 6);
    console.log('parseUnits(100, 6):', parsedUnits2.toString());
    
    console.log('\n--- Testing parseEther() ---');
    const parsedEther = await ethersUtils.parseEther('1.5');
    console.log('parseEther(1.5):', parsedEther.toString());
    
    console.log('\n--- Testing fallbackParseUnits() ---');
    const fallbackParsed1 = ethersUtils.fallbackParseUnits('10.5', 18);
    console.log('fallbackParseUnits(10.5, 18):', fallbackParsed1);
    
    const fallbackParsed2 = ethersUtils.fallbackParseUnits('100', 6);
    console.log('fallbackParseUnits(100, 6):', fallbackParsed2);
    
    console.log('\n--- Testing parseAmount() ---');
    const amount1 = await ethersUtils.parseAmount('10.5');
    console.log('parseAmount(10.5):', amount1);
    
    const amount2 = await ethersUtils.parseAmount('');
    console.log('parseAmount(""):', amount2);
    
    const amount3 = await ethersUtils.parseAmount('invalid');
    console.log('parseAmount("invalid"):', amount3);
    
    console.log('\n--- Testing isValidAmount() ---');
    console.log('isValidAmount(10):', ethersUtils.isValidAmount(10));
    console.log('isValidAmount("10.5"):', ethersUtils.isValidAmount('10.5'));
    console.log('isValidAmount(""):', ethersUtils.isValidAmount(''));
    console.log('isValidAmount("invalid"):', ethersUtils.isValidAmount('invalid'));
    
    console.log('\n✅ All tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Tests failed:', error);
  }
}

runTests();