// Performance tests for ZK proof generation
import { PerformanceBenchmark } from './PerformanceBenchmark.js';
import path from 'path';
import fs from 'fs';
import { ethers } from 'ethers';
import { Worker } from 'worker_threads';

// Import ZK proof system components
import { generateStandardProof, generateThresholdProof, generateMaximumProof } from '../../src/zkProofGenerator.js';
import { verifyProof } from '../../src/zkProofVerifier.js';
import { serializeProof, deserializeProof } from '../../src/zkProofSerializer.js';

export class ProofGenerationTest {
    /**
     * Create proof generation test suite
     * @param {Object} config - Configuration options
     * @param {boolean} config.verbose - Whether to log detailed information
     * @param {string} config.outputDir - Directory for benchmark results
     * @param {boolean} config.saveResults - Whether to save results to file
     * @param {Object} config.testWallets - Test wallet information
     */
    constructor(config = {}) {
        this.config = config;
        this.benchmark = new PerformanceBenchmark({
            outputDir: config.outputDir || path.join(process.cwd(), 'performance-results'),
            memoryProfiling: true,
            verbose: config.verbose || false
        });

        this.testWallets = config.testWallets || this.generateTestWallets();
        this.workers = [];
        this.workerCount = 0;
    }

    /**
     * Generate test wallets for benchmarking
     * @returns {Object} Test wallets
     */
    generateTestWallets() {
        return {
            // Generate consistent test wallets
            standard: ethers.Wallet.createRandom(),
            threshold: ethers.Wallet.createRandom(),
            maximum: ethers.Wallet.createRandom()
        };
    }

    /**
     * Run all proof generation benchmarks
     * @returns {Promise<Object>} Benchmark results
     */
    async runAllBenchmarks() {
        try {
            // Start with standard proof benchmarks
            await this.runStandardProofBenchmarks();

            // Then threshold proof benchmarks
            await this.runThresholdProofBenchmarks();

            // Then maximum proof benchmarks
            await this.runMaximumProofBenchmarks();

            // Run verification benchmarks
            await this.runVerificationBenchmarks();

            // Finally, run end-to-end benchmarks
            await this.runEndToEndBenchmarks();

            // Save results if configured
            if (this.config.saveResults !== false) {
                const timestamp = new Date().toISOString().replace(/:/g, '-');
                const resultPath = this.benchmark.saveResults(`proof-generation-benchmark-${timestamp}.json`);
                this.benchmark.generateReport(`proof-generation-report-${timestamp}.md`);
                return { resultPath };
            }

            return this.benchmark.results;
        } catch (error) {
            console.error('Benchmark error:', error);
            throw error;
        }
    }

    /**
     * Run standard proof generation benchmarks
     */
    async runStandardProofBenchmarks() {
        this.benchmark.suite('StandardProofGeneration');

        // Generate standard proof with different balances
        for (const balance of ['0.01', '0.1', '1.0', '10.0', '100.0']) {
            await this.benchmark.benchmark(`StandardProof_${balance}ETH`, async () => {
                const wallet = this.testWallets.standard;
                const balanceWei = ethers.utils.parseEther(balance);

                const proof = await generateStandardProof({
                    address: wallet.address,
                    amount: balanceWei.toString(),
                    privateKey: wallet.privateKey,
                    nonce: ethers.utils.hexlify(ethers.utils.randomBytes(16))
                });

                return proof;
            }, {
                iterations: 5,
                warmupIterations: 1,
                testParams: { balance }
            });
        }

        // Test serialization/deserialization
        await this.benchmark.benchmark('StandardProof_Serialization', async () => {
            const wallet = this.testWallets.standard;
            const balanceWei = ethers.utils.parseEther('1.0');

            // Generate proof
            const proof = await generateStandardProof({
                address: wallet.address,
                amount: balanceWei.toString(),
                privateKey: wallet.privateKey,
                nonce: ethers.utils.hexlify(ethers.utils.randomBytes(16))
            });

            // Serialize
            const serialized = serializeProof(proof);

            // Deserialize
            const deserialized = deserializeProof(serialized);

            return { proof, serialized, deserialized };
        }, {
            iterations: 10,
            warmupIterations: 2
        });
    }

