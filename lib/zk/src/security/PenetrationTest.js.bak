/**
 * PenetrationTest.js
 * 
 * A comprehensive framework for security penetration testing of the ZK infrastructure.
 * This framework is designed to simulate various types of attacks and security
 * vulnerabilities to ensure the system is resilient against them.
 * 
 * This framework is designed to:
 * 1. Simulate common attack vectors
 * 2. Test system resilience against attacks
 * 3. Identify security vulnerabilities
 * 4. Provide detailed reporting on security issues
 */

import { zkErrorLogger } from '../zkErrorLogger.mjs';
import { ZKError, SystemError, SecurityError, InputError, ErrorCode } from '../zkErrorHandler.mjs';

/**
 * Represents a security vulnerability with severity rating
 */
class Vulnerability {
  /**
   * Create a new vulnerability
   * @param {string} id - Vulnerability ID
   * @param {string} name - Vulnerability name
   * @param {string} description - Description of the vulnerability
   * @param {string} severity - Severity level (critical, high, medium, low, info)
   * @param {Object} details - Additional details about the vulnerability
   * @param {Object} remediation - Remediation steps
   */
  constructor(id, name, description, severity, details = {}, remediation = {}) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.severity = this._validateSeverity(severity);
    this.details = details;
    this.remediation = remediation;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Validate and normalize severity level
   * @param {string} severity - Severity level
   * @returns {string} Normalized severity level
   * @private
   */
  _validateSeverity(severity) {
    const validSeverities = ['critical', 'high', 'medium', 'low', 'info'];
    const normalized = severity.toLowerCase();
    
    if (!validSeverities.includes(normalized)) {
      console.warn(`Invalid severity level: ${severity}. Defaulting to "medium".`);
      return 'medium';
    }
    
    return normalized;
  }

  /**
   * Get numerical severity score (CVSS-like)
   * @returns {number} Severity score (0-10)
   */
  getSeverityScore() {
    switch (this.severity) {
      case 'critical': return 9.5;
      case 'high': return 7.5;
      case 'medium': return 5.0;
      case 'low': return 2.5;
      case 'info': return 0.0;
      default: return 5.0;
    }
  }

  /**
   * Get formatted string representation
   * @returns {string} Formatted vulnerability
   */
  toString() {
    return `[${this.severity.toUpperCase()}] ${this.name}: ${this.description}`;
  }
}

/**
 * Security penetration testing framework
 * @class
 */
class PenetrationTest {
  /**
   * Create a new penetration test
   * @param {Object} config - Test configuration
   * @param {string} config.name - Test name
   * @param {string} config.description - Test description
   * @param {Object} config.target - Target system to test
   * @param {Object} config.components - Components to use for testing
   * @param {Function} config.setup - Setup function
   * @param {Function} config.teardown - Teardown function
   */
  constructor({ name, description, target, components = {}, setup, teardown }) {
    this.name = name;
    this.description = description;
    this.target = target;
    this.components = components;
    this.setup = setup || (() => ({}));
    this.teardown = teardown || (() => {});
    this.attacks = [];
    this.vulnerabilities = [];
    
    // Results tracking
    this.results = {
      executed: 0,
      successful: 0,
      failed: 0,
      vulnerabilities: [],
      startTime: null,
      endTime: null,
      duration: null
    };
  }

  /**
   * Add an attack vector to test
   * @param {Object} attack - Attack definition
   * @param {string} attack.name - Attack name
   * @param {string} attack.description - Attack description
   * @param {string} attack.category - Attack category (e.g., 'input-validation', 'cryptographic', etc.)
   * @param {Function} attack.execute - Function to execute the attack
   * @param {string} attack.severity - Severity if the attack is successful
   * @returns {PenetrationTest} - Returns this for method chaining
   */
  addAttack(attack) {
    this.attacks.push({
      ...attack,
      id: `attack-${this.attacks.length + 1}`,
      status: 'pending',
      vulnerabilities: []
    });
    
    return this;
  }

