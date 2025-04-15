/**
 * @fileoverview Enhanced security testing framework for ZK proof systems
 * Provides advanced security testing capabilities beyond the base SecurityTest class
 */

import { SecurityTest } from './SecurityTest.js';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { ethers } from 'ethers';
import zkErrorLogger from '../../src/zkErrorLogger.js';

/**
 * Enhanced security testing framework for advanced security testing of ZK proof systems
 * Extends the base SecurityTest class with additional functionality for more complex security tests
 * @extends SecurityTest
 */
export class SecurityTestingFrameworkEnhancement extends SecurityTest {
    /**
     * Creates a new SecurityTestingFrameworkEnhancement instance
     * @param {Object} options - Test configuration options
     * @param {string} options.name - Name of the test suite
     * @param {boolean} [options.verbose=false] - Whether to log verbose output
     * @param {string} [options.outputDir] - Directory to save test results
     * @param {number} [options.iterations=100] - Number of test iterations to run
     * @param {boolean} [options.collectMetrics=true] - Whether to collect performance metrics during testing
     * @param {boolean} [options.enableRealTimeDetection=false] - Whether to enable real-time attack detection
     * @param {number} [options.anomalyThreshold=2.5] - Standard deviation threshold for anomaly detection
     * @param {Object} [options.customRules={}] - Custom security rules to apply
     */
    constructor(options = {}) {
        super(options);

        this.collectMetrics = options.collectMetrics !== undefined ? options.collectMetrics : true;
        this.enableRealTimeDetection = options.enableRealTimeDetection || false;
        this.anomalyThreshold = options.anomalyThreshold || 2.5;
        this.customRules = options.customRules || {};

        // Metrics storage
        this.metrics = {
            detectionTimes: [],
            processingTimes: [],
            memoryUsage: [],
            anomalies: []
        };

        // Enhanced attack pattern database
        this.attackPatterns = {
            knownSignatures: new Set(),
            anomalyBaselines: {},
            detectionHistory: []
        };

        this.log('Enhanced security testing framework initialized');
    }

    /**
     * Runs a security test with enhanced monitoring and detection
     * @param {Function} testFn - The test function to run
     * @param {Object} context - Test context data
     * @returns {Object} Test results with enhanced metrics
     */
    async runEnhancedTest(testFn, context = {}) {
        try {
            this.log(`Running enhanced security test with ${this.iterations} iterations`);

            const startTime = process.hrtime();
            const startMemory = process.memoryUsage().heapUsed;

            // Initialize result counters
            let detectedCount = 0;
            let falsePositives = 0;
            let falseNegatives = 0;
            const vulnerabilities = {};

            // Run test iterations
            for (let i = 0; i < this.iterations; i++) {
                const iterationStart = process.hrtime();

                // Create iteration context with random values
                const iterationContext = {
                    ...context,
                    iteration: i,
                    wallet: this.generateTestWallet(),
                    testVector: this.generateRandomTestVector(32),
                    timestamp: Date.now()
                };

                // Run the test function
                const result = await testFn(iterationContext);

                // Track detection
                if (result.detected) {
                    detectedCount++;

                    // Store unique vulnerabilities
                    if (result.vulnerabilityType) {
                        vulnerabilities[result.vulnerabilityType] =
                            vulnerabilities[result.vulnerabilityType] || 0;
                        vulnerabilities[result.vulnerabilityType]++;
                    }

                    // Track false positives
                    if (result.expectedOutcome === false && result.detected) {
                        falsePositives++;
                    }
                } else {
                    // Track false negatives
                    if (result.expectedOutcome === true && !result.detected) {
                        falseNegatives++;
                    }
                }

                // Collect metrics if enabled
                if (this.collectMetrics) {
                    const iterationEnd = process.hrtime(iterationStart);
                    const iterationTimeMs = (iterationEnd[0] * 1000) + (iterationEnd[1] / 1000000);

                    this.metrics.processingTimes.push(iterationTimeMs);
                    this.metrics.memoryUsage.push(process.memoryUsage().heapUsed - startMemory);

                    if (result.detectionTime) {
                        this.metrics.detectionTimes.push(result.detectionTime);
                    }
                }

                // Real-time anomaly detection
                if (this.enableRealTimeDetection) {
                    this.detectRealTimeAnomalies(result, i);
                }
            }

            // Calculate total execution time
            const endTime = process.hrtime(startTime);
            const executionTimeMs = (endTime[0] * 1000) + (endTime[1] / 1000000);

            // Calculate detection rate
            const detectionRate = this.calculateDetectionRate(detectedCount);

            // Generate result object
            const results = {
                total: this.iterations,
                detected: detectedCount,
                falsePositives,
                falseNegatives,
                detectionRate,
                executionTimeMs,
                vulnerabilities,
                recommendation: this.generateRecommendation(detectionRate),
                anomalies: this.metrics.anomalies
            };

            // Add enhanced metrics
            if (this.collectMetrics) {
                results.metrics = {
                    averageProcessingTime: this.calculateAverage(this.metrics.processingTimes),
                    maxProcessingTime: Math.max(...this.metrics.processingTimes),
                    minProcessingTime: Math.min(...this.metrics.processingTimes),
                    processingTimeStdDev: this.calculateStandardDeviation(this.metrics.processingTimes),
                    averageDetectionTime: this.calculateAverage(this.metrics.detectionTimes),
                    peakMemoryUsage: Math.max(...this.metrics.memoryUsage),
                    anomalyCount: this.metrics.anomalies.length
                };
            }

            // Save results
            this.saveTestResults(results);

            return results;

        } catch (error) {
            // Log the error with the ZK error logger
            zkErrorLogger.logError(error);

            this.log(`Error during enhanced security test: ${error.message}`);
            throw error;
        }
    }

