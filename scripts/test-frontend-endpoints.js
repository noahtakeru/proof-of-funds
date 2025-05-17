/**
 * Test frontend API endpoints
 */

const fs = require('fs');
const path = require('path');

function checkEndpoints() {
  console.log('===== Checking Frontend Endpoints =====\n');
  
  const frontendDir = path.join(__dirname, '..', 'packages', 'frontend');
  const files = [
    'pages/create.js',
    'pages/verify.js',
    'pages/api/zk/generateProof.js',
    'pages/api/zk/generateProofSecure.js'
  ];
  
  let needsUpdate = false;
  
  files.forEach(file => {
    const fullPath = path.join(frontendDir, file);
    if (fs.existsSync(fullPath)) {
      console.log(`✅ Found: ${file}`);
      
      // Check if file contains old endpoint
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('/api/zk/generateProof') && !file.includes('generateProof.js')) {
        console.log(`  ⚠️  Contains old endpoint - needs update to use generateProofSecure`);
        needsUpdate = true;
      }
    } else {
      console.log(`❌ Missing: ${file}`);
    }
  });
  
  console.log('\n===== Summary =====');
  if (needsUpdate) {
    console.log('⚠️  Some files need to be updated to use the secure endpoint');
    console.log('Replace: /api/zk/generateProof');
    console.log('With: /api/zk/generateProofSecure');
  } else {
    console.log('✅ All files are using the correct endpoints');
  }
  
  // Check for public zkey files
  console.log('\n===== Checking Public ZKey Files =====');
  const publicZkeyDir = path.join(frontendDir, 'public', 'lib', 'zk', 'circuits');
  
  if (fs.existsSync(publicZkeyDir)) {
    const zkeyFiles = fs.readdirSync(publicZkeyDir).filter(f => f.endsWith('.zkey'));
    
    if (zkeyFiles.length > 0) {
      console.log(`⚠️  Found ${zkeyFiles.length} public zkey files that should be removed:`);
      zkeyFiles.forEach(f => console.log(`  - ${f}`));
      console.log('\nRun: rm packages/frontend/public/lib/zk/circuits/*.zkey');
    } else {
      console.log('✅ No public zkey files found');
    }
  }
}

checkEndpoints();