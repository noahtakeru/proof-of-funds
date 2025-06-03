#!/usr/bin/env node
/**
 * Script to convert ESM files to CommonJS format for dual module support
 * This creates .cjs versions of each .js file in the dist directory
 */

const fs = require('fs');
const path = require('path');

// Path to the common package dist directory
const distDir = path.resolve(__dirname, '../packages/common/dist');

/**
 * Converts ESM import/export syntax to CommonJS require/module.exports
 * @param {string} content - The file content to convert
 * @returns {string} - The converted content
 */
function convertToCommonJS(content) {
  // Replace export * from statements with require + Object.assign
  content = content.replace(/export \* from ['"](.+)['"]/g, 
    'Object.assign(exports, require(\'$1\'))');
  
  // Replace export const/let/var with exports.name = 
  content = content.replace(/export (const|let|var) (\w+)/g, 
    '$1 $2; exports.$2');
  
  // Replace export function with exports.function =
  content = content.replace(/export function (\w+)/g, 
    'function $1; exports.$1 = $1\nfunction $1');
  
  // Replace export default with module.exports =
  content = content.replace(/export default (\w+)/g, 
    'module.exports = $1');
  
  // Replace import statements with requires
  content = content.replace(/import (.+) from ['"](.+)['"]/g, (match, imports, path) => {
    // Handle different import patterns
    if (imports.includes('{') && imports.includes('}')) {
      // Named imports: import { a, b } from 'module'
      const names = imports.match(/{([^}]+)}/)[1].split(',').map(s => s.trim());
      
      const requires = names.map(name => {
        if (name.includes(' as ')) {
          const [orig, alias] = name.split(' as ').map(s => s.trim());
          return `const ${alias} = require('${path}').${orig};`;
        }
        return `const ${name} = require('${path}').${name};`;
      });
      
      return requires.join('\n');
    } else if (imports.includes('*')) {
      // Namespace imports: import * as name from 'module'
      const name = imports.match(/\* as (\w+)/)[1];
      return `const ${name} = require('${path}');`;
    } else {
      // Default import: import name from 'module'
      return `const ${imports} = require('${path}');`;
    }
  });
  
  // Add proper file extension for local requires
  content = content.replace(/require\(['"](\.[^'")]+)['"]\)/g, 'require(\'$1.cjs\')');
  
  return content;
}

/**
 * Converts all .js files in a directory to .cjs format
 * @param {string} dir - The directory to process
 */
function processDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      processDirectory(fullPath);
    } else if (entry.name.endsWith('.js') && !entry.name.endsWith('.d.js')) {
      try {
        // Skip any non-js files or existing .cjs files
        if (!entry.name.endsWith('.js') || entry.name.endsWith('.cjs')) {
          continue;
        }
        
        const content = fs.readFileSync(fullPath, 'utf8');
        const cjsContent = convertToCommonJS(content);
        const cjsPath = fullPath.replace('.js', '.cjs');
        
        fs.writeFileSync(cjsPath, cjsContent);
        console.log(`Created CommonJS version: ${cjsPath}`);
      } catch (error) {
        console.error(`Error processing ${fullPath}:`, error);
      }
    }
  }
}

// Start processing
console.log('Converting ESM modules to CommonJS format...');
processDirectory(distDir);
console.log('Conversion complete!');