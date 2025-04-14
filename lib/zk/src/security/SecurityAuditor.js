/**
 * ZK Security Auditor
 * 
 * This module provides a comprehensive security audit system that automatically
 * scans ZK codebase for potential vulnerabilities.
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import logger from '../../scripts/common/logger.js';
import {
    errorHandler,
    FileSystemError,
    SecurityError,
    tryExecAsync
} from '../../scripts/common/error-handler.js';
import auditConfig, { SeverityLevel, RuleCategory } from './AuditConfig.js';

// Create module-specific logger
const securityLogger = logger.child('security-auditor');

// Promisify fs functions
const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

/**
 * Finding class represents a security issue found during audit
 */
export class Finding {
    /**
     * Create a new Finding
     * @param {Object} options - Finding details
     * @param {string} options.id - Unique identifier for the finding
     * @param {string} options.name - Name of the finding
     * @param {string} options.description - Description of the issue
     * @param {string} options.severity - Severity level from SeverityLevel
     * @param {string} options.category - Category from RuleCategory
     * @param {string} options.filePath - Path to the file with the issue
     * @param {number} options.line - Line number in the file
     * @param {string} options.code - Code snippet with the issue
     * @param {string} options.remediation - Suggested fix for the issue
     * @param {Object} options.metadata - Additional metadata about the finding
     */
    constructor({
        id,
        name,
        description,
        severity = SeverityLevel.MEDIUM,
        category,
        filePath = null,
        line = null,
        code = null,
        remediation = null,
        metadata = {}
    }) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.severity = severity;
        this.category = category;
        this.filePath = filePath;
        this.line = line;
        this.code = code;
        this.remediation = remediation;
        this.metadata = metadata;
        this.timestamp = new Date().toISOString();
    }

    /**
     * Get a location string for the finding
     * @returns {string} Location string (file:line)
     */
    getLocation() {
        if (!this.filePath) {
            return 'Unknown location';
        }
        return this.line ? `${this.filePath}:${this.line}` : this.filePath;
    }

    /**
     * Convert the finding to a string
     * @returns {string} String representation of the finding
     */
    toString() {
        const location = this.getLocation();
        return `[${this.severity.toUpperCase()}] ${this.name} at ${location}: ${this.description}`;
    }

    /**
     * Convert the finding to a JSON object
     * @returns {Object} JSON representation of the finding
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            severity: this.severity,
            category: this.category,
            filePath: this.filePath,
            line: this.line,
            code: this.code,
            remediation: this.remediation,
            metadata: this.metadata,
            timestamp: this.timestamp
        };
    }
}

/**
 * Security rule interface for all detectors
 */
export class SecurityRule {
    /**
     * Create a new security rule
     * @param {Object} options - Rule configuration
     * @param {string} options.id - Unique identifier for the rule
     * @param {string} options.name - Human-readable name
     * @param {string} options.description - Detailed description
     * @param {string} options.category - Rule category
     * @param {string} options.severity - Default severity level
     */
    constructor({
        id,
        name,
        description,
        category,
        severity = SeverityLevel.MEDIUM
    }) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.category = category;
        this.severity = severity;
    }

    /**
     * Check if a file matches this rule
     * @param {string} filePath - Path to the file
     * @param {string} content - Content of the file
     * @param {Object} context - Additional context for the check
     * @returns {Promise<Finding[]>} Array of findings (empty if no issues)
     */
    async check(filePath, content, context = {}) {
        // Override this method in derived classes
        throw new Error('check() method must be implemented by derived classes');
    }

    /**
     * Get a finding object for this rule
     * @param {Object} options - Finding details
     * @returns {Finding} Finding object
     */
    createFinding({
        filePath,
        line,
        code,
        description = this.description,
        remediation = null,
        metadata = {}
    }) {
        return new Finding({
            id: this.id,
            name: this.name,
            description,
            severity: this.severity,
            category: this.category,
            filePath,
            line,
            code,
            remediation,
            metadata
        });
    }
}

/**
 * Result of a security audit
 */
export class AuditResult {
    /**
     * Create a new audit result
     * @param {Object} options - Audit result options
     * @param {Finding[]} options.findings - Findings from the audit
     * @param {Object} options.metadata - Additional metadata about the audit
     * @param {Object} options.stats - Statistics about the audit
     */
    constructor({
        findings = [],
        metadata = {},
        stats = {}
    }) {
        this.findings = findings;
        this.metadata = metadata;
        this.stats = stats;
        this.timestamp = new Date().toISOString();
    }

