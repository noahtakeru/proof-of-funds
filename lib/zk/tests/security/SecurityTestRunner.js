/**
 * SecurityTestRunner.js - Main runner for security test framework
 * 
 * Orchestrates the execution of various security tests including attack vector
 * simulations, man-in-the-middle tests, and fuzzing tests. Collects and
 * reports comprehensive security metrics.
 */

import fs from 'fs';
import path from 'path';
import AttackVectors from './AttackVectors.js';
import ManInTheMiddleTest from './ManInTheMiddleTest.js';
import zkErrorLogger from '../../src/zkErrorLogger.js';

export class SecurityTestRunner {
    /**
     * Create a security test runner
     * @param {Object} config - Configuration options
     * @param {string} [config.outputDir='./security-results'] - Output directory for results
     * @param {boolean} [config.verbose=false] - Enable verbose logging
     * @param {boolean} [config.saveResults=true] - Save results to file
     * @param {string} [config.reportFormat='json'] - Report format (json, md, html)
     * @param {Object} [config.testFilters={}] - Filters to include/exclude tests
     */
    constructor(config = {}) {
        this.config = {
            outputDir: './security-results',
            verbose: false,
            saveResults: true,
            reportFormat: 'json',
            testFilters: {},
            ...config
        };
        
        this.outputDir = this.config.outputDir;
        this.verbose = this.config.verbose;
        
        // Ensure output directory exists
        if (this.config.saveResults) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
        
        // Test components
        this.attackVectors = new AttackVectors({
            outputDir: path.join(this.outputDir, 'attack-vectors'),
            verbose: this.verbose,
            saveResults: this.config.saveResults,
            iterations: this.config.attackVectorIterations || 10
        });
        
        this.mitm = new ManInTheMiddleTest({
            outputDir: path.join(this.outputDir, 'mitm'),
            verbose: this.verbose,
            saveResults: this.config.saveResults,
            iterations: this.config.mitmIterations || 10
        });
        
        // Track test results
        this.results = {
            timestamp: new Date().toISOString(),
            summary: {},
            attackVectors: {},
            mitm: {},
            recommendations: []
        };
        
        this.log('Security test runner initialized');
    }
    
    /**
     * Run all security tests
     * @param {Object} [options] - Test options
     * @returns {Promise<Object>} Test results
     */
    async runAllTests(options = {}) {
        this.log(`Starting security test suite run at ${new Date().toISOString()}`);
        
        try {
            // Run attack vector tests if not excluded
            if (!this.config.testFilters.excludeAttackVectors) {
                this.log('Running attack vector tests...');
                this.results.attackVectors = await this.attackVectors.runAllVectors();
                this.log('Attack vector tests completed');
            }
            
            // Run MITM tests if not excluded
            if (!this.config.testFilters.excludeMITM) {
                this.log('Running man-in-the-middle tests...');
                this.results.mitm = await this.mitm.runAllTests();
                this.log('Man-in-the-middle tests completed');
            }
            
            // Generate overall summary
            this.results.summary = this.generateOverallSummary();
            
            // Generate security recommendations
            this.results.recommendations = this.generateRecommendations();
            
            // Save results if configured
            if (this.config.saveResults) {
                this.saveResults();
            }
            
            return this.results;
        } catch (error) {
            this.log(`Error during security tests: ${error.message}`, 'error');
            
            // Log the error with the ZK error logger
            zkErrorLogger.zkErrorLogger.logError(error);
            
            throw error;
        }
    }
    
