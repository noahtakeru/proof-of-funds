#!/bin/bash

# Run ONLY Real Implementation Tests
# This script runs tests that REQUIRE real implementations and will fail if mocks are used

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}REAL IMPLEMENTATION TESTS ONLY${NC}"
echo -e "${BLUE}(Will fail if using mocks)${NC}"
echo -e "${BLUE}==========================================${NC}"

# Set working directory to project root
cd "$(git rev-parse --show-toplevel)" || exit 1
echo "Working directory: $(pwd)"
echo "Start time: $(date)"

# 1. Apply quick fixes to module formats
echo -e "\n${YELLOW}Applying quick fixes to module formats...${NC}"
node lib/zk/quick-fix.js

# 2. Set execute permissions on scripts
echo -e "\n${YELLOW}Setting execute permissions on scripts...${NC}"
chmod +x lib/zk/run-regression-tests.sh

# 3. Set environment variables to force real implementations
echo -e "\n${YELLOW}Forcing real implementation mode...${NC}"
export USING_REAL_IMPLEMENTATION=true
export NO_FALLBACKS=true
export NODE_OPTIONS="--experimental-modules --es-module-specifier-resolution=node --no-warnings"
export JEST_WORKER_ID=1

# 4. Verify WASM files are present and not placeholders
echo -e "\n${BLUE}Verifying WebAssembly files:${NC}"
real_wasm=true

circuits=("standardProof" "thresholdProof" "maximumProof")
for circuit in "${circuits[@]}"; do
  wasm_path="lib/zk/build/wasm/${circuit}_js/${circuit}.wasm"
  if [[ ! -f $wasm_path ]]; then
    echo -e "${RED}✗ Missing $circuit WASM file${NC}"
    real_wasm=false
  else
    # Check file size to see if it's likely a real WASM file
    size=$(stat -f%z "$wasm_path" 2>/dev/null || stat -c%s "$wasm_path" 2>/dev/null)
    if (( size < 10000 )); then
      echo -e "${RED}✗ $circuit WASM file seems to be a placeholder (only $size bytes)${NC}"
      real_wasm=false
    else
      echo -e "${GREEN}✓ $circuit WASM file verified ($size bytes)${NC}"
    fi
  fi
done

if [[ "$real_wasm" == "false" ]]; then
  echo -e "${RED}Real WASM files are missing or are placeholders${NC}"
  echo -e "${YELLOW}You must compile the circuits first with:${NC}"
  echo -e "${YELLOW}node lib/zk/scripts/build-circuits.cjs${NC}"
  echo -e "${YELLOW}Exiting...${NC}"
  exit 1
fi

# 5. Run the real implementation test
echo -e "\n${BLUE}Running real implementation tests:${NC}"
node lib/zk/test-real-implementation.js

result=$?
if [[ $result -ne 0 ]]; then
  echo -e "${RED}Real implementation tests failed${NC}"
  echo -e "${RED}This means you are using mock implementations or have incorrect circuit files${NC}"
  exit 1
fi

# 6. Run Jest tests for real implementation
echo -e "\n${BLUE}Running Jest tests with real implementations:${NC}"
USING_REAL_IMPLEMENTATION=true NO_FALLBACKS=true npx jest lib/zk/__tests__/realImplementation.test.js --testNamePattern="real" --verbose

# 7. Test circuit optimization with real constraints
echo -e "\n${BLUE}Testing circuit optimization with real constraints:${NC}"
USING_REAL_IMPLEMENTATION=true NO_FALLBACKS=true node lib/zk/test-circuits.cjs

echo -e "\n${GREEN}All real implementation tests completed at $(date)${NC}"
echo -e "${GREEN}✓ Using real zero-knowledge implementations${NC}"