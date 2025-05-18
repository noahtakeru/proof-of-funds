# Browser Setup Guide for ZK Proof Generation

This guide explains how to set up the browser environment for generating Zero-Knowledge (ZK) proofs in the Proof of Funds application.

## Overview

The Proof of Funds application supports generating ZK proofs in both server-side and browser environments. This flexibility allows for:

1. Better user privacy (proofs are generated locally in the browser)
2. Reduced server load (computation happens on client devices)
3. Improved scalability (no rate limits for local proof generation)

## Required Files

For browser-based proof generation, the following files must be present in the public directory:

```
/public/lib/zk/circuits/
├── standardProof.wasm
├── standardProof.zkey
├── standardProof.vkey.json
├── maximumProof.wasm
├── maximumProof.zkey
├── maximumProof.vkey.json
├── thresholdProof.wasm
├── thresholdProof.zkey
└── thresholdProof.vkey.json
```

## Setup Instructions

### 1. Copy Circuit Files

Copy the necessary circuit files from the circuits directory to the public directory:

```bash
# Create the target directory
mkdir -p packages/frontend/public/lib/zk/circuits

# Copy WASM files
cp circuits/standard/standardProof_js/standardProof.wasm packages/frontend/public/lib/zk/circuits/
cp circuits/maximum/maximumProof_js/maximumProof.wasm packages/frontend/public/lib/zk/circuits/
cp circuits/threshold/thresholdProof_js/thresholdProof.wasm packages/frontend/public/lib/zk/circuits/

# Copy ZKey files
cp circuits/standard/standardProof.zkey packages/frontend/public/lib/zk/circuits/
cp circuits/maximum/maximumProof.zkey packages/frontend/public/lib/zk/circuits/
cp circuits/threshold/thresholdProof.zkey packages/frontend/public/lib/zk/circuits/

# Copy verification key files (if they exist)
cp circuits/standard/standardProof.vkey.json packages/frontend/public/lib/zk/circuits/ 2>/dev/null || echo "Standard vkey not found"
cp circuits/maximum/maximumProof.vkey.json packages/frontend/public/lib/zk/circuits/ 2>/dev/null || echo "Maximum vkey not found"
cp circuits/threshold/thresholdProof.vkey.json packages/frontend/public/lib/zk/circuits/ 2>/dev/null || echo "Threshold vkey not found"
```

### 2. Generate Verification Keys (if needed)

If the verification key files don't exist, you can generate them from the zkey files:

```bash
# Create a simple script to extract vkey from zkey
cat > extract-vkeys.js << 'EOF'
const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

async function extractVKey(proofType) {
  const zkeyPath = path.join('circuits', proofType, `${proofType}Proof.zkey`);
  const vkeyPath = path.join('circuits', proofType, `${proofType}Proof.vkey.json`);
  const publicPath = path.join('packages/frontend/public/lib/zk/circuits', `${proofType}Proof.vkey.json`);
  
  console.log(`Extracting vkey for ${proofType}...`);
  const vKey = await snarkjs.zKey.exportVerificationKey(zkeyPath);
  
  // Save to circuit directory
  fs.writeFileSync(vkeyPath, JSON.stringify(vKey, null, 2));
  console.log(`Saved to ${vkeyPath}`);
  
  // Save to public directory
  fs.writeFileSync(publicPath, JSON.stringify(vKey, null, 2));
  console.log(`Saved to ${publicPath}`);
}

async function main() {
  await extractVKey('standard');
  await extractVKey('maximum');
  await extractVKey('threshold');
  console.log('All verification keys extracted successfully');
}

main().catch(console.error);
EOF

# Run the script
node extract-vkeys.js
```

### 3. Test Browser Setup

Run the included test script to verify that all needed files are in place:

```bash
# Run the browser setup test
node packages/frontend/scripts/test-frontend-endpoints.js
```

## Troubleshooting

### Missing Files

If you see errors about missing files, verify that:

1. The circuit compilation was successful (check circuits directory)
2. The files were copied to the correct public directory
3. The file permissions allow reading (should be at least 644)

### Browser Errors

If proof generation works in server environment but fails in browser:

1. Check browser console for any CORS or CSP errors
2. Verify that the file paths in the browser console match the expected locations
3. Make sure the file sizes match between the circuits and public directories

## Security Considerations

When copying zkey files to the public directory, be aware that:

1. These files will be accessible to anyone who visits your site
2. This is designed intentionally to allow browser-based proof generation
3. The security of the zkSNARK system remains intact even if these files are public
4. The verification keys must be public to allow proof verification