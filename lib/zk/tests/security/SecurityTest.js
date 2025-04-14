/**
 * @fileoverview Base class for ZK security testing
 * Provides common functionality for all security test implementations
 */

import path from 'path';
import fs from 'fs';
import { ethers } from 'ethers';
import crypto from 'crypto';

/**
 * Base class for security testing of ZK proof systems
 */
export class SecurityTest {
    /**
     * Creates a new SecurityTest instance
     * @param {Object} options - Test configuration options
     * @param {string} options.name - Name of the test suite
     * @param {boolean} [options.verbose=false] - Whether to log verbose output
     * @param {string} [options.outputDir] - Directory to save test results
     * @param {number} [options.iterations=100] - Number of test iterations to run
     */
    constructor(options = {}) {
        this.name = options.name || 'Security Test';
        this.verbose = options.verbose || false;
        this.iterations = options.iterations || 100;
        this.outputDir = options.outputDir || path.join(process.cwd(), 'lib/zk/tests/security-results');

        // Create output directory if it doesn't exist
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    /**
     * Generates a test wallet with random private key
     * @returns {Object} Ethereum wallet
     */
    generateTestWallet() {
        return ethers.Wallet.createRandom();
    }

    /**
     * Generates a random test vector of specified length
     * @param {number} length - Length of test vector in bytes
     * @returns {Buffer} Random buffer of specified length
     */
    generateRandomTestVector(length = 32) {
        return crypto.randomBytes(length);
    }

    /**
     * Calculates the detection rate from detected count
     * @param {number} detectedCount - Number of detected attacks
     * @returns {number} Detection rate as percentage (0-100)
     */
    calculateDetectionRate(detectedCount) {
        return (detectedCount / this.iterations) * 100;
    }

    /**
     * Generates a security recommendation based on detection rate
     * @param {number} detectionRate - Detection rate as percentage (0-100)
     * @returns {string} Security recommendation text
     */
    generateRecommendation(detectionRate) {
        if (detectionRate >= 95) {
            return 'Excellent security. No immediate action required.';
        } else if (detectionRate >= 80) {
            return 'Good security. Minor improvements recommended.';
        } else if (detectionRate >= 60) {
            return 'Moderate security concerns. Review and remediate.';
        } else {
            return 'Significant security vulnerabilities. Immediate attention required.';
        }
    }

    /**
     * Saves test results to output directory
     * @param {Object} results - Test results to save
     */
    saveTestResults(results) {
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const fileName = `${this.name.replace(/\s+/g, '-')}-${timestamp}.json`;
        const filePath = path.join(this.outputDir, fileName);

        fs.writeFileSync(
            filePath,
            JSON.stringify({
                name: this.name,
                timestamp: new Date().toISOString(),
                iterations: this.iterations,
                results
            }, null, 2)
        );

        this.log(`Test results saved to: ${filePath}`);
    }

    /**
     * Logs a message if verbose mode is enabled
     * @param {string} message - Message to log
     */
    log(message) {
        if (this.verbose) {
            console.log(`[${this.name}] ${message}`);
        }
    }
} 