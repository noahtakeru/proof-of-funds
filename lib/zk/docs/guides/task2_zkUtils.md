## Technical Debt Remediation Task: Fix Error Handling in zkUtils.js

### Background

Our regression tests show that zkUtils.js still has try/catch blocks that don't use our error logging system. This file is one of the core utility files for our Zero-Knowledge proof system, and improving its error handling will enhance the reliability of all ZK operations across the application.

### File to Modify

`/Users/karpel/Documents/GitHub/proof-of-funds/lib/zk/src/zkUtils.js`

### Task Requirements

Implement proper error handling that:
- Uses the zkErrorLogger system for all try/catch blocks
- Follows established error patterns (operation IDs, structured data, etc.)
- Preserves the original functionality
- Doesn't change the module format (that's a separate issue)

### Step 1: Understand the File's Purpose

The zkUtils.js file contains core utilities for ZK proof operations. Before modifying, make sure you understand:
- The proof serialization/deserialization functions
- Hash generation utilities
- How address validation works
- Other ZK-specific utility functions
- How errors in these functions affect the overall ZK workflow

### Step 2: Implement Proper Error Handling

1. Add required imports for error handling (if not already present):
```javascript
import {
  ErrorCode,
  ErrorSeverity,
  SystemError,
  ProofError,
  InputError,
  isZKError
} from './zkErrorHandler.js';
import { zkErrorLogger } from './zkErrorLogger.js';
```

