/**
 * API Routes Configuration
 * 
 * Centralizes all API routes and version control
 */
import { Router } from 'express';
import authRoutes from './auth/routes';
import userRoutes from './users/routes';
import walletRoutes from './wallets/routes';
import proofRoutes from './proofs/routes';
import verifyRoutes from './verify/routes';
import organizationRoutes from './organizations/routes';

// Create main router
const router = Router();

// Register route modules
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/wallets', walletRoutes);
router.use('/proofs', proofRoutes);
router.use('/verify', verifyRoutes);
router.use('/organizations', organizationRoutes);

// Add API information route
router.get('/', (req, res) => {
  res.json({
    name: 'Proof of Funds API',
    version: '1.0.0',
    documentation: '/api/v1/docs'
  });
});

export default router;