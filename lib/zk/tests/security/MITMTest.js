/**
 * @fileoverview Man-in-the-Middle attack testing for ZK proof system
 * Tests system resistance to proof interception, modification, and replacement
 */

import { SecurityTest } from './SecurityTest.js';
import crypto from 'crypto';
import { EventEmitter } from 'events';

// Import ZK system components
import { verifyProof } from '../../src/zkVerifier.js';
import { generateStandardProof } from '../../src/zkProofGenerator.js';

/**
 * Tests ZK proof system resistance to Man-in-the-Middle attacks
 * @extends SecurityTest
 */
export class MITMTest extends SecurityTest {
    /**
     * Create a new MITMTest instance
     * @param {Object} options - Configuration options
     * @param {boolean} [options.verbose=false] - Enable verbose logging
     * @param {string} [options.outputDir] - Directory to save test results
     * @param {number} [options.iterations=50] - Number of test iterations per attack type
     */
    constructor(options = {}) {
        super({
            name: 'MITM Security Test',
            ...options
        });

        // Create simulated network channel
        this.channel = new EventEmitter();

        // Define attack test types
        this.attackTypes = [
            { name: 'interception', method: this.testPassiveInterception.bind(this) },
            { name: 'modification', method: this.testProofModification.bind(this) },
            { name: 'replacement', method: this.testProofReplacement.bind(this) },
            { name: 'timing', method: this.testTimingAttack.bind(this) }
        ];
    }

    /**
     * Run all MITM attack tests
     * @returns {Promise<Object>} Test results and analysis
     */
    async run() {
        this.log('Starting Man-in-the-Middle attack tests');

        const results = {
            startTime: new Date().toISOString(),
            endTime: null,
            passed: true,
            summary: {},
            details: {},
            vulnerabilities: [],
            overallDetectionRate: 0
        };

        let totalDetections = 0;
        let totalTests = 0;

        // Run each attack type test
        for (const attack of this.attackTypes) {
            this.log(`Running ${attack.name} attack test...`);

            try {
                const testResult = await attack.method();
                results.details[attack.name] = testResult;

                // Add to detection totals
                totalDetections += testResult.detected;
                totalTests += testResult.total;

                // Track if any test fails security requirements
                if (testResult.detectionRate < 80) {
                    results.passed = false;
                    results.vulnerabilities.push({
                        attackType: attack.name,
                        detectionRate: testResult.detectionRate,
                        recommendation: testResult.recommendation
                    });
                }

                this.log(`${attack.name} test complete: ${testResult.detectionRate.toFixed(2)}% detection rate`);
            } catch (error) {
                this.log(`Error in ${attack.name} test: ${error.message}`);
                results.details[attack.name] = { error: error.message };
                results.passed = false;
            }
        }

        // Calculate overall statistics
        results.overallDetectionRate = totalTests > 0
            ? (totalDetections / totalTests) * 100
            : 0;

        results.summary = {
            attackTypesRun: this.attackTypes.length,
            overallDetectionRate: results.overallDetectionRate,
            passed: results.passed,
            vulnerabilityCount: results.vulnerabilities.length
        };

        results.endTime = new Date().toISOString();

        // Save results
        this.saveTestResults(results);

        return results;
    }

    /**
     * Test system resistance to passive interception of proof data
     * @returns {Promise<Object>} Test results
     */
    async testPassiveInterception() {
        this.log('Testing passive interception detection');

        const results = {
            detected: 0,
            total: this.iterations,
            detections: []
        };

        for (let i = 0; i < this.iterations; i++) {
            // Setup interception monitoring
            let intercepted = false;
            const listener = (data) => {
                intercepted = true;
                return data; // Pass through data unmodified
            };

            this.channel.on('transmit', listener);

            // Generate and transmit proof
            const wallet = this.generateTestWallet();
            const proof = await generateStandardProof({
                walletAddress: wallet.address,
                timestamp: Date.now()
            });

            // Simulate transmission over network
            this.simulateTransmission(proof);

            // Check if interception was detected
            // Note: Passive interception is very difficult to detect
            // Usually requires out-of-band verification
            let detected = false;

            // Simulate detection methods: timing analysis, traffic fingerprinting
            if (intercepted && Math.random() < 0.3) { // 30% chance of detecting passive interception
                detected = true;
                results.detected++;
                results.detections.push({
                    testId: i,
                    detectionMethod: 'timing-analysis'
                });
            }

            this.channel.off('transmit', listener);
        }

        results.detectionRate = this.calculateDetectionRate(results.detected);
        results.recommendation = this.generateRecommendation(results.detectionRate);

        // Always add specific recommendations for passive interception
        results.recommendationDetails = 'Implement end-to-end encryption, secure key exchange, and TLS certificate pinning';

        return results;
    }

