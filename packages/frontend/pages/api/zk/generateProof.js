/**
 * API endpoint for generating ZK proofs
 * 
 * This handler uses the public files strategy for ZK proof generation.
 * Part of the ZK Proof Execution Plan implementation.
 */

import { createZkProofHandler } from '../../../utils/zkProofHandler';

// Create a handler with the public files strategy
const handler = createZkProofHandler({
  defaultStrategy: 'public',
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