/**
 * ZK Proxy Client (CommonJS wrapper)
 * 
 * This module provides a unified interface for ZK proof operations that can transparently
 * choose between client-side and server-side execution based on browser capabilities,
 * user preferences, and operation complexity.
 */

'use strict';

// Direct CJS exports - this is the recommended format for CJS modules
try {
  // Try to load the zkProxyClient.js module first
  const proxyClient = require('./zkProxyClient.js');
  
  // Export all components for CJS compatibility
  module.exports = {
    zkProxyClient: proxyClient.zkProxyClient,
    ZKProxyClient: proxyClient.ZKProxyClient,
    EXECUTION_MODES: proxyClient.EXECUTION_MODES,
    RequestQueue: proxyClient.RequestQueue,
    RateLimiter: proxyClient.RateLimiter
  };
} catch (err) {
  console.error('Error loading zkProxyClient.js:', err);
  
  // Create basic fallback exports if the main module fails to load
  module.exports = {
    zkProxyClient: {
      initialize: async () => { throw new Error('zkProxyClient not properly loaded: ' + err.message); },
      generateProof: async () => { throw new Error('zkProxyClient not properly loaded: ' + err.message); },
      verifyProof: async () => { throw new Error('zkProxyClient not properly loaded: ' + err.message); }
    },
    EXECUTION_MODES: {
      CLIENT_SIDE: 'client',
      SERVER_SIDE: 'server',
      HYBRID: 'hybrid',
      AUTO: 'auto'
    }
  };
}