2. Create a specialized error class for ZK utilities operations:
```javascript
class ZKUtilsError extends SystemError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
      severity: options.severity || ErrorSeverity.ERROR,
      recoverable: options.recoverable !== undefined ? options.recoverable : true,
      details: {
        ...(options.details || {}),
        component: 'ZKUtils',
        operation: options.operation || 'unknown',
        operationId: options.operationId || `zk_utils_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
      }
    });
    
    this.name = 'ZKUtilsError';
    
    // Capture current stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ZKUtilsError);
    }
  }
}
```

3. Implement a helper function for logging errors:
```javascript
function logError(error, additionalInfo = {}) {
  // If error is null/undefined, create a generic error
  if (!error) {
    error = new Error('Unknown error in ZK Utils');
  }

  // Convert to ZKUtilsError if it's not already a specialized error
  if (!isZKError(error)) {
    const operationId = additionalInfo.operationId || `zk_utils_error_${Date.now()}`;
    error = new ZKUtilsError(error.message || 'Unknown error in ZK utilities', {
      operationId,
      details: {
        originalError: error,
        ...additionalInfo
      }
    });
  }

  // Log the error
  if (zkErrorLogger && zkErrorLogger.logError) {
    zkErrorLogger.logError(error, additionalInfo);
  } else {
    console.error('[ZKUtils]', error.message, additionalInfo);
  }
  
  return error;
}
```

4. Enhance proof hash generation with proper error handling:
```javascript
export function generateZKProofHash(proof, publicSignals) {
  const operationId = `generate_proof_hash_${Date.now()}`;
  
  try {
    const serialized = JSON.stringify({ proof, publicSignals });
    return '0x' + sha256(serialized);
  } catch (error) {
    const hashError = new ZKUtilsError(`Failed to generate proof hash: ${error.message}`, {
      code: ErrorCode.PROOF_SERIALIZATION_FAILED,
      severity: ErrorSeverity.ERROR,
      operation: 'generateZKProofHash',
      operationId,
      details: {
        hasProof: !!proof,
        hasPublicSignals: !!publicSignals,
        errorType: error.name || typeof error,
        timestamp: new Date().toISOString()
      },
      originalError: error
    });
    
    logError(hashError, { context: 'generateZKProofHash' });
    throw hashError;
  }
}
```

5. Fix the address validation function:
```javascript
export function validateAddress(address) {
  const operationId = `validate_address_${Date.now()}`;
  
  try {
    // Check if the address is valid and add the prefix if needed
    const prefixedAddress = address.startsWith('0x') ? address : `0x${address}`;
    return ethers.utils.getAddress(prefixedAddress);
  } catch (error) {
    const validationError = new InputError(`Invalid Ethereum address: ${error.message}`, {
      code: ErrorCode.INPUT_VALIDATION_FAILED,
      severity: ErrorSeverity.WARNING,
      operation: 'validateAddress',
      operationId,
      details: {
        providedAddress: address ? `${address.substring(0, 6)}...` : 'undefined',
        errorType: error.name || typeof error,
        timestamp: new Date().toISOString()
      },
      originalError: error
    });
    
    logError(validationError, { context: 'validateAddress' });
    throw validationError;
  }
}
```

6. Fix the serialization function:
```javascript
export function serializeZKProof(proof, publicSignals) {
  const operationId = `serialize_proof_${Date.now()}`;
  
  try {
    // Log start of operation
    zkErrorLogger.log('DEBUG', 'Serializing ZK proof', {
      operationId,
      details: {
        hasProof: !!proof,
        hasPublicSignals: !!publicSignals,
        operation: 'serializeZKProof'
      }
    });
    
    return {
      proof: JSON.stringify(proof),
      publicSignals: Array.isArray(publicSignals) ? publicSignals.map(s => s.toString()) : publicSignals
    };
  } catch (error) {
    const serializeError = new ProofError(`Failed to serialize ZK proof: ${error.message}`, {
      code: ErrorCode.PROOF_SERIALIZATION_FAILED,
      severity: ErrorSeverity.ERROR,
      operation: 'serializeZKProof',
      operationId,
      details: {
        hasProof: !!proof,
        hasPublicSignals: !!publicSignals,
        errorType: error.name || typeof error,
        timestamp: new Date().toISOString()
      },
      originalError: error
    });
    
    logError(serializeError, { context: 'serializeZKProof' });
    throw serializeError;
  }
}
```

7. Fix the deserialization function:
```javascript
export function deserializeZKProof(proofStr, publicSignalsStr) {
  const operationId = `deserialize_proof_${Date.now()}`;
  
  try {
    // Log start of operation
    zkErrorLogger.log('DEBUG', 'Deserializing ZK proof', {
      operationId,
      details: {
        hasProofStr: !!proofStr,
        hasPublicSignalsStr: !!publicSignalsStr,
        operation: 'deserializeZKProof'
      }
    });
    
    return {
      proof: typeof proofStr === 'string' ? JSON.parse(proofStr) : proofStr,
      publicSignals: Array.isArray(publicSignalsStr) ? publicSignalsStr : JSON.parse(publicSignalsStr)
    };
  } catch (error) {
    const deserializeError = new ProofError(`Failed to deserialize ZK proof: ${error.message}`, {
      code: ErrorCode.PROOF_DESERIALIZATION_FAILED,
      severity: ErrorSeverity.ERROR,
      operation: 'deserializeZKProof',
      operationId,
      details: {
        hasProofStr: !!proofStr,
        proofStrType: typeof proofStr,
        hasPublicSignalsStr: !!publicSignalsStr,
        publicSignalsStrType: typeof publicSignalsStr,
        errorType: error.name || typeof error,
        timestamp: new Date().toISOString()
      },
      originalError: error
    });
    
    logError(deserializeError, { context: 'deserializeZKProof' });
    throw deserializeError;
  }
}
```

8. Fix any numeric conversion utilities:
```javascript
export function ensureNumeric(value) {
  const operationId = `ensure_numeric_${Date.now()}`;
  
  try {
    let numValue;
    numValue = typeof value === 'bigint' ? Number(value) : Number(value);
    
    if (isNaN(numValue)) {
      throw new Error('Value cannot be converted to a number');
    }
    
    return numValue;
  } catch (error) {
    const conversionError = new InputError(`Failed to convert value to number: ${error.message}`, {
      code: ErrorCode.INPUT_CONVERSION_FAILED,
      severity: ErrorSeverity.WARNING,
      operation: 'ensureNumeric',
      operationId,
      details: {
        providedValue: value,
        valueType: typeof value,
        errorType: error.name || typeof error,
        timestamp: new Date().toISOString()
      },
      originalError: error
    });
    
    logError(conversionError, { context: 'ensureNumeric' });
    throw conversionError;
  }
}
```

### Step 3: Testing

1. Run the regression tests to ensure your changes fix the warnings:
```bash
cd /Users/karpel/Documents/GitHub/proof-of-funds && node ./lib/zk/tests/regression/enhanced-runner.cjs
```

2. Check specifically if the warnings for this file are gone:
```bash
cd /Users/karpel/Documents/GitHub/proof-of-funds && node ./lib/zk/tests/regression/enhanced-runner.cjs | grep "zkUtils.js"
```

3. Ensure the file still functions properly by running the associated tests:
```bash
cd /Users/karpel/Documents/GitHub/proof-of-funds && node ./lib/zk/__tests__/zkUtils.test.js
```

### Step 4: Documentation

1. Update function JSDoc comments to reflect error handling behavior
2. Add comments explaining key algorithms and security measures
3. Make sure error messages are clear and actionable

### Success Criteria

- No warnings about "Try/catch without error logging" for zkUtils.js
- All try/catch blocks use proper error handling with:
  - Operation IDs
  - Detailed context
  - Appropriate error classes
  - Severity levels
- The original utility functionality is preserved
- The code follows our project's error handling patterns

### Additional Notes

- Be careful with sensitive data in error logging
- Add performance metrics for expensive operations (serialization of large proofs)
- Consider graceful fallbacks for non-critical errors
- Use consistent error codes for similar error scenarios
- Since this is a core utility file, changes here may affect many parts of the application. Test thoroughly.