    /**
     * Generate overall security test summary
     * @returns {Object} Overall summary
     */
    generateOverallSummary() {
        const summary = {
            runDate: new Date().toISOString(),
            overallSecurityScore: 0,
            totalDetectionRate: 0,
            testCategories: [],
            vulnerabilities: {
                critical: 0,
                high: 0,
                medium: 0,
                low: 0
            }
        };
        
        // Add attack vector statistics if available
        if (this.results.attackVectors && this.results.attackVectors.summary) {
            summary.testCategories.push('Attack Vectors');
            const avSummary = this.results.attackVectors.summary;
            
            // Get overall detection rate from attack vectors
            summary.totalDetectionRate += avSummary.overallDetectionRate;
            
            // Calculate vulnerabilities based on detection rates
            if (avSummary.lowestDetectionRate < 50) {
                summary.vulnerabilities.critical++;
            } else if (avSummary.lowestDetectionRate < 75) {
                summary.vulnerabilities.high++;
            } else if (avSummary.lowestDetectionRate < 90) {
                summary.vulnerabilities.medium++;
            } else if (avSummary.lowestDetectionRate < 100) {
                summary.vulnerabilities.low++;
            }
        }
        
        // Add MITM statistics if available
        if (this.results.mitm && this.results.mitm.summary) {
            summary.testCategories.push('Man-in-the-Middle');
            const mitmSummary = this.results.mitm.summary;
            
            // Get detection rate from MITM tests
            summary.totalDetectionRate += mitmSummary.overallDetectionRate;
            
            // Calculate vulnerabilities based on detection rates
            if (mitmSummary.lowestDetectionRate < 50) {
                summary.vulnerabilities.critical++;
            } else if (mitmSummary.lowestDetectionRate < 75) {
                summary.vulnerabilities.high++;
            } else if (mitmSummary.lowestDetectionRate < 90) {
                summary.vulnerabilities.medium++;
            } else if (mitmSummary.lowestDetectionRate < 100) {
                summary.vulnerabilities.low++;
            }
        }
        
        // Calculate overall detection rate average
        if (summary.testCategories.length > 0) {
            summary.totalDetectionRate /= summary.testCategories.length;
        }
        
        // Calculate security score (0-100) based on detection rate and vulnerabilities
        summary.overallSecurityScore = Math.max(0, Math.min(100, 
            summary.totalDetectionRate - 
            (summary.vulnerabilities.critical * 25) - 
            (summary.vulnerabilities.high * 15) - 
            (summary.vulnerabilities.medium * 7) - 
            (summary.vulnerabilities.low * 2)
        ));
        
        // Add security rating based on score
        if (summary.overallSecurityScore >= 90) {
            summary.securityRating = 'A';
        } else if (summary.overallSecurityScore >= 80) {
            summary.securityRating = 'B';
        } else if (summary.overallSecurityScore >= 70) {
            summary.securityRating = 'C';
        } else if (summary.overallSecurityScore >= 60) {
            summary.securityRating = 'D';
        } else {
            summary.securityRating = 'F';
        }
        
        return summary;
    }
    
