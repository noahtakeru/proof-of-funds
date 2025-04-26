/**
 * @fileoverview Security Rule Runner for ZK code analysis
 * 
 * This module runs security rules against a codebase to identify potential
 * vulnerabilities in ZK implementations. It can analyze individual files
 * or entire directories recursively.
 * 
 * The SecurityRuleRunner is the execution engine of the security audit system,
 * responsible for:
 * 1. Loading and managing security rules
 * 2. Traversing the codebase to find relevant files
 * 3. Executing each rule against each applicable file
 * 4. Aggregating and formatting findings
 * 5. Generating comprehensive security reports
 * 
 * This component enables automated discovery of various security issues in
 * ZK proof systems, including cryptographic weaknesses, constraint issues,
 * key management problems, and protocol implementation flaws.
 * 
 * @author ZK Infrastructure Team
 * @created June 2024
 * @last-modified July 2024
 * 
 * @example
 * // Run against a single file
 * const runner = new SecurityRuleRunner();
 * const results = await runner.runAgainstFile('src/zkProofs/prover.js');
 * 
 * // Run against a directory
 * const dirResults = await runner.runAgainstDirectory('src/zkProofs');
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
 * 
 * The SecurityRuleRunner orchestrates the execution of security rules against
 * the ZK codebase, detecting potential vulnerabilities and generating detailed
 * reports. It handles file traversal, rule application, and result aggregation.
 * 
 * @class
 */
export class SecurityRuleRunner {
    /**
     * Create a new SecurityRuleRunner
     * 
     * Initializes a runner with the specified configuration options. If no rules
     * are provided, it will load default rules from the SecurityRulesRegistry.
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
     * 
     * Populates the rules array with default security rules from the registry.
     * These rules are designed to detect common security issues in ZK implementations.
     * 
     * Error handling: Logs and re-throws any error as a SecurityRuleExecutionError
     * to provide context about the failure.
     * 
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
     * Determines whether a file should be skipped based on the exclude patterns
     * and supported file extensions. This helps optimize performance by focusing
     * only on relevant files.
     * 
     * The exclusion logic applies two filters:
     * 1. Pattern matching against the excludePatterns array
     * 2. File extension validation against includeExtensions array
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
     * Reads a file from disk and returns its content along with metadata.
     * This is the core file access method used before rule application.
     * 
     * The returned object includes:
     * - path: The original file path
     * - content: The file's text content
     * - size: Content length in characters
     * - extension: File extension (e.g., .js, .ts)
     * 
     * Error handling: Logs and re-throws any error as a SecurityRuleExecutionError
     * with context about the failure.
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
     * Performs basic static analysis to identify function declarations in code.
     * This allows for more granular security analysis at the function level.
     * 
     * The function detection supports:
     * - Traditional function declarations: `function name() {}`
     * - Arrow function assignments: `const name = () => {}`
     * - Async variants of both patterns
     * 
     * Limitations:
     * - Uses regex-based detection which may miss complex patterns
     * - Does not detect class methods or object literal methods
     * - Cannot handle minified code effectively
     * 
     * Error handling: Logs any errors and returns an empty array rather than
     * failing the entire analysis process.
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
     * Analyzes a file using all configured security rules and returns
     * the findings. This is the primary file-level analysis method.
     * 
     * The analysis process:
     * 1. First checks if the file should be excluded
     * 2. Reads the file content
     * 3. Extracts functions for function-level analysis
     * 4. Applies each security rule to the file
     * 5. Aggregates findings from all rules
     * 
     * The returned results object contains:
     * - filePath: Path to the analyzed file
     * - skipped: Whether analysis was skipped
     * - functions: Number of functions detected
     * - findings: Array of all security findings
     * - ruleResults: Detailed results by rule ID
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
     * Recursively analyzes all matching files in a directory structure,
     * applying the configured security rules. This is the primary entry
     * point for running comprehensive security audits of the codebase.
     * 
     * The directory scanning process:
     * 1. Recursively finds all files in the directory tree
     * 2. Excludes files matching the exclude patterns
     * 3. Filters files by supported file extensions
     * 4. Runs security rules against each matching file
     * 5. Aggregates findings into a comprehensive report
     * 
     * The returned results object contains:
     * - dirPath: The scanned directory path
     * - totalFiles: Total number of files found
     * - analyzedFiles: Number of files successfully analyzed
     * - skippedFiles: Number of files skipped (excluded)
     * - errorFiles: Number of files with analysis errors
     * - totalFindings: Total security findings across all files
     * - findingsBySeverity: Findings grouped by severity level
     * - fileResults: Detailed findings for each analyzed file
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
     * This is the main entry point for security analysis, handling both
     * file and directory targets. It automatically detects the target type
     * and delegates to the appropriate specialized method.
     * 
     * This method provides a consistent interface for running security analysis
     * regardless of whether the target is a single file or a directory structure.
     * Results are formatted consistently to simplify integration with other systems.
     * 
     * Process steps:
     * 1. Determine if the target is a file or directory
     * 2. Delegate to the appropriate specialized method
     * 3. Format results into a consistent structure
     * 4. Generate a human-readable summary
     * 5. Save report to the output directory (if configured)
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
     * Creates a human-readable summary of the security analysis results,
     * including statistics on analyzed files and findings by severity.
     * Also calculates an overall risk level based on finding severity.
     * 
     * The risk level calculation uses the following logic:
     * - Critical: Any critical findings
     * - High: Any high findings (with no critical)
     * - Medium: More than 2 medium findings (with no critical/high)
     * - Low: All other cases
     * 
     * This simplifies understanding complex security analysis into
     * actionable insights and prioritization guidance.
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
     * Persists the security analysis results to the file system in JSON format.
     * This enables sharing, archiving, and comparing security analysis results
     * over time. The filename includes both the target path and a timestamp
     * to ensure uniqueness and traceability.
     * 
     * The report file contains:
     * - Complete analysis results including all findings
     * - Metadata about the analysis (timestamp, target)
     * - Statistics and summaries
     * - Detailed findings by file
     * 
     * This enables integration with other security tools and CI/CD pipelines,
     * as well as historical tracking of security issues over time.
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
     * Conditionally outputs messages to the console when the SecurityRuleRunner
     * is configured to run in verbose mode. All messages are prefixed with
     * '[SecurityRuleRunner]' for clear identification in console output.
     * 
     * This method centralizes logging logic to ensure consistent output formatting
     * and to simplify toggling verbosity without modifying code throughout the class.
     * It's particularly useful for debugging and detailed analysis tracking.
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

/**
 * Export the SecurityRuleRunner class as the default export
 * 
 * This module provides a comprehensive solution for running security rules
 * against a ZK implementation codebase. It supports analyzing individual files
 * and entire directories, generating detailed reports, and integrating with
 * existing security workflows.
 * 
 * Integration example:
 * ```js
 * import SecurityRuleRunner from './security/SecurityRuleRunner.js';
 * 
 * const runner = new SecurityRuleRunner({
 *   outputDir: './security-reports',
 *   verbose: true
 * });
 * 
 * async function runSecurityAnalysis() {
 *   const results = await runner.run('./src');
 *   console.log(results.summary);
 * }
 * ```
 */
export default SecurityRuleRunner; 