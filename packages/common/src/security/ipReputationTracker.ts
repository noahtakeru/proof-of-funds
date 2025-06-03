/**
 * IP Reputation Tracker
 *
 * Tracks IP reputation scores based on request patterns and behavior.
 * Provides mechanisms to detect suspicious activity and apply appropriate restrictions.
 * 
 * This is a core component of the Phase 2.2 Security Monitoring & Rate Limiting implementation.
 */

import { Redis } from 'ioredis';
import * as crypto from 'crypto';

// Define reputation score thresholds
const REPUTATION_THRESHOLD = {
  GOOD: 80,      // IPs above this score are considered good
  NEUTRAL: 50,   // IPs above this score are considered neutral
  SUSPICIOUS: 30, // IPs below this score are considered suspicious
  BLOCKED: 10     // IPs below this score are blocked
};

// Define reputation impact values for different events
const REPUTATION_IMPACT = {
  // Positive impact events
  SUCCESSFUL_AUTH: 5,
  SUCCESSFUL_VERIFICATION: 3,
  NORMAL_BROWSING: 1,
  
  // Negative impact events
  FAILED_AUTH: -5,
  RATE_LIMIT_EXCEEDED: -10,
  INVALID_REQUEST: -3,
  BLOCKED_COUNTRY: -30,
  SUSPICIOUS_PATTERN: -15,
};

// Different reputation events for tracking
export enum ReputationEvent {
  SUCCESSFUL_AUTH = 'successful_auth',
  FAILED_AUTH = 'failed_auth',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  INVALID_REQUEST = 'invalid_request',
  BLOCKED_COUNTRY = 'blocked_country',
  SUSPICIOUS_PATTERN = 'suspicious_pattern',
  SUCCESSFUL_VERIFICATION = 'successful_verification',
  NORMAL_BROWSING = 'normal_browsing',
  MANUAL_BLOCK = 'manual_block',
  MANUAL_ALLOW = 'manual_allow',
}

// Reputation scoring options
export interface ReputationOptions {
  // Initial score for new IPs (default: 75, neutral but leaning positive)
  initialScore?: number;
  
  // Minimum reputation score (default: 0)
  minScore?: number;
  
  // Maximum reputation score (default: 100)
  maxScore?: number;
  
  // Time-to-live for reputation data in seconds (default: 7 days)
  ttl?: number;
  
  // Redis configuration
  redis?: {
    url?: string;
    keyPrefix?: string;
  };
  
  // Scoring customization
  scoring?: {
    [key in ReputationEvent]?: number;
  };
}

// IP reputation data structure
export interface IPReputationData {
  ip: string;
  score: number;
  events: Array<{
    timestamp: number;
    event: ReputationEvent;
    impact: number;
    details?: Record<string, any>;
  }>;
  firstSeen: number;
  lastUpdated: number;
  isBlocked: boolean;
  country?: string;
  asn?: string; // Autonomous System Number
  isp?: string; // Internet Service Provider
}

/**
 * IP Reputation Tracker
 * 
 * Tracks IP reputation across the application for security monitoring
 */
export class IPReputationTracker {
  private redisClient: Redis | null = null;
  private inMemoryStore: Map<string, IPReputationData> = new Map();
  private options: Required<ReputationOptions>;
  private isRedisHealthy: boolean = false;
  
