/**
 * @fileoverview Week 12.5 Regression Tests for Performance Optimization & User Guidance
 * 
 * Tests the implementations of the Week 12.5 components:
 * - MemoryEfficientCache
 * - DynamicLoadDistribution
 * - UserGuidanceSystem
 */

const fs = require('fs');
const path = require('path');
const util = require('util');
const childProcess = require('child_process');
const exec = util.promisify(childProcess.exec);

// Paths to test
const PROJECT_ROOT = process.cwd(); // Should be the project root when called from run-regression-tests.sh
const LIB_ZK_DIR = path.join(PROJECT_ROOT, 'lib', 'zk');
const SOURCE_DIR = path.join(LIB_ZK_DIR, 'src');
const TEST_DIR = path.join(LIB_ZK_DIR, 'tests');

// Components to check
const COMPONENTS = {
    MemoryEfficientCache: {
        src: ['lib/zk/src/cache/MemoryEfficientCache.mjs'],
        tests: ['lib/zk/tests/performance/MemoryEfficientCacheTest.js'],
        requiredMethods: [
            'set', 'get', 'has', 'delete', 'getOrCompute', 'clear', 
            'keys', 'size', 'warmCache', 'prune', 'invalidateVersion',
            'getStats', 'getMemoryUsage', 'dispose', 'evictEntries'
        ]
    },
    DynamicLoadDistribution: {
        src: ['lib/zk/src/performance/DynamicLoadDistribution.ts'],
        tests: ['lib/zk/tests/performance/DynamicLoadDistributionTest.js'],
        requiredMethods: [
            'initialize', 'executeTask', 'getMetrics', 'resetMetrics', 
            'setStrategy', 'dispose'
        ]
    },
    UserGuidanceSystem: {
        src: ['lib/zk/src/guidance/UserGuidanceSystem.ts'],
        tests: ['lib/zk/tests/guidance/UserGuidanceSystemTest.js'],
        requiredMethods: [
            'showGuidance', 'dismissGuidance', 'registerGuidanceStep',
            'trackUserProgress', 'getRecommendedPath'
        ]
    }
};

// Test results
const testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    components: {}
};

// Helper function to check if a file exists
function fileExists(filePath) {
    try {
        return fs.existsSync(filePath);
    } catch (error) {
        return false;
    }
}

// Helper function to check if directory exists
function directoryExists(dirPath) {
    try {
        return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
    } catch (error) {
        return false;
    }
}

// Helper function to check if a file contains required methods
async function fileContainsRequiredMethods(filePath, methods) {
    try {
        if (!fileExists(filePath)) {
            return { found: false, message: `File does not exist: ${filePath}` };
        }

        const content = fs.readFileSync(filePath, 'utf8');
        const missingMethods = [];

        for (const method of methods) {
            // Advanced regex to catch different method definition styles
            // This handles: regular methods, class methods, arrow functions, and exported functions
            const patterns = [
                new RegExp(`(async\\s+)?${method}\\s*\\(`, 'g'),               // Regular method
                new RegExp(`function\\s+${method}\\s*\\(`, 'g'),               // Regular function
                new RegExp(`const\\s+${method}\\s*=`, 'g'),                    // Const assignment
                new RegExp(`let\\s+${method}\\s*=`, 'g'),                      // Let assignment
                new RegExp(`var\\s+${method}\\s*=`, 'g'),                      // Var assignment
                new RegExp(`export\\s+(const|let|var|function|class)\\s+${method}`, 'g'), // Export
                new RegExp(`export\\s*{[^}]*\\b${method}\\b[^}]*}`, 'g'),       // Named export
                new RegExp(`\\b${method}\\s*:\\s*(async\\s+)?function`, 'g'),     // Object method
                new RegExp(`\\b${method}\\s*:\\s*\\(`, 'g')                     // Object method shorthand
            ];
            
            const methodFound = patterns.some(pattern => pattern.test(content));
            if (!methodFound) {
                missingMethods.push(method);
            }
        }

        if (missingMethods.length > 0) {
            return {
                found: false,
                message: `Missing required methods: ${missingMethods.join(', ')}`
            };
        }

        return { found: true, message: `All required methods found` };
    } catch (error) {
        return {
            found: false,
            message: `Error checking methods in ${filePath}: ${error.message}`
        };
    }
}

// Helper function to run tests
async function runTests(testCommand) {
    try {
        const { stdout, stderr } = await exec(testCommand);
        
        // Check if the output explicitly states all tests passed
        // The test files should output "All X tests passed!" when successful
        const isSuccess = stdout.includes('All') && 
                         stdout.includes('tests passed!') && 
                         !stdout.includes('Some tests failed');
                         
        return { success: isSuccess, output: stdout };
    } catch (error) {
        return { success: false, output: error.stdout || error.message };
    }
}

