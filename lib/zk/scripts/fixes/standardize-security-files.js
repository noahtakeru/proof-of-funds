#!/usr/bin/env node

/**
 * standardize-security-files.js - Security-related file standardizer
 * 
 * This script standardizes the security-related files based on the analysis
 * from check-security-files.js
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Calculate __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The base directory to search from
const BASE_DIR = path.resolve(__dirname, '../../src');

// Whether to perform changes or just simulate
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

// Regular expressions for pattern matching
const MODULE_PATTERNS = {
  // ESM patterns
  ESM_IMPORT: /import\s+(?:(?:\w+|\{[^}]+\})(?:\s*,\s*)?)?(?:\*\s+as\s+\w+)?(?:\s*,\s*)?(?:(?:\w+|\{[^}]+\})(?:\s*,\s*)?)?from\s+['"]([^'"]+)['"]/gm,
  ESM_EXPORT: /export\s+(?:default|const|function|class|var|let|async)/gm,
  ESM_EXPORT_FROM: /export\s+(?:\*|\{[^}]+\})\s+from/gm,
  
  // CommonJS patterns
  CJS_REQUIRE: /(?:const|let|var)\s+(\w+|\{[^}]+\})\s*=\s*require\(['"]([^'"]+)['"](?:\)\.([^;]+))?\)?;?/gm,
  CJS_EXPORTS: /(?:module\.)?exports(?:\.([^=\s]+))?\s*=\s*/gm,
  CJS_PROPERTY_EXPORTS: /exports\.([^=\s]+)\s*=\s*/gm,
  
  // Node.js global patterns
  DIRNAME: /__dirname/g,
  FILENAME: /__filename/g
};

// File list based on our analysis
const FILES_TO_STANDARDIZE = [
  // ESM files with incorrect extension (JS to MJS)
  { path: 'zkSecureInputs.cjs', action: 'convert-to-esm', newPath: 'zkSecureInputs.mjs' },
  
  // CommonJS files with incorrect extension (JS to CJS)
  { path: 'SecureKeyManager.js', action: 'convert-to-cjs', newPath: 'SecureKeyManager.cjs' },
  { path: 'TamperDetection.js', action: 'convert-to-cjs', newPath: 'TamperDetection.cjs' },
  { path: 'security/SecurityRuleRunner.js', action: 'convert-to-cjs', newPath: 'security/SecurityRuleRunner.cjs' },
  { path: 'security/detectors/AnomalyDetector.js', action: 'convert-to-cjs', newPath: 'security/detectors/AnomalyDetector.cjs' },
  { path: 'security/detectors/ImplementationVulnerabilityDetector.js', action: 'convert-to-cjs', newPath: 'security/detectors/ImplementationVulnerabilityDetector.cjs' },
  { path: 'security/detectors/SecurityDetectorFactory.js', action: 'convert-to-cjs', newPath: 'security/detectors/SecurityDetectorFactory.cjs' },
  { path: 'security/rules/CryptoVerificationRule.js', action: 'convert-to-cjs', newPath: 'security/rules/CryptoVerificationRule.cjs' },
  { path: 'security/rules/PrivilegeEscalationRule.js', action: 'convert-to-cjs', newPath: 'security/rules/PrivilegeEscalationRule.cjs' },
  { path: 'security/rules/SecurityRule.js', action: 'convert-to-cjs', newPath: 'security/rules/SecurityRule.cjs' },
  
  // Mixed/Dual format files with incorrect extension
  { path: 'zkProofSerializer.cjs', action: 'convert-to-js', newPath: 'zkProofSerializer.js' },
  
  // TypeScript files - leave as is
  { path: 'contracts/ZKVerifierContract.ts', action: 'leave-as-is' },
  { path: 'security/NonceValidator.ts', action: 'leave-as-is' },
  { path: 'security/RequestSignatureVerifier.ts', action: 'leave-as-is' },
  { path: 'security/SecurityTestRunner.ts', action: 'leave-as-is' },
  { path: 'security/SecurityTestSuite.ts', action: 'leave-as-is' },
  { path: 'security/ZKProofValidator.ts', action: 'leave-as-is' },
  { path: 'security/index.ts', action: 'leave-as-is' }
];

// Add .js extension to import paths if missing
function fixImportExtensions(content) {
  return content.replace(MODULE_PATTERNS.ESM_IMPORT, (match, importPath) => {
    // Only add .js to relative imports without extensions
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      if (!path.extname(importPath)) {
        return match.replace(`'${importPath}'`, `'${importPath}.js'`).replace(`"${importPath}"`, `"${importPath}.js"`);
      }
    }
    return match;
  });
}

