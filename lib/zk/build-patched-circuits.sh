#\!/bin/bash

# Script to build the patched circuits

# Set the directory to this script's location
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=== Building Optimized Circuits ==="
echo ""

# Create build directories
mkdir -p build/patched/wasm
mkdir -p build/patched/zkey
mkdir -p build/patched/verification_key

# Build all circuits
for circuit in standardProof thresholdProof maximumProof; do
  echo "Building $circuit circuit..."
  
  # Compile circuit to r1cs
  circom patched-circuits/$circuit.circom --r1cs --output build/patched
  
  # Copy r1cs file to expected location
  cp patched-circuits/$circuit.r1cs build/$circuit.r1cs
  
  # Create build info file
  echo "{
  \"circuitName\": \"$circuit\",
  \"buildDate\": \"$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")\",
  \"files\": {
    \"r1cs\": \"$circuit.r1cs\",
    \"wasm\": \"wasm/${circuit}_js/${circuit}.wasm\",
    \"zkey\": \"zkey/${circuit}.zkey\",
    \"vkey\": \"verification_key/${circuit}.json\",
    \"solidity\": \"${circuit}Verifier.sol\"
  },
  \"constraints\": $(node patched-circuits/count-constraints.js $circuit)
}" > build/${circuit}_info.json
done

echo ""
echo "=== Circuit Build Summary ==="
node patched-circuits/count-constraints.js
