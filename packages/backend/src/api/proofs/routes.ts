/**
 * Proof Routes
 */
import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../../middleware/validation';
import { authenticate } from '../../middleware/auth';
import { proofRateLimit } from '../../middleware/rateLimit';
import { proofAuditMiddleware } from '../../middleware/auditMiddleware';
import * as proofController from './controller';

const router = Router();

// Apply authentication middleware to all proof routes
router.use(authenticate);

/**
 * POST /api/v1/proofs
 * @description Generate a new zero-knowledge proof
 */
router.post('/',
  proofRateLimit,
  validate([
    body('proofType')
      .isString()
      .isIn(['STANDARD', 'THRESHOLD', 'MAXIMUM', 'ZERO_KNOWLEDGE'])
      .withMessage('Valid proof type is required'),
    body('input')
      .isObject()
      .withMessage('Valid input object is required')
  ]),
  proofAuditMiddleware.create,
  proofController.generateProof
);

/**
 * GET /api/v1/proofs
 * @description Get proofs for authenticated user
 */
router.get('/',
  validate([
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('status')
      .optional()
      .isIn(['PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED', 'EXPIRED', 'REVOKED'])
      .withMessage('Valid status is required'),
    query('type')
      .optional()
      .isIn(['STANDARD', 'THRESHOLD', 'MAXIMUM', 'ZERO_KNOWLEDGE'])
      .withMessage('Valid proof type is required')
  ]),
  proofAuditMiddleware.list,
  proofController.getUserProofs
);

/**
 * GET /api/v1/proofs/:proofId
 * @description Get proof details
 */
router.get('/:proofId',
  validate([
    param('proofId')
      .isUUID()
      .withMessage('Valid proof ID is required')
  ]),
  proofAuditMiddleware.read,
  proofController.getProofDetails
);

/**
 * POST /api/v1/proofs/:proofId/revoke
 * @description Revoke a proof
 */
router.post('/:proofId/revoke',
  validate([
    param('proofId')
      .isUUID()
      .withMessage('Valid proof ID is required'),
    body('reason')
      .optional()
      .isString()
      .isLength({ max: 255 })
      .withMessage('Reason must be a string with maximum 255 characters')
  ]),
  proofAuditMiddleware.update,
  proofController.revokeProof
);

export default router;