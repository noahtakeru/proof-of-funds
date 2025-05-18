/**
 * Secure proof generation endpoint using Google Cloud Storage
 * 
 * This handler uses the cloud storage strategy for ZK proof generation.
 * It provides enhanced security by retrieving zkey files from secure Google Cloud Storage.
 */

import { createZkProofHandler } from '../../../utils/zkProofHandler';

// Create a handler with the cloud storage strategy and proper rate limiting
const handler = createZkProofHandler({
  defaultStrategy: 'cloud',
  rateLimit: 3,
  verifyProof: true,
  // Use Redis rate limiter in production for better security
  rateLimiterType: process.env.NODE_ENV === 'production' ? 'redis' : 'memory'
});

// Export the handler
export default handler;

// Export config for Next.js API routes
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};