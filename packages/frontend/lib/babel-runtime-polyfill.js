/**
 * Babel Runtime Polyfill for Web Workers
 * 
 * This script ensures that Babel runtime helpers are available globally
 * before snarkjs creates Web Workers that need them.
 */

// Function to load and make runtime helpers available globally
function ensureBabelRuntimeHelpers() {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') return;

  try {
    // Dynamically import and set up regenerator runtime
    if (!window.regeneratorRuntime) {
      // For modern bundlers that support dynamic imports
      import('@babel/runtime/regenerator').then(regenerator => {
        window.regeneratorRuntime = regenerator.default || regenerator;
      }).catch(() => {
        // Fallback: create a minimal regenerator runtime
        window.regeneratorRuntime = {
          wrap: function(fn) { return fn; },
          mark: function(fn) { return fn; },
          awrap: function(arg) { return Promise.resolve(arg); }
        };
      });
    }

    // Set up _asyncToGenerator helper
    if (!window._asyncToGenerator) {
      // For modern bundlers that support dynamic imports
      import('@babel/runtime/helpers/asyncToGenerator').then(asyncToGenerator => {
        window._asyncToGenerator = asyncToGenerator.default || asyncToGenerator;
      }).catch(() => {
        // Fallback: create a minimal _asyncToGenerator helper
        window._asyncToGenerator = function(fn) {
          return function() {
            var gen = fn.apply(this, arguments);
            return new Promise(function(resolve, reject) {
              function step(key, arg) {
                try {
                  var info = gen[key](arg);
                  var value = info.value;
                } catch (error) {
                  reject(error);
                  return;
                }
                if (info.done) {
                  resolve(value);
                } else {
                  return Promise.resolve(value).then(function(value) {
                    step("next", value);
                  }, function(err) {
                    step("throw", err);
                  });
                }
              }
              return step("next");
            });
          };
        };
      });
    }
  } catch (error) {
    console.warn('Failed to load Babel runtime helpers:', error);
    
    // Provide minimal fallbacks
    if (!window.regeneratorRuntime) {
      window.regeneratorRuntime = {
        wrap: function(fn) { return fn; },
        mark: function(fn) { return fn; },
        awrap: function(arg) { return Promise.resolve(arg); }
      };
    }
    
    if (!window._asyncToGenerator) {
      window._asyncToGenerator = function(fn) {
        return function() {
          return Promise.resolve(fn.apply(this, arguments));
        };
      };
    }
  }
}

// Initialize immediately when script loads
ensureBabelRuntimeHelpers();

// Also make sure it's available as a global function
window.ensureBabelRuntimeHelpers = ensureBabelRuntimeHelpers;

export default ensureBabelRuntimeHelpers;