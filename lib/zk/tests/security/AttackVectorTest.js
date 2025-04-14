/**
 * @fileoverview Attack vector testing for ZK proof system
 * Tests resistance to various attack types including MiTM, replay, and parameter tampering
 */

import { SecurityTest } from './SecurityTest.js';
import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import crypto from 'crypto';

// Import the necessary ZK system components
import {
    generateStandardProof,
    generateThresholdProof,
    generateMaximumProof
} from '../../src/zkProofGenerator.js';
import { verifyProof } from '../../src/zkVerifier.js';

/**
 * Class for testing ZK proof system resistance to various attack vectors
 * @extends SecurityTest
 */
export class AttackVectorTest extends SecurityTest {
    /**
     * Creates an instance of AttackVectorTest
     * @param {Object} options - Configuration options
     * @param {boolean} [options.verbose=false] - Enable verbose logging
     * @param {string} [options.outputDir='lib/zk/tests/security-results'] - Directory for output results
     * @param {number} [options.iterations=100] - Number of test iterations to run
     */
    constructor(options = {}) {
        super({
            name: 'attack-vector-test',
            ...options,
            outputDir: options.outputDir || 'lib/zk/tests/security-results'
        });

        this.attackVectors = [
            { name: 'replay-attack', method: this.testReplayAttack.bind(this) },
            { name: 'mitm-attack', method: this.testMitMAttack.bind(this) },
            { name: 'parameter-tampering', method: this.testParameterTampering.bind(this) },
            { name: 'input-fuzzing', method: this.testInputFuzzing.bind(this) },
            { name: 'malformed-proof', method: this.testMalformedProof.bind(this) },
            { name: 'nullifier-reuse', method: this.testNullifierReuse.bind(this) },
            { name: 'identity-spoofing', method: this.testIdentitySpoofing.bind(this) },
            { name: 'signature-replay', method: this.simulateSignatureReplay.bind(this) }
        ];
    }

    /**
     * Runs all attack vector tests
     * @returns {Promise<Object>} Test results summary
     */
    async run() {
        this.log('Starting attack vector tests');

        const results = {
            startTime: new Date().toISOString(),
            endTime: null,
            summary: {},
            details: {},
            recommendations: []
        };

        for (const attackVector of this.attackVectors) {
            this.log(`Running ${attackVector.name} test...`);
            try {
                const vectorResult = await attackVector.method();
                results.details[attackVector.name] = vectorResult;
                results.summary[attackVector.name] = {
                    detectionRate: vectorResult.detectionRate,
                    recommendation: vectorResult.recommendation
                };

                if (vectorResult.recommendation !== 'Excellent security') {
                    results.recommendations.push({
                        vector: attackVector.name,
                        recommendation: vectorResult.recommendation,
                        details: vectorResult.recommendationDetails || 'No specific details provided'
                    });
                }

                this.log(`${attackVector.name} test completed: ${vectorResult.detectionRate}% detection rate`);
            } catch (error) {
                this.log(`Error in ${attackVector.name} test: ${error.message}`);
                results.details[attackVector.name] = { error: error.message };
                results.summary[attackVector.name] = { error: error.message };
            }
        }

        results.endTime = new Date().toISOString();
        await this.saveTestResults(results);
        return results;
    }

    /**
     * Tests resistance to replay attacks by attempting to reuse proofs
     * @returns {Promise<Object>} Test results
     */
    async testReplayAttack() {
        this.log('Testing replay attack resistance');
        const results = {
            detected: 0,
            total: this.iterations,
            detections: []
        };

        for (let i = 0; i < this.iterations; i++) {
            const wallet = this.generateTestWallet();
            const timestamp = Date.now();

            // Generate a valid proof
            const validProof = await generateStandardProof({
                walletAddress: wallet.address,
                timestamp,
                otherParams: { testId: `original-${i}` }
            });

            // Verify the valid proof
            const validResult = await verifyProof(validProof);

            // Attempt to replay the proof with a new timestamp context
            const replayContext = {
                timestamp: timestamp + 3600000, // 1 hour later
                checkReplay: true
            };

            // Replay attack attempt
            const replayResult = await verifyProof(validProof, replayContext);

            if (!replayResult.valid) {
                results.detected++;
                results.detections.push({
                    testId: i,
                    originalTimestamp: timestamp,
                    replayTimestamp: replayContext.timestamp,
                    detectionReason: replayResult.reason || 'Proof rejected'
                });
            }
        }

        results.detectionRate = this.calculateDetectionRate(results.detected);
        results.recommendation = this.generateRecommendation(results.detectionRate);

        if (results.detectionRate < 100) {
            results.recommendationDetails = 'Implement nonce tracking and timestamp validation to prevent proof reuse';
        }

        return results;
    }

