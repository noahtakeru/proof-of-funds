/**
 * User Preferences API Endpoints
 * 
 * Provides REST API for managing user preferences
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate } from '../../middleware/auth';
import { userPreferencesService } from '../../services/userPreferencesService';
import logger from '../../utils/logger';

const router = Router();

/**
 * GET /api/user/preferences
 * Get user preferences
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // Get preferences
    const preferences = await userPreferencesService.getUserPreferences(userId);
    
    return res.status(200).json({
      success: true,
      preferences
    });
  } catch (error) {
    logger.error('Failed to get user preferences', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to get user preferences'
    });
  }
});

/**
 * PUT /api/user/preferences
 * Update user preferences
 */
router.put('/', [
  authenticate,
  body().isObject().withMessage('Request body must be an object'),
  body('notifications').optional().isObject().withMessage('Notifications must be an object'),
  body('ui').optional().isObject().withMessage('UI preferences must be an object'),
  body('defaultNetwork').optional().isInt().withMessage('Default network must be an integer'),
  body('privacy').optional().isObject().withMessage('Privacy settings must be an object')
], async (req: Request, res: Response) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const userId = req.user!.id;
    
    // Update preferences
    const preferences = await userPreferencesService.updateUserPreferences(userId, req.body);
    
    return res.status(200).json({
      success: true,
      preferences
    });
  } catch (error) {
    logger.error('Failed to update user preferences', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to update user preferences'
    });
  }
});

/**
 * POST /api/user/preferences/reset
 * Reset user preferences to defaults
 */
router.post('/reset', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // Reset preferences
    const preferences = await userPreferencesService.resetUserPreferences(userId);
    
    return res.status(200).json({
      success: true,
      preferences
    });
  } catch (error) {
    logger.error('Failed to reset user preferences', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to reset user preferences'
    });
  }
});

export default router;