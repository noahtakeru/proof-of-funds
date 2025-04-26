#!/bin/bash

# Cleanup script for proof-of-funds project
# This script will safely delete mock files while preserving real files

echo "Proof-of-Funds Cleanup Script"
echo "============================"
echo "This script will delete mock files based on the list in mock_files_to_delete.txt"
echo "Real files listed in real_files_to_keep.txt will be preserved"
echo ""

if [ ! -f "mock_files_to_delete.txt" ]; then
  echo "Error: mock_files_to_delete.txt not found!"
  exit 1
fi

if [ ! -f "real_files_to_keep.txt" ]; then
  echo "Error: real_files_to_keep.txt not found!"
  exit 1
fi

# Display warning about files that need modifications after cleanup
echo "WARNING: The following files will need modifications after cleanup:"
echo "- lib/zk/src/zkCircuits.mjs: Fix import path for constants module"
echo "- lib/zk/src/zkProofGenerator.mjs: Verify pathways to circuits and error handling"
echo "- lib/zk/src/contracts/ProofOfFundsContract.ts: Review error handling alignment"
echo ""
read -p "Do you want to continue with the cleanup? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cleanup aborted."
  exit 0
fi

# Create backup directory
BACKUP_DIR="backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "Created backup directory: $BACKUP_DIR"

# Function to safely delete a file
safe_delete() {
  local file="$1"
  
  # Skip wildcards/patterns - they'll be handled separately
  if [[ $file == *"*"* ]]; then
    return
  fi
  
  # Check if file exists
  if [ -f "$file" ]; then
    # Create backup
    mkdir -p "$BACKUP_DIR/$(dirname "$file")"
    cp "$file" "$BACKUP_DIR/$file"
    echo "Backed up: $file"
    
    # Delete the file
    rm "$file"
    echo "Deleted: $file"
  else
    echo "Warning: File not found: $file"
  fi
}

# Process special patterns (wildcards)
process_patterns() {
  # Handle wildcard patterns like lib/zk/build/*.r1cs
  # Make sure to back them up first
  
  # ZK Library Build wildcards
  if [ -d "lib/zk/build" ]; then
    mkdir -p "$BACKUP_DIR/lib/zk/build"
    mkdir -p "$BACKUP_DIR/lib/zk/build/verification_key"
    
    # Verification key JSON files
    find lib/zk/build/verification_key -name "*.json" -type f -exec cp {} "$BACKUP_DIR/{}" \; -exec rm {} \; -exec echo "Deleted: {}" \;
    
    # Verifier.sol files
    find lib/zk/build -name "*Verifier.sol" -type f -exec cp {} "$BACKUP_DIR/{}" \; -exec rm {} \; -exec echo "Deleted: {}" \;
    
    # info.json files
    find lib/zk/build -name "*_info.json" -type f -exec cp {} "$BACKUP_DIR/{}" \; -exec rm {} \; -exec echo "Deleted: {}" \;
    
    # r1cs files
    find lib/zk/build -name "*.r1cs" -type f -exec cp {} "$BACKUP_DIR/{}" \; -exec rm {} \; -exec echo "Deleted: {}" \;
    
    # standardProof_input.json
    if [ -f "lib/zk/build/standardProof_input.json" ]; then
      cp "lib/zk/build/standardProof_input.json" "$BACKUP_DIR/lib/zk/build/"
      rm "lib/zk/build/standardProof_input.json"
      echo "Deleted: lib/zk/build/standardProof_input.json"
    fi
  fi
  
  # ZK test report files
  if [ -d "lib/zk/__tests__/reports" ]; then
    mkdir -p "$BACKUP_DIR/lib/zk/__tests__/reports"
    find lib/zk/__tests__/reports -name "*.json" -type f -exec cp {} "$BACKUP_DIR/{}" \; -exec rm {} \; -exec echo "Deleted: {}" \;
  fi
}

# Parse mock_files_to_delete.txt and delete files
echo "Starting deletion process..."
while IFS= read -r line; do
  # Skip empty lines and headers (lines starting with # or ##)
  if [[ -z "$line" || "$line" == \#* ]]; then
    continue
  fi
  
  safe_delete "$line"
done < mock_files_to_delete.txt

# Process wildcard patterns
process_patterns

echo ""
echo "Cleanup complete!"
echo "Deleted files have been backed up to: $BACKUP_DIR"
echo "If you need to restore any files, you can find them in the backup directory."
echo ""
echo "REMINDER: The following files need modifications:"
echo "- lib/zk/src/zkCircuits.mjs: Fix import path for constants module"
echo "- lib/zk/src/zkProofGenerator.mjs: Verify pathways to circuits and error handling"
echo "- lib/zk/src/contracts/ProofOfFundsContract.ts: Review error handling alignment"
echo ""
echo "Note: You may want to run 'git status' to verify changes before committing." 