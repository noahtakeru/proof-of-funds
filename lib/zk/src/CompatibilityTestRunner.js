/**
 * Browser Compatibility Test Runner
 * 
 * This module provides functionality to execute browser compatibility tests
 * and collect results according to the test matrix.
 */

import { 
  FEATURES_TO_TEST,
  TEST_STATUS,
  generateTestId
} from './browser-compatibility-matrix';

/**
 * Class for running browser compatibility tests
 */
class CompatibilityTestRunner {
  /**
   * Create a new CompatibilityTestRunner instance
   * 
   * @param {Object} options - Configuration options
   * @param {Object} [options.testImplementations] - Map of test function implementations
   * @param {Function} [options.onTestComplete] - Callback when each test completes
   * @param {Function} [options.onSuiteComplete] - Callback when all tests complete
   */
  constructor(options = {}) {
    this.testImplementations = options.testImplementations || {};
    this.onTestComplete = options.onTestComplete || (() => {});
    this.onSuiteComplete = options.onSuiteComplete || (() => {});
    this.results = {};
    this.isRunning = false;
    this.startTime = null;
    this.endTime = null;
    this.currentBrowser = this._detectBrowser();
    this.currentPlatform = this._detectPlatform();
  }
  
  /**
   * Detect current browser information
   * 
   * @returns {Object} Browser information
   * @private
   */
  _detectBrowser() {
    const ua = navigator.userAgent;
    let browserName = 'unknown';
    let browserVersion = 'unknown';
    
    // Detect Chrome
    if (/Chrome/.test(ua) && !/Chromium|Edge|OPR|Brave/.test(ua)) {
      browserName = 'chrome';
      browserVersion = ua.match(/Chrome\/(\d+)/)?.[1] || 'unknown';
    }
    // Detect Firefox
    else if (/Firefox/.test(ua)) {
      browserName = 'firefox';
      browserVersion = ua.match(/Firefox\/(\d+)/)?.[1] || 'unknown';
    }
    // Detect Safari
    else if (/Safari/.test(ua) && !/Chrome|Chromium|Edge|OPR|Brave/.test(ua)) {
      browserName = 'safari';
      browserVersion = ua.match(/Version\/(\d+)/)?.[1] || 'unknown';
    }
    // Detect Edge
    else if (/Edg/.test(ua)) {
      browserName = 'edge';
      browserVersion = ua.match(/Edg\/(\d+)/)?.[1] || 'unknown';
    }
    // Detect Opera
    else if (/OPR/.test(ua)) {
      browserName = 'opera';
      browserVersion = ua.match(/OPR\/(\d+)/)?.[1] || 'unknown';
    }
    // Detect Brave (difficult to detect reliably)
    else if (/Brave/.test(ua)) {
      browserName = 'brave';
      browserVersion = 'latest';
    }
    // Detect Samsung Internet
    else if (/SamsungBrowser/.test(ua)) {
      browserName = 'samsung';
      browserVersion = ua.match(/SamsungBrowser\/(\d+)/)?.[1] || 'unknown';
    }
    
    return {
      name: browserName,
      version: browserVersion,
      userAgent: ua
    };
  }
  
  /**
   * Detect current platform information
   * 
   * @returns {Object} Platform information
   * @private
   */
  _detectPlatform() {
    const ua = navigator.userAgent;
    let platform = 'unknown';
    
    // Detect macOS
    if (/Macintosh/.test(ua)) {
      platform = 'macOS';
    }
    // Detect Windows
    else if (/Windows/.test(ua)) {
      platform = 'Windows';
    }
    // Detect Linux
    else if (/Linux/.test(ua) && !/Android/.test(ua)) {
      platform = 'Linux';
    }
    // Detect Android
    else if (/Android/.test(ua)) {
      platform = 'Android';
    }
    // Detect iOS
    else if (/iPhone|iPad|iPod/.test(ua)) {
      platform = 'iOS';
    }
    
    return {
      name: platform,
      isMobile: /iPhone|iPad|iPod|Android/.test(ua),
      isDesktop: /Windows|Macintosh|Linux/.test(ua) && !/Android/.test(ua),
      memory: navigator.deviceMemory || 'unknown', // Device Memory API (Chrome only)
      cpuCores: navigator.hardwareConcurrency || 'unknown'
    };
  }
  
