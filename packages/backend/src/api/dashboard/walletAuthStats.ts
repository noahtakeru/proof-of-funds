/**
 * Wallet Authentication Statistics API
 * 
 * Provides endpoints for retrieving wallet authentication statistics
 * for use in the security dashboard.
 */

import { Request, Response, NextFunction } from 'express';
import { walletAuthLogService } from '../../services/walletAuthLogService';
import logger from '../../utils/logger';
import { ApiError } from '../../middleware/errorHandler';

/**
 * Get wallet authentication statistics
 */
export const getWalletAuthStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Parse timeframe from query params (default to 24 hours)
    const timeframeHours = parseInt(req.query.timeframe as string) || 24;
    
    // Cap at 30 days to avoid excessive queries
    const timeframeMs = Math.min(timeframeHours, 720) * 60 * 60 * 1000;
    
    // Get authentication statistics
    const stats = await walletAuthLogService.getAuthStatistics(timeframeMs);
    
    res.status(200).json(stats);
  } catch (error) {
    logger.error('Error fetching wallet auth statistics', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    next(error);
  }
};

/**
 * Get recent authentication attempts for a specific wallet address
 */
export const getWalletAuthHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address } = req.params;
    
    if (!address) {
      throw new ApiError(400, 'Wallet address is required', 'MISSING_ADDRESS');
    }
    
    // Parse limit from query params (default to 10)
    const limit = parseInt(req.query.limit as string) || 10;
    
    // Cap at 100 to avoid excessive queries
    const cappedLimit = Math.min(limit, 100);
    
    // Get recent authentication attempts
    const history = await walletAuthLogService.getRecentAuthAttempts(address, cappedLimit);
    
    res.status(200).json(history);
  } catch (error) {
    logger.error('Error fetching wallet auth history', {
      error: error instanceof Error ? error.message : String(error),
      address: req.params.address
    });
    
    next(error);
  }
};

/**
 * Get authentication success rate
 */
export const getAuthSuccessRate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Parse timeframe from query params (default to 24 hours)
    const timeframeHours = parseInt(req.query.timeframe as string) || 24;
    
    // Cap at 30 days to avoid excessive queries
    const timeframeMs = Math.min(timeframeHours, 720) * 60 * 60 * 1000;
    
    // Get success rate
    const successRate = await walletAuthLogService.getAuthSuccessRate(timeframeMs);
    
    res.status(200).json({ successRate });
  } catch (error) {
    logger.error('Error fetching auth success rate', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    next(error);
  }
};