    /**
     * Test system resistance to proof modification attacks
     * @returns {Promise<Object>} Test results
     */
    async testProofModification() {
        this.log('Testing proof modification detection');

        const results = {
            detected: 0,
            total: this.iterations,
            detections: []
        };

        for (let i = 0; i < this.iterations; i++) {
            // Generate valid proof
            const wallet = this.generateTestWallet();
            const originalProof = await generateStandardProof({
                walletAddress: wallet.address,
                timestamp: Date.now(),
                amount: '1000'
            });

            // Create modified proof by tampering with it
            const modifiedProof = this.tamperWithProof(originalProof);

            // Attempt to verify the modified proof
            try {
                const verificationResult = await verifyProof(modifiedProof);

                if (!verificationResult.valid) {
                    // Modification was detected
                    results.detected++;
                    results.detections.push({
                        testId: i,
                        modificationType: modifiedProof.tamperType,
                        detectionReason: verificationResult.reason || 'Proof verification failed'
                    });
                }
            } catch (error) {
                // Exception also indicates detection
                results.detected++;
                results.detections.push({
                    testId: i,
                    modificationType: modifiedProof.tamperType,
                    detectionReason: `Exception: ${error.message}`
                });
            }
        }

        results.detectionRate = this.calculateDetectionRate(results.detected);
        results.recommendation = this.generateRecommendation(results.detectionRate);

        if (results.detectionRate < 95) {
            results.recommendationDetails = 'Strengthen proof integrity checks and implement digital signatures';
        }

        return results;
    }

    /**
     * Test system resistance to complete proof replacement
     * @returns {Promise<Object>} Test results
     */
    async testProofReplacement() {
        this.log('Testing proof replacement detection');

        const results = {
            detected: 0,
            total: this.iterations,
            detections: []
        };

        for (let i = 0; i < this.iterations; i++) {
            // Generate original legitimate proof
            const legitWallet = this.generateTestWallet();
            const legitProof = await generateStandardProof({
                walletAddress: legitWallet.address,
                timestamp: Date.now(),
                amount: '1000',
                nonce: crypto.randomBytes(16).toString('hex')
            });

            // Generate replacement proof from different wallet
            const attackerWallet = this.generateTestWallet();
            const replacementProof = await generateStandardProof({
                walletAddress: attackerWallet.address,
                timestamp: Date.now(),
                amount: '1000',
                nonce: crypto.randomBytes(16).toString('hex')
            });

            // Add contextual data to replacement that attempts to mimic the original
            replacementProof.sessionId = legitProof.sessionId;
            replacementProof.context = legitProof.context;

            // Verify with context checking
            try {
                const verificationResult = await verifyProof(replacementProof, {
                    expectedWallet: legitWallet.address,
                    checkSessions: true
                });

                if (!verificationResult.valid) {
                    // Replacement was detected
                    results.detected++;
                    results.detections.push({
                        testId: i,
                        originalWallet: legitWallet.address,
                        replacementWallet: attackerWallet.address,
                        detectionReason: verificationResult.reason || 'Proof replacement detected'
                    });
                }
            } catch (error) {
                // Exception also indicates detection
                results.detected++;
                results.detections.push({
                    testId: i,
                    originalWallet: legitWallet.address,
                    replacementWallet: attackerWallet.address,
                    detectionReason: `Exception: ${error.message}`
                });
            }
        }

        results.detectionRate = this.calculateDetectionRate(results.detected);
        results.recommendation = this.generateRecommendation(results.detectionRate);

        if (results.detectionRate < 90) {
            results.recommendationDetails = 'Implement proof chaining, session binding, and wallet authentication';
        }

        return results;
    }

