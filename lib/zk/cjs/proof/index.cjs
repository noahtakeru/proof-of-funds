/**
 * @fileoverview Proof Size Optimization Module (CommonJS wrapper)
 */

'use strict';

// This is a CommonJS wrapper around the ES Modules implementation
// It loads the compiled/bundled version of the ES module code

const proofOptimization = require('../proof.bundle.cjs');

module.exports = proofOptimization;