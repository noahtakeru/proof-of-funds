#!/bin/bash

# Run Real Implementation Tests
# This script prepares the environment and runs all tests with real implementations

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}====================================${NC}"
echo -e "${BLUE}Zero-Knowledge Real Implementation Tests${NC}"
echo -e "${BLUE}====================================${NC}"

# Set working directory to project root
cd "$(git rev-parse --show-toplevel)" || exit 1
echo "Working directory: $(pwd)"
echo "Start time: $(date)"

# 1. Fix module formats to ensure compatibility
echo -e "\n${YELLOW}Fixing module formats...${NC}"
node lib/zk/fix-module-formats.js

# 2. Make sure the regression test script is executable
echo -e "\n${YELLOW}Setting execute permissions on scripts...${NC}"
chmod +x lib/zk/run-regression-tests.sh
chmod +x lib/zk/run-circuit-tests.sh
chmod +x lib/zk/scripts/build-circuits.cjs

# 3. Set environment variables for real tests
echo -e "\n${YELLOW}Setting up environment for real implementation...${NC}"
export USING_REAL_IMPLEMENTATION=true
export NODE_OPTIONS="--experimental-modules --es-module-specifier-resolution=node"
export JEST_WORKER_ID=1
export DEBUG=zk:*

# 4. Run the regression tests
echo -e "\n${YELLOW}Running regression tests with real implementation...${NC}"
./lib/zk/run-regression-tests.sh

echo -e "\n${GREEN}Tests completed at $(date)${NC}"
echo -e "${YELLOW}Note: Some tests may be skipped if real implementations are not available.${NC}"
echo -e "${YELLOW}To fix failures, make sure all required circuit artifacts are built.${NC}"