// Main test function
async function runWeek125Tests(specificComponent = null) {
    if (specificComponent) {
        console.log(`Testing ${specificComponent} component for Week 12.5`);
    } else {
        console.log('Starting Week 12.5 Performance Optimization & User Guidance Tests\n');
    }

    // Check that source and test directories exist
    if (!directoryExists(LIB_ZK_DIR)) {
        console.error(`ERROR: lib/zk directory not found at ${LIB_ZK_DIR}`);
        return { success: false, message: 'lib/zk directory not found' };
    }

    if (!directoryExists(SOURCE_DIR)) {
        console.error(`ERROR: src directory not found at ${SOURCE_DIR}`);
        return { success: false, message: 'src directory not found' };
    }

    if (!directoryExists(TEST_DIR)) {
        console.error(`ERROR: tests directory not found at ${TEST_DIR}`);
        return { success: false, message: 'tests directory not found' };
    }

    // Filter components if a specific one is requested
    const componentsToTest = specificComponent
        ? { [specificComponent]: COMPONENTS[specificComponent] }
        : COMPONENTS;

    // Test each component
    for (const [componentName, component] of Object.entries(componentsToTest)) {
        if (!component) {
            console.error(`ERROR: Component ${componentName} not found`);
            return { success: false, message: `Component ${componentName} not found` };
        }

        testResults.components[componentName] = {
            fileExists: true,
            methodsImplemented: true,
            testsPassing: true,
            details: []
        };

        console.log(`\nTesting ${componentName}...`);
        testResults.total++;

        // Check source files exist
        let allSourceFilesExist = true;
        for (const srcFile of component.src) {
            const srcPath = path.join(PROJECT_ROOT, srcFile);
            const exists = fileExists(srcPath);

            if (!exists) {
                allSourceFilesExist = false;
                testResults.components[componentName].fileExists = false;
                testResults.components[componentName].details.push(`Source file missing: ${srcFile}`);
                console.log(`❌ Source file missing: ${srcFile}`);
            } else {
                console.log(`✅ Source file exists: ${srcFile}`);

                // Check if the file contains required methods
                const methodsResult = await fileContainsRequiredMethods(
                    srcPath,
                    component.requiredMethods
                );

                if (!methodsResult.found) {
                    testResults.components[componentName].methodsImplemented = false;
                    testResults.components[componentName].details.push(methodsResult.message);
                    console.log(`❌ ${methodsResult.message}`);
                } else {
                    console.log(`✅ ${methodsResult.message}`);
                }
            }
        }

        // Check test files exist and run them if they do
        let allTestsExist = true;
        for (const testFile of component.tests) {
            const testPath = path.join(PROJECT_ROOT, testFile);
            const exists = fileExists(testPath);

            if (!exists) {
                allTestsExist = false;
                testResults.components[componentName].testsPassing = false;
                testResults.components[componentName].details.push(`Test file missing: ${testFile}`);
                console.log(`❌ Test file missing: ${testFile}`);
            } else {
                console.log(`✅ Test file exists: ${testFile}`);

                // Run tests for the component
                console.log(`Running tests for ${componentName}...`);
                
                const testResult = await runTests(
                    `cd ${PROJECT_ROOT} && node --experimental-vm-modules ${testPath}`
                );

                if (testResult.success) {
                    console.log(`✅ Tests passed for ${componentName}`);
                } else {
                    testResults.components[componentName].testsPassing = false;
                    testResults.components[componentName].details.push(
                        `Tests failed for ${componentName}`
                    );
                    console.log(`❌ Tests failed for ${componentName}`);
                    console.log(testResult.output);
                }
            }
        }

        // Component passes if all checks pass
        const componentPassed =
            testResults.components[componentName].fileExists &&
            testResults.components[componentName].methodsImplemented &&
            testResults.components[componentName].testsPassing;

        if (componentPassed) {
            testResults.passed++;
            console.log(`✅ ${componentName} tests passed`);
        } else {
            testResults.failed++;
            console.log(`❌ ${componentName} tests failed`);
        }
    }

    // Print summary
    console.log('\n===== Week 12.5 Test Summary =====');
    console.log(`Total Components: ${testResults.total}`);
    console.log(`Passed: ${testResults.passed}`);
    console.log(`Failed: ${testResults.failed}`);
    console.log('===============================\n');

    // Return test results
    return {
        success: testResults.failed === 0,
        message: `Week 12.5 Tests: ${testResults.passed}/${testResults.total} passed`,
        details: testResults
    };
}

// Run the tests if called directly
if (require.main === module) {
    // Check if a specific component was specified
    const specificComponent = process.argv[2];

    runWeek125Tests(specificComponent).then(result => {
        if (result.success) {
            console.log(`✅ ${result.message}`);
            process.exit(0);
        } else {
            console.error(`❌ ${result.message}`);
            process.exit(1);
        }
    }).catch(error => {
        console.error('Error running Week 12.5 tests:', error);
        process.exit(1);
    });
}

// Export functions for use in other scripts
module.exports = {
    runWeek125Tests
}; 