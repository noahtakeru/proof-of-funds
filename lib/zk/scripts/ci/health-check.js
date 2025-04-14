/**
 * Health Check Script for CI/CD Pipeline
 * 
 * This script verifies that deployed systems are functioning correctly.
 * It can be run after deployment to ensure that the new version is operating
 * as expected before finalizing a deployment.
 * 
 * Features:
 * - Checks multiple endpoints across environments
 * - Verifies API responses and status codes
 * - Tests smart contract interactions
 * - Validates proof generation and verification
 * - Provides detailed diagnostics for failures
 */

import fetch from 'node-fetch';
import { ethers } from 'ethers';
import { HealthCheck } from '../../src/deployment/HealthCheck.js';
import { EnvironmentDetector } from '../../src/deployment/EnvironmentDetector.js';

// Parse command line arguments
const args = process.argv.slice(2);
let environment = 'development';
let verbose = false;

for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--env=')) {
        environment = arg.substring(6);
    } else if (arg === '--verbose') {
        verbose = true;
    }
}

// Environment validation
const validEnvironments = ['development', 'staging', 'production'];
if (!validEnvironments.includes(environment)) {
    console.error(`Error: Invalid environment '${environment}'. Must be one of: ${validEnvironments.join(', ')}`);
    process.exit(1);
}

// Environment-specific configuration
const configs = {
    development: {
        baseUrl: 'https://dev-api.proofoffunds.com',
        contractAddress: process.env.DEV_CONTRACT_ADDRESS,
        rpcUrl: 'https://rpc.ankr.com/polygon_amoy',
        timeoutMs: 30000,
        retries: 3
    },
    staging: {
        baseUrl: 'https://staging-api.proofoffunds.com',
        contractAddress: process.env.STAGING_CONTRACT_ADDRESS,
        rpcUrl: 'https://rpc.ankr.com/polygon_amoy',
        timeoutMs: 60000,
        retries: 5
    },
    production: {
        baseUrl: 'https://api.proofoffunds.com',
        contractAddress: process.env.PROD_CONTRACT_ADDRESS,
        rpcUrl: 'https://polygon-rpc.com',
        timeoutMs: 120000,
        retries: 10
    }
};

// Get configuration for current environment
const config = configs[environment];

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} initialDelay - Initial delay in milliseconds
 * @returns {Promise<any>} - Result of the function
 */
async function retryWithBackoff(fn, maxRetries = 3, initialDelay = 1000) {
    let retries = 0;
    while (true) {
        try {
            return await fn();
        } catch (error) {
            if (retries >= maxRetries) {
                throw error;
            }
            
            const delay = initialDelay * Math.pow(2, retries);
            if (verbose) {
                console.log(`Retry ${retries + 1}/${maxRetries}, waiting ${delay}ms...`);
            }
            
            await new Promise(resolve => setTimeout(resolve, delay));
            retries++;
        }
    }
}

/**
 * Check API health
 * @returns {Promise<Object>} Health check results
 */
async function checkApiHealth() {
    if (verbose) {
        console.log(`Checking API health for ${environment} environment...`);
    }
    
    const endpoints = [
        '/zk/status',
        '/api/health'
    ];
    
    const results = {
        allHealthy: true,
        endpoints: {}
    };
    
    for (const endpoint of endpoints) {
        try {
            const url = `${config.baseUrl}${endpoint}`;
            if (verbose) {
                console.log(`Checking endpoint: ${url}`);
            }
            
            const response = await retryWithBackoff(
                () => fetch(url, { timeout: config.timeoutMs }),
                config.retries
            );
            
            const isJson = response.headers.get('content-type')?.includes('application/json');
            const responseData = isJson ? await response.json() : await response.text();
            
            const healthy = response.ok;
            results.endpoints[endpoint] = {
                url,
                status: response.status,
                healthy,
                response: responseData
            };
            
            if (!healthy) {
                results.allHealthy = false;
            }
            
            if (verbose) {
                console.log(`Endpoint ${url}: ${healthy ? 'HEALTHY' : 'UNHEALTHY'} (${response.status})`);
            }
        } catch (error) {
            results.endpoints[endpoint] = {
                url: `${config.baseUrl}${endpoint}`,
                healthy: false,
                error: error.message
            };
            
            results.allHealthy = false;
            
            if (verbose) {
                console.log(`Endpoint ${config.baseUrl}${endpoint}: ERROR (${error.message})`);
            }
        }
    }
    
    return results;
}

/**
 * Check smart contract health
 * @returns {Promise<Object>} Health check results
 */
