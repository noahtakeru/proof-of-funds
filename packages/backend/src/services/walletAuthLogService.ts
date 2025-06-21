/**
 * Wallet Authentication Logging Service
 * 
 * Dedicated service for logging wallet authentication attempts
 * and providing analytics on auth patterns and security events.
 */

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@proof-of-funds/db';
import logger from '../utils/logger';

// Auth result types
export enum AuthResult {
  SUCCESS = 'success',
  FAILURE = 'failure',
  PENDING = 'pending',
}

// Auth failure reasons
export enum AuthFailureReason {
  INVALID_SIGNATURE = 'invalid_signature',
  EXPIRED_NONCE = 'expired_nonce',
  INVALID_NONCE = 'invalid_nonce',
  INACTIVE_USER = 'inactive_user',
  RATE_LIMITED = 'rate_limited',
  SYSTEM_ERROR = 'system_error',
}

// Log entry interface
export interface WalletAuthLogEntry {
  userId?: string;
  walletAddress: string;
  chainId?: number;
  nonce: string;
  signature?: string;
  ipAddress?: string;
  userAgent?: string;
  authResult: AuthResult;
  failureReason?: AuthFailureReason | string;
  metadata?: Record<string, any>;
}

/**
 * Wallet Authentication Log Service
 * 
 * Handles logging of wallet authentication attempts
 */
export class WalletAuthLogService {
  /**
   * Log a wallet authentication attempt
   * 
   * @param entry The log entry details
   * @returns The created log entry ID
   */
  public async logAuthAttempt(entry: WalletAuthLogEntry): Promise<string> {
    try {
      const id = uuidv4();
      
      // Create the log entry
      const logEntry = await prisma.walletAuthLog.create({
        data: {
          id,
          userId: entry.userId,
          walletAddress: entry.walletAddress,
          chainId: entry.chainId,
          nonce: entry.nonce,
          signature: entry.signature,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          authResult: entry.authResult,
          failureReason: entry.failureReason,
          metadata: entry.metadata as any,
          timestamp: new Date()
        }
      });
      
      // Log successful creation
      logger.debug('Wallet auth log entry created', {
        id: logEntry.id,
        walletAddress: entry.walletAddress,
        authResult: entry.authResult,
      });
      
      return logEntry.id;
    } catch (error) {
      // Log error but don't fail the operation
      logger.error('Failed to create wallet auth log entry', {
        error: error instanceof Error ? error.message : String(error),
        walletAddress: entry.walletAddress,
      });
      
      return ''; // Return empty string on error
    }
  }
  
  /**
   * Get recent authentication attempts for a wallet address
   * 
   * @param walletAddress The wallet address
   * @param limit Maximum number of entries to return
   * @returns Array of recent authentication attempts
   */
  public async getRecentAuthAttempts(walletAddress: string, limit: number = 10) {
    try {
      const attempts = await prisma.walletAuthLog.findMany({
        where: { walletAddress },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });
      
      return attempts;
    } catch (error) {
      logger.error('Failed to fetch recent wallet auth attempts', {
        error: error instanceof Error ? error.message : String(error),
        walletAddress,
      });
      
      return [];
    }
  }
  
  /**
   * Get recent failed authentication attempts for a wallet address
   * 
   * @param walletAddress The wallet address
   * @param timeWindowMs Time window in milliseconds
   * @returns Count of failed attempts
   */
  public async getRecentFailedAttempts(walletAddress: string, timeWindowMs: number = 3600000) {
    try {
      const since = new Date(Date.now() - timeWindowMs);
      
      const count = await prisma.walletAuthLog.count({
        where: {
          walletAddress,
          authResult: AuthResult.FAILURE,
          timestamp: { gte: since }
        }
      });
      
      return count;
    } catch (error) {
      logger.error('Failed to count recent failed wallet auth attempts', {
        error: error instanceof Error ? error.message : String(error),
        walletAddress,
      });
      
      return 0;
    }
  }
  
