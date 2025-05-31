/**
 * ZK Proof Service Tests
 */
import { ApiError } from '../../middleware/errorHandler';
import { zkProofService } from '../zkProofService';

// Mock dependencies
jest.mock('snarkjs', () => ({
  groth16: {
    fullProve: jest.fn().mockResolvedValue({
      proof: { a: [1, 2], b: [[3, 4], [5, 6]], c: [7, 8] },
      publicSignals: ['123', '456']
    }),
    verify: jest.fn().mockResolvedValue(true)
  }
}));

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue(JSON.stringify({ mock: 'vkey' }))
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn()
}));

jest.mock('../../config', () => ({
  zkProof: {
    circuitPaths: {
      standard: '/path/to/standard_circuit',
      threshold: '/path/to/threshold_circuit',
      maximum: '/path/to/maximum_circuit'
    }
  }
}));

// Import for type reference only
import snarkjs from 'snarkjs';
import logger from '../../utils/logger';
import config from '../../config';

describe('ZkProofService', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Default mock implementations are set in the jest.mock calls above
  });

  describe('getCircuitPaths', () => {
    it('should throw error for invalid proof type', () => {
      expect(() => {
        // @ts-ignore - accessing private method for testing
        zkProofService['getCircuitPaths']('invalid');
      }).toThrow(ApiError);
    });

    it('should return correct paths for valid proof type', () => {
      // @ts-ignore - accessing private method for testing
      const paths = zkProofService['getCircuitPaths']('standard');
      
      expect(paths).toEqual({
        wasmPath: '/path/to/standard_circuit.wasm',
        zkeyPath: '/path/to/standard_circuit.zkey',
        vkeyPath: '/path/to/standard_circuit.vkey.json'
      });
    });

    it('should throw error if wasm file does not exist', () => {
      const fs = require('fs');
      jest.mocked(fs.existsSync).mockImplementation((path) => !String(path).endsWith('.wasm'));
      
      expect(() => {
        // @ts-ignore - accessing private method for testing
        zkProofService['getCircuitPaths']('standard');
      }).toThrow(ApiError);
    });

    it('should throw error if zkey file does not exist', () => {
      const fs = require('fs');
      jest.mocked(fs.existsSync).mockImplementation((path) => !String(path).endsWith('.zkey'));
      
      expect(() => {
        // @ts-ignore - accessing private method for testing
        zkProofService['getCircuitPaths']('standard');
      }).toThrow(ApiError);
    });

    it('should throw error if vkey file does not exist', () => {
      const fs = require('fs');
      jest.mocked(fs.existsSync).mockImplementation((path) => !String(path).endsWith('.vkey.json'));
      
      expect(() => {
        // @ts-ignore - accessing private method for testing
        zkProofService['getCircuitPaths']('standard');
      }).toThrow(ApiError);
    });
  });

  describe('validateInput', () => {
    it('should throw error for missing input', () => {
      expect(() => {
        // @ts-ignore - accessing private method for testing
        zkProofService['validateInput']('standard', null);
      }).toThrow(ApiError);
    });

    it('should throw error for missing user address', () => {
      expect(() => {
        // @ts-ignore - accessing private method for testing
        zkProofService['validateInput']('standard', {});
      }).toThrow(ApiError);
    });

    it('should throw error for standard proof missing balance', () => {
      expect(() => {
        // @ts-ignore - accessing private method for testing
        zkProofService['validateInput']('standard', { userAddress: '0x123' });
      }).toThrow(ApiError);
    });

    it('should throw error for standard proof missing threshold', () => {
      expect(() => {
        // @ts-ignore - accessing private method for testing
        zkProofService['validateInput']('standard', { 
          userAddress: '0x123',
          balance: '1000'
        });
      }).toThrow(ApiError);
    });

    it('should validate valid standard proof input', () => {
      // For a void function, we need to use a different approach
      const validInput = { 
        userAddress: '0x123',
        balance: '1000',
        threshold: '500'
      };
      
      // If it doesn't throw, the test passes
      expect(() => {
        // @ts-ignore - accessing private method for testing
        zkProofService['validateInput']('standard', validInput);
      }).not.toThrow();
    });

    it('should throw error for threshold proof missing totalBalance', () => {
      expect(() => {
        // @ts-ignore - accessing private method for testing
        zkProofService['validateInput']('threshold', { userAddress: '0x123' });
      }).toThrow(ApiError);
    });

    it('should throw error for threshold proof missing threshold', () => {
      expect(() => {
        // @ts-ignore - accessing private method for testing
        zkProofService['validateInput']('threshold', { 
          userAddress: '0x123',
          totalBalance: '1000'
        });
      }).toThrow(ApiError);
    });

    it('should throw error for threshold proof missing networkId', () => {
      expect(() => {
        // @ts-ignore - accessing private method for testing
        zkProofService['validateInput']('threshold', { 
          userAddress: '0x123',
          totalBalance: '1000',
          threshold: '500'
        });
      }).toThrow(ApiError);
    });

    it('should validate valid threshold proof input', () => {
      expect(() => {
        // @ts-ignore - accessing private method for testing
        zkProofService['validateInput']('threshold', { 
          userAddress: '0x123',
          totalBalance: '1000',
          threshold: '500',
          networkId: '1'
        });
      }).not.toThrow();
    });

    it('should throw error for maximum proof missing maxBalance', () => {
      expect(() => {
        // @ts-ignore - accessing private method for testing
        zkProofService['validateInput']('maximum', { userAddress: '0x123' });
      }).toThrow(ApiError);
    });

    it('should throw error for maximum proof missing threshold', () => {
      expect(() => {
        // @ts-ignore - accessing private method for testing
        zkProofService['validateInput']('maximum', { 
          userAddress: '0x123',
          maxBalance: '1000'
        });
      }).toThrow(ApiError);
    });

    it('should throw error for maximum proof missing networks', () => {
      expect(() => {
        // @ts-ignore - accessing private method for testing
        zkProofService['validateInput']('maximum', { 
          userAddress: '0x123',
          maxBalance: '1000',
          threshold: '500'
        });
      }).toThrow(ApiError);
    });

    it('should validate valid maximum proof input', () => {
      expect(() => {
        // @ts-ignore - accessing private method for testing
        zkProofService['validateInput']('maximum', { 
          userAddress: '0x123',
          maxBalance: '1000',
          threshold: '500',
          networks: ['1', '2']
        });
      }).not.toThrow();
    });
  });

  describe('generateProof', () => {
    it('should generate proof successfully', async () => {
      // Ensure the file existence check passes for this test
      const fs = require('fs');
      jest.mocked(fs.existsSync).mockReturnValue(true);
      
      const input = {
        userAddress: '0x123',
        balance: '1000',
        threshold: '500'
      };
      
      const snarkjs = require('snarkjs');
      const expectedResult = {
        proof: { a: [1, 2], b: [[3, 4], [5, 6]], c: [7, 8] },
        publicSignals: ['123', '456']
      };
      
      // Mock the fullProve function specifically for this test
      jest.mocked(snarkjs.groth16.fullProve).mockResolvedValueOnce(expectedResult);
      
      const result = await zkProofService.generateProof('standard', input);
      
      expect(result).toEqual(expectedResult);
      
      expect(snarkjs.groth16.fullProve).toHaveBeenCalledWith(
        input,
        '/path/to/standard_circuit.wasm',
        '/path/to/standard_circuit.zkey'
      );
      
      const logger = require('../../utils/logger');
      expect(logger.info).toHaveBeenCalledTimes(2);
    });

    it('should throw error if snarkjs is not loaded', async () => {
      // Mock the snarkjs check to simulate it not being loaded
      jest.spyOn(zkProofService as any, 'getCircuitPaths').mockImplementationOnce(() => {
        throw new Error('snarkjs library not loaded');
      });
      
      const input = {
        userAddress: '0x123',
        balance: '1000',
        threshold: '500'
      };
      
      await expect(
        zkProofService.generateProof('standard', input)
      ).rejects.toThrow(ApiError);
    });

    it('should throw ApiError if input validation fails', async () => {
      const input = {
        userAddress: '0x123'
        // Missing required fields
      };
      
      await expect(
        zkProofService.generateProof('standard', input)
      ).rejects.toThrow(ApiError);
      
      const snarkjs = require('snarkjs');
      expect(snarkjs.groth16.fullProve).not.toHaveBeenCalled();
    });

    it('should throw ApiError if proof generation fails', async () => {
      const snarkjs = require('snarkjs');
      jest.mocked(snarkjs.groth16.fullProve).mockRejectedValueOnce(new Error('Proof generation failed'));
      
      const input = {
        userAddress: '0x123',
        balance: '1000',
        threshold: '500'
      };
      
      await expect(
        zkProofService.generateProof('standard', input)
      ).rejects.toThrow(ApiError);
      
      const logger = require('../../utils/logger');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('verifyProof', () => {
    it('should verify proof successfully', async () => {
      // Ensure the file existence check passes for this test
      const fs = require('fs');
      jest.mocked(fs.existsSync).mockReturnValue(true);
      
      const proof = { a: [1, 2], b: [[3, 4], [5, 6]], c: [7, 8] };
      const publicSignals = ['123', '456'];
      
      const snarkjs = require('snarkjs');
      jest.mocked(snarkjs.groth16.verify).mockResolvedValueOnce(true);
      
      const result = await zkProofService.verifyProof('standard', proof, publicSignals);
      
      expect(result).toBe(true);
      
      expect(snarkjs.groth16.verify).toHaveBeenCalledWith(
        { mock: 'vkey' },
        publicSignals,
        proof
      );
      
      const logger = require('../../utils/logger');
      expect(logger.info).toHaveBeenCalledTimes(2);
    });

    it('should return false if verification fails', async () => {
      // Ensure the file existence check passes for this test
      const fs = require('fs');
      jest.mocked(fs.existsSync).mockReturnValue(true);
      
      const snarkjs = require('snarkjs');
      jest.mocked(snarkjs.groth16.verify).mockResolvedValueOnce(false);
      
      const proof = { a: [1, 2], b: [[3, 4], [5, 6]], c: [7, 8] };
      const publicSignals = ['123', '456'];
      
      const result = await zkProofService.verifyProof('standard', proof, publicSignals);
      
      expect(result).toBe(false);
    });

    it('should throw error if snarkjs is not loaded', async () => {
      // Mock the snarkjs check to simulate it not being loaded
      jest.spyOn(zkProofService as any, 'getCircuitPaths').mockImplementationOnce(() => {
        throw new Error('snarkjs library not loaded');
      });
      
      const proof = { a: [1, 2], b: [[3, 4], [5, 6]], c: [7, 8] };
      const publicSignals = ['123', '456'];
      
      await expect(
        zkProofService.verifyProof('standard', proof, publicSignals)
      ).rejects.toThrow(ApiError);
    });

    it('should throw ApiError if verification fails with an error', async () => {
      const snarkjs = require('snarkjs');
      jest.mocked(snarkjs.groth16.verify).mockRejectedValueOnce(new Error('Verification failed'));
      
      const proof = { a: [1, 2], b: [[3, 4], [5, 6]], c: [7, 8] };
      const publicSignals = ['123', '456'];
      
      await expect(
        zkProofService.verifyProof('standard', proof, publicSignals)
      ).rejects.toThrow(ApiError);
      
      const logger = require('../../utils/logger');
      expect(logger.error).toHaveBeenCalled();
    });
  });
});