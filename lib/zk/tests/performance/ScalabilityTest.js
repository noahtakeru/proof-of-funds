// Scalability testing for ZK proof system
import { PerformanceBenchmark } from './PerformanceBenchmark.js';
import { ethers } from 'ethers';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { Worker } from 'worker_threads';
import crypto from 'crypto';

// Import ZK proof system components
import { generateStandardProof, generateThresholdProof, generateMaximumProof } from '../../src/zkProofGenerator.js';
import { verifyProof } from '../../src/zkProofVerifier.js';
import { serializeProof, deserializeProof } from '../../src/zkProofSerializer.js';

export class ScalabilityTest {
    /**
     * Create scalability test suite
     * @param {Object} config - Configuration options
     * @param {boolean} config.verbose - Whether to log detailed information
     * @param {string} config.outputDir - Directory for test results
     * @param {number} config.maxConcurrency - Maximum number of concurrent operations
     * @param {number} config.maxWorkers - Maximum number of workers
     */
    constructor(config = {}) {
        this.config = config;
        this.verbose = config.verbose || false;
        this.outputDir = config.outputDir || path.join(process.cwd(), 'scalability-results');
        this.maxConcurrency = config.maxConcurrency || Math.max(1, os.cpus().length - 1);
        this.maxWorkers = config.maxWorkers || Math.max(1, os.cpus().length - 1);

        // Create output directory if it doesn't exist
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }

        this.benchmark = new PerformanceBenchmark({
            outputDir: this.outputDir,
            memoryProfiling: true,
            verbose: this.verbose
        });

        this.workers = [];
        this.activeWorkers = 0;
        this.testWallets = this.generateTestWallets(100);

