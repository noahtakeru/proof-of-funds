/**
 * Week 14.5 Documentation and Deployment Pipeline Tests
 * 
 * This test file validates that the Week 14.5 implementation tasks have been
 * properly completed, including documentation, deployment pipeline, and staged rollout.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Color codes for console output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

// Test results tracking
const results = {
    documentation: {
        userGuide: false,
        securityDoc: false,
        apiDocs: false
    },
    deploymentPipeline: {
        githubActions: false,
        dockerConfig: false,
        kubernetes: false
    },
    stagedRollout: {
        deployScript: false
    }
};

let totalTests = 0;
let passedTests = 0;

/**
 * Run a test and update the results
 */
function runTest(name, testFn) {
    totalTests++;
    process.stdout.write(`${BLUE}Testing ${name}... ${RESET}`);

    try {
        const result = testFn();
        if (result === true) {
            passedTests++;
            console.log(`${GREEN}PASS${RESET}`);
            return true;
        } else {
            console.log(`${RED}FAIL${RESET} - ${result || 'Test failed without details'}`);
            return false;
        }
    } catch (error) {
        console.log(`${RED}ERROR${RESET} - ${error.message}`);
        return false;
    }
}

/**
 * Check if file exists and contains required content
 */
function checkFileContent(filePath, requiredContent) {
    if (!fs.existsSync(filePath)) {
        return `File not found: ${filePath}`;
    }

    const content = fs.readFileSync(filePath, 'utf8');

    for (const item of requiredContent) {
        if (!content.includes(item)) {
            return `File ${filePath} does not contain required content: ${item}`;
        }
    }

    return true;
}

// Base directory for project
const baseDir = path.resolve(__dirname, '../../../../..');

// Documentation Tests
console.log(`\n${YELLOW}Testing Documentation Implementation${RESET}`);

results.documentation.userGuide = runTest('User Guide Documentation', () => {
    return checkFileContent(
        path.join(baseDir, 'lib/zk/docs/developer/USER_GUIDE.md'),
        [
            'Step-by-Step Guides',
            'Troubleshooting',
            'Common Issues and Solutions'
        ]
    );
});

results.documentation.securityDoc = runTest('Security Documentation', () => {
    return checkFileContent(
        path.join(baseDir, 'lib/zk/docs/developer/SECURITY.md'),
        [
            'Defense-in-Depth Approach',
            'Cryptographic Foundations',
            'Security Incident Response'
        ]
    );
});

results.documentation.apiDocs = runTest('API Documentation', () => {
    // Either API.md or similar should exist with reference documentation
    const apiDocsPath = path.join(baseDir, 'lib/zk/docs/developer/API.md');
    const apiRefPath = path.join(baseDir, 'lib/zk/docs/developer/API_REFERENCE.md');

    if (fs.existsSync(apiDocsPath)) {
        return checkFileContent(apiDocsPath, ['zkUtils', 'Parameters', 'Returns']);
    } else if (fs.existsSync(apiRefPath)) {
        return checkFileContent(apiRefPath, ['zkUtils', 'Parameters', 'Returns']);
    } else {
        // Check if API docs are included in another file
        const userGuidePath = path.join(baseDir, 'lib/zk/docs/developer/USER_GUIDE.md');
        if (fs.existsSync(userGuidePath)) {
            const content = fs.readFileSync(userGuidePath, 'utf8');
            if (content.includes('generateZKProof') && content.includes('verifyZKProof')) {
                return true;
            }
        }
        return 'API documentation not found';
    }
});

// Deployment Pipeline Tests
console.log(`\n${YELLOW}Testing Deployment Pipeline Implementation${RESET}`);

results.deploymentPipeline.githubActions = runTest('GitHub Actions CI/CD', () => {
    return checkFileContent(
        path.join(baseDir, 'lib/zk/deployment/github-actions-ci.yml'),
        [
            'workflow_dispatch',
            'runs-on',
            'environment:',
            'deploy-',
            'if:'
        ]
    );
});

