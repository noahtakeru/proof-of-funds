#!/bin/bash

# UI Module Standardization Runner
# This script runs the UI Module Standardization process

# Set strict mode
set -euo pipefail

# Set base directory
BASE_DIR=$(dirname "$(dirname "$(dirname "$(dirname "$(dirname "$0")")")")")
cd "$BASE_DIR" || exit 1

echo "=== UI Module Standardization ==="
echo "Starting standardization process..."

# Install the required glob dependency if not already installed
if ! grep -q '"glob":' package.json; then
  echo "Installing required dependencies..."
  npm install --save-dev glob
fi

# Run the UI module standardizer
echo "Running UI module standardizer..."
node lib/zk/scripts/fixes/ui-module-standardizer.mjs

# Check for standardization report
REPORT_PATH="lib/zk/docs/implementation/UI_MODULE_STANDARDIZATION_REPORT.md"
if [ -f "$REPORT_PATH" ]; then
  echo "Standardization completed."
  echo "Report available at: $REPORT_PATH"
else
  echo "Error: Standardization report not found."
  exit 1
fi

# Run regression tests to verify that the changes didn't break anything
echo "Running regression tests to verify changes..."
if [ -f "lib/zk/tests/regression/run-regression-tests.sh" ]; then
  bash lib/zk/tests/regression/run-regression-tests.sh
else
  echo "Warning: Regression test script not found."
  echo "Please run regression tests manually."
fi

echo "UI Module Standardization process completed."
echo "Please review the changes and report, then commit if satisfied."