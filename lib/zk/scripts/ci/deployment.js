/**
 * CI/CD Deployment Script for Zero-Knowledge Infrastructure
 * 
 * This script handles the deployment of the ZK infrastructure components
 * to different environments (development, staging, production). It supports
 * both infrastructure deployment and application deployment.
 * 
 * Features:
 * - Environment-specific configuration and secret management
 * - Multi-platform deployment (GCP, AWS, Azure)
 * - Smart contract deployment and verification
 * - Progressive deployment with canary releases
 * - Automatic rollback on failures
 * - Comprehensive logging and notifications
 */

import fs from 'fs';
import path from 'path';
import { DeploymentManager } from '../../src/deployment/DeploymentManager.js';
import { EnvironmentDetector } from '../../src/deployment/EnvironmentDetector.js';
import { HealthCheck } from '../../src/deployment/HealthCheck.js';
import { ZKErrorLogger } from '../../src/zkErrorHandler.js';

// Parse command line arguments
const args = process.argv.slice(2);
let environment = 'development';
let verbose = false;
let dryRun = false;

for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--env=')) {
        environment = arg.substring(6);
    } else if (arg === '--verbose') {
        verbose = true;
    } else if (arg === '--dry-run') {
        dryRun = true;
    }
}

// Environment validation
const validEnvironments = ['development', 'staging', 'production'];
if (!validEnvironments.includes(environment)) {
    console.error(`Error: Invalid environment '${environment}'. Must be one of: ${validEnvironments.join(', ')}`);
    process.exit(1);
}

// Configuration by environment
const configs = {
    development: {
        gcp: {
            project: 'zk-proof-dev',
            region: 'us-central1',
            serviceAccount: process.env.GCP_SA_KEY || null
        },
        polygon: {
            network: 'amoy', // Polygon testnet (Mumbai)
            providerUrl: 'https://rpc.ankr.com/polygon_amoy',
            privateKey: process.env.POLYGON_PRIVATE_KEY || null
        },
        healthCheck: {
            retries: 3,
            timeout: 30000, // 30 seconds
            endpoints: [
                'https://dev-api.proofoffunds.com/zk/status'
            ]
        }
    },
    staging: {
        gcp: {
            project: 'zk-proof-staging',
            region: 'us-central1',
            serviceAccount: process.env.GCP_SA_KEY || null
        },
        polygon: {
            network: 'amoy', // Polygon testnet (Mumbai)
            providerUrl: 'https://rpc.ankr.com/polygon_amoy',
            privateKey: process.env.POLYGON_PRIVATE_KEY || null
        },
        healthCheck: {
            retries: 5,
            timeout: 60000, // 60 seconds
            endpoints: [
                'https://staging-api.proofoffunds.com/zk/status'
            ]
        }
    },
    production: {
        gcp: {
            project: 'zk-proof-prod',
            region: 'us-central1',
            serviceAccount: process.env.GCP_SA_KEY || null
        },
        polygon: {
            network: 'mainnet', // Polygon mainnet
            providerUrl: 'https://polygon-rpc.com',
            privateKey: process.env.POLYGON_PRIVATE_KEY || null
        },
        healthCheck: {
            retries: 10,
            timeout: 120000, // 120 seconds
            endpoints: [
                'https://api.proofoffunds.com/zk/status'
            ]
        }
    }
};

// Get configuration for current environment
const config = configs[environment];

// Create deployment manager
const deploymentManager = new DeploymentManager({
    environment,
    config,
    verbose,
    dryRun
});