  /**
   * Create a new IP Reputation Tracker
   */
  constructor(options: ReputationOptions = {}) {
    // Default options
    this.options = {
      initialScore: options.initialScore ?? 75,
      minScore: options.minScore ?? 0,
      maxScore: options.maxScore ?? 100,
      ttl: options.ttl ?? 60 * 60 * 24 * 7, // 7 days
      redis: {
        url: options.redis?.url ?? process.env.REDIS_URL ?? '',
        keyPrefix: options.redis?.keyPrefix ?? 'pof:ip-reputation:',
      },
      scoring: {
        [ReputationEvent.SUCCESSFUL_AUTH]: options.scoring?.[ReputationEvent.SUCCESSFUL_AUTH] ?? REPUTATION_IMPACT.SUCCESSFUL_AUTH,
        [ReputationEvent.FAILED_AUTH]: options.scoring?.[ReputationEvent.FAILED_AUTH] ?? REPUTATION_IMPACT.FAILED_AUTH,
        [ReputationEvent.RATE_LIMIT_EXCEEDED]: options.scoring?.[ReputationEvent.RATE_LIMIT_EXCEEDED] ?? REPUTATION_IMPACT.RATE_LIMIT_EXCEEDED,
        [ReputationEvent.INVALID_REQUEST]: options.scoring?.[ReputationEvent.INVALID_REQUEST] ?? REPUTATION_IMPACT.INVALID_REQUEST,
        [ReputationEvent.BLOCKED_COUNTRY]: options.scoring?.[ReputationEvent.BLOCKED_COUNTRY] ?? REPUTATION_IMPACT.BLOCKED_COUNTRY,
        [ReputationEvent.SUSPICIOUS_PATTERN]: options.scoring?.[ReputationEvent.SUSPICIOUS_PATTERN] ?? REPUTATION_IMPACT.SUSPICIOUS_PATTERN,
        [ReputationEvent.SUCCESSFUL_VERIFICATION]: options.scoring?.[ReputationEvent.SUCCESSFUL_VERIFICATION] ?? REPUTATION_IMPACT.SUCCESSFUL_VERIFICATION,
        [ReputationEvent.NORMAL_BROWSING]: options.scoring?.[ReputationEvent.NORMAL_BROWSING] ?? REPUTATION_IMPACT.NORMAL_BROWSING,
        [ReputationEvent.MANUAL_BLOCK]: options.scoring?.[ReputationEvent.MANUAL_BLOCK] ?? -100, // Manual block is severe
        [ReputationEvent.MANUAL_ALLOW]: options.scoring?.[ReputationEvent.MANUAL_ALLOW] ?? 50,  // Manual allow is a strong positive signal
      },
    };
    
    // Initialize Redis if URL is provided
    this.initializeRedis();
    
    // Set up cleanup for in-memory store
    setInterval(() => this.cleanupInMemoryStore(), 3600000); // Run every hour
  }
  
