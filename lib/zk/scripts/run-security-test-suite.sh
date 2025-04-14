#!/bin/bash

# Security Test Suite Runner for ZK Proof System
# Runs the complete security test suite and displays results

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       ZK Proof Security Test Suite         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"

echo -e "\n${YELLOW}Starting security test suite...${NC}\n"

# Set Node options for ESM
export NODE_OPTIONS=--experimental-vm-modules

# Default values
ITERATIONS=10
VERBOSE=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --iterations=*)
      ITERATIONS="${1#*=}"
      shift
      ;;
    --verbose)
      VERBOSE="--verbose"
      shift
      ;;
    --test=*)
      TEST="${1#*=}"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--iterations=NUM] [--verbose] [--test=TYPE]"
      exit 1
      ;;
  esac
done

ARGS="--iterations=$ITERATIONS $VERBOSE"
if [ ! -z "$TEST" ]; then
  ARGS="$ARGS --test=$TEST"
fi

# Create results directory
RESULTS_DIR="./lib/zk/tests/security-results"
mkdir -p "$RESULTS_DIR"

echo -e "Configuration:"
echo -e "- Iterations: ${YELLOW}$ITERATIONS${NC}"
echo -e "- Verbose: ${YELLOW}${VERBOSE:=No}${NC}"
echo -e "- Test type: ${YELLOW}${TEST:=All}${NC}"
echo -e "- Results directory: ${YELLOW}$RESULTS_DIR${NC}"
echo

# Run the main security tests
echo -e "${BLUE}Running security tests...${NC}"
node lib/zk/scripts/run-security-tests.mjs $ARGS

# Check exit status
if [ $? -eq 0 ]; then
  echo -e "\n${GREEN}Security tests completed successfully${NC}"
else
  echo -e "\n${RED}Security tests failed${NC}"
  exit 1
fi

# Get the most recent summary file
LATEST_SUMMARY=$(ls -t "$RESULTS_DIR"/security-summary-*.json | head -1)

if [ -f "$LATEST_SUMMARY" ]; then
  echo -e "\n${BLUE}╔════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║           Security Test Summary            ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}\n"
  
  # Extract and display summary information from the JSON file
  # This requires jq to be installed
  if command -v jq &> /dev/null; then
    PASSED=$(jq '.summary.passed' "$LATEST_SUMMARY")
    FAILED=$(jq '.summary.failed' "$LATEST_SUMMARY")
    VULNERABILITIES=$(jq '.summary.totalVulnerabilities' "$LATEST_SUMMARY")
    DURATION=$(jq '.duration' "$LATEST_SUMMARY")
    
    echo -e "Test results:"
    echo -e "- Passed: ${GREEN}$PASSED${NC}"
    echo -e "- Failed: ${RED}$FAILED${NC}"
    echo -e "- Vulnerabilities found: ${YELLOW}$VULNERABILITIES${NC}"
    echo -e "- Execution time: ${BLUE}${DURATION}s${NC}"
    
    if [ "$FAILED" -eq 0 ]; then
      echo -e "\n${GREEN}All security tests passed!${NC}"
    else
      echo -e "\n${RED}Some security tests failed. Review the detailed results.${NC}"
      echo -e "Results file: ${YELLOW}$LATEST_SUMMARY${NC}"
    fi
  else
    echo "Install jq for detailed summary parsing"
    echo -e "Results file: ${YELLOW}$LATEST_SUMMARY${NC}"
  fi
else
  echo -e "\n${RED}Could not find summary file.${NC}"
fi

echo -e "\n${BLUE}Test complete. Full results available in: $RESULTS_DIR${NC}" 