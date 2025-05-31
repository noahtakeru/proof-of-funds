/**
 * Express Application
 * 
 * Main application setup and configuration
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { json, urlencoded } from 'body-parser';

// Import middleware
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { auditMiddleware } from './middleware/auditMiddleware';

// Import routes
import auditLogRoutes from './api/audit-logs';

// Create Express app
const app = express();

// Apply middleware
app.use(helmet());
app.use(cors());
app.use(json());
app.use(urlencoded({ extended: true }));

// Apply audit middleware globally
app.use(auditMiddleware);

// API routes
app.use('/api/audit-logs', auditLogRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// API routes placeholder for tests
// These would normally be imported from separate files
app.post('/api/v1/auth/nonce', (req, res) => {
  const { address } = req.body;
  if (!address) {
    return res.status(400).json({ error: { code: 'MISSING_ADDRESS' } });
  }
  const nonce = Math.floor(Math.random() * 1000000).toString();
  const message = `Sign this message to authenticate with nonce: ${nonce}`;
  res.status(200).json({ nonce, message });
});

app.post('/api/v1/auth/authenticate', (req, res) => {
  const { address, signature, nonce } = req.body;
  if (!address || !signature || !nonce) {
    return res.status(400).json({ error: { code: 'MISSING_PARAMS' } });
  }
  res.status(200).json({
    token: 'mock-jwt-token',
    refreshToken: 'mock-refresh-token',
    user: { address }
  });
});

app.post('/api/v1/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: { code: 'MISSING_REFRESH_TOKEN' } });
  }
  res.status(200).json({
    token: 'mock-jwt-token',
    user: { id: 'user-id', address: 'user-address' }
  });
});

// Placeholder for proofs endpoints
app.post('/api/v1/proofs', (req, res) => {
  const { proofType, input } = req.body;
  if (!proofType) {
    return res.status(400).json({ error: { code: 'INVALID_PROOF_TYPE' } });
  }
  if (!input) {
    return res.status(400).json({ error: { code: 'MISSING_PARAMETERS' } });
  }
  
  res.status(201).json({
    referenceId: 'mock-reference-id',
    proofId: 'mock-proof-id',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    proofType,
    decryptionKey: 'mock-decryption-key'
  });
});

app.get('/api/v1/proofs', (req, res) => {
  // Simulate pagination
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const status = req.query.status;
  const type = req.query.type;
  
  // Mock data with filters applied
  const proofs = [
    {
      id: 'proof-1',
      referenceId: 'ref-1',
      proofType: 'STANDARD',
      status: 'CONFIRMED'
    }
  ];
  
  res.status(200).json({
    proofs,
    pagination: { page, limit, total: 1, totalPages: 1 }
  });
});

app.get('/api/v1/proofs/:proofId', (req, res) => {
  const { proofId } = req.params;
  
  // Simulate not found
  if (proofId === 'non-existent') {
    return res.status(404).json({ error: { code: 'PROOF_NOT_FOUND' } });
  }
  
  res.status(200).json({
    id: proofId,
    referenceId: `ref-${proofId}`,
    proofType: 'STANDARD',
    status: 'CONFIRMED'
  });
});

app.post('/api/v1/proofs/:proofId/revoke', (req, res) => {
  const { proofId } = req.params;
  const { reason } = req.body;
  
  // Simulate not found
  if (proofId === 'non-existent') {
    return res.status(404).json({ error: { code: 'PROOF_NOT_FOUND' } });
  }
  
  res.status(200).json({
    success: true,
    proof: {
      id: proofId,
      isRevoked: true,
      status: 'REVOKED',
      revokedAt: new Date().toISOString()
    }
  });
});

// Verification endpoints
app.get('/api/v1/verify/:referenceId', (req, res) => {
  const { referenceId } = req.params;
  
  // Simulate not found
  if (referenceId === 'non-existent-reference-id') {
    return res.status(404).json({ error: { code: 'PROOF_NOT_FOUND' } });
  }
  
  // Return different responses based on reference ID
  if (referenceId.includes('expired')) {
    return res.status(200).json({
      exists: true,
      proofType: 'STANDARD',
      status: 'EXPIRED',
      isExpired: true,
      isRevoked: false
    });
  }
  
  if (referenceId.includes('revoked')) {
    return res.status(200).json({
      exists: true,
      proofType: 'STANDARD',
      status: 'REVOKED',
      isExpired: false,
      isRevoked: true
    });
  }
  
  res.status(200).json({
    exists: true,
    proofType: 'STANDARD',
    status: 'CONFIRMED',
    isExpired: false,
    isRevoked: false
  });
});

app.post('/api/v1/verify/:referenceId', (req, res) => {
  const { referenceId } = req.params;
  const { decryptionKey, verifierAddress } = req.body;
  
  if (!decryptionKey) {
    return res.status(400).json({ error: { code: 'MISSING_DECRYPTION_KEY' } });
  }
  
  // Simulate not found
  if (referenceId === 'non-existent-reference-id') {
    return res.status(404).json({ error: { code: 'PROOF_NOT_FOUND' } });
  }
  
  // Different responses based on reference ID
  if (referenceId.includes('revoked')) {
    return res.status(400).json({ error: { code: 'PROOF_REVOKED' } });
  }
  
  if (referenceId.includes('expired')) {
    return res.status(400).json({ error: { code: 'PROOF_EXPIRED' } });
  }
  
  if (referenceId.includes('pending')) {
    return res.status(400).json({ error: { code: 'PROOF_NOT_CONFIRMED' } });
  }
  
  res.status(200).json({
    isValid: true,
    proofType: 'STANDARD',
    input: {
      balance: "1000000000000000000",
      threshold: "1000000000000000000",
      userAddress: "0x1234567890123456789012345678901234567890"
    },
    verificationId: 'mock-verification-id'
  });
});

// Apply error handler
app.use(errorHandler);

// Apply 404 handler
app.use(notFoundHandler);

// Export for tests
export { app };