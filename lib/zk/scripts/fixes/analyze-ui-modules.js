/**
 * UI Module Analysis Script
 * 
 * This script analyzes React UI components and related files to determine 
 * module format issues and prepare for standardization.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../../../');

// Define directories to search
const UI_DIRECTORIES = [
  path.join(PROJECT_ROOT, 'components'),
  path.join(PROJECT_ROOT, 'pages')
];

// Define patterns to identify module formats
const ESM_IMPORT_PATTERN = /^\s*import\s+.+\s+from\s+/m;
const ESM_EXPORT_PATTERN = /^\s*export\s+(default|const|let|var|function|class)/m;
const CJS_REQUIRE_PATTERN = /^\s*(const|let|var)\s+.+\s*=\s*require\(/m;
const CJS_EXPORTS_PATTERN = /^\s*(module\.)?exports\s*=/m;
const DIRNAME_FILENAME_PATTERN = /\b(__dirname|__filename)\b/;
const RELATIVE_IMPORT_WITHOUT_EXT = /^\s*import\s+.+\s+from\s+['"](\.[^'"]+)['"](?!\.[a-zA-Z0-9]+['"])/m;

// Track issues found
const issues = {
  mixedModules: [],
  missingExtensions: [],
  dirnameInEsm: [],
  wrongExtension: [],
  tsxFiles: []
};

// Track module types
const moduleTypes = {
  esm: [],
  cjs: [],
  mixed: [],
  unknown: [],
  tsx: []
};

/**
 * Detect the module format of a file
 */
async function detectModuleFormat(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    
    // Check for TypeScript React files
    if (filePath.endsWith('.tsx')) {
      moduleTypes.tsx.push(filePath);
      issues.tsxFiles.push(filePath);
      return 'TSX';
    }
    
    const hasEsmImport = ESM_IMPORT_PATTERN.test(content);
    const hasEsmExport = ESM_EXPORT_PATTERN.test(content);
    const hasCommonJsRequire = CJS_REQUIRE_PATTERN.test(content);
    const hasCommonJsExports = CJS_EXPORTS_PATTERN.test(content);
    const hasDirnameOrFilename = DIRNAME_FILENAME_PATTERN.test(content);
    const hasMissingExt = RELATIVE_IMPORT_WITHOUT_EXT.test(content);
    
    let format;
    if ((hasEsmImport || hasEsmExport) && (hasCommonJsRequire || hasCommonJsExports)) {
      format = 'Mixed/Dual';
      moduleTypes.mixed.push(filePath);
      issues.mixedModules.push(filePath);
    } else if (hasEsmImport || hasEsmExport) {
      format = 'ESM';
      moduleTypes.esm.push(filePath);
      
      // Check for __dirname or __filename in ESM
      if (hasDirnameOrFilename) {
        issues.dirnameInEsm.push(filePath);
      }
      
      // Check for missing extensions in imports
      if (hasMissingExt) {
        issues.missingExtensions.push(filePath);
      }
      
      // Check for wrong extension
      if (filePath.endsWith('.js') && !filePath.includes('pages/_app.js') && !filePath.includes('pages/api/')) {
        issues.wrongExtension.push(filePath);
      }
    } else if (hasCommonJsRequire || hasCommonJsExports) {
      format = 'CommonJS';
      moduleTypes.cjs.push(filePath);
      
      // Check for wrong extension
      if (filePath.endsWith('.js') && !filePath.includes('pages/_app.js') && !filePath.includes('pages/api/')) {
        issues.wrongExtension.push(filePath);
      }
    } else {
      format = 'Unknown';
      moduleTypes.unknown.push(filePath);
    }
    
    return format;
  } catch (error) {
    console.error(`Error reading file ${filePath}: ${error.message}`);
    return 'Error';
  }
}

/**
 * Process a directory recursively
 */
async function processDirectory(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        await processDirectory(fullPath);
      } else if (
        entry.name.endsWith('.js') || 
        entry.name.endsWith('.jsx') || 
        entry.name.endsWith('.ts') || 
        entry.name.endsWith('.tsx') ||
        entry.name.endsWith('.mjs') ||
        entry.name.endsWith('.cjs')
      ) {
        const format = await detectModuleFormat(fullPath);
        console.log(`${fullPath}: ${format}`);
      }
    }
  } catch (error) {
    console.error(`Error processing directory ${dirPath}: ${error.message}`);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('UI Module Analysis Starting...\n');
  
  for (const dir of UI_DIRECTORIES) {
    console.log(`Processing directory: ${dir}`);
    await processDirectory(dir);
  }
  
  console.log('\n=== Analysis Summary ===\n');
  console.log(`ESM Modules: ${moduleTypes.esm.length}`);
  console.log(`CommonJS Modules: ${moduleTypes.cjs.length}`);
  console.log(`Mixed/Dual Format Modules: ${moduleTypes.mixed.length}`);
  console.log(`Unknown Format Modules: ${moduleTypes.unknown.length}`);
  console.log(`TypeScript React (.tsx) Modules: ${moduleTypes.tsx.length}`);
  
  console.log('\n=== Issues Found ===\n');
  console.log(`Mixed Module Formats: ${issues.mixedModules.length}`);
  console.log(`Missing Extensions in Imports: ${issues.missingExtensions.length}`);
  console.log(`__dirname/__filename in ESM: ${issues.dirnameInEsm.length}`);
  console.log(`Wrong File Extensions: ${issues.wrongExtension.length}`);
  
  // Save detailed report to file
  const reportData = {
    moduleTypes,
    issues,
    timestamp: new Date().toISOString()
  };
  
  await fs.writeFile(
    path.join(__dirname, 'ui-module-analysis.json'),
    JSON.stringify(reportData, null, 2)
  );
  
  console.log('\nDetailed report saved to: ui-module-analysis.json');
}

// Run the main function
main().catch(console.error);