// Convert CommonJS require() to ESM import
function convertRequireToImport(content) {
  return content.replace(MODULE_PATTERNS.CJS_REQUIRE, (match, importVar, importPath, property) => {
    // Handle property access from require()
    if (property) {
      return `import { ${property} } from '${importPath}';`;
    }
    
    // Handle destructuring
    if (importVar.includes('{')) {
      return `import ${importVar} from '${importPath}';`;
    }
    
    // Handle simple variable assignment
    return `import ${importVar} from '${importPath}';`;
  });
}

// Convert CommonJS exports to ESM exports
function convertExportsToESM(content) {
  // Replace module.exports = X with export default X
  content = content.replace(/module\.exports\s*=\s*/g, 'export default ');
  
  // Replace exports.X = Y with export const X = Y
  content = content.replace(/exports\.(\w+)\s*=\s*/g, 'export const $1 = ');
  
  return content;
}

// Convert ESM imports to CommonJS requires
function convertImportToRequire(content) {
  // Handle default imports: import X from 'Y' => const X = require('Y')
  content = content.replace(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g, "const $1 = require('$2')");
  
  // Handle named imports: import { X, Y } from 'Z' => const { X, Y } = require('Z')
  content = content.replace(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g, "const {$1} = require('$2')");
  
  // Handle namespace imports: import * as X from 'Y' => const X = require('Y')
  content = content.replace(/import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g, "const $1 = require('$2')");
  
  return content;
}

// Convert ESM exports to CommonJS exports
function convertESMToExports(content) {
  // Replace export default X with module.exports = X
  content = content.replace(/export\s+default\s+/g, 'module.exports = ');
  
  // Replace export const X = Y with exports.X = Y
  content = content.replace(/export\s+const\s+(\w+)\s*=/g, 'exports.$1 =');
  
  // Replace export function X with exports.X = function
  content = content.replace(/export\s+function\s+(\w+)/g, 'exports.$1 = function');
  
  // Replace export class X with exports.X = class
  content = content.replace(/export\s+class\s+(\w+)/g, 'exports.$1 = class');
  
  return content;
}

