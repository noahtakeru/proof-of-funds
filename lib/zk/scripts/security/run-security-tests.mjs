#!/usr/bin/env node

/**
 * Security Test Runner Script
 * 
 * This script orchestrates all security tests for the Zero-Knowledge infrastructure,
 * including attack vector simulations, man-in-the-middle tests, and comprehensive
 * security audits. It generates formatted security reports and can be integrated
 * into CI/CD pipelines.
 */

import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import SecurityTestRunner from '../../tests/security/SecurityTestRunner.js';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default configuration
const DEFAULT_CONFIG = {
  outputDir: path.join(__dirname, '../../tests/security/reports'),
  verbose: false,
  saveResults: true,
  reportFormat: 'json',
  testFilters: {},
  attackVectorIterations: 10,
  mitmIterations: 10
};

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = { ...DEFAULT_CONFIG };
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--output-dir':
        options.outputDir = args[++i];
        break;
      case '--format':
        options.reportFormat = args[++i];
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--iterations':
        options.attackVectorIterations = parseInt(args[++i], 10);
        options.mitmIterations = parseInt(args[++i], 10);
        break;
      case '--no-save':
        options.saveResults = false;
        break;
      case '--exclude-attack-vectors':
        options.testFilters.excludeAttackVectors = true;
        break;
      case '--exclude-mitm':
        options.testFilters.excludeMITM = true;
        break;
      case '--help':
        printHelp();
        process.exit(0);
    }
  }
  
  return options;
}

/**
 * Print help information
 */
function printHelp() {
  console.log(`
Security Test Runner

Usage: run-security-tests.mjs [options]

Options:
  --output-dir <dir>       Directory to store reports (default: tests/security/reports)
  --format <format>        Report format: json, md, html (default: json)
  --verbose                Enable verbose logging
  --iterations <num>       Number of iterations per test (default: 10)
  --no-save                Don't save results to file
  --exclude-attack-vectors Skip attack vector tests
  --exclude-mitm           Skip man-in-the-middle tests
  --help                   Show this help message
  `);
}

/**
 * Ensure the report directory exists
 */
async function ensureReportDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    console.error(`Failed to create report directory: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Main function to run security tests
 */
async function main() {
  try {
    // Parse command line arguments
    const options = parseArgs();
    
    // Ensure report directory exists
    await ensureReportDir(options.outputDir);
    
    // Initialize test runner
    const runner = new SecurityTestRunner({
      outputDir: options.outputDir,
      verbose: options.verbose,
      saveResults: options.saveResults,
      reportFormat: options.reportFormat,
      testFilters: options.testFilters,
      attackVectorIterations: options.attackVectorIterations,
      mitmIterations: options.mitmIterations
    });
    
    // Log start of tests
    console.log(`Starting security tests at ${new Date().toISOString()}`);
    console.log(`Using configuration: ${JSON.stringify(options, null, 2)}`);
    
    // Run security tests
    const results = await runner.runAllTests();
    
    // Print summary
    const { summary } = results;
    
    console.log(`\nSecurity Test Summary:`);
    console.log(`- Security Score: ${summary.overallSecurityScore.toFixed(2)}/100 (Grade: ${summary.securityRating})`);
    console.log(`- Overall Detection Rate: ${summary.totalDetectionRate.toFixed(2)}%`);
    console.log(`- Test Categories: ${summary.testCategories.join(', ')}`);
    console.log(`- Total Tests: ${summary.totalTests}`);
    
    // Print vulnerability summary
    console.log('\nVulnerabilities:');
    console.log(`- Critical: ${summary.vulnerabilities.critical}`);
    console.log(`- High: ${summary.vulnerabilities.high}`);
    console.log(`- Medium: ${summary.vulnerabilities.medium}`);
    console.log(`- Low: ${summary.vulnerabilities.low}`);
    
    // Print highest risk vector if available
    if (results.summary.highestRiskVector) {
      console.log(`\nHighest Risk: ${results.summary.highestRiskVector} (${results.summary.lowestDetectionRate.toFixed(2)}% detection rate)`);
    }
    
    // Print recommendations
    if (results.recommendations && results.recommendations.length > 0) {
      console.log('\nTop Security Recommendations:');
      
      // Sort by severity and show top 3
      const sortedRecs = [...results.recommendations]
        .sort((a, b) => {
          const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          return severityOrder[a.severity] - severityOrder[b.severity];
        })
        .slice(0, 3);
      
      sortedRecs.forEach((rec, i) => {
        console.log(`${i + 1}. [${rec.severity.toUpperCase()}] ${rec.category}: ${rec.recommendation}`);
      });
      
      if (results.recommendations.length > 3) {
        console.log(`... and ${results.recommendations.length - 3} more recommendations (see report for details)`);
      }
    }
    
    // Exit with code based on security score
    const exitCode = summary.overallSecurityScore < 70 ? 1 : 0;
    if (exitCode === 1) {
      console.log('\nSecurity score below threshold (70). Please address the critical issues.');
    } else {
      console.log('\nSecurity tests completed successfully.');
    }
    
    process.exit(exitCode);
    
  } catch (error) {
    console.error(`Error running security tests: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the main function
main();