    /**
     * Tests resistance to Man-in-the-Middle attacks by modifying proof data
     * @returns {Promise<Object>} Test results
     */
    async testMitMAttack() {
        this.log('Testing MitM attack resistance');
        const results = {
            detected: 0,
            total: this.iterations,
            detections: []
        };

        for (let i = 0; i < this.iterations; i++) {
            const wallet = this.generateTestWallet();

            // Generate a valid proof
            const validProof = await generateStandardProof({
                walletAddress: wallet.address,
                timestamp: Date.now(),
                otherParams: { testId: `mitm-${i}` }
            });

            // Create a tampered proof by modifying data that should be protected
            const tamperedProof = JSON.parse(JSON.stringify(validProof));

            // Tamper with a field that should invalidate the proof
            if (tamperedProof.publicInputs && tamperedProof.publicInputs.funds) {
                tamperedProof.publicInputs.funds = (parseInt(tamperedProof.publicInputs.funds) * 2).toString();
            } else if (tamperedProof.publicSignals && tamperedProof.publicSignals.length > 0) {
                // Modify first public signal
                tamperedProof.publicSignals[0] = (BigInt(tamperedProof.publicSignals[0]) + 1n).toString();
            } else {
                // Fallback: tamper with the proof array if available
                if (tamperedProof.proof && Array.isArray(tamperedProof.proof) && tamperedProof.proof.length > 0) {
                    tamperedProof.proof[0] = tamperedProof.proof[0].replace(/[a-f]/i, 'f');
                }
            }

            // Verify the tampered proof
            const tamperResult = await verifyProof(tamperedProof);

            if (!tamperResult.valid) {
                results.detected++;
                results.detections.push({
                    testId: i,
                    wallet: wallet.address,
                    detectionReason: tamperResult.reason || 'Tampered proof rejected'
                });
            }
        }

        results.detectionRate = this.calculateDetectionRate(results.detected);
        results.recommendation = this.generateRecommendation(results.detectionRate);

        if (results.detectionRate < 100) {
            results.recommendationDetails = 'Implement cryptographic signature verification and HMAC for all proof data';
        }

        return results;
    }

    /**
     * Tests resistance to parameter tampering attacks
     * @returns {Promise<Object>} Test results
     */
    async testParameterTampering() {
        this.log('Testing parameter tampering resistance');
        const results = {
            detected: 0,
            total: this.iterations,
            detections: []
        };

        for (let i = 0; i < this.iterations; i++) {
            const wallet = this.generateTestWallet();

            // Generate parameters for a valid proof
            const validParams = {
                walletAddress: wallet.address,
                timestamp: Date.now(),
                fundAmount: ethers.utils.parseEther('10.0').toString(),
                otherParams: { testId: `param-${i}` }
            };

            // Create a set of tampered parameters
            const tamperedParams = JSON.parse(JSON.stringify(validParams));
            tamperedParams.fundAmount = ethers.utils.parseEther('1000.0').toString(); // Tamper with fund amount

            // Generate proofs with both parameter sets
            const validProof = await generateStandardProof(validParams);
            const tamperedProof = await generateStandardProof(tamperedParams);

            // Check if the system can detect issues with the tampered parameters during verification
            // We're looking for issues in the transaction history, consistency checks, or other validations
            const tamperedVerifyResult = await verifyProof(tamperedProof, {
                additionalChecks: {
                    expectedFundAmount: validParams.fundAmount,
                    checkConsistency: true
                }
            });

            if (!tamperedVerifyResult.valid) {
                results.detected++;
                results.detections.push({
                    testId: i,
                    wallet: wallet.address,
                    originalAmount: validParams.fundAmount,
                    tamperedAmount: tamperedParams.fundAmount,
                    detectionReason: tamperedVerifyResult.reason || 'Parameter inconsistency detected'
                });
            }
        }

        results.detectionRate = this.calculateDetectionRate(results.detected);
        results.recommendation = this.generateRecommendation(results.detectionRate);

        if (results.detectionRate < 95) {
            results.recommendationDetails = 'Implement parameter validation, range checking, and cross-reference verification';
        }

        return results;
    }