        this.log('Initialized ScalabilityTest');
        this.log(`Max concurrency: ${this.maxConcurrency}`);
        this.log(`Max workers: ${this.maxWorkers}`);
        this.log(`CPU cores: ${os.cpus().length}`);
    }

    /**
     * Generate test wallets for benchmarking
     * @param {number} count - Number of wallets to generate
     * @returns {Array<Object>} Test wallets
     */
    generateTestWallets(count) {
        this.log(`Generating ${count} test wallets`);

        const wallets = [];
        for (let i = 0; i < count; i++) {
            wallets.push(ethers.Wallet.createRandom());
        }

        return wallets;
    }

    /**
     * Run all scalability tests
     * @returns {Promise<Object>} Test results
     */
    async runAllTests() {
        try {
            this.log('Starting scalability tests');

            // Run batch size tests
            await this.runBatchSizeTests();

            // Run concurrency tests
            await this.runConcurrencyTests();

            // Run large proof volume tests
            await this.runLargeVolumeTests();

            // Run mixed proof type tests
            await this.runMixedProofTests();

            // Save results
            const timestamp = new Date().toISOString().replace(/:/g, '-');
            const resultPath = this.benchmark.saveResults(`scalability-test-${timestamp}.json`);
            this.benchmark.generateReport(`scalability-report-${timestamp}.md`);

            return { resultPath };
        } catch (error) {
            this.log(`Error running scalability tests: ${error.message}`, 'error');
            this.log(error.stack, 'error');
            throw error;
        } finally {
            this.terminateAllWorkers();
        }
    }

    /**
     * Run batch size tests
     */
    async runBatchSizeTests() {
        this.benchmark.suite('BatchSizeTests');

        // Test different batch sizes
        const batchSizes = [1, 5, 10, 25, 50, 100];

        for (const batchSize of batchSizes) {
            await this.benchmark.benchmark(`StandardProof_Batch_${batchSize}`, async () => {
                const results = await this.generateProofBatch('standard', batchSize);
                return {
                    batchSize,
                    successCount: results.filter(r => r.success).length,
                    totalTime: results.reduce((sum, r) => sum + r.time, 0)
                };
            }, {
                iterations: 1, // Only run once per batch size
                testParams: { batchSize }
            });
        }

        for (const batchSize of batchSizes) {
            await this.benchmark.benchmark(`ThresholdProof_Batch_${batchSize}`, async () => {
                const results = await this.generateProofBatch('threshold', batchSize);
                return {
                    batchSize,
                    successCount: results.filter(r => r.success).length,
                    totalTime: results.reduce((sum, r) => sum + r.time, 0)
                };
            }, {
                iterations: 1, // Only run once per batch size
                testParams: { batchSize }
            });
        }

        for (const batchSize of batchSizes) {
            await this.benchmark.benchmark(`MaximumProof_Batch_${batchSize}`, async () => {
                const results = await this.generateProofBatch('maximum', batchSize);
                return {
                    batchSize,
                    successCount: results.filter(r => r.success).length,
                    totalTime: results.reduce((sum, r) => sum + r.time, 0)
                };
            }, {
                iterations: 1, // Only run once per batch size
                testParams: { batchSize }
            });
        }
    }

    /**
     * Run concurrency tests
     */
    async runConcurrencyTests() {
        this.benchmark.suite('ConcurrencyTests');

        // Test different concurrency levels
        const concurrencyLevels = [1, 2, 4, 8, 16, Math.min(32, this.maxConcurrency)];

        for (const concurrency of concurrencyLevels) {
            await this.benchmark.benchmark(`StandardProof_Concurrency_${concurrency}`, async () => {
                const results = await this.generateProofsConcurrently('standard', 50, concurrency);
                return {
                    concurrency,
                    successCount: results.filter(r => r.success).length,
                    totalTime: results.reduce((sum, r) => sum + r.time, 0),
                    avgTime: results.reduce((sum, r) => sum + r.time, 0) / results.length
                };
            }, {
                iterations: 1, // Only run once per concurrency level
                testParams: { concurrency }
            });
        }

        for (const concurrency of concurrencyLevels) {
            await this.benchmark.benchmark(`ThresholdProof_Concurrency_${concurrency}`, async () => {
                const results = await this.generateProofsConcurrently('threshold', 50, concurrency);
                return {
                    concurrency,
                    successCount: results.filter(r => r.success).length,
                    totalTime: results.reduce((sum, r) => sum + r.time, 0),
                    avgTime: results.reduce((sum, r) => sum + r.time, 0) / results.length
                };
            }, {
                iterations: 1, // Only run once per concurrency level
                testParams: { concurrency }
            });
        }

        for (const concurrency of concurrencyLevels) {
            await this.benchmark.benchmark(`MaximumProof_Concurrency_${concurrency}`, async () => {
                const results = await this.generateProofsConcurrently('maximum', 50, concurrency);
                return {
                    concurrency,
                    successCount: results.filter(r => r.success).length,
                    totalTime: results.reduce((sum, r) => sum + r.time, 0),
                    avgTime: results.reduce((sum, r) => sum + r.time, 0) / results.length
                };
            }, {
                iterations: 1, // Only run once per concurrency level
                testParams: { concurrency }
            });
        }
    }

    /**
     * Run large volume tests
     */
    async runLargeVolumeTests() {
        this.benchmark.suite('LargeVolumeTests');

        // Test different proof volumes
        const volumes = [100, 250, 500, 1000];

        for (const volume of volumes) {
            await this.benchmark.benchmark(`StandardProof_Volume_${volume}`, async () => {
                const results = await this.generateProofsConcurrently('standard', volume, this.maxConcurrency);
                return {
                    volume,
                    successCount: results.filter(r => r.success).length,
                    totalTime: results.reduce((sum, r) => sum + r.time, 0),
                    avgTime: results.reduce((sum, r) => sum + r.time, 0) / results.length,
                    throughput: results.length / (results.reduce((sum, r) => sum + r.time, 0) / 1000)
                };
            }, {
                iterations: 1, // Only run once per volume
                testParams: { volume }
            });
        }
    }

    /**
     * Run mixed proof type tests
     */
    async runMixedProofTests() {
        this.benchmark.suite('MixedProofTests');

        // Generate proofs with mixed types
        await this.benchmark.benchmark('MixedProofs_100', async () => {
            const standardCount = 33;
            const thresholdCount = 34;
            const maximumCount = 33;

            const promises = [];

            // Add standard proofs
            for (let i = 0; i < standardCount; i++) {
                promises.push(this.generateProof('standard', i));
            }

            // Add threshold proofs
            for (let i = 0; i < thresholdCount; i++) {
                promises.push(this.generateProof('threshold', standardCount + i));
            }

            // Add maximum proofs
            for (let i = 0; i < maximumCount; i++) {
                promises.push(this.generateProof('maximum', standardCount + thresholdCount + i));
            }

            // Process all proofs with concurrency limit
            const results = await this.processPromisesWithConcurrency(promises, this.maxConcurrency);

            return {
                standardProofs: standardCount,
                thresholdProofs: thresholdCount,
                maximumProofs: maximumCount,
                successCount: results.filter(r => r.success).length,
                failureCount: results.filter(r => !r.success).length,
                totalTime: results.reduce((sum, r) => sum + r.time, 0),
                avgTime: results.reduce((sum, r) => sum + r.time, 0) / results.length
            };
        }, {
            iterations: 1
        });
    }

    /**
     * Generate a batch of proofs
     * @param {string} proofType - Proof type to generate
     * @param {number} count - Number of proofs to generate
     * @returns {Promise<Array>} Batch results
     */
    async generateProofBatch(proofType, count) {
        this.log(`Generating batch of ${count} ${proofType} proofs`);

        const promises = [];

        for (let i = 0; i < count; i++) {
            promises.push(this.generateProof(proofType, i));
        }

        // Process all proofs sequentially for consistent batch measurement
        const results = [];

        for (const promise of promises) {
            try {
                const result = await promise;
                results.push(result);
            } catch (error) {
                results.push({
                    success: false,
                    error: error.message,
                    time: 0
                });
            }
        }

        return results;
    }

    /**
     * Generate proofs concurrently
     * @param {string} proofType - Proof type to generate
     * @param {number} count - Number of proofs to generate
     * @param {number} concurrency - Maximum concurrency
     * @returns {Promise<Array>} Batch results
     */
    async generateProofsConcurrently(proofType, count, concurrency) {
        this.log(`Generating ${count} ${proofType} proofs with concurrency ${concurrency}`);

        const promises = [];

        for (let i = 0; i < count; i++) {
            promises.push(this.generateProof(proofType, i));
        }

        // Process all proofs with concurrency limit
        return await this.processPromisesWithConcurrency(promises, concurrency);
    }

    /**
     * Process promises with concurrency limit
     * @param {Array<Promise>} promises - Promises to process
     * @param {number} concurrency - Maximum concurrency
     * @returns {Promise<Array>} Results
     */
    async processPromisesWithConcurrency(promises, concurrency) {
        const results = [];
        const executing = new Set();

        for (const promise of promises) {
            const p = Promise.resolve().then(() => promise);
            results.push(p);

            if (concurrency <= promises.length) {
                const e = p.then(() => executing.delete(e));
                executing.add(e);

                if (executing.size >= concurrency) {
                    await Promise.race(executing);
                }
            }
        }

        return await Promise.all(results);
    }

    /**
     * Generate a proof using worker if available
     * @param {string} proofType - Proof type to generate
     * @param {number} index - Wallet index to use
     * @param {number} [timeout=30000] - Timeout in milliseconds for worker
     * @param {number} [maxRetries=2] - Maximum number of retries on failure
     * @returns {Promise<Object>} Proof result with timing
     */
    async generateProof(proofType, index, timeout = 30000, maxRetries = 2) {
        const startTime = performance.now();

        try {
            // Get wallet
            const wallet = this.testWallets[index % this.testWallets.length];

            // Allow configuration of proof parameters through config
            const balanceWei = ethers.utils.parseEther(
                this.config.testBalanceEther || '1.0'
            );
            const thresholdWei = ethers.utils.parseEther(
                this.config.testThresholdEther || '0.1'
            );
            const maximumWei = ethers.utils.parseEther(
                this.config.testMaximumEther || '10.0'
            );
            const nonce = ethers.utils.hexlify(crypto.randomBytes(16));

            // Create parameters based on proof type
            let params;
            switch (proofType) {
                case 'standard':
                    params = {
                        address: wallet.address,
                        amount: balanceWei.toString(),
                        privateKey: wallet.privateKey,
                        nonce
                    };
                    break;
                case 'threshold':
                    params = {
                        address: wallet.address,
                        threshold: thresholdWei.toString(),
                        actualBalance: balanceWei.toString(),
                        privateKey: wallet.privateKey,
                        nonce
                    };
                    break;
                case 'maximum':
                    params = {
                        address: wallet.address,
                        maximum: maximumWei.toString(),
                        actualBalance: balanceWei.toString(),
                        privateKey: wallet.privateKey,
                        nonce
                    };
                    break;
                default:
                    throw new Error(`Unknown proof type: ${proofType}`);
            }

            // Use workers and retry logic if enabled
            let proof;
            if (this.config.useWorkers !== false && this.maxWorkers > 0) {
                // Get configured timeout or use default
                const workerTimeout = this.config.workerTimeout || timeout;
                
                // Get configured retry count or use default
                const retries = this.config.workerRetries || maxRetries;
                
                // Generate proof with worker and retry logic
                proof = await this.generateProofWithRetry(proofType, params, retries, workerTimeout);
            } else {
                // Directly generate proof without workers
                proof = await this.generateProofDirectly(proofType, params);
            }

            const endTime = performance.now();

            return {
                success: true,
                proofType,
                walletIndex: index,
                address: wallet.address,
                time: endTime - startTime,
                proof: this.config.includeProofInResults ? proof : undefined
            };
        } catch (error) {
            const endTime = performance.now();

            // Log the error for diagnosis
            this.log(`Proof generation error (${proofType}, wallet ${index}): ${error.message}`, 'error');
            
            return {
                success: false,
                proofType,
                walletIndex: index,
                error: error.message,
                time: endTime - startTime,
                stack: this.config.includeErrorStacks ? error.stack : undefined
            };
        }
    }

    /**
     * Create a worker for proof generation
     * @param {string} proofType - Proof type to generate
     * @param {Object} params - Proof parameters
     * @param {number} [timeout=30000] - Timeout in milliseconds
     * @returns {Promise<Object>} Proof result
     */
    createProofWorker(proofType, params, timeout = 30000) {
        return new Promise((resolve, reject) => {
            if (this.activeWorkers >= this.maxWorkers) {
                // Too many active workers, generate proof directly
                this.generateProofDirectly(proofType, params)
                    .then(resolve)
                    .catch(reject);
                return;
            }

            // Create the worker
            const worker = new Worker(path.join(__dirname, 'ProofWorker.js'), {
                workerData: {
                    proofType,
                    params
                }
            });

            this.workers.push(worker);
            this.activeWorkers++;
            
            // Set up worker timeout
            const timeoutId = setTimeout(() => {
                this.log(`Worker timeout after ${timeout}ms for ${proofType} proof`, 'warn');
                worker.terminate();
                reject(new Error(`Worker timeout after ${timeout}ms for ${proofType} proof`));
                this.terminateWorker(worker);
            }, timeout);
            
            // Keep track of whether the worker completed normally
            let completed = false;

            worker.on('message', result => {
                clearTimeout(timeoutId);
                completed = true;
                resolve(result);
                this.terminateWorker(worker);
            });

            worker.on('error', error => {
                clearTimeout(timeoutId);
                completed = true;
                reject(error);
                this.terminateWorker(worker);
            });

            worker.on('exit', code => {
                clearTimeout(timeoutId);
                if (!completed) {
                    if (code !== 0) {
                        reject(new Error(`Worker stopped with exit code ${code}`));
                    } else {
                        // This should rarely happen - worker exited without sending a message
                        reject(new Error(`Worker exited unexpectedly for ${proofType} proof`));
                    }
                    this.terminateWorker(worker);
                }
            });
        });
    }
    
    /**
     * Run proof generation with retry logic
     * @param {string} proofType - Proof type to generate
     * @param {Object} params - Proof parameters 
     * @param {number} [maxRetries=2] - Maximum number of retries
     * @param {number} [timeout=30000] - Worker timeout in milliseconds
     * @returns {Promise<Object>} Proof result
     */
    async generateProofWithRetry(proofType, params, maxRetries = 2, timeout = 30000) {
        let lastError = null;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                // If this is a retry, log it
                if (attempt > 0) {
                    this.log(`Retry ${attempt}/${maxRetries} for ${proofType} proof`, 'warn');
                }
                
                // Try to generate the proof
                return await this.createProofWorker(proofType, params, timeout);
            } catch (error) {
                lastError = error;
                this.log(`Proof generation failed (attempt ${attempt + 1}/${maxRetries + 1}): ${error.message}`, 'warn');
                
                // If this was the last attempt, don't wait
                if (attempt < maxRetries) {
                    // Exponential backoff
                    const delay = Math.min(100 * Math.pow(2, attempt), 2000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        // If we get here, all attempts failed
        throw lastError;
    }

    /**
     * Generate a proof directly (not using worker)
     * @param {string} proofType - Proof type to generate
     * @param {Object} params - Proof parameters
     * @returns {Promise<Object>} Proof result
     */
    async generateProofDirectly(proofType, params) {
        switch (proofType) {
            case 'standard':
                return await generateStandardProof(params);
            case 'threshold':
                return await generateThresholdProof(params);
            case 'maximum':
                return await generateMaximumProof(params);
            default:
                throw new Error(`Unknown proof type: ${proofType}`);
        }
    }

    /**
     * Terminate a worker
     * @param {Worker} worker - Worker to terminate
     */
    terminateWorker(worker) {
        worker.terminate();
        this.activeWorkers--;
        this.workers = this.workers.filter(w => w !== worker);
    }

    /**
     * Terminate all workers
     */
    terminateAllWorkers() {
        for (const worker of this.workers) {
            worker.terminate();
        }

        this.workers = [];
        this.activeWorkers = 0;
    }

    /**
     * Log a message if verbose mode is enabled
     * @param {string} message - Message to log
     * @param {string} level - Log level
     */
    log(message, level = 'info') {
        if (!this.verbose) return;

        const timestamp = new Date().toISOString();

        switch (level) {
            case 'error':
                console.error(`[${timestamp}] ERROR: ${message}`);
                break;
            case 'warn':
                console.warn(`[${timestamp}] WARN: ${message}`);
                break;
            default:
                console.log(`[${timestamp}] INFO: ${message}`);
        }
    }

    /**
     * Clean up resources
     */
    cleanup() {
        this.terminateAllWorkers();
    }
} 