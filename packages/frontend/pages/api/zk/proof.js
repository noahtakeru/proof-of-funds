/**
 * Unified API endpoint for ZK proof generation
 * 
 * This is a flexible endpoint that can use any strategy for ZK proof generation.
 * The strategy can be specified in the request body as 'public', 'secure', or 'cloud'.
 */

import { createZkProofHandler, zkProofApiConfig } from '../../../utils/zkProofHandler';

// Create a handler with configurable strategy
const handler = createZkProofHandler({
  defaultStrategy: 'secure', // Default to secure strategy if not specified
  rateLimit: 5,              // Higher rate limit for unified endpoint
  verifyProof: true
});

// Export the handler
export default handler;

// Export config for Next.js
export const config = zkProofApiConfig;