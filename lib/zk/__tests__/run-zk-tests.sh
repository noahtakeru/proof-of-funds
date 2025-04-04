#!/bin/bash
# ZK Tests Runner
# This script runs the ZK infrastructure tests and generates reports

# Set the directory to this script's location
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Create reports directory if it doesn't exist
mkdir -p reports

# Function to print with color
print_color() {
  case "$1" in
    "green")  echo -e "\033[0;32m$2\033[0m" ;;
    "red")    echo -e "\033[0;31m$2\033[0m" ;;
    "yellow") echo -e "\033[0;33m$2\033[0m" ;;
    "blue")   echo -e "\033[0;34m$2\033[0m" ;;
    *)        echo "$2" ;;
  esac
}

# Print header
print_color blue "==============================================="
print_color blue "   Zero-Knowledge Proof Testing Infrastructure"
print_color blue "==============================================="
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
  print_color red "ERROR: Node.js is not installed!"
  exit 1
fi

# Check for Jest
if ! command -v npx &> /dev/null; then
  print_color red "ERROR: npx is not available. Make sure npm is installed correctly."
  exit 1
fi

# Run tests with environment setup for ES modules
print_color yellow "Setting up test environment..."
export NODE_OPTIONS=--experimental-vm-modules

# Run the test runner
print_color blue "Running ZK infrastructure tests..."
node --experimental-specifier-resolution=node --experimental-vm-modules runAllTests.js

# Check if the tests passed
if [ $? -eq 0 ]; then
  print_color green "All tests passed successfully!"
else
  print_color red "Some tests failed. Check the reports directory for details."
  exit 1
fi

# Open the latest report if on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
  LATEST_REPORT=$(ls -t reports/zk-test-summary-*.md | head -1)
  if [ -n "$LATEST_REPORT" ]; then
    print_color blue "Opening test report..."
    open "$LATEST_REPORT"
  fi
fi

print_color green "Test suite complete. Reports are available in the reports directory."
exit 0