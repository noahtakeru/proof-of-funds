#\!/bin/bash
# Circuit Tests Runner
# This script runs all circuit-related tests

# Set the directory to this script's location
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=== Running ZK Circuit Optimization Tests ==="
echo ""

# If circom is installed, attempt actual circuit compilation
if command -v circom &> /dev/null; then
    echo "Circom is installed. Attempting to build circuits..."
    node scripts/build-circuits.cjs
else
    echo "Circom is not installed. Running tests with circuit simulation."
    export SKIP_COMPILATION_TESTS=1
fi

# Run the tests with CommonJS configuration
echo "Running circuit optimization tests..."
npx jest __tests__/circuits/circuitOptimization.test.cjs --config=jest.config.cjs

echo ""
echo "Test run complete."

# Report results
CONSTRAINTS_STANDARD=$(jq '.constraints' build/standardProof_info.json 2>/dev/null || echo "Unknown")
CONSTRAINTS_THRESHOLD=$(jq '.constraints' build/thresholdProof_info.json 2>/dev/null || echo "Unknown")
CONSTRAINTS_MAXIMUM=$(jq '.constraints' build/maximumProof_info.json 2>/dev/null || echo "Unknown")

echo "=== Circuit Optimization Results ==="
echo "Standard Proof:  $CONSTRAINTS_STANDARD constraints (target: <10,000)"
echo "Threshold Proof: $CONSTRAINTS_THRESHOLD constraints (target: <15,000)"
echo "Maximum Proof:   $CONSTRAINTS_MAXIMUM constraints (target: <15,000)"
echo ""

if [ "$CONSTRAINTS_STANDARD" \!= "Unknown" ] && [ "$CONSTRAINTS_STANDARD" -lt 10000 ] && \
   [ "$CONSTRAINTS_THRESHOLD" \!= "Unknown" ] && [ "$CONSTRAINTS_THRESHOLD" -lt 15000 ] && \
   [ "$CONSTRAINTS_MAXIMUM" \!= "Unknown" ] && [ "$CONSTRAINTS_MAXIMUM" -lt 15000 ]; then
    echo "✅ All circuits meet their constraint targets\!"
else
    echo "❌ Some circuits do not meet their constraint targets."
fi
