// Simple test file for zkErrorHandler.cjs

// Import module
const zkErrorHandler = require('./lib/zk/cjs/zkErrorHandler.cjs');

// Basic verification
console.log("Checking ZK Error Handler components...");
console.log(Object.keys(zkErrorHandler));

// Create test error
try {
  const testError = new zkErrorHandler.ZKError("Test error", {
    code: zkErrorHandler.ErrorCode.INPUT_VALIDATION_FAILED,
    severity: zkErrorHandler.ErrorSeverity.ERROR,
    category: zkErrorHandler.ErrorCategory.INPUT,
    recoverable: true
  });
  
  console.log("Test error created:", testError.message);
  console.log("Code:", testError.code);
  console.log("Severity:", testError.severity);
  console.log("Category:", testError.category);
  console.log("Recoverable:", testError.recoverable);
  
  console.log("Error handling framework test: PASS");
} catch (error) {
  console.error("Error creating test error:", error);
  console.log("Error handling framework test: FAIL");
}
