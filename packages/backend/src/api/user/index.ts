/**
 * User API Routes
 * 
 * Centralizes all user-related API routes
 */
import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import preferencesRoutes from './preferences';
import emailAuthRoutes from './auth';

// Create main router
const router = Router();

// Register authentication routes (no auth required)
router.use('/auth', emailAuthRoutes);

// Register authenticated routes
router.use('/preferences', preferencesRoutes);

// Add user info route
router.get('/me', authenticate, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user?.id,
      email: req.user?.email,
      address: req.user?.address,
      permissions: req.user?.permissions,
      emailVerified: req.user?.emailVerified
    }
  });
});

export default router;