    /**
     * Get findings filtered by severity
     * @param {string} severity - Severity level to filter by
     * @returns {Finding[]} Filtered findings
     */
    getBySeverity(severity) {
        return this.findings.filter(finding => finding.severity === severity);
    }

    /**
     * Get findings filtered by category
     * @param {string} category - Category to filter by
     * @returns {Finding[]} Filtered findings
     */
    getByCategory(category) {
        return this.findings.filter(finding => finding.category === category);
    }

    /**
     * Get findings filtered by file path
     * @param {string} filePath - File path to filter by
     * @returns {Finding[]} Filtered findings
     */
    getByFile(filePath) {
        return this.findings.filter(finding => finding.filePath === filePath);
    }

    /**
     * Get a summary of the audit results
     * @returns {Object} Summary object
     */
    getSummary() {
        const severityCounts = {};
        Object.values(SeverityLevel).forEach(severity => {
            severityCounts[severity] = this.getBySeverity(severity).length;
        });

        const categoryCounts = {};
        Object.values(RuleCategory).forEach(category => {
            categoryCounts[category] = this.getByCategory(category).length;
        });

        return {
            totalFindings: this.findings.length,
            severityCounts,
            categoryCounts,
            metadata: this.metadata,
            stats: this.stats,
            timestamp: this.timestamp
        };
    }

    /**
     * Convert the audit result to a JSON object
     * @returns {Object} JSON representation of the audit result
     */
    toJSON() {
        return {
            findings: this.findings.map(finding => finding.toJSON()),
            metadata: this.metadata,
            stats: this.stats,
            summary: this.getSummary(),
            timestamp: this.timestamp
        };
    }

    /**
     * Format the audit result as text
     * @returns {string} Text representation of the audit result
     */
    formatAsText() {
        const summary = this.getSummary();
        let result = `ZK Security Audit Results (${this.timestamp})\n\n`;

        result += `Total findings: ${summary.totalFindings}\n`;
        result += 'Severity breakdown:\n';
        Object.entries(summary.severityCounts).forEach(([severity, count]) => {
            result += `  - ${severity.toUpperCase()}: ${count}\n`;
        });

        result += '\nCategory breakdown:\n';
        Object.entries(summary.categoryCounts).forEach(([category, count]) => {
            result += `  - ${category}: ${count}\n`;
        });

        result += '\nFindings:\n';
        this.findings.forEach((finding, index) => {
            result += `\n${index + 1}. ${finding.toString()}\n`;
            if (finding.remediation) {
                result += `   Remediation: ${finding.remediation}\n`;
            }
        });

        return result;
    }

