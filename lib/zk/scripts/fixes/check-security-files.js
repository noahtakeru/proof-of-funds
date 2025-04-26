#!/usr/bin/env node

/**
 * check-security-files.js - Security-related file analyzer
 * 
 * This script analyzes security-related files to help understand their module formats
 * and prepare for standardization.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Calculate __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The base directory to search from
const BASE_DIR = path.resolve(__dirname, '../../src');
const SECURITY_DIR = path.resolve(BASE_DIR, 'security');

const SECURITY_PATTERNS = [
  /security/i,
  /SecurityAudit/i,
  /Nonce/i,
  /Signature/i,
  /Validator/i,
  /Verifier/i,
  /Tamper/i,
  /Secure/i,
  /RBAC/i,
  /^ZKProof/i
];

// Check if a filename or path matches security patterns
function isSecurityRelated(filename, filePath) {
  if (filePath && filePath.includes('/security/')) {
    return true;
  }
  return SECURITY_PATTERNS.some(pattern => pattern.test(filename));
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

// Main function to traverse directory and find security-related files
async function findSecurityFiles(dir, results = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip node_modules and other common directories to ignore
      if (!['node_modules', '.git', 'build', 'dist'].includes(entry.name)) {
        await findSecurityFiles(fullPath, results);
      }
    } else if (entry.isFile() && /\.(js|mjs|cjs|ts)$/.test(entry.name)) {
      if (isSecurityRelated(entry.name, fullPath)) {
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
  console.log('Analyzing security-related files...');
  try {
    const files = await findSecurityFiles(BASE_DIR);
    
    console.log('\nSecurity-related files found:');
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
        const relativePath = path.relative(BASE_DIR, file.path);
        console.log(`${relativePath} [${file.currentExt} => ${file.recommendedExt}]${file.needsStandardization ? ' *NEEDS UPDATE*' : ''}`);
      });
    }
    
    // Display standardization summary
    const needStandardization = files.filter(f => f.needsStandardization);
    console.log('\nStandardization Summary:');
    console.log('=======================================');
    console.log(`Total security-related files: ${files.length}`);
    console.log(`Files needing standardization: ${needStandardization.length}`);
    
  } catch (error) {
    console.error(`Error analyzing files: ${error.message}`);
    process.exit(1);
  }
}

main();