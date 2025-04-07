/**
 * Gas Benchmark Runner for ZK Circuits
 * 
 * This script performs gas benchmarking for on-chain verification of
 * zero-knowledge proofs using the ProofOfFunds and ZKVerifier contracts.
 * 
 * It measures gas costs for:
 * 1. Standard Proof verification (exact amount)
 * 2. Threshold Proof verification (minimum amount)
 * 3. Maximum Proof verification (maximum amount)
 * 4. Batch verification of multiple proofs
 * 
 * Results are saved to a report file and compared against target gas thresholds.
 */

// Required imports
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const { GasManager, GAS_TARGETS, calculateGasSavings } = require('./GasManager.js');

// Constants
const CONTRACT_ADDRESSES = {
  PROOF_OF_FUNDS: '0x123...', // Replace with actual deployed address
  ZK_VERIFIER: '0x456...'     // Replace with actual deployed address
};

// Contract ABIs (simplified for this example)
const PROOF_OF_FUNDS_ABI = [
  'function submitProof(uint8 _proofType, bytes32 _proofHash, uint256 _expiryTime, uint256 _thresholdAmount, string _signatureMessage, bytes _signature)',
  'function verifyStandardProof(address _user, uint256 _claimedAmount) view returns (bool)',
  'function verifyThresholdProof(address _user, uint256 _minimumAmount) view returns (bool)',
  'function verifyMaximumProof(address _user, uint256 _maximumAmount) view returns (bool)'
];

const ZK_VERIFIER_ABI = [
  'function submitZKProof(bytes _proof, bytes _publicSignals, uint256 _expiryTime, uint8 _proofType, string _signatureMessage, bytes _signature)',
  'function verifyZKProof(address _user) view returns (bool)'
];

/**
 * Run gas benchmarks for all proof types
 * @param {Object} provider - Ethers.js provider
 * @param {Object} signer - Ethers.js signer
 */