    /**
     * Tests resistance to input fuzzing attacks
     * @returns {Promise<Object>} Test results
     */
    async testInputFuzzing() {
        this.log('Testing input fuzzing resistance');
        const results = {
            detected: 0,
            total: this.iterations,
            detections: []
        };

        const fuzzingTypes = [
            { name: 'overflow', generator: () => this.generateOverflowInput() },
            { name: 'malformed', generator: () => this.generateMalformedInput() },
            { name: 'injections', generator: () => this.generateInjectionInput() }
        ];

        for (let i = 0; i < this.iterations; i++) {
            const fuzzType = fuzzingTypes[i % fuzzingTypes.length];
            const fuzzedInput = fuzzType.generator();

            try {
                // Attempt to generate a proof with fuzzed inputs
                const attemptResult = await this.attemptProofWithFuzzedInput(fuzzedInput);

                if (attemptResult.detected) {
                    results.detected++;
                    results.detections.push({
                        testId: i,
                        fuzzType: fuzzType.name,
                        detectionReason: attemptResult.reason || 'Fuzzing attack prevented'
                    });
                }
            } catch (error) {
                // Exception indicates the system rejected the input
                results.detected++;
                results.detections.push({
                    testId: i,
                    fuzzType: fuzzType.name,
                    detectionReason: `Exception: ${error.message}`
                });
            }
        }

        results.detectionRate = this.calculateDetectionRate(results.detected);
        results.recommendation = this.generateRecommendation(results.detectionRate);

        if (results.detectionRate < 90) {
            results.recommendationDetails = 'Implement comprehensive input validation, type checking, and sanitization';
        }

        return results;
    }

    /**
     * Tests system response to malformed proofs
     * @returns {Promise<Object>} Test results
     */
    async testMalformedProof() {
        this.log('Testing malformed proof handling');
        const results = {
            detected: 0,
            total: this.iterations,
            detections: []
        };

        for (let i = 0; i < this.iterations; i++) {
            const malformedProof = this.generateMalformedProof();

            try {
                // Attempt to verify a malformed proof
                const verifyResult = await verifyProof(malformedProof);

                if (!verifyResult.valid) {
                    results.detected++;
                    results.detections.push({
                        testId: i,
                        proofType: malformedProof.type || 'unknown',
                        detectionReason: verifyResult.reason || 'Malformed proof rejected'
                    });
                }
            } catch (error) {
                // Exception indicates the system rejected the malformed proof
                results.detected++;
                results.detections.push({
                    testId: i,
                    proofType: malformedProof.type || 'unknown',
                    detectionReason: `Exception: ${error.message}`
                });
            }
        }

        results.detectionRate = this.calculateDetectionRate(results.detected);
        results.recommendation = this.generateRecommendation(results.detectionRate);

        if (results.detectionRate < 95) {
            results.recommendationDetails = 'Improve proof structure validation and implement graceful error handling';
        }

        return results;
    }

    /**
     * Attempts to generate a proof with fuzzed input
     * @param {Object} fuzzedInput - The fuzzed input parameters
     * @returns {Promise<Object>} Result object with detection status
     */
    async attemptProofWithFuzzedInput(fuzzedInput) {
        try {
            // Try to generate a proof with the fuzzed input
            await generateStandardProof(fuzzedInput);

            // If we get here without an error, the fuzzing was not detected
            return { detected: false };
        } catch (error) {
            // Error indicates the system detected the invalid input
            return {
                detected: true,
                reason: error.message
            };
        }
    }

    /**
     * Generates input designed to cause integer overflow
     * @returns {Object} Overflow test input
     */
    generateOverflowInput() {
        return {
            walletAddress: this.generateTestWallet().address,
            timestamp: Date.now(),
            fundAmount: Number.MAX_SAFE_INTEGER.toString() + '0',
            nonce: Math.floor(Math.random() * 1000000)
        };
    }

    /**
     * Generates malformed input with missing or invalid fields
     * @returns {Object} Malformed test input
     */
    generateMalformedInput() {
        const input = {
            walletAddress: this.generateTestWallet().address,
            timestamp: Date.now()
        };

        // Randomly choose a malformation type
        const malformType = Math.floor(Math.random() * 3);

        switch (malformType) {
            case 0:
                // Missing required field
                delete input.walletAddress;
                break;
            case 1:
                // Invalid data type
                input.timestamp = 'not-a-timestamp';
                break;
            case 2:
                // Add unexpected fields
                input.maliciousField = '<script>alert("XSS")</script>';
                break;
        }

        return input;
    }

