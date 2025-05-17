/**
 * API endpoint for generating ZK proofs
 * 
 * This handler uses the public files strategy for ZK proof generation.
 * Part of the ZK Proof Execution Plan implementation.
 */

import { createZkProofHandler, zkProofApiConfig } from '../../../utils/zkProofHandler';

// Create a handler with the public files strategy
const handler = createZkProofHandler({
  defaultStrategy: 'public',
  rateLimit: 3,
  verifyProof: true
});

// Export the handler
export default handler;

// Export config for Next.js
export const config = zkProofApiConfig;