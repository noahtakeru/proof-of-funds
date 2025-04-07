#!/bin/bash

# Complete Test Runner for Real & Mock Tests
# This script runs all types of tests, ensuring everything is working properly

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}Complete Zero-Knowledge Test Runner${NC}"
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
chmod +x lib/zk/run-circuit-tests.sh

# 3. Set environment variables
echo -e "\n${YELLOW}Setting up environment for tests...${NC}"
export NODE_OPTIONS="--experimental-modules --es-module-specifier-resolution=node --no-warnings"
export JEST_WORKER_ID=1

# 4. Run the tests for each component
echo -e "\n${YELLOW}Running component tests...${NC}"

# 4.1 Module imports test
echo -e "\n${BLUE}Testing module imports:${NC}"
node -e "
  try {
    const SecureKeyManager = require('./lib/zk/SecureKeyManager.js');
    console.log('${GREEN}✓ SecureKeyManager (CommonJS import)${NC}');
  } catch (e) {
    console.log('${RED}✗ SecureKeyManager (CommonJS import): ${e.message}${NC}');
  }
  
  try {
    const TamperDetection = require('./lib/zk/TamperDetection.js');
    console.log('${GREEN}✓ TamperDetection (CommonJS import)${NC}');
  } catch (e) {
    console.log('${RED}✗ TamperDetection (CommonJS import): ${e.message}${NC}');
  }
"

# 4.2 Test the browser compatibility system
echo -e "\n${BLUE}Testing browser compatibility:${NC}"
if [[ -f ./lib/zk/__tests__/browser-compatibility-test.cjs ]]; then
  node ./lib/zk/__tests__/browser-compatibility-test.cjs && \
  echo -e "${GREEN}✓ Browser compatibility tests passed${NC}" || \
  echo -e "${RED}✗ Browser compatibility tests failed${NC}"
else
  echo -e "${RED}✗ Browser compatibility test file not found${NC}"
fi

# 4.3 Test the trusted setup manager
echo -e "\n${BLUE}Testing trusted setup manager:${NC}"
if [[ -f ./lib/zk/__tests__/ceremony/test-ceremony.cjs ]]; then
  node ./lib/zk/__tests__/ceremony/test-ceremony.cjs && \
  echo -e "${GREEN}✓ Trusted setup tests passed${NC}" || \
  echo -e "${RED}✗ Trusted setup tests failed${NC}"
else
  echo -e "${RED}✗ Trusted setup test file not found${NC}"
fi

# 4.4 Test circuit optimization
echo -e "\n${BLUE}Testing circuit optimization:${NC}"
if [[ -f ./lib/zk/test-circuits.cjs ]]; then
  node ./lib/zk/test-circuits.cjs && \
  echo -e "${GREEN}✓ Circuit optimization tests passed${NC}" || \
  echo -e "${RED}✗ Circuit optimization tests failed${NC}"
else
  echo -e "${RED}✗ Circuit test file not found${NC}"
fi

# 4.5 Test real implementation
echo -e "\n${BLUE}Testing real implementation:${NC}"
node lib/zk/test-real-implementation.js && \
echo -e "${GREEN}✓ Real implementation tests passed${NC}" || \
echo -e "${RED}✗ Real implementation tests failed${NC}"

# 5. Run Jest tests for all components
echo -e "\n${BLUE}Running Jest tests:${NC}"
npx jest lib/zk/__tests__/realImplementation.test.js --verbose --passWithNoTests --forceExit && \
echo -e "${GREEN}✓ Jest tests passed${NC}" || \
echo -e "${RED}✗ Jest tests failed${NC}"

# 6. Run regression tests (this will try to run all tests)
echo -e "\n${YELLOW}Running complete regression tests...${NC}"
./lib/zk/run-regression-tests.sh

echo -e "\n${GREEN}All tests completed at $(date)${NC}"
echo -e "${YELLOW}Note: Some tests may be skipped when real implementations are not available.${NC}"