  /**
   * Add multiple attacks at once
   * @param {Array} attacks - Array of attack definitions
   * @returns {PenetrationTest} - Returns this for method chaining
   */
  addAttacks(attacks) {
    attacks.forEach(attack => this.addAttack(attack));
    return this;
  }

  /**
   * Record a vulnerability
   * @param {string} attackId - ID of the attack that found the vulnerability
   * @param {string} name - Vulnerability name
   * @param {string} description - Description of the vulnerability
   * @param {string} severity - Severity level
   * @param {Object} details - Additional details
   * @param {Object} remediation - Remediation steps
   * @returns {Vulnerability} - The created vulnerability
   */
  recordVulnerability(attackId, name, description, severity, details = {}, remediation = {}) {
    const id = `vuln-${this.vulnerabilities.length + 1}`;
    const vulnerability = new Vulnerability(id, name, description, severity, details, remediation);
    
    this.vulnerabilities.push(vulnerability);
    
    // Also add to the specific attack
    const attack = this.attacks.find(a => a.id === attackId);
    if (attack) {
      attack.vulnerabilities.push(vulnerability);
    }
    
    return vulnerability;
  }

  /**
   * Run all penetration tests
   * @returns {Promise<Object>} - Test results
   */
  async run() {
    this.results.startTime = Date.now();
    console.log(`\n🔒 Starting security penetration test: ${this.name}`);
    console.log(`Description: ${this.description}`);
    
    let context;
    try {
      // Setup test environment
      console.log('\n📋 Setting up test environment...');
      context = await this.setup();
      console.log('✅ Setup complete');
    } catch (error) {
      const setupError = error instanceof ZKError ? error : new SystemError(`Setup failed: ${error.message}`, {
        code: ErrorCode.SYSTEM_NOT_INITIALIZED,
        category: 'SECURITY',
        operationId: `penetration_test_setup_${Date.now()}`,
        recoverable: false,
        securityCritical: true,
        details: { testName: this.name }
      });
      console.error(`❌ Setup failed: ${setupError.message}`);
      zkErrorLogger.logError(setupError);
      
      this.results.endTime = Date.now();
      this.results.duration = this.results.endTime - this.results.startTime;
      
      return {
        success: false,
        error: setupError,
        results: this.results
      };
    }
    
    // Execute all attacks
    for (const attack of this.attacks) {
      console.log(`\n⚡ Executing attack: ${attack.name}`);
      console.log(`Category: ${attack.category}`);
      console.log(`Description: ${attack.description}`);
      
      try {
        // Execute the attack
        this.results.executed++;
        const result = await attack.execute({
          target: this.target,
          components: this.components,
          context,
          recordVulnerability: (name, description, severity, details, remediation) => {
            return this.recordVulnerability(attack.id, name, description, severity, details, remediation);
          }
        });
        
        // Check if the attack was successful (found vulnerabilities)
        const successful = attack.vulnerabilities.length > 0;
        
        if (successful) {
          attack.status = 'successful';
          attack.result = result;
          this.results.successful++;
          console.log(`⚠️ Attack successful - found ${attack.vulnerabilities.length} vulnerabilities:`);
          
          attack.vulnerabilities.forEach(vuln => {
            console.log(`  - ${vuln.toString()}`);
          });
        } else {
          attack.status = 'failed';
          attack.result = result;
          this.results.failed++;
          console.log('✅ Attack failed - no vulnerabilities found');
        }
      } catch (error) {
        attack.status = 'error';
        attack.error = error;
        this.results.failed++;
        console.error(`❌ Error executing attack: ${error.message}`);
        
        // Convert to ZKError if not already and log
        const attackError = error instanceof ZKError ? error : new SecurityError(`Attack execution failed: ${error.message}`, {
          code: ErrorCode.SECURITY_DATA_INTEGRITY,
          category: 'SECURITY',
          operationId: `penetration_test_attack_${Date.now()}`,
          recoverable: true,
          securityCritical: true,
          details: {
            testName: this.name,
            attackName: attack.name,
            attackCategory: attack.category
          }
        });
        zkErrorLogger.logError(attackError);
      }
    }
    
    // Run teardown
    try {
      console.log(`\n📋 Tearing down test environment...`);
      await this.teardown(context);
      console.log(`✅ Teardown complete`);
    } catch (error) {
      console.error(`❌ Teardown failed: ${error.message}`);
      const teardownError = error instanceof ZKError ? error : new SystemError(`Teardown failed: ${error.message}`, {
        code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
        category: 'SECURITY',
        operationId: `penetration_test_teardown_${Date.now()}`,
        recoverable: true,
        details: { testName: this.name }
      });
      zkErrorLogger.logError(teardownError);
    }
    
    // Collect all vulnerabilities
    this.results.vulnerabilities = this.vulnerabilities;
    
    // Calculate results
    this.results.endTime = Date.now();
    this.results.duration = this.results.endTime - this.results.startTime;
    
    // Print summary
    console.log(`\n📊 Test Results for: ${this.name}`);
    console.log(`Total Attacks: ${this.attacks.length}`);
    console.log(`Executed: ${this.results.executed}`);
    console.log(`Successful (found vulnerabilities): ${this.results.successful}`);
    console.log(`Failed (no vulnerabilities found): ${this.results.failed}`);
    console.log(`Total Vulnerabilities Found: ${this.vulnerabilities.length}`);
    
    if (this.vulnerabilities.length > 0) {
      console.log(`\nVulnerabilities by Severity:`);
      const sevCounts = {
        critical: this.vulnerabilities.filter(v => v.severity === 'critical').length,
        high: this.vulnerabilities.filter(v => v.severity === 'high').length,
        medium: this.vulnerabilities.filter(v => v.severity === 'medium').length,
        low: this.vulnerabilities.filter(v => v.severity === 'low').length,
        info: this.vulnerabilities.filter(v => v.severity === 'info').length
      };
      
      console.log(`  Critical: ${sevCounts.critical}`);
      console.log(`  High: ${sevCounts.high}`);
      console.log(`  Medium: ${sevCounts.medium}`);
      console.log(`  Low: ${sevCounts.low}`);
      console.log(`  Info: ${sevCounts.info}`);
    }
    
    return {
      success: true,
      results: this.results,
      attacks: this.attacks,
      vulnerabilities: this.vulnerabilities
    };
  }

