/**
 * @fileoverview Anomaly Detector for ZK Proofs (CommonJS version)
 * 
 * This detector identifies anomalous patterns and behaviors in zero-knowledge
 * proof systems that may indicate vulnerabilities or implementation issues.
 * It focuses on detecting statistical outliers and unexpected execution patterns.
 */

const { SecurityRule } = require('../../rules/SecurityRule.cjs');
const { RuleCategory, Severity } = require('../../AuditConfig.cjs');
const { zkErrorLogger } = require('../../../zkErrorLogger.cjs');

/**
 * Notification channel types for anomaly alerts
 * @enum {string}
 */
const NotificationChannelType = {
    EMAIL: 'email',
    SLACK: 'slack',
    WEBHOOK: 'webhook',
    CONSOLE: 'console',
    LOG_FILE: 'log_file'
};

/**
 * Anomaly detector class for identifying anomalous patterns in ZK proof systems
 * @class
 * @extends SecurityRule
 */
class AnomalyDetector extends SecurityRule {
    /**
     * Create a new anomaly detector
     * 
     * @param {Object} [options] - Detector options
     */
    constructor(options = {}) {
        super({
            id: 'ZK-ANOMALY-001',
            name: 'Anomaly Detection System',
            description: 'Detects anomalous patterns and behaviors in ZK proof systems',
            severity: 'HIGH',
            ...options
        });

        // Configure detection thresholds
        this.thresholds = {
            codeComplexity: options.codeComplexity || 15,
            unusualControlFlow: options.unusualControlFlow || 0.8,
            inconsistentNaming: options.inconsistentNaming || 0.7,
            unusualErrorHandling: options.unusualErrorHandling || 0.75,
            statisticalOutliers: options.statisticalOutliers || 2.5 // Standard deviations
        };

        // Initialize pattern storage for tracking statistical norms
        this.patternStorage = {
            functionSizes: [],
            errorHandlingPatterns: {},
            namingPatterns: {},
            controlFlowPatterns: {}
        };
        
        // Initialize notification channels
        this.notificationChannels = [];
        
        // Default console notification channel
        this.addNotificationChannel({
            id: 'default-console',
            name: 'Default Console Logger',
            type: NotificationChannelType.CONSOLE,
            config: { level: 'info' },
            active: true
        });
    }

