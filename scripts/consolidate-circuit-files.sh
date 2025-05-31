#!/bin/bash
# Circuit Files Consolidation Script
# This script consolidates circuit files to a single canonical location

set -e
echo "===== Consolidating Circuit Files ====="

# Set paths
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CANONICAL_DIR="$PROJECT_ROOT/circuits"
FRONTEND_DIR="$PROJECT_ROOT/packages/frontend/public/lib/zk/circuits"

# Ensure both directories exist
if [ ! -d "$CANONICAL_DIR" ]; then
  echo "Error: Canonical directory $CANONICAL_DIR does not exist"
  exit 1
fi

if [ ! -d "$FRONTEND_DIR" ]; then
  echo "Error: Frontend directory $FRONTEND_DIR does not exist"
  exit 1
fi

# Verify that files are identical before proceeding
echo "Verifying file consistency..."
if ! diff -q "$CANONICAL_DIR/bitify.circom" "$FRONTEND_DIR/bitify.circom" &> /dev/null; then
  echo "Error: bitify.circom files are different. Please reconcile them manually before consolidation."
  exit 1
fi

if ! diff -q "$CANONICAL_DIR/comparators.circom" "$FRONTEND_DIR/comparators.circom" &> /dev/null; then
  echo "Error: comparators.circom files are different. Please reconcile them manually before consolidation."
  exit 1
fi

# Create backup of frontend files
echo "Creating backups of frontend files..."
mkdir -p "$FRONTEND_DIR/backup"
cp "$FRONTEND_DIR/bitify.circom" "$FRONTEND_DIR/backup/bitify.circom.bak"
cp "$FRONTEND_DIR/comparators.circom" "$FRONTEND_DIR/backup/comparators.circom.bak"

# Remove frontend files and replace with symbolic links
echo "Creating symbolic links..."
rm "$FRONTEND_DIR/bitify.circom"
rm "$FRONTEND_DIR/comparators.circom"

# Create relative symbolic links
cd "$FRONTEND_DIR"
RELATIVE_PATH=$(realpath --relative-to="$FRONTEND_DIR" "$CANONICAL_DIR")
ln -sf "$RELATIVE_PATH/bitify.circom" bitify.circom
ln -sf "$RELATIVE_PATH/comparators.circom" comparators.circom

echo "Symbolic links created:"
ls -la "$FRONTEND_DIR/bitify.circom" "$FRONTEND_DIR/comparators.circom"

echo "===== Circuit Files Consolidation Complete ====="
echo "The canonical circuit files are now in $CANONICAL_DIR"
echo "Symbolic links have been created in $FRONTEND_DIR"
echo "Backups of the original files are in $FRONTEND_DIR/backup"