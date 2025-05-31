/**
 * Verification Result Formatter Tests
 */
import { BigNumber } from 'ethers';
import VerificationResultFormatter, {
  VerificationResult,
  ProofType,
  VerificationStatus
} from '../VerificationResultFormatter';
import { mockDateNow, restoreDateNow } from './helpers/date-mock';

describe('VerificationResultFormatter', () => {
  let formatter: VerificationResultFormatter;
  let dateNowSpy: jest.SpyInstance;
  
  // Set up a fixed timestamp for testing
  const mockTimestamp = 1620000000;
  
  beforeEach(() => {
    formatter = new VerificationResultFormatter();
    
    // Mock Date.now for consistent timestamps
    const mockDate = new Date(mockTimestamp * 1000);
    dateNowSpy = mockDateNow(mockDate);
  });

  afterEach(() => {
    restoreDateNow(dateNowSpy);
  });

  describe('formatSuccess', () => {
    it('should format a successful standard proof verification', () => {
      const proofType: ProofType = 'standard';
      const data = {
        wallet: '0x123',
        amount: BigNumber.from('1000000000000000000'),
        tokenSymbol: 'ETH',
        threshold: BigNumber.from('500000000000000000')
      };
      const metadata = {
        proofHash: 'abcdef123456',
        createdBy: 'test-app'
      };
      const verificationTime = 150; // ms
      
      const result = formatter.formatSuccess(proofType, data, metadata, verificationTime);
      
      expect(result.status).toBe('success');
      expect(result.proofType).toBe(proofType);
      expect(result.timestamp).toBe(mockTimestamp);
      expect(result.verified).toBe(true);
      expect(result.verificationTime).toBe(verificationTime);
      expect(result.data).toEqual(data);
      expect(result.metadata).toEqual({
        ...metadata,
        version: '1.0.0'
      });
      expect(result.error).toBeUndefined();
    });

    it('should handle minimal input for successful verification', () => {
      const result = formatter.formatSuccess('threshold', {});
      
      expect(result.status).toBe('success');
      expect(result.proofType).toBe('threshold');
      expect(result.verified).toBe(true);
      expect(result.data).toEqual({});
      expect(result.metadata).toEqual({
        version: '1.0.0'
      });
    });
  });

  describe('formatFailure', () => {
    it('should format a failed verification result', () => {
      const proofType: ProofType = 'maximum';
      const errorCode = 'ZK_PROOF_INVALID';
      const errorMessage = 'Proof verification failed';
      const data = {
        wallet: '0x123',
        maxBalance: BigNumber.from('10000000000000000000')
      };
      const errorDetails = {
        invalidInput: 'maxBalance',
        reason: 'Value exceeds threshold'
      };
      const metadata = {
        proofHash: 'abcdef123456'
      };
      const verificationTime = 200; // ms
      
      const result = formatter.formatFailure(
        proofType,
        errorCode,
        errorMessage,
        data,
        errorDetails,
        metadata,
        verificationTime
      );
      
      expect(result.status).toBe('failure');
      expect(result.proofType).toBe(proofType);
      expect(result.timestamp).toBe(mockTimestamp);
      expect(result.verified).toBe(false);
      expect(result.verificationTime).toBe(verificationTime);
      expect(result.data).toEqual(data);
      expect(result.metadata).toEqual({
        ...metadata,
        version: '1.0.0'
      });
      expect(result.error).toEqual({
        code: errorCode,
        message: errorMessage,
        details: errorDetails,
        errorType: 'ZK'
      });
    });

    it('should handle minimal input for failed verification', () => {
      const result = formatter.formatFailure(
        'balance',
        'VALIDATION_ERROR',
        'Invalid input'
      );
      
      expect(result.status).toBe('failure');
      expect(result.verified).toBe(false);
      expect(result.data).toEqual({});
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.message).toBe('Invalid input');
      expect(result.error?.errorType).toBe('VALIDATION');
    });
  });

  describe('formatError', () => {
    it('should format an error result', () => {
      const proofType: ProofType = 'transaction';
      const errorCode = 'SYSTEM_ERROR';
      const errorMessage = 'Service unavailable';
      const errorDetails = {
        service: 'zkProof',
        status: 500
      };
      const metadata = {
        requestId: '123456'
      };
      
      const result = formatter.formatError(
        proofType,
        errorCode,
        errorMessage,
        errorDetails,
        metadata
      );
      
      expect(result.status).toBe('error');
      expect(result.proofType).toBe(proofType);
      expect(result.timestamp).toBe(mockTimestamp);
      expect(result.verified).toBe(false);
      expect(result.data).toEqual({});
      expect(result.metadata).toEqual({
        ...metadata,
        version: '1.0.0'
      });
      expect(result.error).toEqual({
        code: errorCode,
        message: errorMessage,
        details: errorDetails,
        errorType: 'SYSTEM'
      });
    });

    it('should handle minimal input for error', () => {
      const result = formatter.formatError(
        'custom',
        'NETWORK_ERROR',
        'Connection failed'
      );
      
      expect(result.status).toBe('error');
      expect(result.verified).toBe(false);
      expect(result.data).toEqual({});
      expect(result.error?.code).toBe('NETWORK_ERROR');
      expect(result.error?.message).toBe('Connection failed');
      expect(result.error?.errorType).toBe('NETWORK');
    });
  });

  describe('formatPending', () => {
    it('should format a pending verification result', () => {
      const proofType: ProofType = 'standard';
      const data = {
        wallet: '0x123',
        amount: BigNumber.from('1000000000000000000')
      };
      const metadata = {
        requestId: '123456',
        queuePosition: 2
      };
      
      const result = formatter.formatPending(proofType, data, metadata);
      
      expect(result.status).toBe('pending');
      expect(result.proofType).toBe(proofType);
      expect(result.timestamp).toBe(mockTimestamp);
      expect(result.verified).toBe(false);
      expect(result.data).toEqual(data);
      expect(result.metadata).toEqual({
        ...metadata,
        version: '1.0.0'
      });
      expect(result.error).toBeUndefined();
    });

    it('should handle minimal input for pending verification', () => {
      const result = formatter.formatPending('threshold');
      
      expect(result.status).toBe('pending');
      expect(result.proofType).toBe('threshold');
      expect(result.verified).toBe(false);
      expect(result.data).toEqual({});
      expect(result.metadata).toEqual({
        version: '1.0.0'
      });
    });
  });

  describe('formatForUI', () => {
    it('should format a success result for UI display', () => {
      const verificationResult: VerificationResult = {
        status: 'success',
        proofType: 'standard',
        timestamp: mockTimestamp,
        verificationTime: 150,
        verified: true,
        data: {
          wallet: '0x123abc',
          amount: BigNumber.from('1000000000000000000'),
          tokenSymbol: 'ETH',
          publicInputs: ['0x123', '0x456']
        },
        metadata: {
          version: '1.0.0',
          proofHash: 'abcdef123456',
          expiryTime: mockTimestamp + 3600
        }
      };
      
      const uiResult = formatter.formatForUI(verificationResult);
      
      expect(uiResult.verified).toBe(true);
      expect(uiResult.status).toBe('success');
      expect(uiResult.proofType).toBe('Standard (Exact Amount)');
      expect(uiResult.timestamp).toEqual(new Date(mockTimestamp * 1000).toLocaleString());
      expect(uiResult.expiryTime).toEqual(new Date((mockTimestamp + 3600) * 1000).toLocaleString());
      expect(uiResult.verificationTime).toBe('150ms');
      
      expect(uiResult.proofDetails.user).toBe('0x123abc');
      expect(uiResult.proofDetails.thresholdAmount).toBe('1000000000000000000');
      expect(uiResult.proofDetails.tokenSymbol).toBe('ETH');
      expect(uiResult.proofDetails.proofHash).toBe('abcdef123456');
    });

    it('should format a failure result for UI display', () => {
      const verificationResult: VerificationResult = {
        status: 'failure',
        proofType: 'threshold',
        timestamp: mockTimestamp,
        verificationTime: 200,
        verified: false,
        data: {
          wallet: '0x123abc',
          amount: BigNumber.from('500000000000000000'),
          tokenSymbol: 'ETH'
        },
        metadata: {
          version: '1.0.0'
        },
        error: {
          code: 'ZK_PROOF_INVALID',
          message: 'Proof verification failed',
          details: { reason: 'Threshold not met' },
          errorType: 'ZK'
        }
      };
      
      const uiResult = formatter.formatForUI(verificationResult);
      
      expect(uiResult.verified).toBe(false);
      expect(uiResult.status).toBe('failure');
      expect(uiResult.proofType).toBe('Threshold (Minimum Amount)');
      expect(uiResult.verificationTime).toBe('200ms');
      
      expect(uiResult.errorMessage).toBe('Proof verification failed');
      expect(uiResult.errorCode).toBe('ZK_PROOF_INVALID');
      expect(uiResult.errorDetails).toEqual({ reason: 'Threshold not met' });
    });

    it('should handle different proof types', () => {
      // Test different proof types for name formatting
      const proofTypes: ProofType[] = ['standard', 'threshold', 'maximum', 'balance', 'transaction', 'custom'];
      const expectedNames = [
        'Standard (Exact Amount)',
        'Threshold (Minimum Amount)',
        'Maximum (Maximum Amount)',
        'Balance Proof',
        'Transaction Proof',
        'Custom'
      ];
      
      proofTypes.forEach((type, index) => {
        const result = formatter.formatForUI({
          status: 'success',
          proofType: type,
          timestamp: mockTimestamp,
          verified: true,
          data: {},
          metadata: { version: '1.0.0' }
        });
        
        expect(result.proofType).toBe(expectedNames[index]);
      });
    });

    it('should format verification time correctly', () => {
      // Test milliseconds
      let result = formatter.formatForUI({
        status: 'success',
        proofType: 'standard',
        timestamp: mockTimestamp,
        verificationTime: 150,
        verified: true,
        data: {},
        metadata: { version: '1.0.0' }
      });
      expect(result.verificationTime).toBe('150ms');
      
      // Test seconds
      result = formatter.formatForUI({
        status: 'success',
        proofType: 'standard',
        timestamp: mockTimestamp,
        verificationTime: 1500,
        verified: true,
        data: {},
        metadata: { version: '1.0.0' }
      });
      expect(result.verificationTime).toBe('1.50s');
      
      // Test no verification time
      result = formatter.formatForUI({
        status: 'success',
        proofType: 'standard',
        timestamp: mockTimestamp,
        verified: true,
        data: {},
        metadata: { version: '1.0.0' }
      });
      expect(result.verificationTime).toBe('Unknown');
    });
  });

  describe('convertLegacyResult', () => {
    it('should convert a successful legacy result', () => {
      const legacyResult = {
        verified: true,
        proofType: 'standard',
        proofDetails: {
          user: '0x123abc',
          thresholdAmount: '1000000000000000000',
          tokenSymbol: 'ETH',
          proofHash: 'abcdef123456',
          expiryTime: '2023-01-01T00:00:00Z'
        },
        verificationTime: 150,
        publicSignals: ['0x123', '0x456'],
        vkeyPath: '/path/to/vkey.json'
      };
      
      const result = formatter.convertLegacyResult(legacyResult);
      
      expect(result.status).toBe('success');
      expect(result.proofType).toBe('standard');
      expect(result.verified).toBe(true);
      expect(result.verificationTime).toBe(150);
      
      expect(result.data.wallet).toBe('0x123abc');
      expect(result.data.amount).toBe('1000000000000000000');
      expect(result.data.tokenSymbol).toBe('ETH');
      expect(result.data.publicInputs).toEqual(['0x123', '0x456']);
      
      expect(result.metadata.proofHash).toBe('abcdef123456');
      expect(result.metadata.expiryTime).toBeDefined();
      expect(result.metadata.version).toBe('1.0.0');
    });

    it('should convert a failed legacy result', () => {
      const legacyResult = {
        verified: false,
        proofType: 'threshold',
        proofDetails: {
          user: '0x123abc',
          thresholdAmount: '500000000000000000',
          tokenSymbol: 'ETH'
        },
        verificationTime: 200,
        errorMessage: 'Proof verification failed',
        errorType: 'ZK_PROOF_INVALID',
        publicSignals: ['0x123', '0x456'],
        vkeyPath: '/path/to/vkey.json'
      };
      
      const result = formatter.convertLegacyResult(legacyResult);
      
      expect(result.status).toBe('failure');
      expect(result.proofType).toBe('threshold');
      expect(result.verified).toBe(false);
      expect(result.verificationTime).toBe(200);
      
      expect(result.data.wallet).toBe('0x123abc');
      expect(result.data.amount).toBe('500000000000000000');
      expect(result.data.tokenSymbol).toBe('ETH');
      
      expect(result.error?.code).toBe('ZK_PROOF_INVALID');
      expect(result.error?.message).toBe('Proof verification failed');
      expect(result.error?.details).toBeDefined();
    });

    it('should handle legacy result with error object', () => {
      const legacyResult = {
        verified: false,
        proofType: 'maximum',
        error: {
          errorType: 'SYSTEM_ERROR',
          message: 'Service unavailable',
          details: { service: 'zkProof' }
        }
      };
      
      const result = formatter.convertLegacyResult(legacyResult);
      
      expect(result.status).toBe('failure');
      expect(result.proofType).toBe('maximum');
      expect(result.verified).toBe(false);
      
      expect(result.error?.code).toBe('SYSTEM_ERROR');
      expect(result.error?.message).toBe('Service unavailable');
      expect(result.error?.details).toEqual({ service: 'zkProof' });
    });

    it('should handle numeric expiryTime', () => {
      const legacyResult = {
        verified: true,
        proofType: 'standard',
        proofDetails: {
          user: '0x123abc',
          expiryTime: 1640995200 // Unix timestamp
        }
      };
      
      const result = formatter.convertLegacyResult(legacyResult);
      
      expect(result.metadata.expiryTime).toBe(1640995200);
    });
  });
});