/**
 * API Routes Configuration
 * 
 * Centralizes all API routes and version control
 */
import { Router } from 'express';
import authRoutes from './auth/routes';
import proofRoutes from './proofs/routes';
import verifyRoutes from './verify/routes';
import auditLogRoutes from './audit-logs/routes';

// For future implementation
// import userRoutes from './users/routes';
// import walletRoutes from './wallets/routes';
// import organizationRoutes from './organizations/routes';

// Create main router
const router = Router();

// Register route modules
router.use('/auth', authRoutes);
router.use('/proofs', proofRoutes);
router.use('/verify', verifyRoutes);
router.use('/audit-logs', auditLogRoutes);

// For future implementation
// router.use('/users', userRoutes);
// router.use('/wallets', walletRoutes);
// router.use('/organizations', organizationRoutes);

// Add API information route
router.get('/', (req, res) => {
  res.json({
    name: 'Proof of Funds API',
    version: '1.0.0',
    documentation: '/api/v1/docs'
  });
});

export default router;