async function checkContractHealth() {
    if (verbose) {
        console.log(`Checking smart contract health for ${environment} environment...`);
    }
    
    const results = {
        healthy: false,
        contract: config.contractAddress
    };
    
    try {
        if (!config.contractAddress) {
            throw new Error('Contract address not provided');
        }
        
        const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
        
        // Check that contract exists
        const code = await provider.getCode(config.contractAddress);
        
        if (code === '0x') {
            throw new Error('Contract does not exist at the specified address');
        }
        
        // Check contract methods
        const verifierAbi = [
            'function supportedVersions() view returns (string[] memory)',
            'function verifyStandardProof(uint256[] calldata, uint256[8] calldata, bytes calldata) view returns (bool)'
        ];
        
        const contract = new ethers.Contract(config.contractAddress, verifierAbi, provider);
        
        // Fetch supported versions
        const versions = await retryWithBackoff(
            () => contract.supportedVersions(),
            config.retries
        );
        
        results.versions = versions;
        results.healthy = versions && versions.length > 0;
        
        if (verbose) {
            console.log(`Contract ${config.contractAddress}: ${results.healthy ? 'HEALTHY' : 'UNHEALTHY'}`);
            console.log(`Supported versions: ${versions.join(', ')}`);
        }
    } catch (error) {
        results.error = error.message;
        
        if (verbose) {
            console.log(`Contract health check failed: ${error.message}`);
        }
    }
    
    return results;
}

/**
 * Check proof generation and verification
 * @returns {Promise<Object>} Health check results
 */
async function checkProofGeneration() {
    if (verbose) {
        console.log(`Checking proof generation for ${environment} environment...`);
    }
    
    const results = {
        healthy: false
    };
    
    try {
        // Call the proof generation endpoint
        const url = `${config.baseUrl}/zk/generateProof`;
        
        // Simple test parameters
        const testData = {
            proofType: 'standard',
            amount: '1000000000000000000', // 1 ETH in wei
            address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' // Test address
        };
        
        if (verbose) {
            console.log(`Generating proof with test data: ${JSON.stringify(testData)}`);
        }
        
        const response = await retryWithBackoff(
            () => fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(testData),
                timeout: config.timeoutMs
            }),
            config.retries
        );
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Proof generation failed with status ${response.status}: ${errorText}`);
        }
        
        const proofResult = await response.json();
        
        if (!proofResult.proof) {
            throw new Error('Proof generation response missing proof data');
        }
        
        results.proofGenerated = true;
        
        // Now verify the proof
        const verifyUrl = `${config.baseUrl}/zk/verifyProof`;
        
        const verifyResponse = await retryWithBackoff(
            () => fetch(verifyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    proof: proofResult.proof,
                    publicInputs: proofResult.publicInputs
                }),
                timeout: config.timeoutMs
            }),
            config.retries
        );
        
        if (!verifyResponse.ok) {
            const errorText = await verifyResponse.text();
            throw new Error(`Proof verification failed with status ${verifyResponse.status}: ${errorText}`);
        }
        
        const verifyResult = await verifyResponse.json();
        
        results.proofVerified = verifyResult.verified === true;
        results.healthy = results.proofGenerated && results.proofVerified;
        
        if (verbose) {
            console.log(`Proof generation: ${results.proofGenerated ? 'SUCCESS' : 'FAILURE'}`);
            console.log(`Proof verification: ${results.proofVerified ? 'SUCCESS' : 'FAILURE'}`);
        }
    } catch (error) {
        results.error = error.message;
        
        if (verbose) {
            console.log(`Proof generation check failed: ${error.message}`);
        }
    }
    
    return results;
}

/**
 * Run comprehensive health checks
 * @returns {Promise<Object>} Overall health status
 */
async function runHealthChecks() {
    console.log(`Running health checks for ${environment} environment...`);
    
    const startTime = Date.now();
    
    // Get environment details
    const envDetector = new EnvironmentDetector();
    const envInfo = await envDetector.detect();
    
    // Create comprehensive health check object
    const healthChecker = new HealthCheck({
        environment,
        timeoutMs: config.timeoutMs,
        retries: config.retries,
        verbose
    });
    
    // Run built-in health checks
    const builtInChecks = await healthChecker.checkAll();
    
    // Run additional checks
    const apiHealth = await checkApiHealth();
    const contractHealth = await checkContractHealth();
    const proofHealth = await checkProofGeneration();
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Combine results
    const results = {
        timestamp: new Date().toISOString(),
        environment,
        duration: `${duration}ms`,
        environmentInfo: envInfo,
        allHealthy: builtInChecks.allHealthy && apiHealth.allHealthy && contractHealth.healthy && proofHealth.healthy,
        checks: {
            api: apiHealth,
            contract: contractHealth,
            proof: proofHealth,
            system: builtInChecks
        }
    };
    
    // Print summary
    console.log(`Health check completed in ${duration}ms`);
    console.log(`Overall status: ${results.allHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
    
    if (!apiHealth.allHealthy) {
        console.log('API health checks failed');
    }
    
    if (!contractHealth.healthy) {
        console.log('Contract health checks failed');
    }
    
    if (!proofHealth.healthy) {
        console.log('Proof generation checks failed');
    }
    
    if (!builtInChecks.allHealthy) {
        console.log('System health checks failed');
    }
    
    return results;
}

// Run health checks and exit with appropriate code
runHealthChecks().then(results => {
    if (!results.allHealthy) {
        console.error('Health checks failed');
        process.exit(1);
    } else {
        console.log('All health checks passed');
        process.exit(0);
    }
}).catch(error => {
    console.error(`Fatal error during health checks: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
});