// Main deployment function
async function deploy() {
    console.log(`Starting deployment to ${environment} environment${dryRun ? ' (DRY RUN)' : ''}`);
    
    try {
        // Step 1: Verify environment and prerequisites
        console.log('Verifying deployment prerequisites...');
        
        // Check environment detector
        const envDetector = new EnvironmentDetector();
        const detectedEnv = await envDetector.detect();
        
        console.log(`Detected environment: ${detectedEnv.name} (${detectedEnv.type})`);
        
        // Verify required credentials
        if (!config.gcp.serviceAccount && !dryRun) {
            throw new Error('GCP service account credentials are required for deployment');
        }
        
        if (!config.polygon.privateKey && !dryRun) {
            throw new Error('Polygon private key is required for smart contract deployment');
        }
        
        // Step 2: Initialize deployment
        console.log('Initializing deployment...');
        await deploymentManager.initialize();
        
        // Step 3: Deploy infrastructural components
        console.log('Deploying infrastructure components...');
        await deploymentManager.deployInfrastructure();
        
        // Step 4: Deploy verification keys
        console.log('Deploying verification keys...');
        
        const verificationKeySecret = process.env.VERIFICATION_KEY_SECRET;
        if (!verificationKeySecret && !dryRun) {
            throw new Error('Verification key secret is required for deployment');
        }
        
        await deploymentManager.deployVerificationKeys({
            secret: verificationKeySecret
        });
        
        // Step 5: Deploy smart contracts (if necessary)
        console.log('Deploying smart contracts...');
        const contractDeployment = await deploymentManager.deployContracts();
        
        if (contractDeployment.newDeployment) {
            console.log(`Deployed new contracts. Verifier address: ${contractDeployment.verifierAddress}`);
        } else {
            console.log(`Using existing contract deployment. Verifier address: ${contractDeployment.verifierAddress}`);
        }
        
        // Step 6: Update configuration with new contract addresses
        console.log('Updating configuration...');
        await deploymentManager.updateConfiguration({
            contracts: contractDeployment
        });
        
        // Step 7: Deploy application components
        console.log('Deploying application components...');
        await deploymentManager.deployApplication();
        
        // Step 8: Run health checks
        console.log('Running health checks...');
        const healthChecker = new HealthCheck({
            endpoints: config.healthCheck.endpoints,
            retries: config.healthCheck.retries,
            timeout: config.healthCheck.timeout
        });
        
        const healthStatus = await healthChecker.checkAll();
        
        if (!healthStatus.allHealthy) {
            throw new Error(`Health checks failed: ${JSON.stringify(healthStatus.failures)}`);
        }
        
        console.log('All health checks passed');
        
        // Step 9: Finalize deployment
        console.log('Finalizing deployment...');
        await deploymentManager.finalizeDeployment();
        
        console.log(`Deployment to ${environment} completed successfully`);
        
        // Save deployment record
        const deploymentRecord = {
            timestamp: new Date().toISOString(),
            environment,
            contracts: contractDeployment,
            health: healthStatus,
            status: 'success'
        };
        
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const recordPath = path.join(process.cwd(), 'deployments', `${environment}-${timestamp}.json`);
        
        fs.mkdirSync(path.dirname(recordPath), { recursive: true });
        fs.writeFileSync(recordPath, JSON.stringify(deploymentRecord, null, 2));
        
        console.log(`Deployment record saved to ${recordPath}`);
        
        return deploymentRecord;
    } catch (error) {
        console.error(`Deployment failed: ${error.message}`);
        
        // Log the error with the ZK error logger
        ZKErrorLogger.logError(error);
        
        // If not a dry run, attempt rollback
        if (!dryRun) {
            console.log('Attempting rollback...');
            
            try {
                await deploymentManager.rollback();
                console.log('Rollback completed');
            } catch (rollbackError) {
                console.error(`Rollback failed: ${rollbackError.message}`);
                ZKErrorLogger.logError(rollbackError);
            }
        }
        
        // Save failed deployment record
        const failedDeployment = {
            timestamp: new Date().toISOString(),
            environment,
            status: 'failed',
            error: {
                message: error.message,
                stack: error.stack
            }
        };
        
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const recordPath = path.join(process.cwd(), 'deployments', `${environment}-failed-${timestamp}.json`);
        
        fs.mkdirSync(path.dirname(recordPath), { recursive: true });
        fs.writeFileSync(recordPath, JSON.stringify(failedDeployment, null, 2));
        
        console.log(`Failed deployment record saved to ${recordPath}`);
        
        // Exit with error code
        process.exit(1);
    }
}

// Run the deployment
deploy().catch(error => {
    console.error(`Fatal error during deployment: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
});