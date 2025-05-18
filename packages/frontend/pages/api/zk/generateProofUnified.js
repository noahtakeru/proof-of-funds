/**
 * Unified API endpoint for ZK proof generation
 * 
 * This handler supports all ZK proof strategies through a single endpoint.
 * It selects the appropriate strategy based on the "strategy" parameter in the request.
 */

import { createZkProofHandler } from '../../../utils/zkProofHandler';

// Create a handler with dynamic strategy selection
const handler = createZkProofHandler({
  defaultStrategy: 'public', // Default to public files if not specified
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