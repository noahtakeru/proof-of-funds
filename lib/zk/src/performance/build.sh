#!/bin/bash

# Ensure the dist directory exists
mkdir -p ../../dist/performance

# Compile the TypeScript files
echo "Compiling MemoryEfficientCache.ts..."
npx tsc -t es2020 -m es2020 --outDir ../../dist/performance MemoryEfficientCache.ts

echo "Compiling DynamicLoadDistribution.ts..."
npx tsc -t es2020 -m es2020 --outDir ../../dist/performance DynamicLoadDistribution.ts

echo "Done!" 