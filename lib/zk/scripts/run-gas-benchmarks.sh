#!/bin/bash

# Gas Benchmarking Script for Zero-Knowledge Infrastructure
# This script runs gas benchmarks for the zero-knowledge proof circuits

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Ensure we're in the project root directory
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
cd "$PROJECT_ROOT"

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Zero-Knowledge Gas Benchmarking${NC}"
echo -e "${BLUE}======================================${NC}"
echo "Running benchmarks from: $(pwd)"
echo "Start time: $(date)"

# Create logs directory if it doesn't exist
mkdir -p ./lib/zk/benchmark-reports

# Function to run the benchmark
run_benchmark() {
  echo -e "\n${MAGENTA}Running gas benchmarks for $1...${NC}"
  
  # Run the benchmark script with appropriate environment variables
  case "$1" in
    "simulation")
      echo -e "${YELLOW}Running gas benchmark simulation...${NC}"
      node ./lib/zk/gasBenchmarkRunner.js --simulation
      ;;
    "hardhat")
      echo -e "${YELLOW}Running gas benchmarks on Hardhat network...${NC}"
      npx hardhat run ./lib/zk/gasBenchmarkRunner.js
      ;;
    "testnet")
      echo -e "${YELLOW}Running gas benchmarks on Sepolia testnet...${NC}"
      NETWORK=sepolia node ./lib/zk/gasBenchmarkRunner.js
      ;;
    *)
      echo -e "${RED}Unknown benchmark type: $1${NC}"
      return 1
      ;;
  esac
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}Benchmark completed successfully${NC}"
    return 0
  else
    echo -e "${RED}Benchmark failed${NC}"
    return 1
  fi
}

# Display usage if necessary
show_usage() {
  echo "Usage: $0 [simulation|hardhat|testnet]"
  echo "  simulation - Run a simulation benchmark (no blockchain)"
  echo "  hardhat    - Run benchmarks on local Hardhat network"
  echo "  testnet    - Run benchmarks on Sepolia testnet"
}

# Main execution
if [ $# -eq 0 ]; then
  # Default to simulation if no argument provided
  run_benchmark "simulation"
elif [ $# -eq 1 ]; then
  run_benchmark "$1"
else
  show_usage
  exit 1
fi

# Display benchmark report location
echo -e "\n${BLUE}Benchmark reports${NC}"
echo -e "Reports are saved in ${YELLOW}./lib/zk/benchmark-reports/${NC}"
echo -e "The most recent report is:"
ls -t ./lib/zk/benchmark-reports/*.md | head -1 | xargs basename

# Optional: Display report summary if available
LATEST_REPORT=$(ls -t ./lib/zk/benchmark-reports/*.md | head -1)
if [ -f "$LATEST_REPORT" ]; then
  echo -e "\n${BLUE}Summary from latest report:${NC}"
  # Extract and display the summary section
  sed -n '/^## Summary/,/^##/p' "$LATEST_REPORT" | head -n -1
fi

echo -e "\n${GREEN}Benchmarking complete at $(date)${NC}"