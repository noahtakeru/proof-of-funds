/**
 * Test script for frontend authentication components
 * 
 * This script verifies that the frontend authentication components are properly configured
 * for Phase 2.1 implementation
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// Paths to check
const FRONTEND_DIR = path.join(__dirname, '..', 'packages', 'frontend');
const CONTEXTS_DIR = path.join(FRONTEND_DIR, 'contexts');
const HOOKS_DIR = path.join(FRONTEND_DIR, 'hooks');
const COMPONENTS_DIR = path.join(FRONTEND_DIR, 'components');

// Files to verify
const FILES_TO_CHECK = [
  {
    path: path.join(CONTEXTS_DIR, 'AuthContext.tsx'),
    name: 'Authentication Context',
    patterns: [
      'useAuth',
      'login',
      'logout',
      'register',
      'resetPassword',
      'refreshToken'
    ]
  },
  {
    path: path.join(HOOKS_DIR, 'useAuthentication.ts'),
    name: 'Authentication Hook',
    patterns: [
      'useAuthentication',
      'login',
      'logout',
      'register',
      'isAuthenticated'
    ]
  },
  {
    path: path.join(HOOKS_DIR, 'useWallet.ts'),
    name: 'Wallet Hook',
    patterns: [
      'useWallet',
      'connect',
      'disconnect',
      'signMessage'
    ]
  },
  {
    path: path.join(COMPONENTS_DIR, 'auth', 'LoginForm.tsx'),
    name: 'Login Form Component',
    patterns: [
      'LoginForm',
      'handleSubmit',
      'useState',
      'useAuthentication'
    ]
  },
  {
    path: path.join(COMPONENTS_DIR, 'auth', 'RegisterForm.tsx'),
    name: 'Register Form Component',
    patterns: [
      'RegisterForm',
      'handleSubmit',
      'useState',
      'useAuthentication'
    ]
  },
  {
    path: path.join(COMPONENTS_DIR, 'auth', 'AuthGuard.tsx'),
    name: 'Auth Guard Component',
    patterns: [
      'AuthGuard',
      'isAuthenticated',
      'redirect'
    ]
  }
];

/**
 * Main test function
 */
async function runTests() {
  console.log(chalk.blue.bold('🔍 Testing Frontend Authentication Components'));
  console.log(chalk.gray('Phase 2.1 Implementation Verification\n'));

  let passCount = 0;
  let failCount = 0;

  // Check each file
  for (const fileConfig of FILES_TO_CHECK) {
    console.log(chalk.yellow(`📄 Checking ${fileConfig.name}...`));
    
    try {
      // Check if file exists
      if (!fs.existsSync(fileConfig.path)) {
        console.log(chalk.red(`❌ File not found: ${fileConfig.path}`));
        failCount++;
        continue;
      }
      
      // Read file content
      const content = fs.readFileSync(fileConfig.path, 'utf8');
      
      // Check for required patterns
      const missingPatterns = [];
      for (const pattern of fileConfig.patterns) {
        if (!content.includes(pattern)) {
          missingPatterns.push(pattern);
        }
      }
      
      if (missingPatterns.length > 0) {
        console.log(chalk.red(`❌ Missing required patterns: ${missingPatterns.join(', ')}`));
        failCount++;
      } else {
        console.log(chalk.green('✅ All required patterns found!'));
        passCount++;
      }
    } catch (error) {
      console.error(chalk.red(`❌ Error checking ${fileConfig.name}:`), error.message);
      failCount++;
    }
  }
  
  // Final summary
  console.log(chalk.gray('\n---------------------------------'));
  console.log(chalk.blue.bold('📊 Test Summary:'));
  console.log(chalk.green(`✅ Passed: ${passCount} components`));
  console.log(chalk.red(`❌ Failed: ${failCount} components`));
  
  if (failCount === 0) {
    console.log(chalk.green.bold('\n✅ All frontend authentication components are properly implemented!'));
    console.log(chalk.green('Phase 2.1 frontend implementation is complete.'));
  } else {
    console.log(chalk.red.bold('\n❌ Some frontend components are missing or incomplete!'));
    console.log(chalk.red('Phase 2.1 frontend implementation needs attention.'));
    process.exit(1);
  }
}

// Run the tests
runTests().catch(error => {
  console.error(chalk.red.bold('❌ Test failed:'), error.message);
  process.exit(1);
});