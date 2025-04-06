#\!/bin/bash

# Navigate to the circuit directory
cd "$(dirname "$0")"

# Run a simple test of the standard proof circuit
circom standardProof.circom --r1cs --wasm --sym

echo "Circuit compiled. Constraint count:"
# Count constraints (simplified)
grep -c "," standardProof.r1cs || echo "Unable to count constraints"

echo "Test completed."
