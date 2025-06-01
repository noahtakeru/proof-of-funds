/**
 * Configuration module for backend services
 * 
 * Centralizes all configuration with appropriate type safety and validation
 */
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Environment determination
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
const isTest = NODE_ENV === 'test';
const isDevelopment = NODE_ENV === 'development';

// Basic validation function to ensure required variables are present
const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
};

// Database configuration
const databaseConfig = {
  url: isTest 
    ? requireEnv('DATABASE_URL_TEST') 
    : requireEnv('DATABASE_URL_DEV'),
  poolSize: parseInt(process.env.PGBOUNCER_POOL_SIZE || '10', 10),
  idleTimeout: parseInt(process.env.PGBOUNCER_IDLE_TIMEOUT || '300', 10)
};

// Server configuration
const serverConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: '/api/v1',
  corsOrigins: isProduction 
    ? ['https://app.proofoffunds.com', 'https://api.proofoffunds.com'] 
    : ['http://localhost:3000', 'http://localhost:3001']
};

// JWT Authentication configuration
const jwtConfig = {
  secret: requireEnv('JWT_SECRET'),
  accessTokenExpiry: '1h',
  refreshTokenExpiry: '7d'
};

// Rate limiting configuration
const rateLimitConfig = {
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute default
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10) // 100 requests per minute default
};

// Logging configuration
const loggingConfig = {
  level: process.env.LOG_LEVEL || 'info',
  format: isProduction ? 'json' : 'pretty'
};

// Google Cloud configuration
const gcpConfig = {
  projectId: process.env.GCP_PROJECT_ID,
  secretManager: {
    enabled: Boolean(process.env.GCP_SECRET_MANAGER_ENABLED || isProduction),
  },
  storage: {
    bucketName: process.env.GCP_STORAGE_BUCKET || 'proof-of-funds-storage'
  }
};

// Audit logging configuration
const auditLogConfig = {
  enabled: true,
  retention: {
    days: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '365', 10)
  },
  gcpBackup: {
    enabled: Boolean(process.env.AUDIT_LOG_GCP_BACKUP_ENABLED || isProduction),
    bucketName: process.env.AUDIT_LOG_GCP_BUCKET || `${gcpConfig.projectId}-audit-logs`
  }
};

// ZK Proof configuration
const zkProofConfig = {
  circuitPaths: {
    standard: path.join(process.cwd(), 'public/lib/zk/circuits/standardProof'),
    threshold: path.join(process.cwd(), 'public/lib/zk/circuits/thresholdProof'),
    maximum: path.join(process.cwd(), 'public/lib/zk/circuits/maximumProof')
  },
  maxProofSize: 1024 * 1024 * 5 // 5MB
};

// Email configuration
const emailConfig = {
  host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.EMAIL_PORT || '587', 10),
  secure: process.env.EMAIL_SECURE === 'true',
  user: process.env.EMAIL_USER || '',
  password: process.env.EMAIL_PASSWORD || '',
  defaultFrom: process.env.EMAIL_FROM || 'noreply@proofoffunds.com',
  defaultReplyTo: process.env.EMAIL_REPLY_TO || 'support@proofoffunds.com',
  testUser: process.env.EMAIL_TEST_USER || '',
  testPassword: process.env.EMAIL_TEST_PASSWORD || ''
};

// Export configuration
export const config = {
  env: NODE_ENV,
  isProduction,
  isTest,
  isDevelopment,
  database: databaseConfig,
  server: serverConfig,
  jwt: jwtConfig,
  rateLimit: rateLimitConfig,
  logging: loggingConfig,
  gcp: gcpConfig,
  zkProof: zkProofConfig,
  auditLog: auditLogConfig,
  email: emailConfig
};

export default config;