    /**
     * Format the audit result as HTML
     * @returns {string} HTML representation of the audit result
     */
    formatAsHTML() {
        const summary = this.getSummary();
        let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>ZK Security Audit Results</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { color: #333; }
                .summary { margin-bottom: 20px; }
                .findings { margin-top: 20px; }
                .finding { margin-bottom: 15px; border-left: 4px solid #ccc; padding-left: 15px; }
                .critical { border-left-color: #d9534f; }
                .high { border-left-color: #f0ad4e; }
                .medium { border-left-color: #5bc0de; }
                .low { border-left-color: #5cb85c; }
                .info { border-left-color: #777; }
                .location { color: #777; font-size: 0.9em; }
                .remediation { margin-top: 5px; font-style: italic; }
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
            </style>
        </head>
        <body>
            <h1>ZK Security Audit Results</h1>
            <div class="summary">
                <p>Timestamp: ${this.timestamp}</p>
                <p>Total findings: ${summary.totalFindings}</p>
                
                <h2>Severity Breakdown</h2>
                <table>
                    <tr>
                        <th>Severity</th>
                        <th>Count</th>
                    </tr>
        `;

        Object.entries(summary.severityCounts).forEach(([severity, count]) => {
            html += `
                    <tr>
                        <td>${severity.toUpperCase()}</td>
                        <td>${count}</td>
                    </tr>
            `;
        });

        html += `
                </table>
                
                <h2>Category Breakdown</h2>
                <table>
                    <tr>
                        <th>Category</th>
                        <th>Count</th>
                    </tr>
        `;

        Object.entries(summary.categoryCounts).forEach(([category, count]) => {
            html += `
                    <tr>
                        <td>${category}</td>
                        <td>${count}</td>
                    </tr>
            `;
        });

        html += `
                </table>
            </div>
            
            <div class="findings">
                <h2>Findings</h2>
        `;

        this.findings.forEach((finding, index) => {
            html += `
                <div class="finding ${finding.severity}">
                    <h3>${index + 1}. ${finding.name}</h3>
                    <p class="location">${finding.getLocation()}</p>
                    <p>${finding.description}</p>
                    ${finding.code ? `<pre>${finding.code}</pre>` : ''}
                    ${finding.remediation ? `<p class="remediation">Remediation: ${finding.remediation}</p>` : ''}
                </div>
            `;
        });

        html += `
            </div>
        </body>
        </html>
        `;

        return html;
    }
}

/**
 * Main SecurityAuditor class
 */
export class SecurityAuditor {
    /**
     * Create a new SecurityAuditor
     * @param {Object} options - Auditor options
     * @param {AuditConfig} options.config - Audit configuration
     */
    constructor(options = {}) {
        this.config = options.config || auditConfig;
        this.rules = [];
        this.detectors = {};
        this.logger = securityLogger;
    }

    /**
     * Register a security rule with the auditor
     * @param {SecurityRule} rule - Rule to register
     * @returns {SecurityAuditor} This instance for chaining
     */
    registerRule(rule) {
        this.rules.push(rule);
        return this;
    }

    /**
     * Register multiple security rules
     * @param {SecurityRule[]} rules - Rules to register
     * @returns {SecurityAuditor} This instance for chaining
     */
    registerRules(rules) {
        rules.forEach(rule => this.registerRule(rule));
        return this;
    }

    /**
     * Load built-in detectors
     * @returns {Promise<SecurityAuditor>} This instance for chaining
     */
    async loadBuiltInDetectors() {
        // This would dynamically load detector modules
        // For this implementation, we'll import them directly in the usage code
        return this;
    }

    /**
     * Register a detector by name
     * @param {string} name - Detector name
     * @param {Function} detectorClass - Detector class constructor
     * @returns {SecurityAuditor} This instance for chaining
     */
    registerDetector(name, detectorClass) {
        this.detectors[name] = detectorClass;
        return this;
    }

    /**
     * Scan a directory for security issues
     * @param {string} dirPath - Path to the directory to scan
     * @param {Object} options - Scan options
     * @returns {Promise<AuditResult>} Audit result
     */
    async scanDirectory(dirPath, options = {}) {
        this.logger.info(`Scanning directory: ${dirPath}`);

        const startTime = Date.now();
        const findings = [];
        const stats = {
            filesScanned: 0,
            directoriesScanned: 0,
            errors: 0,
            skipped: {
                files: 0,
                directories: 0
            }
        };

        // Apply default scan options
        const scanOptions = {
            depth: 0,
            maxDepth: this.config.get('maxScanDepth'),
            ...options
        };

        await this._scanDirectoryRecursive(dirPath, findings, stats, scanOptions);

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Add duration to stats
        stats.duration = duration;

        // Create audit result
        const auditResult = new AuditResult({
            findings,
            metadata: {
                scanPath: dirPath,
                scanOptions
            },
            stats
        });

        this.logger.info(`Scan completed in ${duration}ms. Found ${findings.length} issues.`);

        return auditResult;
    }

    /**
     * Scan a single file for security issues
     * @param {string} filePath - Path to the file to scan
     * @returns {Promise<AuditResult>} Audit result
     */
    async scanFile(filePath) {
        this.logger.info(`Scanning file: ${filePath}`);

        const startTime = Date.now();
        const findings = [];
        const stats = {
            filesScanned: 1,
            errors: 0
        };

        try {
            const content = await readFile(filePath, 'utf8');
            await this._analyzeFile(filePath, content, findings);
        } catch (error) {
            this.logger.error(`Error scanning file ${filePath}: ${error.message}`);
            stats.errors++;
        }

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Add duration to stats
        stats.duration = duration;

        // Create audit result
        const auditResult = new AuditResult({
            findings,
            metadata: {
                scanPath: filePath
            },
            stats
        });

        this.logger.info(`File scan completed in ${duration}ms. Found ${findings.length} issues.`);

        return auditResult;
    }

    /**
     * Save audit result to a file
     * @param {AuditResult} result - Audit result to save
     * @param {string} filePath - Path to save the result to
     * @returns {Promise<void>}
     */
    async saveResult(result, filePath) {
        try {
            // Determine output format based on file extension or config
            let outputFormat = this.config.get('outputFormat');
            if (filePath) {
                const ext = path.extname(filePath).toLowerCase();
                if (ext === '.json') outputFormat = 'json';
                else if (ext === '.html') outputFormat = 'html';
                else if (ext === '.txt') outputFormat = 'text';
            }

            // Format the result
            let formattedResult;
            if (outputFormat === 'json') {
                formattedResult = JSON.stringify(result.toJSON(), null, 2);
            } else if (outputFormat === 'html') {
                formattedResult = result.formatAsHTML();
            } else {
                formattedResult = result.formatAsText();
            }

            // Ensure directory exists
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Write the result
            fs.writeFileSync(filePath, formattedResult, 'utf8');
            this.logger.info(`Audit result saved to: ${filePath}`);
        } catch (error) {
            throw new FileSystemError(`Failed to save audit result: ${error.message}`, {
                cause: error,
                module: 'SecurityAuditor',
                operation: 'saveResult',
                context: { filePath }
            });
        }
    }

    /**
     * Recursively scan a directory for security issues
     * @private
     * @param {string} dirPath - Path to the directory
     * @param {Finding[]} findings - Array to collect findings
     * @param {Object} stats - Statistics object
     * @param {Object} options - Scan options
     * @returns {Promise<void>}
     */
    async _scanDirectoryRecursive(dirPath, findings, stats, options) {
        // Check scan depth
        if (options.depth > options.maxDepth) {
            this.logger.debug(`Max scan depth reached for: ${dirPath}`);
            stats.skipped.directories++;
            return;
        }

        // Check if directory should be excluded
        if (this.config.shouldExcludeDir(dirPath)) {
            this.logger.debug(`Skipping excluded directory: ${dirPath}`);
            stats.skipped.directories++;
            return;
        }

        try {
            stats.directoriesScanned++;

            // Read directory entries
            const entries = await readdir(dirPath, { withFileTypes: true });

            // Process each entry
            for (const entry of entries) {
                const entryPath = path.join(dirPath, entry.name);

                if (entry.isDirectory()) {
                    // Recursively scan subdirectory
                    await this._scanDirectoryRecursive(
                        entryPath,
                        findings,
                        stats,
                        { ...options, depth: options.depth + 1 }
                    );
                } else if (entry.isFile()) {
                    // Skip excluded files
                    if (this.config.shouldExcludeFile(entryPath)) {
                        this.logger.debug(`Skipping excluded file: ${entryPath}`);
                        stats.skipped.files++;
                        continue;
                    }

                    // Scan the file
                    try {
                        stats.filesScanned++;
                        const content = await readFile(entryPath, 'utf8');
                        await this._analyzeFile(entryPath, content, findings);
                    } catch (error) {
                        this.logger.error(`Error analyzing file ${entryPath}: ${error.message}`);
                        stats.errors++;
                    }
                }
            }
        } catch (error) {
            this.logger.error(`Error scanning directory ${dirPath}: ${error.message}`);
            stats.errors++;
        }
    }

    /**
     * Analyze a file for security issues
     * @private
     * @param {string} filePath - Path to the file
     * @param {string} content - Content of the file
     * @param {Finding[]} findings - Array to collect findings
     * @returns {Promise<void>}
     */
    async _analyzeFile(filePath, content, findings) {
        this.logger.debug(`Analyzing file: ${filePath}`);

        // Create context for rule checks
        const context = {
            filePath,
            fileName: path.basename(filePath),
            ext: path.extname(filePath).toLowerCase(),
            config: this.config
        };

        // Apply each rule
        for (const rule of this.rules) {
            // Check if the rule category is enabled
            if (!this.config.isCategoryEnabled(rule.category)) {
                continue;
            }

            try {
                const ruleFindings = await rule.check(filePath, content, context);

                // Filter findings by minimum severity
                const filteredFindings = ruleFindings.filter(finding =>
                    this.config.meetsMinimumSeverity(finding.severity)
                );

                // Add filtered findings
                if (filteredFindings.length > 0) {
                    findings.push(...filteredFindings);

                    // Log the findings
                    filteredFindings.forEach(finding => {
                        this.logger.info(`Found issue: ${finding.toString()}`);
                    });

                    // Check if we should stop on critical finding
                    if (this.config.get('stopOnCritical') &&
                        filteredFindings.some(f => f.severity === SeverityLevel.CRITICAL)) {
                        this.logger.warn(`Stopping scan due to critical finding in ${filePath}`);
                        break;
                    }
                }
            } catch (error) {
                this.logger.error(`Error applying rule ${rule.id} to ${filePath}: ${error.message}`);
            }
        }
    }
}

// Export a default instance
export default new SecurityAuditor(); 