async function runGasBenchmarks(provider, signer) {
  console.log('Starting Gas Benchmarks...');
  
  // Create contract instances
  const proofOfFunds = new ethers.Contract(
    CONTRACT_ADDRESSES.PROOF_OF_FUNDS,
    PROOF_OF_FUNDS_ABI,
    signer
  );
  
  const zkVerifier = new ethers.Contract(
    CONTRACT_ADDRESSES.ZK_VERIFIER,
    ZK_VERIFIER_ABI,
    signer
  );
  
  // Initialize Gas Manager
  const gasManager = new GasManager(provider);
  
  // Results storage
  const results = {
    timestamp: new Date().toISOString(),
    network: await provider.getNetwork().then(n => ({ name: n.name, chainId: n.chainId })),
    gasPrice: await provider.getGasPrice().then(p => p.toString()),
    proofs: {
      standard: [],
      threshold: [],
      maximum: []
    },
    batch: [],
    targets: {
      standard: GAS_TARGETS.STANDARD.SINGLE,
      threshold: GAS_TARGETS.THRESHOLD.SINGLE,
      maximum: GAS_TARGETS.MAXIMUM.SINGLE,
      batch10: GAS_TARGETS.STANDARD.BATCH_10
    }
  };
  
  // Sample data for testing
  const testAddress = await signer.getAddress();
  const standardAmount = ethers.utils.parseEther('10');
  const thresholdAmount = ethers.utils.parseEther('100');
  const maximumAmount = ethers.utils.parseEther('1000');
  const expiryTime = Math.floor(Date.now() / 1000) + 86400; // 1 day
  const signatureMessage = 'Gas Benchmark Test';
  const signature = '0x'; // Empty signature for testing
  
  // Benchmark rounds
  const ROUNDS = 5;
  
  // Run standard proof benchmarks
  console.log(`Running Standard Proof Benchmarks (${ROUNDS} rounds)...`);
  for (let i = 0; i < ROUNDS; i++) {
    // Generate unique hash for each round
    const proofHash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ['address', 'uint256', 'uint8', 'uint256'],
        [testAddress, standardAmount, 0, i]
      )
    );
    
    // Submit standard proof
    const submitTx = await proofOfFunds.submitProof(
      0, // STANDARD type
      proofHash,
      expiryTime,
      0, // No threshold for standard proofs
      signatureMessage,
      signature,
      { gasLimit: 500000 } // Safe gas limit
    );
    
    // Wait for transaction to be mined
    const receipt = await submitTx.wait();
    const submitGasUsed = receipt.gasUsed.toNumber();
    console.log(`  Round ${i+1}: Submit: ${submitGasUsed} gas`);
    
    // Record gas usage for submission
    results.proofs.standard.push({
      operation: 'submit',
      gasUsed: submitGasUsed,
      txHash: receipt.transactionHash
    });
    
    // Estimate gas for verification (view function)
    const verifyGasEstimate = await proofOfFunds.estimateGas.verifyStandardProof(
      testAddress,
      standardAmount
    );
    
    console.log(`  Round ${i+1}: Verify: ${verifyGasEstimate.toNumber()} gas`);
    
    // Record gas usage for verification
    results.proofs.standard.push({
      operation: 'verify',
      gasUsed: verifyGasEstimate.toNumber(),
      round: i
    });
    
    // Record in gas manager for analysis
    gasManager.recordGasUsage('standard', verifyGasEstimate.toNumber(), { round: i });
  }
  
  // Run threshold proof benchmarks
  console.log(`\nRunning Threshold Proof Benchmarks (${ROUNDS} rounds)...`);
  for (let i = 0; i < ROUNDS; i++) {
    // Generate unique hash for each round
    const proofHash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ['address', 'uint256', 'uint8', 'uint256'],
        [testAddress, thresholdAmount, 1, i]
      )
    );
    
    // Submit threshold proof
    const submitTx = await proofOfFunds.submitProof(
      1, // THRESHOLD type
      proofHash,
      expiryTime,
      thresholdAmount,
      signatureMessage,
      signature,
      { gasLimit: 500000 } // Safe gas limit
    );
    
    // Wait for transaction to be mined
    const receipt = await submitTx.wait();
    const submitGasUsed = receipt.gasUsed.toNumber();
    console.log(`  Round ${i+1}: Submit: ${submitGasUsed} gas`);
    
    // Record gas usage for submission
    results.proofs.threshold.push({
      operation: 'submit',
      gasUsed: submitGasUsed,
      txHash: receipt.transactionHash
    });
    
    // Estimate gas for verification (view function)
    const verifyGasEstimate = await proofOfFunds.estimateGas.verifyThresholdProof(
      testAddress,
      thresholdAmount
    );
    
    console.log(`  Round ${i+1}: Verify: ${verifyGasEstimate.toNumber()} gas`);
    
    // Record gas usage for verification
    results.proofs.threshold.push({
      operation: 'verify',
      gasUsed: verifyGasEstimate.toNumber(),
      round: i
    });
    
    // Record in gas manager for analysis
    gasManager.recordGasUsage('threshold', verifyGasEstimate.toNumber(), { round: i });
  }
  
  // Run maximum proof benchmarks
  console.log(`\nRunning Maximum Proof Benchmarks (${ROUNDS} rounds)...`);
  for (let i = 0; i < ROUNDS; i++) {
    // Generate unique hash for each round
    const proofHash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ['address', 'uint256', 'uint8', 'uint256'],
        [testAddress, maximumAmount, 2, i]
      )
    );
    
    // Submit maximum proof
    const submitTx = await proofOfFunds.submitProof(
      2, // MAXIMUM type
      proofHash,
      expiryTime,
      maximumAmount,
      signatureMessage,
      signature,
      { gasLimit: 500000 } // Safe gas limit
    );
    
    // Wait for transaction to be mined
    const receipt = await submitTx.wait();
    const submitGasUsed = receipt.gasUsed.toNumber();
    console.log(`  Round ${i+1}: Submit: ${submitGasUsed} gas`);
    
    // Record gas usage for submission
    results.proofs.maximum.push({
      operation: 'submit',
      gasUsed: submitGasUsed,
      txHash: receipt.transactionHash
    });
    
    // Estimate gas for verification (view function)
    const verifyGasEstimate = await proofOfFunds.estimateGas.verifyMaximumProof(
      testAddress,
      maximumAmount
    );
    
    console.log(`  Round ${i+1}: Verify: ${verifyGasEstimate.toNumber()} gas`);
    
    // Record gas usage for verification
    results.proofs.maximum.push({
      operation: 'verify',
      gasUsed: verifyGasEstimate.toNumber(),
      round: i
    });
    
    // Record in gas manager for analysis
    gasManager.recordGasUsage('maximum', verifyGasEstimate.toNumber(), { round: i });
  }
  
  // Generate gas report
  const gasReport = gasManager.generateGasReport();
  results.report = gasReport;
  
  // Calculate averages
  results.averages = {
    standard: calculateAverage(results.proofs.standard.filter(r => r.operation === 'verify').map(r => r.gasUsed)),
    threshold: calculateAverage(results.proofs.threshold.filter(r => r.operation === 'verify').map(r => r.gasUsed)),
    maximum: calculateAverage(results.proofs.maximum.filter(r => r.operation === 'verify').map(r => r.gasUsed))
  };
  
  // Target assessment
  results.targetAssessment = {
    standard: assessTarget(results.averages.standard, GAS_TARGETS.STANDARD.SINGLE),
    threshold: assessTarget(results.averages.threshold, GAS_TARGETS.THRESHOLD.SINGLE),
    maximum: assessTarget(results.averages.maximum, GAS_TARGETS.MAXIMUM.SINGLE)
  };
  
  // Save results to file
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const filename = `gas-benchmark-${timestamp}.json`;
  const filePath = path.join(__dirname, 'benchmark-reports', filename);
  
  // Ensure directory exists
  if (!fs.existsSync(path.join(__dirname, 'benchmark-reports'))) {
    fs.mkdirSync(path.join(__dirname, 'benchmark-reports'), { recursive: true });
  }
  
  fs.writeFileSync(filePath, JSON.stringify(results, null, 2));
  console.log(`\nBenchmark results saved to ${filePath}`);
  
  // Generate markdown report
  generateMarkdownReport(results, timestamp);
  
  console.log('\nBenchmark Summary:');
  console.log(`- Standard Proof: ${results.averages.standard.toLocaleString()} gas (${results.targetAssessment.standard.status})`);
  console.log(`- Threshold Proof: ${results.averages.threshold.toLocaleString()} gas (${results.targetAssessment.threshold.status})`);
  console.log(`- Maximum Proof: ${results.averages.maximum.toLocaleString()} gas (${results.targetAssessment.maximum.status})`);
  
  return results;
}

