const fs = require('fs');
const path = require('path');

const searchAddress = '0x5F4123Bc2359338194d9379306acB3E25fbc53c9';

// Check common locations for addresses
const filesToCheck = [
  'pages/api/zk/submitProof.js',
  'pages/create.js',
  'lib/generateTempWallet.js',
  '.env',
  '.env.local'
];

console.log(`Searching for address: ${searchAddress}\n`);

filesToCheck.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.toLowerCase().includes(searchAddress.toLowerCase())) {
      console.log(`Found in ${file}`);
      // Show context
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (line.toLowerCase().includes(searchAddress.toLowerCase())) {
          console.log(`  Line ${index + 1}: ${line.trim()}`);
        }
      });
    }
  }
});

// Check for any similar patterns in the stdout
const stdout = `
 POST /api/zk/submitProof 500 in 11452ms
Funded temp wallet with 0.05 MATIC
ZK_VERIFIER_ADDRESS: 0x9E98DdFD14e47295a9e900a3dF332EcF6a9587B5
Error submitting proof: Error: insufficient funds for intrinsic transaction cost
`;

if (stdout.includes(searchAddress)) {
  console.log('\nFound in recent stdout output');
}