/**
 * @fileoverview Cross-platform deployment module (CommonJS wrapper)
 */

'use strict';

// This is a CommonJS wrapper around the ES Modules implementation
// It loads the compiled/bundled version of the ES module code

const deploymentSystem = require('../deployment.bundle.cjs');

module.exports = deploymentSystem;