  /**
   * Register test implementation functions
   * 
   * @param {Object} implementations - Map of test function implementations
   */
  registerTestImplementations(implementations) {
    this.testImplementations = {
      ...this.testImplementations,
      ...implementations
    };
  }
  
  /**
   * Run feature tests for current browser/platform
   * 
   * @param {Array<string>} [categoryFilter] - Optional filter for feature categories
   * @returns {Promise<Object>} Test results
   */
  async runTests(categoryFilter) {
    if (this.isRunning) {
      throw new Error('Tests are already running');
    }
    
    this.isRunning = true;
    this.startTime = Date.now();
    
    try {
      const categories = categoryFilter || Object.keys(FEATURES_TO_TEST);
      
      // Run tests for each category
      for (const category of categories) {
        const features = FEATURES_TO_TEST[category];
        if (!features) continue;
        
        // Run tests for each feature in category
        for (const feature of features) {
          await this._runFeatureTest(category, feature);
        }
      }
      
      this.endTime = Date.now();
      this.isRunning = false;
      
      // Generate summary
      const summary = this._generateSummary();
      
      // Call completion callback
      this.onSuiteComplete(summary);
      
      return summary;
    } catch (error) {
      this.isRunning = false;
      console.error('Error running compatibility tests:', error);
      throw error;
    }
  }
  
  /**
   * Run test for a specific feature
   * 
   * @param {string} category - Feature category
   * @param {Object} feature - Feature to test
   * @private
   */
  async _runFeatureTest(category, feature) {
    const testId = generateTestId(
      this.currentBrowser.name,
      this.currentBrowser.version,
      this.currentPlatform.name,
      feature.name.replace(/\s+/g, '_')
    );
    
    // Default result is untested
    let result = {
      feature: feature.name,
      category,
      browser: this.currentBrowser.name,
      browserVersion: this.currentBrowser.version,
      platform: this.currentPlatform.name,
      status: TEST_STATUS.UNTESTED,
      message: 'Test not implemented',
      timestamp: Date.now()
    };
    
    try {
      // Get test implementation
      const testFn = this.testImplementations[feature.testFunction];
      
      if (typeof testFn === 'function') {
        // Execute the test
        const testResult = await testFn();
        
        // Process result
        result = {
          ...result,
          status: testResult.passed ? TEST_STATUS.PASS : TEST_STATUS.FAIL,
          message: testResult.message || (testResult.passed ? 'Test passed' : 'Test failed'),
          details: testResult.details || {},
          duration: testResult.duration || null
        };
      }
    } catch (error) {
      // Handle test errors
      result = {
        ...result,
        status: TEST_STATUS.FAIL,
        message: `Test error: ${error.message}`,
        error: error.toString(),
        stackTrace: error.stack
      };
    }
    
    // Store the result
    this.results[testId] = result;
    
    // Call test completion callback
    this.onTestComplete(testId, result);
    
    return result;
  }
  
  /**
   * Generate a summary of test results
   * 
   * @returns {Object} Test summary
   * @private
   */
  _generateSummary() {
    // Count results by status
    const counts = Object.values(this.results).reduce((acc, result) => {
      acc[result.status] = (acc[result.status] || 0) + 1;
      return acc;
    }, {});
    
    // Calculate pass rate
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    const passRate = total > 0 ? (counts[TEST_STATUS.PASS] || 0) / total : 0;
    
    // Group results by category
    const byCategory = Object.values(this.results).reduce((acc, result) => {
      if (!acc[result.category]) {
        acc[result.category] = {
          total: 0,
          pass: 0,
          fail: 0,
          partial: 0,
          untested: 0
        };
      }
      
      acc[result.category].total++;
      acc[result.category][result.status]++;
      
      return acc;
    }, {});
    
    return {
      browser: this.currentBrowser,
      platform: this.currentPlatform,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.endTime - this.startTime,
      counts,
      passRate,
      byCategory,
      results: this.results
    };
  }
  
