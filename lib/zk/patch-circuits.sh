#!/bin/bash

# Script to patch circuit files to use correct include paths

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Header
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}Patching Circuit Files for Compilation${NC}"
echo -e "${BLUE}================================================${NC}"

# Directory setup
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
cd "$SCRIPT_DIR"

# Check if circomlib exists in node_modules
if [ -d "../node_modules/circomlib" ]; then
    CIRCOMLIB_PATH="../node_modules/circomlib"
elif [ -d "../../node_modules/circomlib" ]; then
    CIRCOMLIB_PATH="../../node_modules/circomlib"
else
    echo -e "${YELLOW}Warning: circomlib not found in node_modules${NC}"
    echo -e "${YELLOW}Installing circomlib...${NC}"
    npm install circomlib
    CIRCOMLIB_PATH="../node_modules/circomlib"
fi

echo -e "Using circomlib path: $CIRCOMLIB_PATH"

# Function to patch a circuit file
patch_circuit() {
    local circuit=$1
    local file="circuits/${circuit}.circom"
    
    echo -e "Patching $file..."
    
    # Create backup
    cp "$file" "${file}.bak"
    
    # Replace include paths
    sed -i'' -e "s|../node_modules/circomlib|$CIRCOMLIB_PATH|g" "$file"
    
    echo -e "${GREEN}✓ Updated $file${NC}"
}

# Patch all circuit files
patch_circuit "standardProof"
patch_circuit "thresholdProof"
patch_circuit "maximumProof"

echo -e "\n${GREEN}Circuits patched successfully!${NC}"
echo -e "${YELLOW}You can now run the build script to compile the circuits:${NC}"
echo -e "node scripts/build-circuits.js"
echo -e "${BLUE}================================================${NC}"