  /**
   * Generate a detailed security report
   * @returns {string} HTML report
   */
  generateSecurityReport() {
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Security Penetration Test Report: ${this.name}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
          h1, h2, h3, h4 { color: #222; }
          .header { margin-bottom: 20px; }
          .summary { margin-bottom: 30px; background-color: #f8f9fa; padding: 15px; border-radius: 5px; }
          .attacks { margin-bottom: 30px; }
          .attack { margin-bottom: 20px; border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
          .attack-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
          .attack-successful { border-left: 5px solid #f44336; }
          .attack-failed { border-left: 5px solid #4caf50; }
          .attack-error { border-left: 5px solid #ff9800; }
          .vulnerabilities { margin-top: 30px; }
          .vulnerability { margin-bottom: 15px; padding: 15px; border-radius: 5px; }
          .critical { background-color: #ffebee; border-left: 5px solid #c62828; }
          .high { background-color: #fff8e1; border-left: 5px solid #ff8f00; }
          .medium { background-color: #fff8e1; border-left: 5px solid #ffa000; }
          .low { background-color: #f1f8e9; border-left: 5px solid #7cb342; }
          .info { background-color: #e3f2fd; border-left: 5px solid #1976d2; }
          .details { margin-top: 10px; }
          .remediation { margin-top: 10px; background-color: #e8f5e9; padding: 10px; border-radius: 5px; }
          .badge {
            display: inline-block;
            padding: 3px 7px;
            border-radius: 3px;
            color: white;
            font-size: 12px;
            font-weight: bold;
          }
          .badge-critical { background-color: #c62828; }
          .badge-high { background-color: #ff8f00; }
          .badge-medium { background-color: #ffa000; }
          .badge-low { background-color: #7cb342; }
          .badge-info { background-color: #1976d2; }
          .badge-error { background-color: #ff9800; }
          .badge-success { background-color: #4caf50; }
          .badge-failure { background-color: #9e9e9e; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Security Penetration Test Report</h1>
          <h2>${this.name}</h2>
          <p>${this.description}</p>
          <p><strong>Date:</strong> ${new Date(this.results.startTime).toLocaleString()}</p>
          <p><strong>Duration:</strong> ${(this.results.duration / 1000).toFixed(2)} seconds</p>
        </div>
        
        <div class="summary">
          <h2>Summary</h2>
          <p><strong>Total Attacks:</strong> ${this.attacks.length}</p>
          <p><strong>Executed:</strong> ${this.results.executed}</p>
          <p><strong>Successful (found vulnerabilities):</strong> ${this.results.successful}</p>
          <p><strong>Failed (no vulnerabilities found):</strong> ${this.results.failed}</p>
          <p><strong>Total Vulnerabilities Found:</strong> ${this.vulnerabilities.length}</p>
          
          <h3>Vulnerabilities by Severity</h3>
          <p><span class="badge badge-critical">Critical</span> ${this.vulnerabilities.filter(v => v.severity === 'critical').length}</p>
          <p><span class="badge badge-high">High</span> ${this.vulnerabilities.filter(v => v.severity === 'high').length}</p>
          <p><span class="badge badge-medium">Medium</span> ${this.vulnerabilities.filter(v => v.severity === 'medium').length}</p>
          <p><span class="badge badge-low">Low</span> ${this.vulnerabilities.filter(v => v.severity === 'low').length}</p>
          <p><span class="badge badge-info">Info</span> ${this.vulnerabilities.filter(v => v.severity === 'info').length}</p>
        </div>
        
        <div class="attacks">
          <h2>Attacks</h2>
    `;
    
    this.attacks.forEach(attack => {
      const statusClass = attack.status === 'successful' ? 'attack-successful' : 
                          attack.status === 'failed' ? 'attack-failed' : 'attack-error';
      
      const statusBadge = attack.status === 'successful' ? '<span class="badge badge-success">Successful</span>' : 
                          attack.status === 'failed' ? '<span class="badge badge-failure">Failed</span>' : 
                          '<span class="badge badge-error">Error</span>';
      
      html += `
        <div class="attack ${statusClass}">
          <div class="attack-header">
            <h3>${attack.name}</h3>
            ${statusBadge}
          </div>
          <p><strong>Category:</strong> ${attack.category}</p>
          <p><strong>Description:</strong> ${attack.description}</p>
          <p><strong>Vulnerabilities Found:</strong> ${attack.vulnerabilities.length}</p>
          
          ${attack.error ? `
          <div class="error">
            <h4>Error</h4>
            <p>${attack.error.message}</p>
            <pre>${attack.error.stack}</pre>
          </div>
          ` : ''}
          
          ${attack.vulnerabilities.length > 0 ? `
          <div class="attack-vulnerabilities">
            <h4>Vulnerabilities</h4>
            <ul>
              ${attack.vulnerabilities.map(vuln => `
              <li>
                <strong>${vuln.name}</strong> 
                <span class="badge badge-${vuln.severity}">${vuln.severity.toUpperCase()}</span>
              </li>
              `).join('')}
            </ul>
          </div>
          ` : ''}
        </div>
      `;
    });
    
    html += `
        </div>
        
        <div class="vulnerabilities">
          <h2>Vulnerabilities</h2>
    `;
    
    if (this.vulnerabilities.length === 0) {
      html += `
        <p>No vulnerabilities found.</p>
      `;
    } else {
      this.vulnerabilities.forEach(vuln => {
        html += `
          <div class="vulnerability ${vuln.severity}">
            <h3>${vuln.name} <span class="badge badge-${vuln.severity}">${vuln.severity.toUpperCase()}</span></h3>
            <p><strong>ID:</strong> ${vuln.id}</p>
            <p><strong>Description:</strong> ${vuln.description}</p>
            <p><strong>Severity Score:</strong> ${vuln.getSeverityScore().toFixed(1)}/10.0</p>
            
            <div class="details">
              <h4>Details</h4>
              <pre>${JSON.stringify(vuln.details, null, 2)}</pre>
            </div>
            
            <div class="remediation">
              <h4>Remediation</h4>
              ${vuln.remediation.steps ? `
              <ol>
                ${vuln.remediation.steps.map(step => `<li>${step}</li>`).join('')}
              </ol>
              ` : `<p>${vuln.remediation.description || 'No specific remediation steps provided.'}</p>`}
            </div>
          </div>
        `;
      });
    }
    
    html += `
        </div>
      </body>
      </html>
    `;
    
    return html;
  }
}

/**
 * Creates a common web security test
 * @param {Object} options - Test options
 * @returns {PenetrationTest} - Configured test
 */
function createWebSecurityTest(options = {}) {
  const {
    name = 'Web Security Test',
    description = 'Tests common web security vulnerabilities in the ZK infrastructure',
    target = {},
    components = {}
  } = options;
  
  // Create test instance
  const test = new PenetrationTest({
    name,
    description,
    target,
    components
  });
  
  // Add common web security attacks
  test.addAttack({
    name: 'Cross-Site Scripting (XSS) Test',
    description: 'Tests if the system is vulnerable to XSS attacks',
    category: 'input-validation',
    severity: 'high',
    execute: async ({ target, recordVulnerability }) => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '"><script>alert("XSS")</script>',
        '"><img src=x onerror=alert("XSS")>',
        '"><svg onload=alert("XSS")>',
        'javascript:alert("XSS")'
      ];
      
      const vulnerableEndpoints = [];
      
      // Test all API endpoints for XSS
      for (const endpoint of Object.keys(target.endpoints || {})) {
        const endpointFn = target.endpoints[endpoint];
        
        for (const payload of xssPayloads) {
          try {
            // Create a mock request with the XSS payload
            const req = {
              method: 'POST',
              body: {
                input: payload,
                proofType: 'standard'
              },
              headers: {}
            };
            
            // Create a mock response to capture the output
            let responseData = null;
            const res = {
              status: () => ({ 
                json: (data) => { responseData = data; },
                send: (data) => { responseData = data; }
              }),
              json: (data) => { responseData = data; },
              send: (data) => { responseData = data; }
            };
            
            // Call the endpoint
            await endpointFn(req, res);
            
            // Check if the payload is reflected in the response
            const responseStr = JSON.stringify(responseData);
            if (responseStr.includes(payload)) {
              vulnerableEndpoints.push({
                endpoint,
                payload,
                response: responseStr
              });
              
              recordVulnerability(
                'Reflected XSS Vulnerability',
                `Endpoint ${endpoint} reflects user input without proper sanitization`,
                'high',
                {
                  endpoint,
                  payload,
                  response: responseStr.substring(0, 200) + '...' // Truncate for readability
                },
                {
                  description: 'Implement proper input sanitization and content security policy (CSP)',
                  steps: [
                    'Sanitize all user input before including it in responses',
                    'Implement a strict Content-Security-Policy header',
                    'Use context-appropriate encoding (HTML, JavaScript, CSS, URL) for dynamic data',
                    'Consider using a library like DOMPurify for HTML sanitization'
                  ]
                }
              );
            }
          } catch (error) {
            // Ignore errors during testing
          }
        }
      }
      
      return { vulnerableEndpoints };
    }
  });
  
  test.addAttack({
    name: 'SQL Injection Test',
    description: 'Tests if the system is vulnerable to SQL injection attacks',
    category: 'input-validation',
    severity: 'critical',
    execute: async ({ target, recordVulnerability }) => {
      const sqlPayloads = [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "' UNION SELECT * FROM users; --",
        "admin' --",
        "1'; SELECT * FROM users WHERE name LIKE '%"
      ];
      
      const vulnerableEndpoints = [];
      
      // Test all API endpoints for SQL injection
      for (const endpoint of Object.keys(target.endpoints || {})) {
        const endpointFn = target.endpoints[endpoint];
        
        for (const payload of sqlPayloads) {
          try {
            // Create a mock request with the SQL injection payload
            const req = {
              method: 'POST',
              body: {
                id: payload,
                username: payload,
                walletAddress: payload,
                proofType: 'standard'
              },
              headers: {}
            };
            
            // Create a mock response to capture the output
            let responseData = null;
            const res = {
              status: () => ({ 
                json: (data) => { responseData = data; },
                send: (data) => { responseData = data; }
              }),
              json: (data) => { responseData = data; },
              send: (data) => { responseData = data; }
            };
            
            // Call the endpoint
            await endpointFn(req, res);
            
            // Check for signs of SQL errors in the response
            const responseStr = JSON.stringify(responseData);
            const sqlErrorIndicators = [
              'syntax error',
              'SQL syntax',
              'mysql',
              'postgresql',
              'sqlite',
              'database error',
              'ORA-',
              'SQL Server'
            ];
            
            const hasSqlError = sqlErrorIndicators.some(indicator => 
              responseStr.toLowerCase().includes(indicator.toLowerCase())
            );
            
            if (hasSqlError) {
              vulnerableEndpoints.push({
                endpoint,
                payload,
                response: responseStr
              });
              
              recordVulnerability(
                'SQL Injection Vulnerability',
                `Endpoint ${endpoint} may be vulnerable to SQL injection`,
                'critical',
                {
                  endpoint,
                  payload,
                  response: responseStr.substring(0, 200) + '...' // Truncate for readability
                },
                {
                  description: 'Implement proper parameterized queries and input validation',
                  steps: [
                    'Use parameterized queries or prepared statements',
                    'Never concatenate user input directly into SQL queries',
                    'Implement proper input validation and sanitization',
                    'Apply the principle of least privilege to database accounts',
                    'Consider using an ORM with built-in protection against SQL injection'
                  ]
                }
              );
            }
          } catch (error) {
            // Check if the error message suggests SQL error
            const errorStr = error.toString().toLowerCase();
            const sqlErrorIndicators = [
              'syntax error',
              'sql syntax',
              'mysql',
              'postgresql',
              'sqlite',
              'database error',
              'ora-'
            ];
            
            const hasSqlError = sqlErrorIndicators.some(indicator => 
              errorStr.includes(indicator.toLowerCase())
            );
            
            if (hasSqlError) {
              vulnerableEndpoints.push({
                endpoint,
                payload,
                error: error.message
              });
              
              recordVulnerability(
                'SQL Injection Vulnerability',
                `Endpoint ${endpoint} may be vulnerable to SQL injection`,
                'critical',
                {
                  endpoint,
                  payload,
                  error: error.message
                },
                {
                  description: 'Implement proper parameterized queries and input validation',
                  steps: [
                    'Use parameterized queries or prepared statements',
                    'Never concatenate user input directly into SQL queries',
                    'Implement proper input validation and sanitization',
                    'Apply the principle of least privilege to database accounts',
                    'Consider using an ORM with built-in protection against SQL injection'
                  ]
                }
              );
            }
          }
        }
      }
      
      return { vulnerableEndpoints };
    }
  });
  
  return test;
}

/**
 * Creates a ZK-specific security test
 * @param {Object} options - Test options
 * @returns {PenetrationTest} - Configured test
 */
function createZKSecurityTest(options = {}) {
  const {
    name = 'ZK Security Test',
    description = 'Tests ZK-specific security vulnerabilities',
    target = {},
    components = {}
  } = options;
  
  // Create test instance
  const test = new PenetrationTest({
    name,
    description,
    target,
    components
  });
  
  // Add ZK-specific attacks
  test.addAttack({
    name: 'Proof Replay Attack Test',
    description: 'Tests if the system is vulnerable to proof replay attacks',
    category: 'cryptographic',
    severity: 'high',
    execute: async ({ target, components, recordVulnerability }) => {
      if (!components.zkProofGenerator || !components.zkUtils) {
        throw new InputError('zkProofGenerator and zkUtils components are required for this test', {
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          category: 'SECURITY',
          operationId: `zk_security_test_${Date.now()}`,
          recoverable: false,
          userFixable: true,
          details: {
            missingComponents: {
              zkProofGenerator: !components.zkProofGenerator,
              zkUtils: !components.zkUtils
            }
          }
        });
      }
      
      const { zkProofGenerator, zkUtils } = components;
      
      // Generate a valid proof
      const inputs = {
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        amount: '1000000000000000000', // 1 ETH
        tokenAddress: '0x0000000000000000000000000000000000000000',
        chainId: 1,
        nonce: Date.now().toString()
      };
      
      const { proof, publicSignals } = await zkProofGenerator.generateProof('standard', inputs);
      
      // Serialize and save the proof for reuse
      const serializedProof = zkUtils.serializeZKProof(proof, publicSignals);
      
      // Test if we can reuse the same proof multiple times
      const replayCount = 3;
      const verificationResults = [];
      let allVerificationsSucceeded = true;
      
      for (let i = 0; i < replayCount; i++) {
        try {
          // Deserialize the proof
          const { proof: replayProof, publicSignals: replaySignals } = 
            zkUtils.deserializeZKProof(serializedProof.proof, serializedProof.publicSignals);
          
          // Attempt to verify the same proof again
          const verified = await zkUtils.verifyProof('standard', replayProof, replaySignals);
          
          verificationResults.push({
            attempt: i + 1,
            verified
          });
          
          if (!verified) {
            allVerificationsSucceeded = false;
          }
        } catch (error) {
          verificationResults.push({
            attempt: i + 1,
            verified: false,
            error: error.message
          });
          
          allVerificationsSucceeded = false;
        }
      }
      
      // If all verifications succeeded, we might have a replay vulnerability
      if (allVerificationsSucceeded) {
        recordVulnerability(
          'Proof Replay Vulnerability',
          'The system allows the same ZK proof to be verified multiple times',
          'high',
          {
            proof: serializedProof,
            verificationResults
          },
          {
            description: 'Implement nonce tracking or proof invalidation to prevent replay attacks',
            steps: [
              'Include a unique nonce in each proof that is tracked server-side',
              'Implement a server-side registry of used proofs to prevent reuse',
              'Add timestamps to proofs and reject proofs older than a certain age',
              'Consider using blockchain transaction nonces if applicable'
            ]
          }
        );
      }
      
      return { verificationResults };
    }
  });
  
  test.addAttack({
    name: 'Parameter Tampering Test',
    description: 'Tests if the system properly validates proof parameters',
    category: 'cryptographic',
    severity: 'high',
    execute: async ({ target, components, recordVulnerability }) => {
      if (!components.zkProofGenerator || !components.zkUtils) {
        throw new InputError('zkProofGenerator and zkUtils components are required for this test', {
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          category: 'SECURITY',
          operationId: `zk_security_test_${Date.now()}`,
          recoverable: false,
          userFixable: true,
          details: {
            missingComponents: {
              zkProofGenerator: !components.zkProofGenerator,
              zkUtils: !components.zkUtils
            }
          }
        });
      }
      
      const { zkProofGenerator, zkUtils } = components;
      
      // Generate a valid proof
      const inputs = {
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        amount: '1000000000000000000', // 1 ETH
        tokenAddress: '0x0000000000000000000000000000000000000000',
        chainId: 1
      };
      
      const { proof, publicSignals } = await zkProofGenerator.generateProof('standard', inputs);
      
      // Test different parameter tampering scenarios
      const tamperingTests = [
        {
          name: 'Modify publicSignals[0]',
          tamperFn: () => {
            // Clone the arrays to avoid modifying originals
            const modifiedProof = JSON.parse(JSON.stringify(proof));
            const modifiedSignals = [...publicSignals];
            
            // Modify the first public signal (typically contains critical data)
            modifiedSignals[0] = (BigInt(modifiedSignals[0]) + BigInt(1)).toString();
            
            return { proof: modifiedProof, publicSignals: modifiedSignals };
          }
        },
        {
          name: 'Modify proof.pi_a[0]',
          tamperFn: () => {
            // Clone the arrays to avoid modifying originals
            const modifiedProof = JSON.parse(JSON.stringify(proof));
            const modifiedSignals = [...publicSignals];
            
            // Modify a proof component
            modifiedProof.pi_a[0] = (BigInt(modifiedProof.pi_a[0]) + BigInt(1)).toString();
            
            return { proof: modifiedProof, publicSignals: modifiedSignals };
          }
        },
        {
          name: 'Add extra publicSignal',
          tamperFn: () => {
            // Clone the arrays to avoid modifying originals
            const modifiedProof = JSON.parse(JSON.stringify(proof));
            const modifiedSignals = [...publicSignals, '42'];
            
            return { proof: modifiedProof, publicSignals: modifiedSignals };
          }
        },
        {
          name: 'Remove a publicSignal',
          tamperFn: () => {
            // Clone the arrays to avoid modifying originals
            const modifiedProof = JSON.parse(JSON.stringify(proof));
            const modifiedSignals = publicSignals.slice(0, -1);
            
            return { proof: modifiedProof, publicSignals: modifiedSignals };
          }
        }
      ];
      
      const tamperingResults = [];
      let vulnerabilityFound = false;
      
      for (const test of tamperingTests) {
        try {
          const { proof: modifiedProof, publicSignals: modifiedSignals } = test.tamperFn();
          
          // Try to verify the tampered proof
          const verified = await zkUtils.verifyProof('standard', modifiedProof, modifiedSignals);
          
          tamperingResults.push({
            test: test.name,
            verified,
            error: null
          });
          
          // If tampered proof verifies, we have a vulnerability
          if (verified) {
            vulnerabilityFound = true;
            
            recordVulnerability(
              'Parameter Tampering Vulnerability',
              `The system accepts tampered proof parameters: ${test.name}`,
              'high',
              {
                test: test.name,
                originalProof: { proof, publicSignals },
                tamperedProof: { proof: modifiedProof, publicSignals: modifiedSignals }
              },
              {
                description: 'Improve validation of proof parameters and inputs',
                steps: [
                  'Implement strict validation of all proof parameters',
                  'Verify the number and type of all publicSignals',
                  'Include a cryptographic commitment to the original input data',
                  'Implement additional application-level verification of ZK proof claims'
                ]
              }
            );
          }
        } catch (error) {
          // Error during verification is actually good - it means the system rejected tampered proofs
          tamperingResults.push({
            test: test.name,
            verified: false,
            error: error.message
          });
        }
      }
      
      return { tamperingResults };
    }
  });
  
  return test;
}

export { PenetrationTest, Vulnerability, createWebSecurityTest, createZKSecurityTest };
export default PenetrationTest;