  /**
   * Generate compatibility report in markdown format
   * 
   * @returns {string} Markdown report
   */
  generateMarkdownReport() {
    const summary = this._generateSummary();
    
    let markdown = `# Browser Compatibility Test Report\n\n`;
    
    // Browser and platform information
    markdown += `## Environment\n\n`;
    markdown += `- **Browser**: ${summary.browser.name} ${summary.browser.version}\n`;
    markdown += `- **Platform**: ${summary.platform.name}\n`;
    markdown += `- **Mobile**: ${summary.platform.isMobile ? 'Yes' : 'No'}\n`;
    markdown += `- **CPU Cores**: ${summary.platform.cpuCores}\n`;
    markdown += `- **Device Memory**: ${summary.platform.memory}GB\n`;
    markdown += `- **User Agent**: ${summary.browser.userAgent}\n\n`;
    
    // Summary
    markdown += `## Summary\n\n`;
    markdown += `- **Tests Run**: ${Object.keys(summary.results).length}\n`;
    markdown += `- **Passed**: ${summary.counts[TEST_STATUS.PASS] || 0}\n`;
    markdown += `- **Failed**: ${summary.counts[TEST_STATUS.FAIL] || 0}\n`;
    markdown += `- **Partial**: ${summary.counts[TEST_STATUS.PARTIAL] || 0}\n`;
    markdown += `- **Untested**: ${summary.counts[TEST_STATUS.UNTESTED] || 0}\n`;
    markdown += `- **Pass Rate**: ${(summary.passRate * 100).toFixed(2)}%\n\n`;
    
    // Results by category
    markdown += `## Results by Category\n\n`;
    markdown += `| Category | Pass | Fail | Partial | Untested | Pass Rate |\n`;
    markdown += `|----------|------|------|---------|----------|----------|\n`;
    
    Object.entries(summary.byCategory).forEach(([category, counts]) => {
      const categoryPassRate = counts.total > 0 ? 
        (counts.pass / counts.total * 100).toFixed(2) : '0.00';
      
      markdown += `| ${category} | ${counts.pass} | ${counts.fail} | ${counts.partial} | ${counts.untested} | ${categoryPassRate}% |\n`;
    });
    
    markdown += `\n`;
    
    // Detailed results
    markdown += `## Detailed Results\n\n`;
    
    Object.values(FEATURES_TO_TEST).forEach(features => {
      features.forEach(feature => {
        const testId = generateTestId(
          summary.browser.name,
          summary.browser.version,
          summary.platform.name,
          feature.name.replace(/\s+/g, '_')
        );
        
        const result = summary.results[testId];
        
        if (result) {
          const statusEmoji = {
            [TEST_STATUS.PASS]: '✅',
            [TEST_STATUS.FAIL]: '❌',
            [TEST_STATUS.PARTIAL]: '⚠️',
            [TEST_STATUS.UNTESTED]: '❔'
          }[result.status];
          
          markdown += `### ${feature.name} ${statusEmoji}\n\n`;
          markdown += `- **Description**: ${feature.description}\n`;
          markdown += `- **Critical**: ${feature.critical ? 'Yes' : 'No'}\n`;
          markdown += `- **Status**: ${result.status}\n`;
          markdown += `- **Message**: ${result.message}\n`;
          
          if (result.details && Object.keys(result.details).length > 0) {
            markdown += `- **Details**:\n`;
            Object.entries(result.details).forEach(([key, value]) => {
              markdown += `  - ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}\n`;
            });
          }
          
          if (result.error) {
            markdown += `- **Error**: ${result.error}\n`;
          }
          
          markdown += `\n`;
        }
      });
    });
    
    markdown += `\n_Report generated on ${new Date().toISOString()}_\n`;
    
    return markdown;
  }
  
  /**
   * Clear all test results
   */
  clearResults() {
    this.results = {};
    this.startTime = null;
    this.endTime = null;
  }
}

export { CompatibilityTestRunner };
export default CompatibilityTestRunner;