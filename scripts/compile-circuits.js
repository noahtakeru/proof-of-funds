/**
 * Circuit Compilation Script (Wrapper)
 * 
 * This script is a wrapper around the consolidated compile-circuits.sh script.
 * It maintains backward compatibility with existing code that uses this script.
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('Starting circuit compilation process (wrapper)...');

try {
  // Get the path to the shell script
  const scriptPath = path.join(__dirname, 'compile-circuits.sh');
  
  // Execute the shell script with local execution (no Docker)
  execSync(`bash ${scriptPath}`, {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });
  
  console.log('Circuit compilation completed successfully.');
} catch (error) {
  console.error('Error during circuit compilation:', error.message);
  process.exit(1);
}