"use strict";
/**
 * IP Reputation Tracker Tests
 *
 * Tests for the IP reputation tracking system
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const ipReputationTracker_1 = __importStar(require("../../src/security/ipReputationTracker"));
describe('IP Reputation Tracker', () => {
    // Reset the in-memory store before each test
    beforeEach(() => {
        // @ts-ignore - Access private property for testing
        ipReputationTracker_1.default.inMemoryStore = new Map();
    });
    test('should track IP reputation with initial score', async () => {
        const ip = '192.168.1.1';
        const score = await ipReputationTracker_1.default.getScore(ip);
        // Default initial score is 75
        expect(score).toBe(75);
    });
    test('should record reputation events and update score', async () => {
        const ip = '192.168.1.2';
        // Record a successful auth event (positive impact)
        await ipReputationTracker_1.default.recordEvent(ip, ipReputationTracker_1.ReputationEvent.SUCCESSFUL_AUTH);
        let score = await ipReputationTracker_1.default.getScore(ip);
        // Initial score (75) + SUCCESSFUL_AUTH impact (5) = 80
        expect(score).toBe(80);
        // Record a failed auth event (negative impact)
        await ipReputationTracker_1.default.recordEvent(ip, ipReputationTracker_1.ReputationEvent.FAILED_AUTH);
        score = await ipReputationTracker_1.default.getScore(ip);
        // Previous score (80) + FAILED_AUTH impact (-5) = 75
        expect(score).toBe(75);
        // Record a rate limit exceeded event (negative impact)
        await ipReputationTracker_1.default.recordEvent(ip, ipReputationTracker_1.ReputationEvent.RATE_LIMIT_EXCEEDED);
        score = await ipReputationTracker_1.default.getScore(ip);
        // Previous score (75) + RATE_LIMIT_EXCEEDED impact (-10) = 65
        expect(score).toBe(65);
    });
    test('should limit score to min and max values', async () => {
        const ip = '192.168.1.3';
        // Record multiple positive events to exceed max score (100)
        for (let i = 0; i < 10; i++) {
            await ipReputationTracker_1.default.recordEvent(ip, ipReputationTracker_1.ReputationEvent.SUCCESSFUL_AUTH);
        }
        let score = await ipReputationTracker_1.default.getScore(ip);
        expect(score).toBe(100); // Max score
        // Record multiple negative events to go below min score (0)
        for (let i = 0; i < 20; i++) {
            await ipReputationTracker_1.default.recordEvent(ip, ipReputationTracker_1.ReputationEvent.RATE_LIMIT_EXCEEDED);
        }
        score = await ipReputationTracker_1.default.getScore(ip);
        expect(score).toBe(0); // Min score
    });
    test('should block IP when manually blocked', async () => {
        const ip = '192.168.1.4';
        // Initially not blocked
        let isBlocked = await ipReputationTracker_1.default.isBlocked(ip);
        expect(isBlocked).toBe(false);
        // Block the IP
        await ipReputationTracker_1.default.blockIP(ip, 'Test block');
        // Should be blocked now
        isBlocked = await ipReputationTracker_1.default.isBlocked(ip);
        expect(isBlocked).toBe(true);
        // Score should be very low
        const score = await ipReputationTracker_1.default.getScore(ip);
        expect(score).toBeLessThan(10);
    });
    test('should allow IP and improve score when manually allowed', async () => {
        const ip = '192.168.1.5';
        // First block the IP
        await ipReputationTracker_1.default.blockIP(ip, 'Test block');
        // Verify it's blocked
        let isBlocked = await ipReputationTracker_1.default.isBlocked(ip);
        expect(isBlocked).toBe(true);
        // Now allow the IP
        await ipReputationTracker_1.default.allowIP(ip, 'Test allow');
        // Should not be blocked anymore
        isBlocked = await ipReputationTracker_1.default.isBlocked(ip);
        expect(isBlocked).toBe(false);
        // Score should be significantly improved
        const score = await ipReputationTracker_1.default.getScore(ip);
        expect(score).toBeGreaterThan(20);
    });
    test('should track events with details and metadata', async () => {
        const ip = '192.168.1.6';
        const details = { userId: '123', path: '/api/auth/login' };
        const geoData = { country: 'US', asn: '12345', isp: 'Test ISP' };
        // Record event with details and geo data
        await ipReputationTracker_1.default.recordEvent(ip, ipReputationTracker_1.ReputationEvent.FAILED_AUTH, details, geoData);
        // Get reputation data
        const reputation = await ipReputationTracker_1.default.getReputation(ip);
        // Check that details and geo data were stored
        expect(reputation).toBeTruthy();
        expect(reputation?.events[0].details).toEqual(details);
        expect(reputation?.country).toBe(geoData.country);
        expect(reputation?.asn).toBe(geoData.asn);
        expect(reputation?.isp).toBe(geoData.isp);
    });
    test('should return correct reputation status based on score', () => {
        // Good reputation
        expect(ipReputationTracker_1.default.getReputationStatus(85)).toBe('good');
        // Neutral reputation
        expect(ipReputationTracker_1.default.getReputationStatus(60)).toBe('neutral');
        // Suspicious reputation
        expect(ipReputationTracker_1.default.getReputationStatus(40)).toBe('suspicious');
        // Blocked reputation
        expect(ipReputationTracker_1.default.getReputationStatus(5)).toBe('blocked');
    });
    test('should get suspicious IPs', async () => {
        // Set up multiple IPs with different scores
        await ipReputationTracker_1.default.recordEvent('192.168.1.10', ipReputationTracker_1.ReputationEvent.SUCCESSFUL_AUTH);
        await ipReputationTracker_1.default.recordEvent('192.168.1.11', ipReputationTracker_1.ReputationEvent.FAILED_AUTH);
        await ipReputationTracker_1.default.recordEvent('192.168.1.12', ipReputationTracker_1.ReputationEvent.RATE_LIMIT_EXCEEDED);
        await ipReputationTracker_1.default.blockIP('192.168.1.13', 'Test block');
        // Get suspicious IPs (below threshold of 30 by default)
        const suspiciousIPs = await ipReputationTracker_1.default.getSuspiciousIPs();
        // Only blocked IP and rate limited IP should be considered suspicious
        expect(suspiciousIPs.length).toBe(2);
        // Verify the suspicious IPs are the ones we expect
        const ipAddresses = suspiciousIPs.map(ip => ip.ip);
        // We can't check the exact IPs because they're hashed, but we can check the count
        expect(ipAddresses.length).toBe(2);
    });
});
