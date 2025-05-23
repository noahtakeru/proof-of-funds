/**
 * SnarkJS Web Worker Runtime Fix
 * 
 * This module provides a runtime fix for the _asyncToGenerator issue in snarkjs Web Workers.
 * It ensures that Babel runtime helpers are available in Web Worker contexts.
 */

// Ensure regenerator-runtime is available globally for async/await
if (typeof global !== 'undefined' && !global.regeneratorRuntime) {
  try {
    const regenerator = require('@babel/runtime/regenerator');
    global.regeneratorRuntime = regenerator.default || regenerator;
  } catch (e) {
    // Fallback if @babel/runtime/regenerator is not available
    console.warn('Failed to load regenerator-runtime for Web Workers');
  }
}

// Provide _asyncToGenerator helper globally for Web Workers
if (typeof global !== 'undefined' && !global._asyncToGenerator) {
  try {
    const asyncToGenerator = require('@babel/runtime/helpers/asyncToGenerator');
    global._asyncToGenerator = asyncToGenerator.default || asyncToGenerator;
  } catch (e) {
    // Fallback if @babel/runtime/helpers/asyncToGenerator is not available
    console.warn('Failed to load _asyncToGenerator helper for Web Workers');
  }
}

// Browser environment polyfills for Web Workers
if (typeof window !== 'undefined' && !window.regeneratorRuntime) {
  try {
    const regenerator = require('@babel/runtime/regenerator');
    window.regeneratorRuntime = regenerator.default || regenerator;
  } catch (e) {
    console.warn('Failed to load regenerator-runtime for browser');
  }
}

if (typeof window !== 'undefined' && !window._asyncToGenerator) {
  try {
    const asyncToGenerator = require('@babel/runtime/helpers/asyncToGenerator');
    window._asyncToGenerator = asyncToGenerator.default || asyncToGenerator;
  } catch (e) {
    console.warn('Failed to load _asyncToGenerator helper for browser');
  }
}

// Re-export snarkjs with runtime fixes applied
module.exports = require('snarkjs');