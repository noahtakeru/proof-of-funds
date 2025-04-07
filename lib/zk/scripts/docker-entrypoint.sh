#!/bin/bash

# Docker entrypoint script for ZK Circuit testing

# Print header information
echo "================================================"
echo "ZK Circuit Optimization Testing Environment"
echo "================================================"

# Run circuit compilation
echo "Building and compiling circuits..."
cd lib/zk
node scripts/build-circuits.js

# Run circuit tests
echo "Running circuit tests..."
node test-circuits.cjs

echo "================================================"
echo "Test complete! To run more tests, use:"
echo "docker run -it --rm proof-of-funds-zk bash"
echo "================================================"

# If argument is passed, execute it instead
if [ $# -gt 0 ]; then
    exec "$@"
else
    # Keep container running for debugging if needed
    echo "Container is now running in interactive mode."
    exec bash
fi