    /**
     * Generate security recommendations based on test results
     * @returns {Array<Object>} List of recommendations
     */
    generateRecommendations() {
        const recommendations = [];
        
        // Add recommendations based on attack vector results
        if (this.results.attackVectors) {
            // Check for replay attack deficiencies
            if (this.results.attackVectors.replay && 
                this.results.attackVectors.replay.detectionRate < 95) {
                recommendations.push({
                    severity: 'high',
                    category: 'Replay Attacks',
                    issue: 'Insufficient protection against replay attacks',
                    recommendation: 'Implement strict nonce validation and proof expiration to prevent proof reuse',
                    detectionRate: this.results.attackVectors.replay.detectionRate
                });
            }
            
            // Check for nullifier reuse issues
            if (this.results.attackVectors.nullifier && 
                this.results.attackVectors.nullifier.detectionRate < 97) {
                recommendations.push({
                    severity: 'critical',
                    category: 'Nullifier Reuse',
                    issue: 'Weakness in nullifier uniqueness enforcement',
                    recommendation: 'Strengthen nullifier validation and implement a more robust storage mechanism',
                    detectionRate: this.results.attackVectors.nullifier.detectionRate
                });
            }
            
            // Check for malformed proof issues
            if (this.results.attackVectors.malformed && 
                this.results.attackVectors.malformed.detectionRate < 90) {
                recommendations.push({
                    severity: 'medium',
                    category: 'Malformed Proofs',
                    issue: 'Insufficient validation of proof structure',
                    recommendation: 'Implement comprehensive proof structure validation before verification',
                    detectionRate: this.results.attackVectors.malformed.detectionRate
                });
            }
            
            // Check for proof forgery issues
            if (this.results.attackVectors.forgery && 
                this.results.attackVectors.forgery.detectionRate < 88) {
                recommendations.push({
                    severity: 'high',
                    category: 'Proof Forgery',
                    issue: 'Vulnerability to proof forgery attempts',
                    recommendation: 'Strengthen cryptographic verification and implement multi-layer validation',
                    detectionRate: this.results.attackVectors.forgery.detectionRate
                });
            }
        }
        
        // Add recommendations based on MITM results
        if (this.results.mitm) {
            // Check for passive interception vulnerabilities
            if (this.results.mitm.passiveInterception && 
                this.results.mitm.passiveInterception.detectionRate < 90) {
                recommendations.push({
                    severity: 'high',
                    category: 'Passive Interception',
                    issue: 'Communications vulnerable to passive monitoring',
                    recommendation: 'Implement end-to-end encryption for all proof transmissions',
                    detectionRate: this.results.mitm.passiveInterception.detectionRate
                });
            }
            
            // Check for active tampering vulnerabilities
            if (this.results.mitm.activeTampering && 
                this.results.mitm.activeTampering.detectionRate < 95) {
                recommendations.push({
                    severity: 'critical',
                    category: 'Active Tampering',
                    issue: 'Proof integrity vulnerable to tampering',
                    recommendation: 'Implement cryptographic signatures and checksums for all transmitted proofs',
                    detectionRate: this.results.mitm.activeTampering.detectionRate
                });
            }
        }
        
        // Add general recommendations if security score is below threshold
        if (this.results.summary.overallSecurityScore < 80) {
            recommendations.push({
                severity: 'high',
                category: 'General Security',
                issue: 'Overall security posture needs improvement',
                recommendation: 'Conduct comprehensive security review and implement defense-in-depth strategies',
                detectionRate: this.results.summary.totalDetectionRate
            });
        }
        
        return recommendations;
    }
    
    /**
     * Save test results to file
     * @param {string} [filename] - Custom filename
     * @returns {string} Path to saved file
     */
    saveResults(filename) {
        // Generate default filename if not provided
        if (!filename) {
            const timestamp = new Date().toISOString().replace(/:/g, '-');
            filename = `security-test-results-${timestamp}.${this.config.reportFormat}`;
        }
        
        const filePath = path.join(this.outputDir, filename);
        
        // Generate appropriate format
        let content;
        if (this.config.reportFormat === 'md') {
            content = this.generateMarkdownReport();
        } else if (this.config.reportFormat === 'html') {
            content = this.generateHtmlReport();
        } else {
            // Default to JSON
            content = JSON.stringify(this.results, null, 2);
        }
        
        // Write to file
        fs.writeFileSync(filePath, content);
        this.log(`Test results saved to ${filePath}`);
        
        return filePath;
    }
    