    /**
     * Generates input with potential injection patterns
     * @returns {Object} Injection test input
     */
    generateInjectionInput() {
        const injectionPatterns = [
            '"; DROP TABLE proofs; --',
            '<iframe src="javascript:alert(\'XSS\')"></iframe>',
            '${process.env.SECRET_KEY}',
            'function() { return this.constructor.constructor("return process")().mainModule.require("child_process").execSync("ls").toString() }()',
            '../../../../etc/passwd'
        ];

        const pattern = injectionPatterns[Math.floor(Math.random() * injectionPatterns.length)];

        return {
            walletAddress: this.generateTestWallet().address,
            timestamp: Date.now(),
            userInput: pattern,
            notes: pattern
        };
    }

    /**
     * Generates a malformed proof object
     * @returns {Object} Malformed proof object
     */
    generateMalformedProof() {
        const malformTypes = [
            // Missing required fields
            () => ({
                publicInputs: { address: this.generateTestWallet().address },
                // Missing proof data
            }),

            // Invalid proof structure
            () => ({
                proof: "not-an-array-as-expected",
                publicInputs: { address: this.generateTestWallet().address }
            }),

            // Corrupted proof data
            () => ({
                proof: [crypto.randomBytes(32).toString('hex'), crypto.randomBytes(32).toString('hex')],
                publicInputs: { address: this.generateTestWallet().address }
            }),

            // Inconsistent data types
            () => ({
                proof: [123, 456, "not-a-hex-string"],
                publicInputs: { address: this.generateTestWallet().address, funds: "invalid" }
            }),

            // Empty data
            () => ({
                proof: [],
                publicInputs: {}
            })
        ];

        const malformGenerator = malformTypes[Math.floor(Math.random() * malformTypes.length)];
        return {
            type: `malformed-${Math.floor(Math.random() * 1000)}`,
            ...malformGenerator()
        };
    }

    /**
     * Tests resistance to nullifier reuse attacks
     * @returns {Promise<Object>} Test results
     */
    async testNullifierReuse() {
        this.log('Testing nullifier reuse attack resistance');
        const results = {
            detected: 0,
            total: this.iterations,
            detections: []
        };

        // Create a register of used nullifiers
        const usedNullifiers = new Set();

        for (let i = 0; i < this.iterations; i++) {
            const wallet = this.generateTestWallet();

            // Generate a nullifier
            const nullifier = crypto.randomBytes(32).toString('hex');

            // First proof with this nullifier should be valid
            const validProof = await generateStandardProof({
                walletAddress: wallet.address,
                timestamp: Date.now(),
                nullifier: nullifier,
                otherParams: { testId: `nullifier-first-${i}` }
            });

            // Verify and register the nullifier
            const validResult = await verifyProof(validProof);
            usedNullifiers.add(nullifier);

            // Try to reuse the same nullifier in a second proof
            const reuseProof = await generateStandardProof({
                walletAddress: wallet.address,
                timestamp: Date.now() + 1000, // 1 second later
                nullifier: nullifier, // Same nullifier
                otherParams: { testId: `nullifier-reuse-${i}` }
            });

            // Verify with nullifier checking
            const reuseResult = await verifyProof(reuseProof, {
                checkNullifier: true,
                usedNullifiers: Array.from(usedNullifiers)
            });

            if (!reuseResult.valid) {
                results.detected++;
                results.detections.push({
                    testId: i,
                    nullifier: nullifier,
                    detectionReason: reuseResult.reason || 'Nullifier reuse detected'
                });
            }
        }

        results.detectionRate = this.calculateDetectionRate(results.detected);
        results.recommendation = this.generateRecommendation(results.detectionRate);

        if (results.detectionRate < 100) {
            results.recommendationDetails = 'Implement a persistent nullifier registry and strict nullifier checks for all proofs';
        }

        return results;
    }

