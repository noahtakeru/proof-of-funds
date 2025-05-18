#!/bin/bash
# Browser ZK Setup Script
# This script sets up the necessary files for browser-based ZK proof generation

# Create the target directory structure
echo "Creating target directory structure..."
mkdir -p packages/frontend/public/lib/zk/circuits

# Copy WASM files
echo "Copying WASM files..."
cp circuits/standard/standardProof_js/standardProof.wasm packages/frontend/public/lib/zk/circuits/ 2>/dev/null || echo "⚠️ Standard WASM not found"
cp circuits/maximum/maximumProof_js/maximumProof.wasm packages/frontend/public/lib/zk/circuits/ 2>/dev/null || echo "⚠️ Maximum WASM not found"
cp circuits/threshold/thresholdProof_js/thresholdProof.wasm packages/frontend/public/lib/zk/circuits/ 2>/dev/null || echo "⚠️ Threshold WASM not found"

# Copy ZKey files
echo "Copying ZKey files..."
cp circuits/standard/standardProof.zkey packages/frontend/public/lib/zk/circuits/ 2>/dev/null || echo "⚠️ Standard ZKey not found"
cp circuits/maximum/maximumProof.zkey packages/frontend/public/lib/zk/circuits/ 2>/dev/null || echo "⚠️ Maximum ZKey not found"
cp circuits/threshold/thresholdProof.zkey packages/frontend/public/lib/zk/circuits/ 2>/dev/null || echo "⚠️ Threshold ZKey not found"

# Copy verification key files (if they exist)
echo "Copying verification key files..."
cp circuits/standard/standardProof.vkey.json packages/frontend/public/lib/zk/circuits/ 2>/dev/null || echo "⚠️ Standard VKey not found"
cp circuits/maximum/maximumProof.vkey.json packages/frontend/public/lib/zk/circuits/ 2>/dev/null || echo "⚠️ Maximum VKey not found"
cp circuits/threshold/thresholdProof.vkey.json packages/frontend/public/lib/zk/circuits/ 2>/dev/null || echo "⚠️ Threshold VKey not found"

# Generate verification keys if needed
echo "Checking if we need to generate verification keys..."
NEED_VKEYS=0

if [ ! -f "packages/frontend/public/lib/zk/circuits/standardProof.vkey.json" ]; then
  NEED_VKEYS=1
fi

if [ ! -f "packages/frontend/public/lib/zk/circuits/maximumProof.vkey.json" ]; then
  NEED_VKEYS=1
fi

if [ ! -f "packages/frontend/public/lib/zk/circuits/thresholdProof.vkey.json" ]; then
  NEED_VKEYS=1
fi

if [ $NEED_VKEYS -eq 1 ]; then
  echo "Some verification keys are missing. Generating them..."
  
  # Create temp script to generate vkeys
  cat > /tmp/extract-vkeys.js << 'EOF'
const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

async function extractVKey(proofType) {
  const zkeyPath = path.join('circuits', proofType, `${proofType}Proof.zkey`);
  const vkeyPath = path.join('circuits', proofType, `${proofType}Proof.vkey.json`);
  const publicPath = path.join('packages/frontend/public/lib/zk/circuits', `${proofType}Proof.vkey.json`);
  
  try {
    console.log(`Extracting vkey for ${proofType}...`);
    if (!fs.existsSync(zkeyPath)) {
      console.log(`⚠️ ZKey not found at ${zkeyPath}, skipping`);
      return;
    }
    
    const vKey = await snarkjs.zKey.exportVerificationKey(zkeyPath);
    
    // Save to circuit directory
    fs.writeFileSync(vkeyPath, JSON.stringify(vKey, null, 2));
    console.log(`✅ Saved to ${vkeyPath}`);
    
    // Create directory if it doesn't exist
    const publicDir = path.dirname(publicPath);
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    // Save to public directory
    fs.writeFileSync(publicPath, JSON.stringify(vKey, null, 2));
    console.log(`✅ Saved to ${publicPath}`);
  } catch (error) {
    console.error(`❌ Error extracting vkey for ${proofType}:`, error.message);
  }
}

async function main() {
  try {
    await extractVKey('standard');
    await extractVKey('maximum');
    await extractVKey('threshold');
    console.log('✅ Verification key extraction completed');
  } catch (error) {
    console.error('❌ Error during verification key extraction:', error);
  }
}

main().catch(console.error);
EOF

  # Run the script
  node /tmp/extract-vkeys.js
  rm /tmp/extract-vkeys.js
else
  echo "✅ All verification keys are present"
fi

# Show summary
echo ""
echo "=== Setup Summary ==="
echo "WASM files:"
ls -l packages/frontend/public/lib/zk/circuits/*.wasm 2>/dev/null || echo "❌ No WASM files found"
echo ""
echo "ZKey files:"
ls -l packages/frontend/public/lib/zk/circuits/*.zkey 2>/dev/null || echo "❌ No ZKey files found"
echo ""
echo "Verification Key files:"
ls -l packages/frontend/public/lib/zk/circuits/*.vkey.json 2>/dev/null || echo "❌ No Verification Key files found"
echo ""

# Run the test script if it exists
if [ -f "packages/frontend/scripts/test-frontend-endpoints.js" ]; then
  echo "Running test script to verify setup..."
  node packages/frontend/scripts/test-frontend-endpoints.js
else
  echo "⚠️ Test script not found. Setup complete but not verified."
fi

echo ""
echo "Browser setup completed. See BROWSER-SETUP-GUIDE.md for more information."