    /**
     * Run threshold proof generation benchmarks
     */
    async runThresholdProofBenchmarks() {
        this.benchmark.suite('ThresholdProofGeneration');

        // Test threshold proof with different balances and thresholds
        const testCases = [
            { balance: '1.0', threshold: '0.1' },
            { balance: '10.0', threshold: '1.0' },
            { balance: '100.0', threshold: '10.0' },
            { balance: '1000.0', threshold: '100.0' }
        ];

        for (const testCase of testCases) {
            await this.benchmark.benchmark(`ThresholdProof_${testCase.balance}ETH_${testCase.threshold}Threshold`, async () => {
                const wallet = this.testWallets.threshold;
                const balanceWei = ethers.utils.parseEther(testCase.balance);
                const thresholdWei = ethers.utils.parseEther(testCase.threshold);

                const proof = await generateThresholdProof({
                    address: wallet.address,
                    threshold: thresholdWei.toString(),
                    actualBalance: balanceWei.toString(),
                    privateKey: wallet.privateKey,
                    nonce: ethers.utils.hexlify(ethers.utils.randomBytes(16))
                });

                return proof;
            }, {
                iterations: 5,
                warmupIterations: 1,
                testParams: testCase
            });
        }

        // Test serialization/deserialization
        await this.benchmark.benchmark('ThresholdProof_Serialization', async () => {
            const wallet = this.testWallets.threshold;
            const balanceWei = ethers.utils.parseEther('10.0');
            const thresholdWei = ethers.utils.parseEther('1.0');

            // Generate proof
            const proof = await generateThresholdProof({
                address: wallet.address,
                threshold: thresholdWei.toString(),
                actualBalance: balanceWei.toString(),
                privateKey: wallet.privateKey,
                nonce: ethers.utils.hexlify(ethers.utils.randomBytes(16))
            });

            // Serialize
            const serialized = serializeProof(proof);

            // Deserialize
            const deserialized = deserializeProof(serialized);

            return { proof, serialized, deserialized };
        }, {
            iterations: 10,
            warmupIterations: 2
        });
    }

    /**
     * Run maximum proof generation benchmarks
     */
    async runMaximumProofBenchmarks() {
        this.benchmark.suite('MaximumProofGeneration');

        // Test maximum proof with different balances and maximums
        const testCases = [
            { balance: '0.1', maximum: '1.0' },
            { balance: '1.0', maximum: '10.0' },
            { balance: '10.0', maximum: '100.0' },
            { balance: '100.0', maximum: '1000.0' }
        ];

        for (const testCase of testCases) {
            await this.benchmark.benchmark(`MaximumProof_${testCase.balance}ETH_${testCase.maximum}Maximum`, async () => {
                const wallet = this.testWallets.maximum;
                const balanceWei = ethers.utils.parseEther(testCase.balance);
                const maximumWei = ethers.utils.parseEther(testCase.maximum);

                const proof = await generateMaximumProof({
                    address: wallet.address,
                    maximum: maximumWei.toString(),
                    actualBalance: balanceWei.toString(),
                    privateKey: wallet.privateKey,
                    nonce: ethers.utils.hexlify(ethers.utils.randomBytes(16))
                });

                return proof;
            }, {
                iterations: 5,
                warmupIterations: 1,
                testParams: testCase
            });
        }

        // Test serialization/deserialization
        await this.benchmark.benchmark('MaximumProof_Serialization', async () => {
            const wallet = this.testWallets.maximum;
            const balanceWei = ethers.utils.parseEther('1.0');
            const maximumWei = ethers.utils.parseEther('10.0');

            // Generate proof
            const proof = await generateMaximumProof({
                address: wallet.address,
                maximum: maximumWei.toString(),
                actualBalance: balanceWei.toString(),
                privateKey: wallet.privateKey,
                nonce: ethers.utils.hexlify(ethers.utils.randomBytes(16))
            });

            // Serialize
            const serialized = serializeProof(proof);

            // Deserialize
            const deserialized = deserializeProof(serialized);

            return { proof, serialized, deserialized };
        }, {
            iterations: 10,
            warmupIterations: 2
        });
    }

    /**
     * Run verification benchmarks
     */
    async runVerificationBenchmarks() {
        this.benchmark.suite('ProofVerification');

        // Generate proofs to verify
        const standardProof = await generateStandardProof({
            address: this.testWallets.standard.address,
            amount: ethers.utils.parseEther('1.0').toString(),
            privateKey: this.testWallets.standard.privateKey,
            nonce: ethers.utils.hexlify(ethers.utils.randomBytes(16))
        });

        const thresholdProof = await generateThresholdProof({
            address: this.testWallets.threshold.address,
            threshold: ethers.utils.parseEther('0.1').toString(),
            actualBalance: ethers.utils.parseEther('1.0').toString(),
            privateKey: this.testWallets.threshold.privateKey,
            nonce: ethers.utils.hexlify(ethers.utils.randomBytes(16))
        });

        const maximumProof = await generateMaximumProof({
            address: this.testWallets.maximum.address,
            maximum: ethers.utils.parseEther('10.0').toString(),
            actualBalance: ethers.utils.parseEther('1.0').toString(),
            privateKey: this.testWallets.maximum.privateKey,
            nonce: ethers.utils.hexlify(ethers.utils.randomBytes(16))
        });

        // Benchmark standard proof verification
        await this.benchmark.benchmark('StandardProof_Verification', async () => {
            return await verifyProof(standardProof);
        }, {
            iterations: 10,
            warmupIterations: 2
        });

        // Benchmark threshold proof verification
        await this.benchmark.benchmark('ThresholdProof_Verification', async () => {
            return await verifyProof(thresholdProof);
        }, {
            iterations: 10,
            warmupIterations: 2
        });

        // Benchmark maximum proof verification
        await this.benchmark.benchmark('MaximumProof_Verification', async () => {
            return await verifyProof(maximumProof);
        }, {
            iterations: 10,
            warmupIterations: 2
        });
    }

