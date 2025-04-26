#!/usr/bin/env node

/**
 * check-api-files.js - API-related file analyzer
 * 
 * This script analyzes API-related files to help understand their module formats
 * and prepare for standardization.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Calculate __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The base directory to search from
const PROJECT_ROOT = path.resolve(__dirname, '../../../../');
const API_DIR = path.resolve(PROJECT_ROOT, 'pages/api');
const ZK_API_DIR = path.resolve(API_DIR, 'zk');
const ZK_DIR = path.resolve(PROJECT_ROOT, 'lib/zk/src');

const API_PATTERNS = [
  /api/i,
  /endpoint/i,
  /fullProve/i,
  /verify/i,
  /zkProxy/i,
  /verificationKey/i,
  /status/i
];

// Check if a filename or path matches API patterns
function isApiRelated(filename, filePath) {
  if (filePath && (filePath.includes('/api/') || filePath.includes('/pages/api/'))) {
    return true;
  }
  return API_PATTERNS.some(pattern => pattern.test(filename));
}

// Detect module format by scanning file content
async function detectModuleFormat(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    
    const hasEsmImport = /^\s*import\s+.+\s+from\s+/m.test(content);
    const hasEsmExport = /^\s*export\s+(default|const|let|var|function|class)/m.test(content);
    const hasCommonJsRequire = /^\s*(const|let|var)\s+.+\s*=\s*require\(/m.test(content);
    const hasCommonJsExports = /^\s*(module\.)?exports\s*=/m.test(content);
    
    if ((hasEsmImport || hasEsmExport) && (hasCommonJsRequire || hasCommonJsExports)) {
      return 'Mixed/Dual';
    } else if (hasEsmImport || hasEsmExport) {
      return 'ESM';
    } else if (hasCommonJsRequire || hasCommonJsExports) {
      return 'CommonJS';
    } else {
      return 'Unknown';
    }
  } catch (error) {
    console.error(`Error reading file ${filePath}: ${error.message}`);
    return 'Error';
  }
}

// Get the recommended extension based on module format and current extension
function getRecommendedExtension(filePath, moduleFormat) {
  const ext = path.extname(filePath);
  const basename = path.basename(filePath, ext);
  
  if (moduleFormat === 'ESM') {
    return ext === '.mjs' ? ext : '.mjs';
  } else if (moduleFormat === 'CommonJS') {
    return ext === '.cjs' ? ext : '.cjs';
  } else if (moduleFormat === 'Mixed/Dual') {
    return '.js';
  } else {
    return ext;
  }
}

// Main function to find API-related files
async function findApiFiles(results = []) {
  // First check the API directory
  try {
    const apiEntries = await fs.readdir(API_DIR, { withFileTypes: true });
    
    for (const entry of apiEntries) {
      const fullPath = path.join(API_DIR, entry.name);
      
      if (entry.isFile() && /\.(js|mjs|cjs|ts)$/.test(entry.name)) {
        const moduleFormat = await detectModuleFormat(fullPath);
        const recommendedExt = getRecommendedExtension(fullPath, moduleFormat);
        const currentExt = path.extname(fullPath);
        const needsStandardization = recommendedExt !== currentExt;
        
        results.push({
          path: fullPath,
          filename: entry.name,
          moduleFormat,
          currentExt,
          recommendedExt,
          needsStandardization
        });
      } else if (entry.isDirectory()) {
        // If it's a subdirectory, like 'zk', process its files
        const subdirPath = path.join(API_DIR, entry.name);
        const subdirEntries = await fs.readdir(subdirPath, { withFileTypes: true });
        
        for (const subdirEntry of subdirEntries) {
          if (subdirEntry.isFile() && /\.(js|mjs|cjs|ts)$/.test(subdirEntry.name)) {
            const fullSubdirPath = path.join(subdirPath, subdirEntry.name);
            const moduleFormat = await detectModuleFormat(fullSubdirPath);
            const recommendedExt = getRecommendedExtension(fullSubdirPath, moduleFormat);
            const currentExt = path.extname(fullSubdirPath);
            const needsStandardization = recommendedExt !== currentExt;
            
            results.push({
              path: fullSubdirPath,
              filename: subdirEntry.name,
              moduleFormat,
              currentExt,
              recommendedExt,
              needsStandardization
            });
          }
        }
      }
    }
  } catch (error) {
    console.warn(`Could not read API directory: ${error.message}`);
  }
  
  // Then look for API-related files in the ZK directory
  try {
    await searchDirectory(ZK_DIR, results);
  } catch (error) {
    console.warn(`Error searching ZK directory: ${error.message}`);
  }
  
  return results;
}

// Helper function to search directories recursively
async function searchDirectory(dir, results = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip node_modules and other common directories to ignore
      if (!['node_modules', '.git', 'build', 'dist'].includes(entry.name)) {
        await searchDirectory(fullPath, results);
      }
    } else if (entry.isFile() && /\.(js|mjs|cjs|ts)$/.test(entry.name)) {
      if (isApiRelated(entry.name, fullPath)) {
        const moduleFormat = await detectModuleFormat(fullPath);
        const recommendedExt = getRecommendedExtension(fullPath, moduleFormat);
        const currentExt = path.extname(fullPath);
        const needsStandardization = recommendedExt !== currentExt;
        
        results.push({
          path: fullPath,
          filename: entry.name,
          moduleFormat,
          currentExt,
          recommendedExt,
          needsStandardization
        });
      }
    }
  }
  
  return results;
}

// Main script execution
async function main() {
  console.log('Analyzing API-related files...');
  try {
    const files = await findApiFiles();
    
    console.log('\nAPI-related files found:');
    console.log('=======================================');
    
    // Group files by their module format
    const byFormat = {};
    files.forEach(file => {
      if (!byFormat[file.moduleFormat]) {
        byFormat[file.moduleFormat] = [];
      }
      byFormat[file.moduleFormat].push(file);
    });
    
    // Display summary by format
    for (const [format, formatFiles] of Object.entries(byFormat)) {
      console.log(`\n${format} Format (${formatFiles.length} files):`);
      console.log('---------------------------------------');
      
      formatFiles.forEach(file => {
        const relativePath = path.relative(PROJECT_ROOT, file.path);
        console.log(`${relativePath} [${file.currentExt} => ${file.recommendedExt}]${file.needsStandardization ? ' *NEEDS UPDATE*' : ''}`);
      });
    }
    
    // Display standardization summary
    const needStandardization = files.filter(f => f.needsStandardization);
    console.log('\nStandardization Summary:');
    console.log('=======================================');
    console.log(`Total API-related files: ${files.length}`);
    console.log(`Files needing standardization: ${needStandardization.length}`);
    
  } catch (error) {
    console.error(`Error analyzing files: ${error.message}`);
    process.exit(1);
  }
}

main();