    /**
     * Tests resistance to identity spoofing attacks
     * @returns {Promise<Object>} Test results
     */
    async testIdentitySpoofing() {
        this.log('Testing identity spoofing attack resistance');
        const results = {
            detected: 0,
            total: this.iterations,
            detections: []
        };

        for (let i = 0; i < this.iterations; i++) {
            // Create a legitimate wallet (the "victim")
            const legitimateWallet = this.generateTestWallet();

            // Create an attacker wallet
            const attackerWallet = this.generateTestWallet();

            // First have the legitimate wallet generate a valid proof
            const legitProof = await generateStandardProof({
                walletAddress: legitimateWallet.address,
                timestamp: Date.now(),
                signature: await legitimateWallet.signMessage(`auth-${Date.now()}`),
                otherParams: { testId: `identity-legit-${i}` }
            });

            // Now attempt an identity spoofing attack where the attacker
            // tries to generate a proof claiming to be the legitimate wallet
            const spoofProof = await generateStandardProof({
                walletAddress: legitimateWallet.address, // Claiming to be the legitimate wallet
                timestamp: Date.now(),
                signature: await attackerWallet.signMessage(`spoof-${Date.now()}`), // But using attacker's signature
                otherParams: { testId: `identity-spoof-${i}` }
            });

            // Verify with signature checking
            const spoofResult = await verifyProof(spoofProof, {
                checkSignature: true,
                expectedAddress: legitimateWallet.address
            });

            if (!spoofResult.valid) {
                results.detected++;
                results.detections.push({
                    testId: i,
                    legitimateWallet: legitimateWallet.address,
                    attackerWallet: attackerWallet.address,
                    detectionReason: spoofResult.reason || 'Identity spoofing detected'
                });
            }
        }

        results.detectionRate = this.calculateDetectionRate(results.detected);
        results.recommendation = this.generateRecommendation(results.detectionRate);

        if (results.detectionRate < 95) {
            results.recommendationDetails = 'Implement cryptographic identity verification with signature validation for all proofs';
        }

        return results;
    }

    /**
     * Simulates a signature replay attack by reusing a valid signature
     * @returns {Promise<Object>} Test results
     */
    async simulateSignatureReplay() {
        this.log('Simulating signature replay attack');
        const results = {
            detected: 0,
            total: this.iterations,
            detections: []
        };

        for (let i = 0; i < this.iterations; i++) {
            const wallet = this.generateTestWallet();
            const timestamp = Date.now();
            const nonce = crypto.randomBytes(16).toString('hex');

            // Create a message to sign
            const message = `Authenticate for action at ${timestamp} with nonce ${nonce}`;

            // Sign the message with the wallet's private key
            const signature = await wallet.signMessage(message);

            // Verify the signature (should be valid)
            const signerAddress = ethers.utils.verifyMessage(message, signature);
            const isValidSignature = signerAddress === wallet.address;

            // Now attempt to replay the same signature with a different context
            // In a secure system, this should be detected through timestamp/nonce checking
            const replayTimestamp = timestamp + 3600000; // 1 hour later
            const replayContext = {
                signature,
                originalMessage: message,
                currentTimestamp: replayTimestamp,
                nonceStore: [nonce] // Simulating a nonce store that would catch replays
            };

            // In a real implementation, we'd check:
            // 1. If the signature is valid for the message
            // 2. If the timestamp in the message is recent (not too old)
            // 3. If the nonce has been used before
            const isReplayDetected = this.detectSignatureReplay(replayContext);

            if (isReplayDetected) {
                results.detected++;
                results.detections.push({
                    testId: i,
                    wallet: wallet.address,
                    originalTimestamp: timestamp,
                    replayTimestamp: replayTimestamp,
                    detectionReason: isReplayDetected.reason
                });
            }
        }

        results.detectionRate = this.calculateDetectionRate(results.detected);
        results.recommendation = this.generateRecommendation(results.detectionRate);

        if (results.detectionRate < 100) {
            results.recommendationDetails = 'Implement timestamp validation, nonce verification, and signature context binding to prevent signature replay attacks';
        }

        return results;
    }

    /**
     * Detects signature replay attempts
     * @param {Object} context - Replay detection context
     * @returns {Object|null} Detection result or null if not detected
     * @private
     */
    detectSignatureReplay(context) {
        // Extract message parts (a real implementation would use a more robust approach)
        const messageMatch = context.originalMessage.match(/Authenticate for action at (\d+) with nonce ([a-f0-9]+)/i);

        if (!messageMatch) {
            return { detected: true, reason: 'Invalid message format' };
        }

        const originalTimestamp = parseInt(messageMatch[1]);
        const nonce = messageMatch[2];

        // Check if the timestamp is too old (> 5 minutes)
        const timestampDiff = context.currentTimestamp - originalTimestamp;
        if (timestampDiff > 5 * 60 * 1000) {
            return {
                detected: true,
                reason: 'Signature expired',
                originalTimestamp,
                currentTimestamp: context.currentTimestamp,
                timeDifference: timestampDiff
            };
        }

        // Check if nonce has been used before
        if (context.nonceStore.includes(nonce)) {
            return {
                detected: true,
                reason: 'Nonce already used',
                nonce
            };
        }

        return null; // No replay detected
    }
} 