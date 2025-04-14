/**
 * @fileoverview Security Rule Runner for ZK code analysis
 * 
 * This module runs security rules against a codebase to identify potential
 * vulnerabilities in ZK implementations. It can analyze individual files
 * or entire directories recursively.
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { SecurityRuleFactory } from './rules/SecurityRuleFactory.js';
import { SecurityRulesRegistry } from './SecurityRulesRegistry.js';
import { SecurityRuleExecutionError } from './SecurityRule.js';
import zkErrorLogger from '../zkErrorLogger.js';

/**
 * Run security rules against files or directories
 * @class
 */
export class SecurityRuleRunner {
    /**
     * Create a new SecurityRuleRunner
     * 
     * @param {Object} options - Configuration options
     * @param {Array} [options.rules] - Security rules to run
     * @param {string} [options.outputDir=./security-reports] - Output directory for reports
     * @param {boolean} [options.verbose=false] - Enable verbose logging
     * @param {Array<string>} [options.excludePatterns] - Glob patterns to exclude
     * @param {Array<string>} [options.includeExtensions] - File extensions to include
     */
    constructor(options = {}) {
        this.rules = options.rules || [];
        this.outputDir = options.outputDir || './security-reports';
        this.verbose = options.verbose || false;
        this.excludePatterns = options.excludePatterns || [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/*.min.js',
            '**/vendor/**'
        ];
        this.includeExtensions = options.includeExtensions || ['.js', '.ts', '.jsx', '.tsx'];

        // Load default rules if none provided
        if (this.rules.length === 0) {
            this._loadDefaultRules();
        }

        this.log(`Initialized SecurityRuleRunner with ${this.rules.length} rules`);
        this.log(`Output directory: ${this.outputDir}`);
    }

    /**
     * Load default security rules from registry
     * @private
     */
    _loadDefaultRules() {
        try {
            const registry = new SecurityRulesRegistry();
            this.rules = registry.getDefaultRules();
            this.log(`Loaded ${this.rules.length} default security rules`);
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityRuleRunner._loadDefaultRules',
                message: 'Failed to load default security rules'
            });
            throw new SecurityRuleExecutionError(
                `Failed to load default security rules: ${error.message}`,
                'RULE_RUNNER',
                { originalError: error.message }
            );
        }
    }