    /**
     * Detects real-time anomalies in test results
     * @param {Object} result - Test iteration result
     * @param {number} iteration - Current iteration number
     */
    detectRealTimeAnomalies(result, iteration) {
        try {
            // Skip first 10 iterations to establish baseline
            if (iteration < 10) {
                return;
            }

            // Check for anomalies in detection time
            if (result.detectionTime) {
                this.detectMetricAnomaly('detectionTime', result.detectionTime);
            }

            // Check for anomalies in memory usage
            const currentMemory = process.memoryUsage().heapUsed;
            this.detectMetricAnomaly('memoryUsage', currentMemory);

            // Check for anomalies in result patterns
            if (typeof result.pattern === 'string') {
                // Track unique signatures
                if (!this.attackPatterns.knownSignatures.has(result.pattern)) {
                    this.attackPatterns.knownSignatures.add(result.pattern);

                    // New pattern detected after baseline phase is anomalous
                    if (iteration > 20) {
                        this.metrics.anomalies.push({
                            type: 'new-attack-pattern',
                            iteration,
                            pattern: result.pattern,
                            timestamp: Date.now()
                        });
                    }
                }
            }
        } catch (error) {
            // Log the error with the ZK error logger
            zkErrorLogger.logError(error);

            this.log(`Error during anomaly detection: ${error.message}`);
        }
    }

    /**
     * Detects anomalies in a numeric metric based on statistical analysis
     * @param {string} metricName - Name of the metric
     * @param {number} currentValue - Current value of the metric
     */
    detectMetricAnomaly(metricName, currentValue) {
        if (!this.attackPatterns.anomalyBaselines[metricName]) {
            this.attackPatterns.anomalyBaselines[metricName] = {
                values: [],
                mean: 0,
                stdDev: 0
            };
        }

        const baseline = this.attackPatterns.anomalyBaselines[metricName];
        baseline.values.push(currentValue);

        // Keep only the last 100 values
        if (baseline.values.length > 100) {
            baseline.values.shift();
        }

        // Recalculate mean and standard deviation
        baseline.mean = this.calculateAverage(baseline.values);
        baseline.stdDev = this.calculateStandardDeviation(baseline.values);

        // Check if the current value is anomalous
        if (baseline.stdDev > 0) {
            const zScore = Math.abs((currentValue - baseline.mean) / baseline.stdDev);

            if (zScore > this.anomalyThreshold) {
                this.metrics.anomalies.push({
                    type: `${metricName}-anomaly`,
                    value: currentValue,
                    mean: baseline.mean,
                    stdDev: baseline.stdDev,
                    zScore,
                    timestamp: Date.now()
                });
            }
        }
    }

