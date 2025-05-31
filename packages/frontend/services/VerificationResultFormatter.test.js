/**
 * Tests for VerificationResultFormatter service
 */

import { VerificationResultFormatter } from './VerificationResultFormatter';
import { BigNumber } from 'ethers';

describe('VerificationResultFormatter', () => {
  let formatter;
  
  beforeEach(() => {
    formatter = new VerificationResultFormatter();
    // Mock Date.now for predictable timestamps
    jest.spyOn(Date, 'now').mockImplementation(() => 1622551200000); // 2021-06-01T12:00:00Z
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should format a successful verification result', () => {
    const result = formatter.formatSuccess(
      'standard',
      {
        wallet: '0x1234567890123456789012345678901234567890',
        amount: BigNumber.from('1000000000000000000'),
        tokenSymbol: 'ETH'
      },
      {
        proofHash: 'abcdef1234567890',
        expiryTime: 1622637600 // 2021-06-02T12:00:00Z
      },
      500 // verification time in ms
    );

    expect(result).toMatchObject({
      status: 'success',
      proofType: 'standard',
      timestamp: 1622551200,
      verified: true,
      verificationTime: 500,
      data: {
        wallet: '0x1234567890123456789012345678901234567890',
        tokenSymbol: 'ETH'
      },
      metadata: {
        version: '1.0.0',
        proofHash: 'abcdef1234567890',
        expiryTime: 1622637600
      }
    });

    // Verify that BigNumber objects are preserved
    expect(result.data.amount).toBeInstanceOf(BigNumber);
    expect(result.data.amount.toString()).toBe('1000000000000000000');
  });

  test('should format a failure verification result', () => {
    const result = formatter.formatFailure(
      'threshold',
      'ZK_ERROR',
      'Invalid proof format',
      {
        wallet: '0x1234567890123456789012345678901234567890',
        thresholdAmount: BigNumber.from('5000000000000000000'),
        tokenSymbol: 'ETH'
      },
      {
        invalidInput: 'publicInput[2]'
      },
      {
        proofHash: 'abcdef1234567890'
      },
      350 // verification time in ms
    );

    expect(result).toMatchObject({
      status: 'failure',
      proofType: 'threshold',
      timestamp: 1622551200,
      verified: false,
      verificationTime: 350,
      data: {
        wallet: '0x1234567890123456789012345678901234567890',
        tokenSymbol: 'ETH'
      },
      metadata: {
        version: '1.0.0',
        proofHash: 'abcdef1234567890'
      },
      error: {
        code: 'ZK_ERROR',
        message: 'Invalid proof format',
        details: {
          invalidInput: 'publicInput[2]'
        },
        errorType: 'ZK'
      }
    });

    // Verify that BigNumber objects are preserved
    expect(result.data.thresholdAmount).toBeInstanceOf(BigNumber);
    expect(result.data.thresholdAmount.toString()).toBe('5000000000000000000');
  });

  test('should format an error result', () => {
    const result = formatter.formatError(
      'maximum',
      'CIRCUIT_ERROR',
      'Verification key not found',
      {
        vkeyPath: '/path/to/missing/vkey.json'
      },
      {
        circuitVersion: '1.2.3'
      }
    );

    expect(result).toMatchObject({
      status: 'error',
      proofType: 'maximum',
      timestamp: 1622551200,
      verified: false,
      data: {},
      metadata: {
        version: '1.0.0',
        circuitVersion: '1.2.3'
      },
      error: {
        code: 'CIRCUIT_ERROR',
        message: 'Verification key not found',
        details: {
          vkeyPath: '/path/to/missing/vkey.json'
        },
        errorType: 'CIRCUIT'
      }
    });
  });

  test('should format a pending verification result', () => {
    const result = formatter.formatPending(
      'transaction',
      {
        wallet: '0x1234567890123456789012345678901234567890',
        transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      },
      {
        submittedAt: 1622550900 // 5 minutes ago
      }
    );

    expect(result).toMatchObject({
      status: 'pending',
      proofType: 'transaction',
      timestamp: 1622551200,
      verified: false,
      data: {
        wallet: '0x1234567890123456789012345678901234567890',
        transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      },
      metadata: {
        version: '1.0.0',
        submittedAt: 1622550900
      }
    });
  });

  test('should format a result for UI display', () => {
    const verificationResult = formatter.formatSuccess(
      'standard',
      {
        wallet: '0x1234567890123456789012345678901234567890',
        amount: BigNumber.from('1000000000000000000'),
        tokenSymbol: 'ETH',
        chainId: 1
      },
      {
        proofHash: 'abcdef1234567890',
        expiryTime: 1622637600 // 2021-06-02T12:00:00Z
      },
      500 // verification time in ms
    );

    const uiResult = formatter.formatForUI(verificationResult);

    expect(uiResult).toMatchObject({
      verified: true,
      status: 'success',
      proofType: 'Standard (Exact Amount)',
      timestamp: '6/1/2021, 12:00:00 PM', // Formatted date
      expiryTime: '6/2/2021, 12:00:00 PM', // Formatted date
      verificationTime: '500ms',
      proofDetails: {
        user: '0x1234567890123456789012345678901234567890',
        thresholdAmount: '1000000000000000000',
        tokenSymbol: 'ETH',
        proofHash: 'abcdef1234567890',
        chainId: '1'
      }
    });
  });

  test('should convert a legacy verification result to the new format', () => {
    const legacyResult = {
      verified: true,
      proofType: 'threshold',
      proofDetails: {
        user: '0x1234567890123456789012345678901234567890',
        thresholdAmount: '2500000000000000000',
        tokenSymbol: 'ETH',
        timestamp: '2021-05-31T12:00:00Z',
        expiryTime: '2021-06-30T12:00:00Z',
        proofHash: 'abcdef1234567890'
      },
      verificationTime: 620,
      publicSignals: ['1', '2', '3']
    };

    const result = formatter.convertLegacyResult(legacyResult);

    expect(result).toMatchObject({
      status: 'success',
      proofType: 'threshold',
      timestamp: 1622551200,
      verified: true,
      verificationTime: 620,
      data: {
        wallet: '0x1234567890123456789012345678901234567890',
        amount: '2500000000000000000',
        tokenSymbol: 'ETH',
        publicInputs: ['1', '2', '3']
      },
      metadata: {
        version: '1.0.0',
        proofHash: 'abcdef1234567890',
        expiryTime: 1625054400 // 2021-06-30T12:00:00Z in seconds
      }
    });
  });

  test('should convert a failed legacy verification result to the new format', () => {
    const legacyResult = {
      verified: false,
      proofType: 'standard',
      proofDetails: {
        user: '0x1234567890123456789012345678901234567890',
        thresholdAmount: '1000000000000000000',
        tokenSymbol: 'ETH'
      },
      errorMessage: 'Invalid proof format',
      errorType: 'ZK_ERROR',
      verificationTime: 320,
      publicSignals: ['1', '2', '3'],
      vkeyPath: '/path/to/vkey.json'
    };

    const result = formatter.convertLegacyResult(legacyResult);

    expect(result).toMatchObject({
      status: 'failure',
      proofType: 'standard',
      timestamp: 1622551200,
      verified: false,
      verificationTime: 320,
      data: {
        wallet: '0x1234567890123456789012345678901234567890',
        amount: '1000000000000000000',
        tokenSymbol: 'ETH',
        publicInputs: ['1', '2', '3']
      },
      metadata: {
        version: '1.0.0'
      },
      error: {
        code: 'ZK_ERROR',
        message: 'Invalid proof format',
        details: { vkeyPath: '/path/to/vkey.json' },
        errorType: 'ZK'
      }
    });
  });
});