    /**
     * Run end-to-end benchmarks (generation + verification)
     */
    async runEndToEndBenchmarks() {
        this.benchmark.suite('EndToEndProofSystem');

        // Benchmark standard proof end-to-end
        await this.benchmark.benchmark('StandardProof_EndToEnd', async () => {
            const wallet = this.testWallets.standard;
            const balanceWei = ethers.utils.parseEther('1.0');

            // Generate proof
            const proof = await generateStandardProof({
                address: wallet.address,
                amount: balanceWei.toString(),
                privateKey: wallet.privateKey,
                nonce: ethers.utils.hexlify(ethers.utils.randomBytes(16))
            });

            // Serialize
            const serialized = serializeProof(proof);

            // Deserialize
            const deserialized = deserializeProof(serialized);

            // Verify
            const verification = await verifyProof(deserialized);

            return { proof, serialized, verification };
        }, {
            iterations: 5,
            warmupIterations: 1
        });

        // Benchmark threshold proof end-to-end
        await this.benchmark.benchmark('ThresholdProof_EndToEnd', async () => {
            const wallet = this.testWallets.threshold;
            const balanceWei = ethers.utils.parseEther('10.0');
            const thresholdWei = ethers.utils.parseEther('1.0');

            // Generate proof
            const proof = await generateThresholdProof({
                address: wallet.address,
                threshold: thresholdWei.toString(),
                actualBalance: balanceWei.toString(),
                privateKey: wallet.privateKey,
                nonce: ethers.utils.hexlify(ethers.utils.randomBytes(16))
            });

            // Serialize
            const serialized = serializeProof(proof);

            // Deserialize
            const deserialized = deserializeProof(serialized);

            // Verify
            const verification = await verifyProof(deserialized);

            return { proof, serialized, verification };
        }, {
            iterations: 5,
            warmupIterations: 1
        });

        // Benchmark maximum proof end-to-end
        await this.benchmark.benchmark('MaximumProof_EndToEnd', async () => {
            const wallet = this.testWallets.maximum;
            const balanceWei = ethers.utils.parseEther('1.0');
            const maximumWei = ethers.utils.parseEther('10.0');

            // Generate proof
            const proof = await generateMaximumProof({
                address: wallet.address,
                maximum: maximumWei.toString(),
                actualBalance: balanceWei.toString(),
                privateKey: wallet.privateKey,
                nonce: ethers.utils.hexlify(ethers.utils.randomBytes(16))
            });

            // Serialize
            const serialized = serializeProof(proof);

            // Deserialize
            const deserialized = deserializeProof(serialized);

            // Verify
            const verification = await verifyProof(deserialized);

            return { proof, serialized, verification };
        }, {
            iterations: 5,
            warmupIterations: 1
        });
    }

    /**
     * Create a worker for concurrent proof generation
     * @param {string} proofType - Proof type to generate
     * @param {Object} params - Proof parameters
     * @returns {Promise<Object>} Generated proof
     */
    createProofWorker(proofType, params) {
        return new Promise((resolve, reject) => {
            const worker = new Worker(path.join(__dirname, 'ProofWorker.js'), {
                workerData: {
                    proofType,
                    params
                }
            });

            this.workers.push(worker);
            this.workerCount++;

            worker.on('message', result => {
                resolve(result);
                worker.terminate();
                this.workerCount--;
                this.workers = this.workers.filter(w => w !== worker);
            });

            worker.on('error', error => {
                reject(error);
                worker.terminate();
                this.workerCount--;
                this.workers = this.workers.filter(w => w !== worker);
            });

            worker.on('exit', code => {
                if (code !== 0) {
                    reject(new Error(`Worker stopped with exit code ${code}`));
                    this.workerCount--;
                    this.workers = this.workers.filter(w => w !== worker);
                }
            });
        });
    }

    /**
     * Terminate all workers
     */
    terminateAllWorkers() {
        for (const worker of this.workers) {
            worker.terminate();
        }

        this.workers = [];
        this.workerCount = 0;
    }

    /**
     * Clean up resources
     */
    cleanup() {
        this.terminateAllWorkers();
    }
} 