    /**
     * Simulates a security test with advanced attack patterns
     * @param {Object} options - Simulation options
     * @returns {Promise<Object>} Simulation results
     */
    async simulateAdvancedAttack(options = {}) {
        try {
            const attackType = options.attackType || 'random';
            const iterations = options.iterations || this.iterations;
            const successRate = options.successRate || 0.5;

            this.log(`Simulating advanced attack: ${attackType} with ${iterations} iterations`);

            // Generate parameters for each attack type
            const attackParams = this.generateAttackParameters(attackType);

            // Run the simulation
            return await this.runEnhancedTest(async (context) => {
                const isDetected = Math.random() < successRate;
                const detectionTimeMs = 5 + Math.random() * 50; // 5-55ms

                return {
                    detected: isDetected,
                    vulnerabilityType: attackType,
                    detectionTime: detectionTimeMs,
                    expectedOutcome: true,
                    pattern: `${attackType}-pattern-${Math.floor(Math.random() * 5)}`
                };
            });
        } catch (error) {
            // Log the error with the ZK error logger
            zkErrorLogger.logError(error);

            this.log(`Error simulating advanced attack: ${error.message}`);
            throw error;
        }
    }

    /**
     * Generates parameters for specific attack types
     * @param {string} attackType - Type of attack to simulate
     * @returns {Object} Attack parameters
     */
    generateAttackParameters(attackType) {
        switch (attackType) {
            case 'replay':
                return {
                    replayCount: Math.floor(Math.random() * 5) + 1,
                    timeBetweenReplays: Math.floor(Math.random() * 1000) + 100
                };

            case 'side-channel':
                return {
                    leakageType: ['timing', 'power', 'memory'][Math.floor(Math.random() * 3)],
                    magnitude: 0.1 + Math.random() * 0.9
                };

            case 'malleability':
                return {
                    modificationPercentage: Math.random() * 0.3,
                    preserveValidity: Math.random() > 0.5
                };

            case 'collision':
                return {
                    collisionProbability: 0.01 + Math.random() * 0.05,
                    collisionTechnique: ['birthday', 'length-extension', 'custom'][Math.floor(Math.random() * 3)]
                };

            default: // random
                return {
                    complexity: Math.floor(Math.random() * 10) + 1,
                    stealthiness: Math.random()
                };
        }
    }

    /**
     * Calculates the average value of an array of numbers
     * @param {Array<number>} values - Array of numeric values
     * @returns {number} Average value
     */
    calculateAverage(values) {
        if (!values.length) return 0;
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    }

    /**
     * Calculates the standard deviation of an array of numbers
     * @param {Array<number>} values - Array of numeric values
     * @returns {number} Standard deviation
     */
    calculateStandardDeviation(values) {
        if (!values.length) return 0;

        const avg = this.calculateAverage(values);
        const squareDiffs = values.map(value => {
            const diff = value - avg;
            return diff * diff;
        });

        const avgSquareDiff = this.calculateAverage(squareDiffs);
        return Math.sqrt(avgSquareDiff);
    }

    /**
     * Generates a comprehensive security report including all metrics and findings
     * @param {Object} results - Test results
     * @returns {Object} Enhanced security report
     */
    generateEnhancedReport(results) {
        try {
            // Base report
            const report = {
                name: this.name,
                timestamp: new Date().toISOString(),
                iterations: this.iterations,
                detectionRate: results.detectionRate,
                recommendation: results.recommendation,
                vulnerabilities: results.vulnerabilities
            };

            // Add enhanced metrics if available
            if (results.metrics) {
                report.metrics = results.metrics;
            }

            // Add anomaly analysis
            if (this.enableRealTimeDetection) {
                report.anomalyAnalysis = {
                    totalAnomalies: this.metrics.anomalies.length,
                    anomalyTypes: this.categorizeAnomalies(),
                    significantAnomalies: this.findSignificantAnomalies()
                };
            }

            // Calculate overall security score
            report.securityScore = this.calculateSecurityScore(results);

            // Generate detailed recommendations
            report.detailedRecommendations = this.generateDetailedRecommendations(results);

            return report;
        } catch (error) {
            // Log the error with the ZK error logger
            zkErrorLogger.logError(error);

            this.log(`Error generating enhanced report: ${error.message}`);
            return {
                error: 'Failed to generate enhanced report',
                message: error.message
            };
        }
    }

    /**
     * Categorizes anomalies by type
     * @returns {Object} Counts of anomaly types
     */
    categorizeAnomalies() {
        const typeCounts = {};

        for (const anomaly of this.metrics.anomalies) {
            typeCounts[anomaly.type] = (typeCounts[anomaly.type] || 0) + 1;
        }

        return typeCounts;
    }

    /**
     * Finds the most significant anomalies
     * @returns {Array<Object>} Significant anomalies
     */
    findSignificantAnomalies() {
        return this.metrics.anomalies
            .filter(anomaly => anomaly.zScore > this.anomalyThreshold * 1.5)
            .sort((a, b) => (b.zScore || 0) - (a.zScore || 0))
            .slice(0, 5);
    }

