# Module Compatibility in the Proof of Funds Application

This document explains how we handle module compatibility between CommonJS (CJS) and ES Modules (ESM) in the Proof of Funds application, with a focus on the Zero-Knowledge (ZK) proof system.

## Background

The codebase uses a mix of module systems:

- **Frontend**: Uses ES Modules (import/export)
- **Node.js Scripts**: Use CommonJS (require/module.exports)
- **Libraries**: Some libraries are ESM-only (like snarkjs), others are CJS-only, and some are dual-mode

This mix can cause compatibility issues, especially when importing ESM modules from CJS code.

## Our Solution

We've implemented a dual-mode compatibility approach for critical modules:

### 1. Dual-mode modules

The `snarkjsWrapper.js` file supports both ESM and CommonJS import patterns:

```javascript
// ESM exports
export default exportsObj;
export { fullProve, verify, /* ... */ };

// Support for CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = exportsObj;
}
```

### 2. Format-specific modules

We maintain separate versions of critical files:
- `.js` files with ESM syntax (import/export)
- `.cjs` files with CommonJS syntax (require/module.exports)

### 3. Smart imports

The `loadSnarkJS()` function tries both import methods:

```javascript
async function loadSnarkJS() {
  try {
    // Try CommonJS first if in a CJS environment
    if (typeof require !== 'undefined') {
      try {
        return require('snarkjs');
      } catch (requireError) {
        // Fall back to dynamic import
      }
    }
    
    // For ESM environments
    const snarkjs = await import('snarkjs');
    return snarkjs;
  } catch (error) {
    throw new Error(`Failed to load snarkjs: ${error.message}`);
  }
}
```

### 4. Module conversion utility

We've created a module format conversion utility:
- `scripts/convert-module-format.js`

This script helps convert between ESM and CJS formats when needed.

## Best Practices

When working with modules in this codebase:

1. **Use dynamic imports** where possible: `const snarkjs = await import('snarkjs')`
2. **Prefer .mjs extension** for ES Modules and **.cjs** for CommonJS files to be explicit
3. **Use the dual-mode pattern** for modules that need to be imported by both systems
4. **Check the environment** before using environment-specific APIs
5. **Test both environments** to ensure compatibility

## Troubleshooting

If you encounter module compatibility issues:

1. Check if you're mixing module systems
2. Try using the appropriate file extension (.mjs or .cjs)
3. Use the convert-module-format.js utility if needed
4. For browser-specific issues, check webpack polyfills in next.config.js