    /**
     * Generate markdown report
     * @returns {string} Markdown report
     */
    generateMarkdownReport() {
        const { summary, recommendations } = this.results;
        
        let report = `# Security Test Report\n\n`;
        report += `**Generated:** ${new Date().toISOString()}\n\n`;
        
        report += `## Summary\n\n`;
        report += `- **Security Score:** ${summary.overallSecurityScore.toFixed(2)}/100 (Grade: ${summary.securityRating})\n`;
        report += `- **Overall Detection Rate:** ${summary.totalDetectionRate.toFixed(2)}%\n`;
        report += `- **Test Categories:** ${summary.testCategories.join(', ')}\n\n`;
        
        report += `### Vulnerabilities\n\n`;
        report += `| Severity | Count |\n`;
        report += `|----------|-------|\n`;
        report += `| Critical | ${summary.vulnerabilities.critical} |\n`;
        report += `| High     | ${summary.vulnerabilities.high} |\n`;
        report += `| Medium   | ${summary.vulnerabilities.medium} |\n`;
        report += `| Low      | ${summary.vulnerabilities.low} |\n\n`;
        
        // Add recommendations
        if (recommendations.length > 0) {
            report += `## Security Recommendations\n\n`;
            
            // Sort by severity
            const sortedRecs = [...recommendations].sort((a, b) => {
                const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
                return severityOrder[a.severity] - severityOrder[b.severity];
            });
            
            for (const rec of sortedRecs) {
                report += `### ${rec.category} (${rec.severity.toUpperCase()})\n\n`;
                report += `**Issue:** ${rec.issue}\n\n`;
                report += `**Recommendation:** ${rec.recommendation}\n\n`;
                report += `**Detection Rate:** ${rec.detectionRate.toFixed(2)}%\n\n`;
                report += `---\n\n`;
            }
        }
        
        // Add attack vector details
        if (this.results.attackVectors && this.results.attackVectors.summary) {
            report += `## Attack Vector Tests\n\n`;
            report += `- **Overall Detection Rate:** ${this.results.attackVectors.summary.overallDetectionRate.toFixed(2)}%\n`;
            report += `- **Total Tests:** ${this.results.attackVectors.summary.totalTests}\n`;
            report += `- **Highest Risk:** ${this.results.attackVectors.summary.highestRiskVector?.attackType || 'N/A'} (${this.results.attackVectors.summary.lowestDetectionRate.toFixed(2)}%)\n\n`;
            
            // Add individual attack type results
            for (const [attackType, results] of Object.entries(this.results.attackVectors)) {
                if (attackType === 'summary') continue;
                
                report += `### ${attackType} Attacks\n\n`;
                report += `- **Detection Rate:** ${results.detectionRate.toFixed(2)}%\n`;
                report += `- **Successful Detections:** ${results.detected}/${results.iterations}\n\n`;
            }
        }
        
        // Add MITM details
        if (this.results.mitm && this.results.mitm.summary) {
            report += `## Man-in-the-Middle Tests\n\n`;
            report += `- **Overall Detection Rate:** ${this.results.mitm.summary.overallDetectionRate.toFixed(2)}%\n`;
            report += `- **Total Tests:** ${this.results.mitm.summary.totalTests}\n\n`;
            
            // Add individual MITM results
            for (const [testType, results] of Object.entries(this.results.mitm)) {
                if (testType === 'summary') continue;
                
                report += `### ${testType} Tests\n\n`;
                report += `- **Detection Rate:** ${results.detectionRate.toFixed(2)}%\n`;
                report += `- **Successful Detections:** ${results.detected}/${results.total}\n\n`;
            }
        }
        
        return report;
    }
    
