/**
 * Check for common frontend errors
 */

const fs = require('fs');
const path = require('path');

console.log('===== Checking Frontend for Common Errors =====\n');

// Check create.js file
const createPath = path.join(__dirname, '..', 'packages', 'frontend', 'pages', 'create.js');
const createContent = fs.readFileSync(createPath, 'utf8');

// Check for loadAssets function definition
if (createContent.includes('const loadAssets = useCallback')) {
  console.log('✅ loadAssets is properly defined as useCallback');
} else if (createContent.includes('function loadAssets')) {
  console.log('⚠️  loadAssets is defined as regular function');
} else {
  console.log('❌ loadAssets is not defined');
}

// Check for useCallback import
if (createContent.includes('useCallback')) {
  console.log('✅ useCallback is imported');
} else {
  console.log('❌ useCallback is not imported');
}

// Check for duplicate loadAssets definitions
const loadAssetsMatches = createContent.match(/loadAssets.*=/g);
if (loadAssetsMatches) {
  console.log(`\nFound ${loadAssetsMatches.length} loadAssets definitions:`);
  loadAssetsMatches.forEach((match, i) => {
    console.log(`  ${i + 1}. ${match}`);
  });
}

// Check button onClick handler
const buttonMatches = createContent.match(/await loadAssets\(true\)/g);
if (buttonMatches) {
  console.log(`\n✅ Found ${buttonMatches.length} button(s) calling loadAssets`);
} else {
  console.log('\n❌ No buttons found calling loadAssets');
}

console.log('\n===== Check Complete =====');