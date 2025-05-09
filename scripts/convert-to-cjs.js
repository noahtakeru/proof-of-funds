/**
 * Module Conversion Script
 * 
 * This script converts ES Modules to CommonJS format for dual-package support.
 * It recursively processes all JavaScript files in the dist directory,
 * creating .cjs versions with proper CommonJS syntax.
 */

const fs = require('fs');
const path = require('path');

// Base directory containing the compiled ESM files
const DIST_DIR = path.resolve(__dirname, '../packages/common/dist');

// Convert ES Module syntax to CommonJS
function convertToCommonJS(content) {
  // Replace import statements with require
  content = content.replace(/import\s+(\{[\s\w,]+\})\s+from\s+['"]([^'"]+)['"]/g, (match, imports, source) => {
    return `const ${imports} = require('${source}')`;
  });

  // Replace default imports
  content = content.replace(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g, (match, importName, source) => {
    return `const ${importName} = require('${source}')`;
  });

  // Replace export * from statements
  content = content.replace(/export\s+\*\s+from\s+['"]([^'"]+)['"]/g, (match, source) => {
    return `Object.assign(exports, require('${source}'))`;
  });

  // Replace named exports
  content = content.replace(/export\s+(\{[\s\w,]+\})/g, (match, exports) => {
    return `module.exports = ${exports}`;
  });

  // Replace default exports
  content = content.replace(/export\s+default\s+/g, 'module.exports = ');

  // Replace const exports
  content = content.replace(/export\s+const\s+(\w+)/g, 'const $1 = exports.$1');

  return content;
}

// Process a file
function processFile(filePath) {
  // Skip non-JS files
  if (!filePath.endsWith('.js')) {
    return;
  }

  // Skip already converted CJS files
  if (filePath.endsWith('.cjs')) {
    return;
  }

  try {
    // Read original file
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Convert to CommonJS
    const cjsContent = convertToCommonJS(content);
    
    // Write to .cjs file
    const cjsFilePath = filePath.replace(/\.js$/, '.cjs');
    fs.writeFileSync(cjsFilePath, cjsContent);
    
    console.log(`Converted: ${path.relative(DIST_DIR, filePath)} -> ${path.relative(DIST_DIR, cjsFilePath)}`);
  } catch (err) {
    console.error(`Error processing ${filePath}:`, err);
  }
}

// Process a directory recursively
function processDirectory(dirPath) {
  // Read directory contents
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    
    if (entry.isDirectory()) {
      // Recursively process subdirectories
      processDirectory(fullPath);
    } else {
      // Process files
      processFile(fullPath);
    }
  }
}

// Make sure dist directory exists
if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
  console.log(`Created directory: ${DIST_DIR}`);
}

// Ensure we also have subdirectories for modules
const requiredDirs = ['zk-core', 'error-handling', 'system', 'config', 'utils', 'resources'];
for (const dir of requiredDirs) {
  const dirPath = path.join(DIST_DIR, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

// Start conversion process
console.log('Starting ESM to CommonJS conversion...');
processDirectory(DIST_DIR);
console.log('Conversion complete!');