/**
 * Verification Routes
 */
import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../../middleware/validation';
import { verifyAuditMiddleware } from '../../middleware/auditMiddleware';
import * as verifyController from './controller';

const router = Router();

/**
 * GET /api/v1/verify/:referenceId
 * @description Check if a proof exists and its status
 */
router.get('/:referenceId',
  validate([
    param('referenceId')
      .isString()
      .isLength({ min: 8 })
      .withMessage('Valid reference ID is required')
  ]),
  verifyAuditMiddleware.read,
  verifyController.checkProofStatus
);

/**
 * POST /api/v1/verify/:referenceId
 * @description Verify a proof using its reference ID and decryption key
 */
router.post('/:referenceId',
  validate([
    param('referenceId')
      .isString()
      .isLength({ min: 8 })
      .withMessage('Valid reference ID is required'),
    body('decryptionKey')
      .isString()
      .matches(/^[0-9a-f]{64}$/i)
      .withMessage('Valid 32-byte hex decryption key is required'),
    body('verifierAddress')
      .optional()
      .isString()
      .isLength({ min: 42, max: 42 })
      .withMessage('Valid Ethereum address is required')
  ]),
  verifyAuditMiddleware.create,
  verifyController.verifyProof
);

export default router;