    /**
     * Check if a file should be excluded from analysis
     * 
     * @param {string} filePath - Path to the file
     * @returns {boolean} True if file should be excluded
     * @private
     */
    _shouldExcludeFile(filePath) {
        try {
            // Check against exclude patterns
            for (const pattern of this.excludePatterns) {
                if (filePath.includes(pattern.replace(/\*/g, ''))) {
                    return true;
                }
            }

            // Check file extension
            const ext = path.extname(filePath);
            return !this.includeExtensions.includes(ext);
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityRuleRunner._shouldExcludeFile',
                filePath,
                message: 'Error checking file exclusion'
            });
            return true; // Exclude on error
        }
    }

    /**
     * Read and parse a file
     * 
     * @param {string} filePath - Path to the file
     * @returns {Promise<Object>} File content and metadata
     * @private
     */
    async _readFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            return {
                path: filePath,
                content,
                size: content.length,
                extension: path.extname(filePath)
            };
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityRuleRunner._readFile',
                filePath,
                message: 'Error reading file'
            });
            throw new SecurityRuleExecutionError(
                `Failed to read file ${filePath}: ${error.message}`,
                'RULE_RUNNER',
                { filePath, originalError: error.message }
            );
        }
    }

    /**
     * Extract functions from a file
     * 
     * @param {string} content - File content
     * @returns {Array<Object>} Extracted functions
     * @private
     */
    _extractFunctions(content) {
        try {
            const results = [];
            // Basic regex for function detection
            const functionRegex = /function\s+(\w+)\s*\([^)]*\)\s*{|const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g;
            let match;

            while ((match = functionRegex.exec(content)) !== null) {
                const functionName = match[1] || match[2];
                results.push({
                    name: functionName,
                    position: match.index,
                    declaration: match[0]
                });
            }

            return results;
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityRuleRunner._extractFunctions',
                message: 'Error extracting functions'
            });
            return [];
        }
    }

    /**
     * Run security rules against a single file
     * 
     * @param {string} filePath - Path to the file
     * @returns {Promise<Object>} Analysis results
     */
    async runAgainstFile(filePath) {
        try {
            this.log(`Analyzing file: ${filePath}`);

            if (this._shouldExcludeFile(filePath)) {
                this.log(`Skipping excluded file: ${filePath}`);
                return {
                    filePath,
                    skipped: true,
                    reason: 'Excluded by pattern or extension'
                };
            }

            const file = await this._readFile(filePath);
            const functions = this._extractFunctions(file.content);

            const results = {
                filePath,
                skipped: false,
                functions: functions.length,
                findings: [],
                ruleResults: {}
            };

            // Run each rule against the file
            for (const rule of this.rules) {
                try {
                    this.log(`Running rule ${rule.id} against ${filePath}`);

                    const ruleContext = {
                        file,
                        functions,
                        files: [file] // Compatibility with rules that expect files array
                    };

                    const ruleResult = rule.evaluate(ruleContext);
                    results.ruleResults[rule.id] = ruleResult;

                    if (ruleResult.triggered) {
                        // Add each finding with additional metadata
                        const findings = Array.isArray(ruleResult.findings) ?
                            ruleResult.findings :
                            [{
                                message: ruleResult.summary || `Rule ${rule.id} triggered`,
                                details: ruleResult.details
                            }];

                        for (const finding of findings) {
                            results.findings.push({
                                ruleId: rule.id,
                                ruleName: rule.name,
                                severity: rule.severity,
                                message: finding.message,
                                details: finding.details,
                                location: finding.location || ruleResult.location || null,
                                recommendation: rule.getRecommendation ?
                                    rule.getRecommendation(ruleContext) :
                                    `Review code for issues related to ${rule.name}`
                            });
                        }
                    }
                } catch (error) {
                    zkErrorLogger.logError(error, {
                        context: 'SecurityRuleRunner.runAgainstFile.ruleExecution',
                        filePath,
                        ruleId: rule.id,
                        message: 'Error executing security rule'
                    });

                    results.findings.push({
                        ruleId: rule.id,
                        ruleName: rule.name,
                        severity: 'ERROR',
                        message: `Error running rule: ${error.message}`,
                        details: { error: error.message },
                        recommendation: 'Fix the error in the security rule implementation'
                    });
                }
            }

            this.log(`Found ${results.findings.length} issues in ${filePath}`);
            return results;
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityRuleRunner.runAgainstFile',
                filePath,
                message: 'Error analyzing file'
            });

            return {
                filePath,
                error: error.message,
                skipped: false,
                findings: [{
                    severity: 'ERROR',
                    message: `Error analyzing file: ${error.message}`,
                    recommendation: 'Check if the file exists and can be read'
                }]
            };
        }
    }

    /**
     * Run security rules against all files in a directory
     * 
     * @param {string} dirPath - Path to the directory
     * @returns {Promise<Object>} Analysis results
     */
    async runAgainstDirectory(dirPath) {
        try {
            this.log(`Analyzing directory: ${dirPath}`);

            // Find all files recursively, excluding patterns
            const globPattern = path.join(dirPath, '**/*');
            const ignorePatterns = this.excludePatterns.map(pattern => {
                return pattern.startsWith('**/') ? pattern : `**/${pattern}`;
            });

            const files = await glob(globPattern, {
                ignore: ignorePatterns,
                nodir: true
            });

            // Filter files by extension
            const validFiles = files.filter(file => {
                const ext = path.extname(file);
                return this.includeExtensions.includes(ext);
            });

            this.log(`Found ${validFiles.length} files to analyze in ${dirPath}`);

            // Run analysis on each file
            const results = {
                dirPath,
                totalFiles: validFiles.length,
                analyzedFiles: 0,
                skippedFiles: 0,
                errorFiles: 0,
                totalFindings: 0,
                findingsBySeverity: {
                    CRITICAL: 0,
                    HIGH: 0,
                    MEDIUM: 0,
                    LOW: 0,
                    INFO: 0,
                    ERROR: 0
                },
                fileResults: []
            };

            for (const file of validFiles) {
                const fileResult = await this.runAgainstFile(file);
                results.fileResults.push(fileResult);

                if (fileResult.skipped) {
                    results.skippedFiles++;
                } else if (fileResult.error) {
                    results.errorFiles++;
                } else {
                    results.analyzedFiles++;
                    results.totalFindings += fileResult.findings.length;

                    // Count findings by severity
                    for (const finding of fileResult.findings) {
                        const severity = finding.severity || 'INFO';
                        results.findingsBySeverity[severity] =
                            (results.findingsBySeverity[severity] || 0) + 1;
                    }
                }
            }

            this.log(`Analysis complete for ${dirPath}`);
            this.log(`Analyzed ${results.analyzedFiles} files, found ${results.totalFindings} issues`);

            // Generate summary
            results.summary = this._generateSummary(results);

            // Save report if output directory is set
            if (this.outputDir) {
                await this._saveReport(results);
            }

            return results;
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityRuleRunner.runAgainstDirectory',
                dirPath,
                message: 'Error analyzing directory'
            });

            return {
                dirPath,
                error: error.message,
                summary: `Error analyzing directory: ${error.message}`
            };
        }
    }

    /**
     * Run security analysis on a target path (file or directory)
     * 
     * @param {string} targetPath - Path to analyze
     * @returns {Promise<Object>} Analysis results
     */
    async run(targetPath) {
        try {
            // Check if target exists
            const stats = await fs.stat(targetPath);

            if (stats.isDirectory()) {
                return this.runAgainstDirectory(targetPath);
            } else if (stats.isFile()) {
                const fileResult = await this.runAgainstFile(targetPath);

                // Format the results similar to directory results for consistency
                const results = {
                    targetPath,
                    targetType: 'file',
                    totalFiles: 1,
                    analyzedFiles: fileResult.skipped ? 0 : 1,
                    skippedFiles: fileResult.skipped ? 1 : 0,
                    errorFiles: fileResult.error ? 1 : 0,
                    totalFindings: fileResult.findings ? fileResult.findings.length : 0,
                    findingsBySeverity: {},
                    fileResults: [fileResult]
                };

                // Count findings by severity
                if (fileResult.findings) {
                    for (const finding of fileResult.findings) {
                        const severity = finding.severity || 'INFO';
                        results.findingsBySeverity[severity] =
                            (results.findingsBySeverity[severity] || 0) + 1;
                    }
                }

                // Generate summary
                results.summary = this._generateSummary(results);

                // Save report if output directory is set
                if (this.outputDir) {
                    await this._saveReport(results);
                }

                return results;
            } else {
                throw new Error(`Target is neither a file nor a directory: ${targetPath}`);
            }
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityRuleRunner.run',
                targetPath,
                message: 'Error executing security analysis'
            });

            return {
                targetPath,
                error: error.message,
                summary: `Error running security analysis: ${error.message}`
            };
        }
    }

    /**
     * Generate a summary of security analysis results
     * 
     * @param {Object} results - Analysis results
     * @returns {string} Summary text
     * @private
     */
    _generateSummary(results) {
        try {
            const { totalFiles, analyzedFiles, skippedFiles, errorFiles, totalFindings, findingsBySeverity } = results;

            let riskLevel = 'Low';
            if (findingsBySeverity.CRITICAL > 0) {
                riskLevel = 'Critical';
            } else if (findingsBySeverity.HIGH > 0) {
                riskLevel = 'High';
            } else if (findingsBySeverity.MEDIUM > 2) {
                riskLevel = 'Medium';
            }

            return (
                `Security analysis complete. Analyzed ${analyzedFiles} of ${totalFiles} files ` +
                `(${skippedFiles} skipped, ${errorFiles} errors). ` +
                `Found ${totalFindings} issues (${findingsBySeverity.CRITICAL || 0} critical, ` +
                `${findingsBySeverity.HIGH || 0} high, ${findingsBySeverity.MEDIUM || 0} medium, ` +
                `${findingsBySeverity.LOW || 0} low, ${findingsBySeverity.INFO || 0} info). ` +
                `Overall risk level: ${riskLevel}.`
            );
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityRuleRunner._generateSummary',
                message: 'Error generating summary'
            });
            return 'Error generating summary report';
        }
    }

    /**
     * Save analysis report to output directory
     * 
     * @param {Object} results - Analysis results
     * @returns {Promise<string>} Path to the saved report
     * @private
     */
    async _saveReport(results) {
        try {
            // Create output directory if it doesn't exist
            await fs.mkdir(this.outputDir, { recursive: true });

            // Generate filename based on target and timestamp
            const targetName = results.dirPath || results.targetPath || 'unknown';
            const sanitizedName = path.basename(targetName).replace(/[^a-z0-9]/gi, '-');
            const timestamp = new Date().toISOString().replace(/[:\.]/g, '-');
            const filename = `security-report-${sanitizedName}-${timestamp}.json`;
            const reportPath = path.join(this.outputDir, filename);

            // Save report as JSON
            await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
            this.log(`Report saved to: ${reportPath}`);

            return reportPath;
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityRuleRunner._saveReport',
                outputDir: this.outputDir,
                message: 'Error saving security report'
            });

            console.error(`Error saving report: ${error.message}`);
            return null;
        }
    }

    /**
     * Log a message if verbose mode is enabled
     * 
     * @param {string} message - Message to log
     * @private
     */
    log(message) {
        if (this.verbose) {
            console.log(`[SecurityRuleRunner] ${message}`);
        }
    }
}

export default SecurityRuleRunner; 