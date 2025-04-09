/**
 * Rollup configuration for the ZK infrastructure
 * 
 * This configuration builds CommonJS versions of our ESM source files
 * to ensure compatibility with both ESM and CommonJS environments.
 */

const resolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');

// Define the core modules that need CJS versions
const coreBundles = [
  {
    input: 'src/index.mjs',
    output: {
      file: 'cjs/index.cjs',
      format: 'cjs'
    }
  },
  {
    input: 'src/zkUtils.mjs',
    output: {
      file: 'cjs/zkUtils.cjs',
      format: 'cjs'
    }
  },
  {
    input: 'src/zkErrorHandler.mjs',
    output: {
      file: 'cjs/zkErrorHandler.cjs',
      format: 'cjs'
    }
  },
  {
    input: 'src/zkProofSerializer.js',
    output: {
      file: 'cjs/zkProofSerializer.cjs',
      format: 'cjs'
    }
  },
  {
    input: 'src/zkCircuitRegistry.mjs',
    output: {
      file: 'cjs/zkCircuitRegistry.cjs',
      format: 'cjs'
    }
  },
  {
    input: 'src/zkCircuitParameterDerivation.mjs',
    output: {
      file: 'cjs/zkCircuitParameterDerivation.cjs',
      format: 'cjs'
    }
  },
  {
    input: 'src/zkSecureInputs.mjs',
    output: {
      file: 'cjs/zkSecureInputs.cjs',
      format: 'cjs'
    }
  },
  {
    input: 'src/zkRecoverySystem.mjs',
    output: {
      file: 'cjs/zkRecoverySystem.cjs',
      format: 'cjs'
    }
  }
];

// Shared plugins for all bundles
const plugins = [
  resolve({
    preferBuiltins: true,
    // Specify extensions to include in resolution
    extensions: ['.js', '.ts']
  }),
  commonjs({
    // Convert node modules to ES modules
    transformMixedEsModules: true
  })
];

// External dependencies that should not be bundled
const external = [
  'crypto',
  'fs',
  'path',
  'util',
  'os',
  'snarkjs',
  'circomlib'
];

// Generate final config with shared settings
module.exports = coreBundles.map(bundle => ({
  ...bundle,
  plugins,
  external,
  // Prevent bundling of peer dependencies
  onwarn: warning => {
    // Skip circular dependency warnings for node_modules
    if (
      warning.code === 'CIRCULAR_DEPENDENCY' &&
      warning.importer.includes('node_modules')
    ) {
      return;
    }
    console.warn(warning.message);
  }
}));