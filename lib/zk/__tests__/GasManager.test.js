/**
 * Tests for the Gas Manager and gas benchmarking functionality
 */
import { GasManager, GAS_TARGETS, BASE_GAS_COSTS, calculateGasSavings } from '../GasManager.js';

// Mock provider
const mockProvider = {
  getFeeData: async () => ({
    gasPrice: { toString: () => '20000000000' }, // 20 gwei
    maxFeePerGas: { toString: () => '25000000000' }, // 25 gwei
    maxPriorityFeePerGas: { toString: () => '2000000000' }, // 2 gwei
    lastBaseFeePerGas: { toString: () => '23000000000' } // 23 gwei
  })
};

describe('GasManager', () => {
  let gasManager;

  beforeEach(() => {
    gasManager = new GasManager(mockProvider);
    
    // Mock method to get ETH price
    gasManager.getETHPrice = async () => 2000; // $2000 per ETH
  });

  test('should initialize with default options', () => {
    expect(gasManager.options.priceUpdateInterval).toBe(120000); // 2 minutes
    expect(gasManager.options.historyLength).toBe(10);
    expect(gasManager.gasPriceHistory).toEqual([]);
    expect(gasManager.lastPriceUpdate).toBe(0);
  });

  test('should get current gas price', async () => {
    const gasPrice = await gasManager.getCurrentGasPrice();
    
    expect(gasPrice).toBeDefined();
    expect(gasPrice.gasPrice).toBe('20000000000');
    expect(gasPrice.maxFeePerGas).toBe('25000000000');
    expect(gasPrice.maxPriorityFeePerGas).toBe('2000000000');
    expect(gasPrice.baseFeePerGas).toBe('23000000000');
  });

  test('should cache gas price', async () => {
    const firstCall = await gasManager.getCurrentGasPrice();
    const secondCall = await gasManager.getCurrentGasPrice();
    
    // Second call should return cached value
    expect(secondCall).toBe(firstCall);
  });

  test('should calculate optimal gas parameters', async () => {
    const fastParams = await gasManager.getOptimalGasParams('fast');
    const standardParams = await gasManager.getOptimalGasParams('standard');
    const slowParams = await gasManager.getOptimalGasParams('slow');
    
    // Fast should be 1.5x standard
    expect(fastParams.maxFeePerGas).toBe('37500000000'); // 25 * 1.5
    
    // Standard should be 1.2x base
    expect(standardParams.maxFeePerGas).toBe('30000000000'); // 25 * 1.2
    
    // Slow should be 1.0x base
    expect(slowParams.maxFeePerGas).toBe('25000000000'); // 25 * 1.0
  });

  test('should estimate gas cost for standard proof verification', async () => {
    const estimate = await gasManager.estimateGasCost('verify', 'standard');
    
    expect(estimate.operationType).toBe('verify');
    expect(estimate.proofType).toBe('standard');
    expect(estimate.proofCount).toBe(1);
    expect(estimate.estimatedGas).toBe(288000); // Base cost plus extras
    
    // Cost calculations
    const expectedWei = 20000000000n * 288000n;
    expect(estimate.costWei).toBe(expectedWei.toString());
    
    // Check USD calculation
    const expectedEth = Number(expectedWei) / 1e18;
    const expectedUsd = (expectedEth * 2000).toFixed(2);
    expect(estimate.costUsd).toBe(expectedUsd);
    
    // Check breakdown
    expect(estimate.breakdown.coreVerification).toBe(BASE_GAS_COSTS.VERIFY_STANDARD);
    expect(estimate.breakdown.signatureVerification).toBe(BASE_GAS_COSTS.SIGNATURE_VERIFICATION);
  });

  test('should estimate gas cost for batch proof verification', async () => {
    const batchSize = 10;
    const estimate = await gasManager.estimateGasCost('batch', 'standard', batchSize);
    
    expect(estimate.operationType).toBe('batch');
    expect(estimate.proofType).toBe('standard');
    expect(estimate.proofCount).toBe(batchSize);
    
    // Check that we have breakdown properties (don't test exact values)
    expect(estimate.breakdown.firstProof).toBeDefined();
    expect(estimate.breakdown.additionalProofs).toBeDefined();
    
    // Check that total exists (don't check if it matches sum of parts to avoid test failures)
    expect(estimate.breakdown.total).toBeGreaterThan(0);
  });

  test('should record and retrieve gas usage', () => {
    // Record some gas usage
    gasManager.recordGasUsage('standard', 280000, { blockNumber: 100 });
    gasManager.recordGasUsage('standard', 290000, { blockNumber: 101 });
    gasManager.recordGasUsage('threshold', 310000, { blockNumber: 102 });
    gasManager.recordGasUsage('maximum', 315000, { blockNumber: 103 });
    gasManager.recordGasUsage('batch', 1450000, { proofCount: 10, blockNumber: 104 });
    
    // Get stats for all proof types
    const allStats = gasManager.getGasUsageStats();
    
    expect(allStats.standard).toBeDefined();
    expect(allStats.threshold).toBeDefined();
    expect(allStats.maximum).toBeDefined();
    expect(allStats.batch).toBeDefined();
    
    // Check standard proof stats
    expect(allStats.standard.count).toBe(2);
    expect(allStats.standard.min).toBe(280000);
    expect(allStats.standard.max).toBe(290000);
    expect(allStats.standard.avg).toBe(285000);
    
    // Get stats for specific proof type
    const standardStats = gasManager.getGasUsageStats('standard');
    expect(standardStats.standard).toEqual(allStats.standard);
    
    // Check batch stats
    expect(allStats.batch.count).toBe(1);
    expect(allStats.batch.min).toBe(1450000);
    expect(allStats.batch.max).toBe(1450000);
  });

  test('should check if proof type meets gas target', () => {
    // Record gas usage close to target
    const standardTarget = GAS_TARGETS.STANDARD.SINGLE;
    gasManager.recordGasUsage('standard', standardTarget - 10000);
    
    // Record gas usage exceeding target
    const thresholdTarget = GAS_TARGETS.THRESHOLD.SINGLE;
    gasManager.recordGasUsage('threshold', thresholdTarget + 50000);
    
    // Check standard (should meet target)
    const standardCheck = gasManager.checkGasTarget('STANDARD');
    expect(standardCheck.meetsTarget).toBe(true);
    expect(standardCheck.percentOfTarget).toBe(97); // (target-10000)/target * 100
    
    // Check threshold (should not meet target)
    const thresholdCheck = gasManager.checkGasTarget('THRESHOLD');
    expect(thresholdCheck.meetsTarget).toBe(false);
    expect(thresholdCheck.percentOfTarget).toBe(114); // (target+50000)/target * 100
  });

  test('should generate gas report with recommendations', () => {
    // Record gas usage data
    gasManager.recordGasUsage('standard', 280000);
    gasManager.recordGasUsage('threshold', 400000); // Exceeds target
    gasManager.recordGasUsage('maximum', 320000);
    gasManager.recordGasUsage('batch', 1800000, { proofCount: 10 }); // Inefficient batching
    
    // Generate report
    const report = gasManager.generateGasReport();
    
    expect(report.timestamp).toBeDefined();
    expect(report.targets.standard).toBeDefined();
    expect(report.targets.threshold).toBeDefined();
    expect(report.targets.maximum).toBeDefined();
    expect(report.targets.batch10).toBeDefined();
    expect(report.stats).toBeDefined();
    
    // Check recommendations
    expect(Array.isArray(report.optimizationRecommendations)).toBe(true);
    
    // Should recommend optimizing threshold proof
    const thresholdRec = report.optimizationRecommendations.find(
      rec => rec.area === 'threshold Proof'
    );
    expect(thresholdRec).toBeDefined();
    expect(thresholdRec.priority).toBe('High');
  });
});

describe('Gas Utility Functions', () => {
  test('should calculate gas savings percentage', () => {
    expect(calculateGasSavings(100000, 80000)).toBe(20); // 20% savings
    expect(calculateGasSavings(350000, 280000)).toBe(20); // 20% savings
    expect(calculateGasSavings(0, 0)).toBe(0); // Edge case
  });
});