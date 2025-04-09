# Module System Architecture

## Overview

The Proof of Funds ZK infrastructure uses a dual-format module system to ensure compatibility across different JavaScript environments. The system allows importing the code using both CommonJS (CJS) and ECMAScript Modules (ESM) formats, making it usable in Node.js, browsers, and various build tools.

## Design Principles

1. **Compatibility**: Support for both CommonJS and ESM import patterns
2. **Consistency**: Same API surface regardless of import method
3. **Maintainability**: Single source of truth with automated conversions between formats
4. **Performance**: Minimal overhead when converting between formats

## Package Structure

The module system is structured as follows:

```
lib/zk/
├── src/          # Source files (primarily ESM format)
│   ├── *.js      # CommonJS format files
│   ├── *.mjs     # ESM format files
│   └── ...
├── cjs/          # CommonJS compatibility files
│   ├── *.cjs     # Generated CommonJS modules
│   └── ...
└── package.json  # Exports configuration
```

## Package.json Configuration

The `package.json` file is configured to support dual-format modules using the `exports` field:

```json
{
  "type": "commonjs",
  "main": "src/index.mjs",
  "exports": {
    ".": {
      "import": "./src/index.mjs",
      "require": "./cjs/index.cjs"
    },
    "./utils": {
      "import": "./src/zkUtils.mjs",
      "require": "./cjs/zkUtils.cjs"
    },
    ...
  }
}
```

This configuration allows:
- ESM imports: `import { ... } from 'proof-of-funds-zk'`
- CommonJS requires: `const { ... } = require('proof-of-funds-zk')`

## Import Patterns

### ESM Imports

```javascript
// Named imports
import { zkUtils, zkErrorHandler } from 'proof-of-funds-zk';

// Default import
import ZK from 'proof-of-funds-zk';

// Specific module import
import { serializeProof } from 'proof-of-funds-zk/proof';
```

### CommonJS Imports

```javascript
// Full module
const ZK = require('proof-of-funds-zk');

// Destructured import
const { zkUtils, zkErrorHandler } = require('proof-of-funds-zk');

// Specific module
const { serializeProof } = require('proof-of-funds-zk/proof');
```

## Module Conversion Process

The conversion from ESM to CommonJS is handled using a build process:

1. ESM modules in `src/*.mjs` are the primary source of truth
2. A build script generates CommonJS versions in `cjs/*.cjs`
3. The conversion ensures all named exports and default exports are preserved

## Implementation Details

- All modules support both named exports and default exports
- Default exports include all named exports for consistent usage
- CommonJS modules use `module.exports` for compatibility
- ESM modules use `export` and `export default` syntax

## Module Standardization

The standardization effort ensures:

1. Consistent API across all modules
2. Proper inheritance of error types
3. Support for browser, Node.js, and hybrid environments
4. Clear documentation for both import styles

## Best Practices

When developing new modules:

1. Start with ESM format (`.mjs` extension)
2. Ensure all exports are named exports
3. Include a default export that aggregates all named exports
4. Run the build process to generate CommonJS versions
5. Test both import styles before committing

## Testing

The module system can be verified using:

```bash
# Original test (may show some limitations)
node lib/zk/tests/unit/module-system-test.cjs

# Enhanced compatibility test (for full validation)
node lib/zk/tests/unit/module-compatibility-test.js
```

These tests ensure that both ESM and CommonJS imports work correctly and that the API is consistent across formats.

## Compatibility Layer

The compatibility layer includes:

1. **moduleLoader.js/cjs**: A helper utility for dynamically loading modules in the appropriate format.
2. **ESM/CJS conversions**: Proper imports/exports in both formats.
3. **Identical APIs**: Functions with identical signatures across formats.

## Implementation Status

- All core modules (`zkUtils`, `zkProofSerializer`, etc.) now support both ESM and CJS formats
- The package.json exports field properly resolves imports in both formats
- Helper utilities ensure consistent behavior regardless of environment

This standardization ensures maximum compatibility while maintaining a clean, maintainable codebase.