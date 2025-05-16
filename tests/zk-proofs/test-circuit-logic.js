/**
 * Test Circuit Logic
 * 
 * This script tests the logic of each circuit type
 * to ensure they follow the correct rules:
 * - Standard: balance == threshold (exact)
 * - Threshold: balance >= threshold (at least)
 * - Maximum: balance < threshold (below)
 */

async function testCircuitLogic() {
    console.log('===== ZK CIRCUIT LOGIC TESTS =====\n');
    
    // Test cases for each circuit type
    const testCases = {
        standard: [
            { balance: 1000, threshold: 1000, expected: true, description: 'Equal values should pass' },
            { balance: 1000, threshold: 999, expected: false, description: 'Balance > threshold should fail' },
            { balance: 1000, threshold: 1001, expected: false, description: 'Balance < threshold should fail' }
        ],
        threshold: [
            { balance: 1000, threshold: 1000, expected: true, description: 'Equal values should pass' },
            { balance: 1000, threshold: 999, expected: true, description: 'Balance > threshold should pass' },
            { balance: 1000, threshold: 1001, expected: false, description: 'Balance < threshold should fail' }
        ],
        maximum: [
            { balance: 1000, threshold: 1001, expected: true, description: 'Balance < threshold should pass' },
            { balance: 1000, threshold: 1000, expected: false, description: 'Equal values should fail' },
            { balance: 1000, threshold: 999, expected: false, description: 'Balance > threshold should fail' }
        ]
    };
    
    // Circuit logic definitions
    const circuitLogic = {
        standard: (balance, threshold) => balance === threshold,
        threshold: (balance, threshold) => balance >= threshold,
        maximum: (balance, threshold) => balance < threshold
    };
    
    // Test each circuit type
    for (const [circuitType, cases] of Object.entries(testCases)) {
        console.log(`\nTesting ${circuitType.toUpperCase()} circuit logic:`);
        console.log('=====================================');
        
        for (const testCase of cases) {
            const result = circuitLogic[circuitType](testCase.balance, testCase.threshold);
            const passed = result === testCase.expected;
            
            console.log(`${passed ? '✅' : '❌'} ${testCase.description}`);
            console.log(`   Balance: ${testCase.balance}, Threshold: ${testCase.threshold}`);
            console.log(`   Expected: ${testCase.expected}, Got: ${result}`);
            
            if (!passed) {
                console.log(`   ERROR: Circuit logic does not match expected behavior!`);
            }
        }
    }
    
    console.log('\n===== CIRCUIT LOGIC SUMMARY =====');
    console.log('Standard: balance == threshold (EXACT match)');
    console.log('Threshold: balance >= threshold (AT LEAST)');
    console.log('Maximum: balance < threshold (BELOW)');
}

// Run tests
testCircuitLogic().catch(error => {
    console.error('Test execution error:', error);
});