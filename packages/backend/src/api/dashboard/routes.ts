/**
 * Dashboard API Routes
 * 
 * Routes for security dashboard and monitoring
 */

import express from 'express';
import { authMiddleware } from '../../middleware/auth';
import { getWalletAuthStats, getWalletAuthHistory, getAuthSuccessRate } from './walletAuthStats';

const router = express.Router();

// Require authentication for all dashboard routes
router.use(authMiddleware);

// Security dashboard routes
router.get('/security/wallet-auth/stats', getWalletAuthStats);
router.get('/security/wallet-auth/history/:address', getWalletAuthHistory);
router.get('/security/wallet-auth/success-rate', getAuthSuccessRate);

export default router;