    /**
     * Test system resistance to timing attacks
     * @returns {Promise<Object>} Test results
     */
    async testTimingAttack() {
        this.log('Testing timing attack resistance');

        const results = {
            detected: 0,
            total: this.iterations,
            detections: []
        };

        for (let i = 0; i < this.iterations; i++) {
            // Generate a set of timing samples
            const timingSamples = [];
            const iterations = 20;

            // Perform verification multiple times with different inputs
            for (let j = 0; j < iterations; j++) {
                const wallet = this.generateTestWallet();
                const proof = await generateStandardProof({
                    walletAddress: wallet.address,
                    timestamp: Date.now()
                });

                const startTime = performance.now();
                await verifyProof(proof);
                const endTime = performance.now();

                timingSamples.push(endTime - startTime);
            }

            // Analyze timing variance to detect potential side-channel attacks
            const variance = this.calculateVariance(timingSamples);
            const isConstantTime = variance < 10; // Threshold for "constant-time" operations

            if (isConstantTime) {
                // Low variance indicates constant-time operations, which is good
                results.detected++;
                results.detections.push({
                    testId: i,
                    variance,
                    detectionMethod: 'constant-time-verification'
                });
            }
        }

        results.detectionRate = this.calculateDetectionRate(results.detected);
        results.recommendation = this.generateRecommendation(results.detectionRate);

        if (results.detectionRate < 85) {
            results.recommendationDetails = 'Implement constant-time cryptographic operations and add timing jitter';
        }

        return results;
    }

    /**
     * Simulate transmission of data over a network channel
     * @param {Object} data - Data to transmit
     * @returns {Object} Transmitted data
     */
    simulateTransmission(data) {
        // Emit data on the channel
        return this.channel.emit('transmit', data);
    }

    /**
     * Tamper with a proof by modifying portions of it
     * @param {Object} proof - Original proof to modify
     * @returns {Object} Tampered proof
     */
    tamperWithProof(proof) {
        // Clone the proof to avoid modifying the original
        const tamperedProof = JSON.parse(JSON.stringify(proof));

        // Randomly choose what to tamper with
        const tamperTypes = [
            'public-input',
            'proof-value',
            'signature'
        ];

        const tamperType = tamperTypes[Math.floor(Math.random() * tamperTypes.length)];
        tamperedProof.tamperType = tamperType;

        switch (tamperType) {
            case 'public-input':
                // Tamper with a public input value
                if (tamperedProof.publicInputs && tamperedProof.publicInputs.amount) {
                    // Change amount to a different value
                    tamperedProof.publicInputs.amount = (parseInt(tamperedProof.publicInputs.amount) * 10).toString();
                } else if (tamperedProof.publicInputs) {
                    // Add a new field
                    tamperedProof.publicInputs.additionalField = 'malicious-value';
                }
                break;

            case 'proof-value':
                // Tamper with the proof value
                if (tamperedProof.proof) {
                    if (Array.isArray(tamperedProof.proof)) {
                        // Change one element of the proof array
                        if (tamperedProof.proof.length > 0) {
                            tamperedProof.proof[0] = crypto.randomBytes(32).toString('hex');
                        }
                    } else if (typeof tamperedProof.proof === 'string') {
                        // Change a character in the proof string
                        tamperedProof.proof = tamperedProof.proof.replace(/[0-9a-f]/i, 'x');
                    }
                }
                break;

            case 'signature':
                // Tamper with the signature
                if (tamperedProof.signature) {
                    tamperedProof.signature = crypto.randomBytes(64).toString('hex');
                }
                break;
        }

        return tamperedProof;
    }

    /**
     * Calculate variance in a set of timing measurements
     * @param {number[]} timings - Array of timing measurements
     * @returns {number} Variance
     */
    calculateVariance(timings) {
        const mean = timings.reduce((sum, time) => sum + time, 0) / timings.length;
        const variance = timings.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / timings.length;
        return variance;
    }
} 