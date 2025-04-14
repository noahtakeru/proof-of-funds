# ZK Fix Script Consolidation Plan

## Current State Analysis

Our codebase currently contains multiple overlapping "fix" scripts, each addressing similar issues but with slightly different approaches:

1. **fix-all-modules.js**: Fixes module compatibility for specific modules including TrustedSetupManager, browser compatibility, and ceremony test files.

2. **fix-module-formats.js/mjs**: A more general tool that standardizes all module formats across the codebase, converting files to ESM while maintaining CJS compatibility.

3. **direct-fix.js**: Creates standalone test files for regression tests to avoid module format issues.

4. **complete-fix.js**: Similar to direct-fix, creates self-contained test files that don't rely on module format compatibility.

5. **final-fix.js**: Another variant for creating test scripts with proper syntax.

6. **quick-fix.js**: Applies quick fixes for module format issues, particularly for test files.

Most of these scripts share similar code structures:
- A `loadModule()` function that determines the current environment (ESM vs CommonJS)
- Proxy-based exports that forward calls to the real implementation 
- Duplicate error handling strategies

These duplications create several issues:
- Confusion about which script to use for which purpose
- Overlapping functionality leading to maintenance challenges
- No clear documentation about which script is the "source of truth"
- No references in package.json scripts, making it unclear how they're meant to be used

## Consolidation Strategy

We'll consolidate these scripts into a single, comprehensive `zk-fix.js` utility with clear subcommands:

```
node zk-fix.js --module-formats    # Standardize module formats
node zk-fix.js --test-compat       # Fix test compatibility
node zk-fix.js --regression        # Fix regression test files
node zk-fix.js --all               # Run all fixes
```

### Implementation Plan

1. **Create a unified framework**:
   - Implement a command-line parser with clear help text
   - Create a modular structure with separate files for different fix types
   - Use consistent error handling across all modules

2. **Consolidate common utilities**:
   - Environment detection for ESM/CJS
   - File operations (reading, writing, renaming)
   - Error handling and logging

3. **Organize by functionality**:
   - Module format fixes (from fix-module-formats.js)
   - Test compatibility fixes (from quick-fix.js)
   - Regression test fixes (from direct-fix.js, complete-fix.js, final-fix.js)
   - Module-specific fixes (from fix-all-modules.js)

4. **Add documentation and safeguards**:
   - Clear help text showing available commands
   - Checks to prevent applying the same fix multiple times
   - Automatic backups of modified files
   - Logging of all operations with optional verbosity levels

## File Structure

```
lib/zk/scripts/
  ├── zk-fix.js              # Main entry point
  ├── fixes/                 # Directory for fix modules
  │   ├── module-formats.js  # Module format standardization
  │   ├── test-compat.js     # Test compatibility fixes
  │   ├── regression.js      # Regression test fixes
  │   └── specific-fixes.js  # Module-specific fixes
  └── common/                # Shared utilities
      ├── environment.js     # Environment detection
      ├── file-ops.js        # File operations
      └── logger.js          # Logging utilities
```

## Migration Path

1. Create the new consolidated script while keeping existing ones
2. Add documentation pointing to the new script
3. Create compatibility wrappers that forward to the new script
4. Add deprecation notices to the old scripts
5. Eventually remove the old scripts after ensuring the new one works correctly

## Backward Compatibility

To ensure we don't break existing workflows:

1. **Alias old script names**: Create thin wrappers with the old names that forward to the new consolidated script with appropriate parameters
2. **Preserve exact functionality**: Ensure each subcommand produces identical output to its original script
3. **Add version tracking**: Log which version of the fix script was last run to track migrations

This approach will preserve all existing functionality while creating a more maintainable, well-documented solution.

## Implementation Status

As of Week 8, we have completed the following tasks:

1. ✅ Created a consolidated script framework (`lib/zk/scripts/zk-fix.js`) with:
   - Command-line argument parsing
   - Help text
   - Placeholder functions for each fix type
   - Logging utilities
   - File backup capability

2. ✅ Created wrapper scripts for backward compatibility:
   - `fix-all-modules.wrapper.js` → `zk-fix.js --specific ...`
   - `fix-module-formats.wrapper.js` → `zk-fix.js --module-formats`
   - `direct-fix.wrapper.js` → `zk-fix.js --regression`
   - `quick-fix.wrapper.js` → `zk-fix.js --test-compat`

3. ✅ Added deprecation notices to all wrapper scripts

## Next Steps

To complete the implementation, the following tasks remain:

1. **Create utility modules** (Week 9):
   - Create `lib/zk/scripts/common/environment.js` for environment detection
   - Create `lib/zk/scripts/common/file-ops.js` for file operations
   - Create `lib/zk/scripts/common/logger.js` for enhanced logging

2. **Implement fix modules** (Week 9-10):
   - Create `lib/zk/scripts/fixes/module-formats.js` by extracting code from `fix-module-formats.js`
   - Create `lib/zk/scripts/fixes/test-compat.js` by extracting code from `quick-fix.js`
   - Create `lib/zk/scripts/fixes/regression.js` by consolidating code from the regression fix scripts
   - Create `lib/zk/scripts/fixes/specific-fixes.js` by extracting code from `fix-all-modules.js`

3. **Update the main script** (Week 10):
   - Import and use the fix modules in `zk-fix.js`
   - Add improved error handling
   - Add state tracking to avoid duplicate fixes

4. **Testing and validation** (Week 10):
   - Test each fix function individually
   - Compare output with original scripts
   - Ensure no regressions

5. **Documentation and cleanup** (Week 11):
   - Update documentation
   - Add examples to help text
   - Prepare for removal of original scripts

6. **Integration** (Post Week 11):
   - Add command to package.json scripts
   - Gradually phase out the original scripts
   - Monitor for any issues during transition

## Expected Benefits

Once fully implemented, this consolidation will provide:

1. **Simplified maintenance**: One source of truth instead of 6+ scripts
2. **Better documentation**: Clear help text and examples
3. **Improved reliability**: Consistent error handling and logging
4. **Enhanced safety**: Automatic backups and state tracking
5. **User-friendly**: Clear command structure and feedback 