    /**
     * Check if a file is relevant for anomaly analysis
     * 
     * @param {string} filePath - Path to the file
     * @param {string} content - File content
     * @returns {boolean} Whether the file is relevant
     */
    isRelevantFile(filePath, content) {
        try {
            // Only analyze JavaScript/TypeScript files 
            if (!/\.(js|ts|jsx|tsx)$/.test(filePath)) {
                return false;
            }

            // Check if file contains ZK-related keywords
            const relevantKeywords = [
                'proof', 'verify', 'zk', 'zero-knowledge', 'snark', 'stark',
                'commit', 'secret', 'witness', 'circuit', 'prover', 'verifier'
            ];

            const contentLower = content.toLowerCase();
            return relevantKeywords.some(keyword => contentLower.includes(keyword));
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'AnomalyDetector.isRelevantFile',
                filePath,
                message: 'Error checking file relevance'
            });
            return false;
        }
    }

    /**
     * Calculate cyclomatic complexity of a function
     * 
     * @param {string} functionBody - Function body
     * @returns {number} Complexity score
     */
    calculateComplexity(functionBody) {
        try {
            // Count decision points (if, for, while, case, &&, ||, ternary)
            const decisionPoints = [
                ...functionBody.matchAll(/\bif\b|\belse if\b|\bfor\b|\bwhile\b|\bcase\b|&&|\|\||\?/g)
            ].length;

            // Count function exit points
            const exitPoints = [
                ...functionBody.matchAll(/\breturn\b|\bthrow\b/g)
            ].length;

            // Basic complexity = 1 + decision points
            return 1 + decisionPoints + (exitPoints > 1 ? exitPoints - 1 : 0);
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'AnomalyDetector.calculateComplexity',
                message: 'Error calculating function complexity'
            });
            return 1; // Default to minimal complexity on error
        }
    }

    /**
     * Extract all functions from code
     * 
     * @param {string} content - Code content
     * @returns {Array<Object>} Array of extracted functions
     */
    extractFunctions(content) {
        try {
            const functions = [];
            // Regular function declarations
            const funcPattern = /(?:function\s+(\w+)\s*\([^)]*\)\s*{([^{}]*(?:{[^{}]*(?:{[^{}]*}[^{}]*)*}[^{}]*)*)})|(const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*{([^{}]*(?:{[^{}]*(?:{[^{}]*}[^{}]*)*}[^{}]*)*)}|(const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*([^{;]*);/g;

            let match;
            while ((match = funcPattern.exec(content)) !== null) {
                let name, body;

                if (match[1] && match[2]) {
                    // Regular function declaration
                    name = match[1];
                    body = match[2];
                } else if (match[4] && match[5]) {
                    // Arrow function with block body
                    name = match[4];
                    body = match[5];
                } else if (match[7] && match[8]) {
                    // Arrow function with expression body
                    name = match[7];
                    body = match[8];
                }

                if (name && body) {
                    functions.push({
                        name,
                        body,
                        startIndex: match.index,
                        endIndex: match.index + match[0].length,
                        complexity: this.calculateComplexity(body),
                        lines: body.split('\n').length
                    });
                }
            }

            return functions;
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'AnomalyDetector.extractFunctions',
                message: 'Error extracting functions from code'
            });
            return [];
        }
    }

    /**
     * Detect inconsistent naming patterns
     * 
     * @param {Array<Object>} functions - Extracted functions
     * @returns {Array<Object>} Detected anomalies
     */
    detectNamingInconsistencies(functions) {
        try {
            const findings = [];

            // Naming conventions analysis
            const namingPatterns = {
                camelCase: /^[a-z][a-zA-Z0-9]*$/,
                pascalCase: /^[A-Z][a-zA-Z0-9]*$/,
                snake_case: /^[a-z][a-z0-9_]*$/,
                UPPER_SNAKE: /^[A-Z][A-Z0-9_]*$/
            };

            // Count naming patterns
            const patternCounts = {};
            for (const func of functions) {
                for (const [pattern, regex] of Object.entries(namingPatterns)) {
                    if (regex.test(func.name)) {
                        patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
                        break;
                    }
                }
            }

            // Find dominant pattern
            const totalFunctions = functions.length;
            let dominantPattern = null;
            let dominantCount = 0;

            for (const [pattern, count] of Object.entries(patternCounts)) {
                if (count > dominantCount) {
                    dominantPattern = pattern;
                    dominantCount = count;
                }
            }

            // Only consider as anomaly if we have a clear dominant pattern and outliers
            if (dominantPattern && dominantCount / totalFunctions > this.thresholds.inconsistentNaming) {
                // Check for functions that don't follow dominant pattern
                for (const func of functions) {
                    let followsDominant = false;

                    for (const [pattern, regex] of Object.entries(namingPatterns)) {
                        if (pattern === dominantPattern && regex.test(func.name)) {
                            followsDominant = true;
                            break;
                        }
                    }

                    if (!followsDominant) {
                        findings.push({
                            type: 'inconsistent-naming',
                            function: func.name,
                            message: `Function "${func.name}" doesn't follow the dominant naming convention (${dominantPattern})`,
                            location: func.startIndex
                        });
                    }
                }
            }

            return findings;
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'AnomalyDetector.detectNamingInconsistencies',
                message: 'Error detecting naming inconsistencies'
            });
            return [];
        }
    }

    /**
     * Detect unusual control flow patterns
     * 
     * @param {string} content - Code content
     * @param {Array<Object>} functions - Extracted functions
     * @returns {Array<Object>} Detected anomalies
     */
    detectUnusualControlFlow(content, functions) {
        const findings = [];

        // Look for unusual control flow patterns
        const unusualPatterns = [
            { pattern: /label\s*:\s*for\s*\(/, message: 'Labeled loops' },
            { pattern: /goto\s+\w+/, message: 'Goto statements' },
            { pattern: /eval\(.*proof/, message: 'Eval with proof data' },
            { pattern: /process\.exit\([^)]*\)/, message: 'Abrupt process termination' },
            { pattern: /while\s*\(\s*true\s*\)(?![^{]*break)/, message: 'Infinite loop without break' },
            { pattern: /try\s*{[^}]*}\s*catch\s*\([^)]*\)\s*{\s*}/, message: 'Empty catch block' },
            { pattern: /if\s*\([^)]*\)\s*{\s*}\s*else\s*{/, message: 'Empty if block' }
        ];

        // Check for high complexity functions
        for (const func of functions) {
            if (func.complexity > this.thresholds.codeComplexity) {
                findings.push({
                    type: 'high-complexity',
                    function: func.name,
                    message: `Function "${func.name}" has high cyclomatic complexity (${func.complexity})`,
                    location: func.startIndex
                });
            }
        }

        // Check for unusual patterns
        for (const pattern of unusualPatterns) {
            const matches = [...content.matchAll(pattern.pattern)];
            for (const match of matches) {
                const lineNumber = this.getLineNumber(content, match.index);
                findings.push({
                    type: 'unusual-control-flow',
                    message: `Unusual control flow pattern detected: ${pattern.message}`,
                    location: match.index,
                    lineNumber
                });
            }
        }

        return findings;
    }

    /**
     * Detect statistical outliers in code metrics
     * 
     * @param {Array<Object>} functions - Extracted functions
     * @returns {Array<Object>} Detected anomalies
     */
    detectStatisticalOutliers(functions) {
        const findings = [];

        if (functions.length < 5) {
            // Not enough functions for meaningful statistical analysis
            return findings;
        }

        // Analyze function size outliers
        const functionSizes = functions.map(f => f.lines);
        const avgSize = functionSizes.reduce((sum, size) => sum + size, 0) / functionSizes.length;
        const sizeVariance = functionSizes.reduce((sum, size) => sum + Math.pow(size - avgSize, 2), 0) / functionSizes.length;
        const sizeStdDev = Math.sqrt(sizeVariance);

        // Find outliers (beyond threshold standard deviations)
        for (const func of functions) {
            const sizeDelta = (func.lines - avgSize) / sizeStdDev;

            if (Math.abs(sizeDelta) > this.thresholds.statisticalOutliers) {
                findings.push({
                    type: 'statistical-outlier',
                    function: func.name,
                    message: `Function "${func.name}" has abnormal size (${func.lines} lines, ${sizeDelta.toFixed(2)} std dev from mean)`,
                    location: func.startIndex
                });
            }
        }

        // Analyze complexity outliers
        const complexities = functions.map(f => f.complexity);
        const avgComplexity = complexities.reduce((sum, c) => sum + c, 0) / complexities.length;
        const complexityVariance = complexities.reduce((sum, c) => sum + Math.pow(c - avgComplexity, 2), 0) / complexities.length;
        const complexityStdDev = Math.sqrt(complexityVariance);

        for (const func of functions) {
            const complexityDelta = (func.complexity - avgComplexity) / complexityStdDev;

            if (Math.abs(complexityDelta) > this.thresholds.statisticalOutliers &&
                !findings.find(f => f.type === 'high-complexity' && f.function === func.name)) {
                findings.push({
                    type: 'statistical-outlier',
                    function: func.name,
                    message: `Function "${func.name}" has abnormal complexity (${func.complexity}, ${complexityDelta.toFixed(2)} std dev from mean)`,
                    location: func.startIndex
                });
            }
        }

        return findings;
    }

    /**
     * Detect unusual error handling patterns
     * 
     * @param {string} content - Code content
     * @returns {Array<Object>} Detected anomalies
     */
    detectUnusualErrorHandling(content) {
        const findings = [];

        // Analyze error handling patterns
        const errorPatterns = [
            { pattern: /catch\s*\([^)]*\)\s*{\s*console\.(?:log|error|warn)/g, message: 'Error caught but only logged' },
            { pattern: /catch\s*\([^)]*\)\s*{\s*return\s+true/g, message: 'Error caught but returning true' },
            { pattern: /catch\s*\([^)]*\)\s*{\s*\/\/[^\n]*\s*}/g, message: 'Error caught with only comments' },
            { pattern: /try\s*{[^}]*verify[^}]*}\s*catch\s*\([^)]*\)\s*{\s*return\s+(?:true|null|undefined)/g, message: 'Verification error suppressed' }
        ];

        for (const pattern of errorPatterns) {
            const matches = [...content.matchAll(pattern.pattern)];
            for (const match of matches) {
                findings.push({
                    type: 'unusual-error-handling',
                    message: `Unusual error handling pattern detected: ${pattern.message}`,
                    location: match.index,
                    lineNumber: this.getLineNumber(content, match.index)
                });
            }
        }

        return findings;
    }

    /**
     * Check for proof verification bypass flags
     * 
     * @param {string} content - Code content
     * @returns {Array<Object>} Detected anomalies
     */
    detectBypassFlags(content) {
        const findings = [];

        // Look for bypass flags and debug modes
        const bypassPatterns = [
            { pattern: /(?:const|let|var)\s+(?:SKIP_VERIFICATION|BYPASS_CHECKS|DISABLE_SECURITY|DEBUG_MODE|TEST_MODE)\s*=\s*true/g, message: 'Security bypass flag enabled' },
            { pattern: /if\s*\(\s*(?:process\.env\.NODE_ENV\s*!==?\s*['"]production['"]|development|test|debug)\s*\)\s*{\s*(?:[^}]*(?:skip|bypass)verification[^}]*|[^}]*return\s+true[^}]*)}/g, message: 'Verification bypassed in non-production environments' },
            { pattern: /\/\/\s*TODO.*implementation/g, message: 'Incomplete implementation marked with TODO' }
        ];

        for (const pattern of bypassPatterns) {
            const matches = [...content.matchAll(pattern.pattern)];
            for (const match of matches) {
                findings.push({
                    type: 'bypass-flag',
                    message: `Potential security bypass detected: ${pattern.message}`,
                    location: match.index,
                    lineNumber: this.getLineNumber(content, match.index)
                });
            }
        }

        return findings;
    }

    /**
     * Get the line number for an index in the code
     * 
     * @param {string} content - File content
     * @param {number} index - Character index
     * @returns {number} Line number (1-based)
     */
    getLineNumber(content, index) {
        const lines = content.substring(0, index).split('\n');
        return lines.length;
    }

    /**
     * Main evaluation method that runs the anomaly detection
     * 
     * @param {Object} context - The context to analyze
     * @returns {Object} Evaluation result with findings
     */
    evaluate(context) {
        try {
            // Get file paths and contents from the context
            const results = {
                triggered: false,
                anomalies: [],
                details: {},
                location: context.mainFilePath || ''
            };

            // Skip if no files to analyze
            if (!context.files || !Array.isArray(context.files) || context.files.length === 0) {
                return results;
            }

            // Analyze each file for anomalies
            for (const file of context.files) {
                // Skip irrelevant files
                if (!this.isRelevantFile(file.path, file.content)) {
                    continue;
                }

                // Extract and analyze functions
                const functions = this.extractFunctions(file.content);

                // Skip files with no functions
                if (functions.length === 0) {
                    continue;
                }

                // Detect various anomalies
                const namingAnomalies = this.detectNamingInconsistencies(functions);
                const complexityAnomalies = this.detectStatisticalOutliers(functions);
                const controlFlowAnomalies = this.detectUnusualControlFlow(file.content, functions);
                const errorHandlingAnomalies = this.detectUnusualErrorHandling(file.content);
                const bypassAnomalies = this.detectBypassFlags(file.content);

                // Combine all anomalies
                const fileAnomalies = [
                    ...namingAnomalies,
                    ...complexityAnomalies,
                    ...controlFlowAnomalies,
                    ...errorHandlingAnomalies,
                    ...bypassAnomalies
                ].map(anomaly => ({
                    ...anomaly,
                    filePath: file.path
                }));

                // Add to overall results if anomalies found
                if (fileAnomalies.length > 0) {
                    results.anomalies.push(...fileAnomalies);
                    results.triggered = true;

                    // Group anomalies by file for details
                    if (!results.details[file.path]) {
                        results.details[file.path] = [];
                    }
                    results.details[file.path].push(...fileAnomalies);
                    
                    // Send notifications for detected anomalies
                    this.notifyAnomalies(fileAnomalies, file.path);
                }
            }

            // Set overall summary
            if (results.triggered) {
                results.summary = `Found ${results.anomalies.length} anomalies across ${Object.keys(results.details).length} files`;
            }

            return results;
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'AnomalyDetector.evaluate',
                message: 'Error evaluating anomaly detection rules'
            });

            return {
                triggered: false,
                error: error.message,
                details: {
                    errorType: error.name,
                    stack: error.stack
                }
            };
        }
    }

    /**
     * Get code snippet around a location
     * 
     * @param {string} content - File content
     * @param {number} location - Location index
     * @param {number} [context=3] - Number of context lines
     * @returns {string} Code snippet
     */
    getCodeSnippet(content, location, context = 3) {
        const lines = content.split('\n');
        const lineNumber = this.getLineNumber(content, location);
        const startLine = Math.max(0, lineNumber - context - 1);
        const endLine = Math.min(lines.length - 1, lineNumber + context - 1);

        return lines.slice(startLine, endLine + 1).join('\n');
    }
    
    /**
     * Add a notification channel
     * 
     * @param {Object} channel - The notification channel to add
     * @returns {boolean} Success indicator
     */
    addNotificationChannel(channel) {
        try {
            // Validate channel
            if (!channel || !channel.id || !channel.type) {
                zkErrorLogger.logError(new Error('Invalid notification channel'), {
                    context: 'AnomalyDetector.addNotificationChannel',
                    details: channel
                });
                return false;
            }
            
            // Check if channel already exists
            const existingIndex = this.notificationChannels.findIndex(c => c.id === channel.id);
            if (existingIndex >= 0) {
                // Update existing channel
                this.notificationChannels[existingIndex] = { ...channel };
            } else {
                // Add new channel
                this.notificationChannels.push({ ...channel });
            }
            
            return true;
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'AnomalyDetector.addNotificationChannel',
                message: 'Failed to add notification channel'
            });
            return false;
        }
    }
    
    /**
     * Remove a notification channel by ID
     * 
     * @param {string} channelId - ID of the channel to remove
     * @returns {boolean} Success indicator
     */
    removeNotificationChannel(channelId) {
        try {
            const initialLength = this.notificationChannels.length;
            this.notificationChannels = this.notificationChannels.filter(c => c.id !== channelId);
            
            return this.notificationChannels.length < initialLength;
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'AnomalyDetector.removeNotificationChannel',
                message: 'Failed to remove notification channel',
                channelId
            });
            return false;
        }
    }
    
    /**
     * Send notification about detected anomalies
     * 
     * @param {Array<Object>} anomalies - Detected anomalies
     * @param {string} filePath - Path to the file with anomalies
     * @returns {boolean} Success indicator
     */
    notifyAnomalies(anomalies, filePath) {
        try {
            if (!anomalies || anomalies.length === 0) {
                return true; // Nothing to notify
            }
            
            // Get active channels
            const activeChannels = this.notificationChannels.filter(c => c.active);
            if (activeChannels.length === 0) {
                return true; // No active channels
            }
            
            // Format notification message
            const message = {
                timestamp: new Date().toISOString(),
                detector: this.name,
                filePath,
                anomalyCount: anomalies.length,
                anomalies: anomalies.map(a => ({
                    type: a.type,
                    message: a.message,
                    lineNumber: a.lineNumber || 0
                }))
            };
            
            // Send to each channel
            let success = true;
            for (const channel of activeChannels) {
                try {
                    switch (channel.type) {
                        case NotificationChannelType.CONSOLE:
                            console.log(`[ANOMALY DETECTOR] Anomalies in ${filePath}:`);
                            anomalies.forEach(a => console.log(`- ${a.message} (line ${a.lineNumber || 'unknown'})`));
                            break;
                            
                        case NotificationChannelType.LOG_FILE:
                            // Simplified log file implementation
                            if (typeof channel.config.logger === 'function') {
                                channel.config.logger(JSON.stringify(message, null, 2));
                            }
                            break;
                            
                        case NotificationChannelType.WEBHOOK:
                            // In a real implementation, this would use fetch or similar
                            if (typeof channel.config.sendWebhook === 'function') {
                                channel.config.sendWebhook(channel.config.url, message);
                            }
                            break;
                            
                        // Other channel types would be implemented in a real system
                        default:
                            // Log that channel type is not implemented
                            console.warn(`Notification channel type not implemented: ${channel.type}`);
                    }
                } catch (channelError) {
                    success = false;
                    zkErrorLogger.logError(channelError, {
                        context: 'AnomalyDetector.notifyAnomalies',
                        message: `Failed to send notification via channel: ${channel.id}`,
                        channelType: channel.type
                    });
                }
            }
            
            return success;
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'AnomalyDetector.notifyAnomalies',
                message: 'Failed to send anomaly notifications'
            });
            return false;
        }
    }
}

// Create a default instance
const anomalyDetector = new AnomalyDetector();

// CommonJS exports
module.exports = {
    AnomalyDetector,
    NotificationChannelType,
    anomalyDetector
};