    /**
     * Calculates a security score from test results
     * @param {Object} results - Test results
     * @returns {number} Security score (0-100)
     */
    calculateSecurityScore(results) {
        // Base score from detection rate (0-80 points)
        let score = (results.detectionRate * 0.8);

        // Deduct for false positives/negatives (up to -20 points)
        const falseResultPenalty = ((results.falsePositives + results.falseNegatives) / this.iterations) * 20;
        score -= falseResultPenalty;

        // Deduct for anomalies (up to -10 points)
        if (this.metrics.anomalies.length > 0) {
            const anomalyPenalty = Math.min((this.metrics.anomalies.length / this.iterations) * 100, 10);
            score -= anomalyPenalty;
        }

        // Add bonus for comprehensive testing (up to +10 points)
        const vulnerabilityTypesCovered = Object.keys(results.vulnerabilities).length;
        const comprehensiveBonus = Math.min(vulnerabilityTypesCovered * 2, 10);
        score += comprehensiveBonus;

        // Ensure score is within 0-100 range
        return Math.max(0, Math.min(100, Math.round(score)));
    }

    /**
     * Generates detailed security recommendations based on test results
     * @param {Object} results - Test results
     * @returns {Array<Object>} Detailed recommendations
     */
    generateDetailedRecommendations(results) {
        const recommendations = [];

        // Detection rate recommendations
        if (results.detectionRate < 60) {
            recommendations.push({
                priority: 'critical',
                category: 'detection',
                description: 'Critical security vulnerability: Low attack detection rate',
                action: 'Implement additional security controls and monitoring systems immediately'
            });
        } else if (results.detectionRate < 80) {
            recommendations.push({
                priority: 'high',
                category: 'detection',
                description: 'Significant security vulnerability: Moderate attack detection rate',
                action: 'Review and enhance detection mechanisms for missed attack patterns'
            });
        }

        // False positive/negative recommendations
        const falseResultRate = ((results.falsePositives + results.falseNegatives) / this.iterations) * 100;
        if (falseResultRate > 10) {
            recommendations.push({
                priority: 'high',
                category: 'accuracy',
                description: 'High false result rate affecting detection reliability',
                action: 'Tune detection algorithms to reduce false positives and negatives'
            });
        }

        // Anomaly recommendations
        if (this.metrics.anomalies.length > 0) {
            recommendations.push({
                priority: 'medium',
                category: 'anomalies',
                description: `${this.metrics.anomalies.length} anomalies detected during testing`,
                action: 'Investigate anomalous patterns and unexpected behaviors'
            });
        }

        // Performance recommendations
        if (results.metrics && results.metrics.averageProcessingTime > 500) {
            recommendations.push({
                priority: 'medium',
                category: 'performance',
                description: 'Detection performance below optimal levels',
                action: 'Optimize security controls to reduce detection latency'
            });
        }

        return recommendations;
    }

    /**
     * Exports collected security metrics to a CSV file
     * @param {string} [filename] - Output filename (default: metrics-{timestamp}.csv)
     * @returns {string} Path to the exported file
     */
    exportMetricsToCSV(filename) {
        try {
            const timestamp = new Date().toISOString().replace(/:/g, '-');
            const csvFilename = filename || `${this.name.replace(/\s+/g, '-')}-metrics-${timestamp}.csv`;
            const filePath = path.join(this.outputDir, csvFilename);

            // Generate CSV header and rows
            const headers = ['iteration', 'processingTime', 'detectionTime', 'memoryUsage'];
            const rows = [];

            // Generate data rows
            for (let i = 0; i < this.metrics.processingTimes.length; i++) {
                rows.push([
                    i,
                    this.metrics.processingTimes[i] || '',
                    this.metrics.detectionTimes[i] || '',
                    this.metrics.memoryUsage[i] || ''
                ].join(','));
            }

            // Combine header and rows
            const csvContent = [headers.join(','), ...rows].join('\n');

            // Write to file
            fs.writeFileSync(filePath, csvContent);
            this.log(`Metrics exported to: ${filePath}`);

            return filePath;
        } catch (error) {
            // Log the error with the ZK error logger
            zkErrorLogger.logError(error);

            this.log(`Error exporting metrics to CSV: ${error.message}`);
            throw error;
        }
    }
} 