  /**
   * Get authentication success rate for a specific time period
   * 
   * @param timeWindowMs Time window in milliseconds
   * @returns Success rate percentage
   */
  public async getAuthSuccessRate(timeWindowMs: number = 86400000) {
    try {
      const since = new Date(Date.now() - timeWindowMs);
      
      const totalCount = await prisma.walletAuthLog.count({
        where: {
          timestamp: { gte: since }
        }
      });
      
      if (totalCount === 0) {
        return 100; // No attempts = 100% success rate
      }
      
      const successCount = await prisma.walletAuthLog.count({
        where: {
          authResult: AuthResult.SUCCESS,
          timestamp: { gte: since }
        }
      });
      
      return Math.round((successCount / totalCount) * 100);
    } catch (error) {
      logger.error('Failed to calculate wallet auth success rate', {
        error: error instanceof Error ? error.message : String(error),
      });
      
      return null;
    }
  }
  
  /**
   * Get authentication statistics for the security dashboard
   * 
   * @param timeWindowMs Time window in milliseconds
   * @returns Authentication statistics
   */
  public async getAuthStatistics(timeWindowMs: number = 86400000) {
    try {
      const since = new Date(Date.now() - timeWindowMs);
      
      // Get total counts
      const totalCount = await prisma.walletAuthLog.count({
        where: {
          timestamp: { gte: since }
        }
      });
      
      const successCount = await prisma.walletAuthLog.count({
        where: {
          authResult: AuthResult.SUCCESS,
          timestamp: { gte: since }
        }
      });
      
      const failureCount = await prisma.walletAuthLog.count({
        where: {
          authResult: AuthResult.FAILURE,
          timestamp: { gte: since }
        }
      });
      
      // Get failure reasons breakdown
      const failureReasons = await prisma.$queryRaw<Array<{reason: string, count: number}>>`
        SELECT "failure_reason" as reason, COUNT(*) as count
        FROM "wallet_auth_logs"
        WHERE "auth_result" = 'failure'
        AND "timestamp" >= ${since}
        GROUP BY "failure_reason"
        ORDER BY count DESC
      `;
      
      // Get hourly authentication attempts
      const hourlyData = await prisma.$queryRaw<Array<{hour: Date, count: number, success_count: number}>>`
        SELECT 
          date_trunc('hour', "timestamp") as hour,
          COUNT(*) as count,
          COUNT(CASE WHEN "auth_result" = 'success' THEN 1 END) as success_count
        FROM "wallet_auth_logs"
        WHERE "timestamp" >= ${since}
        GROUP BY date_trunc('hour', "timestamp")
        ORDER BY hour ASC
      `;
      
      // Format hourly data for frontend
      const hourlyStats = hourlyData.map(row => ({
        hour: row.hour,
        total: Number(row.count),
        success: Number(row.success_count),
        failure: Number(row.count) - Number(row.success_count),
      }));
      
      // Return compiled statistics
      return {
        totalAttempts: totalCount,
        successCount,
        failureCount,
        successRate: totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 100,
        failureReasons: failureReasons.map(row => ({
          reason: row.reason || 'unknown',
          count: Number(row.count)
        })),
        hourlyStats,
        timeframe: {
          start: since,
          end: new Date(),
        }
      };
    } catch (error) {
      logger.error('Failed to get wallet auth statistics', {
        error: error instanceof Error ? error.message : String(error),
      });
      
      // Return empty stats on error
      return {
        totalAttempts: 0,
        successCount: 0,
        failureCount: 0,
        successRate: 0,
        failureReasons: [],
        hourlyStats: [],
        timeframe: {
          start: new Date(Date.now() - timeWindowMs),
          end: new Date(),
        }
      };
    }
  }
}

// Create a singleton instance
export const walletAuthLogService = new WalletAuthLogService();

export default walletAuthLogService;