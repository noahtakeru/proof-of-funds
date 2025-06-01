/**
 * Security Dashboard Routes
 *
 * API routes for the security monitoring dashboard
 * 
 * This is a core component of the Phase 2.2 Security Monitoring & Rate Limiting implementation.
 */

import { Router } from 'express';
import securityDashboardController from '../controllers/securityDashboardController';
import { authenticateJWT, isAdmin } from '../middleware/auth';
import { apiRateLimit } from '../middleware/enhancedRateLimit';

const router = Router();

// All security dashboard routes require authentication and admin privileges
router.use(authenticateJWT);
router.use(isAdmin);
router.use(apiRateLimit);

// Security metrics routes
router.get('/metrics', securityDashboardController.getMetrics);

// Security alerts routes
router.get('/alerts', securityDashboardController.getAlerts);
router.post('/alerts/:alertId/resolve', securityDashboardController.resolveAlert);

// IP reputation routes
router.get('/ips/suspicious', securityDashboardController.getSuspiciousIPs);
router.get('/ips/:ip', securityDashboardController.getIPDetails);
router.post('/ips/:ip/block', securityDashboardController.blockIP);
router.post('/ips/:ip/allow', securityDashboardController.allowIP);

export default router;