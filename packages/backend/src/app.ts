/**
 * Express Application
 * 
 * Main application setup and configuration
 */
import express from 'express';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'body-parser';

// Import middleware
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { auditMiddleware } from './middleware/auditMiddleware';
import { corsMiddleware, helmetMiddleware, requireHttps, requestMetrics } from './middleware/security';
import { defaultRateLimit } from './middleware/rateLimit';
import { csrfProtection } from './middleware/csrf';
import { secureHeadersBundle } from './middleware/secureHeaders';

// Import routes
import apiRoutes from './api';

// Create Express app
const app = express();

// Apply base middleware
app.use(requireHttps);
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(json({ limit: '1mb' }));
app.use(urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(defaultRateLimit);
app.use(secureHeadersBundle);
app.use(requestMetrics);

// Apply audit middleware globally
app.use(auditMiddleware);

// Apply CSRF protection to API routes
app.use('/api/v1', csrfProtection);

// API routes
app.use('/api/v1', apiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Route for documentation
app.get('/api/v1/docs', (req, res) => {
  res.json({
    message: 'API documentation coming soon',
    version: '1.0.0'
  });
});

// Apply error handler
app.use(errorHandler);

// Apply 404 handler
app.use(notFoundHandler);

// Export for tests
export { app };