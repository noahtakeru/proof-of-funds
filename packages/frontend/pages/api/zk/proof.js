/**
 * Unified API endpoint for ZK proof generation
 * 
 * This is a flexible endpoint that can use any strategy for ZK proof generation.
 * The strategy can be specified in the request body as 'public', 'secure', or 'cloud'.
 */

import { createZkProofHandler } from '../../../utils/zkProofHandler';

// Create a handler with configurable strategy
const handler = createZkProofHandler({
  defaultStrategy: 'secure', // Default to secure strategy if not specified
  rateLimit: 5,              // Higher rate limit for unified endpoint
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