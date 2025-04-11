# Module Standardization Plan (Revised)

WORK IS ONLY DONE ONCE ALL FAILURES AND WARNINGS ARE GONE from running run-regression-tests.sh. NO PLACEHOLDER CODE or surface level fixes. Import ethers properly - no placeholders. ESM first with cjs compatibility if needed.

## Current Issues

Based on regression test output, the following issues remain to be addressed:

1. **Mixed Module Patterns** - Many ESM files contain CommonJS patterns:
   - Files using `require()` in ESM context: complete-fix.js, deviceCapabilities.js, fix-all-modules.js, memoryProfiler.js, etc.
   - Files using `module.exports` in ESM context: constants.js, fix-all-modules.js, moduleLoader.js, quick-fix.js, etc.

2. **Documentation Gaps**:
   - Most exports lack proper JSDoc documentation (12/13 in zkUtils.mjs, 8/9 in zkCircuitInputs.mjs, etc.)
   - Missing parameter types, return types, and descriptions

3. **Error Handling Inconsistency**:
   - Most files use try/catch without proper error logging integration
   - Generic Error classes used instead of custom error types

4. **Circular Dependencies**:
   - Improper import paths causing circular references

## Implementation Plan

### Phase 1: Fix Module Format Consistency

1. **Standardize File Extensions**:
   - All ESM files → `.mjs`
   - All CJS files → `.cjs`
   - Transitional files → `.js` with explicit imports/exports

2. **ESM Format Cleanup**:
   - Remove all `require()` calls from `.mjs` files
   - Replace with proper `import` statements
   - Remove all `module.exports` from `.mjs` files
   - Replace with proper `export` statements

3. **Create Proper Dynamic Import Utilities**:
   - Implement a reusable dynamic import system for ethers and other libraries
   - Support both ESM and CJS environments without static mocks

### Phase 2: Documentation Enhancement

1. **Add JSDoc to All Exports**:
   - Document all functions with parameters, return types, and descriptions
   - Document all constants and exported values
   - Ensure consistent documentation style

2. **Standardize Export Patterns**:
   - Use named exports consistently for all utility functions
   - Use default exports only when appropriate for main module entry points

### Phase 3: Error Handling Standardization

1. **Implement Error Logging Integration**:
   - Update all try/catch blocks to use the error logging system
   - Replace console.warn/error with proper logging

2. **Implement Custom Error Types**:
   - Create specific error classes for different error scenarios
   - Replace generic Error with typed errors throughout the codebase

### Phase 4: Dependency Management

1. **Resolve Circular Dependencies**:
   - Refactor module structure to eliminate circular imports
   - Create proper intermediate modules where needed

2. **Create Proper Build System**:
   - Update rollup.config.js to properly build ESM → CJS
   - Ensure all imports/exports are correctly mapped

## Test Strategy

1. Implement comprehensive module format tests
2. Verify both ESM and CJS imports work
3. Test each module in isolation to avoid test interference
4. Ensure functional equivalence between ESM and CJS versions

## Priority Files to Fix

1. `src/zkUtils.mjs` - Core utility functions
2. `src/index.mjs` - Main entry point
3. `src/zkCircuitInputs.mjs` - Input preparation
4. `src/zkCircuitParameterDerivation.mjs` - Parameter derivation
5. `src/ethersUtils.mjs` - Ethers integration

## Completion Criteria

1. All regression tests pass with no warnings
2. No ESM files contain CommonJS patterns
3. All exports are properly documented with JSDoc
4. All error handling uses the standard error system
5. No circular dependencies exist