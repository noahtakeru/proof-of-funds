/**
 * Main entry point for the Proof of Funds API server
 */
import express from 'express';
import compression from 'compression';
import morgan from 'morgan';
import { healthCheck } from '@proof-of-funds/db';
import config from './config';
import logger from './utils/logger';
import { corsMiddleware, helmetMiddleware, requireHttps, requestMetrics } from './middleware/security';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { defaultRateLimit } from './middleware/rateLimit';
import apiRoutes from './api';

// Create Express application
const app = express();

// Attach logger to app for middleware access
app.set('logger', logger);

// Apply security middleware
if (config.isProduction) {
  app.use(requireHttps);
}
app.use(helmetMiddleware);
app.use(corsMiddleware);

// Apply common middleware
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(compression());
app.use(morgan(config.isProduction ? 'combined' : 'dev'));
app.use(requestMetrics);

// Apply rate limiting
app.use(defaultRateLimit);

// Health check endpoint (excluded from rate limits)
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await healthCheck();
    
    res.status(200).json({
      status: 'ok',
      environment: config.env,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(503).json({
      status: 'error',
      message: 'Service unavailable',
      timestamp: new Date().toISOString()
    });
  }
});

// Apply API routes
app.use(config.server.apiPrefix, apiRoutes);

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Start server
const server = app.listen(config.server.port, () => {
  logger.info(`Server running in ${config.env} mode on port ${config.server.port}`);
  logger.info(`API available at ${config.server.apiPrefix}`);
});

// Handle graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down server...');
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
  
  // Force close after timeout
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;