/**
 * Calculate average of an array of numbers
 * @param {Array<number>} values - Values to average
 * @returns {number} Average value
 */
function calculateAverage(values) {
  if (!values || values.length === 0) return 0;
  return Math.round(values.reduce((sum, val) => sum + val, 0) / values.length);
}

/**
 * Assess if a value meets the target
 * @param {number} actual - Actual value
 * @param {number} target - Target value
 * @returns {Object} Assessment result
 */
function assessTarget(actual, target) {
  const percentOfTarget = Math.round((actual / target) * 100);
  let status = 'MEETS TARGET';
  let emoji = '✅';
  
  if (percentOfTarget > 100) {
    status = 'EXCEEDS TARGET';
    emoji = '❌';
  } else if (percentOfTarget <= 70) {
    status = 'EXCELLENT';
    emoji = '🔥';
  } else if (percentOfTarget <= 90) {
    status = 'GOOD';
    emoji = '✅';
  }
  
  return {
    actual,
    target,
    percentOfTarget,
    status,
    emoji,
    difference: target - actual
  };
}

/**
 * Generate a markdown report from benchmark results
 * @param {Object} results - Benchmark results
 * @param {string} timestamp - Timestamp string
 */
function generateMarkdownReport(results, timestamp) {
  const markdownPath = path.join(__dirname, 'benchmark-reports', `gas-benchmark-${timestamp}.md`);
  
  let markdown = `# Gas Benchmarking Report - ${new Date().toLocaleDateString()}\n\n`;
  
  // Add summary
  markdown += `## Summary\n\n`;
  markdown += `| Proof Type | Average Gas | Target | % of Target | Status |\n`;
  markdown += `|------------|------------:|-------:|-----------:|--------|\n`;
  markdown += `| Standard   | ${results.averages.standard.toLocaleString()} | ${GAS_TARGETS.STANDARD.SINGLE.toLocaleString()} | ${results.targetAssessment.standard.percentOfTarget}% | ${results.targetAssessment.standard.emoji} ${results.targetAssessment.standard.status} |\n`;
  markdown += `| Threshold  | ${results.averages.threshold.toLocaleString()} | ${GAS_TARGETS.THRESHOLD.SINGLE.toLocaleString()} | ${results.targetAssessment.threshold.percentOfTarget}% | ${results.targetAssessment.threshold.emoji} ${results.targetAssessment.threshold.status} |\n`;
  markdown += `| Maximum    | ${results.averages.maximum.toLocaleString()} | ${GAS_TARGETS.MAXIMUM.SINGLE.toLocaleString()} | ${results.targetAssessment.maximum.percentOfTarget}% | ${results.targetAssessment.maximum.emoji} ${results.targetAssessment.maximum.status} |\n`;
  
  // Add details for each proof type
  markdown += `\n## Detailed Results\n\n`;
  
  // Standard Proof
  markdown += `### Standard Proof\n\n`;
  markdown += `| Round | Submit Gas | Verify Gas |\n`;
  markdown += `|-------|----------:|-----------:|\n`;
  
  for (let i = 0; i < results.proofs.standard.length / 2; i++) {
    const submitEntry = results.proofs.standard.find(r => r.operation === 'submit' && r.round === i);
    const verifyEntry = results.proofs.standard.find(r => r.operation === 'verify' && r.round === i);
    
    if (submitEntry && verifyEntry) {
      markdown += `| ${i+1} | ${submitEntry.gasUsed.toLocaleString()} | ${verifyEntry.gasUsed.toLocaleString()} |\n`;
    }
  }
  
  // Threshold Proof
  markdown += `\n### Threshold Proof\n\n`;
  markdown += `| Round | Submit Gas | Verify Gas |\n`;
  markdown += `|-------|----------:|-----------:|\n`;
  
  for (let i = 0; i < results.proofs.threshold.length / 2; i++) {
    const submitEntry = results.proofs.threshold.find(r => r.operation === 'submit' && r.round === i);
    const verifyEntry = results.proofs.threshold.find(r => r.operation === 'verify' && r.round === i);
    
    if (submitEntry && verifyEntry) {
      markdown += `| ${i+1} | ${submitEntry.gasUsed.toLocaleString()} | ${verifyEntry.gasUsed.toLocaleString()} |\n`;
    }
  }
  
  // Maximum Proof
  markdown += `\n### Maximum Proof\n\n`;
  markdown += `| Round | Submit Gas | Verify Gas |\n`;
  markdown += `|-------|----------:|-----------:|\n`;
  
  for (let i = 0; i < results.proofs.maximum.length / 2; i++) {
    const submitEntry = results.proofs.maximum.find(r => r.operation === 'submit' && r.round === i);
    const verifyEntry = results.proofs.maximum.find(r => r.operation === 'verify' && r.round === i);
    
    if (submitEntry && verifyEntry) {
      markdown += `| ${i+1} | ${submitEntry.gasUsed.toLocaleString()} | ${verifyEntry.gasUsed.toLocaleString()} |\n`;
    }
  }
  
  // Optimization recommendations
  markdown += `\n## Optimization Recommendations\n\n`;
  
  if (results.report && results.report.optimizationRecommendations && results.report.optimizationRecommendations.length > 0) {
    markdown += `| Area | Issue | Recommendation | Potential Savings | Priority |\n`;
    markdown += `|------|-------|---------------|-------------------|----------|\n`;
    
    for (const rec of results.report.optimizationRecommendations) {
      markdown += `| ${rec.area} | ${rec.issue} | ${rec.recommendation} | ${rec.potential} | ${rec.priority} |\n`;
    }
  } else {
    markdown += `No optimization recommendations generated.\n`;
  }
  
  // Environment info
  markdown += `\n## Environment Information\n\n`;
  markdown += `- **Network**: ${results.network ? `${results.network.name} (Chain ID: ${results.network.chainId})` : 'Unknown'}\n`;
  markdown += `- **Gas Price**: ${results.gasPrice ? `${ethers.utils.formatUnits(results.gasPrice, 'gwei')} gwei` : 'Unknown'}\n`;
  markdown += `- **Timestamp**: ${results.timestamp}\n`;
  
  // Save markdown file
  fs.writeFileSync(markdownPath, markdown);
  console.log(`Markdown report saved to ${markdownPath}`);
}

/**
 * Main function to run the benchmark
 */
async function main() {
  let provider;
  let signer;
  
  try {
    // Connect to provider (can be replaced with actual configuration)
    // For testing, we'll use Hardhat's local network
    provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
    
    // Get signer
    const accounts = await provider.listAccounts();
    signer = provider.getSigner(accounts[0]);
    
    // Run benchmarks
    await runGasBenchmarks(provider, signer);
    
  } catch (error) {
    console.error('Error running benchmarks:', error);
  }
}

// Run main function if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  runGasBenchmarks,
  calculateAverage,
  assessTarget
};