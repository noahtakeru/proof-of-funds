/**
 * TypeScript Import Fixer
 * 
 * This script fixes imports in TypeScript files to correctly reference .mjs files
 * after our module standardization process.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import glob from 'glob';
import { promisify } from 'util';

// Set up helpers
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execPromise = promisify(exec);
const globPromise = promisify(glob);

// Regex pattern to match imports of MJS files (to revert them back to .js)
const MJS_IMPORT_REGEX = /from\s+['"]([^'"]+)\.mjs['"]|import\s+['"]([^'"]+)\.mjs['"]|require\s*\(\s*['"]([^'"]+)\.mjs['"]\s*\)/g;

// Function to fix imports in a file
async function fixImports(filePath) {
  console.log(`Fixing imports in: ${filePath}`);
  
  try {
    const content = await fs.readFile(filePath, 'utf8');
    
    // Replace .mjs with .js in imports (TypeScript prefers .js for type checking)
    const newContent = content.replace(MJS_IMPORT_REGEX, (match, g1, g2, g3) => {
      const importPath = g1 || g2 || g3;
      return match.replace(`${importPath}.mjs`, `${importPath}.js`);
    });
    
    if (content !== newContent) {
      await fs.writeFile(filePath, newContent, 'utf8');
      console.log(`  Updated imports in ${filePath}`);
      return {
        file: filePath,
        updated: true
      };
    } else {
      console.log(`  No updates needed in ${filePath}`);
      return {
        file: filePath,
        updated: false
      };
    }
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    return {
      file: filePath,
      updated: false,
      error: error.message
    };
  }
}

// Main function to fix imports in all TS files
async function fixTypeScriptImports() {
  // Find all TypeScript files in the project
  const tsFiles = await globPromise('lib/zk/src/**/*.ts');
  
  console.log(`Found ${tsFiles.length} TypeScript files to process`);
  
  const results = {
    updated: [],
    unchanged: [],
    errors: []
  };
  
  // Process each file
  for (const file of tsFiles) {
    const result = await fixImports(file);
    
    if (result.error) {
      results.errors.push(result);
    } else if (result.updated) {
      results.updated.push(result.file);
    } else {
      results.unchanged.push(result.file);
    }
  }
  
  // Generate a summary report
  const summary = {
    totalFiles: tsFiles.length,
    updated: results.updated.length,
    unchanged: results.unchanged.length,
    errors: results.errors.length
  };
  
  console.log('\nImport Fix Summary:');
  console.log(JSON.stringify(summary, null, 2));
  
  // Get the project root directory
  const projectRoot = path.resolve(__dirname, '../../../..');
  
  // Write detailed report to file
  const reportPath = path.join(projectRoot, 'lib/zk/docs/implementation', 'TS_IMPORT_FIX_REPORT.md');
  
  let report = `# TypeScript Import Fix Report\n\n`;
  report += `Date: ${new Date().toISOString()}\n\n`;
  report += `## Summary\n\n`;
  report += `- Total files processed: ${summary.totalFiles}\n`;
  report += `- Files with updated imports: ${summary.updated}\n`;
  report += `- Unchanged files: ${summary.unchanged}\n`;
  report += `- Errors: ${summary.errors}\n\n`;
  
  if (results.updated.length > 0) {
    report += `## Updated Files\n\n`;
    for (const file of results.updated) {
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

// Run the import fixer
fixTypeScriptImports()
  .then((summary) => {
    console.log('TypeScript import fixing completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error during TypeScript import fixing:', error);
    process.exit(1);
  });