# Module Format Standardization Plan

## Overview
This document outlines the Module Format Standardization (HP-05) implementation plan. The goal is to standardize JavaScript module formats across the codebase to improve maintainability, eliminate compatibility issues, and ensure consistent module usage patterns.

## Current Issues
1. **Inconsistent file extensions**: Files using ESM syntax with `.js` extensions instead of `.mjs`
2. **Mixed module patterns**: Files containing both CommonJS and ESM syntax
3. **Missing extensions in imports**: ESM imports missing the `.js` extension in relative imports
4. **Inconsistent export patterns**: Mix of `module.exports` and `export` in the same files
5. **__dirname/__filename usage in ESM**: Using CommonJS globals in ESM modules

## Standardization Rules

### File Extensions
- **ESM modules**: Use `.mjs` extension
- **CommonJS modules**: Use `.cjs` extension
- **Dual-format modules**: Use `.js` extension (supports both ESM and CommonJS through conditional logic)

### Import Patterns
- **ESM modules**: 
  - Use `import x from 'y'` syntax
  - Always include `.js` extension in relative imports
  - Use dynamic imports for conditional loading

- **CommonJS modules**:
  - Use `const x = require('y')` syntax
  - Don't need extensions in require paths

- **Dual-format modules**:
  - Use conditional imports based on environment detection
  - Standardize checks for module system detection

### Export Patterns
- **ESM modules**:
  - Use `export` and `export default` syntax
  - No `module.exports` or `exports.x` usage

- **CommonJS modules**:
  - Use `module.exports` or `exports.x` syntax
  - No `export` or `export default` usage

- **Dual-format modules**:
  - Use conditional exports based on environment detection
  - Standardize module detection pattern

### ESM Compatibility
- Convert `__dirname` and `__filename` usage in ESM modules to:
  ```javascript
  import { fileURLToPath } from 'url';
  import path from 'path';
  
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  ```

## Implementation Phases

### Phase 1: Analysis and Planning
- ✅ Create enhanced module standardizer script
- ✅ Test script on small directories in dry-run mode
- ✅ Document standardization rules and patterns

### Phase 2: Core Module Updates
1. **Primary Utility Modules**
   - Update core utility modules
   - Focus on modules with few dependencies first
   - Test thoroughly after each module update

2. **Domain-Specific Modules**
   - Update each domain-specific module group
   - Follow dependency order to minimize breakage
   - Test domain functionality after updates

3. **Integration Modules**
   - Update modules that connect different parts of the system
   - Ensure cross-module compatibility

### Phase 3: Testing and Refinement
- Run comprehensive tests
- Fix any compatibility issues
- Ensure all module entry points work correctly

### Phase 4: Documentation and Completion
- Update documentation to reflect standardized approach
- Document any exceptions to the standard patterns
- Create guide for future module development

## Implementation Workflow
1. **Scan**: Run module standardizer in dry-run mode on target directory
2. **Review**: Review proposed changes
3. **Execute**: Run standardizer to make changes
4. **Test**: Run relevant tests to ensure functionality
5. **Fix**: Address any issues that arise
6. **Commit**: Commit changes for the module group

### UI Module Standardization
For UI component standardization, use the dedicated script:
```bash
# Run the UI module standardizer
./lib/zk/scripts/fixes/run-ui-standardization.sh
```

This will:
1. Run the standardization script on UI components
2. Generate a detailed report
3. Run regression tests to verify changes work correctly

## Migration Targets

The following module groups should be migrated in this order:

1. **Utilities**: Base utility modules with few dependencies
2. **Deployment**: Deployment infrastructure
3. **Circuits**: Circuit implementation and utilities
4. **Security**: Security modules
5. **API**: API endpoints and interfaces
6. **UI**: UI components and related utilities

## Progress Tracking

| Module Group | Analyzed | Fixed | Status | Notes |
|--------------|----------|-------|--------|-------|
| Utilities    | ✅      | ✅    | Completed | All utils/ files standardized to .mjs |
| Deployment   | ✅      | ✅    | Completed | All deployment files standardized |
| Resources    | ✅      | ✅    | Completed | Replaced all TypeScript resources with pure JS implementations |
| Circuits     | ✅      | ✅    | Completed | Circuit modules standardized with proper extensions |
| Security     | ✅      | ✅    | Completed | Security modules standardized; TypeScript files left as-is |
| API          | ✅      | ✅    | Completed | API endpoints standardized with proper extensions |
| UI           | ✅      | ✅    | Completed | Standardized 26 UI files (.js → .mjs), fixed mixed module in fullProve.js |

## Completion Status

✅ **All module groups have been successfully standardized!**

The module standardization plan has been fully implemented, with the following outcomes:

1. All JavaScript modules now follow standardized format rules:
   - ESM modules use .mjs extension
   - CommonJS modules use .cjs extension
   - Dual-format modules use .js extension
   - TypeScript modules continue to use .ts extension

2. Mixed module pattern warnings have been eliminated.

3. All imports now use proper extensions and patterns.

4. UI components have been standardized, with 26 files converted to use the .mjs extension.

5. The mixed module format in pages/api/zk/fullProve.js has been resolved.

6. TypeScript files have been updated to properly reference standardized modules.

## Next Steps

See [Next_Steps.md](./Next_Steps.md) for follow-up actions needed to complete the integration of standardized modules in the Next.js build system.

## Completion Criteria
- ✅ All JavaScript modules follow the standardized format rules
- ✅ No more mixed module pattern warnings in tests
- ✅ All imports use proper extensions and patterns
- ⏳ All tests pass successfully (in progress)
- ✅ Documentation is updated to reflect standardized approach