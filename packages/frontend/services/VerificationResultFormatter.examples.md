# Verification Result Formatter Usage Examples

This document provides examples of how to use the Verification Result Formatter service.

## Basic Usage

```typescript
import { VerificationResultFormatter } from './services';
import { BigNumber } from 'ethers';

// Create a new formatter instance
const formatter = new VerificationResultFormatter();

// Format a successful verification
function handleSuccessfulVerification(verificationData) {
  const result = formatter.formatSuccess(
    'standard', // Proof type
    {
      wallet: '0x1234567890123456789012345678901234567890',
      amount: BigNumber.from('1000000000000000000'), // 1 ETH
      tokenSymbol: 'ETH',
      chainId: 1
    },
    {
      proofHash: 'abcdef1234567890',
      expiryTime: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days from now
    },
    500 // verification time in ms
  );
  
  console.log('Verification successful:', result);
  return result;
}

// Format a failed verification
function handleFailedVerification(error) {
  const result = formatter.formatFailure(
    'threshold',
    'ZK_ERROR',
    'Invalid proof format',
    {
      wallet: '0x1234567890123456789012345678901234567890',
      thresholdAmount: BigNumber.from('5000000000000000000'), // 5 ETH
      tokenSymbol: 'ETH'
    },
    error.details || {},
    {
      proofHash: 'abcdef1234567890'
    }
  );
  
  console.log('Verification failed:', result);
  return result;
}
```

## Integration with API Endpoints

```typescript
// In your API endpoint
import { VerificationResultFormatter } from '../services';
import snarkjsWrapper from '@proof-of-funds/common/zk-core/snarkjsWrapper';

export default async function verifyProofEndpoint(req, res) {
  const formatter = new VerificationResultFormatter();
  
  try {
    const { proofType, proof, publicSignals, wallet, amount, tokenSymbol } = req.body;
    
    // Validate inputs
    if (!proofType || !proof || !publicSignals) {
      return res.status(400).json(
        formatter.formatError(
          proofType || 'unknown',
          'VALIDATION_ERROR',
          'Missing required parameters',
          { missingParams: ['proofType', 'proof', 'publicSignals'].filter(p => !req.body[p]) }
        )
      );
    }
    
    // Get verification key
    const vkeyPath = `path/to/${proofType}Proof.vkey.json`;
    const vkeyJson = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));
    
    // Start timing
    const startTime = Date.now();
    
    // Verify proof
    const verified = await snarkjsWrapper.verify(vkeyJson, publicSignals, proof);
    
    // Calculate verification time
    const verificationTime = Date.now() - startTime;
    
    if (verified) {
      // Format successful result
      const result = formatter.formatSuccess(
        proofType,
        {
          wallet,
          amount: BigNumber.from(amount),
          tokenSymbol,
          publicInputs: publicSignals
        },
        {
          proofHash: proof.pi_a[0], // Example of using part of proof as hash
          expiryTime: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
        },
        verificationTime
      );
      
      return res.status(200).json(result);
    } else {
      // Format failure result
      const result = formatter.formatFailure(
        proofType,
        'VERIFICATION_FAILED',
        'Proof verification failed',
        {
          wallet,
          amount: BigNumber.from(amount),
          tokenSymbol,
          publicInputs: publicSignals
        },
        { 
          vkeyPath 
        },
        {},
        verificationTime
      );
      
      return res.status(400).json(result);
    }
  } catch (error) {
    // Handle unexpected errors
    const result = formatter.formatError(
      req.body?.proofType || 'unknown',
      'SERVER_ERROR',
      error.message,
      { stack: error.stack }
    );
    
    return res.status(500).json(result);
  }
}
```

## Integration with UI Components

