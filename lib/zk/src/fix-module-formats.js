/**
 * Fix Module Formats
 * 
 * This script fixes module format issues by making key files compatible with both
 * CommonJS and ESM formats. Run this before running regression tests.
 */

const fs = require('fs');
const path = require('path');

// Files to fix
const files = [
  './lib/zk/SecureKeyManager.js',
  './lib/zk/TamperDetection.js',
  './lib/zk/TrustedSetupManager.js',
  './lib/zk/browserCompatibility.js'
];

// Process each file
files.forEach(filePath => {
  const fullPath = path.resolve(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }
  
  console.log(`Processing: ${filePath}`);
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Check if it contains ES module export
  if (content.includes('export default')) {
    // Get the class/object name
    const match = content.match(/export default (\w+)/);
    if (match && match[1]) {
      const exportedName = match[1];
      console.log(`Found ES module export for: ${exportedName}`);
      
      // Replace the export with dual-format export
      const newExport = `// Handle both CommonJS and ESM exports
if (typeof module !== 'undefined' && module.exports) {
  // CommonJS
  module.exports = ${exportedName};
} else {
  // ESM
  export default ${exportedName};
}`;
      
      // Replace the export statement
      content = content.replace(/export default \w+[;\s]*/, newExport);
      
      // Write the updated content
      fs.writeFileSync(fullPath, content);
      console.log(`Updated: ${filePath}`);
    } else {
      console.log(`Could not find export name in: ${filePath}`);
    }
  } else {
    console.log(`No ES module export found in: ${filePath}`);
  }
});

// Fix regression test script to handle ESM imports properly
const regressionTestPath = path.resolve(process.cwd(), './lib/zk/run-regression-tests.sh');
if (fs.existsSync(regressionTestPath)) {
  console.log('Fixing regression test script...');
  let content = fs.readFileSync(regressionTestPath, 'utf8');
  
  // Fix import statements for ESM modules
  const replacements = [
    {
      search: /node --input-type=module -e "import '.\/lib\/zk\/__tests__\/ceremony\/test-ceremony.js'"/,
      replace: 'NODE_OPTIONS="--experimental-modules --es-module-specifier-resolution=node" node --input-type=module -e "import(\'.\/lib\/zk\/__tests__\/ceremony\/test-ceremony.js\').catch(e => { console.error(e); process.exit(1); })"'
    },
    {
      search: /node --input-type=module -e "import '.\/lib\/zk\/__tests__\/browser-compatibility-test.js'"/,
      replace: 'NODE_OPTIONS="--experimental-modules --es-module-specifier-resolution=node" node --input-type=module -e "import(\'.\/lib\/zk\/__tests__\/browser-compatibility-test.js\').catch(e => { console.error(e); process.exit(1); })"'
    }
  ];
  
  replacements.forEach(({ search, replace }) => {
    content = content.replace(search, replace);
  });
  
  fs.writeFileSync(regressionTestPath, content);
  console.log('Updated regression test script');
}

console.log('Module format fixing complete.');