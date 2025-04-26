/**
 * @fileoverview SecurityAudit class
 * 
 * Performs security audits on zero-knowledge proof systems
 * using configurable security rules
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AuditConfig, RuleCategory } from './AuditConfig.js';
import { SecurityRuleFactory } from './rules/SecurityRuleFactory.js';
import zkErrorLogger from '../zkErrorLogger.js';

/**
 * SecurityAudit class for running security audits on ZK systems
 * @class
 */
export class SecurityAudit {
    /**
     * Create a new SecurityAudit instance
     * 
     * @param {Object} options - Configuration options
     * @param {string} options.name - Name of the audit
     * @param {string} options.targetSystem - Name of the system being audited
     * @param {string} options.outputDir - Directory to save audit results
     * @param {boolean} options.verbose - Whether to output verbose logs
     * @param {Array} options.rules - Custom rules to use for the audit
     * @param {Array} options.categories - Categories of rules to include
     */
    constructor(options = {}) {
        this.name = options.name || 'ZK Security Audit';
        this.targetSystem = options.targetSystem || 'Unnamed System';
        this.outputDir = options.outputDir || './audit-results';
        this.verbose = options.verbose || false;
        this.timestamp = new Date();
        this.findings = [];
        this.rules = options.rules || [];
        this.categories = options.categories || [
            RuleCategory.GENERAL,
            RuleCategory.CRYPTOGRAPHIC,
            RuleCategory.ZK_PROTOCOL
        ];

        // Create output directory if it doesn't exist
        try {
            if (!fs.existsSync(this.outputDir)) {
                fs.mkdirSync(this.outputDir, { recursive: true });
            }
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityAudit.constructor',
                outputDir: this.outputDir,
                message: 'Failed to create output directory'
            });
            throw error;
        }

        // Load default rules if no rules provided
        if (this.rules.length === 0) {
            this.loadDefaultRules();
        }

        this.log(`Created security audit "${this.name}" for target "${this.targetSystem}"`);
        this.log(`Loaded ${this.rules.length} security rules`);
    }

    /**
     * Load default security rules
     */
    loadDefaultRules() {
        try {
            this.categories.forEach(category => {
                const categoryRules = SecurityRuleFactory.createDefaultRules(category);
                this.rules.push(...categoryRules);
                this.log(`Loaded ${categoryRules.length} rules for category ${category}`);
            });
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityAudit.loadDefaultRules',
                categories: this.categories,
                message: 'Failed to load default security rules'
            });
            throw error;
        }
    }

    /**
     * Load rules from a configuration file
     * 
     * @param {string} configPath - Path to the configuration file
     */
    loadRulesFromConfig(configPath) {
        try {
            this.rules = SecurityRuleFactory.loadRulesFromConfig(configPath);
            this.log(`Loaded ${this.rules.length} rules from configuration`);
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityAudit.loadRulesFromConfig',
                configPath,
                message: 'Failed to load rules from configuration'
            });
            console.error(`Failed to load rules from ${configPath}: ${error.message}`);
        }
    }

    /**
     * Run the security audit against the provided context
     * 
     * @param {Object} context - The context to audit, containing system information
     * @returns {Object} - The audit results
     */
    runAudit(context) {
        this.log(`Starting security audit on ${this.targetSystem}`);
        this.findings = [];

        // Run each rule against the context
        this.rules.forEach(rule => {
            try {
                this.log(`Evaluating rule: ${rule.id} - ${rule.name}`);

                // Apply the rule to the context
                const result = rule.evaluate(context);

                if (result.triggered) {
                    this.findings.push({
                        ruleId: rule.id,
                        ruleName: rule.name,
                        ruleCategory: rule.category,
                        severity: rule.severity,
                        description: rule.description,
                        details: result.details,
                        recommendation: rule.getRecommendation(context),
                        references: rule.references,
                        location: result.location || 'Unknown',
                        timestamp: new Date()
                    });

                    this.log(`[FINDING] ${rule.id} - ${rule.name} (${rule.severity})`);
                }
            } catch (error) {
                zkErrorLogger.logError(error, {
                    context: 'SecurityAudit.runAudit',
                    ruleId: rule.id,
                    ruleName: rule.name,
                    message: 'Error evaluating security rule'
                });
                console.error(`Error running rule ${rule.id}: ${error.message}`);
            }
        });

        const result = this.generateAuditReport();
        this.saveAuditReport(result);
        return result;
    }

    /**
     * Generate an audit report from the findings
     * 
     * @returns {Object} - The audit report
     */
    generateAuditReport() {
        try {
            // Calculate statistics
            const statistics = {
                totalRules: this.rules.length,
                totalFindings: this.findings.length,
                findingsBySeverity: {
                    CRITICAL: this.findings.filter(f => f.severity === 'CRITICAL').length,
                    HIGH: this.findings.filter(f => f.severity === 'HIGH').length,
                    MEDIUM: this.findings.filter(f => f.severity === 'MEDIUM').length,
                    LOW: this.findings.filter(f => f.severity === 'LOW').length,
                    INFO: this.findings.filter(f => f.severity === 'INFO').length
                },
                findingsByCategory: {}
            };

            // Count findings by category
            this.categories.forEach(category => {
                statistics.findingsByCategory[category] = this.findings.filter(f => f.ruleCategory === category).length;
            });

            // Create the report
            return {
                auditName: this.name,
                targetSystem: this.targetSystem,
                timestamp: this.timestamp,
                statistics: statistics,
                findings: this.findings,
                summary: this.generateSummary(statistics)
            };
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityAudit.generateAuditReport',
                message: 'Error generating audit report'
            });
            throw error;
        }
    }

    /**
     * Generate a summary of the audit results
     * 
     * @param {Object} statistics - Audit statistics
     * @returns {string} - A summary of the audit results
     */
    generateSummary(statistics) {
        try {
            const totalCriticalAndHigh = statistics.findingsBySeverity.CRITICAL + statistics.findingsBySeverity.HIGH;
            let riskLevel = 'Low';

            if (statistics.findingsBySeverity.CRITICAL > 0) {
                riskLevel = 'Critical';
            } else if (statistics.findingsBySeverity.HIGH > 1) {
                riskLevel = 'High';
            } else if (statistics.findingsBySeverity.HIGH > 0 || statistics.findingsBySeverity.MEDIUM > 2) {
                riskLevel = 'Medium';
            }

            return `Security audit completed with ${statistics.totalFindings} findings. \
Overall risk level: ${riskLevel}. \
Found ${statistics.findingsBySeverity.CRITICAL} critical, \
${statistics.findingsBySeverity.HIGH} high, \
${statistics.findingsBySeverity.MEDIUM} medium, \
${statistics.findingsBySeverity.LOW} low, and \
${statistics.findingsBySeverity.INFO} informational issues.`;
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityAudit.generateSummary',
                message: 'Error generating audit summary'
            });
            return 'Error generating audit summary';
        }
    }

    /**
     * Save the audit report to a file
     * 
     * @param {Object} report - The audit report to save
     */
    saveAuditReport(report) {
        const timestamp = this.timestamp.toISOString().replace(/:/g, '-');
        const filename = path.join(this.outputDir, `audit-${this.targetSystem.replace(/\s+/g, '-')}-${timestamp}.json`);

        try {
            fs.writeFileSync(filename, JSON.stringify(report, null, 2));
            this.log(`Audit report saved to ${filename}`);
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'SecurityAudit.saveAuditReport',
                filename,
                message: 'Failed to save audit report'
            });
            console.error(`Failed to save audit report: ${error.message}`);
        }
    }

    /**
     * Log a message if verbose mode is enabled
     * 
     * @param {string} message - The message to log
     */
    log(message) {
        if (this.verbose) {
            console.log(`[SecurityAudit] ${message}`);
        }
    }
}

export default SecurityAudit; 