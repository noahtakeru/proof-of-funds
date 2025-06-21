/**
 * Security Service
 * 
 * Client-side service for interacting with the security monitoring APIs.
 */

/**
 * Security metrics interface
 */
export interface SecurityMetrics {
  authFailures: number;
  authSuccesses: number;
  rateLimitExceeded: number;
  blockedIPs: number;
  suspiciousIPs: number;
  totalRequests: number;
  blockedRequests: number;
  suspiciousPatterns: number;
  interval: 'hour' | 'day' | 'week' | 'month';
  from: string;
  to: string;
}

/**
 * Security alert interface
 */
export interface SecurityAlert {
  id: string;
  timestamp: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  message: string;
  details: Record<string, any>;
  isResolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
}

/**
 * IP reputation data interface
 */
export interface IPReputationData {
  ip: string;
  score: number;
  events: Array<{
    timestamp: number;
    event: string;
    impact: number;
    details?: Record<string, any>;
  }>;
  firstSeen: number;
  lastUpdated: number;
  isBlocked: boolean;
  country?: string;
  asn?: string;
  isp?: string;
}

/**
 * Authentication log entry
 */
export interface AuthLogEntry {
  id: string;
  userId?: string;
  walletAddress: string;
  chainId?: number;
  nonce: string;
  signature?: string;
  ipAddress?: string;
  userAgent?: string;
  authResult: string;
  failureReason?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * Authentication statistics
 */
export interface AuthStatistics {
  totalAttempts: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  failureReasons: Array<{
    reason: string;
    count: number;
  }>;
  hourlyStats: Array<{
    hour: string;
    total: number;
    success: number;
    failure: number;
  }>;
  timeframe: {
    start: string;
    end: string;
  };
}

/**
 * Get security metrics
 * 
 * @param interval - Time interval (hour, day, week, month)
 * @returns Security metrics
 */
export async function getSecurityMetrics(
  interval: 'hour' | 'day' | 'week' | 'month' = 'day'
): Promise<SecurityMetrics> {
  try {
    // Get token from local storage
    const token = localStorage.getItem('pof_access_token');
    
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    // Fetch metrics from API
    const response = await fetch(`/api/security-dashboard/metrics?interval=${interval}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch security metrics');
    }
    
    const data = await response.json();
    
    return data as SecurityMetrics;
  } catch (error) {
    console.error('Error fetching security metrics:', error);
    throw error;
  }
}

/**
 * Get security alerts
 * 
 * @param limit - Maximum number of alerts to return
 * @param includeResolved - Whether to include resolved alerts
 * @returns Security alerts
 */
export async function getSecurityAlerts(
  limit: number = 10,
  includeResolved: boolean = false
): Promise<SecurityAlert[]> {
  try {
    // Get token from local storage
    const token = localStorage.getItem('pof_access_token');
    
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    // Fetch alerts from API
    const response = await fetch(
      `/api/security-dashboard/alerts?limit=${limit}&includeResolved=${includeResolved}`, 
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch security alerts');
    }
    
    const data = await response.json();
    
    return data.alerts || [];
  } catch (error) {
    console.error('Error fetching security alerts:', error);
    throw error;
  }
}

/**
 * Resolve a security alert
 * 
 * @param alertId - Alert ID
 * @param notes - Resolution notes
 * @returns Success status
 */
export async function resolveSecurityAlert(
  alertId: string,
  notes?: string
): Promise<boolean> {
  try {
    // Get token from local storage
    const token = localStorage.getItem('pof_access_token');
    
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    // Resolve alert via API
    const response = await fetch(`/api/security-dashboard/alerts/${alertId}/resolve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ notes })
    });
    
    if (!response.ok) {
      throw new Error('Failed to resolve security alert');
    }
    
    const data = await response.json();
    
    return data.success || false;
  } catch (error) {
    console.error('Error resolving security alert:', error);
    throw error;
  }
}

/**
 * Get suspicious IPs
 * 
 * @param threshold - Reputation score threshold
 * @returns List of suspicious IP data
 */
