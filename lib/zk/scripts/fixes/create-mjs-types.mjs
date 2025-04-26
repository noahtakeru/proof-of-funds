/**
 * MJS Type Declaration Creator
 * 
 * This script creates .d.ts files for .mjs modules to help TypeScript
 * recognize them correctly.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import glob from 'glob';
import { promisify } from 'util';

// Set up helpers
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const globPromise = promisify(glob);

// Function to create a type declaration file for an MJS module
async function createTypeDeclaration(mjsFilePath) {
  console.log(`Creating type declaration for: ${mjsFilePath}`);
  
  try {
    const dtsFilePath = mjsFilePath.replace('.mjs', '.d.mts');
    
    // Check if the file already exists
    try {
      await fs.access(dtsFilePath);
      console.log(`  Type declaration already exists: ${dtsFilePath}`);
      return {
        file: mjsFilePath,
        created: false,
        skipped: true
      };
    } catch (err) {
      // File doesn't exist, continue
    }
    
    // Create a basic re-export declaration file
    const content = `// Type declaration for ${path.basename(mjsFilePath)}
// This file was auto-generated to help TypeScript recognize .mjs modules

export * from './${path.basename(mjsFilePath, '.mjs')}';
`;
    
    await fs.writeFile(dtsFilePath, content, 'utf8');
    console.log(`  Created type declaration: ${dtsFilePath}`);
    
    return {
      file: mjsFilePath,
      created: true
    };
  } catch (error) {
    console.error(`Error creating type declaration for ${mjsFilePath}:`, error);
    return {
      file: mjsFilePath,
      created: false,
      error: error.message
    };
  }
}

// Main function to create type declarations for all MJS files
async function createMJSTypeDeclarations() {
  // Find all MJS files in the project
  const mjsFiles = await globPromise('lib/zk/src/**/*.mjs');
  
  console.log(`Found ${mjsFiles.length} MJS files that need type declarations`);
  
  const results = {
    created: [],
    skipped: [],
    errors: []
  };
  
  // Process each file
  for (const file of mjsFiles) {
    const result = await createTypeDeclaration(file);
    
    if (result.error) {
      results.errors.push({
        file: result.file,
        error: result.error
      });
    } else if (result.skipped) {
      results.skipped.push(result.file);
    } else if (result.created) {
      results.created.push(result.file);
    }
  }
  
  // Generate a summary report
  const summary = {
    totalFiles: mjsFiles.length,
    created: results.created.length,
    skipped: results.skipped.length,
    errors: results.errors.length
  };
  
  console.log('\nType Declaration Creation Summary:');
  console.log(JSON.stringify(summary, null, 2));
  
  // Get the project root directory
  const projectRoot = path.resolve(__dirname, '../../../..');
  
  // Write detailed report to file
  const reportPath = path.join(projectRoot, 'lib/zk/docs/implementation', 'MJS_TYPE_DECLARATIONS_REPORT.md');
  
  let report = `# MJS Type Declarations Report\n\n`;
  report += `Date: ${new Date().toISOString()}\n\n`;
  report += `## Summary\n\n`;
  report += `- Total MJS files processed: ${summary.totalFiles}\n`;
  report += `- Type declarations created: ${summary.created}\n`;
  report += `- Type declarations skipped (already exist): ${summary.skipped}\n`;
  report += `- Errors: ${summary.errors}\n\n`;
  
  if (results.created.length > 0) {
    report += `## Created Type Declarations\n\n`;
    for (const file of results.created) {
      report += `- ${file} → ${file.replace('.mjs', '.d.mts')}\n`;
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

// Run the type declaration creator
createMJSTypeDeclarations()
  .then((summary) => {
    console.log('MJS type declaration creation completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error during MJS type declaration creation:', error);
    process.exit(1);
  });