/**
 * IP Reputation Tracker Tests
 * 
 * Tests for the IP reputation tracking system
 */

import ipReputationTracker, { ReputationEvent } from '../../src/security/ipReputationTracker';

describe('IP Reputation Tracker', () => {
  // Reset the in-memory store before each test
  beforeEach(() => {
    // @ts-ignore - Access private property for testing
    ipReputationTracker.inMemoryStore = new Map();
  });
  
  test('should track IP reputation with initial score', async () => {
    const ip = '192.168.1.1';
    const score = await ipReputationTracker.getScore(ip);
    
    // Default initial score is 75
    expect(score).toBe(75);
  });
  
  test('should record reputation events and update score', async () => {
    const ip = '192.168.1.2';
    
    // Record a successful auth event (positive impact)
    await ipReputationTracker.recordEvent(ip, ReputationEvent.SUCCESSFUL_AUTH);
    let score = await ipReputationTracker.getScore(ip);
    
    // Initial score (75) + SUCCESSFUL_AUTH impact (5) = 80
    expect(score).toBe(80);
    
    // Record a failed auth event (negative impact)
    await ipReputationTracker.recordEvent(ip, ReputationEvent.FAILED_AUTH);
    score = await ipReputationTracker.getScore(ip);
    
    // Previous score (80) + FAILED_AUTH impact (-5) = 75
    expect(score).toBe(75);
    
    // Record a rate limit exceeded event (negative impact)
    await ipReputationTracker.recordEvent(ip, ReputationEvent.RATE_LIMIT_EXCEEDED);
    score = await ipReputationTracker.getScore(ip);
    
    // Previous score (75) + RATE_LIMIT_EXCEEDED impact (-10) = 65
    expect(score).toBe(65);
  });
  
  test('should limit score to min and max values', async () => {
    const ip = '192.168.1.3';
    
    // Record multiple positive events to exceed max score (100)
    for (let i = 0; i < 10; i++) {
      await ipReputationTracker.recordEvent(ip, ReputationEvent.SUCCESSFUL_AUTH);
    }
    
    let score = await ipReputationTracker.getScore(ip);
    expect(score).toBe(100); // Max score
    
    // Record multiple negative events to go below min score (0)
    for (let i = 0; i < 20; i++) {
      await ipReputationTracker.recordEvent(ip, ReputationEvent.RATE_LIMIT_EXCEEDED);
    }
    
    score = await ipReputationTracker.getScore(ip);
    expect(score).toBe(0); // Min score
  });
  
  test('should block IP when manually blocked', async () => {
    const ip = '192.168.1.4';
    
    // Initially not blocked
    let isBlocked = await ipReputationTracker.isBlocked(ip);
    expect(isBlocked).toBe(false);
    
    // Block the IP
    await ipReputationTracker.blockIP(ip, 'Test block');
    
    // Should be blocked now
    isBlocked = await ipReputationTracker.isBlocked(ip);
    expect(isBlocked).toBe(true);
    
    // Score should be very low
    const score = await ipReputationTracker.getScore(ip);
    expect(score).toBeLessThan(10);
  });
  
  test('should allow IP and improve score when manually allowed', async () => {
    const ip = '192.168.1.5';
    
    // First block the IP
    await ipReputationTracker.blockIP(ip, 'Test block');
    
    // Verify it's blocked
    let isBlocked = await ipReputationTracker.isBlocked(ip);
    expect(isBlocked).toBe(true);
    
    // Now allow the IP
    await ipReputationTracker.allowIP(ip, 'Test allow');
    
    // Should not be blocked anymore
    isBlocked = await ipReputationTracker.isBlocked(ip);
    expect(isBlocked).toBe(false);
    
    // Score should be significantly improved
    const score = await ipReputationTracker.getScore(ip);
    expect(score).toBeGreaterThan(20);
  });
  
  test('should track events with details and metadata', async () => {
    const ip = '192.168.1.6';
    const details = { userId: '123', path: '/api/auth/login' };
    const geoData = { country: 'US', asn: '12345', isp: 'Test ISP' };
    
    // Record event with details and geo data
    await ipReputationTracker.recordEvent(
      ip,
      ReputationEvent.FAILED_AUTH,
      details,
      geoData
    );
    
    // Get reputation data
    const reputation = await ipReputationTracker.getReputation(ip);
    
    // Check that details and geo data were stored
    expect(reputation).toBeTruthy();
    expect(reputation?.events[0].details).toEqual(details);
    expect(reputation?.country).toBe(geoData.country);
    expect(reputation?.asn).toBe(geoData.asn);
    expect(reputation?.isp).toBe(geoData.isp);
  });
  
  test('should return correct reputation status based on score', () => {
    // Good reputation
    expect(ipReputationTracker.getReputationStatus(85)).toBe('good');
    
    // Neutral reputation
    expect(ipReputationTracker.getReputationStatus(60)).toBe('neutral');
    
    // Suspicious reputation
    expect(ipReputationTracker.getReputationStatus(40)).toBe('suspicious');
    
    // Blocked reputation
    expect(ipReputationTracker.getReputationStatus(5)).toBe('blocked');
  });
  
  test('should get suspicious IPs', async () => {
    // Set up multiple IPs with different scores
    await ipReputationTracker.recordEvent('192.168.1.10', ReputationEvent.SUCCESSFUL_AUTH);
    await ipReputationTracker.recordEvent('192.168.1.11', ReputationEvent.FAILED_AUTH);
    await ipReputationTracker.recordEvent('192.168.1.12', ReputationEvent.RATE_LIMIT_EXCEEDED);
    await ipReputationTracker.blockIP('192.168.1.13', 'Test block');
    
    // Get suspicious IPs (below threshold of 30 by default)
    const suspiciousIPs = await ipReputationTracker.getSuspiciousIPs();
    
    // Only blocked IP and rate limited IP should be considered suspicious
    expect(suspiciousIPs.length).toBe(2);
    
    // Verify the suspicious IPs are the ones we expect
    const ipAddresses = suspiciousIPs.map(ip => ip.ip);
    
    // We can't check the exact IPs because they're hashed, but we can check the count
    expect(ipAddresses.length).toBe(2);
  });
});