export async function getSuspiciousIPs(threshold: number = 30): Promise<IPReputationData[]> {
  try {
    // Get token from local storage
    const token = localStorage.getItem('pof_access_token');
    
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    // Fetch suspicious IPs from API
    const response = await fetch(`/api/security-dashboard/ips/suspicious?threshold=${threshold}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch suspicious IPs');
    }
    
    const data = await response.json();
    
    return data.ips || [];
  } catch (error) {
    console.error('Error fetching suspicious IPs:', error);
    throw error;
  }
}

/**
 * Get IP details
 * 
 * @param ip - IP address
 * @returns IP reputation data
 */
export async function getIPDetails(ip: string): Promise<IPReputationData | null> {
  try {
    // Get token from local storage
    const token = localStorage.getItem('pof_access_token');
    
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    // Fetch IP details from API
    const response = await fetch(`/api/security-dashboard/ips/${ip}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch IP details');
    }
    
    const data = await response.json();
    
    return data.ipData || null;
  } catch (error) {
    console.error('Error fetching IP details:', error);
    throw error;
  }
}

/**
 * Block an IP address
 * 
 * @param ip - IP address
 * @param reason - Reason for blocking
 * @returns Success status
 */
export async function blockIP(ip: string, reason: string): Promise<boolean> {
  try {
    // Get token from local storage
    const token = localStorage.getItem('pof_access_token');
    
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    // Block IP via API
    const response = await fetch(`/api/security-dashboard/ips/${ip}/block`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason })
    });
    
    if (!response.ok) {
      throw new Error('Failed to block IP');
    }
    
    const data = await response.json();
    
    return data.success || false;
  } catch (error) {
    console.error('Error blocking IP:', error);
    throw error;
  }
}

/**
 * Allow an IP address
 * 
 * @param ip - IP address
 * @param reason - Reason for allowing
 * @returns Success status
 */
export async function allowIP(ip: string, reason: string): Promise<boolean> {
  try {
    // Get token from local storage
    const token = localStorage.getItem('pof_access_token');
    
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    // Allow IP via API
    const response = await fetch(`/api/security-dashboard/ips/${ip}/allow`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason })
    });
    
    if (!response.ok) {
      throw new Error('Failed to allow IP');
    }
    
    const data = await response.json();
    
    return data.success || false;
  } catch (error) {
    console.error('Error allowing IP:', error);
    throw error;
  }
}

/**
 * Get wallet authentication statistics
 * 
 * @param timeframeHours - Timeframe in hours
 * @returns Authentication statistics
 */
export async function getWalletAuthStatistics(
  timeframeHours: number = 24
): Promise<AuthStatistics> {
  try {
    // Get token from local storage
    const token = localStorage.getItem('pof_access_token');
    
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    // Fetch wallet auth stats from API
    const response = await fetch(`/api/security-dashboard/wallet-auth/stats?timeframe=${timeframeHours}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch wallet auth statistics');
    }
    
    const data = await response.json();
    
    return data as AuthStatistics;
  } catch (error) {
    console.error('Error fetching wallet auth statistics:', error);
    throw error;
  }
}

/**
 * Get wallet authentication history for an address
 * 
 * @param address - Wallet address
 * @param limit - Maximum number of entries to return
 * @returns Authentication log entries
 */
export async function getWalletAuthHistory(
  address: string,
  limit: number = 10
): Promise<AuthLogEntry[]> {
  try {
    // Get token from local storage
    const token = localStorage.getItem('pof_access_token');
    
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    // Fetch wallet auth history from API
    const response = await fetch(
      `/api/security-dashboard/wallet-auth/history/${address}?limit=${limit}`, 
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch wallet auth history');
    }
    
    const data = await response.json();
    
    return data || [];
  } catch (error) {
    console.error('Error fetching wallet auth history:', error);
    throw error;
  }
}

const securityService = {
  getSecurityMetrics,
  getSecurityAlerts,
  resolveSecurityAlert,
  getSuspiciousIPs,
  getIPDetails,
  blockIP,
  allowIP,
  getWalletAuthStatistics,
  getWalletAuthHistory
};

export default securityService;