    /**
     * Generate HTML report
     * @returns {string} HTML report
     */
    generateHtmlReport() {
        const { summary, recommendations } = this.results;
        
        let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 1100px; margin: 0 auto; padding: 20px; }
        h1, h2, h3 { color: #333; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
        th, td { text-align: left; padding: 12px; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
        .critical { background-color: #ffdddd; }
        .high { background-color: #ffffcc; }
        .medium { background-color: #e6f3ff; }
        .low { background-color: #eeffee; }
        .score { font-size: 24px; font-weight: bold; }
        .score-container { display: flex; align-items: center; }
        .score-box { width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; 
                     font-size: 48px; font-weight: bold; margin-right: 20px; border-radius: 8px; }
        .score-A { background-color: #4CAF50; color: white; }
        .score-B { background-color: #8BC34A; color: white; }
        .score-C { background-color: #FFC107; color: black; }
        .score-D { background-color: #FF9800; color: white; }
        .score-F { background-color: #F44336; color: white; }
        .recommendation { padding: 15px; margin-bottom: 15px; border-radius: 4px; }
    </style>
</head>
<body>
    <h1>Security Test Report</h1>
    <p><strong>Generated:</strong> ${new Date().toISOString()}</p>
    
    <h2>Summary</h2>
    <div class="score-container">
        <div class="score-box score-${summary.securityRating}">${summary.securityRating}</div>
        <div>
            <div class="score">${summary.overallSecurityScore.toFixed(2)}/100</div>
            <div>Overall Detection Rate: ${summary.totalDetectionRate.toFixed(2)}%</div>
        </div>
    </div>
    
    <p><strong>Test Categories:</strong> ${summary.testCategories.join(', ')}</p>
    
    <h3>Vulnerabilities</h3>
    <table>
        <tr>
            <th>Severity</th>
            <th>Count</th>
        </tr>
        <tr class="critical">
            <td>Critical</td>
            <td>${summary.vulnerabilities.critical}</td>
        </tr>
        <tr class="high">
            <td>High</td>
            <td>${summary.vulnerabilities.high}</td>
        </tr>
        <tr class="medium">
            <td>Medium</td>
            <td>${summary.vulnerabilities.medium}</td>
        </tr>
        <tr class="low">
            <td>Low</td>
            <td>${summary.vulnerabilities.low}</td>
        </tr>
    </table>`;
        
        // Add recommendations
        if (recommendations.length > 0) {
            html += `<h2>Security Recommendations</h2>`;
            
            // Sort by severity
            const sortedRecs = [...recommendations].sort((a, b) => {
                const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
                return severityOrder[a.severity] - severityOrder[b.severity];
            });
            
            for (const rec of sortedRecs) {
                html += `
    <div class="recommendation ${rec.severity}">
        <h3>${rec.category} (${rec.severity.toUpperCase()})</h3>
        <p><strong>Issue:</strong> ${rec.issue}</p>
        <p><strong>Recommendation:</strong> ${rec.recommendation}</p>
        <p><strong>Detection Rate:</strong> ${rec.detectionRate.toFixed(2)}%</p>
    </div>`;
            }
        }
        
        // Add attack vector details
        if (this.results.attackVectors && this.results.attackVectors.summary) {
            html += `
    <h2>Attack Vector Tests</h2>
    <p><strong>Overall Detection Rate:</strong> ${this.results.attackVectors.summary.overallDetectionRate.toFixed(2)}%</p>
    <p><strong>Total Tests:</strong> ${this.results.attackVectors.summary.totalTests}</p>
    <p><strong>Highest Risk:</strong> ${this.results.attackVectors.summary.highestRiskVector?.attackType || 'N/A'} (${this.results.attackVectors.summary.lowestDetectionRate.toFixed(2)}%)</p>
    
    <table>
        <tr>
            <th>Attack Type</th>
            <th>Detection Rate</th>
            <th>Detections</th>
        </tr>`;
            
            // Add individual attack type results
            for (const [attackType, results] of Object.entries(this.results.attackVectors)) {
                if (attackType === 'summary') continue;
                
                let rowClass = '';
                if (results.detectionRate < 50) rowClass = 'critical';
                else if (results.detectionRate < 75) rowClass = 'high';
                else if (results.detectionRate < 90) rowClass = 'medium';
                else if (results.detectionRate < 100) rowClass = 'low';
                
                html += `
        <tr class="${rowClass}">
            <td>${attackType}</td>
            <td>${results.detectionRate.toFixed(2)}%</td>
            <td>${results.detected}/${results.iterations}</td>
        </tr>`;
            }
            
            html += `
    </table>`;
        }
        
        // Add MITM details
        if (this.results.mitm && this.results.mitm.summary) {
            html += `
    <h2>Man-in-the-Middle Tests</h2>
    <p><strong>Overall Detection Rate:</strong> ${this.results.mitm.summary.overallDetectionRate.toFixed(2)}%</p>
    <p><strong>Total Tests:</strong> ${this.results.mitm.summary.totalTests}</p>
    
    <table>
        <tr>
            <th>Test Type</th>
            <th>Detection Rate</th>
            <th>Detections</th>
        </tr>`;
            
            // Add individual MITM results
            for (const [testType, results] of Object.entries(this.results.mitm)) {
                if (testType === 'summary') continue;
                
                let rowClass = '';
                if (results.detectionRate < 50) rowClass = 'critical';
                else if (results.detectionRate < 75) rowClass = 'high';
                else if (results.detectionRate < 90) rowClass = 'medium';
                else if (results.detectionRate < 100) rowClass = 'low';
                
                html += `
        <tr class="${rowClass}">
            <td>${testType}</td>
            <td>${results.detectionRate.toFixed(2)}%</td>
            <td>${results.detected}/${results.total}</td>
        </tr>`;
            }
            
            html += `
    </table>`;
        }
        
        html += `
</body>
</html>`;
        
        return html;
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
}

export default SecurityTestRunner;