results.deploymentPipeline.dockerConfig = runTest('Docker Configuration', () => {
    const dockerfilePath = path.join(baseDir, 'lib/zk/deployment/Dockerfile');
    const dockerComposePath = path.join(baseDir, 'lib/zk/deployment/docker-compose.yml');

    const dockerfileResult = checkFileContent(dockerfilePath, [
        'FROM',
        'WORKDIR',
        'COPY',
        'RUN',
        'EXPOSE'
    ]);

    if (dockerfileResult !== true) {
        return dockerfileResult;
    }

    const composeResult = checkFileContent(dockerComposePath, [
        'services:',
        'volumes:',
        'networks:',
        'environment:'
    ]);

    if (composeResult !== true) {
        return composeResult;
    }

    return true;
});

results.deploymentPipeline.kubernetes = runTest('Kubernetes Configuration', () => {
    const k8sDeployPath = path.join(baseDir, 'lib/zk/deployment/kubernetes/zk-deployment.yaml');
    const k8sServicePath = path.join(baseDir, 'lib/zk/deployment/kubernetes/zk-services.yaml');

    const deployResult = checkFileContent(k8sDeployPath, [
        'kind: Deployment',
        'replicas:',
        'containers:',
        'resources:',
        'livenessProbe:'
    ]);

    if (deployResult !== true) {
        return deployResult;
    }

    const serviceResult = checkFileContent(k8sServicePath, [
        'kind: Service',
        'selector:',
        'ports:',
        'targetPort:'
    ]);

    if (serviceResult !== true) {
        return serviceResult;
    }

    return true;
});

// Staged Rollout Tests
console.log(`\n${YELLOW}Testing Staged Rollout Implementation${RESET}`);

results.stagedRollout.deployScript = runTest('Deployment Script', () => {
    const deployScriptPath = path.join(baseDir, 'lib/zk/deployment/deploy.sh');

    return checkFileContent(deployScriptPath, [
        '#!/bin',
        'ENVIRONMENT',
        'docker',
        'up',
        'down'
    ]);
});

// Check if DeploymentManager or similar class is implemented
runTest('Deployment Manager Implementation', () => {
    const deployManagerPath = path.join(baseDir, 'lib/zk/src/deployment/DeploymentManager.ts');

    if (fs.existsSync(deployManagerPath)) {
        return checkFileContent(deployManagerPath, [
            'class',
            'deploy',
            'environment',
            'rollback'
        ]);
    } else {
        // Check other possible implementation files
        const files = [
            'deployment/DeploymentService.ts',
            'deployment/Deployer.ts',
            'deployment/ReleaseManager.ts'
        ];

        for (const file of files) {
            const filePath = path.join(baseDir, 'lib/zk/src', file);
            if (fs.existsSync(filePath)) {
                const result = checkFileContent(filePath, ['class', 'deploy', 'environment']);
                if (result === true) {
                    return true;
                }
            }
        }

        return 'No deployment manager implementation found';
    }
});

// Print Test Summary
console.log(`\n${BLUE}Week 14.5 Implementation Test Summary${RESET}`);
console.log(`${BLUE}======================================${RESET}`);

console.log(`\n${YELLOW}Documentation:${RESET}`);
console.log(`User Guide: ${results.documentation.userGuide === true ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`}`);
console.log(`Security Architecture: ${results.documentation.securityDoc === true ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`}`);
console.log(`API Documentation: ${results.documentation.apiDocs === true ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`}`);

console.log(`\n${YELLOW}Deployment Pipeline:${RESET}`);
console.log(`GitHub Actions CI/CD: ${results.deploymentPipeline.githubActions === true ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`}`);
console.log(`Docker Configuration: ${results.deploymentPipeline.dockerConfig === true ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`}`);
console.log(`Kubernetes Configuration: ${results.deploymentPipeline.kubernetes === true ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`}`);

console.log(`\n${YELLOW}Staged Rollout:${RESET}`);
console.log(`Deployment Script: ${results.stagedRollout.deployScript === true ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`}`);

console.log(`\n${BLUE}Total: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)${RESET}`);

// Determine exit code based on passed tests
process.exit(passedTests === totalTests ? 0 : 1); 