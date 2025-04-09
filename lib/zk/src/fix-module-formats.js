/**
 * ESM Module Format Standardizer
 * 
 * This script converts the codebase to use ESM format consistently,
 * and creates necessary CJS compatibility layers for backwards compatibility.
 * The approach is "ESM-first" - we standardize on ESM and provide CJS support.
 * 
 * ---------- NON-TECHNICAL EXPLANATION ----------
 * This tool standardizes our code to use modern JavaScript formats (ESM) while
 * maintaining compatibility with older JavaScript systems (CommonJS).
 * Rather than having dual-format modules, we have a clean ESM implementation 
 * and generate CommonJS compatibility versions when needed.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Get proper file paths in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Primary files to standardize to ESM format
const filesToStandardize = [
  './src/zkProofSerializer.js',
  './src/zkErrorHandler.js',
  './src/zkErrorLogger.js',
  './src/zkCircuitRegistry.js',
  './src/zkCircuitParameterDerivation.js',
  './src/zkSecureInputs.js',
  './src/zkRecoverySystem.js',
  './src/zkCircuitInputs.js',
  './src/index.js'
];

/**
 * Convert a file from CommonJS to ESM format
 * @param {string} filePath - Path to the file to convert
 * @param {boolean} renameFile - Whether to rename the file to .mjs
 * @returns {boolean} Whether the conversion was successful
 */
function convertToESM(filePath, renameFile = true) {
  // Resolve the full path
  const fullPath = path.resolve(projectRoot, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${filePath}`);
    return false;
  }
  
  console.log(`Converting to ESM: ${filePath}`);
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Replace CommonJS imports with ESM imports
  content = content.replace(/const\s+([^=]+)\s*=\s*require\(['"]([^'"]+)['"]\);/g, 
    (match, importName, importPath) => {
      // Check if it's an internal import that needs .js extension
      if (importPath.startsWith('./') || importPath.startsWith('../')) {
        // Add .js extension if it's not there and doesn't have another extension
        if (!importPath.includes('.js') && !importPath.includes('.mjs') && !importPath.includes('.cjs')) {
          importPath += '.js';
        }
      }
      return `import ${importName} from '${importPath}';`;
    });
  
  // Replace named exports (exports.X = Y)
  content = content.replace(/exports\.(\w+)\s*=\s*([^;]+);/g, 
    (match, exportName, exportValue) => {
      return `export const ${exportName} = ${exportValue};`;
    });
  
  // Replace full module.exports with export default
  content = content.replace(/module\.exports\s*=\s*([^;]+);/g, 
    (match, exportValue) => {
      return `export default ${exportValue};`;
    });
  
  // Write the updated content
  fs.writeFileSync(fullPath, content);
  
  // Rename to .mjs if needed
  if (renameFile && !filePath.endsWith('.mjs') && filePath.endsWith('.js')) {
    const newPath = fullPath.replace(/\.js$/, '.mjs');
    fs.renameSync(fullPath, newPath);
    console.log(`Renamed to: ${path.basename(newPath)}`);
  }
  
  return true;
}

// Process each file to convert to ESM
filesToStandardize.forEach(filePath => {
  convertToESM(filePath);
});

/**
 * Function to build CommonJS compatibility versions using rollup
 */
function buildCJSCompatibilityVersions() {
  console.log('Building CommonJS compatibility versions...');
  try {
    // Run rollup to build CJS versions of our ESM modules
    execSync('npx rollup -c', { cwd: projectRoot, stdio: 'inherit' });
    console.log('Successfully built CJS compatibility modules');
    return true;
  } catch (error) {
    console.error('Error building CJS compatibility versions:', error.message);
    return false;
  }
}

/**
 * Update import paths in modules to use .mjs extensions
 * @param {string} directory - Directory to scan
 */
function updateImportPaths(directory = path.join(projectRoot, 'src')) {
  const files = fs.readdirSync(directory);
  
  files.forEach(file => {
    const fullPath = path.join(directory, file);
    
    // Skip if it's a directory
    if (fs.statSync(fullPath).isDirectory()) {
      return;
    }
    
    // Only process .mjs files
    if (!file.endsWith('.mjs')) {
      return;
    }
    
    console.log(`Updating import paths in: ${file}`);
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Update import paths to use .mjs
    content = content.replace(/import\s+(?:[\w\s{}*,]+\s+from\s+)?['"]([^'"]+)\.js['"]/g, 
      (match, importPath) => {
        return match.replace('.js', '.mjs');
      });
    
    fs.writeFileSync(fullPath, content);
  });
}

// Main function to run the standardization process
function standardizeModules() {
  console.log('Starting module format standardization...');
  
  // 1. Convert files to ESM format
  filesToStandardize.forEach(filePath => {
    convertToESM(filePath);
  });
  
  // 2. Update import paths to use .mjs extension
  updateImportPaths();
  
  // 3. Build CommonJS compatibility versions
  buildCJSCompatibilityVersions();
  
  console.log('Module format standardization complete!');
}

// Run the standardization if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  standardizeModules();
}

// Export functions for programmatic use
export {
  convertToESM,
  updateImportPaths,
  buildCJSCompatibilityVersions,
  standardizeModules
};

// Default export for compatibility
export default {
  convertToESM, 
  updateImportPaths,
  buildCJSCompatibilityVersions,
  standardizeModules
};