// Convert __dirname and __filename in ESM modules
function convertDirnameFilename(content) {
  let modified = content;
  
  // Check if import statements for url and path exist
  const hasUrlImport = /import.*fileURLToPath.*from\s+['"]url['"]/m.test(content);
  const hasPathImport = /import.*path.*from\s+['"]path['"]/m.test(content);
  
  // Check if dirname/filename polyfills exist
  const hasDirnamePolyfill = /const\s+__dirname\s*=\s*path\.dirname\(.*fileURLToPath\(import\.meta\.url\)\)/m.test(content);
  const hasFilenamePolyfill = /const\s+__filename\s*=\s*fileURLToPath\(import\.meta\.url\)/m.test(content);
  
  // If content uses __dirname or __filename but doesn't have polyfills
  if ((MODULE_PATTERNS.DIRNAME.test(content) || MODULE_PATTERNS.FILENAME.test(content)) && 
      (!hasDirnamePolyfill || !hasFilenamePolyfill)) {
    
    // Add imports if needed
    let importsToAdd = '';
    if (!hasUrlImport) {
      importsToAdd += "import { fileURLToPath } from 'url';\n";
    }
    if (!hasPathImport) {
      importsToAdd += "import path from 'path';\n";
    }
    
    // Add polyfill declarations if needed
    let polyfillsToAdd = '';
    if (!hasFilenamePolyfill && MODULE_PATTERNS.FILENAME.test(content)) {
      polyfillsToAdd += "const __filename = fileURLToPath(import.meta.url);\n";
    }
    if (!hasDirnamePolyfill && MODULE_PATTERNS.DIRNAME.test(content)) {
      polyfillsToAdd += "const __dirname = path.dirname(" + (hasFilenamePolyfill ? "__filename" : "fileURLToPath(import.meta.url)") + ");\n";
    }
    
    // Insert imports and polyfills after existing imports
    if (importsToAdd || polyfillsToAdd) {
      const lastImportMatch = content.match(/^import .+ from .+;(\r?\n|$)/gm);
      if (lastImportMatch) {
        const lastImport = lastImportMatch[lastImportMatch.length - 1];
        const lastImportIndex = content.lastIndexOf(lastImport) + lastImport.length;
        modified = content.substring(0, lastImportIndex) + 
                  (importsToAdd ? "\n" + importsToAdd : "") + 
                  (polyfillsToAdd ? "\n" + polyfillsToAdd : "") + 
                  content.substring(lastImportIndex);
      } else {
        // No imports found, insert at beginning of file after any comments/hashbangs
        const insertIndex = content.search(/^(?!#|\/\*|\/\/)/m);
        modified = content.substring(0, insertIndex) + 
                  importsToAdd + 
                  polyfillsToAdd + 
                  content.substring(insertIndex);
      }
    }
  }
  
  return modified;
}

// Update imports based on module format
function updateImports(content, moduleFormat) {
  let result = content;
  
  if (moduleFormat === 'ESM') {
    // For ESM files, fix import paths to include .js extension
    result = fixImportExtensions(result);
    // Convert CommonJS requires to ESM imports if needed
    result = convertRequireToImport(result);
  } else if (moduleFormat === 'CommonJS') {
    // For CommonJS files, convert any ESM imports to requires
    result = convertImportToRequire(result);
  } else if (moduleFormat === 'Mixed/Dual') {
    // For mixed format files, leave as is
  }
  
  return result;
}

// Update exports based on module format
function updateExports(content, moduleFormat) {
  let result = content;
  
  if (moduleFormat === 'ESM') {
    // For ESM files, convert any CommonJS exports to ESM
    result = convertExportsToESM(result);
  } else if (moduleFormat === 'CommonJS') {
    // For CommonJS files, convert any ESM exports to CommonJS
    result = convertESMToExports(result);
  } else if (moduleFormat === 'Mixed/Dual') {
    // For mixed format files, leave as is
  }
  
  return result;
}

// Fix a single file
async function fixFile(filePath, targetPath, moduleFormat) {
  try {
    const fullFilePath = path.join(BASE_DIR, filePath);
    const fullTargetPath = path.join(BASE_DIR, targetPath);
    
    // Check if file exists before trying to read it
    try {
      await fs.access(fullFilePath);
    } catch (e) {
      console.log(`Skipping ${filePath} (file not found)`);
      return { filePath, skipped: true };
    }
    
    const content = await fs.readFile(fullFilePath, 'utf8');
    
    // Make all necessary transformations
    let modified = content;
    
    // Update imports
    modified = updateImports(modified, moduleFormat);
    
    // Update exports
    modified = updateExports(modified, moduleFormat);
    
    // Convert __dirname and __filename for ESM if needed
    if (moduleFormat === 'ESM') {
      modified = convertDirnameFilename(modified);
    }
    
    // Check if anything changed
    const hasChanges = modified !== content;
    
    if (VERBOSE) {
      console.log(`${filePath} -> ${targetPath}: ${hasChanges ? 'Changes needed' : 'No changes needed'}`);
    }
    
    // Write changes if not in dry run mode
    if (hasChanges && !DRY_RUN) {
      await fs.writeFile(fullTargetPath, modified, 'utf8');
      console.log(`✓ Updated ${targetPath}`);
      
      // If file was renamed, delete the original
      if (filePath !== targetPath) {
        await fs.unlink(fullFilePath);
        console.log(`✓ Removed ${filePath}`);
      }
    } else if (filePath !== targetPath && !DRY_RUN) {
      // Just rename without modifying content
      await fs.copyFile(fullFilePath, fullTargetPath);
      await fs.unlink(fullFilePath);
      console.log(`✓ Renamed ${filePath} to ${targetPath}`);
    }
    
    return { filePath, targetPath, hasChanges };
  } catch (error) {
    console.error(`Error fixing file ${filePath}: ${error.message}`);
    return { filePath, error: error.message };
  }
}

// Main execution
async function main() {
  console.log(`Starting security files standardization${DRY_RUN ? ' (dry run)' : ''}...`);
  
  const results = {
    fixed: 0,
    unchanged: 0,
    errors: 0,
    details: []
  };
  
  for (const file of FILES_TO_STANDARDIZE) {
    if (file.action === 'leave-as-is') {
      console.log(`Skipping ${file.path} (leave as is)`);
      results.unchanged++;
      continue;
    }
    
    let moduleFormat;
    switch (file.action) {
      case 'convert-to-js':
        moduleFormat = 'Mixed/Dual';
        break;
      case 'convert-to-esm':
        moduleFormat = 'ESM';
        break;
      case 'convert-to-cjs':
        moduleFormat = 'CommonJS';
        break;
      default:
        moduleFormat = 'ESM';
    }
    
    const result = await fixFile(file.path, file.newPath || file.path, moduleFormat);
    
    results.details.push(result);
    if (result.error) {
      results.errors++;
    } else if (result.skipped) {
      results.unchanged++;
    } else if (result.hasChanges) {
      results.fixed++;
    } else {
      results.unchanged++;
    }
  }
  
  console.log('\nStandardization complete:');
  console.log(`✓ ${results.fixed} files fixed`);
  console.log(`○ ${results.unchanged} files unchanged`);
  console.log(`✗ ${results.errors} errors`);
}

main();