"use strict";
/**
 * Enhanced Rate Limit Tests
 *
 * Tests for the enhanced rate limiting middleware
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const enhancedRateLimit_1 = require("../../src/middleware/enhancedRateLimit");
const ipReputationTracker_1 = __importDefault(require("../../src/security/ipReputationTracker"));
const express_1 = __importDefault(require("express"));
const supertest_1 = __importDefault(require("supertest"));
// Mock the IP reputation tracker
jest.mock('../../src/security/ipReputationTracker', () => ({
    getScore: jest.fn().mockResolvedValue(75),
    isBlocked: jest.fn().mockResolvedValue(false),
    recordEvent: jest.fn(),
    __esModule: true,
    default: {
        getScore: jest.fn().mockResolvedValue(75),
        isBlocked: jest.fn().mockResolvedValue(false),
        recordEvent: jest.fn()
    }
}));
describe('Enhanced Rate Limit Middleware', () => {
    let app;
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        // Create a test Express app
        app = (0, express_1.default)();
        // Set up a basic test route with the rate limiter
        const testLimiter = (0, enhancedRateLimit_1.createEnhancedRateLimiter)({
            resource: 'test',
            points: 3, // Allow 3 requests
            duration: 1, // Per 1 second
            blockDuration: 1 // Block for 1 second after exceeding
        });
        app.get('/test', testLimiter, (req, res) => {
            res.status(200).json({ success: true });
        });
        // Route for testing blocked IPs
        app.get('/blocked', testLimiter, (req, res) => {
            res.status(200).json({ success: true });
        });
        // Set IP address on request
        app.use((req, res, next) => {
            req.ip = '127.0.0.1';
            next();
        });
    });
    test('should allow requests within rate limit', async () => {
        // Make 3 requests (within limit)
        for (let i = 0; i < 3; i++) {
            const response = await (0, supertest_1.default)(app).get('/test');
            expect(response.status).toBe(200);
        }
        // Verify IP reputation was checked
        expect(ipReputationTracker_1.default.getScore).toHaveBeenCalledTimes(3);
        expect(ipReputationTracker_1.default.isBlocked).toHaveBeenCalledTimes(3);
    });
    test('should block requests exceeding rate limit', async () => {
        // Make 3 requests (within limit)
        for (let i = 0; i < 3; i++) {
            const response = await (0, supertest_1.default)(app).get('/test');
            expect(response.status).toBe(200);
        }
        // Make 4th request (exceeds limit)
        const response = await (0, supertest_1.default)(app).get('/test');
        expect(response.status).toBe(429);
        expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
        // Verify event was recorded
        expect(ipReputationTracker_1.default.recordEvent).toHaveBeenCalledTimes(1);
    });
    test('should block requests from blocked IPs', async () => {
        // Mock IP as blocked
        ipReputationTracker_1.default.isBlocked.mockResolvedValueOnce(true);
        // Make request
        const response = await (0, supertest_1.default)(app).get('/blocked');
        // Should be forbidden
        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('IP_BLOCKED');
        // Verify IP check happened
        expect(ipReputationTracker_1.default.isBlocked).toHaveBeenCalledTimes(1);
    });
    test('should adjust points based on reputation score', async () => {
        // Mock different reputation scores
        ipReputationTracker_1.default.getScore
            .mockResolvedValueOnce(85) // Good: 1 point
            .mockResolvedValueOnce(60) // Neutral: 2 points
            .mockResolvedValueOnce(40) // Suspicious: 4 points
            .mockResolvedValueOnce(5); // Bad: 10 points
        // Test with good reputation (1 point per request, limit is 3 points)
        let response = await (0, supertest_1.default)(app).get('/test');
        expect(response.status).toBe(200);
        // Test with neutral reputation (2 points per request, 1 + 2 = 3 points total)
        response = await (0, supertest_1.default)(app).get('/test');
        expect(response.status).toBe(200);
        // Test with suspicious reputation (4 points per request, exceeds 3 point limit)
        response = await (0, supertest_1.default)(app).get('/test');
        expect(response.status).toBe(429);
        // Bad reputation would exceed even more but we already hit the limit
    });
});
