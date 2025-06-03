/**
 * Module Format Converter
 * 
 * This script converts between ESM and CommonJS module formats.
 * It helps with compatibility between different environments.
 */

const fs = require('fs');
const path = require('path');

// Define conversion rules
const ESM_TO_CJS = {
  search: [
    /export\s+default\s+(\w+);?/g,
    /export\s+{([^}]+)};?/g,
    /import\s+(\w+)\s+from\s+['"]([^'"]+)['"];?/g
  ],
  replace: [
    'module.exports = $1;',
    function(match, exports) {
      // Handle named exports
      const parsed = exports.split(',').map(e => e.trim());
      return parsed.reduce((acc, exp) => {
        // Check for 'as' syntax
        const parts = exp.split(' as ').map(p => p.trim());
        if (parts.length > 1) {
          return `${acc}module.exports.${parts[1]} = ${parts[0]};\n`;
        }
        return `${acc}module.exports.${exp} = ${exp};\n`;
      }, '');
    },
    'const $1 = require("$2");'
  ]
};

const CJS_TO_ESM = {
  search: [
    /module\.exports\s+=\s+{([^}]+)};?/g,
    /module\.exports\s+=\s+(\w+);?/g,
    /module\.exports\.(\w+)\s+=\s+([^;]+);?/g,
    /const\s+(\w+)\s+=\s+require\(['"]([^'"]+)['"]\);?/g
  ],
  replace: [
    function(match, exports) {
      // Handle object exports
      const parsed = exports.split(',').map(e => e.trim());
      const namedExports = parsed.map(p => {
        const parts = p.split(':').map(part => part.trim());
        if (parts.length > 1) {
          return `${parts[0]} as ${parts[1]}`;
        }
        return p;
      }).join(', ');
      return `export { ${namedExports} };`;
    },
    'export default $1;',
    'export const $1 = $2;',
    'import $1 from "$2";'
  ]
};

/**
 * Convert file from one module format to another
 * @param {string} inputPath - Path to input file
 * @param {string} outputPath - Path to output file
 * @param {string} format - Target format: 'cjs' or 'esm'
 */
function convertFile(inputPath, outputPath, format) {
  // Read the file
  let content = fs.readFileSync(inputPath, 'utf8');
  
  // Choose conversion rules based on target format
  const rules = format === 'cjs' ? ESM_TO_CJS : CJS_TO_ESM;
  
  // Apply conversion rules
  rules.search.forEach((pattern, index) => {
    const replacement = rules.replace[index];
    if (typeof replacement === 'function') {
      content = content.replace(pattern, replacement);
    } else {
      content = content.replace(pattern, replacement);
    }
  });
  
  // Write the converted file
  fs.writeFileSync(outputPath, content, 'utf8');
  
  console.log(`Converted ${inputPath} to ${format.toUpperCase()} format at ${outputPath}`);
}

// Parse command-line arguments
function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log('Usage: node convert-module-format.js <input-file> <output-file> <format>');
    console.log('Format can be "cjs" or "esm"');
    process.exit(1);
  }
  
  const [inputPath, outputPath, format] = args;
  
  if (format !== 'cjs' && format !== 'esm') {
    console.log('Format must be "cjs" or "esm"');
    process.exit(1);
  }
  
  convertFile(inputPath, outputPath, format);
}

// Run the script
main();