```tsx
import React, { useState } from 'react';
import { VerificationResultFormatter } from '../services';
import ZKVerificationResult from '../components/ZKVerificationResult';

const formatter = new VerificationResultFormatter();

function ProofVerifier({ proof, publicSignals, proofType }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const verifyProof = async () => {
    setLoading(true);
    
    try {
      // Call your API endpoint
      const response = await fetch('/api/zk/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proof, publicSignals, proofType })
      });
      
      const data = await response.json();
      
      // Store the raw result
      setResult(data);
    } catch (error) {
      // Format error for consistent UI display
      setResult(formatter.formatError(
        proofType,
        'API_ERROR',
        'Failed to contact verification API',
        { message: error.message }
      ));
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      <h2>ZK Proof Verification</h2>
      
      <button 
        onClick={verifyProof}
        disabled={loading}
      >
        {loading ? 'Verifying...' : 'Verify Proof'}
      </button>
      
      {result && (
        <ZKVerificationResult
          verified={result.verified}
          proofType={result.proofType}
          proofDetails={formatter.formatForUI(result).proofDetails}
          verificationTime={result.verificationTime}
          errorMessage={result.error?.message}
        />
      )}
    </div>
  );
}
```

## Converting Legacy Results

```typescript
import { VerificationResultFormatter } from '../services';

const formatter = new VerificationResultFormatter();

// Function to process legacy verification result
function processLegacyVerification(legacyResult) {
  // Convert to new standardized format
  const standardResult = formatter.convertLegacyResult(legacyResult);
  
  // Now you can use the standardized result
  console.log('Standardized result:', standardResult);
  
  // Format for UI if needed
  const uiResult = formatter.formatForUI(standardResult);
  
  return {
    raw: standardResult,
    ui: uiResult
  };
}

// Example with a legacy result
const legacyResult = {
  verified: true,
  proofType: 'standard',
  proofDetails: {
    user: '0x1234567890123456789012345678901234567890',
    thresholdAmount: '1000000000000000000',
    tokenSymbol: 'ETH',
    timestamp: '2023-05-15T10:30:00Z',
    expiryTime: '2023-06-15T10:30:00Z',
    proofHash: '0xabcdef123456'
  },
  verificationTime: 350,
  publicSignals: ['1', '2', '3', '4']
};

const processed = processLegacyVerification(legacyResult);
```

## Different Proof Types

```typescript
import { VerificationResultFormatter } from '../services';
import { BigNumber } from 'ethers';

const formatter = new VerificationResultFormatter();

// Standard proof (exact amount)
function formatStandardProof(verified, wallet, amount, tokenSymbol) {
  return formatter.formatSuccess(
    'standard',
    {
      wallet,
      amount: BigNumber.from(amount),
      tokenSymbol
    }
  );
}

// Threshold proof (minimum amount)
function formatThresholdProof(verified, wallet, threshold, tokenSymbol) {
  return formatter.formatSuccess(
    'threshold',
    {
      wallet,
      thresholdAmount: BigNumber.from(threshold),
      tokenSymbol
    }
  );
}

// Maximum proof (maximum amount)
function formatMaximumProof(verified, wallet, maximum, tokenSymbol) {
  return formatter.formatSuccess(
    'maximum',
    {
      wallet,
      maximumAmount: BigNumber.from(maximum),
      tokenSymbol
    }
  );
}

// Balance proof (point-in-time balance)
function formatBalanceProof(verified, wallet, balance, tokenSymbol, timestamp) {
  return formatter.formatSuccess(
    'balance',
    {
      wallet,
      amount: BigNumber.from(balance),
      tokenSymbol,
      balanceDate: timestamp
    }
  );
}

// Transaction proof
function formatTransactionProof(verified, txHash, amount, tokenSymbol) {
  return formatter.formatSuccess(
    'transaction',
    {
      transactionHash: txHash,
      amount: BigNumber.from(amount),
      tokenSymbol
    }
  );
}

// Custom proof type
function formatCustomProof(verified, data) {
  return formatter.formatSuccess(
    'custom',
    data
  );
}
```