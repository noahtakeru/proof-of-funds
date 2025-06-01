/**
 * Security Dashboard Controller
 *
 * Provides API endpoints for the security monitoring dashboard
 * 
 * This is a core component of the Phase 2.2 Security Monitoring & Rate Limiting implementation.
 */

import { Request, Response } from 'express';
import securityMonitoringService, { AlertType, SecurityAlert } from '../services/securityMonitoringService';
import ipReputationTracker, { IPReputationData } from '@proof-of-funds/common/security/ipReputationTracker';
import { ApiError } from '../utils/errors';
import logger from '../utils/logger';

/**
 * Security Dashboard Controller
 */
export class SecurityDashboardController {
  /**
   * Get security metrics
   */
  public async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      // Get interval from query params
      const interval = req.query.interval as 'hour' | 'day' | 'week' | 'month' || 'day';
      
      // Get metrics
      const metrics = await securityMonitoringService.getMetrics(interval);
      
      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      logger.error('Error getting security metrics', { error: error.message });
      
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  }
  
  /**
   * Get recent security alerts
   */
  public async getAlerts(req: Request, res: Response): Promise<void> {
    try {
      // Get params from query
      const limit = parseInt(req.query.limit as string) || 10;
      const includeResolved = req.query.includeResolved === 'true';
      
      // Get alerts
      const alerts = await securityMonitoringService.getRecentAlerts(limit, includeResolved);
      
      res.json({
        success: true,
        data: alerts
      });
    } catch (error) {
      logger.error('Error getting security alerts', { error: error.message });
      
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  }
  
  /**
   * Resolve a security alert
   */
  public async resolveAlert(req: Request, res: Response): Promise<void> {
    try {
      const { alertId } = req.params;
      const { notes } = req.body;
      
      // Get the user ID from the authenticated request
      const userId = (req as any).user?.id;
      
      if (!userId) {
        throw new ApiError('Unauthorized', 401);
      }
      
      // Resolve the alert
      const success = await securityMonitoringService.resolveAlert(alertId, userId, notes);
      
      if (!success) {
        throw new ApiError('Alert not found', 404);
      }
      
      res.json({
        success: true,
        message: 'Alert resolved successfully'
      });
    } catch (error) {
      logger.error('Error resolving security alert', { error: error.message });
      
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  }
  
  /**
   * Get suspicious IPs
   */
  public async getSuspiciousIPs(req: Request, res: Response): Promise<void> {
    try {
      // Get suspicious IPs from the reputation tracker
      const suspiciousIPs = await ipReputationTracker.getSuspiciousIPs();
      
      res.json({
        success: true,
        data: suspiciousIPs
      });
    } catch (error) {
      logger.error('Error getting suspicious IPs', { error: error.message });
      
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  }
  
  /**
   * Get details for a specific IP
   */
  public async getIPDetails(req: Request, res: Response): Promise<void> {
    try {
      const { ip } = req.params;
      
      // Get reputation data for this IP
      const reputation = await ipReputationTracker.getReputation(ip);
      
      if (!reputation) {
        throw new ApiError('IP not found', 404);
      }
      
      res.json({
        success: true,
        data: reputation
      });
    } catch (error) {
      logger.error('Error getting IP details', { error: error.message });
      
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  }
  
  /**
   * Block an IP address
   */
  public async blockIP(req: Request, res: Response): Promise<void> {
    try {
      const { ip } = req.params;
      const { reason } = req.body;
      
      // Get the user ID from the authenticated request
      const userId = (req as any).user?.id;
      
      if (!userId) {
        throw new ApiError('Unauthorized', 401);
      }
      
      // Block the IP
      const success = await ipReputationTracker.blockIP(ip, reason || 'Manually blocked by admin');
      
      // Create an alert for this action
      await securityMonitoringService.createAlert({
        type: AlertType.SUSPICIOUS_IP_ACTIVITY,
        severity: 'high',
        source: 'admin',
        message: `IP ${ip} manually blocked by admin`,
        details: {
          ip,
          reason,
          blockedBy: userId
        }
      });
      
      res.json({
        success: true,
        message: 'IP blocked successfully'
      });
    } catch (error) {
      logger.error('Error blocking IP', { error: error.message });
      
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  }
  
  /**
   * Allow an IP address
   */
  public async allowIP(req: Request, res: Response): Promise<void> {
    try {
      const { ip } = req.params;
      const { reason } = req.body;
      
      // Get the user ID from the authenticated request
      const userId = (req as any).user?.id;
      
      if (!userId) {
        throw new ApiError('Unauthorized', 401);
      }
      
      // Allow the IP
      const success = await ipReputationTracker.allowIP(ip, reason || 'Manually allowed by admin');
      
      res.json({
        success: true,
        message: 'IP allowed successfully'
      });
    } catch (error) {
      logger.error('Error allowing IP', { error: error.message });
      
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  }
}

// Create a singleton instance
const securityDashboardController = new SecurityDashboardController();

export default securityDashboardController;