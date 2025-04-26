/**
 * UI Module Standardizer
 * 
 * This script standardizes UI component module formats according to the
 * MODULE_STANDARDIZATION_PLAN.md requirements.
 * 
 * It handles:
 * 1. Renaming .js files with ESM syntax to .mjs
 * 2. Adding proper extensions to imports
 * 3. Fixing mixed module formats
 * 4. Preserving TypeScript React (.tsx) files
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import globPkg from 'glob';
import { promisify } from 'util';

// Use legacy API mode
const glob = promisify(globPkg);

// Convert ESM meta URL to __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execPromise = promisify(exec);

// Define file patterns
const UI_COMPONENTS_PATTERN = 'components/**/*.{js,jsx}';
const API_ROUTES_PATTERN = 'pages/api/**/*.js';
const PAGES_PATTERN = 'pages/**/*.js';
const EXCLUDE_PATTERNS = ['**/node_modules/**', '**/.next/**'];

// Regular expressions for detecting module formats
const ESM_IMPORT_REGEX = /import\s+.*\s+from\s+['"][^'"]+['"];|import\s+['"][^'"]+['"];|export\s+\{/;
const ESM_EXPORT_REGEX = /export\s+(default|const|let|var|function|class|async function)\s+/;
const CJS_REQUIRE_REGEX = /(?<!\/\/.*?)(?<!\/\*.*?)require\s*\(\s*['"][^'"]+['"]\s*\)/;
const CJS_EXPORTS_REGEX = /(?<!\/\/.*?)(?<!\/\*.*?)module\.exports\s*=|(?<!\/\/.*?)(?<!\/\*.*?)exports\.[a-zA-Z0-9_$]+\s*=/;
const MISSING_EXTENSION_REGEX = /from\s+['"](\.[^'"]+)(?<!\.js|\.mjs|\.cjs|\.jsx|\.tsx|\.ts)['"]|import\s+['"](\.[^'"]+)(?<!\.js|\.mjs|\.cjs|\.jsx|\.tsx|\.ts)['"];/g;

// Function to detect module format
function detectModuleFormat(content) {
  const hasESM = ESM_IMPORT_REGEX.test(content) || ESM_EXPORT_REGEX.test(content);
  const hasCJS = CJS_REQUIRE_REGEX.test(content) || CJS_EXPORTS_REGEX.test(content);

  if (hasESM && hasCJS) {
    return 'mixed';
  } else if (hasESM) {
    return 'esm';
  } else if (hasCJS) {
    return 'cjs';
  } else {
    return 'unknown';
  }
}

// Function to add extensions to imports
function addExtensionsToImports(content, defaultExtension = '.js') {
  return content.replace(MISSING_EXTENSION_REGEX, (match, g1, g2) => {
    const importPath = g1 || g2;
    return match.replace(importPath, `${importPath}${defaultExtension}`);
  });
}

// Function to standardize a file
async function standardizeFile(filePath) {
  console.log(`Standardizing file: ${filePath}`);
  const content = await fs.readFile(filePath, 'utf8');
  const format = detectModuleFormat(content);
  const fileExt = path.extname(filePath);
  const fileName = path.basename(filePath, fileExt);
  const dirName = path.dirname(filePath);
  
  let newContent = content;
  let newFilePath = filePath;
  
  // Handle standardization based on module format
  if (format === 'esm' && fileExt === '.js') {
    // Convert ESM file with .js extension to .mjs
    newFilePath = path.join(dirName, `${fileName}.mjs`);
    
    // Add proper extensions to imports
    newContent = addExtensionsToImports(content, '.mjs');
    
    // Write the file with new content and rename
    await fs.writeFile(newFilePath, newContent, 'utf8');
    await fs.unlink(filePath);
    console.log(`  Renamed ${filePath} to ${newFilePath} and fixed imports`);
    
    return {
      oldPath: filePath,
      newPath: newFilePath,
      changes: ['renamed', 'fixed-imports']
    };
  } else if (format === 'esm' && fileExt !== '.mjs') {
    // Just fix imports for ESM files that already have the correct extension
    newContent = addExtensionsToImports(content, '.mjs');
    
    if (newContent !== content) {
      await fs.writeFile(filePath, newContent, 'utf8');
      console.log(`  Fixed imports in ${filePath}`);
      return {
        oldPath: filePath,
        newPath: filePath,
        changes: ['fixed-imports']
      };
    }
  } else if (format === 'mixed') {
    // Handle mixed module format files
    // For the fullProve.js API endpoint, we need to maintain compatibility
    // So we'll convert require to dynamic import
    
    if (filePath.includes('pages/api/zk/fullProve.js')) {
      // Replace the static require with dynamic import
      newContent = content.replace(
        /analyticsClient = require\(['"]([^'"]+)['"]\);/g,
        'analyticsClient = await import(\'$1\').then(m => m.default);'
      );
      
      if (newContent !== content) {
        await fs.writeFile(filePath, newContent, 'utf8');
        console.log(`  Fixed mixed module format in ${filePath}`);
        return {
          oldPath: filePath,
          newPath: filePath,
          changes: ['fixed-mixed-format']
        };
      }
    }
  }
  
  return {
    oldPath: filePath,
    newPath: filePath,
    changes: []
  };
}

// Function to standardize all UI files
async function standardizeUIModules() {
  const componentFiles = await glob(UI_COMPONENTS_PATTERN, { ignore: EXCLUDE_PATTERNS });
  const apiFiles = await glob(API_ROUTES_PATTERN, { ignore: EXCLUDE_PATTERNS });
  const pageFiles = await glob(PAGES_PATTERN, { ignore: EXCLUDE_PATTERNS });
  
  const allFiles = [...componentFiles, ...apiFiles, ...pageFiles];
  
  console.log(`Found ${allFiles.length} files to process`);
  
  const results = {
    renamed: [],
    fixedImports: [],
    fixedMixedFormat: [],
    unchanged: [],
    errors: []
  };
  
  for (const file of allFiles) {
    try {
      const result = await standardizeFile(file);
      
      if (result.changes.includes('renamed')) {
        results.renamed.push({
          oldPath: result.oldPath,
          newPath: result.newPath
        });
      }
      
      if (result.changes.includes('fixed-imports')) {
        results.fixedImports.push(result.oldPath);
      }
      
      if (result.changes.includes('fixed-mixed-format')) {
        results.fixedMixedFormat.push(result.oldPath);
      }
      
      if (result.changes.length === 0) {
        results.unchanged.push(result.oldPath);
      }
    } catch (error) {
      console.error(`Error processing file ${file}:`, error);
      results.errors.push({
        file,
        error: error.message
      });
    }
  }
  
  // Generate a summary report
  const summary = {
    totalFiles: allFiles.length,
    renamed: results.renamed.length,
    fixedImports: results.fixedImports.length,
    fixedMixedFormat: results.fixedMixedFormat.length,
    unchanged: results.unchanged.length,
    errors: results.errors.length
  };
  
  console.log('\nStandardization Summary:');
  console.log(JSON.stringify(summary, null, 2));
  
  // Get the project root directory
  const projectRoot = path.resolve(__dirname, '../../../..');
  
  // Write detailed report to file
  const reportPath = path.join(projectRoot, 'lib/zk/docs/implementation', 'UI_MODULE_STANDARDIZATION_REPORT.md');
  
  let report = `# UI Module Standardization Report\n\n`;
  report += `Date: ${new Date().toISOString()}\n\n`;
  report += `## Summary\n\n`;
  report += `- Total files processed: ${summary.totalFiles}\n`;
  report += `- Files renamed (.js → .mjs): ${summary.renamed}\n`;
  report += `- Files with fixed imports: ${summary.fixedImports}\n`;
  report += `- Files with fixed mixed format: ${summary.fixedMixedFormat}\n`;
  report += `- Unchanged files: ${summary.unchanged}\n`;
  report += `- Errors: ${summary.errors}\n\n`;
  
  if (results.renamed.length > 0) {
    report += `## Renamed Files\n\n`;
    for (const item of results.renamed) {
      report += `- ${item.oldPath} → ${item.newPath}\n`;
    }
    report += `\n`;
  }
  
  if (results.fixedImports.length > 0) {
    report += `## Files with Fixed Imports\n\n`;
    for (const file of results.fixedImports) {
      report += `- ${file}\n`;
    }
    report += `\n`;
  }
  
  if (results.fixedMixedFormat.length > 0) {
    report += `## Files with Fixed Mixed Format\n\n`;
    for (const file of results.fixedMixedFormat) {
      report += `- ${file}\n`;
    }
    report += `\n`;
  }
  
  if (results.errors.length > 0) {
    report += `## Errors\n\n`;
    for (const item of results.errors) {
      report += `- ${item.file}: ${item.error}\n`;
    }
    report += `\n`;
  }
  
  await fs.writeFile(reportPath, report, 'utf8');
  console.log(`Detailed report written to: ${reportPath}`);
  
  return summary;
}

// Run the standardization
standardizeUIModules()
  .then((summary) => {
    console.log('UI Module standardization completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error during UI Module standardization:', error);
    process.exit(1);
  });