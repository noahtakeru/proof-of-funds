/**
 * Audit Log Routes
 * 
 * Defines routes for audit log endpoints
 */
import express from 'express';
import { 
  getAuditLogs, 
  getAuditLogById, 
  exportAuditLogs 
} from './controller';
import { authenticate, checkPermissions } from '../../middleware/auth';
import { authAuditMiddleware } from '../../middleware/auditMiddleware';

// Create router
const router = express.Router();

// GET /api/audit-logs - Get audit logs with filtering
router.get(
  '/',
  authenticate,
  checkPermissions(['audit.read']),
  getAuditLogs
);

// GET /api/audit-logs/:id - Get audit log by ID
router.get(
  '/:id',
  authenticate,
  checkPermissions(['audit.read']),
  getAuditLogById
);

// POST /api/audit-logs/export - Export audit logs
router.post(
  '/export',
  authenticate,
  checkPermissions(['audit.export']),
  exportAuditLogs
);

export default router;