  /**
   * Initialize Redis client
   */
  private async initializeRedis(): Promise<void> {
    if (!this.options.redis.url) {
      console.log('No Redis URL provided for IP reputation tracking, using in-memory store');
      return;
    }
    
    try {
      this.redisClient = new Redis(this.options.redis.url, {
        keyPrefix: this.options.redis.keyPrefix,
        retryStrategy: (times) => {
          const delay = Math.min(times * 100, 3000);
          console.log(`Retrying Redis connection for IP reputation tracker in ${delay}ms...`);
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableOfflineQueue: true,
        connectTimeout: 10000, // 10 seconds
        commandTimeout: 5000,  // 5 seconds
      });
      
      // Set up Redis event handlers
      this.redisClient.on('error', (err) => {
        console.error('Redis connection error in IP reputation tracker:', err);
        this.isRedisHealthy = false;
      });
      
      this.redisClient.on('connect', () => {
        console.log('Redis connection established for IP reputation tracking');
        this.isRedisHealthy = true;
      });
      
      this.redisClient.on('reconnecting', () => {
        console.log('Reconnecting to Redis for IP reputation tracking...');
        this.isRedisHealthy = false;
      });
      
      // Test connection
      await this.redisClient.ping();
      this.isRedisHealthy = true;
      console.log('IP reputation tracker connected to Redis successfully');
      
    } catch (error) {
      console.error('Failed to initialize Redis for IP reputation tracking:', error);
      this.isRedisHealthy = false;
      this.redisClient = null;
    }
  }
  
  /**
   * Clean up expired entries from the in-memory store
   */
  private cleanupInMemoryStore(): void {
    const now = Date.now();
    const expiryTime = now - (this.options.ttl * 1000);
    
    for (const [ip, data] of this.inMemoryStore.entries()) {
      if (data.lastUpdated < expiryTime) {
        this.inMemoryStore.delete(ip);
      }
    }
  }
  
  /**
   * Hash an IP address for privacy
   */
  private hashIP(ip: string): string {
    return crypto
      .createHash('sha256')
      .update(ip)
      .digest('hex')
      .substring(0, 16);
  }
  
  /**
   * Record a reputation event for an IP address
   * 
   * @param ip The IP address
   * @param event The reputation event
   * @param details Optional details about the event
   * @param geoData Optional geographic data about the IP
   * @returns The updated reputation score
   */
  public async recordEvent(
    ip: string, 
    event: ReputationEvent, 
    details: Record<string, any> = {},
    geoData?: { country?: string, asn?: string, isp?: string }
  ): Promise<number> {
    // Hash the IP for privacy
    const hashedIP = this.hashIP(ip);
    
    // Get the impact of this event
    const impact = this.options.scoring[event];
    
    // Create an event record
    const eventRecord = {
      timestamp: Date.now(),
      event,
      impact,
      details
    };
    
    // Try to use Redis if available
    if (this.redisClient && this.isRedisHealthy) {
      try {
        // Get existing data
        const existingDataJson = await this.redisClient.get(hashedIP);
        let data: IPReputationData;
        
        if (existingDataJson) {
          // Parse existing data
          data = JSON.parse(existingDataJson);
          
          // Update the data
          data.score = Math.max(
            this.options.minScore,
            Math.min(this.options.maxScore, data.score + impact)
          );
          data.events.push(eventRecord);
          
          // Keep only the last 50 events
          if (data.events.length > 50) {
            data.events = data.events.slice(-50);
          }
          
          data.lastUpdated = Date.now();
          data.isBlocked = data.score < REPUTATION_THRESHOLD.BLOCKED;
          
          // Update geo data if provided
          if (geoData) {
            data.country = geoData.country ?? data.country;
            data.asn = geoData.asn ?? data.asn;
            data.isp = geoData.isp ?? data.isp;
          }
        } else {
          // Create new reputation data
          data = {
            ip: hashedIP,
            score: this.options.initialScore + impact,
            events: [eventRecord],
            firstSeen: Date.now(),
            lastUpdated: Date.now(),
            isBlocked: (this.options.initialScore + impact) < REPUTATION_THRESHOLD.BLOCKED,
            country: geoData?.country,
            asn: geoData?.asn,
            isp: geoData?.isp
          };
        }
        
        // Save to Redis with TTL
        await this.redisClient.set(
          hashedIP,
          JSON.stringify(data),
          'EX',
          this.options.ttl
        );
        
        return data.score;
      } catch (error) {
        console.error('Error storing IP reputation in Redis:', error);
        // Fall back to in-memory storage
      }
    }
    
    // Fall back to in-memory storage
    let data = this.inMemoryStore.get(hashedIP);
    
    if (data) {
      // Update existing data
      data.score = Math.max(
        this.options.minScore,
        Math.min(this.options.maxScore, data.score + impact)
      );
      data.events.push(eventRecord);
      
      // Keep only the last 50 events
      if (data.events.length > 50) {
        data.events = data.events.slice(-50);
      }
      
      data.lastUpdated = Date.now();
      data.isBlocked = data.score < REPUTATION_THRESHOLD.BLOCKED;
      
      // Update geo data if provided
      if (geoData) {
        data.country = geoData.country ?? data.country;
        data.asn = geoData.asn ?? data.asn;
        data.isp = geoData.isp ?? data.isp;
      }
    } else {
      // Create new reputation data
      data = {
        ip: hashedIP,
        score: this.options.initialScore + impact,
        events: [eventRecord],
        firstSeen: Date.now(),
        lastUpdated: Date.now(),
        isBlocked: (this.options.initialScore + impact) < REPUTATION_THRESHOLD.BLOCKED,
        country: geoData?.country,
        asn: geoData?.asn,
        isp: geoData?.isp
      };
    }
    
    // Save to in-memory store
    this.inMemoryStore.set(hashedIP, data);
    
    return data.score;
  }
  
  /**
   * Get reputation data for an IP address
   * 
   * @param ip The IP address
   * @returns The reputation data or null if not found
   */
  public async getReputation(ip: string): Promise<IPReputationData | null> {
    const hashedIP = this.hashIP(ip);
    
    // Try Redis first if available
    if (this.redisClient && this.isRedisHealthy) {
      try {
        const data = await this.redisClient.get(hashedIP);
        if (data) {
          return JSON.parse(data);
        }
      } catch (error) {
        console.error('Error retrieving IP reputation from Redis:', error);
        // Fall back to in-memory
      }
    }
    
    // Fall back to in-memory
    return this.inMemoryStore.get(hashedIP) || null;
  }
  
  /**
   * Check if an IP is blocked
   * 
   * @param ip The IP address
   * @returns True if the IP is blocked
   */
  public async isBlocked(ip: string): Promise<boolean> {
    const reputation = await this.getReputation(ip);
    return reputation ? reputation.isBlocked : false;
  }
  
  /**
   * Get the reputation score for an IP address
   * 
   * @param ip The IP address
   * @returns The reputation score or initialScore if not found
   */
  public async getScore(ip: string): Promise<number> {
    const reputation = await this.getReputation(ip);
    return reputation ? reputation.score : this.options.initialScore;
  }
  
  /**
   * Manually block an IP address
   * 
   * @param ip The IP address
   * @param reason The reason for blocking
   * @returns True if successful
   */
  public async blockIP(ip: string, reason: string): Promise<boolean> {
    await this.recordEvent(ip, ReputationEvent.MANUAL_BLOCK, { reason });
    return true;
  }
  
  /**
   * Manually allow an IP address
   * 
   * @param ip The IP address
   * @param reason The reason for allowing
   * @returns True if successful
   */
  public async allowIP(ip: string, reason: string): Promise<boolean> {
    await this.recordEvent(ip, ReputationEvent.MANUAL_ALLOW, { reason });
    return true;
  }
  
  /**
   * Get reputation status label based on score
   * 
   * @param score The reputation score
   * @returns A status label
   */
  public getReputationStatus(score: number): 'good' | 'neutral' | 'suspicious' | 'blocked' {
    if (score >= REPUTATION_THRESHOLD.GOOD) {return 'good';}
    if (score >= REPUTATION_THRESHOLD.NEUTRAL) {return 'neutral';}
    if (score >= REPUTATION_THRESHOLD.SUSPICIOUS) {return 'suspicious';}
    return 'blocked';
  }
  
  /**
   * Get all IPs with reputation below a threshold
   * 
   * @param threshold The threshold score
   * @returns Array of reputation data
   */
  public async getSuspiciousIPs(threshold: number = REPUTATION_THRESHOLD.SUSPICIOUS): Promise<IPReputationData[]> {
    // For in-memory store
    const inMemorySuspicious: IPReputationData[] = [];
    for (const data of this.inMemoryStore.values()) {
      if (data.score < threshold) {
        inMemorySuspicious.push(data);
      }
    }
    
    // If Redis is available, get from there too
    if (this.redisClient && this.isRedisHealthy) {
      try {
        // This is a simplified approach - in production you'd use Redis SCAN
        // or a secondary index for more efficient querying
        const keys = await this.redisClient.keys('*');
        const redisSuspicious: IPReputationData[] = [];
        
        for (const key of keys) {
          const dataJson = await this.redisClient.get(key);
          if (dataJson) {
            const data = JSON.parse(dataJson);
            if (data.score < threshold) {
              redisSuspicious.push(data);
            }
          }
        }
        
        // Merge results, preferring Redis data when there's overlap
        const allResults = [...inMemorySuspicious];
        for (const redisData of redisSuspicious) {
          if (!allResults.some(d => d.ip === redisData.ip)) {
            allResults.push(redisData);
          }
        }
        
        return allResults;
      } catch (error) {
        console.error('Error retrieving suspicious IPs from Redis:', error);
        // Fall back to in-memory results
      }
    }
    
    return inMemorySuspicious;
  }
}

// Create a singleton instance
const ipReputationTracker = new IPReputationTracker();

export default ipReputationTracker;