/**
 * Secure proof generation endpoint
 * 
 * This handler uses the secure local files strategy for ZK proof generation.
 * It provides enhanced security by using local secure files instead of public files.
 */

import { createZkProofHandler } from '../../../utils/zkProofHandler';

// Create a handler with the secure local files strategy
const handler = createZkProofHandler({
  defaultStrategy: 'secure',
  rateLimit: 3,
  verifyProof: true,
  // Use Redis rate limiter in production for better security
  rateLimiterType: process.env.NODE_ENV === 'production' ? 'redis' : 'memory'
});

// Export the handler
export default handler;

// Export config for Next.js
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};